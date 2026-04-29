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
 * cipher_algo_pref / integ_algo_pref normalization. Amarisoft 2026-04-22
 * wants INTEGER values 1..3:
 *   1 = EEA1/SNOW3G   2 = EEA2/AES   3 = EEA3/ZUC
 * 0 (null cipher) is REJECTED with
 *   "valid algorithm identifiers are between 1 and 3"
 *
 * Four wrong shapes we've shipped or seen on disk:
 *   ["eea0", "eea2"]   → quoted lowercase strings ("algorithm identifier expected")
 *   [EEA0, EEA2]       → bare uppercase identifiers ("unexpected identifier")
 *   ["EEA2"]           → quoted uppercase (manual edits)
 *   [0, 2, 3]          → integers including 0 ("between 1 and 3")
 *
 * All four normalize to bare integers in 1..3. The 0 entry is dropped
 * entirely — null cipher is insecure and Amarisoft refuses it. If the
 * array would end up empty after dropping 0s we still emit `[]` rather
 * than nothing, matching Amarisoft's "no preference" semantics.
 */
/** LTE channel bandwidth (MHz) → number of resource blocks (n_rb_dl). */
function mhzToRb(mhz: number): number {
  const key = Math.round(mhz * 10) / 10;
  const map: Record<string, number> = {
    '1.4': 6, '3': 15, '5': 25, '10': 50, '15': 75, '20': 100,
  };
  return map[String(key)] ?? 50;
}

function sanitizeAmarisoftCfg(content: string): { fixed: string; appliedFixes: string[] } {
  const applied: string[] = [];
  let out = content;

  // ── LTE cell_list[].bandwidth → n_rb_dl ────────────────────────────
  // Amarisoft LTE cells use `n_rb_dl` (number of resource blocks),
  // NOT `bandwidth` (MHz). NR cells DO use `bandwidth` in
  // nr_cell_default, so we have to scope this rewrite to LTE only.
  // The \b before `cell_list` prevents matching `nr_cell_list:` —
  // there's a word-char `_` between `nr` and `cell` so no boundary.
  out = out.replace(/\bcell_list\s*:\s*\[([\s\S]*?)\]/g, (full, body: string) => {
    if (!/\bbandwidth\s*:/.test(body) || /\bn_rb_dl\s*:/.test(body)) return full;
    const fixedBody = body.replace(
      /\bbandwidth\s*:\s*([\d.]+)\s*,?/g,
      (_m: string, num: string) => {
        const mhz = parseFloat(num);
        const rb = mhzToRb(mhz);
        applied.push(`cell_list[].bandwidth: ${num} MHz → n_rb_dl: ${rb}`);
        return `n_rb_dl: ${rb},`;
      },
    );
    return full.replace(body, fixedBody);
  });

  for (const field of ['cipher_algo_pref', 'integ_algo_pref']) {
    const re = new RegExp(`(${field}\\s*:\\s*\\[)([^\\]]*)(\\])`, 'g');
    out = out.replace(re, (full: string, head: string, _body: string, _tail: string) => {
      const body = _body.trim();
      if (!body) return full;

      // Convert every entry — quoted/unquoted, lowercase/uppercase, even
      // already-integer — to an int via the trailing digit. Then keep
      // only 1..3.
      const allInts: number[] = body
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
        .map(s => {
          const m = s.match(/(\d+)\s*$/);
          return m ? parseInt(m[1], 10) : NaN;
        });
      const valid = allInts.filter(n => Number.isFinite(n) && n >= 1 && n <= 3);

      // No-op fast path: if the parse already produced exactly the
      // valid ints in the same order with no whitespace differences,
      // skip rewriting — keeps reports quiet on configs that are fine.
      const wasAlreadyValid =
        allInts.length === valid.length &&
        allInts.every((n, i) => n === valid[i]) &&
        /^\s*\d+(\s*,\s*\d+)*\s*$/.test(body);
      if (wasAlreadyValid) return full;

      const replaced = `[${valid.join(', ')}]`;
      applied.push(`${field}: '${body}' → '${valid.join(', ')}'`);
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
    // API port. Three likely causes:
    //   (a) config parse error
    //   (b) daemon hangs on RF init (e.g. trx_ip peer down)
    //   (c) daemon exited silently after parse
    //
    // Critically: Amarisoft's daemons run inside a `screen` session
    // (so users can attach via `screen -x lte` to see live output).
    // The startup parse-error messages go to that screen's stdout,
    // NOT to systemd-journald and NOT to the cfg-declared log file
    // (which is only written AFTER successful init). So the deploy
    // report must capture the screen buffer or it'll keep telling
    // you "port didn't come up" without the actual reason. We dump
    // it here via `screen -X hardcopy -h` and read it back.
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

      // (6) THE one that actually catches Amarisoft startup errors:
      //     dump the running screen session's hardcopy. Amarisoft's
      //     daemons print parse errors to their stdout inside a screen
      //     wrapper named after the unit (`screen -x lte` etc.), and
      //     those messages NEVER reach journalctl or the cfg log file.
      //     `screen -X hardcopy -h <file>` writes the visible buffer +
      //     full scrollback to a file we then cat back.
      //
      //     Try the unit name as the screen session name; fall back to
      //     listing all sessions and dumping the first one that looks
      //     Amarisoft-y. Without this the report would just say "port
      //     didn't come up" — same as before — and the user would have
      //     to manually attach to screen and screenshot.
      const dumpFile = `/tmp/simtool-screen-${Date.now()}.txt`;
      await exec(
        'screen-list',
        `${sudo} screen -ls 2>&1 | head -20 || echo '(no screen sessions)'`,
      );
      // -h includes scrollback. -p 0 picks the first window.
      await exec(
        'screen-hardcopy',
        `${sudo} screen -S ${q(mapping.service)} -p 0 -X hardcopy -h ${q(dumpFile)} 2>&1; ` +
        `${sudo} sed -e 's/^[[:space:]]*$//' ${q(dumpFile)} 2>/dev/null | grep -v '^$' | tail -n 80 || ` +
        `echo '(no screen buffer captured; daemon may not be running under screen, or session name differs from unit name)'`,
      );
    }

    // ── Wrap up ──────────────────────────────────────────────────────
    // Surface any Amarisoft parse error in the headline. We pull from
    // every diagnostic source we collected — the screen-hardcopy is the
    // most likely match (Amarisoft writes parse errors to stdout inside
    // the screen wrapper), but also scan journalctl + log-tail in case
    // the daemon happened to write to the cfg log file before exit.
    let portCheckHint = '';
    if (mapping.service && restartSuccess && !portStatus) {
      const screenEntry  = log.find(e => e.step === 'screen-hardcopy');
      const journalEntry = log.find(e => e.step === 'journalctl');
      const logEntry     = log.find(e => e.step === 'log-tail');
      const haystack = `${screenEntry?.stdout ?? ''}\n${journalEntry?.stdout ?? ''}\n${logEntry?.stdout ?? ''}`;
      // Line like:  config/enb.cfg:75:26: algorithm identifier expected
      const parseErr = haystack.match(/config\/[^\s:]+:\d+:\d+:[^\n]+/);
      // Or a generic Amarisoft error stem: "[CONFIG] error", "[INIT]..."
      const tagged = !parseErr && haystack.match(/\[(?:CONFIG|INIT|RF|FATAL|ERROR)\][^\n]+/);
      if (parseErr) portCheckHint = ` — ${parseErr[0].trim()}`;
      else if (tagged) portCheckHint = ` — ${tagged[0].trim()}`;
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
