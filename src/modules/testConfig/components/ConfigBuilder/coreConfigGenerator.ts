// Generates Amarisoft mme.cfg (core) configuration from form state
import type { NRFormState } from './constants';

export function generateCoreConfig(form: NRFormState): string {
  const pdnBlock = () => {
    if (!form.pdnList || form.pdnList.length === 0) return '  pdn_list: [],';
    const entries = form.pdnList.map(p => {
      const fields = [
        `      pdn_type: "${p.pdn_type}"`,
        `      access_point_name: "${p.access_point_name}"`,
        `      first_ip_addr: "${p.first_ip_addr}"`,
        `      last_ip_addr: "${p.last_ip_addr}"`,
      ];
      if (p.dns_addr) fields.push(`      dns_addr: "${p.dns_addr}"`);
      if (p.ims_vops) fields.push(`      ims_vops: true`);
      return `    {\n${fields.join(',\n')},\n    }`;
    }).join(',\n');
    return `  pdn_list: [\n${entries}\n  ],`;
  };

  const ueDbBlock = () => {
    if (!form.ueDb || form.ueDb.length === 0) return '  ue_db: [],';
    const entries = form.ueDb.map(u => {
      const fields = [
        `      sim_algo: "${u.sim_algo}"`,
        `      imsi: "${u.imsi}"`,
        `      K: "${u.K}"`,
        u.opc ? `      opc: "${u.opc}"` : null,
        `      amf: 0x${u.amf.toString(16)}`,
        `      sqn: "${u.sqn}"`,
      ].filter(Boolean);
      if (u.nb_ue > 1) fields.push(`      nb_ue: ${u.nb_ue}`);
      if (u.ims) fields.push(`      ims: true`);
      return `    {\n${fields.join(',\n')},\n    }`;
    }).join(',\n');
    return `  ue_db: [\n${entries}\n  ],`;
  };

  return `/* MME/AMF Configuration
 * Generated: ${new Date().toISOString()}
 */

{
  log_options: "all.level=${form.logLevel || 'error'},all.max_size=0,nas.level=debug,nas.max_size=1,s1ap.level=debug,s1ap.max_size=1,ngap.level=debug,ngap.max_size=1",
  log_filename: "${form.logFilename || '/tmp/mme0.log'}",

  com_addr: "[::]:9000",

  plmn: "${form.plmn.mcc}${form.plmn.mnc}",
  tac: ${form.tac},
  mme_group_id: 32769,
  mme_code: 1,

  gtp_addr: "${form.gtpAddr}",
  s1ap_bind_addr: "${form.amfAddr}",

  integrity_algo_pref: [2, 1],
  ciphering_algo_pref: [2, 1, 0],

${pdnBlock()}

${ueDbBlock()}
}
`;
}
