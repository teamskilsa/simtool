// QA: a matrix of configs a user would actually build, each round-tripped
// through generate -> import -> generate.
//
// The single-cell n78 happy path already passes. These are the shapes where
// a lossy mapping would go unnoticed until a test run failed on the box:
// FDD (no TDD block), FR2, multi-cell, SSB GSCN override, per-antenna gain
// arrays, 3-digit MNC, and the Layers fields.
import { generateNRConfig } from '../../src/modules/testConfig/components/ConfigBuilder/configGenerator';
import { importCfgToBuilder } from '../../src/modules/testConfig/components/ConfigBuilder/cfgImporter';
import {
  DEFAULT_NR_FORM, DEFAULT_LAYERS, makeDefaultCell, type NRFormState,
} from '../../src/modules/testConfig/components/ConfigBuilder/constants';
import * as fs from 'fs';

let pass = 0, fail = 0;
const failures: string[] = [];
const stripStamp = (s: string) => s.replace(/^.*Generated:.*$/m, '');

function check(scenario: string, name: string, cond: boolean, detail = '') {
  if (cond) { pass++; }
  else {
    fail++;
    failures.push(`[${scenario}] ${name}${detail ? ' — ' + detail : ''}`);
    console.log(`  FAIL  ${name}${detail ? '\n        ' + detail : ''}`);
  }
}

interface Scenario { name: string; form: NRFormState; expect?: (cfg: string, s: Scenario) => void; fields: string[]; }

const base = DEFAULT_NR_FORM;

const scenarios: Scenario[] = [
  {
    name: 'FDD band n7 (no TDD block)',
    form: { ...base, band: 7, nrTdd: 0, fr2: 0, dlNrArfcn: 526000, nrBandwidth: 20, subcarrierSpacing: 15 } as NRFormState,
    fields: ['band', 'nrTdd', 'dlNrArfcn', 'nrBandwidth', 'subcarrierSpacing'],
    expect: (cfg) => check('FDD n7', 'no tdd_ul_dl_config on an FDD band', !cfg.includes('tdd_ul_dl_config')),
  },
  {
    name: 'FR2 mmWave n258',
    form: { ...base, band: 258, fr2: 1, nrTdd: 1, nrBandwidth: 100, subcarrierSpacing: 120, dlNrArfcn: 2079167 } as NRFormState,
    fields: ['band', 'fr2', 'nrBandwidth', 'subcarrierSpacing', 'dlNrArfcn'],
  },
  {
    name: 'SSB GSCN override on',
    form: { ...base, band: 78, nrTdd: 1, ssbArfcn: 7811 } as NRFormState,
    fields: ['band', 'ssbArfcn'],
  },
  {
    name: 'SSB override off (null)',
    form: { ...base, band: 78, nrTdd: 1, ssbArfcn: null } as any,
    fields: ['band'],
    expect: (cfg) => check('SSB off', 'no gscn emitted when override is off', !/\bgscn\s*:/.test(cfg)),
  },
  {
    name: '4 antennas, per-antenna gain arrays',
    form: { ...base, band: 78, nrTdd: 1, nAntennaDl: 4, nAntennaUl: 4,
            txGain: [80, 81, 82, 83], rxGain: [50, 51, 52, 53] } as any,
    fields: ['nAntennaDl', 'nAntennaUl'],
    expect: (cfg) => {
      check('per-antenna', 'tx_gain emitted as an array', /tx_gain\s*:\s*\[/.test(cfg),
        (cfg.match(/tx_gain\s*:.*/) || ['(no tx_gain line)'])[0]);
      check('per-antenna', 'rx_gain emitted as an array', /rx_gain\s*:\s*\[/.test(cfg),
        (cfg.match(/rx_gain\s*:.*/) || ['(no rx_gain line)'])[0]);
    },
  },
  {
    name: '3-digit MNC PLMN',
    form: { ...base, plmn: { mcc: '310', mnc: '260' } } as any,
    fields: [],
    expect: (cfg) => {
      const m = cfg.match(/plmn\s*:\s*"(\d+)"/);
      check('3-digit MNC', 'PLMN is 310260', m?.[1] === '310260', `got ${m?.[1] ?? '(none)'}`);
    },
  },
  {
    name: 'multi-cell: 2 cells',
    form: {
      ...base, band: 78, nrTdd: 1,
      activeCellIdx: 0,
      cellId: 1, dlNrArfcn: 632628,
      cells: [
        makeDefaultCell('Cell 1', { cellId: 1, band: 78, dlNrArfcn: 632628 }),
        makeDefaultCell('Cell 2', { cellId: 2, band: 78, dlNrArfcn: 636666 }),
      ],
    } as any,
    fields: [],
    expect: (cfg) => {
      const ids = [...cfg.matchAll(/cell_id\s*:\s*(\d+)/g)].map(m => m[1]);
      check('multi-cell', 'both cell_ids emitted', ids.includes('1') && ids.includes('2'), `cell_ids found: ${ids.join(',')}`);
      const arfcns = [...cfg.matchAll(/dl_nr_arfcn\s*:\s*(\d+)/g)].map(m => m[1]);
      check('multi-cell', 'both ARFCNs emitted', arfcns.includes('632628') && arfcns.includes('636666'), `arfcns: ${arfcns.join(',')}`);
    },
  },
  {
    name: 'layers: non-default values survive',
    form: {
      ...base, band: 78, nrTdd: 1,
      layers: {
        ...DEFAULT_LAYERS,
        srPeriod: 40, cqiPeriod: 80, dlMaxHarqTx: 8, ulMaxHarqTx: 8,
        rlcMode: 'um', rlcSnLength: 18, pdcpSnSize: 18,
        prachConfigIndex: 160, pdschMcsTable: 'qam256',
        sibSiPeriodicity: 64, sibCellBarred: true,
        paging: { ...(DEFAULT_LAYERS as any).paging, defaultCycle: 128 },
      },
    } as any,
    fields: [],
    expect: (cfg) => {
      const want: [string, RegExp][] = [
        ['sr_period 40', /sr_period\s*:\s*40\b/],
        ['cqi_period 80', /cqi_period\s*:\s*80\b/],
        ['dl HARQ 8', /dl_max_harq_tx\s*:\s*8\b/],
        ['prach index 160', /prach_config_index\s*:\s*160\b/],
        ['256QAM mcs_table', /mcs_table\s*:\s*"qam256"/],
        ['cell barred', /cell_barred\s*:\s*(true|1)/],
      ];
      for (const [label, re] of want) check('layers', `emits ${label}`, re.test(cfg));
    },
  },
];

console.log('QA matrix: generate -> import -> generate\n');

for (const s of scenarios) {
  console.log(`--- ${s.name}`);
  let cfg = '';
  try {
    cfg = generateNRConfig(s.form);
  } catch (e: any) {
    check(s.name, 'generates without throwing', false, e.message);
    continue;
  }
  check(s.name, 'generates without throwing', true);
  check(s.name, 'braces balanced', (cfg.match(/{/g) || []).length === (cfg.match(/}/g) || []).length);
  for (const bad of ['undefined', 'NaN', '[object Object]']) {
    const hit = cfg.includes(bad);
    check(s.name, `no "${bad}"`, !hit, hit ? (cfg.split('\n').filter(l => l.includes(bad))[0] || '') : '');
  }

  s.expect?.(cfg, s);

  const imported = importCfgToBuilder(cfg, 'enb.cfg');
  if (!imported) { check(s.name, 'imports back', false, 'importCfgToBuilder returned null'); continue; }
  check(s.name, 'imports back', true);

  const f2: any = imported.form;
  for (const k of s.fields) {
    check(s.name, `round trip ${k}`, f2[k] === (s.form as any)[k],
      `set ${JSON.stringify((s.form as any)[k])}, got ${JSON.stringify(f2[k])}`);
  }

  const cfg2 = generateNRConfig(f2);
  const same = stripStamp(cfg) === stripStamp(cfg2);
  if (!same) {
    const a = stripStamp(cfg).split('\n'), b = stripStamp(cfg2).split('\n');
    const d: string[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) d.push(`line ${i + 1}: was "${(a[i] ?? '').trim()}" -> now "${(b[i] ?? '').trim()}"`);
      if (d.length >= 6) break;
    }
    check(s.name, 're-save is stable', false, d.join('\n        '));
  } else {
    check(s.name, 're-save is stable', true);
  }
  fs.writeFileSync(`scripts/qa/${s.name.replace(/[^a-z0-9]+/gi, '-')}.cfg`, cfg);
}

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach(f => console.log('  * ' + f));
}
process.exit(fail ? 1 : 0);
