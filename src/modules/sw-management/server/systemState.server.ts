// Collect the current Amarisoft state of a target system — read-only.
//
// Transport 1: SSH (when credentials work). One shell script stats + reads a
// fixed list of files (base64 so binary/UTF-8 survives) plus a few shell-only
// facts (systemctl is-enabled, /dev/sdr* count, Ettus USB ids, license listing).
//
// Transport 2: SimTool agent on :9050 (no credentials needed). Its
// GET /api/nodes/configs/<module>/<file>?path=<dir> reads any file; the error
// text tells us whether a path is missing (ENOENT) or a directory (EISDIR).
// It can't lstat or list arbitrary dirs, so symlinks are inferred from the
// enb/mme/ims config list routes (stat follows links → a link and its target
// share size + timestamps) and license names are guessed. Device nodes are
// never opened through the agent.
import type { NodeSSH } from 'node-ssh';
import { agentUrl } from '@/lib/constants';
import type { SystemState } from '../types/detection';
import {
  buildSystemState, phase1Paths, phase2Paths,
  type ListedConfig, type Probe, type ProbeSet,
} from '../lib/systemState';

const MAX_TEXT_BYTES = 256 * 1024;
const DEFAULT_IDIR = '/root';
const HOME = '/root';

function shq(s: string) {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function idirFromLteInstall(content?: string): string | undefined {
  return content?.match(/LAST_IDIR="([^"]+)"/)?.[1];
}

// ── SSH ─────────────────────────────────────────────────────────────────────

async function sshProbe(ssh: NodeSSH, password: string | undefined, text: string[], exist: string[], withExtras: boolean): Promise<{ files: Record<string, Probe>; extras: Record<string, string> }> {
  const lines: string[] = [
    'p_stat() { p="$1"; L=0; [ -L "$p" ] && L=1;',
    '  if [ -d "$p" ]; then echo "@@P|$p|dir|$L"; elif [ -c "$p" ] || [ -b "$p" ]; then echo "@@P|$p|dev|$L";',
    '  elif [ -e "$p" ]; then echo "@@P|$p|file|$L"; else echo "@@P|$p|missing|0"; fi; }',
    'p_read() { p="$1"; p_stat "$p"; if [ -f "$p" ] && [ -r "$p" ]; then echo "@@C|$p|$(head -c ' + MAX_TEXT_BYTES + ' "$p" | base64 | tr -d \'\\n\')"; fi; }',
  ];
  for (const p of text) lines.push(`p_read ${shq(p)}`);
  for (const p of exist) lines.push(`p_stat ${shq(p)}`);
  if (withExtras) {
    lines.push(
      'echo "@@X|uname_m|$(uname -m)"',
      'echo "@@X|lte_enabled|$(systemctl is-enabled lte 2>/dev/null || echo unknown)"',
      'echo "@@X|sdr_devs|$(ls -1 /dev/sdr* 2>/dev/null | grep -c -E \'/dev/sdr[0-9]+$\')"',
      'echo "@@X|usb_ettus|$(grep -l -s -i -x 2500 /sys/bus/usb/devices/*/idVendor 2>/dev/null | wc -l)"',
      `echo "@@X|license_files|$(ls -1 ${HOME}/.amarisoft 2>/dev/null | tr '\\n' ' ')"`,
    );
  }
  const script = lines.join('\n');
  const b64 = Buffer.from(script).toString('base64');
  const pw = password ? shq(password) : "''";
  // Root boxes run it directly; others go through sudo (files under /root).
  const cmd = `S="$(echo ${b64} | base64 -d)"; if [ "$(id -u)" = 0 ]; then bash -c "$S"; ` +
    `else echo ${pw} | sudo -S -p '' bash -c "$S" 2>/dev/null || bash -c "$S"; fi`;
  const r = await ssh.execCommand(cmd, { execOptions: { pty: false } });

  const files: Record<string, Probe> = {};
  const extras: Record<string, string> = {};
  for (const line of r.stdout.split('\n')) {
    if (line.startsWith('@@P|')) {
      const [, p, kind, link] = line.split('|');
      files[p] = { ...(files[p] ?? {}), kind: kind as Probe['kind'], isLink: link === '1' };
    } else if (line.startsWith('@@C|')) {
      const i = line.indexOf('|', 4);
      const p = line.slice(4, i);
      const content = Buffer.from(line.slice(i + 1), 'base64').toString('utf8');
      files[p] = { ...(files[p] ?? { kind: 'file' }), content };
    } else if (line.startsWith('@@X|')) {
      const [, k, ...rest] = line.split('|');
      extras[k] = rest.join('|').trim();
    }
  }
  return { files, extras };
}

// ── Agent ───────────────────────────────────────────────────────────────────

async function fetchJson(url: string, timeoutMs: number): Promise<{ status: number; body: any } | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ac.signal });
    const body = await r.json().catch(() => null);
    return { status: r.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function agentProbeOne(host: string, fullPath: string, timeoutMs: number): Promise<Probe> {
  const i = fullPath.lastIndexOf('/');
  const dir = fullPath.slice(0, i) || '/';
  const name = fullPath.slice(i + 1);
  const url = `${agentUrl(host, `/api/nodes/configs/enb/${encodeURIComponent(name)}`)}?path=${encodeURIComponent(dir)}`;
  const r = await fetchJson(url, timeoutMs);
  if (!r || !r.body) return { kind: 'unknown' };
  if (typeof r.body.content === 'string') {
    return { kind: 'file', content: r.body.content.slice(0, MAX_TEXT_BYTES) };
  }
  const details = String(r.body.details ?? r.body.error ?? '');
  if (details.startsWith('ENOENT') || details.startsWith('ENOTDIR')) return { kind: 'missing' };
  if (details.startsWith('EISDIR')) return { kind: 'dir' };
  if (details.startsWith('EINVAL')) return { kind: 'dev' };
  if (details.startsWith('EACCES') || details.startsWith('EPERM')) return { kind: 'file' };
  return { kind: 'unknown' };
}

async function agentProbe(host: string, paths: string[], timeoutMs = 6000): Promise<Record<string, Probe>> {
  const out: Record<string, Probe> = {};
  // Small batches — the agent runs next to a live eNB.
  for (let i = 0; i < paths.length; i += 8) {
    const batch = paths.slice(i, i + 8);
    const res = await Promise.all(batch.map(p => agentProbeOne(host, p, timeoutMs)));
    batch.forEach((p, j) => { out[p] = res[j]; });
  }
  return out;
}

async function agentListings(host: string, dirs: string[]): Promise<Record<string, ListedConfig[]>> {
  const out: Record<string, ListedConfig[]> = {};
  const routes: Array<{ module: string; dir: string }> = [];
  for (const dir of dirs) {
    if (dir.endsWith('/enb/config')) routes.push({ module: 'enb', dir }, { module: 'gnb', dir });
    if (dir.endsWith('/mme/config')) routes.push({ module: 'mme', dir }, { module: 'ims', dir });
    if (dir.endsWith('/ue/config')) routes.push({ module: 'ue', dir });
  }
  await Promise.all(routes.map(async ({ module, dir }) => {
    const r = await fetchJson(`${agentUrl(host, `/api/nodes/configs/${module}/list`)}?path=${encodeURIComponent(dir)}`, 6000);
    if (!r || !Array.isArray(r.body)) return;
    out[dir] = [...(out[dir] ?? []), ...r.body.map((e: any) => ({
      name: String(e.name), size: Number(e.size), modifiedAt: String(e.modifiedAt), createdAt: e.createdAt ? String(e.createdAt) : undefined,
    }))];
  }));
  return out;
}

// ── Entry point ─────────────────────────────────────────────────────────────

export async function collectSystemState(opts: {
  host: string;
  ssh?: NodeSSH | null;        // connected session, when SSH worked
  password?: string;
  packageVersion?: string;
}): Promise<SystemState> {
  const { host, ssh, password, packageVersion } = opts;

  if (ssh) {
    try {
      const lte = await sshProbe(ssh, password, [`${HOME}/.lte-install`], [], false);
      const idir = idirFromLteInstall(lte.files[`${HOME}/.lte-install`]?.content) || DEFAULT_IDIR;
      const p1 = phase1Paths(idir, HOME);
      const a = await sshProbe(ssh, password, p1.text, p1.exist, true);
      const p2 = phase2Paths(a.files, idir, HOME, a.extras).filter(p => !(p in a.files));
      const b = p2.length ? await sshProbe(ssh, password, p2, [], false) : { files: {}, extras: {} };
      const set: ProbeSet = { via: 'ssh', files: { ...lte.files, ...a.files, ...b.files }, extras: a.extras };
      const state = buildSystemState(set, { idir, home: HOME, packageVersion });
      if (state.ok) return state;
    } catch {
      // fall through to the agent
    }
  }

  try {
    const lte = await agentProbe(host, [`${HOME}/.lte-install`]);
    const idir = idirFromLteInstall(lte[`${HOME}/.lte-install`]?.content) || DEFAULT_IDIR;
    const p1 = phase1Paths(idir, HOME);
    const a = await agentProbe(host, [...p1.text, ...p1.exist]);
    const p2 = phase2Paths(a, idir, HOME).filter(p => !(p in a));
    const b = p2.length ? await agentProbe(host, p2) : {};
    const files = { ...lte, ...a, ...b };
    const cfgDirs = Array.from(new Set(phase2Paths(files, idir, HOME).map(p => p.slice(0, p.lastIndexOf('/')))));
    const listings = await agentListings(host, cfgDirs);
    return buildSystemState({
      via: 'agent', files, listings,
      error: ssh ? undefined : 'SSH not available — read via SimTool agent',
    }, { idir, home: HOME, packageVersion });
  } catch (e: any) {
    return buildSystemState({ via: 'none', files: {}, error: e?.message }, { idir: DEFAULT_IDIR, home: HOME, packageVersion });
  }
}
