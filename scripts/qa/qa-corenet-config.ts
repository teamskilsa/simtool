// Core network configuration QA.
//
//   CoreConfig --generateMmeCfg--> mme.cfg --parseUeCfg--> object
//                                     '--extractCoreConfig--> CoreConfig'
//
// The emitted file is checked against the shape of the live mme.cfg on the
// lab callbox (192.168.1.106): plmn / mme_group_id / mme_code, pdn_list with
// erabs and 5G slices, ims_list and the ims_vops_* flags, the Rx interface,
// emergency_number_list, the NAS preference arrays, and the ue_db.
//
// Run: npx tsx scripts/qa/qa-corenet-config.ts
//      QA_LIVE_MME=<path to a real mme.cfg> to also diff key sets against it.

import { readFileSync } from 'fs';
import {
  makeCoreConfig, makePdn, makeSubscriberRange, defaultErab,
} from '../../src/modules/coreNet/config/defaults';
import {
  generateMmeCfg, generateUeDbFile, extractCoreConfig, validateCoreConfig,
} from '../../src/modules/coreNet/config/generateMmeCfg';
import {
  expandSubscribers, poolCapacity, totalSubscribers, plmnString, imsDomainFor,
  incrementDigits, underCapacityPdns,
} from '../../src/modules/coreNet/config/derive';
// ltemme and lteue share the JSON-with-comments syntax, so the UE parser is
// a fair independent check that the emitted file is well formed.
import { parseUeCfg } from '../../src/modules/ueSim/services/cfgParser';
import type { CoreConfig } from '../../src/modules/coreNet/config/types';

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name}`, detail ?? ''); }
}

function run(title: string, cfg: CoreConfig, expect: (root: any, text: string) => void) {
  console.log(`\n== ${title}`);
  const issues = validateCoreConfig(cfg);
  check('validates clean', issues.length === 0, issues);
  const text = generateMmeCfg(cfg);
  const parsed = parseUeCfg(text);
  // An "unresolved include" is the parser doing its job: the subscriber file
  // is a second artefact that only exists once it is written next to the cfg.
  const warnings = parsed.warnings.filter(w => !/Unresolved include/.test(w));
  check('parses with no warnings', warnings.length === 0, warnings);
  const root = parsed.raw as any;
  const back = extractCoreConfig(text);
  check('header round-trips', JSON.stringify(back) === JSON.stringify(cfg));
  expect(root, text);
  return text;
}

// ── 1. Bench defaults ──────────────────────────────────────────────────────
const base = makeCoreConfig('qa-core');
const cfg1 = run('bench defaults (combined EPC + 5GC)', base, (root, text) => {
  check('plmn 00101', root.plmn === '00101', root.plmn);
  check('mme_group_id 32769 / mme_code 1', root.mme_group_id === 32769 && root.mme_code === 1);
  check('gtp_addr', root.gtp_addr === '127.0.1.100');
  check('com_addr 0.0.0.0:9000', root.com_addr === '0.0.0.0:9000');
  check('license_server block', root.license_server?.tag === 'rnd-mme' && root.license_server?.server_addr === '192.168.0.11:9051');
  check('log_options nas_s1ap_debug', String(root.log_options).includes('s1ap.level=debug') && String(root.log_options).includes('ngap.level=debug'));
  check('log_filename from config name', root.log_filename === '/tmp/qa-core.log');
  check('network name / short name', root.network_name === 'Simnovus Network' && root.network_short_name === 'Simnovus');
  check('dcnr + cp_ciot + interworking', root.dcnr_support === true && root.cp_ciot_opt === true && root.eps_5gs_interworking === 'with_n26');
  check('fifteen_bearers false', root.fifteen_bearers === false);
  check('edrx on by default, as the bench runs it', root.edrx === true && root.edrx_cycle_forced === 3);
  check('nssai emitted for a 5G-capable core', Array.isArray(root.nssai) && root.nssai[0].sst === 1);

  // IMS
  check('ims_list', root.ims_list?.[0]?.ims_addr === '127.0.0.1' && root.ims_list?.[0]?.bind_addr === '127.0.0.2');
  check('ims_vops for both EPS and 5GS', root.ims_vops_eps === true && root.ims_vops_5gs_3gpp === true && root.ims_vops_5gs_n3gpp === true);
  check('rx bind + qci', root.rx?.bind_addr === '127.0.1.100' && root.rx?.qci?.audio === 1 && root.rx?.qci?.video === 2);
  check('emergency numbers as hex categories', root.emergency_number_list?.length === 2 && root.emergency_number_list[0].category === 0x1f && root.emergency_number_list[0].digits === '911');
  check('hex literal survives as 0x1f in the text', /category: 0x1f/.test(text));

  // PDNs
  check('3 APNs, default first', root.pdn_list?.length === 3 && root.pdn_list[0].access_point_name === 'default');
  const d = root.pdn_list[0];
  check('default APN pool + gateway + shift', d.pdn_type === 'ipv4' && d.first_ip_addr === '10.10.1.2' && d.last_ip_addr === '10.10.2.254' && d.gateway === '10.10.1.1' && d.ip_addr_shift === 0);
  check('default APN erabs qci 9', d.erabs?.[0]?.qci === 9 && d.erabs[0].priority_level === 15 && d.erabs[0].pre_emption_capability === 'shall_not_trigger_pre_emption');
  const ims = root.pdn_list[1];
  check('ims APN ipv4v6 with prefixes + p_cscf + dns array', ims.pdn_type === 'ipv4v6' && ims.first_ipv6_prefix === '2001:468:3000:1::' && Array.isArray(ims.p_cscf_addr) && ims.p_cscf_addr[0] === '192.168.4.1' && Array.isArray(ims.dns_addr) && ims.dns_addr.length === 2, [ims.p_cscf_addr, ims.dns_addr]);
  check('ims APN erab qci 5', ims.erabs[0].qci === 5);
  const sos = root.pdn_list[2];
  check('sos APN carries emergency: true', sos.emergency === true && sos.access_point_name === 'sos');
  check('tun_setup_script mme-ifup', root.tun_setup_script === 'mme-ifup');

  // NAS preference + ue_db
  check('nas preference arrays', JSON.stringify(root.nas_cipher_algo_pref) === '[]' && JSON.stringify(root.nas_integ_algo_pref) === '[2,1]');
  check('10 subscribers inline', Array.isArray(root.ue_db) && root.ue_db.length === 10);
  const u0 = root.ue_db[0];
  check('subscriber identity', u0.imsi === '001010123456001' && u0.sim_algo === 'xor' && u0.K === '00112233445566778899aabbccddeeff');
  check('amf as a hex literal', u0.amf === 0x9001 && /amf: 0x9001/.test(text));
  check('sqn', u0.sqn === '000000000000');
  check('xor carries no op/opc', u0.op === undefined && u0.opc === undefined);
  check('IMS identities on the subscriber', u0.impi === '001010123456001@ims.mnc001.mcc001.3gppnetwork.org' && u0.domain === 'ims.mnc001.mcc001.3gppnetwork.org' && u0.pwd === 'sim');
  check('impu carries imsi, tel, sip and short number', JSON.stringify(u0.impu) === JSON.stringify(['001010123456001', 'tel:+917600000000', 'sip:+917600000000', 'tel:600']), u0.impu);
  const u9 = root.ue_db[9];
  check('10th subscriber increments imsi, msisdn and short number', u9.imsi === '001010123456010' && u9.impu[1] === 'tel:+917600000009' && u9.impu[3] === 'tel:609', u9.impu);
  check('no include when the db is inline', !/include /.test(text));
});

// ── 2. EPC-only, milenage, separate db file, eDRX, slices off ──────────────
const epc = makeCoreConfig('qa-epc');
epc.network.coreType = 'EPC';
epc.network.edrx = true;
epc.network.edrxCycleForced = 5;
epc.network.dcnrSupport = false;
epc.subscriber.ranges = [makeSubscriberRange(0, { count: 3, simAlgo: 'milenage', opType: 'OPc', imsEnabled: false, startingImsi: '001010123456001' })];
epc.subscriber.separateFile = true;
epc.subscriber.includeFilename = 'demo-db.cfg';
epc.ims.enabled = false;
run('EPC only / milenage / separate ue_db', epc, (root, text) => {
  check('no 5G keys', root.ims_vops_5gs_3gpp === undefined && root.nssai === undefined && root.eps_5gs_interworking === undefined);
  check('no IMS block when disabled', root.ims_list === undefined && root.ims_vops_eps === undefined && root.rx === undefined && root.emergency_number_list === undefined);
  check('edrx emitted with the chosen cycle', root.edrx === true && root.edrx_cycle_forced === 5);
  check('dcnr omitted when off', root.dcnr_support === undefined);
  check('include instead of ue_db', root.ue_db === undefined && /include "demo-db\.cfg"/.test(text));
  const db = generateUeDbFile(epc);
  const parsedDb = parseUeCfg(db) as any;
  check('the separate db file parses and holds 3 entries', parsedDb.warnings.length === 0 && parsedDb.raw.ue_db?.length === 3, parsedDb.warnings);
  check('milenage carries opc, not op', parsedDb.raw.ue_db[0].opc === '000102030405060708090a0b0c0d0e0f' && parsedDb.raw.ue_db[0].op === undefined);
  check('no IMS identities when disabled', parsedDb.raw.ue_db[0].impi === undefined && parsedDb.raw.ue_db[0].domain === undefined);
});

// ── 3. 5GC with slices and a non-default PLMN ──────────────────────────────
const fiveG = makeCoreConfig('qa-5gc');
fiveG.network.coreType = '5GC';
fiveG.network.mcc = '208';
fiveG.network.mnc = '93';
fiveG.network.nssai = [{ sst: 1, sd: '' }, { sst: 3, sd: '50' }];
fiveG.network.edrx = false;
fiveG.subscriber.ranges = [makeSubscriberRange(0, { count: 2, startingImsi: '208930123456001' })];
fiveG.pdn.pdns = [
  makePdn(0, { apn: 'internet', firstIpAddr: '10.20.0.2', lastIpAddr: '10.20.0.254', ipAddrShift: 2 }),
  makePdn(1, {
    apn: 'slice-a', firstIpAddr: '10.21.0.2', lastIpAddr: '10.21.0.254', pCscfAddr: '10.21.0.1',
    slices: [{ sst: 3, sd: '50', qosFlows: [{ ...defaultErab(7), priorityLevel: 8 }] }],
  }),
];
run('5GC with slices', fiveG, (root, text) => {
  check('plmn 20893', root.plmn === '20893');
  check('edrx keys omitted when off', root.edrx === undefined && root.edrx_cycle_forced === undefined);
  check('no EPS-only keys', root.ims_vops_eps === undefined && root.eps_5gs_interworking === undefined);
  check('nssai with sd', root.nssai?.[1]?.sst === 3 && root.nssai[1].sd === 50);
  const s = root.pdn_list[1].slices?.[0];
  check('slice snssai + 5qi quoted key', s?.snssai?.sst === 3 && s?.snssai?.sd === 50 && s?.qos_flows?.[0]?.['5qi'] === 7, s);
  check('5qi is emitted as a quoted key', /"5qi": 7/.test(text));
  check('ip_addr_shift 2 → spacing of 4', root.pdn_list[0].ip_addr_shift === 2 && poolCapacity(fiveG.pdn.pdns[0]) === 64, poolCapacity(fiveG.pdn.pdns[0]));
});

// ── 4. Derivations ─────────────────────────────────────────────────────────
console.log('\n== derivations');
check('plmnString pads a 2-digit MNC', plmnString('001', '01') === '00101' && plmnString('208', '93') === '20893');
check('plmnString keeps a 3-digit MNC', plmnString('310', '260') === '310260');
check('imsDomainFor', imsDomainFor('001', '01') === 'ims.mnc001.mcc001.3gppnetwork.org');
check('incrementDigits keeps width', incrementDigits('001010123456001', 9) === '001010123456010');
check('poolCapacity consecutive', poolCapacity(makePdn(0, { firstIpAddr: '10.10.1.2', lastIpAddr: '10.10.1.11', ipAddrShift: 0 })) === 10);
check('poolCapacity with shift 2 spaces by 4', poolCapacity(makePdn(0, { firstIpAddr: '10.10.1.0', lastIpAddr: '10.10.1.15', ipAddrShift: 2 })) === 4);
check('totalSubscribers sums ranges', totalSubscribers({ ...base, subscriber: { ...base.subscriber, ranges: [makeSubscriberRange(0, { count: 4 }), makeSubscriberRange(1, { count: 6 })] } }) === 10);
const many = { ...base, subscriber: { ...base.subscriber, ranges: [makeSubscriberRange(0, { count: 600 })] } };
check('underCapacityPdns flags a short pool', underCapacityPdns(many).some(u => u.pdn.apn === 'ims'), underCapacityPdns(many).map(u => u.pdn.apn));
check('expandSubscribers honours the limit', expandSubscribers(many, 5).length === 5);
check('K increments when asked', expandSubscribers({ ...base, subscriber: { ...base.subscriber, ranges: [makeSubscriberRange(0, { count: 3, incrementK: 1 })] } })[2].K === '00112233445566778899aabbccddef01');

// ── 5. Validation ──────────────────────────────────────────────────────────
console.log('\n== validation');
const bad = makeCoreConfig('');
bad.network.mcc = '1';
bad.subscriber.ranges = [makeSubscriberRange(0, { startingImsi: '999990000000001', K: 'zz', simAlgo: 'milenage', opType: 'none' })];
bad.pdn.pdns = [makePdn(0, { apn: 'a', firstIpAddr: '10.0.0.9', lastIpAddr: '10.0.0.1' }), makePdn(1, { apn: 'a' })];
const issues = validateCoreConfig(bad);
check('empty name', issues.some(i => /name is required/.test(i)));
check('bad MCC', issues.some(i => /MCC must be 3 digits/.test(i)));
check('bad K', issues.some(i => /K must be 32 hex/.test(i)));
check('milenage without an operator key', issues.some(i => /Milenage needs an OP or OPc/.test(i)));
check('IMSI outside the PLMN', issues.some(i => /does not start with the PLMN/.test(i)));
check('reversed pool', issues.some(i => /last IP address is below the first/.test(i)));
check('duplicate APN', issues.some(i => /used twice/.test(i)));
const imsNoPcscf = makeCoreConfig('qa-ims');
imsNoPcscf.pdn.pdns = [makePdn(0, { apn: 'default' })];
check('IMS on with no P-CSCF anywhere', validateCoreConfig(imsNoPcscf).some(i => /no APN carries a P-CSCF/.test(i)));

// ── 6. Header ──────────────────────────────────────────────────────────────
console.log('\n== header');
check('marker present', cfg1.startsWith('/* @corenet-config:'));
check('summary block present', /\* Config    : qa-core/.test(cfg1));
check('bodyOnly strips the header', generateMmeCfg(base, { bodyOnly: true }).startsWith('{'));
check('comment lines carry no trailing comma', !/\*\/,/.test(cfg1));

// ── 7. Optional diff against a real mme.cfg ────────────────────────────────
const livePath = process.env.QA_LIVE_MME;
if (livePath) {
  console.log('\n== against the live mme.cfg');
  // The cfg parser does not accept a bare `include` directive sitting
  // mid-object, which the bench file uses to pull in its 1000-subscriber
  // database. Drop those lines: this comparison is about the structural
  // keys of the main file, and the ue_db is checked separately above.
  const liveLines = readFileSync(livePath, 'utf8').split(/\r?\n/);
  const liveText = liveLines.filter(l => !l.trim().startsWith('include ')).join('\n');
  const live = parseUeCfg(liveText).raw as any;
  const mine = parseUeCfg(generateMmeCfg(base)).raw as any;
  const keys = (o: any, p = ''): string[] => {
    if (!o || typeof o !== 'object') return [];
    if (Array.isArray(o)) return o.length ? keys(o[0], `${p}[]`) : [];
    return Object.entries(o).flatMap(([k, v]) => [`${p}${p ? '.' : ''}${k}`, ...keys(v, `${p}${p ? '.' : ''}${k}`)]);
  };
  const L = new Set(keys(live));
  const M = new Set(keys(mine));
  const missing = [...L].filter(k => !M.has(k) && !k.startsWith('ue_db')).sort();
  console.log(`  live keys we do not emit: ${missing.length ? missing.join(', ') : 'none'}`);
  console.log(`  keys we add: ${[...M].filter(k => !L.has(k)).sort().join(', ') || 'none'}`);
  check('every structural key of the live file is covered', missing.length === 0, missing);
}

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
if (process.env.QA_PRINT) console.log('\n' + cfg1);
process.exit(failures === 0 ? 0 : 1);
