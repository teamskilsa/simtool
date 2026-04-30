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
  /** Daemon binary + working dir for the pre-deploy validate dry-run.
   *  Empty binary = skip validate (e.g. ue_db is just data, no daemon). */
  binary?: string;
  workingDir?: string;
}

// ── Module → remote config path + service name + verification port ───────────
// Sub-6 NR runs under the same `lteenb` daemon as LTE — no separate ltegnb
// service exists in current Amarisoft releases — so gNB configs live in the
// same /root/enb/config/ directory and the same `lte` unit gets bounced.
// IMS runs inside ltemme; restarting ltemme also brings IMS back.
const MODULE_MAP: Record<string, ModuleEntry> = {
  enb:   { configPath: '/root/enb/config/enb.cfg',   service: 'lte',    checkPort: 9001, binary: '/root/enb/lteenb', workingDir: '/root/enb' },
  gnb:   { configPath: '/root/enb/config/gnb.cfg',   service: 'lte',    checkPort: 9002, binary: '/root/enb/lteenb', workingDir: '/root/enb' },
  mme:   { configPath: '/root/mme/config/mme.cfg',   service: 'ltemme', checkPort: 9000, binary: '/root/mme/ltemme', workingDir: '/root/mme' },
  ims:   { configPath: '/root/mme/config/ims.cfg',   service: 'ltemme', checkPort: 9000, binary: '/root/mme/ltemme', workingDir: '/root/mme' },
  ue:    { configPath: '/root/ue/config/ue.cfg',     service: 'lteue',  checkPort: 9002, binary: '/root/ue/lteue', workingDir: '/root/ue' },
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

/**
 * Find the matching closing bracket for an opener at `openIdx`. Skips
 * over inner string literals and other bracket pairs at deeper depth.
 * Returns the index of the matching close, or -1 if unmatched.
 *
 * Plain regex `\[([\s\S]*?)\]` doesn't work for nested arrays — `]`
 * inside `cipher_algo_pref: [...]` truncates the outer cell_list match.
 */
function findMatchingClose(s: string, openIdx: number): number {
  const open = s[openIdx];
  const close = open === '[' ? ']' : open === '{' ? '}' : '';
  if (!close) return -1;
  let depth = 0;
  let inString: string | null = null;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (c === '\\') { i++; continue; }       // skip escaped char
      if (c === inString) inString = null;
    } else if (c === '"' || c === "'") {
      inString = c;
    } else if (c === open) {
      depth++;
    } else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Return all top-level cell_list: [ ... ] blocks (LTE only — `\b` excludes
 * `nr_cell_list:`). Each result has the bracket-matched body and the
 * indices needed to splice a replacement back into the original string.
 */
function findLteCellLists(content: string): Array<{ blockStart: number; blockEnd: number; body: string }> {
  const results: Array<{ blockStart: number; blockEnd: number; body: string }> = [];
  const re = /\bcell_list\s*:\s*\[/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = findMatchingClose(content, openIdx);
    if (closeIdx < 0) continue;
    results.push({
      blockStart: openIdx,                 // index of [
      blockEnd: closeIdx + 1,              // one past ]
      body: content.slice(openIdx + 1, closeIdx),
    });
  }
  return results;
}

function sanitizeAmarisoftCfg(content: string): { fixed: string; appliedFixes: string[] } {
  const applied: string[] = [];
  let out = content;

  // ── trx_ip rf_driver block: legacy args: string → structured dst<N>/src<N> ─
  // Older builder versions emitted
  //   rf_driver: { name: "ip", args: "tx_addr=…,rx_addr=…", rx_antenna: … }
  // but Amarisoft's trx_ip driver actually wants a STRUCTURED block with
  // per-port dst<N>/src<N> keys (and several other fields like clock,
  // packet_size, use_tcp). Source: /root/enb/config/rf_driver/config.cfg
  // shipped in the Amarisoft package.
  //
  // Detect the inline-args form, extract whatever host:port pairs we can,
  // and rewrite the whole rf_driver block to the canonical structure. If
  // the block is already structured (has dst0:/src0: keys), leave it.
  out = out.replace(
    /rf_driver\s*:\s*\{([^{}]*?)\}/g,
    (full: string, body: string) => {
      // Already structured? Skip.
      if (/\bdst\d+\s*:/.test(body) || /\bsrc\d+\s*:/.test(body)) return full;
      // Not the IP driver? Skip.
      const nameMatch = body.match(/\bname\s*:\s*"([^"]+)"/);
      if (!nameMatch || nameMatch[1] !== 'ip') return full;
      const argsMatch = body.match(/\bargs\s*:\s*"([^"]*)"/);
      if (!argsMatch) return full; // nothing to migrate

      // Parse host:port pairs from the args string. Same logic as the
      // builder-side parseIpPortsFromArgs but inlined here so the sanitize
      // doesn't depend on builder code.
      const argStr = argsMatch[1];
      const pairs = new Map<string, string>();
      for (const tok of argStr.split(/[,;]/)) {
        const m = tok.match(/^\s*([a-zA-Z_]\w*)\s*=\s*(.+?)\s*$/);
        if (m) pairs.set(m[1].toLowerCase(), m[2].replace(/^tcp:\/\//, ''));
      }
      const dst0 = pairs.get('dst0') ?? pairs.get('dst') ?? pairs.get('tx_addr') ?? '127.0.0.1:4000';
      const src0 = pairs.get('src0') ?? pairs.get('src') ?? pairs.get('rx_addr') ?? '127.0.0.1:4001';

      applied.push(`rf_driver: legacy "args:" string → structured dst0/src0`);
      return `rf_driver: {
    name: "ip",
    clock: "master",
    clock_factor: 1,
    debug: 0,
    packet_size: 3958,
    use_tcp: 1,
    multi_thread: 1,
    /* Port 0 */
    dst0: "${dst0}",
    src0: "${src0}",
  }`;
    },
  );

  // ── trx_ip args: tx_addr=/rx_addr= → src=/dst= ─────────────────────
  // Older Amarisoft trx_ip drivers accepted tx_addr=/rx_addr=. The
  // 2026-04-22 driver rejects that with
  //   "Missing src port definitions / Could not initialize RF driver"
  // and the canonical names are src=/dst=. These tokens only appear
  // inside the rf_driver.args string so a global replace is safe.
  if (/\btx_addr\s*=/.test(out) || /\brx_addr\s*=/.test(out)) {
    const before = out;
    out = out.replace(/\btx_addr\s*=/g, 'src=');
    out = out.replace(/\brx_addr\s*=/g, 'dst=');
    if (out !== before) {
      applied.push('rf_driver.args: tx_addr=/rx_addr= → src=/dst=');
    }
  }

  // ── LTE cell_list[] rewrites ─────────────────────────────────────
  // Per the canonical Amarisoft sample (/root/enb/config/enb.default.cfg),
  // most fields belong in cell_default — Amarisoft merges that block
  // into every cell_list[] entry at parse time. Only these vary per cell:
  //   plmn_list, dl_earfcn, n_id_cell, cell_id, tac, root_sequence_index,
  //   rf_port (multi-port), TDD/NB-IoT/CAT-M extras
  //
  // Older simtool builders emitted pdsch_dedicated, cipher_algo_pref,
  // integ_algo_pref, cell_barred, si_value_tag, sib_sched_list, n_rb_dl,
  // bandwidth — all per-cell. The 2026-04-22 parser rejects this with
  // "expecting 'X' field" at the next required field it can't find in
  // the cell_default chain. So this sanitizer:
  //   1) STRIPS those misplaced fields from each cell_list[] entry
  //   2) Captures n_rb_dl / cell_barred from the first cell to seed
  //      cell_default if those fields are missing there
  //   3) Below, injects any missing required fields into cell_default
  //
  // We extract LTE cell_list[] blocks via bracket-aware traversal — a
  // non-greedy regex would truncate at the first inner `]` inside e.g.
  // cipher_algo_pref: [...]. The findLteCellLists helper handles nesting
  // and string literals correctly. NR blocks are skipped via \b.
  let stripped: { nRbDl?: number; cellBarred?: string; pdschPa?: string } = {};
  const lteBlocks = findLteCellLists(out);
  for (let bi = lteBlocks.length - 1; bi >= 0; bi--) {
    const block = lteBlocks[bi];
    let body = block.body;
    const orig = body;

    // (a) bandwidth → n_rb_dl conversion (still useful: legacy configs).
    //     Captures the value so we can hoist it into cell_default below.
    if (/\bbandwidth\s*:/.test(body) && !/\bn_rb_dl\s*:/.test(body)) {
      body = body.replace(
        /\bbandwidth\s*:\s*([\d.]+)\s*,?/g,
        (_m: string, num: string) => {
          const mhz = parseFloat(num);
          const rb = mhzToRb(mhz);
          if (stripped.nRbDl === undefined) stripped.nRbDl = rb;
          applied.push(`cell_list[].bandwidth: ${num} MHz → cell_default.n_rb_dl: ${rb}`);
          return '';
        },
      );
    }

    // (b) Remove the now-misplaced per-cell fields. Walk each top-level
    //     `{...}` cell entry inside the body so we don't accidentally
    //     touch fields nested inside other structures. Capture the
    //     first encountered values to hoist into cell_default.
    const topLevelCellOpens: number[] = [];
    {
      let depth = 0;
      let inStr: string | null = null;
      for (let i = 0; i < body.length; i++) {
        const c = body[i];
        if (inStr) {
          if (c === '\\') { i++; continue; }
          if (c === inStr) inStr = null;
          continue;
        }
        if (c === '"' || c === "'") { inStr = c; continue; }
        if (c === '{') {
          if (depth === 0) topLevelCellOpens.push(i);
          depth++;
        } else if (c === '}') {
          depth--;
        }
      }
    }

    // Strip from end so earlier indices stay valid.
    for (let ci = topLevelCellOpens.length - 1; ci >= 0; ci--) {
      const cellOpen = topLevelCellOpens[ci];
      const cellClose = findMatchingClose(body, cellOpen);
      if (cellClose < 0) continue;
      let cell = body.slice(cellOpen, cellClose + 1);
      const cellOrig = cell;

      // Strip n_rb_dl (move to cell_default).
      cell = cell.replace(/\n[ \t]+n_rb_dl\s*:\s*(\d+)\s*,?/g, (_m, v) => {
        if (stripped.nRbDl === undefined) stripped.nRbDl = parseInt(v, 10);
        return '';
      });
      // Strip cell_barred (move to cell_default).
      cell = cell.replace(/\n[ \t]+cell_barred\s*:\s*(true|false)\s*,?/g, (_m, v) => {
        if (stripped.cellBarred === undefined) stripped.cellBarred = v;
        return '';
      });
      // Strip pdsch_dedicated (move to cell_default). Match the whole
      // `pdsch_dedicated: { ... }` even if it has nested braces.
      const pdschMatch = cell.match(/\n[ \t]+pdsch_dedicated\s*:\s*\{/);
      if (pdschMatch) {
        const startIdx = cell.indexOf(pdschMatch[0]) + pdschMatch[0].length - 1; // index of {
        const endIdx = findMatchingClose(cell, startIdx);
        if (endIdx >= 0) {
          // Capture the body so we can preserve p_a if present.
          const pa = cell.slice(startIdx, endIdx + 1).match(/\bp_a\s*:\s*(-?\d+)/);
          if (pa && stripped.pdschPa === undefined) stripped.pdschPa = pa[1];
          // Also drop trailing comma after the close.
          let dropEnd = endIdx + 1;
          while (cell[dropEnd] === ',' || cell[dropEnd] === ' ') dropEnd++;
          cell = cell.slice(0, cell.indexOf(pdschMatch[0])) + cell.slice(dropEnd);
        }
      }
      // Strip cipher_algo_pref / integ_algo_pref (move to cell_default).
      cell = cell.replace(/\n[ \t]+cipher_algo_pref\s*:\s*\[[^\]]*\]\s*,?/g, '');
      cell = cell.replace(/\n[ \t]+integ_algo_pref\s*:\s*\[[^\]]*\]\s*,?/g, '');
      // Strip si_value_tag.
      cell = cell.replace(/\n[ \t]+si_value_tag\s*:\s*\d+\s*,?/g, '');
      // Strip sib_sched_list (array — bracket-aware).
      const sibMatch = cell.match(/\n[ \t]+sib_sched_list\s*:\s*\[/);
      if (sibMatch) {
        const startIdx = cell.indexOf(sibMatch[0]) + sibMatch[0].length - 1; // index of [
        const endIdx = findMatchingClose(cell, startIdx);
        if (endIdx >= 0) {
          let dropEnd = endIdx + 1;
          while (cell[dropEnd] === ',' || cell[dropEnd] === ' ') dropEnd++;
          cell = cell.slice(0, cell.indexOf(sibMatch[0])) + cell.slice(dropEnd);
        }
      }

      if (cell !== cellOrig) {
        body = body.slice(0, cellOpen) + cell + body.slice(cellClose + 1);
        applied.push(`cell_list[]: stripped misplaced per-cell fields (moved to cell_default)`);
      }
    }

    if (body !== orig) {
      out = out.slice(0, block.blockStart + 1) + body + out.slice(block.blockEnd - 1);
    }
  }

  // ── cell_default: ensure all required fields are present ────────
  // The canonical Amarisoft sample requires these fields in cell_default.
  // Inject any that are missing, using values salvaged from cell_list[]
  // entries above where possible. Order mirrors the sample so the parser
  // sees fields in the expected sequence.
  const cellDefaultMatch = out.match(/\bcell_default\s*:\s*\{/);
  if (cellDefaultMatch) {
    const openIdx = (cellDefaultMatch.index ?? 0) + cellDefaultMatch[0].length - 1; // index of {
    const closeIdx = findMatchingClose(out, openIdx);
    if (closeIdx >= 0) {
      const block = out.slice(openIdx, closeIdx + 1);
      const need: Array<{ name: string; emit: string }> = [];
      const has = (k: string) => new RegExp(`\\b${k}\\s*:`).test(block);

      // Salvaged-value-aware fields first.
      if (!has('n_rb_dl') && stripped.nRbDl !== undefined) {
        need.push({ name: 'n_rb_dl', emit: `n_rb_dl: ${stripped.nRbDl}` });
      }
      if (!has('cell_barred')) {
        need.push({ name: 'cell_barred', emit: `cell_barred: ${stripped.cellBarred ?? 'false'}` });
      }
      if (!has('pdsch_dedicated')) {
        const pa = stripped.pdschPa ?? '0';
        need.push({ name: 'pdsch_dedicated', emit: `pdsch_dedicated: { p_a: ${pa}, p_b: -1 }` });
      }
      // Static-default fields. Emit only if absent.
      const staticDefaults: Array<{ name: string; emit: string }> = [
        { name: 'si_value_tag', emit: 'si_value_tag: 1' },
        { name: 'sib_sched_list', emit: 'sib_sched_list: [\n      { filename: "sib2_3.asn", si_periodicity: 16 },\n    ]' },
        { name: 'si_pdcch_format', emit: 'si_pdcch_format: 2' },
        { name: 'n_symb_cch', emit: 'n_symb_cch: 0' },
        { name: 'pdcch_format', emit: 'pdcch_format: 2' },
        { name: 'prach_config_index', emit: 'prach_config_index: 4' },
        { name: 'prach_freq_offset', emit: 'prach_freq_offset: -1' },
        { name: 'pucch_dedicated', emit: 'pucch_dedicated: { n1_pucch_sr_count: 11, cqi_pucch_n_rb: 1 }' },
        { name: 'pusch_dedicated', emit: 'pusch_dedicated: {\n      beta_offset_ack_index: 9,\n      beta_offset_ri_index: 6,\n      beta_offset_cqi_index: 6,\n    }' },
        { name: 'pusch_hopping_offset', emit: 'pusch_hopping_offset: -1' },
        { name: 'pusch_msg3_mcs', emit: 'pusch_msg3_mcs: 0' },
        { name: 'initial_cqi', emit: 'initial_cqi: 3' },
        { name: 'dl_256qam', emit: 'dl_256qam: true' },
        { name: 'ul_64qam', emit: 'ul_64qam: true' },
        { name: 'srs_dedicated', emit: 'srs_dedicated: {\n      srs_bandwidth_config: 3,\n      srs_bandwidth: 1,\n      srs_subframe_config: 3,\n      srs_period: 40,\n      srs_hopping_bandwidth: 0,\n    }' },
        { name: 'pusch_max_its', emit: 'pusch_max_its: 6' },
        { name: 'cipher_algo_pref', emit: 'cipher_algo_pref: [1, 2, 3]' },
        { name: 'integ_algo_pref', emit: 'integ_algo_pref: [1, 2, 3]' },
      ];
      for (const f of staticDefaults) {
        if (!has(f.name)) need.push(f);
      }

      if (need.length > 0) {
        // Inject right before the closing brace, preserving indent.
        const before = out.slice(0, closeIdx);
        // Find indent from the line containing the close brace.
        const lineStart = before.lastIndexOf('\n') + 1;
        const closeIndent = out.slice(lineStart, closeIdx).match(/^[ \t]*/)?.[0] ?? '  ';
        const fieldIndent = closeIndent + '  ';
        const injected = need.map(f => `${fieldIndent}${f.emit},`).join('\n');
        out = before + '\n' + injected + '\n' + out.slice(closeIdx);
        applied.push(`cell_default: injected ${need.map(n => n.name).join(', ')}`);
      }
    }
  }

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

    // ── Phase 2.5: Pre-deploy validate (dry-run) ─────────────────────
    // Run the daemon binary against the cfg in /tmp BEFORE we promote
    // it to the live path. If it parses+inits cleanly we proceed; if
    // it errors out we abort here, leaving the existing live cfg
    // untouched. This is the only documented-or-not way to capture
    // Amarisoft init errors per the lteenb doc — there's no API for
    // it, the cfg log_filename only writes after init, and the
    // screen-hardcopy diagnostic was unreliable. So we just run the
    // daemon ourselves.
    if (mapping.binary && mapping.workingDir) {
      // Validate dry-run: invoke the daemon binary directly, kill at 5s,
      // capture output. Implementation notes:
      //
      //   • Cfg goes in the same DIR as the live cfg — Amarisoft
      //     resolves relative include paths (sib2_3.asn, drb.cfg, etc.)
      //     from the cfg file's location, not CWD. If we run with cfg
      //     in /tmp, lteenb tries /tmp/sib2_3.asn and fails; if it sits
      //     next to the live cfg in /root/<module>/config/ relative
      //     paths resolve.
      //   • cd MUST be inside the sudo shell (/root/<module> is root-only).
      //   • Don't use a pipe to `head` — when timeout SIGKILLs lteenb,
      //     the pipe sometimes doesn't close head cleanly; redirect to
      //     a file instead.
      //   • </dev/null so the daemon doesn't block on missing TTY.
      //   • Outer hard timeout of 10s wraps the whole bash so even if
      //     lteenb gets stuck on radio init the deploy doesn't stall.
      const cfgDir = path.posix.dirname(mapping.configPath);
      const validateCfg = `${cfgDir}/.simtool-validate-${Date.now()}.cfg`;
      const valOut = `/tmp/simtool-validate-${Date.now()}.txt`;
      const validateRes = await exec(
        'validate',
        `${sudo} bash -c ${q(
          // Move our /tmp cfg into the live cfg dir so relative
          // includes resolve. Run lteenb, capture, clean up the
          // shadow cfg. If anything fails we don't want the shadow
          // file lingering — `; rm -f` runs unconditionally.
          `cp ${remoteTmp} ${validateCfg} && ` +
          `cd ${mapping.workingDir} && ` +
          `timeout -s KILL 5s ${mapping.binary} ${validateCfg} </dev/null > ${valOut} 2>&1; ` +
          `RESULT=$?; ` +
          `head -200 ${valOut}; ` +
          `rm -f ${valOut} ${validateCfg}; exit $RESULT`,
        )} & VPID=$!; ` +
        `( sleep 10; ${sudo} kill -KILL $VPID 2>/dev/null ) & WPID=$!; ` +
        `wait $VPID 2>/dev/null; ${sudo} kill -KILL $WPID 2>/dev/null; ` +
        // Belt-and-suspenders cleanup if the kill happened mid-flight.
        `${sudo} rm -f ${validateCfg} ${valOut} 2>/dev/null; true`,
      );
      const out = validateRes.stdout;
      // Parse-error format is "<path>.cfg:<line>:<col>: <message>". Path
      // can be the live "config/enb.cfg" OR our temp "/tmp/simtool-cfg-
      // <id>.cfg" — match either by anchoring on .cfg:<line>:<col>:.
      const parseErr = out.match(/[^\s]+\.cfg:\d+:\d+:[^\n]+/);
      // Non-cfg post-parse errors. We DON'T abort the deploy on these:
      // the cfg is structurally valid and the user explicitly asked to
      // promote it. Examples:
      //   • License error: "Tag X not found" — license-server-side issue,
      //     no relation to cfg syntax.
      //   • "Could not initialize RF driver" / "Missing src port" —
      //     trx_ip peer down, RF hardware unavailable — ops issue.
      //   • [CONFIG] / [INIT] / [RF] / [FATAL] / [ERROR] tagged lines —
      //     runtime issues unrelated to cfg parsing.
      // We surface these as warnings on the deploy, but the live cfg
      // still gets updated so the user's `screen -x lte` no longer
      // shows the OLD parse error after deploy.
      const postParseErr = !parseErr && out.match(
        /(\[(?:CONFIG|INIT|RF|FATAL|ERROR)\][^\n]+|Could not[^\n]+|Missing[^\s][^\n]*|License error[^\n]+)/,
      );
      // Detect "couldn't even run the daemon" — env issue, not a cfg
      // issue. Don't abort on these either; let the live path try.
      const envFailed = !parseErr && !postParseErr && (
        /Permission denied/.test(out) ||
        /sudo:[^\n]+not found/.test(out) ||
        /command not found/.test(out) ||
        out.trim().length < 5
      );
      // ABORT path — ONLY on real cfg syntax errors. Anything else
      // (license, RF init, env issues) the user has already triaged
      // via the live deploy diagnostics.
      if (parseErr && !envFailed) {
        const why = parseErr[0].trim();
        // Make sure /tmp/<remoteTmp> is cleaned up since we're aborting.
        await ssh.execCommand(`${sudo} rm -f ${q(remoteTmp)} 2>/dev/null || true`);
        return res.status(200).json({
          copySuccess: false,
          copyMessage: `Pre-deploy validate failed — ${why}`,
          restartSuccess: false,
          portStatus: false,
          output: TAIL(out, 1500),
          error: `Pre-deploy validate failed — ${why}`,
          phase: 'validate',
          commandLog: log,
        });
      }
      // postParseErr → cfg parsed cleanly but daemon won't run for
      // a non-cfg reason. Log the warning and fall through to deploy
      // the cfg anyway. Headline of the final report will show the
      // post-parse issue.
      if (postParseErr) {
        log.push({
          step: 'validate-warning',
          ok: true,
          stdout: `cfg parsed cleanly; non-cfg issue surfaced — daemon may not start: ${postParseErr[1].trim()}`,
        });
      }
      // envFailed → we couldn't even run the daemon for the dry-run
      // (sudo/path/perm issue). Fall through to live deploy; the
      // post-restart diagnostics will catch errors via /var/log/lte/ots.log.
    }

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
      // (4a) The OTS watchdog log — /var/log/lte/ots.log on Amarisoft
      //      OTS-managed boxes — captures init errors with timestamps
      //      and is the most reliable source we've seen for "why did
      //      lteenb die" on a live deploy. Read the recent tail.
      await exec(
        'ots-log-tail',
        `${sudo} tail -n 60 /var/log/lte/ots.log 2>&1 || ` +
        `${sudo} tail -n 60 /var/log/ots/ots.log 2>&1 || ` +
        `${sudo} tail -n 60 /root/ots/log/ots.log 2>&1 || echo '(no ots.log found in standard paths)'`,
      );
      // (4b) Catch-all log search — if the daemon writes to an
      //      unconventional path we still find it as long as it was
      //      modified in the last 5 minutes.
      await exec(
        'find-logs',
        `${sudo} find /tmp /root/ots/log /var/log /var/log/lte -maxdepth 4 -type f \\( -name 'enb*.log' -o -name 'mme*.log' -o -name 'ue*.log' -o -name 'gnb*.log' -o -name 'lte*.log' -o -name 'ots*.log' \\) -mmin -5 2>/dev/null | head -10 || echo '(no recent log files)'`,
      );
      // (5) Tail the cfg-declared log path if it does exist.
      const logPath = (module === 'mme' || module === 'ims') ? '/tmp/mme.log'
                    : module === 'ue' ? '/tmp/ue0.log'
                    : '/tmp/enb0.log';
      await exec(
        'log-tail',
        `${sudo} tail -n 40 ${q(logPath)} 2>&1 || true`,
      );

      // (6) screen-list only (kept for visibility into whether the
      //     watchdog screen session is alive). The screen-hardcopy
      //     step that used to live here has been retired — it was
      //     unreliable (the watchdog respawns lteenb on death, which
      //     clears the screen buffer before our hardcopy can fire),
      //     and the new pre-deploy validate phase already captures
      //     the same information directly via SSH-invoked dry-run.
      await exec(
        'screen-list',
        `${sudo} screen -ls 2>&1 | head -20 || echo '(no screen sessions)'`,
      );
    }

    // ── Wrap up ──────────────────────────────────────────────────────
    // Surface any Amarisoft parse / init error in the headline. Sources
    // ordered by signal-strength:
    //   1. /var/log/lte/ots.log — the OTS watchdog log. Most reliable;
    //      captures init errors with timestamps before screen sees them.
    //   2. journalctl — only sees the systemd unit lifecycle, not the
    //      daemon's stdout.
    //   3. cfg-declared log file — only written after init succeeds.
    let portCheckHint = '';
    if (mapping.service && restartSuccess && !portStatus) {
      const otsEntry     = log.find(e => e.step === 'ots-log-tail');
      const journalEntry = log.find(e => e.step === 'journalctl');
      const logEntry     = log.find(e => e.step === 'log-tail');
      const haystack = `${otsEntry?.stdout ?? ''}\n${journalEntry?.stdout ?? ''}\n${logEntry?.stdout ?? ''}`;
      const parseErr = haystack.match(/[^\s]+\.cfg:\d+:\d+:[^\n]+/);
      // Pull out OTS-style "INIT error: ..." or generic "[INIT] / [RF]"
      // tagged lines, or runtime stderr like "Could not initialize…",
      // "Missing src port definitions", "License error".
      const tagged = !parseErr && haystack.match(
        /(\[OTS\][^\n]*INIT\s+error[^\n]*|\[(?:CONFIG|INIT|RF|FATAL|ERROR)\][^\n]+|Could not[^\n]+|Missing[^\s][^\n]*|License error[^\n]+)/,
      );
      if (parseErr) portCheckHint = ` — ${parseErr[0].trim()}`;
      else if (tagged) portCheckHint = ` — ${tagged[1].trim()}`;
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
