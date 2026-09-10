// QA against ground truth: the enb.cfg Amarisoft is running right now on the
// callbox (647 lines, NR SA), pulled read-only.
//
// Two things this proves that a self-round-trip cannot:
//   1. Our parser can read a real production config, not just our own output.
//   2. Our generator emits the keys Amarisoft actually expects — anything in
//      the live cell block that we never emit is a field the builder cannot
//      express, and anything we emit that is not in the live config is worth
//      a second look.
import { parseAmarisoftConfig } from '../../src/modules/testConfig/components/ConfigBuilder/cfgParser';
import { importCfgToBuilder } from '../../src/modules/testConfig/components/ConfigBuilder/cfgImporter';
import { generateNRConfig } from '../../src/modules/testConfig/components/ConfigBuilder/configGenerator';
import * as fs from 'fs';

const live = fs.readFileSync('scripts/qa/live-enb.cfg', 'utf8');

console.log('=== 1. can our parser read the live config? ===');
let ast: any = null;
try {
  ast = parseAmarisoftConfig(live);
  console.log('  PASS  parsed, top-level keys:', Object.keys(ast).length);
} catch (e: any) {
  console.log('  FAIL  parser threw:', e.message);
  process.exit(1);
}

console.log('\n=== 2. can the builder import it? ===');
const imported = importCfgToBuilder(live, 'enb.cfg');
if (!imported) {
  console.log('  FAIL  importCfgToBuilder returned null');
  process.exit(1);
}
console.log(`  PASS  detected type: ${imported.type}`);
const f: any = imported.form;
console.log('  key values read out of the live config:');
for (const k of ['cellId', 'band', 'nrBandwidth', 'subcarrierSpacing', 'dlNrArfcn', 'nrTdd', 'fr2', 'nAntennaDl', 'nAntennaUl', 'txGain', 'rxGain', 'ssbArfcn']) {
  console.log(`    ${k.padEnd(20)} ${JSON.stringify(f[k])}`);
}
console.log(`    cells                ${f.cells?.length} (${f.cells?.map((c: any) => `id ${c.cellId} @ ${c.dlNrArfcn}`).join(', ')})`);
if (imported.warnings?.length) {
  console.log('  warnings:');
  imported.warnings.forEach((w: string) => console.log('    - ' + w));
}

console.log('\n=== 3. which live cell fields can the builder NOT express? ===');
const ours = generateNRConfig(f);
fs.writeFileSync('scripts/qa/regenerated-from-live.cfg', ours);

// Compare the key names used inside nr_cell_list[0] and at top level.
const keysIn = (text: string, block: string): Set<string> => {
  const i = text.indexOf(block);
  if (i < 0) return new Set();
  // walk braces from the first { after the block name
  let d = 0, start = text.indexOf('{', i), j = start;
  for (; j < text.length; j++) {
    if (text[j] === '{') d++;
    else if (text[j] === '}') { d--; if (d === 0) break; }
  }
  const body = text.slice(start, j);
  return new Set([...body.matchAll(/^\s*([a-z_0-9]+)\s*:/gim)].map(m => m[1]));
};

const liveCell = keysIn(live, 'nr_cell_list');
const ourCell  = keysIn(ours, 'nr_cell_list');
const missing = [...liveCell].filter(k => !ourCell.has(k));
const extra   = [...ourCell].filter(k => !liveCell.has(k));
console.log(`  live nr_cell_list keys : ${[...liveCell].join(', ') || '(none)'}`);
console.log(`  ours                   : ${[...ourCell].join(', ') || '(none)'}`);
console.log(`  in live but not ours   : ${missing.join(', ') || '(none)'}`);
console.log(`  in ours but not live   : ${extra.join(', ') || '(none)'}`);

// Compare PARSED top-level keys, not a line-anchored regex: indentation is
// cosmetic to Amarisoft, so a two-space-indented root key is still a root key.
const ourAst: any = parseAmarisoftConfig(ours);
const topMissing = Object.keys(ast).filter(k => !(k in ourAst));
console.log(`\n  top-level in live but not ours: ${topMissing.join(', ') || '(none)'}`);
console.log(`  license_server in live : ${JSON.stringify(ast.license_server)}`);
console.log(`  license_server in ours : ${JSON.stringify(ourAst.license_server)}`);
console.log(`  licence survives the round trip: ${
  JSON.stringify(ourAst.license_server) === JSON.stringify(ast.license_server) ? 'YES' : 'NO'}`);

console.log('\n=== 4. re-import what we generated from the live config ===');
const back = importCfgToBuilder(ours, 'enb.cfg');
if (!back) { console.log('  FAIL  could not re-import our own output'); process.exit(1); }
const g: any = back.form;
let drift = 0;
for (const k of ['cellId', 'band', 'nrBandwidth', 'subcarrierSpacing', 'dlNrArfcn', 'nrTdd', 'fr2', 'nAntennaDl', 'nAntennaUl']) {
  if (JSON.stringify(g[k]) !== JSON.stringify(f[k])) {
    console.log(`  DRIFT ${k}: live-import ${JSON.stringify(f[k])} -> ours ${JSON.stringify(g[k])}`);
    drift++;
  }
}
console.log(drift === 0 ? '  PASS  no drift on the round trip' : `  ${drift} field(s) drifted`);
