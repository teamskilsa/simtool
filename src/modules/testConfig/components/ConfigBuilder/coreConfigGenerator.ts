// Generates Amarisoft ltemme (MME/EPC) configuration from form state.
// Validated against the reference shipped with Amarisoft 2026-04-22
// (ltemme-linux-2026-04-22/config/mme.cfg).
import type { NRFormState } from './constants';

/**
 * Format PLMN string as MCC (3-digit) + MNC (2- or 3-digit, zero-padded).
 * enb.cfg / mme.cfg: plmn — e.g. "00101" (MCC=001, MNC=01)
 * Bug fix: a bare 1-digit MNC ("1") would have concatenated to "0011" instead of "00101".
 */
function formatPlmn(mcc: string, mnc: string): string {
  const paddedMcc = mcc.padStart(3, '0').slice(-3);
  const mncLen = mnc.length >= 3 ? 3 : 2;
  const paddedMnc = mnc.padStart(mncLen, '0').slice(-mncLen);
  return `${paddedMcc}${paddedMnc}`;
}

export function generateCoreConfig(form: NRFormState): string {
  const L = (form as any).layers || {};
  const lvl = L.logLevel || 'error';

  // ── PDN list (with erabs — required for LTE QoS) ─────────────────────────
  const pdnBlock = () => {
    if (!form.pdnList || form.pdnList.length === 0) return '  pdn_list: [],';
    const entries = form.pdnList.map(p => {
      const fields = [
        `      pdn_type: "${p.pdn_type}"`,
        `      access_point_name: "${p.access_point_name}"`,
        `      first_ip_addr: "${p.first_ip_addr}"`,
        `      last_ip_addr: "${p.last_ip_addr}"`,
        `      ip_addr_shift: 2`,
      ];
      if (p.dns_addr) fields.push(`      dns_addr: "${p.dns_addr}"`);
      return `    {
${fields.join(',\n')},
      erabs: [
        {
          qci: 9,
          priority_level: 15,
          pre_emption_capability: "shall_not_trigger_pre_emption",
          pre_emption_vulnerability: "not_pre_emptable",
        },
      ],
    }`;
    }).join(',\n');
    return `  pdn_list: [
${entries}
  ],`;
  };

  // ── UE database — per reference, no nb_ue or `ims` bool; use arrays ──────
  const ueDbBlock = () => {
    if (!form.ueDb || form.ueDb.length === 0) return '  ue_db: [],';
    const entries = form.ueDb.map(u => {
      const fields: string[] = [
        `      sim_algo: "${u.sim_algo}"`,
        `      imsi: "${u.imsi}"`,
        `      amf: 0x${u.amf.toString(16)}`,
        `      sqn: "${u.sqn}"`,
        `      K: "${u.K}"`,
      ];
      if (u.opc) fields.push(`      opc: "${u.opc}"`);
      // For the nb_ue bulk feature we emit it as a UE count annotation (comment)
      // so install.sh doesn't reject the entry; the real Amarisoft config
      // replicates entries via sim_events.
      if (u.nb_ue && u.nb_ue > 1) {
        fields.push(`      /* replicate this UE ${u.nb_ue} times via sim_events */`);
      }
      if (u.ims) {
        const mccMnc = form.plmn.mcc + form.plmn.mnc.padStart(3, '0');
        fields.push(`      impi: "${u.imsi}@ims.mnc${mccMnc.slice(3)}.mcc${mccMnc.slice(0, 3)}.3gppnetwork.org"`);
        fields.push(`      impu: ["${u.imsi}", "tel:${u.imsi.slice(-10)}"]`);
        fields.push(`      domain: "ims.mnc${mccMnc.slice(3)}.mcc${mccMnc.slice(0, 3)}.3gppnetwork.org"`);
      }
      return `    {\n${fields.join(',\n')},\n    }`;
    }).join(',\n');
    return `  ue_db: [
${entries}
  ],`;
  };

  return `/* ltemme configuration file — MME/EPC
 * Generated: ${new Date().toISOString()}
 */

{
  log_options: "all.level=${lvl},all.max_size=0,nas.level=debug,nas.max_size=1,s1ap.level=debug,s1ap.max_size=1,ngap.level=debug,ngap.max_size=1",
  log_filename: "${L.logFilename || '/tmp/mme.log'}",

  /* Enable remote API and Web interface */
  com_addr: "[::]:9000",

  /* bind address for GTP-U */
  gtp_addr: "${form.gtpAddr}",

  // mme.cfg: plmn — MCC (3-digit) + MNC (2- or 3-digit, zero-padded)
  plmn: "${formatPlmn(form.plmn.mcc, form.plmn.mnc)}",
  tac: ${form.tac},
  mme_group_id: 32769,
  mme_code: 1,

  network_name: "Amarisoft Network",
  network_short_name: "Amarisoft",

  /* Control Plane Cellular IoT EPS optimization */
  cp_ciot_opt: true,

  /* DCNR support */
  dcnr_support: true,

  /* 5GS interworking */
  eps_5gs_interworking: "with_n26",

  /* 15 bearers support */
  fifteen_bearers: false,

${pdnBlock()}

${ueDbBlock()}
}
`;
}
