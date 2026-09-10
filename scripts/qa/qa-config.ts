// QA: create a config the way the builder does, then check it holds up.
//
// Path under test:
//   form state  --generateNRConfig-->  enb.cfg text  --importCfgToBuilder-->  form state'
//
// A user builds a cell, saves it, reopens it in the builder ("Edit in
// Builder"), and saves again. If the round trip is lossy, that second save
// silently rewrites their config. That is the bug class this hunts.
import { generateNRConfig } from '../../src/modules/testConfig/components/ConfigBuilder/configGenerator';
import { importCfgToBuilder } from '../../src/modules/testConfig/components/ConfigBuilder/cfgImporter';
import { DEFAULT_NR_FORM, type NRFormState } from '../../src/modules/testConfig/components/ConfigBuilder/constants';
import * as fs from 'fs';

let pass = 0, fail = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

// ── 1. Build a cell the way a user would: n78, 20 MHz TDD, 2x2 ──────────────
const form: NRFormState = {
  ...DEFAULT_NR_FORM,
  cellId: 7,
  band: 78,
  nrBandwidth: 20,
  subcarrierSpacing: 30,
  dlNrArfcn: 632628,
  nrTdd: 1,
  fr2: 0,
  nAntennaDl: 2,
  nAntennaUl: 2,
  txGain: 85,
  rxGain: 55,
} as NRFormState;

console.log('=== 1. generate ===');
let cfg = '';
try {
  cfg = generateNRConfig(form);
  check('generateNRConfig returns text', cfg.length > 200, `${cfg.length} chars`);
} catch (e: any) {
  check('generateNRConfig does not throw', false, e.message);
}

fs.writeFileSync(process.env.QA_OUT || 'qa-generated.cfg', cfg);

// ── 2. Structural sanity of the emitted cfg ─────────────────────────────────
console.log('\n=== 2. emitted cfg structure ===');
const braces = (cfg.match(/{/g) || []).length - (cfg.match(/}/g) || []).length;
check('braces balanced', braces === 0, `{ minus } = ${braces}`);

for (const key of ['nr_cell_list', 'nr_cell_default', 'rf_driver', 'amf_list', 'plmn_list']) {
  check(`emits ${key}`, cfg.includes(key));
}

// Values that mean a field was read from the wrong place.
for (const bad of ['undefined', 'NaN', 'null,', '[object Object]']) {
  const hit = cfg.includes(bad);
  check(`no "${bad}" in output`, !hit,
    hit ? cfg.split('\n').filter(l => l.includes(bad)).slice(0, 3).join(' | ') : '');
}

// The values we actually set must appear.
check('cell_id 7 present', /cell_id:\s*7\b/.test(cfg));
check('band 78 present', /band:\s*78\b/.test(cfg));
check('dl_nr_arfcn 632628 present', /dl_nr_arfcn:\s*632628\b/.test(cfg));
check('subcarrier spacing 30 kHz present', /subcarrier_spacing:\s*30\b/.test(cfg) || /scs:\s*30\b/.test(cfg));
check('TDD pattern emitted for a TDD band', cfg.includes('tdd_ul_dl_config'));

// ── 3. Round trip back into the builder ─────────────────────────────────────
console.log('\n=== 3. round trip (Edit in Builder) ===');
const imported = importCfgToBuilder(cfg, 'enb.cfg');
check('importCfgToBuilder returns a result', imported !== null);

if (imported) {
  check('detected as NR', imported.type === 'nr', `got "${imported.type}"`);
  const f2 = imported.form as NRFormState;

  const compare: [keyof NRFormState, any][] = [
    ['cellId', form.cellId],
    ['band', form.band],
    ['nrBandwidth', form.nrBandwidth],
    ['subcarrierSpacing', form.subcarrierSpacing],
    ['dlNrArfcn', form.dlNrArfcn],
    ['nrTdd', form.nrTdd],
    ['nAntennaDl', form.nAntennaDl],
    ['nAntennaUl', form.nAntennaUl],
    ['txGain', form.txGain],
    ['rxGain', form.rxGain],
  ];
  for (const [k, expected] of compare) {
    check(`round trip ${String(k)}`, (f2 as any)[k] === expected,
      `set ${JSON.stringify(expected)}, got back ${JSON.stringify((f2 as any)[k])}`);
  }

  if (imported.warnings?.length) {
    console.log('\n  importer warnings:');
    imported.warnings.forEach(w => console.log('    - ' + w));
  }

  // ── 4. Regenerate from the imported form: must be stable ──────────────────
  console.log('\n=== 4. re-save stability (generate -> import -> generate) ===');
  // The header carries a generation timestamp, so compare without it.
  const stripStamp = (t: string) => t.replace(/^.*Generated:.*$/m, '');
  const cfg2 = generateNRConfig(f2);
  if (stripStamp(cfg) === stripStamp(cfg2)) {
    check('second generation is byte-identical', true);
  } else {
    const a = cfg.split('\n'), b = cfg2.split('\n');
    const diffs: string[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) diffs.push(`    line ${i + 1}:\n      was:  ${a[i] ?? '(none)'}\n      now:  ${b[i] ?? '(none)'}`);
      if (diffs.length >= 12) break;
    }
    check('second generation is byte-identical', false, `${diffs.length}+ differing lines`);
    console.log('\n  first differences:\n' + diffs.join('\n'));
  }
}

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach(f => console.log('  * ' + f));
}
process.exit(fail ? 1 : 0);
