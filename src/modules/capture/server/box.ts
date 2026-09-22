// File access on the callbox for captures: sizes, free space, binary-safe
// fetch to the SimTool host, and cleanup of the temp files SimTool created.
//
// Transport is SSH with the system's stored login. The SimTool agent on :9050
// is not used: its config route returns file content as a utf8 string, which
// corrupts binary IQ/pcap data.
//
// A loopback transport exists for offline QA only: when the "callbox" is
// 127.0.0.1 and the server is not a production build, files are read from
// this machine's /tmp directly (the mock remote API writes them there). It is
// refused in production.
import * as fs from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import { NodeSSH } from 'node-ssh';
import { hasSshLogin, shq, type SshCreds } from './validate';

/** Every remote path this module touches must look like a SimTool temp file. */
const SAFE_REMOTE = /^\/tmp\/simtool-[A-Za-z0-9._-]{1,120}$/;
const assertSafe = (p: string) => {
  if (!SAFE_REMOTE.test(p) || p.includes('..')) throw new Error(`Refusing to touch ${p}: not a SimTool temp file`);
};

export interface ExecResult { code: number | null; stdout: string; stderr: string }

export interface Box {
  kind: 'ssh' | 'loopback';
  /** Free bytes in the filesystem holding `dir` on the box. */
  freeBytes(dir: string): Promise<number>;
  /** Size of each path, or null when it does not exist / is unreadable. */
  sizeOf(paths: string[]): Promise<Record<string, number | null>>;
  fetch(remote: string, local: string, onProgress?: (bytes: number) => void): Promise<void>;
  /** Deletes SimTool temp files; returns the paths that could not be removed. */
  remove(paths: string[]): Promise<string[]>;
  exec(command: string, onStdout?: (s: string) => void): Promise<ExecResult>;
  dispose(): void;
}

export const isLoopbackAllowed = (host: string) =>
  host === '127.0.0.1' && process.env.NODE_ENV !== 'production' && process.env.CAPTURE_DISABLE_LOOPBACK !== '1';

/** Fail fast, before touching the callbox, when files could not be fetched. */
export function assertFetchable(creds: SshCreds) {
  if (isLoopbackAllowed(creds.host) && !hasSshLogin(creds)) return;
  if (!hasSshLogin(creds)) throw new Error(NO_SSH);
}
const NO_SSH = 'This system has no SSH login saved, so SimTool cannot fetch capture files from it. Add the username and password (or key) in Test Systems.';

export async function openBox(creds: SshCreds): Promise<Box> {
  if (isLoopbackAllowed(creds.host) && !hasSshLogin(creds)) return loopbackBox();
  if (!hasSshLogin(creds)) {
    throw new Error(NO_SSH);
  }
  const ssh = new NodeSSH();
  await ssh.connect({
    host: creds.host,
    port: Number(creds.port ?? 22),
    username: creds.username,
    ...(creds.privateKey ? { privateKey: creds.privateKey } : { password: creds.password }),
    readyTimeout: 8000,
  }).catch((e: any) => { throw new Error(`SSH to ${creds.host}: ${e?.message ?? e}`); });
  return sshBox(ssh);
}

function sshBox(ssh: NodeSSH): Box {
  const exec = async (command: string, onStdout?: (s: string) => void): Promise<ExecResult> => {
    const r = await ssh.execCommand(command, onStdout ? { onStdout: b => onStdout(b.toString()) } : undefined);
    return { code: r.code, stdout: r.stdout, stderr: r.stderr };
  };
  return {
    kind: 'ssh',
    exec,
    async freeBytes(dir) {
      if (!/^\/[A-Za-z0-9/_-]*$/.test(dir)) throw new Error('bad dir');
      const r = await exec(`df -Pk ${shq(dir)} | tail -1`);
      const kb = Number(r.stdout.trim().split(/\s+/)[3]);
      if (!Number.isFinite(kb)) throw new Error(`Could not read free space on the box: ${r.stderr || r.stdout}`);
      return kb * 1024;
    },
    async sizeOf(paths) {
      paths.forEach(assertSafe);
      const out: Record<string, number | null> = {};
      if (paths.length === 0) return out;
      const r = await exec(paths.map(p => `stat -c %s -- ${shq(p)} 2>/dev/null || echo -1`).join('; '));
      const lines = r.stdout.trim().split(/\r?\n/);
      paths.forEach((p, i) => { const n = Number(lines[i]); out[p] = Number.isFinite(n) && n >= 0 ? n : null; });
      return out;
    },
    async fetch(remote, local, onProgress) {
      assertSafe(remote);
      try {
        // SFTP fastGet streams to disk in parallel chunks, never buffering the file.
        await ssh.getFile(local, remote, null, { step: (done: number) => onProgress?.(done) } as any);
        return;
      } catch (e: any) {
        // Some boxes disable the SFTP subsystem; fall back to `cat` over an
        // exec channel, which is binary-safe and still streamed.
        if (!/sftp|subsystem|unable to start/i.test(String(e?.message ?? e))) throw e;
      }
      const conn = ssh.connection;
      if (!conn) throw new Error('SSH connection lost');
      await new Promise<void>((resolve, reject) => {
        conn.exec(`cat -- ${shq(remote)}`, (err, stream) => {
          if (err) return reject(err);
          let n = 0;
          const count = new Transform({ transform(chunk, _enc, cb) { n += chunk.length; onProgress?.(n); cb(null, chunk); } });
          pipeline(stream, count, fs.createWriteStream(local)).then(resolve, reject);
        });
      });
    },
    async remove(paths) {
      paths.forEach(assertSafe);
      if (paths.length === 0) return [];
      const list = paths.map(shq).join(' ');
      // lteenb runs as root, so its dump files belong to root; /tmp's sticky
      // bit then stops a non-root login deleting them. Try sudo -n (never
      // prompts) when the plain rm leaves anything behind.
      await exec(`rm -f -- ${list} 2>/dev/null; for f in ${list}; do [ -e "$f" ] && sudo -n rm -f -- "$f" 2>/dev/null; done; true`);
      const r = await exec(`for f in ${list}; do [ -e "$f" ] && echo "$f"; done; true`);
      return r.stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    },
    dispose() { ssh.dispose(); },
  };
}

function loopbackBox(): Box {
  return {
    kind: 'loopback',
    async exec() { throw new Error('Shell commands are not available on the loopback QA transport'); },
    async freeBytes(dir) {
      const s = await fs.promises.statfs(dir);
      return Number(s.bavail) * Number(s.bsize);
    },
    async sizeOf(paths) {
      paths.forEach(assertSafe);
      const out: Record<string, number | null> = {};
      for (const p of paths) out[p] = await fs.promises.stat(p).then(s => s.size, () => null);
      return out;
    },
    async fetch(remote, local, onProgress) {
      assertSafe(remote);
      let n = 0;
      const count = new Transform({ transform(chunk, _enc, cb) { n += chunk.length; onProgress?.(n); cb(null, chunk); } });
      await pipeline(fs.createReadStream(remote), count, fs.createWriteStream(local));
    },
    async remove(paths) {
      paths.forEach(assertSafe);
      const left: string[] = [];
      for (const p of paths) await fs.promises.rm(p, { force: true }).catch(() => left.push(p));
      return left;
    },
    dispose() {},
  };
}
