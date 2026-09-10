// Does a custom cell name survive a round trip? The generator writes it as a
// comment (/* name */); the parser drops comments and the importer hardcodes
// `Cell ${i+1}`.
import { generateNRConfig } from '../../src/modules/testConfig/components/ConfigBuilder/configGenerator';
import { importCfgToBuilder } from '../../src/modules/testConfig/components/ConfigBuilder/cfgImporter';
import { DEFAULT_NR_FORM, makeDefaultCell } from '../../src/modules/testConfig/components/ConfigBuilder/constants';

const form: any = {
  ...DEFAULT_NR_FORM, activeCellIdx: 0, cellId: 1,
  cells: [makeDefaultCell('Macro North', { cellId: 1 }),
          makeDefaultCell('Small Cell Lobby', { cellId: 2, dlNrArfcn: 636666 })],
};
const cfg = generateNRConfig(form);
console.log('names written into the cfg:', (cfg.match(/\/\* [^*]+ \*\//g) || []).join(' '));
const back: any = importCfgToBuilder(cfg, 'enb.cfg');
const names = back.form.cells.map((c: any) => c.name);
console.log('names after re-import   :', JSON.stringify(names));
console.log(names[0] === 'Macro North' ? 'PASS: names preserved' : 'FAIL: custom cell names lost on re-import');
