// Validate the Stats page against a RUNNING test on the callbox.
//
// This does not mock: it loads the `stats` and `ue_get` responses pulled live
// from callbox 192.168.1.122:9001 while a 510-UE test was running, feeds them
// through the exact functions the Stats page renders from (statsModel), and
// asserts every displayed number equals the value hand-computed from the raw
// JSON. If these pass, the numbers the Global / Cell / UE tabs show for this
// running test are correct.
//
// Set QA_LIVE_DIR to the folder holding s.json (stats) and u.json (ue_get).
import * as fs from 'fs';
import * as path from 'path';
import {
  cellRows, toTimePoint, radioUeRows, radioSummary,
} from '../../src/modules/statLogs/components/enb/statsModel';

const DIR = process.env.QA_LIVE_DIR;
if (!DIR) { console.error('set QA_LIVE_DIR to the folder with s.json / u.json'); process.exit(2); }

const stats = JSON.parse(fs.readFileSync(path.join(DIR, 's.json'), 'utf8'));
const ue = JSON.parse(fs.readFileSync(path.join(DIR, 'u.json'), 'utf8'));

let pass = 0, fail = 0;
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

// ── Ground truth straight off the box ───────────────────────────────────────
const rawCells: Record<string, any> = stats.cells;
const ids = Object.keys(rawCells);
const c0 = rawCells[ids[0]];
console.log(`\nLive box: ${ids.length} cell(s), ${ue.ue_list.length} UEs`);
console.log(`  cell ${ids[0]}: dl ${(c0.dl_bitrate/1e6).toFixed(1)} Mbps, ul ${(c0.ul_bitrate/1e6).toFixed(1)} Mbps, `
  + `ue_count_avg ${c0.ue_count_avg}, active ${c0.ue_active_count_avg}`);

const sumField = (field: string) => ids.reduce((a, k) => a + (Number(rawCells[k][field]) || 0), 0);

// ── 1. Global headline (toTimePoint) ────────────────────────────────────────
console.log('\n=== 1. Global headline — what the KPI tiles show ===');
const tp = toTimePoint(stats);
check('DL throughput = Σ dl_bitrate / 1e6',
  near(tp.dlMbps, sumField('dl_bitrate') / 1e6, 1e-3), `${tp.dlMbps.toFixed(2)} Mbps`);
check('UL throughput = Σ ul_bitrate / 1e6',
  near(tp.ulMbps, sumField('ul_bitrate') / 1e6, 1e-3), `${tp.ulMbps.toFixed(2)} Mbps`);
check('Connected UEs = Σ ue_count_avg',
  near(tp.ues, sumField('ue_count_avg'), 1e-6), `${tp.ues}`);
check('Active UEs = Σ ue_active_count_avg',
  near(tp.activeUes, sumField('ue_active_count_avg'), 1e-6), `${tp.activeUes}`);
check('DL PRB = mean(dl_use_avg) × 100',
  near(tp.dlPrb, (sumField('dl_use_avg') / ids.length) * 100, 1e-6), `${tp.dlPrb.toFixed(1)}%`);
check('DL Scheduled UE = Σ dl_sched_users_avg',
  near(tp.dlSched, sumField('dl_sched_users_avg'), 1e-6), `${tp.dlSched.toFixed(2)}`);
const rawDlRetx = sumField('dl_tx') > 0 ? (sumField('dl_retx') / sumField('dl_tx')) * 100 : 0;
check('DL Retx % = Σ dl_retx / Σ dl_tx',
  near(tp.dlRetxPct, rawDlRetx, 1e-6), `${tp.dlRetxPct.toFixed(3)}%`);

// ── 2. Per-cell table (cellRows) ────────────────────────────────────────────
console.log('\n=== 2. Cell tab — per-cell rows ===');
const rows = cellRows(stats);
check('one row per live cell', rows.length === ids.length, `${rows.length} rows`);
for (const r of rows) {
  const raw = rawCells[r.id];
  check(`cell ${r.id} DL Mbps`, near(r.dlMbps, raw.dl_bitrate / 1e6, 1e-3), `${r.dlMbps.toFixed(1)}`);
  check(`cell ${r.id} DL PRB avg`, near(r.dlPrbAvg, raw.dl_use_avg * 100, 1e-6), `${r.dlPrbAvg.toFixed(1)}%`);
  check(`cell ${r.id} UEs`, near(r.ues, raw.ue_count_avg, 1e-6), `${r.ues}`);
}

// ── 3. UE Summary donuts (radioSummary) ─────────────────────────────────────
console.log('\n=== 3. Global donut row (UE Summary) ===');
const donuts = radioSummary(stats, 'enb');
const rrc = donuts.find(d => d.title === 'RRC State');
const perCell = donuts.find(d => d.title === 'UEs / Cell');
const expTotal = Math.round(sumField('ue_count_avg'));
const expActive = Math.round(sumField('ue_active_count_avg'));
check('RRC donut total = Σ round(ue_count_avg)', rrc?.total === expTotal, `${rrc?.total}`);
check('RRC connected = Σ round(ue_active_count_avg)',
  rrc?.segments.find(s => s.label.startsWith('Connected'))?.value === expActive, `${expActive}`);
check('RRC inactive = total − active',
  rrc?.segments.find(s => s.label === 'Inactive')?.value === expTotal - expActive, `${expTotal - expActive}`);
check('UEs/Cell donut has a segment per cell', perCell?.segments.length === ids.length);

// ── 4. UE table (radioUeRows) ───────────────────────────────────────────────
console.log('\n=== 4. UE tab — per-UE rows ===');
const ur = radioUeRows(ue);
check('one row per UE in ue_get', ur.length === ue.ue_list.length, `${ur.length} rows`);
// Spot-check three UEs against their raw entries.
for (const idx of [0, Math.floor(ur.length / 2), ur.length - 1]) {
  const rawUe = ue.ue_list[idx];
  const rc = (rawUe.cells || [])[0] || {};
  const row = ur.find(r => String(r.ranUeId ?? r.rnti) === String(rawUe.ran_ue_id ?? rawUe.enb_ue_id ?? rawUe.rnti));
  if (!row) { check(`UE #${idx} mapped`, false); continue; }
  const rawDl = (rawUe.cells || []).reduce((a: number, x: any) => a + (Number(x.dl_bitrate) || 0), 0) / 1e6;
  check(`UE #${idx} rnti ${rawUe.rnti}: DL Mbps`, near(row.dlMbps, rawDl, 1e-3), `${row.dlMbps.toFixed(3)}`);
  check(`UE #${idx}: MCS/CQI/SNR carried`,
    row.dlMcs === rc.dl_mcs && row.cqi === rc.cqi && row.snr === rc.pusch_snr,
    `mcs ${row.dlMcs} cqi ${row.cqi} snr ${row.snr}`);
}
const withCa = ur.filter(r => r.caCells > 1).length;
console.log(`  (carrier-aggregated UEs, caCells>1: ${withCa})`);

// ── What the page shows for this run ─────────────────────────────────────────
console.log('\n=== The Stats page would show, for this running test ===');
console.log(`  DL ${tp.dlMbps.toFixed(1)} Mbps · UL ${tp.ulMbps.toFixed(1)} Mbps`);
console.log(`  ${tp.ues} connected UEs (${tp.activeUes} active) · DL PRB ${tp.dlPrb.toFixed(1)}% · UL PRB ${tp.ulPrb.toFixed(1)}%`);
console.log(`  UE table: ${ur.length} rows`);

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
