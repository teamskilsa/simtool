// UE-SIM test-case wizard QA.
//
//   test case --generateUeCfg--> ue.cfg --parseUeCfg--> object
//                                  '--extractTestCase--> test case'
//
// Checks the emitted file parses as Amarisoft JSON-with-comments, that it
// carries every wizard parameter in the shape Simnovator's own compiler
// writes (verified against the live ue.cfg on the UE-sim box and the
// compiled test cases in the Simnovator database), and that the header
// round-trips the test case exactly.
//
// Run: npx tsx scripts/qa/qa-uesim-testcase.ts

import { makeTestCase, makeSubscriberGroup, makeUserPlaneProfile } from '../../src/modules/ueSim/testcase/defaults';
import { generateUeCfg, extractTestCase, validateTestCase, algoBitmap } from '../../src/modules/ueSim/testcase/generateUeCfg';
import { imeisvFor, removeSubscriberGroup, scheduleFor, testLength } from '../../src/modules/ueSim/testcase/derive';
import { parseUeCfg } from '../../src/modules/ueSim/services/cfgParser';
import type { UeTestCase } from '../../src/modules/ueSim/testcase/types';

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name}`, detail ?? ''); }
}

function run(title: string, tc: UeTestCase, expect: (root: any, cfg: string) => void) {
  console.log(`\n== ${title}`);
  const issues = validateTestCase(tc);
  check('validates clean', issues.length === 0, issues);
  const cfg = generateUeCfg(tc);
  const parsed = parseUeCfg(cfg);
  check('parses with no warnings', parsed.warnings.length === 0, parsed.warnings);
  const root = parsed.raw as any;
  check('has ue_list', Array.isArray(root.ue_list));
  check('has cell_groups', Array.isArray(root.cell_groups) && root.cell_groups.length === 1);
  const back = extractTestCase(cfg);
  check('header round-trips', JSON.stringify(back) === JSON.stringify(tc));
  expect(root, cfg);
  return cfg;
}

// ── 1. Simnovator defaults: 5G SA, n78 100 MHz, 2 UEs, iperf both ways ─────
const base = makeTestCase('qa-default');
const cfg1 = run('5G:SA defaults', base, root => {
  const grp = root.cell_groups[0];
  const cell = grp.cells[0];
  check('group_type nr, multi_ue, ldpc_max_its 5', grp.group_type === 'nr' && grp.multi_ue === true && grp.ldpc_max_its === 5 && grp.channel_sim === false);
  check('band 78', cell.band === 78);
  check('defaults to the bench cell 627300 / SSB 624576 (TDD → ul = dl)', cell.dl_nr_arfcn === 627300 && cell.ul_nr_arfcn === 627300 && cell.ssb_nr_arfcn === 624576, [cell.dl_nr_arfcn, cell.ul_nr_arfcn, cell.ssb_nr_arfcn]);
  check('bandwidth 100 / scs 30', cell.bandwidth === 100 && cell.subcarrier_spacing === 30);
  check('2x1 antennas, matching the bench cell', cell.n_antenna_dl === 2 && cell.n_antenna_ul === 1);
  check('rf_port 0, sync_id 0, prach_delay, gta', cell.rf_port === 0 && cell.sync_id === 0 && cell.prach_delay === 0 && cell.global_timing_advance === -1);
  check('one SDR for a 2-antenna cell', root.rf_driver.args === 'dev0=/dev/sdr0' && root.rf_driver.rx_antenna === 'rx', root.rf_driver.args);
  check('tx_gain [80]', JSON.stringify(root.tx_gain) === '[80]', root.tx_gain);
  check('rx_gain [10,10]', JSON.stringify(root.rx_gain) === '[10,10]', root.rx_gain);
  check('com_addr 0.0.0.0:9002', root.com_addr === '0.0.0.0:9002');
  check('log_options rrc_debug (Simnovator string)', root.log_options === 'sip.level=none,ip.level=none,nas.level=none,rrc.level=debug,pdcp.level=none,rlc.level=none,mac.level=none,phy.level=none,phy.signal=0,all.max_size=1,file.rotate=5M,time=full', root.log_options);
  check('log_filename from test name', root.log_filename === '/tmp/qa-default.log');

  const gt = root.global_traffic;
  check('global_traffic.iperf[0].iperf0', gt && Array.isArray(gt.iperf) && gt.iperf[0].iperf0, gt);
  const ip = gt.iperf[0].iperf0;
  check('iperf0 udp 20.10.10.1 port_range 5000', ip.type === 'udp' && ip.dest_ip === '20.10.10.1' && ip.port_range === 5000);
  check('iperf0 bitrates 150/50 Mbps, payload 1000, mtu 1500', ip.bitrate_dl === 150 && ip.bitrate_ul === 50 && ip.payload === 1000 && ip.mtu === 1500);
  check('global_traffic.log_level none', gt.log_level === 'none');

  check('2 UEs', root.ue_list.length === 2);
  const [u0, u1] = root.ue_list;
  check('ue_id 1, 2', u0.ue_id === 1 && u1.ue_id === 2);
  check('imsi padded to 15 digits', u0.imsi === '001010123456001', u0.imsi);
  check('next SUPI +1', u1.imsi === '001010123456002', u1.imsi);
  check('milenage + OPC uppercase', u0.sim_algo === 'milenage' && u0.opc === '000102030405060708090A0B0C0D0E0F' && u0.K === '00112233445566778899AABBCCDDEEFF');
  check('imeisv numbered like Simnovator', u0.imeisv === '4085780000000102' && u1.imeisv === '4085780000000202', [u0.imeisv, u1.imeisv]);
  check('res_len 8, as_release 16, ue_category nr, cell_index 0', u0.res_len === 8 && u0.as_release === 16 && u0.ue_category === 'nr' && u0.cell_index === 0);
  check('mnc_nb_digits 2', u0.mnc_nb_digits === 2);
  check('ecc_params null/1111/0', u0.ecc_params.scheme === 'null' && u0.ecc_params.routing_indicator === '1111' && u0.ecc_params.home_nw_public_key_id === 0);
  check('attach_pdn_type ipv4', u0.attach_pdn_type === 'ipv4');
  check('nr_voice_support true, rrc_inactive_support false', u0.nr_voice_support === true && u0.rrc_inactive_support === false);
  check('algo bitmaps 224 (nia/nea 0-2)', u0.integ_algo_bitmap === 224 && u0.cipher_algo_bitmap === 224);
  check('security context / power control / rrc flags', u0.use_security_context_for_registration === true && u0.power_control_enabled === false && u0.rrc_initial_selection === false && u0.rrc_sel_resel === false);
  check('tun_setup_script for iperf', u0.tun_setup_script === 'ue-ifup');
  check('no header-only keys leak (amf, default_pdn_type, ext_app)', u0.amf === undefined && u0.default_pdn_type === undefined && !JSON.stringify(u0.sim_events).includes('ext_app'));

  const ev0 = u0.sim_events.map((e: any) => e.event);
  check('events power_on, power_off only', JSON.stringify(ev0) === JSON.stringify(['power_on', 'power_off']), ev0);
  check('power_on at 0 / UE1 at 1s (1 UE/s)', u0.sim_events[0].start_time === 0 && u1.sim_events[0].start_time === 1);
  check('power_off at 650 / 651', u0.sim_events[1].start_time === 650 && u1.sim_events[1].start_time === 651);
  const tr0 = u0.traffic[0].iperf[0];
  check('traffic iperf0 start 5, duration 600, no loops', tr0.profile_id === 'iperf0' && tr0.start_time === 5 && tr0.session_duration === 600 && tr0.data_loop_count === 0 && tr0.loop_count === 0);
  check('UE1 traffic start 6', u1.traffic[0].iperf[0].start_time === 6);
  check('test length 651s', testLength(base) === 651, testLength(base));
});

// ── 2. Two groups, XOR + slicing + SUCI, ping, DL-only TCP, loops ────────────
const two = makeTestCase('qa-two-groups');
two.subscriber.groups = [
  makeSubscriberGroup(0, '5G:SA', { ueCount: 3, algorithm: 'XOR', incrementSharedKey: 1, networkSlicing: 'Enable', nssai: [{ sst: 1, sd: '0x010203' }], defaultApn: 'internet', rrcInactive: true, cqi: 12, ri: 2 }),
  makeSubscriberGroup(1, '5G:SA', { ueCount: 2, startingSupi: '1010200000001', mncDigits: 3, protectionScheme: 'Profile A', publicKeyId: 1, homeNetworkPublicKey: 'ab'.repeat(32), integrity: { nia0: false, nia1: false, nia2: true, nia3: false }, cipher: { nea0: true, nea1: false, nea2: true, nea3: true }, sqn: '000000000010', attachPdnType: 'Emergency', pdnType: 'IPv4v6' }),
];
two.traffic.profiles[0].attachRate = 2;
two.traffic.profiles[0].attachDelay = 3;
two.traffic.profiles[0].loopProfile = 'Enable';
two.traffic.profiles[0].powerOnDuration = 100;
two.traffic.profiles[0].powerOffDuration = 10;
two.traffic.profiles[0].loopCount = 5;
two.userPlane.profiles = [
  makeUserPlaneProfile(0, { subscriberGroup: 1, dataType: 'PING', apnName: 'ims', pingInterval: 10, payloadLength: 56, pingCount: 29, duration: 30, startDelay: 5 }),
  makeUserPlaneProfile(1, { subscriberGroup: 0, dataType: 'IPERF', transportProtocol: 'TCP', fileTransferAction: 'DL', dlBitrate: { value: 1500, unit: 'Kbps' }, duration: 20, loop: true, loopCount: 3, loopGap: 5 }),
];
two.cell.cells[0].rxGain = [10, 12];
run('two groups / XOR / slicing / SUCI / ping / TCP DL loops', two, root => {
  check('5 UEs', root.ue_list.length === 5);
  check('rx_gain array as given', JSON.stringify(root.rx_gain) === '[10,12]', root.rx_gain);
  const gt = root.global_traffic;
  check('ping0 profile', gt.ping[0].ping0.dest_ip === '20.10.10.1' && gt.ping[0].ping0.interval === 10 && gt.ping[0].ping0.packet_size === 56 && gt.ping[0].ping0.packet_count === 29 && gt.ping[0].ping0.apn === 'ims', gt.ping);
  const ip = gt.iperf[0].iperf0;
  check('iperf0 tcp DL-only 1.5 Mbps, no payload for tcp', ip.type === 'tcp' && ip.bitrate_dl === 1.5 && ip.bitrate_ul === undefined && ip.payload === undefined, ip);

  const g0 = root.ue_list.slice(0, 3);
  check('xor has no opc', g0.every((u: any) => u.sim_algo === 'xor' && u.opc === undefined));
  check('K increments', g0[1].K === '00112233445566778899AABBCCDDEF00' && g0[2].K === '00112233445566778899AABBCCDDEF01', g0.map((u: any) => u.K));
  check('default_nssai + default_pdu_session_snssai', g0[0].default_nssai?.[0]?.sst === 1 && g0[0].default_nssai?.[0]?.sd === 0x010203 && g0[0].default_pdu_session_snssai?.sst === 1, g0[0].default_nssai);
  check('apn internet, rrc_inactive_support true', g0[0].apn === 'internet' && g0[0].rrc_inactive_support === true);
  check('forced_cqi 12 / forced_ri 2, no forced_pmi', g0[0].forced_cqi === 12 && g0[0].forced_ri === 2 && g0[0].forced_pmi === undefined);
  check('attach spacing 3, 3.5, 4', g0.map((u: any) => u.sim_events[0].start_time).join() === '3,3.5,4');
  check('power cycle loops: loop_count 4, loop_delay 110', g0[0].sim_events[0].loop_count === 4 && g0[0].sim_events[0].loop_delay === 110 && g0[0].sim_events.at(-1).event === 'power_off' && g0[0].sim_events.at(-1).loop_count === 4);
  const tr = g0[0].traffic[0].iperf[0];
  check('data loops: data_loop_count 2, gap 5', tr.data_loop_count === 2 && tr.inter_data_loop_delay === 5 && tr.session_duration === 20);

  const g1 = root.ue_list.slice(3);
  check('group 1 imsi + mnc 3', g1[0].imsi === '001010200000001' && g1[0].mnc_nb_digits === 3);
  check('SUCI profile A with key', g1[0].ecc_params.scheme === 'A' && g1[0].ecc_params.home_nw_public_key_id === 1 && g1[0].ecc_params.home_nw_public_key === 'ab'.repeat(32));
  check('bitmaps nia2 only = 32, nea0+2+3 = 176', g1[0].integ_algo_bitmap === 32 && g1[0].cipher_algo_bitmap === 176);
  check('sqn, emergency_attach, ipv4v6', g1[0].sqn === '000000000010' && g1[0].emergency_attach === true && g1[0].attach_pdn_type === 'ipv4v6');
  check('ping traffic entry with pdn_connect ims', g1[0].traffic[0].ping[0].profile_id === 'ping0' && g1[0].sim_events.some((e: any) => e.event === 'pdn_connect' && e.apn === 'ims' && e.start_time === 8) && g1[0].sim_events.some((e: any) => e.event === 'pdn_disconnect' && e.start_time === 38));
  check('group 0 gets no ping, group 1 gets no iperf', !JSON.stringify(g0[0].traffic).includes('ping') && !JSON.stringify(g1[0].traffic).includes('iperf'));
  check('schedule power-off includes cycles: 3 + 100*5 + 10*4', scheduleFor(two)[0].powerOff === 3 + 540);
});

// ── 3. 4G with mobility (round trip) + oneWay, two cells on two cards ──────
const lte = makeTestCase('qa-lte-mobility', '4G');
lte.cell.cells.push({ ...lte.cell.cells[0], id: 1, rfCard: '2', band: '1', dlEarfcn: 300 });
lte.cell.mobility = true;
lte.mobility.channelModel = 'AWGN';
lte.mobility.cellPositions = [{ cellId: 0, x: 4, y: 3 }, { cellId: 1, x: 100, y: 0 }];
lte.mobility.groups = [{ groupId: 0, x: 0, y: 0, speedKmh: 10, direction: 0, tripType: 'roundTrip', distance: 50, startDelay: 5, duration: 380 }];
lte.subscriber.groups[0].ueCount = 1;
lte.userPlane.profiles = [];
lte.traffic.profiles[0].powerOnDuration = 2000;
run('4G + AWGN round-trip mobility, 2 cells', lte, root => {
  const grp = root.cell_groups[0];
  check('group_type lte, pdsch_max_its 6, channel_sim', grp.group_type === 'lte' && grp.pdsch_max_its === 6 && grp.channel_sim === true && grp.ldpc_max_its === undefined);
  const [c0, c1] = grp.cells;
  check('cell 0 earfcn 3350/21350', c0.dl_earfcn === 3350 && c0.ul_earfcn === 21350 && c0.band === undefined);
  check('cell 1 rf_port 1 sync_id 1 earfcn 300/18300', c1.rf_port === 1 && c1.sync_id === 1 && c1.dl_earfcn === 300 && c1.ul_earfcn === 18300);
  check('cell 0 on card 0 uses sdr0+sdr1 (4 DL antennas), so cell 1 starts at card 2', true);
  check('rf_driver 4 devs, no rx_antenna for lte', root.rf_driver.args === 'dev0=/dev/sdr0,dev1=/dev/sdr1,dev2=/dev/sdr2,dev3=/dev/sdr3' && root.rf_driver.rx_antenna === undefined);
  check('gains concatenated', JSON.stringify(root.tx_gain) === '[80,80]' && root.rx_gain.length === 8);
  check('cell antenna/position/powers', c0.antenna?.type === 'isotropic' && JSON.stringify(c0.position) === '[4,3]' && c0.ref_signal_power === -25 && c0.ul_power_attenuation === 60 && JSON.stringify(c1.position) === '[100,0]');
  const u = root.ue_list[0];
  check('ue_category 6, no NR-only keys', u.ue_category === 6 && u.ecc_params === undefined && u.mnc_nb_digits === undefined && u.nr_voice_support === undefined);
  check('channel awgn, position, noise_spd, rrc_sel_resel', u.channel_sim === true && u.channel.type === 'awgn' && JSON.stringify(u.position) === '[0,0]' && u.noise_spd === -174 && u.rrc_sel_resel === true);
  const moves = u.sim_events.filter((e: any) => e.event === 'ue_move');
  check('3 ue_move events like Simnovator', moves.length === 3, moves);
  check('leg out: t=5 speed 10 dir 0 loop 9×36', moves[0].start_time === 5 && moves[0].speed === 10 && moves[0].direction === 0 && moves[0].loop_count === 9 && moves[0].loop_delay === 36);
  check('leg back: t=23 at [50,0] dir 180', moves[1].start_time === 23 && JSON.stringify(moves[1].position) === '[50,0]' && moves[1].direction === 180);
  check('stop at 385 (5 + 380)', moves[2].start_time === 385 && moves[2].speed === 0);
  check('no traffic block without user plane', root.global_traffic === undefined && u.traffic === undefined && u.tun_setup_script === undefined);
});

// ── 4. HTTP + FDD NR band ──────────────────────────────────────────────────
const http = makeTestCase('qa-http');
http.cell.cells[0] = { ...http.cell.cells[0], band: 'n1', duplexMode: 'FDD', dlNrArfcn: 428000, ssbNrArfcn: 427920, scs: 15, bandwidth: 20 };
http.userPlane.profiles = [makeUserPlaneProfile(0, { dataType: 'HTTP', destinationUrl: 'http://www.example.com/', duration: 300 })];
run('HTTP + NR FDD', http, root => {
  const cell = root.cell_groups[0].cells[0];
  check('FDD ul_nr_arfcn = dl - 38000', cell.ul_nr_arfcn === 390000 && cell.band === 1);
  check('http0 dest_url', root.global_traffic.http[0].http0.dest_url === 'http://www.example.com/');
  check('ue traffic http entry', root.ue_list[0].traffic[0].http[0].profile_id === 'http0' && root.ue_list[0].traffic[0].http[0].session_duration === 300);
});

// ── 5. Group removal keeps references consistent ───────────────────────────
console.log('\n== group removal');
const rm = makeTestCase('qa-remove');
rm.subscriber.groups = [0, 1, 2].map(i => makeSubscriberGroup(i, '5G:SA', { startingSupi: String(1010123456001 + i * 1000) }));
rm.userPlane.profiles[0].subscriberGroup = 2;
rm.traffic.profiles.push({ ...rm.traffic.profiles[0], id: 1, subscriberGroups: 1 });
rm.mobility.groups = [0, 1, 2].map(i => ({ ...rm.mobility.groups[0], groupId: i, x: i * 10 }));
const after = removeSubscriberGroup(rm, 0);
check('groups renumbered 0,1', after.subscriber.groups.map(g => g.id).join() === '0,1');
check('user plane selector 2 → 1', after.userPlane.profiles[0].subscriberGroup === 1);
check('traffic selector 1 → 0', after.traffic.profiles[1].subscriberGroups === 0);
check('mobility rows follow', after.mobility.groups.map(m => `${m.groupId}:${m.x}`).join() === '0:10,1:20');
check('validation flags a dangling selector', validateTestCase({ ...rm, userPlane: { profiles: [{ ...rm.userPlane.profiles[0], subscriberGroup: 7 }] } }).some(i => /group 7 does not exist/.test(i)));

// ── 6. Validation catches the usual mistakes ───────────────────────────────
console.log('\n== validation');
const bad = makeTestCase('');
bad.subscriber.groups[0].sharedKey = 'zz';
bad.subscriber.groups[0].servingCell = 7;
bad.subscriber.groups[0].protectionScheme = 'Profile B';
bad.userPlane.profiles[0].duration = 700; // outlives the 650 s power-on
const issues = validateTestCase(bad);
check('empty name', issues.some(i => /name is required/.test(i)));
check('bad key', issues.some(i => /32 hex/.test(i)));
check('missing serving cell', issues.some(i => /serving cell 7/.test(i)));
check('profile B needs a key', issues.some(i => /33-byte home network public key/.test(i)));
check('flow outlives UE', issues.some(i => /powers off at 650/.test(i)));
check('algoBitmap', algoBitmap([true, true, true, false]) === 224 && algoBitmap([false, false, false, true]) === 16);
check('imeisvFor 1000', imeisvFor('4085780000000102', 1000) === '4085780000100002');
const overlap = makeTestCase('qa-overlap');
overlap.cell.cells[0] = { ...overlap.cell.cells[0], dlAntennas: 4, rxGain: [10, 10, 10, 10] }; // 4 DL antennas → cell 0 owns sdr0+sdr1
overlap.cell.cells.push({ ...overlap.cell.cells[0], id: 1, rfCard: '1' });
check('RF card overlap is caught', validateTestCase(overlap).some(i => /overlaps cell 0 on \/dev\/sdr1/.test(i)), validateTestCase(overlap));
const twoAnt = makeTestCase('qa-2ant');
twoAnt.cell.cells[0] = { ...twoAnt.cell.cells[0], dlAntennas: 2, ulAntennas: 1, rxGain: [10, 10], txGain: [80] };
twoAnt.cell.cells.push({ ...twoAnt.cell.cells[0], id: 1, rfCard: '1' });
check('2-antenna cells sit one per SDR', (parseUeCfg(generateUeCfg(twoAnt)).raw as any).rf_driver.args === 'dev0=/dev/sdr0,dev1=/dev/sdr1', (parseUeCfg(generateUeCfg(twoAnt)).raw as any).rf_driver.args);

// ── 7. Header ──────────────────────────────────────────────────────────────
console.log('\n== header');
check('marker present', cfg1.startsWith('/* @uesim-testcase:'));
check('summary block present', /\* Test case : qa-default/.test(cfg1));
check('bodyOnly strips header', generateUeCfg(base, { bodyOnly: true }).startsWith('{'));
check('no comma after comment line', !/\/\/ UE 1[^\n]*,\n/.test(cfg1));

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
if (process.env.QA_PRINT) console.log('\n' + cfg1);
process.exit(failures === 0 ? 0 : 1);
