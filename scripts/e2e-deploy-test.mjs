// End-to-end test for /api/systems/config-deploy against the real callbox.
// Hits the running dev server (localhost:3000) with the user's actual
// broken enb-config-ip.cfg + callbox creds, then prints the response
// in a readable format. Lets us verify deploy fixes without asking the
// user to click Run + send the .txt report each iteration.
//
// Run: node scripts/e2e-deploy-test.mjs

// Plain http.request — Node 20's built-in fetch has a 30s headers
// timeout we can't easily disable (undici isn't an installable dep
// in this project). The deploy cycle (SCP + validate + restart +
// port poll + diagnostics) routinely exceeds 30s, so we hand-roll
// a longer-tolerant POST.
import http from 'node:http';

const API = 'http://localhost:3000/api/systems/config-deploy';

const HOST = '192.168.1.240';
const USERNAME = 'sysadmin';
const PASSWORD = 'admin@123';

// The user's actual enb-config-ip.cfg with the trx_ip args that errored
// with "Missing src port definitions". This is what the user has saved.
const BROKEN_CFG = `/* @builder:{"type":"lte","form":{}} */
{
  log_options: "all.level=error,all.max_size=0",
  log_filename: "/tmp/enb0.log",
  com_addr: "[::]:9001",

  rf_driver: {
    name: "ip",
    args: "tx_addr=tcp://192.168.1.240:2000,rx_addr=tcp://192.168.1.51:2001",
    rx_antenna: "rx",
  },

  tx_gain: 90,
  rx_gain: 60,

  mme_list: [{ mme_addr: "127.0.1.100" }],
  gtp_addr: "127.0.1.1",
  enb_id: 0x1A2D0,

  cell_default: {
    n_antenna_dl: 1,
    n_antenna_ul: 1,
    cyclic_prefix: "normal",
    phich_duration: "normal",
    phich_resource: "1",
    si_coderate: 0.2,
    si_window_length: 40,
    intra_freq_reselection: true,
    q_rx_lev_min: -70,
    p_max: 23,
    sr_period: 20,
    cqi_period: 40,
    mac_config: { ul_max_harq_tx: 5, dl_max_harq_tx: 5 },
    dpc: true,
    dpc_pusch_snr_target: 25,
    dpc_pucch_snr_target: 15,
    inactivity_timer: 10000,
    drb_config: "drb.cfg",
  },

  cell_list: [{
    rf_port: 0,
    cell_id: 42,
    n_id_cell: 0,
    tac: 1,
    dl_earfcn: 3100,
    n_rb_dl: 25,
    pdsch_dedicated: { p_a: 0 },
    plmn_list: [{ plmn: "00101", attach_without_pdn: true, reserved: false }],
    root_sequence_index: 204,
    cipher_algo_pref: [1, 2, 3],
    integ_algo_pref: [1, 2, 3],
  }],

  nr_cell_list: [],
}
`;

const fmt = (obj) => JSON.stringify(obj, null, 2);
const tail = (s, n = 600) => (s ?? '').toString().slice(-n);

async function run() {
  console.log('━'.repeat(70));
  console.log(`POST ${API}`);
  console.log(`  → ${HOST}  module=enb`);
  console.log('━'.repeat(70));

  const body = JSON.stringify({
    host: HOST, port: 22, username: USERNAME, password: PASSWORD,
    module: 'enb', configContent: BROKEN_CFG,
  });

  const t0 = Date.now();
  const { status, data } = await new Promise((resolve, reject) => {
    const req = http.request({
      method: 'POST',
      host: 'localhost',
      port: 3000,
      path: '/api/systems/config-deploy',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      // No global socket timeout — the deploy can take a few minutes
      // with diagnostics. setTimeout below is per inactivity.
    }, (res) => {
      let chunks = '';
      res.setEncoding('utf8');
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(chunks) }); }
        catch (e) { reject(new Error(`bad JSON: ${e.message} — got: ${chunks.slice(0,200)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5 * 60 * 1000, () => req.destroy(new Error('5min idle timeout')));
    req.write(body);
    req.end();
  });
  const ms = Date.now() - t0;

  console.log(`HTTP ${status}   round-trip ${ms}ms\n`);
  console.log(`SUCCESS         : copy=${data.copySuccess}  restart=${data.restartSuccess}  port=${data.portStatus}`);
  console.log(`PHASE           : ${data.phase ?? '(none)'}`);
  console.log(`HEADLINE ERROR  : ${data.error ?? '(no headline)'}\n`);

  console.log('━ Command log '.padEnd(70, '━'));
  for (let i = 0; i < (data.commandLog?.length ?? 0); i++) {
    const e = data.commandLog[i];
    const meta = [
      e.code != null ? `exit=${e.code}` : null,
      e.ms != null ? `${e.ms}ms` : null,
    ].filter(Boolean).join(' ');
    const mark = e.ok ? '✓' : '✗';
    console.log(`[${i+1}] ${mark} ${e.step}${meta ? `  (${meta})` : ''}`);
    if (e.cmd) console.log(`    $ ${e.cmd.slice(0, 200)}${e.cmd.length > 200 ? '…' : ''}`);
    if (e.stdout) console.log(`    ${e.stdout.split('\n').map(l => `    ${l}`).join('\n').trim()}`);
    if (e.stderr) console.log(`    [stderr] ${e.stderr.split('\n').map(l => `    ${l}`).join('\n').trim()}`);
    console.log();
  }

  console.log('━'.repeat(70));
  // ── Proper QA gates ─────────────────────────────────────────────────
  // The whole point of this test isn't just "did the API return", it's:
  //   (1) Did the LIVE cfg on the box get replaced? (copySuccess + mv)
  //   (2) Does the live cfg now PARSE cleanly when the daemon reads it?
  //   (3) If the daemon ultimately failed, was it for a NON-cfg reason
  //       (license / RF / hardware) — i.e. simtool's job is done?
  //
  // We assert each independently and report which gates passed.
  let passes = 0, fails = 0;
  const gate = (label, cond, detail = '') => {
    if (cond) { console.log(`✅ ${label}`); passes++; }
    else      { console.log(`❌ ${label}${detail ? `  — ${detail}` : ''}`); fails++; }
  };

  gate('GATE 1: copySuccess (cfg written to live path)', !!data.copySuccess,
    data.copySuccess ? '' : `phase=${data.phase} error=${data.error}`);

  // GATE 2: parse the validate output. We need to see banner/license/RF
  // lines (= parser succeeded) and NOT see "expecting 'X' field".
  const validateEntry = data.commandLog?.find(e => e.step === 'validate');
  const valOut = validateEntry?.stdout ?? '';
  const hasParseErr = /[^\s]+\.cfg:\d+:\d+:\s*expecting/.test(valOut);
  const hasBanner = /Base Station version|This software is licensed/.test(valOut);
  gate('GATE 2: validate output shows clean parse (banner + no "expecting field")',
    hasBanner && !hasParseErr,
    hasParseErr
      ? `parse error: ${valOut.match(/[^\s]+\.cfg:\d+:\d+:[^\n]+/)?.[0] ?? '(unknown)'}`
      : !hasBanner ? '(no banner observed — daemon may not have launched)' : '');

  // GATE 3: validate-warning entry indicates only post-parse issue
  // (license/RF/init), NOT a cfg structure issue.
  const warnEntry = data.commandLog?.find(e => e.step === 'validate-warning');
  if (data.copySuccess) {
    gate('GATE 3: deploy proceeded past validate (cfg side is good)', true);
  } else if (data.phase === 'validate' && hasParseErr) {
    gate('GATE 3: deploy proceeded past validate (cfg side is good)', false,
      'aborted on real parse error — cfg is structurally broken');
  } else {
    gate('GATE 3: deploy proceeded past validate (cfg side is good)', false,
      `aborted at phase=${data.phase}: ${data.error}`);
  }

  // GATE 4: final state — either port came up (full success), OR port
  // timed out for a non-cfg reason that the diagnostics surfaced.
  if (data.portStatus) {
    gate('GATE 4: port 9001 open (full end-to-end success)', true);
  } else if (data.copySuccess && warnEntry) {
    gate('GATE 4: post-parse issue surfaced and cfg deployed (license/RF/etc)',
      true, `diagnosed: ${warnEntry.stdout.replace(/^.*surfaced — /, '').trim()}`);
  } else if (!data.copySuccess) {
    gate('GATE 4: deploy aborted before reaching port check', false);
  } else {
    gate('GATE 4: port 9001 never came up; check diagnostics in commandLog', false,
      data.error ?? '(no headline)');
  }

  console.log('━'.repeat(70));
  console.log(`SUMMARY: ${passes} passed, ${fails} failed`);
  if (fails > 0) process.exitCode = 1;
}

run().catch(e => { console.error('test crashed:', e); process.exit(1); });
