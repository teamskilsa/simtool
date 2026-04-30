// Validate an Amarisoft config WITHOUT replacing the live one or
// restarting the running daemon. SCPs the cfg to a tmp path, runs
// `lteenb -c <tmp>` (or ltemme/lteue) directly with a watchdog timeout,
// captures stdout+stderr, kills the test process. Returns the captured
// output to the UI so the user can iterate on syntax + RF init errors
// without bouncing the production daemon every time.
//
// This is the loop that was missing — every deploy attempt before this
// would replace the live cfg, restart the daemon, wait 20s for port
// 9001, time out, then mine for the actual error. Now: click Validate,
// see the parser/init output in 5s, fix in builder, repeat.
import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

interface ModuleEntry {
  binary: string;       // absolute path to daemon
  workingDir: string;   // cwd when invoking (Amarisoft cfgs use relative paths)
}

const MODULE_MAP: Record<string, ModuleEntry> = {
  enb: { binary: '/root/enb/lteenb',  workingDir: '/root/enb' },
  gnb: { binary: '/root/enb/lteenb',  workingDir: '/root/enb' },
  mme: { binary: '/root/mme/ltemme',  workingDir: '/root/mme' },
  ims: { binary: '/root/mme/ltemme',  workingDir: '/root/mme' },
  ue:  { binary: '/root/ue/lteue',    workingDir: '/root/ue'  },
};

interface ValidateResponse {
  success: boolean;
  error?: string;
  /** True if Amarisoft accepted the config (no parse / RF errors found
   *  in the output before the watchdog timeout fired). */
  accepted: boolean;
  /** Captured stdout+stderr from the daemon test invocation. */
  output: string;
  /** First "config/<file>:<line>:<col>:<msg>" parse-error line, if any. */
  parseError?: string;
  /** First runtime-init error (e.g. "Could not initialize RF driver"). */
  initError?: string;
  durationMs: number;
}

const q = (s: string) => `'${String(s).replace(/'/g, "'\\''")}'`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const t0 = Date.now();
  const {
    host, port = 22, username, password, privateKey, passphrase,
    module, configContent,
    timeoutSec = 5,
  } = req.body ?? {};

  const fail = (msg: string): ValidateResponse => ({
    success: false, error: msg, accepted: false, output: '',
    durationMs: Date.now() - t0,
  });

  if (!host || !username) return res.status(200).json(fail('host and username are required'));
  if (!password && !privateKey) return res.status(200).json(fail('password or privateKey required'));
  if (!module) return res.status(200).json(fail('module is required'));
  if (typeof configContent !== 'string' || !configContent.trim()) {
    return res.status(200).json(fail('configContent is empty'));
  }

  const mapping = MODULE_MAP[module];
  if (!mapping) {
    const supported = Object.keys(MODULE_MAP).join(', ');
    return res.status(200).json(fail(`unknown module "${module}" — supported: ${supported}`));
  }

  // Local tmp file → SCP cleanly (no shell-quoting hell).
  const localTmp = path.join(os.tmpdir(), `simtool-validate-${Date.now()}.cfg`);
  await fs.writeFile(localTmp, configContent, 'utf8');

  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: String(host),
      port: Number(port),
      username: String(username),
      ...(privateKey ? { privateKey: String(privateKey), passphrase } : { password: String(password) }),
      readyTimeout: 10000,
    });

    const sudoPwd = password ? String(password) : '';
    const sudo = sudoPwd
      ? `echo '${sudoPwd.replace(/'/g, "'\\''")}' | sudo -S -p ''`
      : 'sudo';

    // SCP to a user-writable path; lteenb will read it from there.
    const remoteTmp = `/tmp/simtool-validate-${Date.now()}.cfg`;
    await ssh.putFile(localTmp, remoteTmp);
    await fs.unlink(localTmp).catch(() => {});

    // ── The validate run ────────────────────────────────────────────
    // `timeout -s KILL <N>s` runs the daemon for at most N seconds then
    // SIGKILLs it. lteenb exits early on parse/init errors and prints to
    // stdout+stderr inside its (otherwise screen-wrapped) startup; we
    // pipe both to our buffer with `2>&1`. cd to the daemon's normal
    // cwd so its relative include paths (drb.cfg, sib*.asn) resolve.
    //
    // The daemon prints its banner + license info, then either:
    //   - "config/<file>:<line>:<col>: <error>" on parse failure, or
    //   - "[INIT] Config error:" / "Could not initialize RF driver" /
    //     similar on init failure.
    // We grep both patterns and surface the first hit explicitly.
    // cd MUST run inside sudo's shell — /root/{enb,mme,ue} are
    // root-owned and the SSH user can't cd into them. Earlier form
    // (`cd … && sudo lteenb`) failed at cd with "Permission denied"
    // before sudo even started. Wrap the whole pipeline in
    // `sudo bash -c '…'`.
    const cmd =
      `${sudo} bash -c ${q(`cd ${mapping.workingDir} && ` +
        `timeout -s KILL ${Number(timeoutSec)}s ${mapping.binary} ${remoteTmp} 2>&1 | head -200`)}`;
    const r = await ssh.execCommand(cmd);
    let output = (r.stdout + (r.stderr ? '\n' + r.stderr : '')).trim();

    // Fallback: if the dry-run produced nothing useful (env / perm
    // issue), peek at the OTS watchdog log. It captures init errors
    // from the live daemon — same content the user sees on
    // `screen -x lte`. Useful when validate can't run lteenb directly
    // but the live daemon is currently failing for the same reason.
    const sparse =
      output.length < 40 ||
      /Permission denied|command not found|sudo:.*not found/.test(output);
    if (sparse) {
      const otsRes = await ssh.execCommand(
        `${sudo} tail -n 60 /var/log/lte/ots.log 2>/dev/null || ` +
        `${sudo} tail -n 60 /var/log/ots/ots.log 2>/dev/null || ` +
        `${sudo} tail -n 60 /root/ots/log/ots.log 2>/dev/null || true`,
      );
      const otsTail = (otsRes.stdout || '').trim();
      if (otsTail) {
        output = `${output}\n\n--- /var/log/lte/ots.log (tail) ---\n${otsTail}`;
      }
    }

    // Parse-error line: "config/enb.cfg:75:26: <message>"
    const parseMatch = output.match(/config\/[^\s:]+:\d+:\d+:[^\n]+/);
    // Init / runtime errors. Includes:
    //   - [OTS] - ENB: INIT error: ... (the OTS watchdog's tag)
    //   - [CONFIG] / [INIT] / [RF] / [FATAL] / [ERROR] (lteenb tags)
    //   - "Could not initialize ..." / "Missing src port definitions"
    //     (raw stderr from trx drivers)
    //   - "License error" (license-server reachability)
    const initMatch = !parseMatch && output.match(
      /(\[OTS\][^\n]*INIT\s+error[^\n]*|\[(?:CONFIG|INIT|RF|FATAL|ERROR)\][^\n]+|Could not[^\n]+|Missing[^\s][^\n]*|License error[^\n]+)/,
    );

    // Cleanup the remote temp cfg.
    await ssh.execCommand(`${sudo} rm -f ${q(remoteTmp)} 2>/dev/null || true`);

    // Detect "no errors" — the daemon got past init and was killed by
    // the watchdog. Heuristic: output contains the Amarisoft banner +
    // license-server line + no parse/init match.
    const accepted = !parseMatch && !initMatch && /Base Station version|version 20\d\d-\d\d-\d\d/.test(output);

    return res.status(200).json({
      success: true,
      accepted,
      output: output.slice(-4000),
      parseError: parseMatch ? parseMatch[0].trim() : undefined,
      initError: initMatch ? initMatch[1].trim() : undefined,
      durationMs: Date.now() - t0,
    } satisfies ValidateResponse);
  } catch (err: any) {
    await fs.unlink(localTmp).catch(() => {});
    return res.status(200).json({
      success: false,
      accepted: false,
      output: '',
      error: err?.message || 'validation failed',
      durationMs: Date.now() - t0,
    } satisfies ValidateResponse);
  } finally {
    ssh.dispose();
  }
}
