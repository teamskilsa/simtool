// Regression: extractCellNames must match the list key on a word boundary.
//
// A bare indexOf('cell_list:') also matches inside 'nr_cell_list:'. On an LTE
// config that declares an empty nr_cell_list BEFORE cell_list (the shape our
// own LTE generator emits, with nr_cell_list last — but reference configs put
// it first), the importer would read the wrong block and lose every cell name.
import { importCfgToBuilder } from '../../src/modules/testConfig/components/ConfigBuilder/cfgImporter';

const cfg = `{
  log_options: "all.level=error",
  mme_list: [ { mme_addr: "127.0.1.100" } ],
  gtp_addr: "127.0.1.1",
  enb_id: 0x1A2D0,
  nr_cell_list: [],
  cell_list: [
    {
      /* LTE Anchor */
      rf_port: 0, cell_id: 1, n_id_cell: 1, dl_earfcn: 3350,
    },
    {
      /* Second Carrier */
      rf_port: 1, cell_id: 2, n_id_cell: 2, dl_earfcn: 1650,
    },
  ],
  cell_default: { },
}`;

const res: any = importCfgToBuilder(cfg, 'enb.cfg');
const names = res?.form?.cells?.map((c: any) => c.name);
console.log('detected type :', res?.type);
console.log('LTE cell names:', JSON.stringify(names));
const ok = Array.isArray(names) && names[0] === 'LTE Anchor' && names[1] === 'Second Carrier';
console.log(ok
  ? 'PASS: read cell_list, not nr_cell_list'
  : `FAIL: expected ["LTE Anchor","Second Carrier"], got ${JSON.stringify(names)}`);
process.exit(ok ? 0 : 1);
