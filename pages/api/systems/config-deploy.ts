// Deploy a generated config file to a remote system and restart the Amarisoft service.
// Used by the test execution flow: write config → restart service → verify port.
//
// Response shape is uniform whether or not the deploy succeeded — clients
// inspect `copySuccess` / `restartSuccess` / `portStatus` rather than HTTP
// status. The `commandLog` array is the most useful debugging surface: a
// chronological list of every shell command issued plus its stdout/stderr,
// so a user staring at a "Deploy failed" alert can see exactly which step
// blew up and why (e.g. "sudo: no tty present", "Permission denied",
// "config/enb.cfg:44:16: field 'cell_id': range is [0:255]").
import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

interface ModuleEntry {
  configPath: string;
  /** systemctl/service unit name. Empty string = no restart needed (e.g.
   *  ue_db is reloaded at runtime by MME, IMS is folded into ltemme). */
  service: string;
  /** TCP port to probe after restart. 0 = don't probe (no API). */
  checkPort: number;
}

// ── Module → remote config path + service name + verification port ───────────
// Sub-6 NR runs under the same `lteenb` daemon as LTE — no separate ltegnb
// service exists in current Amarisoft releases — so gNB configs live in the
// same /root/enb/config/ directory and the same `lte` unit gets bounced.
// IMS runs inside ltemme; restarting ltemme also brings IMS back.
const MODULE_MAP: Record<string, ModuleEntry> = {
  enb:   { configPath: '/root/enb/config/enb.cfg',   service: 'lte',    checkPort: 9001 },
  gnb:   { configPath: '/root/enb/config/gnb.cfg',   service: 'lte',    checkPort: 9002 },
  mme:   { configPath: '/root/mme/config/mme.cfg',   service: 'ltemme', checkPort: 9000 },
  ims:   { configPath: '/root/mme/config/ims.cfg',   service: 'ltemme', checkPort: 9000 },
  ue:    { configPath: '/root/ue/config/ue.cfg',     service: 'lteue',  checkPort: 9002 },
  ue_db: { configPath: '/root/mme/config/ue_db.cfg', service: '',       checkPort: 0    },
};

interface CommandLogEntry {
  step: string;       // e.g. "scp", "mv", "restart", "port-check"
  cmd?: string;       // the shell command we ran (omitted for non-shell ops)
  code?: number;      // exit code if applicable
  stdout?: string;
  stderr?: string;
  ms?: number;
  ok: boolean;
}

interface DeployResponse {
  copySuccess: boolean;
  copyMessage: string;
  restartSuccess: boolean;
  restartError?: string;
  portStatus: boolean;
  output: string;        // tail of restart output (last 500 chars)
  /** High-level reason this deploy didn't reach success — the single line
   *  best-suited for a toast title. */
  error?: string;
  /** Which phase failed: 'request' | 'connect' | 'scp' | 'mv' | 'restart' | 'port-check' */
  phase?: string;
  /** Full chronological log of shell commands + their output. Most useful
   *  surface for users debugging a failure. */
  commandLog: CommandLogEntry[];
}

function q(s: string): string {
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}

const TAIL = (s: string, n = 500) => (s ?? '').toString().slice(-n);

/**
 * Defensively fix known patterns that Amarisoft's parser rejects but
 * earlier builder versions emitted. Runs right before SCP so old saved
 * configs deploy cleanly without the user having to re-Save every file.
 *
 * cipher_algo_pref / integ_algo_pref normalization. Amarisoft wants
 * INTEGER values (0=EEA0, 1=EEA1, 2=EEA2, 3=EEA3). Three earlier wrong
 * forms we've shipped or seen on disk:
 *
 *   ["eea0", "eea2"]   → quoted lowercase strings.
 *                        Errors: "algorithm identifier expected"
 *   [EEA0, EEA2]       → bare uppercase identifiers.
 *                        Errors: "unexpected identifier: EEA0"
 *   ["EEA2"]           → quoted uppercase (sometimes from manual edits).
 *
 * All three rewrite to bare integers: [0, 2] / [2, 3]. Already-correct
 * integer arrays pass through untouched.
 *
 * Returns the rewritten content + a list of fixes applied so the deploy
 * report can surface what changed.
 */
function sanitizeAmarisoftCfg(content: string): { fixed: string; appliedFixes: string[] } {
  const applied: string[] = [];
  let out = content;

  for (const field of ['cipher_algo_pref', 'integ_algo_pref']) {
    const re = new RegExp(`(${field}\\s*:\\s*\\[)([^\\]]*)(\\])`, 'g');
    out = out.replace(re, (full: string, head: string, body: string, tail: string) => {
      // Empty array → leave alone.
      const trimmed = body.trim();
      if (!trimmed) return full;

      // Already pure integers? Skip — no need to touch.
      const allInts = trimmed.split(',').every(s => /^\s*\d+\s*$/.test(s));
      if (allInts) return full;

      // Convert each entry — quoted/unquoted, lowercase/uppercase — to
      // an int by taking the trailing digit off "EEA2" / "eia3" etc.
      const ints = trimmed
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
        .map(s => {
          const m = s.match(/(\d+)\s*$/);
          return m ? parseInt(m[1], 10) : NaN;
        })
        .filter(n => Number.isFinite(n));

      if (ints.length === 0) return full;
      const replaced = `[${ints.join(', ')}]`;
      applied.push(`${field}: '${trimmed}' → '${ints.join(', ')}'`);
      // head ends with '['; tail is ']'. Replace the whole thing.
      return `${head.replace(/\[\s*$/, '')}${replaced}`;
    });
  }

  return { fixed: out, appliedFixes: applied };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    host, port = 22, username, password, privateKey, passphrase,
    module, configContent,
  } = req.body ?? {};

  // ── Request validation. Use 200 + structured error so the client's
  //    response handler doesn't have to fork on HTTP status; one shape
  //    for all outcomes.
  const fail = (phase: string, error: string, copyMessage?: string): DeployResponse => ({
    copySuccess: false,
    copyMessage: copyMessage ?? error,
    restartSuccess: false,
    portStatus: false,
    output: '',
    error,
    phase,
    commandLog: [],
  });

  if (!host || !username) {
    return res.status(200).json(fail('request', 'host and username are required'));
  }
  if (!password && !privateKey) {
    return res.status(200).json(fail('request', 'password or privateKey is required'));
  }
  if (!module) {
    return res.status(200).json(fail('request', 'module is required'));
  }
  if (configContent === undefined) {
    return res.status(200).json(fail('request', 'configContent is required'));
  }

  const mapping = MODULE_MAP[module];
  if (!mapping) {
    const supported = Object.keys(MODULE_MAP).join(', ');
    return res.status(200).json(fail(
      'request',
      `Unknown module "${module}" — supported: ${supported}`,
    ));
  }

  if (typeof configContent !== 'string' || configContent.trim().length === 0) {
    return res.status(200).json(fail('request', 'configContent is empty'));
  }
  // Quick sanity check: Amarisoft cfg must contain a top-level brace block.
  // Catches the obvious mistake of saving a half-formed file.
  if (!/\{[\s\S]*\}/.test(configContent)) {
    return res.status(200).json(fail(
      'request',
      `Config doesn't look like an Amarisoft cfg (no top-level { ... } block found)`,
    ));
  }

  // Auto-rewrite known broken patterns from older saved configs (e.g.
  // quoted lowercase cipher_algo_pref). Logged below as a 'sanitize'
  // entry in the commandLog so the user can see what changed.
  const { fixed: sanitizedContent, appliedFixes: sanitizeFixes } = sanitizeAmarisoftCfg(configContent);

  const log: CommandLogEntry[] = [];
  if (sanitizeFixes.length > 0) {
    log.push({
      step: 'sanitize',
      ok: true,
      stdout: sanitizeFixes.map(f => `auto-fixed: ${f}`).join('\n'),
    });
  }
  const exec = async (step: string, cmd: string) => {
    const t0 = Date.now();
    const r = await ssh.execCommand(cmd);
    const entry: CommandLogEntry = {
      step,
      cmd,
      code: r.code ?? undefined,
      stdout: TAIL(r.stdout),
      stderr: TAIL(r.stderr),
      ms: Date.now() - t0,
      ok: r.code === 0,
    };
    log.push(entry);
    return r;
  };

  // Local temp file for cleanly SCP-ing the cfg (avoids shell-quoting hell)
  const localTmp = path.join(os.tmpdir(), `simtool-cfg-${Date.now()}.cfg`);
  await fs.writeFile(localTmp, sanitizedContent, 'utf8');

  const ssh = new NodeSSH();

  try {
    // ── Phase 1: SSH connect ──────────────────────────────────────────
    try {
      await ssh.connect({
        host: String(host),
        port: Number(port),
        username: String(username),
        ...(privateKey
          ? { privateKey: String(privateKey), passphrase }
          : { password: String(password) }),
        readyTimeout: 10000,
      });
      log.push({ step: 'connect', ok: true, ms: 0 });
    } catch (e: any) {
      await fs.unlink(localTmp).catch(() => {});
      const msg = e?.message || 'SSH connection failed';
      return res.status(200).json({
        ...fail('connect', `SSH connect to ${host}:${port} failed — ${msg}`, msg),
        commandLog: [...log, { step: 'connect', ok: false, stderr: msg }],
      });
    }

    const pwd = password ? String(password) : '';
    const sudo = pwd
      ? `echo '${pwd.replace(/'/g, "'\\''")}' | sudo -S -p ''`
      : 'sudo';

    // ── Phase 1.5: target dir must exist + be writable (sudo) ─────────
    // Catches the common "wrong path / Amarisoft not installed" case
    // BEFORE we SCP a file we'll have to abandon.
    const targetDir = path.posix.dirname(mapping.configPath);
    const dirCheck = await exec('check-dir', `${sudo} test -d ${q(targetDir)} && echo ok || echo missing`);
    if (dirCheck.stdout.trim() !== 'ok') {
      await fs.unlink(localTmp).catch(() => {});
      return res.status(200).json({
        ...fail('check-dir', `Target dir ${targetDir} doesn't exist on ${host} — is Amarisoft installed there?`),
        commandLog: log,
      });
    }

    // ── Phase 2: SCP to /tmp ──────────────────────────────────────────
    const remoteTmp = `/tmp/simtool-cfg-${Date.now()}.cfg`;
    try {
      await ssh.putFile(localTmp, remoteTmp);
      log.push({ step: 'scp', cmd: `scp <local> ${remoteTmp}`, ok: true });
    } catch (e: any) {
      await fs.unlink(localTmp).catch(() => {});
      return res.status(200).json({
        ...fail('scp', `Failed to upload cfg to ${remoteTmp} — ${e?.message ?? 'unknown error'}`),
        commandLog: log,
      });
    }
    await fs.unlink(localTmp).catch(() => {});

    // ── Phase 3: sudo mv → final path ────────────────────────────────
    const mvRes = await exec(
      'mv',
      `${sudo} mv ${q(remoteTmp)} ${q(mapping.configPath)} && echo ok || echo fail`,
    );
    if (mvRes.stdout.trim() !== 'ok') {
      const why = mvRes.stderr.trim() || mvRes.stdout.trim() || 'unknown';
      return res.status(200).json({
        copySuccess: false,
        copyMessage: `Failed to write ${mapping.configPath} — ${why}`,
        restartSuccess: false,
        portStatus: false,
        output: TAIL(mvRes.stderr),
        error: `Failed to write ${mapping.configPath} — ${why}`,
        phase: 'mv',
        commandLog: log,
      });
    }

    const copyMessage = `Config written to ${mapping.configPath}`;

    // ── Phase 4: restart service ──────────────────────────────────────
    let restartSuccess = true;
    let restartError: string | undefined;
    let output = '';

    if (mapping.service) {
      const restartRes = await exec(
        'restart',
        // systemctl first; fall back to old `service` if systemd isn't there.
        `${sudo} systemctl restart ${mapping.service} 2>&1 || ${sudo} service ${mapping.service} restart 2>&1`,
      );
      output = TAIL((restartRes.stdout + '\n' + restartRes.stderr).trim());
      restartSuccess = restartRes.code === 0;
      if (!restartSuccess) {
        restartError = output || `Failed to restart ${mapping.service}`;
      }
    }

    // ── Phase 5: port probe (only when restart succeeded + module has API) ──
    // 10 polls × 2s = up to ~20s. lteenb on a busy box can take that
    // long to bind its API socket — earlier 5×2s was clipping false
    // negatives on slower hosts.
    let portStatus = false;
    const PORT_POLL_TRIES = 10;
    if (mapping.checkPort > 0 && restartSuccess) {
      for (let i = 0; i < PORT_POLL_TRIES; i++) {
        const portRes = await exec(
          'port-check',
          `ss -ltn | grep -q ':${mapping.checkPort} ' && echo open || echo closed`,
        );
        if (portRes.stdout.trim() === 'open') { portStatus = true; break; }
        if (i < PORT_POLL_TRIES - 1) await new Promise(r => setTimeout(r, 2000));
      }
    } else if (mapping.checkPort === 0) {
      portStatus = true; // ue_db / non-API modules have no port to check
    }

    // ── Phase 5.5: diagnostics on port-check failure ─────────────────
    // The daemon "restarted cleanly" per systemd but never opened its
    // API port. Three likely causes, all answerable from on-box state:
    //   (a) config parse error — journalctl / log file shows it
    //   (b) daemon hangs waiting on RF init (e.g. trx_ip peer down)
    //       — process is alive, log file exists but truncated
    //   (c) daemon exited silently after parse — process gone, no log
    //       in expected path because Amarisoft writes the log
    //       relative to its working directory or to a different path
    //       than the cfg's `log_filename` field
    // The diagnostics below cover all three.
    if (mapping.service && restartSuccess && !portStatus) {
      // (1) systemd's view — was the unit actually running?
      await exec(
        'systemctl-status',
        `${sudo} systemctl status ${q(mapping.service)} --no-pager -l 2>&1 || true`,
      );
      // (2) Process-level: is the daemon binary running, and with what
      //     args? Tells us the actual cfg path lteenb loaded (vs what
      //     we deployed to) and rules out "it crashed and we don't
      //     know it".
      await exec(
        'pgrep',
        `${sudo} pgrep -af '${mapping.service}|${(module === 'enb' || module === 'gnb') ? 'lteenb' : module === 'mme' || module === 'ims' ? 'ltemme' : module === 'ue' ? 'lteue' : 'lte'}' 2>&1 | head -10 || echo '(no matching process)'`,
      );
      // (3) journalctl tail — config parse errors land here.
      await exec(
        'journalctl',
        `${sudo} journalctl -u ${q(mapping.service)} --since '2 minutes ago' --no-pager -n 60 2>&1 || true`,
      );
      // (4) Find the actual log file — the cfg says one path but
      //     Amarisoft may write somewhere else. List anything modified
      //     in the last 5 min that looks like an Amarisoft log.
      await exec(
        'find-logs',
        `${sudo} find /tmp /root -maxdepth 3 -type f \\( -name 'enb*.log' -o -name 'mme*.log' -o -name 'ue*.log' -o -name 'gnb*.log' \\) -mmin -5 2>/dev/null | head -10 || echo '(no recent log files)'`,
      );
      // (5) Tail the cfg-declared log path if it does exist.
      const logPath = (module === 'mme' || module === 'ims') ? '/tmp/mme.log'
                    : module === 'ue' ? '/tmp/ue0.log'
                    : '/tmp/enb0.log';
      await exec(
        'log-tail',
        `${sudo} tail -n 40 ${q(logPath)} 2>&1 || true`,
      );
    }

    // ── Wrap up ──────────────────────────────────────────────────────
    // If we tailed journalctl/log, surface anything that looks like an
    // Amarisoft parse error in the headline message — it's the single
    // most actionable signal.
    let portCheckHint = '';
    if (mapping.service && restartSuccess && !portStatus) {
      const journalEntry = log.find(e => e.step === 'journalctl');
      const logEntry     = log.find(e => e.step === 'log-tail');
      const haystack = `${journalEntry?.stdout ?? ''}\n${logEntry?.stdout ?? ''}`;
      // Line like:  config/enb.cfg:75:26: algorithm identifier expected
      const m = haystack.match(/config\/[^\s:]+:\d+:\d+:[^\n]+/);
      if (m) portCheckHint = ` — ${m[0].trim()}`;
    }

    const finalError = !restartSuccess
      ? `Service ${mapping.service} did not restart cleanly — ${restartError}`
      : !portStatus
        ? `Service started but port ${mapping.checkPort} never came up after ~10s${portCheckHint}`
        : undefined;
    const finalPhase = !restartSuccess ? 'restart' : !portStatus ? 'port-check' : undefined;

    return res.status(200).json({
      copySuccess: true,
      copyMessage,
      restartSuccess,
      restartError,
      portStatus,
      output,
      error: finalError,
      phase: finalPhase,
      commandLog: log,
    } as DeployResponse);
  } catch (error: any) {
    await fs.unlink(localTmp).catch(() => {});
    return res.status(200).json({
      copySuccess: false,
      copyMessage: error?.message || 'Unexpected error during deploy',
      restartSuccess: false,
      portStatus: false,
      output: '',
      error: error?.message || 'Unexpected error during deploy',
      phase: 'exception',
      commandLog: log,
    } as DeployResponse);
  } finally {
    ssh.dispose();
  }
}
