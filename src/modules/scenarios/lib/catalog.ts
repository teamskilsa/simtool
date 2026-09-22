// Remote API messages Mobility Scenarios know about, with the fields the
// Amarisoft docs mark as mandatory. Checked against the 2026-09-11 docs:
//   lteenb.txt §10 Remote API (10.5 common, 10.6 LTE messages)
//   ltemme.txt remote API (ue_get, load_balancing_tau)
// Anything not listed here is still allowed (the validator warns), except the
// BLOCKED messages, which the runner never sends.
import type { RemoteTarget } from '../types';

export interface MessageSpec {
  target: RemoteTarget;
  required: string[];
  optional?: string[];
  doc: string;
  /** Proven on the live callbox by the earlier prototype. */
  provenLive?: boolean;
}

export const MESSAGES: Record<string, MessageSpec> = {
  // ── eNB (lteenb) ──
  config_get: { target: 'enb', required: [], doc: 'Current config: cells (n_id_cell, dl_earfcn, gain, connected_mobility, scell_list, ncell_list), logs.layers' },
  config_set: { target: 'enb', required: [], optional: ['logs', 'cells'], doc: 'Change logs.layers.<layer>.level, or per-cell settings (e.g. ho_from_meas)' },
  ue_get: { target: 'enb', required: [], optional: ['ue_id', 'stats'], doc: 'UE list: enb_ue_id, mme_ue_id, rnti, cells[0]=PCell. stats:true resets bitrate counters for every client — avoid.' },
  handover: { target: 'enb', required: ['ran_ue_id', 'pci'], optional: ['dl_earfcn', 'ssb_nr_arfcn', 'type'], doc: 'ran_ue_id is "eNB or RAN UE id" (enb_ue_id for LTE). Target must be in the PCell ncell_list.', provenLive: true },
  rrc_cnx_release: { target: 'enb', required: ['ran_ue_id'], optional: ['redirect', 'suspend'], doc: 'Force RRC release; the UE reconnects on the next data.', provenLive: true },
  rrc_cnx_reconf: { target: 'enb', required: ['enb_ue_id'], optional: ['eutra_secondary_cell_list', 'nr_secondary_cell_list', 'reconf_pucch_srs'], doc: 'eutra_secondary_cell_list (LTE) / nr_secondary_cell_list (NR SA PCell): subset of the PCell scell_list; [] releases all SCells. Never both in one call.', provenLive: true },
  scells_act_deact: { target: 'enb', required: ['enb_ue_id'], optional: ['activate', 'deactivate'], doc: 'MAC CE (de)activation; reply has scells and activated.', provenLive: true },
  cell_gain: { target: 'enb', required: ['cell_id', 'gain'], doc: 'DL gain in dB, [-200, 0]. Restored to 0 at teardown.', provenLive: true },
  sib_set: { target: 'enb', required: ['cells'], doc: 'cells.<id>.sib1.cell_barred true|false|"auto". Cleared at teardown.', provenLive: true },
  ncell_list_add: { target: 'enb', required: ['cell_id', 'ncell'], doc: 'ncell: {n_id_cell, dl_earfcn, cell_id (28-bit ECI), tac, plmn}. Deleted at teardown.', provenLive: true },
  ncell_list_del: { target: 'enb', required: ['cell_id', 'n_id_cell'], optional: ['dl_arfcn'], doc: 'Remove a neighbour from a cell ncell_list.' },
  page_ue: { target: 'enb', required: ['type', 'cell_id'], optional: ['cn_domain', 'imsi', 's-tmsi', 'edrx'], doc: 'Page an idle UE. For LTE give cn_domain, imsi, s-tmsi {mmec, m-tmsi}. Wake-up not proven live.' },
  log_get: { target: 'enb', required: [], optional: ['min', 'max', 'timeout', 'allow_empty', 'layers', 'ue_id'], doc: 'Long-poll per connection (the runner owns one).' },
  rrc_ue_info_req: { target: 'enb', required: ['enb_ue_id'], doc: 'UE Information Request.' },
  rrc_ue_cap_enquiry: { target: 'enb', required: [], doc: 'UE capability enquiry.' },
  // ── MME (ltemme) ──
  ue_detach: { target: 'mme', required: ['imsi'], optional: ['type', 'cause', 'local', 'imei'], doc: 'Network-initiated detach / de-registration. Blocked except the safe form (see isSafeDetach) with operator confirmation.' },
  load_balancing_tau: { target: 'mme', required: ['imsi'], optional: ['imei'], doc: 'LTE load-balancing TAU. imei required only with multi_sim.', provenLive: true },
};

/** Never sent: ue_del removes the UE from ue_db; ue_detach's default cause #3 can lock the SIM. */
export const BLOCKED: Record<string, string> = {
  ue_del: 'ue_del deletes the UE from ue_db — never used by Mobility Scenarios',
  ue_detach: 'ue_detach (default cause #3 "illegal UE") can lock the SIM — never used by Mobility Scenarios',
  quit: 'quit terminates the daemon',
  ue_add: 'ue_add changes ue_db',
  ue_set: 'ue_set changes ue_db',
};

/**
 * The one form of ue_detach SimTool will send, and only when the operator has
 * confirmed it for the run (RunRequest.allowNetworkDetach): NAS signalling
 * (not local), no EMM/5GMM cause IE (cause -1, so no cause-specific handling
 * such as #3 "illegal UE" that invalidates the USIM), and a type that asks the
 * UE to come back: EPS detach type 1 "re-attach required" (TS 24.301
 * 9.9.3.7) or 5GS de-registration type 5 = 3GPP access + re-registration
 * required (TS 24.501 9.11.3.20).
 */
export function isSafeDetach(m: Record<string, unknown>): boolean {
  return m.message === 'ue_detach' && Number(m.cause) === -1 && m.local !== true && m.n3gpp !== true
    && [1, 5].includes(Number(m.type)) && typeof m.imsi === 'string';
}

/** The MME message names that exist in ltemme and are the same as eNB ones. */
export const MME_MESSAGES = new Set(['ue_get', 'config_get', 'config_set', 'log_get', 'load_balancing_tau']);

export const GAIN_MIN = -200;
export const GAIN_MAX = 0;
