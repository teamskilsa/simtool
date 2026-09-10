// Regression: root-level fields that the builder used to drop, for BOTH the
// NR and LTE generators — license_server, en_dc_support, rf_ports (including
// per-port keys the builder has no field for, which must survive verbatim).
import { generateNRConfig } from '../../src/modules/testConfig/components/ConfigBuilder/configGenerator';
import { generateLTEConfig } from '../../src/modules/testConfig/components/ConfigBuilder/lteConfigGenerator';
import { importCfgToBuilder } from '../../src/modules/testConfig/components/ConfigBuilder/cfgImporter';
import { DEFAULT_NR_FORM } from '../../src/modules/testConfig/components/ConfigBuilder/constants';
import { DEFAULT_LTE_FORM } from '../../src/modules/testConfig/components/ConfigBuilder/lteConstants';
import { parseAmarisoftConfig } from '../../src/modules/testConfig/components/ConfigBuilder/cfgParser';

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++; else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
};
const strip = (s: string) => s.replace(/^.*Generated:.*$/m, '');

const extras = {
  enDcSupport: true,
  licenseServer: { serverAddr: '192.168.0.11:9051', tag: 'oran-enb' },
  rfPorts: [
    { dlFreq: null, ulFreq: null, extra: { sample_rate: 23.04, rx_path: 'A' } },
    { dlFreq: null, ulFreq: null },
  ],
};

for (const rat of ['nr', 'lte'] as const) {
  console.log(`--- ${rat.toUpperCase()}`);
  const form: any = rat === 'nr' ? { ...DEFAULT_NR_FORM, ...extras } : { ...DEFAULT_LTE_FORM, ...extras };
  const gen = (f: any) => rat === 'nr' ? generateNRConfig(f) : generateLTEConfig(f, 'lte');
  const cfg = gen(form);
  const ast: any = parseAmarisoftConfig(cfg);

  check(`${rat} en_dc_support emitted`, ast.en_dc_support === true, JSON.stringify(ast.en_dc_support));
  check(`${rat} license_server emitted`, ast.license_server?.tag === 'oran-enb', JSON.stringify(ast.license_server));
  check(`${rat} rf_ports has 2 entries`, Array.isArray(ast.rf_ports) && ast.rf_ports.length === 2, JSON.stringify(ast.rf_ports));
  check(`${rat} rf_ports[0] extras kept`, ast.rf_ports?.[0]?.sample_rate === 23.04 && ast.rf_ports?.[0]?.rx_path === 'A', JSON.stringify(ast.rf_ports?.[0]));
  check(`${rat} rf_ports[1] is {}`, ast.rf_ports?.[1] && Object.keys(ast.rf_ports[1]).length === 0, JSON.stringify(ast.rf_ports?.[1]));

  const back: any = importCfgToBuilder(cfg, 'enb.cfg');
  check(`${rat} detected type`, back?.type === rat, back?.type);
  const f2 = back?.form ?? {};
  check(`${rat} enDcSupport round trip`, f2.enDcSupport === true);
  check(`${rat} licence round trip`, f2.licenseServer?.serverAddr === '192.168.0.11:9051');
  check(`${rat} rfPorts extras round trip`, f2.rfPorts?.[0]?.extra?.sample_rate === 23.04, JSON.stringify(f2.rfPorts));
  check(`${rat} re-save stable`, strip(gen(f2)) === strip(cfg));

  const plain = gen(rat === 'nr' ? DEFAULT_NR_FORM : DEFAULT_LTE_FORM);
  check(`${rat} defaults omit en_dc_support`, !/en_dc_support/.test(plain));
  check(`${rat} defaults omit rf_ports`, !/rf_ports/.test(plain));
  check(`${rat} defaults omit license_server`, !/license_server/.test(plain));
}

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
