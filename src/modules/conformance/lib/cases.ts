// The pre-conformance catalogue: 3GPP-procedure checks for NR SA and LTE on an
// Amarisoft callbox.
//
// Honesty rules (see DISCLAIMER in ../types):
//   • Spec references name the PROCEDURE a check follows (TS 38.331 / 36.331
//     RRC, TS 24.501 / 24.301 NAS, TS 38.321 / 36.321 MAC). Section numbers are
//     given only where they are certain; no TS 38.523 / 36.523 test case number
//     is claimed, because these are not those test cases.
//   • RAT support was checked against the Amarisoft 2026-09-11 remote API docs
//     (lteenb §Remote API, ltemme §Remote API); limits are written in `notes`.
//   • SimTool never drives the phone. Anything the UE has to start is an
//     operator step; no answer → INCONCLUSIVE.
//   • Downlink traffic only from the callbox (callbox iperf, UDP), 1 Mbps by
//     default, always stopped by the runner's teardown.
//
// Each builder returns a Mobility Scenario (src/modules/scenarios) the
// existing runner executes; its teardown restores gains, barring, neighbour
// lists, SCells and log levels whatever the outcome.
import type { CellInfo, Condition, LogSeqItem, MobilityScenario, Step } from '@/modules/scenarios/types';
import type { CaseEnv, CaseParam, Rat, SpecRef, TestCaseDef, TestCaseInfo } from '../types';
import { NAS, RRC, logLevels, nasItem, rrcItem } from './signalling';

// ─── Spec references (procedure specs; sections only where certain) ────────
const S = {
  nrRrcEstablish: { spec: 'TS 38.331', section: '5.3.3', title: 'RRC connection establishment', basis: 'procedure' },
  nrRrcReconf: { spec: 'TS 38.331', section: '5.3.5', title: 'RRC reconfiguration', basis: 'procedure' },
  nrRrcReest: { spec: 'TS 38.331', section: '5.3.7', title: 'RRC connection re-establishment', basis: 'procedure' },
  nrRrcRelease: { spec: 'TS 38.331', section: '5.3.8', title: 'RRC release', basis: 'procedure' },
  nrPagingRrc: { spec: 'TS 38.331', section: '5.3.2', title: 'Paging', basis: 'procedure' },
  nrSi: { spec: 'TS 38.331', section: '5.2.2', title: 'System information acquisition', basis: 'procedure' },
  nrA3: { spec: 'TS 38.331', section: '5.5.4.4', title: 'Event A3 (neighbour becomes offset better than SpCell)', basis: 'procedure' },
  nrIdle: { spec: 'TS 38.304', title: 'UE procedures in idle mode — cell status and cell reservations (barring)', basis: 'procedure' },
  nrMacScell: { spec: 'TS 38.321', section: '5.9', title: 'Activation/Deactivation of SCells', basis: 'procedure' },
  nrReg: { spec: 'TS 24.501', section: '5.5.1.2', title: 'Registration procedure for initial registration', basis: 'procedure' },
  nrMru: { spec: 'TS 24.501', section: '5.5.1.3', title: 'Registration procedure for mobility and periodic registration update', basis: 'procedure' },
  nrDeregUe: { spec: 'TS 24.501', section: '5.5.2.2', title: 'UE-initiated de-registration procedure', basis: 'procedure' },
  nrDeregNw: { spec: 'TS 24.501', section: '5.5.2.3', title: 'Network-initiated de-registration procedure', basis: 'procedure' },
  nrService: { spec: 'TS 24.501', section: '5.6.1', title: 'Service request procedure', basis: 'procedure' },
  nrPagingNas: { spec: 'TS 24.501', section: '5.6.2', title: 'Paging procedure', basis: 'procedure' },
  nrPdu: { spec: 'TS 24.501', section: '6.4.1', title: 'UE-requested PDU session establishment procedure', basis: 'procedure' },

  lteRrcEstablish: { spec: 'TS 36.331', section: '5.3.3', title: 'RRC connection establishment', basis: 'procedure' },
  lteRrcReconf: { spec: 'TS 36.331', section: '5.3.5', title: 'RRC connection reconfiguration', basis: 'procedure' },
  lteRrcHo: { spec: 'TS 36.331', section: '5.3.5.4', title: 'Reception of an RRCConnectionReconfiguration including mobilityControlInfo (handover)', basis: 'procedure' },
  lteRrcReest: { spec: 'TS 36.331', section: '5.3.7', title: 'RRC connection re-establishment', basis: 'procedure' },
  lteRrcRelease: { spec: 'TS 36.331', section: '5.3.8', title: 'RRC connection release', basis: 'procedure' },
  ltePagingRrc: { spec: 'TS 36.331', section: '5.3.2', title: 'Paging', basis: 'procedure' },
  lteSi: { spec: 'TS 36.331', section: '5.2', title: 'System information', basis: 'procedure' },
  lteA3: { spec: 'TS 36.331', section: '5.5.4.4', title: 'Event A3 (neighbour becomes offset better than PCell/PSCell)', basis: 'procedure' },
  lteIdle: { spec: 'TS 36.304', title: 'UE procedures in idle mode — cell status and cell reservations (barring)', basis: 'procedure' },
  lteMacScell: { spec: 'TS 36.321', section: '5.13', title: 'Activation/Deactivation of SCells', basis: 'procedure' },
  lteAttach: { spec: 'TS 24.301', section: '5.5.1.2', title: 'Attach procedure for EPS services', basis: 'procedure' },
  lteTau: { spec: 'TS 24.301', section: '5.5.3.2', title: 'Normal and periodic tracking area updating procedure', basis: 'procedure' },
  lteDetachUe: { spec: 'TS 24.301', section: '5.5.2.2', title: 'UE initiated detach procedure', basis: 'procedure' },
  lteDetachNw: { spec: 'TS 24.301', section: '5.5.2.3', title: 'Network initiated detach procedure', basis: 'procedure' },
  lteService: { spec: 'TS 24.301', section: '5.6.1', title: 'Service request procedure', basis: 'procedure' },
  ltePagingNas: { spec: 'TS 24.301', section: '5.6.2', title: 'Paging procedure', basis: 'procedure' },
  ltePdn: { spec: 'TS 24.301', section: '6.5.1', title: 'UE requested PDN connectivity procedure (default bearer)', basis: 'procedure' },
} satisfies Record<string, SpecRef>;

// ─── Shared params ──────────────────────────────────────────────────────────
const P = {
  connectTimeoutMs: { key: 'connectTimeoutMs', label: 'Connect timeout', default: 30000, min: 1000, help: 'Longest wait for the UE to be RRC connected before the stimulus.' },
  operatorTimeoutMs: { key: 'operatorTimeoutMs', label: 'Operator timeout', default: 180000, min: 10000, help: 'How long an operator prompt waits for Continue before the case is INCONCLUSIVE.' },
  signallingTimeoutMs: { key: 'signallingTimeoutMs', label: 'Signalling timeout', default: 5000, min: 1000, help: 'Longest wait for the expected messages after the stimulus.' },
  holdMs: { key: 'holdMs', label: 'Hold', default: 1000, min: 0, help: 'How long the end state must stay stable.' },
  dlMbps: { key: 'dlMbps', label: 'DL traffic (Mbps)', default: 1, min: 0.1, max: 200, help: 'Callbox downlink UDP rate used to page or keep the UE connected (needs the system SSH login).' },
} satisfies Record<string, CaseParam>;

const num = (env: CaseEnv, key: string, dflt: number) => {
  const v = Number(env.params[key]);
  return Number.isFinite(v) ? v : dflt;
};

// ─── Cell helpers ───────────────────────────────────────────────────────────
const freqOf = (c: CellInfo) => (c.rat === 'nr' ? c.ssb ?? c.earfcn : c.earfcn);
const ratCells = (env: CaseEnv) => env.cells.filter(c => c.rat === env.rat);
const describeCells = (cells: CellInfo[]) =>
  cells.map(c => `cell ${c.id} (PCI ${c.pci}, ${c.rat === 'nr' ? `SSB ${c.ssb}` : `EARFCN ${c.earfcn}`}, TAC ${c.tac ?? '?'})`).join(', ');

/** For every cell, a partner picked by `pick`; cells without one are left out. */
function partnerMap(cells: CellInfo[], pick: (c: CellInfo, others: CellInfo[]) => CellInfo | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cells) {
    const p = pick(c, cells.filter(o => o.id !== c.id));
    if (p) out[String(c.id)] = p.id;
  }
  return out;
}
const intraMap = (cells: CellInfo[]) => partnerMap(cells, (c, o) => o.find(x => freqOf(x) === freqOf(c)));
const interMap = (cells: CellInfo[]) => partnerMap(cells, (c, o) => {
  const diff = o.filter(x => freqOf(x) !== freqOf(c));
  // A cell that is not already the UE's SCell reads more like a real inter-frequency move.
  return diff.find(x => !c.scells.includes(x.id)) ?? diff[0];
});
const anyMap = (cells: CellInfo[]) => partnerMap(cells, (c, o) => o.find(x => !c.scells.includes(x.id)) ?? o[0]);
const tacMap = (cells: CellInfo[]) => partnerMap(cells, (c, o) => o.find(x => x.tac !== undefined && c.tac !== undefined && x.tac !== c.tac));

// ─── Step helpers ───────────────────────────────────────────────────────────
const eq = (path: string, value: unknown): Condition => ({ path, op: 'eq', value });
const all = (...c: Condition[]): Condition => ({ all: c });

/** UE registered; optionally RRC connected (paged back with 1 Mbps DL if it is idle). */
function prelude(env: CaseEnv, o: { connected: boolean; keepAlive?: boolean; capture?: Record<string, string> }): Step[] {
  const steps: Step[] = [{
    type: 'assert', label: 'UE registered in the core', source: 'mme',
    expect: eq('mme.registered', true), timeoutMs: 10000,
    onFail: 'inconclusive', inconclusiveReason: 'The UE is not registered — register it first (e.g. run the initial registration case)',
  }];
  if (!o.connected) return steps;
  if (env.hasSsh) {
    steps.push({
      type: 'traffic', op: 'start', generator: 'callbox', direction: 'dl', protocol: 'udp', ref: o.keepAlive ? 'keep' : 'wake',
      bitrateMbps: '${params.dlMbps}', durationSec: o.keepAlive ? 600 : 30, optional: true,
      label: o.keepAlive ? 'DL ${params.dlMbps} Mbps from the callbox for the whole case' : 'wake the UE: DL ${params.dlMbps} Mbps from the callbox',
      ...(o.keepAlive ? {} : { when: eq('ue.connected', false) }),
    });
  }
  steps.push({
    type: 'assert', label: 'UE in RRC connected, one context',
    expect: all(eq('ue.connected', true), eq('ue.contexts', 1)), timeoutMs: '${params.connectTimeoutMs}',
    onFail: 'inconclusive',
    inconclusiveReason: env.hasSsh ? 'The UE did not reach RRC connected' : 'The UE did not reach RRC connected — generate data on the device, or add an SSH login to the system so the callbox can page it',
    capture: o.capture,
  });
  if (env.hasSsh && !o.keepAlive) steps.push({ type: 'traffic', op: 'stop', ref: 'wake', label: 'stop the wake-up traffic' });
  return steps;
}

const seq = (items: LogSeqItem[], o: { label: string; since: string; timeoutMs?: string | number; metrics?: { name: string; from: number; to: number }[]; optional?: boolean; saveAs?: string; onFail?: 'inconclusive'; reason?: string; withinMs?: string | number; when?: Condition }): Step => ({
  type: 'assert', source: 'sequence', label: o.label,
  sequence: { items, since: o.since, ...(o.metrics ? { metrics: o.metrics } : {}), ...(o.withinMs !== undefined ? { withinMs: o.withinMs } : {}) },
  timeoutMs: o.timeoutMs ?? '${params.signallingTimeoutMs}',
  ...(o.optional ? { optional: true } : {}), ...(o.saveAs ? { saveAs: o.saveAs } : {}),
  ...(o.onFail ? { onFail: o.onFail, inconclusiveReason: o.reason } : {}),
  ...(o.when ? { when: o.when } : {}),
});

const handoverMsg = (rat: Rat, tgt: string) => rat === 'nr'
  ? { message: 'handover', ran_ue_id: '${ue.ran_ue_id}', pci: `\${cellById[${tgt}].pci}`, ssb_nr_arfcn: `\${cellById[${tgt}].ssb}` }
  : { message: 'handover', ran_ue_id: '${ue.ran_ue_id}', pci: `\${cellById[${tgt}].pci}`, dl_earfcn: `\${cellById[${tgt}].earfcn}` };

const hoSeq = (rat: Rat, metric?: string) => seq([
  rrcItem(RRC[rat].reconf, rat === 'nr' ? 'RRCReconfiguration with reconfigurationWithSync' : 'RRCConnectionReconfiguration with mobilityControlInfo', { contains: RRC[rat].mobility }),
  rrcItem(RRC[rat].reconfCpl, rat === 'nr' ? 'RRCReconfigurationComplete' : 'RRCConnectionReconfigurationComplete'),
], { label: 'handover signalling: reconfiguration with mobility → complete', since: 'ho', metrics: metric ? [{ name: metric, from: 0, to: 1 }] : undefined });

function scenario(id: string, name: string, env: CaseEnv, o: {
  description: string; minCells?: number; needsHoConfig?: boolean; needsCa?: boolean; params?: Record<string, unknown>; steps: Step[]; maxMin?: number;
}): MobilityScenario {
  return {
    id: `pc-${id.toLowerCase()}`.replace(/[^a-z0-9-]/g, '-').slice(0, 64),
    name: `Pre-conformance ${id}: ${name}`,
    description: o.description,
    schemaVersion: 1,
    tags: ['pre-conformance', env.rat],
    requirements: { minCells: o.minCells ?? 1, needsHoConfig: !!o.needsHoConfig, needsCa: !!o.needsCa },
    // Shared defaults first, so a helper step never meets an undefined ${params.*}.
    params: { connectTimeoutMs: 30000, signallingTimeoutMs: 5000, holdMs: 1000, dlMbps: 1, ...env.params, ...(o.params ?? {}) },
    logs: logLevels(env.rat),
    maxDurationMs: (o.maxMin ?? 10) * 60_000,
    steps: o.steps,
  };
}

const minCellsCheck = (env: CaseEnv, n: number) => {
  const cells = ratCells(env);
  return cells.length >= n ? null : `The running config has ${cells.length} ${env.rat === 'nr' ? 'NR' : 'LTE'} cell(s); this case needs at least ${n}.`;
};

// ─── The catalogue ──────────────────────────────────────────────────────────
export const CASES: TestCaseDef[] = [
  // ── Registration & session ────────────────────────────────────────────────
  {
    id: 'PC-REG-01', title: 'Initial registration / attach', rat: 'both', category: 'Registration & session', automation: 'operator-prompted',
    summary: 'The operator powers the device on; SimTool checks the full NAS registration (NR) or attach (LTE) sequence and that the UE ends up registered with an IP address.',
    specs: { nr: [S.nrReg, S.nrPdu, S.nrRrcEstablish], lte: [S.lteAttach, S.ltePdn, S.lteRrcEstablish] },
    notes: ['Authentication is optional in the expected sequence: the core may skip it for a UE with a valid security context.', 'SimTool never switches the phone; the operator does, when prompted.'],
    preconditions: ['The UE’s IMSI is provisioned in the core (ue_db).', 'At least one cell is up and not barred.'],
    procedure: [
      'Operator: switch the device to airplane mode (or power it off), then Continue.',
      'Operator: switch airplane mode off (or power the device on), then Continue.',
      'SimTool watches the core’s NAS log from the moment the second prompt appeared.',
    ],
    passCriteria: [
      'NR: Registration request → [Authentication request/response] → Security mode command/complete → Registration accept → Registration complete, then PDU session establishment request → accept.',
      'LTE: Attach request → [Authentication request/response] → Security mode command/complete → Attach accept → Attach complete.',
      'Within the registration timeout, the core shows the UE registered with an IPv4 address.',
    ],
    inconclusiveWhen: ['The operator does not answer a prompt in time, or skips it.'],
    params: [P.operatorTimeoutMs, { key: 'registrationTimeoutMs', label: 'Registration timeout', default: 60000, min: 5000, help: 'Longest wait for the complete registration after the device is switched on.' }],
    defaultInPlans: true,
    precheck: env => minCellsCheck(env, 1),
    build: env => {
      const n = NAS[env.rat];
      const items: LogSeqItem[] = [
        nasItem(n.regReq, env.rat === 'nr' ? 'Registration request' : 'Attach request'),
        nasItem(n.authReq, 'Authentication request', { optional: true }),
        nasItem(n.authResp, 'Authentication response', { optional: true }),
        nasItem(n.smc, 'Security mode command'),
        nasItem(n.smcCpl, 'Security mode complete'),
        nasItem(n.regAccept, env.rat === 'nr' ? 'Registration accept' : 'Attach accept'),
        nasItem(n.regCpl, env.rat === 'nr' ? 'Registration complete' : 'Attach complete'),
      ];
      const steps: Step[] = [
        { type: 'operator', label: 'device off', prompt: 'Switch the device to airplane mode ON (or power it off), then click Continue.', detail: 'SimTool does not control the phone. The UE has to start deregistered so the whole registration can be observed.', timeoutMs: '${params.operatorTimeoutMs}' },
        { type: 'assert', label: 'UE deregistered in the core (not required: some devices leave without a detach)', source: 'mme', expect: { any: [eq('mme.registered', false), { path: 'mme.imsi', op: 'absent' }] }, timeoutMs: 15000, optional: true },
        { type: 'operator', label: 'device on', mark: 'on', prompt: 'Switch airplane mode OFF (or power the device on) now, then click Continue.', detail: 'SimTool is watching the core for the registration from the moment this prompt appeared.', continueLabel: 'Done — device is on', timeoutMs: '${params.operatorTimeoutMs}' },
        seq(items, { label: env.rat === 'nr' ? 'NAS: registration sequence' : 'NAS: attach sequence', since: 'on', timeoutMs: '${params.registrationTimeoutMs}', metrics: [{ name: 'registration_ms', from: 0, to: items.length - 1 }] }),
      ];
      if (env.rat === 'nr') {
        steps.push(seq([nasItem(n.sessReq!, 'PDU session establishment request'), nasItem(n.sessAccept!, 'PDU session establishment accept')], { label: '5GSM: PDU session established', since: 'on', timeoutMs: '${params.registrationTimeoutMs}' }));
      }
      steps.push({ type: 'assert', label: 'registered with an IPv4 address', source: 'mme', expect: all(eq('mme.registered', true), { path: 'ue.ip', op: 'match', value: '^\\d+\\.\\d+\\.\\d+\\.\\d+$' }), timeoutMs: 30000 });
      return scenario('REG-01', 'Initial registration', env, { description: 'Operator-prompted initial registration / attach, verified in the core NAS log.', steps, maxMin: 15 });
    },
  },
  {
    id: 'PC-REG-02', title: 'PDU session / default bearer with IP', rat: 'both', category: 'Registration & session', automation: 'automatic',
    summary: 'The registered UE has an established PDU session (NR) or default EPS bearer (LTE) with an IPv4 address in the core’s ue_get.',
    specs: { nr: [S.nrPdu], lte: [S.ltePdn, S.lteAttach] },
    notes: ['State check on the core’s ue_get (bearers[].pdu_session_id / erab_id and ip); it does not replay the establishment signalling — PC-REG-01 does.'],
    preconditions: ['The UE is registered.'],
    procedure: ['Read the UE from the core (ue_get by IMSI).'],
    passCriteria: ['registered is true.', 'A bearer with an IPv4 address exists; NR: it carries a pdu_session_id; LTE: an erab_id.'],
    inconclusiveWhen: ['The UE is not registered at all (run PC-REG-01 first).'],
    params: [],
    defaultInPlans: true,
    precheck: () => null,
    build: env => scenario('REG-02', 'PDU session / default bearer', env, {
      description: 'Core ue_get: registered UE with a PDU session / default bearer and an IPv4 address.',
      steps: [
        ...prelude(env, { connected: false }),
        {
          type: 'assert', label: env.rat === 'nr' ? 'PDU session with IPv4 address' : 'default EPS bearer with IPv4 address', source: 'mme',
          expect: all(
            { path: 'ue.ip', op: 'match', value: '^\\d+\\.\\d+\\.\\d+\\.\\d+$' },
            { path: env.rat === 'nr' ? 'mme.bearers[0].pdu_session_id' : 'mme.bearers[0].erab_id', op: 'exists' },
          ),
          timeoutMs: 10000,
        },
      ],
    }),
  },
  {
    id: 'PC-REG-03', title: 'Network-initiated deregistration / detach', rat: 'both', category: 'Registration & session', automation: 'automatic',
    summary: 'The core detaches the UE with “re-attach / re-registration required” and no cause IE; the UE must accept and register again.',
    specs: { nr: [S.nrDeregNw, S.nrReg], lte: [S.lteDetachNw, S.lteAttach] },
    notes: [
      'Uses ltemme ue_detach with cause -1 (no EMM/5GMM cause IE is sent) and type 1 (EPS: re-attach required) / 5 (5GS: 3GPP access, re-registration required). The default cause #3 “illegal UE” can invalidate the USIM until the device is power-cycled, so SimTool never sends it.',
      'Excluded from default plans; a plan only runs it after the operator confirms it on the Run tab, and the run asks once more before the detach.',
    ],
    preconditions: ['The UE is registered.', 'The operator confirmed network detach for this run.'],
    procedure: ['Operator confirms.', 'ue_detach {imsi, type, cause: -1}.', 'Watch the NAS log for the detach and the re-registration.'],
    passCriteria: [
      'DL Detach request / Deregistration request (UE terminated) → UL Detach accept / Deregistration accept.',
      'Then the UE registers again (Attach / Registration request → complete) and is registered in the core.',
    ],
    inconclusiveWhen: ['Not confirmed by the operator.', 'The core refused the detach request.'],
    params: [P.operatorTimeoutMs, { key: 'reattachTimeoutMs', label: 'Re-registration timeout', default: 60000, min: 5000, help: 'Longest wait for the UE to register again.' }],
    risky: { confirm: 'SimTool will send ue_detach for this IMSI: no cause IE (cause -1), type “re-attach required” (LTE, 1) / “re-registration required, 3GPP” (NR, 5). No SIM-invalidating cause is sent, but some devices still need a manual re-registration afterwards.' },
    defaultInPlans: false,
    precheck: () => null,
    build: env => {
      const n = NAS[env.rat];
      return scenario('REG-03', 'Network-initiated detach', env, {
        description: 'Safe network-initiated detach (no cause IE, re-attach required) and re-registration.',
        maxMin: 10,
        steps: [
          ...prelude(env, { connected: false }),
          { type: 'operator', label: 'confirm the detach', prompt: 'The network will now detach / deregister this UE (no cause IE, re-attach required). Click Continue to send it.', continueLabel: 'Send the detach', timeoutMs: '${params.operatorTimeoutMs}' },
          {
            type: 'action', target: 'mme', label: 'ue_detach (cause -1, re-attach required)', mark: 'det',
            message: { message: 'ue_detach', imsi: '${ue.imsi}', type: env.rat === 'nr' ? 5 : 1, cause: -1 },
            onFail: 'inconclusive', inconclusiveReason: 'The core refused the detach request',
          },
          seq([nasItem(n.detachNw, env.rat === 'nr' ? 'Deregistration request (UE terminated)' : 'Detach request (network)'), nasItem(n.detachAccept, env.rat === 'nr' ? 'Deregistration accept' : 'Detach accept')], { label: 'NAS: network detach accepted', since: 'det', timeoutMs: 15000 }),
          seq([nasItem(n.regReq, env.rat === 'nr' ? 'Registration request' : 'Attach request'), nasItem(n.regCpl, env.rat === 'nr' ? 'Registration complete' : 'Attach complete')], { label: 'NAS: UE registers again', since: 'det', timeoutMs: '${params.reattachTimeoutMs}', metrics: [{ name: 'reregistration_ms', from: -1, to: 1 }] }),
          { type: 'assert', label: 'registered again', source: 'mme', expect: eq('mme.registered', true), timeoutMs: 30000 },
        ],
      });
    },
  },
  {
    id: 'PC-REG-04', title: 'UE-initiated deregistration / detach', rat: 'both', category: 'Registration & session', automation: 'operator-prompted',
    summary: 'The operator switches the device off (airplane mode); the UE must send a Detach / Deregistration request before leaving.',
    specs: { nr: [S.nrDeregUe], lte: [S.lteDetachUe] },
    notes: ['Some devices implement airplane mode without a detach; if the check fails, repeat with a real power-off before concluding.'],
    preconditions: ['The UE is registered.'],
    procedure: ['Operator: airplane mode ON (or power off), Continue.', 'Watch the NAS log.', 'Operator: airplane mode OFF again so later cases have a UE (not part of the verdict).'],
    passCriteria: ['UL Detach request (LTE) / Deregistration request, UE originating (NR) within the timeout.', 'The core shows the UE deregistered (recorded, not required: the UE may re-register at once).'],
    inconclusiveWhen: ['The operator does not answer the first prompt in time, or skips it.'],
    params: [P.operatorTimeoutMs, { key: 'detachTimeoutMs', label: 'Detach timeout', default: 30000, min: 1000, help: 'Longest wait for the detach after the prompt.' }],
    defaultInPlans: true,
    precheck: () => null,
    build: env => {
      const n = NAS[env.rat];
      return scenario('REG-04', 'UE-initiated detach', env, {
        description: 'Operator-prompted UE detach / deregistration, verified in the core NAS log.',
        maxMin: 15,
        steps: [
          ...prelude(env, { connected: false }),
          { type: 'operator', label: 'device off', mark: 'off', prompt: 'Switch the device to airplane mode ON (or power it off) now, then click Continue.', continueLabel: 'Done — device is off', timeoutMs: '${params.operatorTimeoutMs}' },
          seq([nasItem(n.detachUe, env.rat === 'nr' ? 'Deregistration request (UE originating)' : 'Detach request (UE)')], { label: 'NAS: UE detach / deregistration request', since: 'off', timeoutMs: '${params.detachTimeoutMs}' }),
          { type: 'assert', label: 'deregistered in the core', source: 'mme', expect: { any: [eq('mme.registered', false), { path: 'mme.imsi', op: 'absent' }] }, timeoutMs: 10000, optional: true },
          { type: 'operator', label: 'device back on (restore)', prompt: 'Switch airplane mode OFF (power the device on) again so the next cases have a UE, then click Continue.', timeoutMs: '${params.operatorTimeoutMs}', optional: true },
          { type: 'assert', label: 'registered again (restore, not part of the verdict)', source: 'mme', expect: eq('mme.registered', true), timeoutMs: 60000, optional: true },
        ],
      });
    },
  },

  // ── RRC ───────────────────────────────────────────────────────────────────
  {
    id: 'PC-RRC-01', title: 'RRC connection release by the network', rat: 'both', category: 'RRC', automation: 'automatic',
    summary: 'The network releases the RRC connection; the UE leaves RRC connected (its RAN context is gone) and stays registered.',
    specs: { nr: [S.nrRrcRelease], lte: [S.lteRrcRelease] },
    preconditions: ['The UE is registered and can be brought to RRC connected.'],
    procedure: ['Bring the UE to RRC connected (1 Mbps DL from the callbox if it is idle and SSH is available).', 'rrc_cnx_release.'],
    passCriteria: ['DL RRC release in the RAN log.', 'The UE’s RAN context disappears (eNB/gNB ue_get no longer lists it, or lists a new context after it reconnected).', 'The UE stays registered in the core.'],
    inconclusiveWhen: ['The UE cannot be brought to RRC connected.', 'The callbox rejects the release request.'],
    params: [P.connectTimeoutMs, P.signallingTimeoutMs, P.dlMbps],
    defaultInPlans: true,
    precheck: () => null,
    build: env => scenario('RRC-01', 'RRC release', env, {
      description: 'Network RRC release; UE context leaves the RAN, registration kept.',
      steps: [
        ...prelude(env, { connected: true, capture: { oldId: 'ue.ran_ue_id' } }),
        { type: 'action', target: 'enb', label: 'rrc_cnx_release', mark: 'rel', message: { message: 'rrc_cnx_release', ran_ue_id: '${ue.ran_ue_id}' }, onFail: 'inconclusive', inconclusiveReason: 'The callbox rejected the RRC release request' },
        seq([rrcItem(RRC[env.rat].release, env.rat === 'nr' ? 'RRCRelease' : 'RRCConnectionRelease')], { label: 'RRC release sent', since: 'rel' }),
        { type: 'assert', label: 'UE context released on the RAN', expect: { any: [eq('ue.connected', false), { path: 'ue.ran_ue_id', op: 'ne', value: '${vars.oldId}' }] }, timeoutMs: 5000, pollMs: 100, metric: { name: 'release_ms', since: 'rel' } },
        { type: 'assert', label: 'still registered in the core', source: 'mme', expect: eq('mme.registered', true), timeoutMs: 3000 },
      ],
    }),
  },
  {
    id: 'PC-RRC-02', title: 'RRC re-establishment after radio link failure', rat: 'both', category: 'Robustness', automation: 'automatic',
    summary: 'The serving cell’s downlink is cut (cell_gain −200 dB); the UE must recover on another cell with RRC re-establishment.',
    specs: { nr: [S.nrRrcReest], lte: [S.lteRrcReest] },
    notes: ['If the UE recovers with a fresh RRC setup instead, the case is INCONCLUSIVE: that is allowed (e.g. no context on the target, T311 expiry) and does not show a UE fault, but re-establishment was not exercised.'],
    preconditions: ['At least 2 cells of the RAT.', 'The UE can be brought to RRC connected.'],
    procedure: ['UE connected on cell X.', 'cell_gain X → −200 dB (radio link failure).', 'Wait for the UE on another cell; look for re-establishment in the RAN log.', 'Gain restored (always, also on teardown).'],
    passCriteria: ['The UE is RRC connected on another cell within the recovery timeout.', 'RRC re-establishment request → re-establishment → re-establishment complete in the RAN log.'],
    inconclusiveWhen: ['The UE recovered with a new RRC setup instead of re-establishment.', 'The UE cannot be brought to RRC connected first.'],
    params: [P.connectTimeoutMs, { key: 'recoveryTimeoutMs', label: 'Recovery timeout', default: 15000, min: 2000, help: 'Longest wait for the UE on another cell after the failure.' }, P.dlMbps],
    defaultInPlans: true,
    precheck: env => minCellsCheck(env, 2),
    build: env => {
      const r = RRC[env.rat];
      return scenario('RRC-02', 'RLF re-establishment', env, {
        description: 'Radio link failure by cell gain, recovery by RRC re-establishment.',
        minCells: 2,
        steps: [
          ...prelude(env, { connected: true, keepAlive: true, capture: { src: 'ue.pcell' } }),
          { type: 'action', target: 'enb', label: 'cell ${vars.src} gain → -200 dB (radio link failure)', mark: 'rlf', message: { message: 'cell_gain', cell_id: '${vars.src}', gain: -200 }, onFail: 'inconclusive', inconclusiveReason: 'The callbox rejected cell_gain' },
          { type: 'assert', label: 'UE recovered on another cell', expect: all(eq('ue.connected', true), { path: 'ue.pcell', op: 'ne', value: '${vars.src}' }), timeoutMs: '${params.recoveryTimeoutMs}', pollMs: 100, metric: { name: 'recovery_ms', since: 'rlf' } },
          seq([rrcItem(r.reestReq, 'Re-establishment request'), rrcItem(r.reest, 'Re-establishment'), rrcItem(r.reestCpl, 'Re-establishment complete')], { label: 'RRC re-establishment sequence', since: 'rlf', timeoutMs: 4000, optional: true, saveAs: 'reest' }),
          seq([rrcItem(r.setupReq, 'RRC setup request (fresh connection)')], { label: 'fresh RRC setup instead?', since: 'rlf', timeoutMs: 1000, optional: true, saveAs: 'setup', when: { path: 'reply.reest.matched', op: 'falsy' } }),
          {
            type: 'assert', label: 'recovery used re-establishment, not a fresh setup', source: 'reply', expect: { path: 'reply.reest.matched', op: 'truthy' }, timeoutMs: 0,
            when: { path: 'reply.setup.matched', op: 'truthy' },
            onFail: 'inconclusive', inconclusiveReason: 'The UE recovered with a fresh RRC setup instead of RRC re-establishment. That is allowed (e.g. the target cell had no UE context or T311 expired), so it is not a UE fault, but the re-establishment procedure was not exercised',
          },
          { type: 'assert', label: 'RRC re-establishment observed', source: 'reply', expect: { path: 'reply.reest.matched', op: 'truthy' }, timeoutMs: 0 },
          { type: 'action', target: 'enb', label: 'cell ${vars.src} gain → 0 dB', message: { message: 'cell_gain', cell_id: '${vars.src}', gain: 0 } },
        ],
      });
    },
  },

  // ── Mobility ──────────────────────────────────────────────────────────────
  {
    id: 'PC-MOB-01', title: 'Intra-frequency handover', rat: 'both', category: 'Mobility', automation: 'automatic',
    summary: 'Network-triggered handover to a cell on the same carrier (different PCI).',
    specs: { nr: [S.nrRrcReconf], lte: [S.lteRrcHo] },
    notes: ['Needs two cells on the same frequency. The common 6-cell configs put every cell on its own carrier, so there this case is INCONCLUSIVE (precondition not met) by design.'],
    preconditions: ['Two cells of the RAT share a frequency (LTE: DL EARFCN, NR: SSB NR-ARFCN).', 'The UE can be brought to RRC connected on one of them.'],
    procedure: ['UE connected on cell X.', 'handover to the same-frequency cell Y (added to X’s ncell_list for the run if missing).'],
    passCriteria: ['DL reconfiguration with mobility (NR reconfigurationWithSync / LTE mobilityControlInfo) → UL reconfiguration complete.', 'PCell = Y with one UE context, stable for the hold time.', 'The UE stays registered.'],
    inconclusiveWhen: ['No two cells share a frequency, or the UE’s cell has no same-frequency partner.', 'The callbox refuses the handover request.'],
    params: [P.connectTimeoutMs, P.signallingTimeoutMs, P.holdMs, P.dlMbps],
    defaultInPlans: true,
    precheck: env => {
      const cells = ratCells(env);
      if (cells.length < 2) return minCellsCheck(env, 2);
      return Object.keys(intraMap(cells)).length ? null
        : `No two ${env.rat === 'nr' ? 'NR' : 'LTE'} cells share a frequency in the running config (${describeCells(cells)}). Intra-frequency handover needs ≥2 cells on one carrier with different PCIs.`;
    },
    build: env => mobilityCase('MOB-01', 'Intra-frequency handover', env, intraMap(ratCells(env)), 'intra-frequency'),
  },
  {
    id: 'PC-MOB-02', title: 'Inter-frequency handover (network-triggered)', rat: 'both', category: 'Mobility', automation: 'automatic',
    summary: 'Network-triggered handover to a cell on another carrier; checks the RRC signalling, the PCell change, a single UE context and the RRC-level interruption.',
    specs: { nr: [S.nrRrcReconf], lte: [S.lteRrcHo] },
    notes: ['Triggered by the remote API (handover), not by a measurement — PC-MOB-03 covers measurement-triggered handover.'],
    preconditions: ['At least 2 cells of the RAT on different frequencies.', 'The UE can be brought to RRC connected.'],
    procedure: ['UE connected on cell X.', 'handover to cell Y on another frequency (added to X’s ncell_list for the run if missing).'],
    passCriteria: ['DL reconfiguration with mobility → UL reconfiguration complete.', 'PCell = Y with one UE context, stable for the hold time.', 'ho_rrc_ms (DL reconfiguration → UL complete, callbox log timestamps) recorded.'],
    inconclusiveWhen: ['The UE’s cell has no partner on another frequency.', 'The callbox refuses the handover request.'],
    params: [P.connectTimeoutMs, P.signallingTimeoutMs, P.holdMs, P.dlMbps],
    defaultInPlans: true,
    precheck: env => {
      const cells = ratCells(env);
      if (cells.length < 2) return minCellsCheck(env, 2);
      return Object.keys(interMap(cells)).length ? null : `All ${env.rat === 'nr' ? 'NR' : 'LTE'} cells are on one frequency (${describeCells(cells)}).`;
    },
    build: env => mobilityCase('MOB-02', 'Inter-frequency handover', env, interMap(ratCells(env)), 'inter-frequency'),
  },
  {
    id: 'PC-MOB-03', title: 'Measurement-triggered handover (A3)', rat: 'both', category: 'Mobility', automation: 'automatic',
    summary: 'The serving cell is faded (gain ramp) until the UE reports a better neighbour; the gNB/eNB hands it over on that measurement report.',
    specs: { nr: [S.nrA3, S.nrRrcReconf], lte: [S.lteA3, S.lteRrcHo] },
    notes: ['Needs the running config to hand over on measurements (meas_config_desc with an A3 event and ho_from_meas: config_get connected_mobility).', 'The event type is set by the config; the check verifies Measurement report → handover, not the A3 parameters themselves.'],
    preconditions: ['ho_from_meas + meas_config_desc on at least 2 cells.', 'The serving cell has a neighbour in its ncell_list.'],
    procedure: ['UE connected on cell X (1 Mbps DL keeps it connected when SSH is available).', 'Ramp X’s gain down in steps until the PCell changes.', 'Gains restored (always, also on teardown).'],
    passCriteria: ['UL Measurement report → DL reconfiguration with mobility → UL reconfiguration complete.', 'PCell changed, one UE context, stable for the hold time.'],
    inconclusiveWhen: ['The running config does not hand over on measurements.'],
    params: [P.connectTimeoutMs, P.signallingTimeoutMs, { key: 'stepDb', label: 'Gain step', default: 2, min: 0.5, max: 20, help: 'Gain reduction per tick.' }, { key: 'dwellMs', label: 'Dwell per step', default: 1000, min: 100, help: 'Time at each gain step (A3 time-to-trigger must fit in it a few times).' }, { key: 'floorDb', label: 'Gain floor', default: -40, min: -200, max: 0, help: 'Lowest gain the serving cell is faded to.' }, P.holdMs, P.dlMbps],
    defaultInPlans: true,
    precheck: env => {
      const cells = ratCells(env);
      if (cells.length < 2) return minCellsCheck(env, 2);
      const ho = cells.filter(c => c.hoFromMeas);
      return ho.length >= 2 ? null : 'The running config does not hand over on measurements (no ho_from_meas / meas_config_desc in config_get). Deploy a config with “Handover from measurements”, e.g. testDemo-6cell-2x3CC-HO.cfg.';
    },
    build: env => {
      const r = RRC[env.rat];
      return scenario('MOB-03', 'A3 handover', env, {
        description: 'Gain ramp on the serving cell until a measurement-triggered handover.',
        minCells: 2, needsHoConfig: true,
        steps: [
          ...prelude(env, { connected: true, keepAlive: true, capture: { src: 'ue.pcell' } }),
          { type: 'ramp', label: 'fade cell ${vars.src} until the UE moves', mark: 'ho', cells: [{ cell: '${vars.src}', from: 0, to: '${params.floorDb}' }], stepDb: '${params.stepDb}', dwellMs: '${params.dwellMs}', stopWhen: all(eq('ue.connected', true), { path: 'ue.pcell', op: 'ne', value: '${vars.src}' }), requireStop: true, metric: { name: 'fade_to_ho_ms' } },
          seq([
            rrcItem(r.measReport, 'Measurement report'),
            rrcItem(r.reconf, 'reconfiguration with mobility', { contains: r.mobility }),
            rrcItem(r.reconfCpl, 'reconfiguration complete'),
          ], { label: 'Measurement report → handover', since: 'ho', timeoutMs: '${params.signallingTimeoutMs}', metrics: [{ name: 'report_to_complete_ms', from: 0, to: 2 }] }),
          { type: 'assert', label: 'PCell changed, one context', expect: all(eq('ue.connected', true), eq('ue.contexts', 1), { path: 'ue.pcell', op: 'ne', value: '${vars.src}' }), timeoutMs: 5000, holdMs: '${params.holdMs}' },
          { type: 'action', target: 'enb', label: 'cell ${vars.src} gain → 0 dB', message: { message: 'cell_gain', cell_id: '${vars.src}', gain: 0 } },
        ],
      });
    },
  },
  {
    id: 'PC-MOB-04', title: 'Mobility registration update / tracking area update', rat: 'both', category: 'Mobility', automation: 'automatic',
    summary: 'LTE: the MME asks for a load-balancing TAU; the UE must perform a Tracking Area Update. NR: a handover into another tracking area must be followed by a mobility registration update.',
    specs: { nr: [S.nrMru], lte: [S.lteTau] },
    notes: [
      'LTE uses ltemme load_balancing_tau (“Initiate a LTE load balancing TAU procedure”) — the docs define it for LTE only.',
      'NR has no equivalent remote API, so NR moves the UE (handover) into a cell with another TAC. That needs a config with ≥2 TACs; if the AMF put both TAs in the UE’s registration area no update is required, so a missing update is INCONCLUSIVE, not FAIL.',
    ],
    preconditions: ['LTE: the UE is registered on EPC.', 'NR: two cells with different TACs.'],
    procedure: ['LTE: load_balancing_tau {imsi}; the MME releases the S1 connection; watch for the TAU.', 'NR: handover to a cell in another TA; watch for Registration request (mobility registration updating).'],
    passCriteria: ['LTE: Tracking area update request → accept in the MME log; registered and connected again.', 'NR: Registration request (mobility registration updating) → Registration accept after entering the new TA.'],
    inconclusiveWhen: ['NR: all cells broadcast one TAC, or no update is seen (the registration area may cover both TAs).'],
    params: [P.connectTimeoutMs, { key: 'updateTimeoutMs', label: 'Update timeout', default: 20000, min: 2000, help: 'Longest wait for the TAU / registration update.' }, P.dlMbps],
    defaultInPlans: true,
    precheck: env => {
      if (env.rat === 'lte') return null;
      const cells = ratCells(env);
      return Object.keys(tacMap(cells)).length ? null
        : `All NR cells broadcast the same TAC (${[...new Set(cells.map(c => c.tac))].join(', ') || 'unknown'}); a mobility registration update needs a tracking-area change — deploy a config with a second TAC.`;
    },
    build: env => {
      const n = NAS[env.rat];
      if (env.rat === 'lte') {
        return scenario('MOB-04', 'Load-balancing TAU', env, {
          description: 'MME load_balancing_tau → UE tracking area update.',
          steps: [
            ...prelude(env, { connected: true, capture: { oldEnb: 'ue.enb_ue_id' } }),
            { type: 'action', target: 'mme', label: 'load_balancing_tau', mark: 'tau', message: { message: 'load_balancing_tau', imsi: '${ue.imsi}' }, onFail: 'inconclusive', inconclusiveReason: 'The MME rejected load_balancing_tau' },
            seq([nasItem(n.tauReq!, 'Tracking area update request'), nasItem(n.tauAccept!, 'Tracking area update accept')], { label: 'NAS: tracking area update', since: 'tau', timeoutMs: '${params.updateTimeoutMs}', metrics: [{ name: 'tau_ms', from: -1, to: 1 }] }),
            { type: 'assert', label: 'registered and connected again', expect: all(eq('mme.registered', true), eq('ue.connected', true)), timeoutMs: '${params.updateTimeoutMs}' },
          ],
        });
      }
      const map = tacMap(ratCells(env));
      return scenario('MOB-04', 'Mobility registration update', env, {
        description: 'Handover into another TA → mobility registration update.',
        minCells: 2, params: { tacTarget: map },
        steps: [
          ...prelude(env, { connected: true, keepAlive: true, capture: { src: 'ue.pcell' } }),
          { type: 'assert', source: 'vars', label: 'the UE’s cell has a neighbour in another TA', expect: { path: 'params.tacTarget[vars.src]', op: 'exists' }, timeoutMs: 0, onFail: 'inconclusive', inconclusiveReason: 'The UE’s PCell has no cell in another tracking area to move to' },
          { type: 'action', target: 'enb', label: 'handover to cell ${params.tacTarget[vars.src]} (other TA)', mark: 'ho', capture: { tgt: 'params.tacTarget[vars.src]' }, message: handoverMsg('nr', 'vars.tgt'), ensureNeighbour: true, onFail: 'inconclusive', inconclusiveReason: 'The callbox refused the handover' },
          { type: 'assert', label: 'UE on cell ${vars.tgt}', expect: all(eq('ue.pcell', '${vars.tgt}'), eq('ue.contexts', 1)), timeoutMs: 5000, onFail: 'inconclusive', inconclusiveReason: 'The handover into the other TA did not complete' },
          seq([nasItem(n.regReq, 'Registration request (mobility registration updating)', { contains: 'mobility' }), nasItem(n.regAccept, 'Registration accept')], {
            label: 'NAS: mobility registration update', since: 'ho', timeoutMs: '${params.updateTimeoutMs}', metrics: [{ name: 'mru_ms', from: -1, to: 1 }],
            onFail: 'inconclusive', reason: 'No mobility registration update after entering the new TA — the AMF may have included both TAs in the registration area, in which case none is required',
          }),
        ],
      });
    },
  },

  // ── Carrier aggregation ───────────────────────────────────────────────────
  {
    id: 'PC-CA-01', title: 'SCell addition and release', rat: 'both', category: 'Carrier aggregation', automation: 'automatic',
    summary: 'RRC reconfiguration releases all SCells, then adds them back; the UE must complete both and the RAN must show the SCells gone / back.',
    specs: { nr: [S.nrRrcReconf], lte: [S.lteRrcReconf] },
    notes: ['rrc_cnx_reconf with nr_secondary_cell_list (NR SA PCell) or eutra_secondary_cell_list (LTE); a list must be a subset of the PCell scell_list.'],
    preconditions: ['The UE’s PCell has an scell_list and the UE is configured with at least one SCell.'],
    procedure: ['UE connected with SCells.', 'rrc_cnx_reconf with an empty list (release all).', 'rrc_cnx_reconf with the original list (add back). Teardown re-adds them if the run stops half-way.'],
    passCriteria: ['Release: DL reconfiguration with sCellToReleaseList → UL complete; ue_get shows no SCell.', 'Add: DL reconfiguration with sCellToAddModList → UL complete; ue_get shows the original SCells.'],
    inconclusiveWhen: ['The config has no scell_list, or the UE came up without SCells (band combination not supported).'],
    params: [P.connectTimeoutMs, P.signallingTimeoutMs, P.dlMbps],
    defaultInPlans: true,
    precheck: env => (ratCells(env).some(c => c.scells.length) ? null : 'No cell of the running config has an scell_list (carrier aggregation). Deploy a CA config, e.g. testDemo-6cell-2x3CC-HO.cfg.'),
    build: env => {
      const r = RRC[env.rat];
      const key = env.rat === 'nr' ? 'nr_secondary_cell_list' : 'eutra_secondary_cell_list';
      return scenario('CA-01', 'SCell add/release', env, {
        description: 'SCell release and addition by RRC reconfiguration.',
        minCells: 2, needsCa: true,
        steps: [
          ...prelude(env, { connected: true, keepAlive: true }),
          { type: 'assert', label: 'UE has SCells', expect: { path: 'ue.scells.length', op: 'gte', value: 1 }, timeoutMs: 10000, capture: { scellList: 'ue.scellList', scells: 'ue.scells' }, onFail: 'inconclusive', inconclusiveReason: 'The UE is connected without any SCell (its PCell has no scell_list, or the UE does not support the band combination)' },
          { type: 'action', target: 'enb', label: 'release all SCells', mark: 'rm', message: { message: 'rrc_cnx_reconf', enb_ue_id: '${ue.enb_ue_id}', [key]: [] }, undo: { message: 'rrc_cnx_reconf', enb_ue_id: '${ue.enb_ue_id}', [key]: '${vars.scellList}' }, undoKey: 'scells', onFail: 'inconclusive', inconclusiveReason: 'The callbox rejected the reconfiguration request' },
          seq([rrcItem(r.reconf, 'reconfiguration with sCellToReleaseList', { contains: r.scellRelease }), rrcItem(r.reconfCpl, 'reconfiguration complete')], { label: 'SCell release signalling', since: 'rm' }),
          { type: 'assert', label: 'no SCell in ue_get', expect: eq('ue.scells.length', 0), timeoutMs: 5000, metric: { name: 'scell_release_ms', since: 'rm' } },
          { type: 'wait', ms: 1000 },
          { type: 'action', target: 'enb', label: 'add SCells ${vars.scells} back', mark: 'add', message: { message: 'rrc_cnx_reconf', enb_ue_id: '${ue.enb_ue_id}', [key]: '${vars.scellList}' }, resolvesUndo: 'scells' },
          seq([rrcItem(r.reconf, 'reconfiguration with sCellToAddModList', { contains: r.scellAdd }), rrcItem(r.reconfCpl, 'reconfiguration complete')], { label: 'SCell addition signalling', since: 'add' }),
          { type: 'assert', label: 'SCells back in ue_get', expect: eq('ue.scells', '${vars.scells}'), timeoutMs: 5000, metric: { name: 'scell_add_ms', since: 'add' } },
        ],
      });
    },
  },
  {
    id: 'PC-CA-02', title: 'SCell activation / deactivation (MAC CE)', rat: 'both', category: 'Carrier aggregation', automation: 'automatic',
    summary: 'The configured SCells are deactivated and re-activated with the Activation/Deactivation MAC CE (scells_act_deact).',
    specs: { nr: [S.nrMacScell], lte: [S.lteMacScell] },
    notes: ['The MAC CE is not an RRC message, so it is not in the RRC log: the verdict uses the callbox’s reply (scells / activated) and checks that the UE keeps its SCells configured and stays connected. It does not prove the UE acted on the MAC CE.'],
    preconditions: ['The UE is configured with at least one SCell.'],
    procedure: ['scells_act_deact deactivate all.', 'Wait 1 s.', 'scells_act_deact activate all. Teardown re-activates them if the run stops.'],
    passCriteria: ['Reply after deactivation: activated is empty.', 'Reply after activation: all configured SCells activated.', 'The UE stays connected with the same configured SCells.'],
    inconclusiveWhen: ['The UE has no SCell.'],
    params: [P.connectTimeoutMs, P.dlMbps],
    defaultInPlans: true,
    precheck: env => (ratCells(env).some(c => c.scells.length) ? null : 'No cell of the running config has an scell_list (carrier aggregation).'),
    build: env => scenario('CA-02', 'SCell MAC CE', env, {
      description: 'SCell deactivation and activation by MAC CE; reply-based verdict.',
      minCells: 2, needsCa: true,
      steps: [
        ...prelude(env, { connected: true, keepAlive: true }),
        { type: 'assert', label: 'UE has SCells', expect: { path: 'ue.scells.length', op: 'gte', value: 1 }, timeoutMs: 10000, capture: { scells: 'ue.scells' }, onFail: 'inconclusive', inconclusiveReason: 'The UE is connected without any SCell' },
        { type: 'action', target: 'enb', label: 'deactivate SCells ${vars.scells} (MAC CE)', saveAs: 'deact', message: { message: 'scells_act_deact', enb_ue_id: '${ue.enb_ue_id}', deactivate: '${vars.scells}' }, undo: { message: 'scells_act_deact', enb_ue_id: '${ue.enb_ue_id}', activate: '${vars.scells}' }, undoKey: 'act', onFail: 'inconclusive', inconclusiveReason: 'The callbox rejected scells_act_deact' },
        { type: 'assert', source: 'reply', label: 'reply: none activated', expect: eq('reply.deact.activated.length', 0), timeoutMs: 0 },
        { type: 'wait', ms: 1000 },
        { type: 'action', target: 'enb', label: 'activate SCells ${vars.scells} (MAC CE)', saveAs: 'act', message: { message: 'scells_act_deact', enb_ue_id: '${ue.enb_ue_id}', activate: '${vars.scells}' }, resolvesUndo: 'act' },
        { type: 'assert', source: 'reply', label: 'reply: all activated', expect: eq('reply.act.activated.length', '${vars.scells.length}'), timeoutMs: 0 },
        { type: 'assert', label: 'UE still connected with its SCells', expect: all(eq('ue.connected', true), eq('ue.scells', '${vars.scells}')), timeoutMs: 3000, holdMs: 1000 },
      ],
    }),
  },

  // ── System information / idle ─────────────────────────────────────────────
  {
    id: 'PC-SI-01', title: 'System information change: cell barring', rat: 'both', category: 'System information', automation: 'automatic',
    summary: 'The serving cell is barred through a system-information change; after an RRC release the UE must come back on another, unbarred cell.',
    specs: { nr: [S.nrSi, S.nrIdle], lte: [S.lteSi, S.lteIdle] },
    notes: ['LTE bars with sib_set cells.<id>.sib1.cell_barred; NR with config_set cells.<id>.cell_barred (the docs limit sib_set cell_barred to LTE / NB-IoT). Barring is cleared in the case and again by teardown.', 'The UE is brought back with 1 Mbps callbox DL (paging) when an SSH login exists; without it the UE has to reconnect on its own.'],
    preconditions: ['At least 2 cells of the RAT.'],
    procedure: ['UE connected on cell X.', 'Bar X; wait for the system-information update.', 'RRC release; DL traffic from the callbox pages the UE back.', 'Unbar X.'],
    passCriteria: ['The UE reconnects on a cell other than X and stays there for the hold time.'],
    inconclusiveWhen: ['The UE does not reconnect at all within the timeout (e.g. no SSH login for paging traffic).'],
    params: [P.connectTimeoutMs, { key: 'sibWaitMs', label: 'SI update wait', default: 12000, min: 1000, help: 'Time for the UE to read the changed system information before the release.' }, { key: 'reconnectTimeoutMs', label: 'Reconnect timeout', default: 30000, min: 2000, help: 'Longest wait for the UE to come back.' }, { key: 'holdMs', label: 'Hold', default: 3000, min: 0, help: 'The UE must stay off the barred cell this long.' }, P.dlMbps],
    defaultInPlans: true,
    precheck: env => minCellsCheck(env, 2),
    build: env => {
      const bar = (v: boolean) => (env.rat === 'nr'
        ? { message: 'config_set', cells: { '${vars.src}': { cell_barred: v } } }
        : { message: 'sib_set', cells: { '${vars.src}': { sib1: { cell_barred: v } } } });
      const steps: Step[] = [
        ...prelude(env, { connected: true, capture: { src: 'ue.pcell', oldId: 'ue.ran_ue_id' } }),
        { type: 'action', target: 'enb', label: 'bar cell ${vars.src}', mark: 'bar', message: bar(true), onFail: 'inconclusive', inconclusiveReason: 'The callbox rejected the barring request' },
        { type: 'wait', label: 'wait for the system-information update', ms: '${params.sibWaitMs}' },
        { type: 'action', target: 'enb', label: 'RRC release', mark: 'rel', message: { message: 'rrc_cnx_release', ran_ue_id: '${ue.ran_ue_id}' }, onFail: 'inconclusive', inconclusiveReason: 'The callbox rejected the RRC release' },
      ];
      if (env.hasSsh) steps.push({ type: 'traffic', op: 'start', generator: 'callbox', direction: 'dl', protocol: 'udp', ref: 'page', bitrateMbps: '${params.dlMbps}', durationSec: 60, optional: true, label: 'DL ${params.dlMbps} Mbps from the callbox (pages the UE back)' });
      steps.push(
        { type: 'assert', label: 'UE back in RRC connected', expect: all(eq('ue.connected', true), { path: 'ue.ran_ue_id', op: 'ne', value: '${vars.oldId}' }), timeoutMs: '${params.reconnectTimeoutMs}', metric: { name: 'reconnect_ms', since: 'rel' }, onFail: 'inconclusive', inconclusiveReason: env.hasSsh ? 'The UE did not reconnect after the release' : 'The UE did not reconnect after the release (no SSH login, so the callbox could not page it with DL data)' },
        { type: 'assert', label: 'on a cell other than the barred ${vars.src}', expect: all(eq('ue.connected', true), { path: 'ue.pcell', op: 'ne', value: '${vars.src}' }), timeoutMs: '${params.holdMs + 2000}', holdMs: '${params.holdMs}' },
        { type: 'action', target: 'enb', label: 'unbar cell ${vars.src}', message: bar(false) },
      );
      if (env.hasSsh) steps.push({ type: 'traffic', op: 'stop', ref: 'page', label: 'stop DL traffic' });
      return scenario('SI-01', 'Cell barring', env, { description: 'Serving cell barred by system information; UE comes back elsewhere.', minCells: 2, steps });
    },
  },
  {
    id: 'PC-IDLE-01', title: 'Paging from idle (network-triggered service request)', rat: 'both', category: 'Paging & idle', automation: 'automatic',
    summary: 'The UE is released to idle, then the callbox sends downlink data; the UE must answer the page with an RRC setup and a Service request.',
    specs: { nr: [S.nrPagingRrc, S.nrPagingNas, S.nrService], lte: [S.ltePagingRrc, S.ltePagingNas, S.lteService] },
    notes: ['The stimulus is real user-plane data (callbox iperf UDP to the UE’s IP), which makes the core page the UE — so the system needs an SSH login.', 'establishmentCause mt-Access is looked for in the decoded RRC setup request and recorded, but not required (it needs the RRC log body).'],
    preconditions: ['SSH login to the callbox (for DL traffic).', 'The UE is registered and goes idle after an RRC release.'],
    procedure: ['UE connected, then rrc_cnx_release.', 'Check it is idle and has not come back on its own.', 'Start 1 Mbps DL UDP from the callbox.', 'Stop the traffic (and again in teardown).'],
    passCriteria: ['RRC setup request (answering the page) → Service request in the core, within the paging timeout after the data started.', 'The UE is RRC connected again.'],
    inconclusiveWhen: ['No SSH login (no DL data possible).', 'The UE does not go idle, or reconnects on its own before the data starts.'],
    params: [P.connectTimeoutMs, { key: 'idleSettleMs', label: 'Idle settle', default: 1000, min: 0, help: 'Time in idle before the data starts.' }, { key: 'pagingTimeoutMs', label: 'Paging timeout', default: 10000, min: 1000, help: 'Longest wait for the service request after the data started.' }, P.dlMbps],
    defaultInPlans: true,
    precheck: env => (env.hasSsh ? null : 'This case needs the system’s SSH login so the callbox can send downlink data to page the UE. Add it in Test Systems.'),
    build: env => {
      const r = RRC[env.rat];
      const n = NAS[env.rat];
      return scenario('IDLE-01', 'Paging from idle', env, {
        description: 'Release to idle, DL data from the callbox, UE answers the page.',
        steps: [
          ...prelude(env, { connected: true, capture: { oldId: 'ue.ran_ue_id' } }),
          { type: 'action', target: 'enb', label: 'RRC release', mark: 'rel', message: { message: 'rrc_cnx_release', ran_ue_id: '${ue.ran_ue_id}' }, onFail: 'inconclusive', inconclusiveReason: 'The callbox rejected the RRC release' },
          { type: 'assert', label: 'UE idle', expect: eq('ue.connected', false), timeoutMs: 5000, pollMs: 100, onFail: 'inconclusive', inconclusiveReason: 'The UE did not go idle after the release' },
          { type: 'wait', ms: '${params.idleSettleMs}' },
          { type: 'assert', label: 'still idle when the data starts', expect: eq('ue.connected', false), timeoutMs: 0, onFail: 'inconclusive', inconclusiveReason: 'The UE reconnected on its own (background data on the device) before the page, so paging was not exercised' },
          { type: 'traffic', op: 'start', generator: 'callbox', direction: 'dl', protocol: 'udp', ref: 'page', bitrateMbps: '${params.dlMbps}', durationSec: 60, mark: 'page', label: 'DL ${params.dlMbps} Mbps UDP from the callbox', onFail: 'inconclusive', inconclusiveReason: 'Could not start DL traffic on the callbox' },
          seq([
            rrcItem(r.paging, 'Paging (PCCH)', { optional: true }),
            rrcItem(r.setupReq, 'RRC setup request'),
            nasItem(n.serviceReq, 'Service request'),
          ], { label: 'page answered: RRC setup → Service request', since: 'page', timeoutMs: '${params.pagingTimeoutMs}', metrics: [{ name: 'paging_response_ms', from: -1, to: 2 }] }),
          seq([rrcItem(r.setupReq, 'RRC setup request with mt-Access', { contains: 'mt-?Access' })], { label: 'establishment cause mt-Access (recorded, not required)', since: 'page', timeoutMs: 1000, optional: true }),
          { type: 'assert', label: 'UE connected again', expect: eq('ue.connected', true), timeoutMs: 10000 },
          { type: 'traffic', op: 'stop', ref: 'page', label: 'stop DL traffic' },
        ],
      });
    },
  },

  // ── Measurements (KPIs) ───────────────────────────────────────────────────
  {
    id: 'PC-KPI-01', title: 'Handover interruption (RRC level)', rat: 'both', category: 'Robustness', automation: 'automatic',
    summary: 'Several network-triggered handovers; the time from DL reconfiguration with mobility to UL reconfiguration complete (callbox log timestamps) must stay under the threshold.',
    specs: { nr: [S.nrRrcReconf], lte: [S.lteRrcHo] },
    notes: ['Measured at the RRC layer on the callbox clock: an upper-bound proxy for the user-plane interruption, not a user-plane measurement.', 'Thresholds are SimTool defaults for a bench check, not 3GPP requirements.'],
    preconditions: ['At least 2 cells of the RAT.'],
    procedure: ['UE connected (1 Mbps DL keeps it there when SSH is available).', 'N handovers between the UE’s cell and a partner cell.'],
    passCriteria: ['Every handover completes (PCell = target, one context).', 'max(ho_interruption_ms) ≤ threshold.'],
    inconclusiveWhen: ['No handover sample was measured.'],
    params: [P.connectTimeoutMs, P.signallingTimeoutMs, { key: 'handovers', label: 'Handovers', default: 4, min: 1, max: 50, help: 'Number of handovers measured.' }, { key: 'thresholdMs', label: 'PASS threshold', default: 100, min: 1, help: 'Largest acceptable DL reconfiguration → UL complete time.' }, { key: 'dwellMs', label: 'Dwell between handovers', default: 1500, min: 200, help: 'Time on each cell.' }, P.dlMbps],
    measurement: { metric: 'ho_interruption_ms', unit: 'ms', stat: 'max', thresholdParam: 'thresholdMs' },
    defaultInPlans: true,
    precheck: env => minCellsCheck(env, 2),
    build: env => scenario('KPI-01', 'HO interruption', env, {
      description: 'Handover RRC execution time (DL reconfiguration → UL complete).',
      minCells: 2, params: { hoTarget: anyMap(ratCells(env)) },
      steps: [
        ...prelude(env, { connected: true, keepAlive: true }),
        {
          type: 'loop', label: 'handover × ${params.handovers}', count: '${params.handovers}',
          steps: [
            { type: 'assert', label: 'connected, one context', expect: all(eq('ue.connected', true), eq('ue.contexts', 1)), timeoutMs: 10000, capture: { src: 'ue.pcell' } },
            { type: 'assert', source: 'vars', label: 'cell ${vars.src} has a handover partner', expect: { path: 'params.hoTarget[vars.src]', op: 'exists' }, timeoutMs: 0, onFail: 'inconclusive', inconclusiveReason: 'The UE’s cell has no handover partner' },
            { type: 'action', target: 'enb', label: 'handover ${vars.src} → ${params.hoTarget[vars.src]}', mark: 'ho', capture: { tgt: 'params.hoTarget[vars.src]' }, message: handoverMsg(env.rat, 'vars.tgt'), ensureNeighbour: true, onFail: 'inconclusive', inconclusiveReason: 'The callbox refused the handover' },
            hoSeq(env.rat, 'ho_interruption_ms'),
            { type: 'assert', label: 'PCell = cell ${vars.tgt}, one context', expect: all(eq('ue.pcell', '${vars.tgt}'), eq('ue.contexts', 1)), timeoutMs: 5000, metric: { name: 'ho_complete_ms', since: 'ho' } },
            { type: 'wait', ms: '${params.dwellMs}' },
          ],
        },
      ],
    }),
  },
  {
    id: 'PC-KPI-02', title: 'RRC setup latency', rat: 'both', category: 'RRC', automation: 'automatic',
    summary: 'The UE is released and brought back several times; the time from RRC setup request to RRC setup complete (callbox log timestamps) must stay under the threshold.',
    specs: { nr: [S.nrRrcEstablish], lte: [S.lteRrcEstablish] },
    notes: ['Measured on the callbox clock between the UL setup request and the UL setup complete; includes the UE’s processing of the setup message.', 'Thresholds are SimTool defaults, not 3GPP requirements.', 'With an SSH login the UE is brought back by callbox DL data (paging); otherwise it has to reconnect on its own.'],
    preconditions: ['The UE is registered and returns to connected after a release (DL data or its own traffic).'],
    procedure: ['N × { rrc_cnx_release, wait, DL data from the callbox, measure setup request → setup complete }.'],
    passCriteria: ['Every reconnection shows setup request → setup → setup complete.', 'max(rrc_setup_ms) ≤ threshold.'],
    inconclusiveWhen: ['The UE does not reconnect within the timeout.'],
    params: [P.connectTimeoutMs, { key: 'samples', label: 'Samples', default: 3, min: 1, max: 50, help: 'Number of connection set-ups measured.' }, { key: 'thresholdMs', label: 'PASS threshold', default: 150, min: 1, help: 'Largest acceptable setup request → setup complete time.' }, { key: 'reconnectTimeoutMs', label: 'Reconnect timeout', default: 30000, min: 2000, help: 'Longest wait for each reconnection.' }, P.dlMbps],
    measurement: { metric: 'rrc_setup_ms', unit: 'ms', stat: 'max', thresholdParam: 'thresholdMs' },
    defaultInPlans: true,
    precheck: () => null,
    build: env => {
      const r = RRC[env.rat];
      const inner: Step[] = [
        { type: 'assert', label: 'connected', expect: eq('ue.connected', true), timeoutMs: '${params.reconnectTimeoutMs}', capture: { oldId: 'ue.ran_ue_id' }, onFail: 'inconclusive', inconclusiveReason: 'The UE is not connected' },
        { type: 'action', target: 'enb', label: 'RRC release', mark: 'rel', message: { message: 'rrc_cnx_release', ran_ue_id: '${ue.ran_ue_id}' }, onFail: 'inconclusive', inconclusiveReason: 'The callbox rejected the RRC release' },
        { type: 'assert', label: 'released', expect: { any: [eq('ue.connected', false), { path: 'ue.ran_ue_id', op: 'ne', value: '${vars.oldId}' }] }, timeoutMs: 5000, pollMs: 100 },
        { type: 'wait', ms: 1000 },
      ];
      if (env.hasSsh) inner.push({ type: 'traffic', op: 'start', generator: 'callbox', direction: 'dl', protocol: 'udp', ref: 'kick', bitrateMbps: '${params.dlMbps}', durationSec: 30, optional: true, label: 'DL ${params.dlMbps} Mbps (brings the UE back)' });
      inner.push(
        seq([rrcItem(r.setupReq, 'RRC setup request'), rrcItem(r.setup, 'RRC setup'), rrcItem(r.setupCpl, 'RRC setup complete')], {
          label: 'RRC setup request → setup → complete', since: 'rel', timeoutMs: '${params.reconnectTimeoutMs}', metrics: [{ name: 'rrc_setup_ms', from: 0, to: 2 }],
          onFail: 'inconclusive', reason: 'The UE did not reconnect after the release',
        }),
      );
      if (env.hasSsh) inner.push({ type: 'traffic', op: 'stop', ref: 'kick', label: 'stop DL traffic' });
      inner.push({ type: 'wait', ms: 1000 });
      return scenario('KPI-02', 'RRC setup latency', env, {
        description: 'RRC setup request → complete, measured over several releases.',
        steps: [...prelude(env, { connected: true }), { type: 'loop', label: 'setup × ${params.samples}', count: '${params.samples}', steps: inner }],
      });
    },
  },
];

/** Shared by the two network-triggered handover cases. */
function mobilityCase(id: string, name: string, env: CaseEnv, map: Record<string, number>, kind: string): MobilityScenario {
  return scenario(id, name, env, {
    description: `Network-triggered ${kind} handover with RRC signalling check.`,
    minCells: 2, params: { hoTarget: map },
    steps: [
      ...prelude(env, { connected: true, keepAlive: true, capture: { src: 'ue.pcell' } }),
      { type: 'assert', source: 'vars', label: `cell \${vars.src} has an ${kind} partner`, expect: { path: 'params.hoTarget[vars.src]', op: 'exists' }, timeoutMs: 0, onFail: 'inconclusive', inconclusiveReason: `The UE’s PCell has no ${kind} partner cell in the running config` },
      { type: 'action', target: 'enb', label: 'handover ${vars.src} → ${params.hoTarget[vars.src]}', mark: 'ho', capture: { tgt: 'params.hoTarget[vars.src]' }, message: handoverMsg(env.rat, 'vars.tgt'), ensureNeighbour: true, onFail: 'inconclusive', inconclusiveReason: 'The callbox refused the handover request' },
      hoSeq(env.rat, 'ho_rrc_ms'),
      { type: 'assert', label: 'PCell = cell ${vars.tgt}, one context', expect: all(eq('ue.connected', true), eq('ue.pcell', '${vars.tgt}'), eq('ue.contexts', 1)), timeoutMs: '${params.signallingTimeoutMs}', holdMs: '${params.holdMs}', metric: { name: 'ho_complete_ms', since: 'ho' } },
      { type: 'assert', label: 'still registered', source: 'mme', expect: eq('mme.registered', true), timeoutMs: 3000 },
    ],
  });
}

export const CASE_BY_ID: Record<string, TestCaseDef> = Object.fromEntries(CASES.map(c => [c.id, c]));

export const supportsRat = (c: Pick<TestCaseDef, 'rat'>, rat: Rat) => c.rat === 'both' || c.rat === rat;

/** Catalogue without functions (API / UI). */
export const caseInfo = ({ precheck: _p, build: _b, ...rest }: TestCaseDef): TestCaseInfo => rest;

export const defaultParams = (c: Pick<TestCaseDef, 'params'>): Record<string, unknown> =>
  Object.fromEntries(c.params.map(p => [p.key, p.default]));

/** The spec references a case shows for a RAT (both RATs when unknown). */
export const specsFor = (c: Pick<TestCaseDef, 'specs'>, rat?: Rat): SpecRef[] =>
  rat ? c.specs[rat] ?? [] : [...(c.specs.nr ?? []), ...(c.specs.lte ?? [])];

export const specText = (s: SpecRef) => `based on ${s.spec}${s.section ? ` §${s.section}` : ''} (${s.title})`;
