// Mobility Scenarios — the data model.
//
// A MobilityScenario is a list of steps run against one Amarisoft callbox
// (eNB remote API :9001, MME remote API :9000) and, optionally, a real phone
// on the SimTool host over adb. It is deliberately NOT called "Scenario":
// that name already belongs to Test Execution's deploy topologies.
//
// Stored as data/scenarios/<id>.json; the JSON schema lives next to this file
// in schema/mobility-scenario.schema.json and is kept in sync with these types.
//
// Placeholders: any string in a step may contain ${expr}. A string that is
// exactly one placeholder keeps the value's type (number, array, object), so
// "${ue.scells}" becomes [2, 3], not "2,3". Expressions are paths with + - * / %
// and parentheses, e.g. ${cells[(loop.i + 1) % cellCount].pci}. Object keys
// are resolved too ({"${vars.src}": {...}}). See lib/expr.ts for the context.

export type RemoteTarget = 'enb' | 'mme';

/** Anything that may be a literal or a ${placeholder} string. */
export type Num = number | string;

export interface ScenarioRequirements {
  /** Minimum LTE cells the running eNB config must have. */
  minCells: number;
  /** Legacy, ignored: SimTool drives the callbox only, never a handset. */
  needsPhone?: boolean;
  /** Running config must have meas_config_desc + ho_from_meas (checked with eNB config_get). */
  needsHoConfig: boolean;
  /** The UE's PCell must have an scell_list (carrier aggregation). */
  needsCa?: boolean;
}

// ─── Conditions ─────────────────────────────────────────────────────────────
export type CondOp =
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'nin'            // value is an array
  | 'exists' | 'absent'     // no value
  | 'truthy' | 'falsy'      // no value
  | 'match'                 // value is a regex string, left side stringified
  | 'contains';             // left is an array or string

export interface LeafCondition { path: string; op: CondOp; value?: unknown }
export type Condition =
  | LeafCondition
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

// ─── Steps ──────────────────────────────────────────────────────────────────
interface StepCommon {
  /** Short text shown in the timeline. */
  label?: string;
  /** Run the step only when this holds (evaluated after a UE refresh). False → "skipped". */
  when?: Condition;
  /** A failure is recorded as a warning and the run continues. */
  optional?: boolean;
  /** Record the step start time under this name; asserts can measure from it. */
  mark?: string;
  /** vars.<name> = expression, evaluated before the step runs (actions) or when it passes (asserts). */
  capture?: Record<string, string>;
  /** "inconclusive": if this step fails, the run stops and ends INCONCLUSIVE
   *  (a precondition or test-system problem, not a verdict on the UE). */
  onFail?: 'fail' | 'inconclusive';
  /** Plain-language reason recorded with an inconclusive ending. */
  inconclusiveReason?: string;
}

export interface RemoteActionStep extends StepCommon {
  type: 'action';
  target: RemoteTarget;
  /** The remote API request, e.g. {"message":"handover","ran_ue_id":"${ue.ran_ue_id}","pci":2}. */
  message: Record<string, unknown>;
  /** Sent during teardown (LIFO), resolved when the action runs. cell_gain,
   *  sib_set barring and ncell_list_add are undone automatically. */
  undo?: Record<string, unknown>;
  /** Tag the undo so a later step can declare it done (resolvesUndo). */
  undoKey?: string;
  /** Drop a pending undo with this key — the scenario reverted it itself. */
  resolvesUndo?: string;
  /** handover only: when the eNB answers "not found in Neighbour Cell List",
   *  add the target to the PCell's ncell_list (deleted at teardown) and retry. */
  ensureNeighbour?: boolean;
  /** Pass when the reply is an error matching this regex (negative tests). */
  expectError?: string;
  /** reply.<name> = the reply object. */
  saveAs?: string;
  timeoutMs?: number;
}

export type PhoneOp =
  | 'airplane_on' | 'airplane_off'
  | 'ping'          // blocking: count pings, records loss
  | 'ping_start'    // background ping, keeps the UE in RRC connected
  | 'ping_stop'     // stops it; metrics ping_loss_pct / ping_max_gap_ms
  | 'wake'
  | 'radio_info'    // opens RadioInfo so the modem refreshes cell info
  | 'cell_info';    // dumpsys telephony.registry → phone.{pci,earfcn,rsrp}

export interface PhoneActionStep extends StepCommon {
  type: 'action';
  target: 'phone';
  phone: {
    op: PhoneOp;
    /** Ping destination (IPv4). Default: the callbox address on the UE's PDN (x.y.z.1). */
    host?: string;
    count?: number;
    intervalMs?: number;
  };
  saveAs?: string;
}

export type ActionStep = RemoteActionStep | PhoneActionStep;

export interface WaitStep extends StepCommon { type: 'wait'; ms: Num }

export type AssertSource = 'ue' | 'mme' | 'log' | 'reply' | 'phone' | 'vars' | 'sequence';

/** One expected log entry of an ordered signalling sequence. */
export interface LogSeqItem {
  /** Which daemon's log (default: sequence.target, else enb). */
  target?: RemoteTarget;
  /** Log layer, e.g. RRC, NAS, S1AP, NGAP (case-insensitive). */
  layer?: string;
  /** Log direction as Amarisoft reports it: UL, DL, TO or FROM. */
  dir?: 'UL' | 'DL' | 'TO' | 'FROM';
  /** Case-insensitive regex on the entry's first line, e.g. "RRC reconfiguration complete". */
  msg: string;
  /** Case-insensitive regex on the whole entry (the decoded ASN.1 / NAS body). */
  contains?: string;
  label?: string;
  /** May be missing; when present it must still be in order. */
  optional?: boolean;
}

/** Ordered signalling check: A then B (then C…) after the stimulus. */
export interface LogSequence {
  items: LogSeqItem[];
  target?: RemoteTarget;
  /** Mark the sequence is timed from (default: the assert's own start). */
  since?: string;
  /** The last required entry must be logged within this many ms of `since` (callbox clock). */
  withinMs?: Num;
  /** Metrics from callbox log timestamps: items[to].t − items[from].t (from −1 = the `since` mark). */
  metrics?: { name: string; from: number; to: number; unit?: string }[];
}

export interface AssertStep extends StepCommon {
  type: 'assert';
  /** What to refresh while polling. ue = eNB ue_get joined to MME ue_get (ue.* and mme.*). */
  source?: AssertSource;
  /** Required unless source is "log". */
  expect?: Condition;
  /** source "log": regex over log lines received since `since` (step start by default). */
  log?: { target: RemoteTarget; pattern: string; layer?: string; since?: string; minCount?: number };
  /** source "sequence": ordered signalling (see LogSequence). */
  sequence?: LogSequence;
  /** source "sequence": reply.<name> = { matched, evidence, missing }, pass or fail. */
  saveAs?: string;
  timeoutMs: Num;
  /** Once true, the condition must stay true this long (restarts if it flips, until timeout). */
  holdMs?: Num;
  pollMs?: number;
  /** Record (pass time − marks[since]) as a metric. */
  metric?: { name: string; since?: string; unit?: string };
}

export interface RampCell { cell: Num; from: Num; to: Num }
export interface RampStep extends StepCommon {
  type: 'ramp';
  /** All cells move one step per tick toward their `to`. Gains are clamped to [-200, 0]. */
  cells: RampCell[];
  stepDb: Num;
  dwellMs: Num;
  /** Checked after every tick (UE refreshed). The ramp ends early when it holds. */
  stopWhen?: Condition;
  /** The ramp fails if it reaches the end without stopWhen holding. */
  requireStop?: boolean;
  saveAs?: string;
  metric?: { name: string };
}

export interface LoopStep extends StepCommon {
  type: 'loop';
  count?: Num;
  /** Checked after every iteration. */
  until?: Condition;
  maxIterations?: number;
  steps: Step[];
}

export interface TrafficStep extends StepCommon {
  type: 'traffic';
  op: 'start' | 'stop';
  generator?: 'callbox' | 'phone';
  direction?: 'dl' | 'ul';
  protocol?: 'udp' | 'tcp';
  bitrateMbps?: Num;
  durationSec?: Num;
  /** start: remember the job; stop: which one (default: every job this run started). */
  ref?: string;
}

/**
 * A pause for the person at the bench: SimTool never drives the phone, so
 * anything the UE has to start (power on, airplane mode, a detach) is asked
 * for here. The run waits for Continue (or Skip / Abort) from the UI; no
 * answer within timeoutMs ends the run INCONCLUSIVE (or failed, onTimeout).
 */
export interface OperatorStep extends StepCommon {
  type: 'operator';
  /** One imperative sentence, e.g. "Switch airplane mode OFF on the device now." */
  prompt: string;
  /** Longer help shown under the prompt. */
  detail?: string;
  continueLabel?: string;
  timeoutMs: Num;
  onTimeout?: 'inconclusive' | 'fail';
}

export type Step = ActionStep | WaitStep | AssertStep | RampStep | LoopStep | TrafficStep | OperatorStep;
export type StepType = Step['type'];

export interface MobilityScenario {
  /** File name under data/scenarios (slug). */
  id: string;
  name: string;
  description: string;
  schemaVersion: 1;
  tags?: string[];
  /** Shipped with SimTool; "Restore" puts the original back. */
  builtin?: boolean;
  requirements: ScenarioRequirements;
  /** Defaults for ${params.*}; a run may override them. */
  params?: Record<string, unknown>;
  /** eNB/MME log layers raised for the run (restored at teardown), e.g. {"enb":{"rrc":"debug"}}. */
  logs?: Partial<Record<RemoteTarget, Record<string, 'error' | 'warn' | 'info' | 'debug'>>>;
  /** Hard cap for the whole run. Default 30 min. */
  maxDurationMs?: number;
  steps: Step[];
  updatedAt?: string;
}

// ─── Runs ───────────────────────────────────────────────────────────────────
export type RunState = 'preflight' | 'running' | 'teardown' | 'passed' | 'failed' | 'inconclusive' | 'aborted' | 'error';
export type StepStatus = 'running' | 'passed' | 'failed' | 'warned' | 'skipped';

export interface RunEvent {
  t: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  /** Step path, e.g. "3" or "4/2#1" (loop step 4, iteration 2, child 1). */
  path?: string;
  msg: string;
  data?: unknown;
}

export interface StepRecord {
  path: string;
  type: StepType;
  label: string;
  status: StepStatus;
  startedAt: number;
  endedAt?: number;
  detail?: string;
  iteration?: number;
}

export interface AssertRecord {
  path: string;
  label: string;
  passed: boolean;
  optional: boolean;
  elapsedMs: number;
  detail: string;
  at: number;
  /** Matched log lines (sequence asserts), for reports. */
  evidence?: string[];
}

export interface MetricRecord { name: string; value: number; unit: string; path: string; at: number }

export interface TeardownRecord { what: string; ok: boolean; detail?: string; at: number }

export interface PreflightCheck { name: string; ok: boolean; level: 'error' | 'warn' | 'info'; detail: string }

export interface CellInfo {
  id: number;
  pci: number;
  /** LTE: dl_earfcn. NR: dl_nr_arfcn. */
  earfcn: number;
  /** 'nr' cells come from config_get nr_cells and hand over by ssb_nr_arfcn. */
  rat: 'lte' | 'nr';
  /** NR only: SSB NR-ARFCN — what the handover message needs, not dl_nr_arfcn. */
  ssb?: number;
  band?: number;
  gain: number;
  eci?: number;
  plmn?: string;
  tac?: number;
  barred?: boolean | string;
  /** ho_from_meas is on for this cell (config_get connected_mobility.eutra_handover_*). */
  hoFromMeas: boolean;
  hasMeasConfig: boolean;
  scells: number[];
}

export interface RunSummary {
  id: string;
  scenarioId: string;
  scenarioName: string;
  host: string;
  systemName?: string;
  imsi: string;
  phoneSerial?: string;
  state: RunState;
  startedAt: number;
  endedAt?: number;
  asserts: { total: number; passed: number; failed: number; warned: number };
  error?: string;
  linkedTest?: { id: string; name?: string };
}

/** An operator step waiting for Continue / Skip / Abort. */
export interface PendingPrompt {
  id: string;
  path: string;
  text: string;
  detail?: string;
  continueLabel?: string;
  startedAt: number;
  timeoutMs: number;
}

export type PromptResponse = 'continue' | 'skip' | 'abort';

export interface RunView extends RunSummary {
  params: Record<string, unknown>;
  preflight: PreflightCheck[];
  cells: CellInfo[];
  steps: StepRecord[];
  assertResults: AssertRecord[];
  metrics: MetricRecord[];
  teardown: TeardownRecord[];
  events: RunEvent[];
  /** Scenario as run (after param merge), for reproducing it. */
  scenario: MobilityScenario;
  notes: string[];
  /** Why the run ended INCONCLUSIVE (state 'inconclusive'). */
  inconclusive?: string;
  /** Operator step currently waiting for an answer. */
  prompt?: PendingPrompt;
  /** The remote API 'ready' banners (software name / version). */
  callbox?: Partial<Record<RemoteTarget, { type?: string; name?: string; version?: string }>>;
}

export interface RunRequest {
  scenarioId?: string;
  /** Run an unsaved scenario from the editor. */
  scenario?: MobilityScenario;
  host: string;
  enbPort?: number;
  mmePort?: number;
  systemId?: string;
  systemName?: string;
  imsi: string;
  phoneSerial?: string;
  params?: Record<string, unknown>;
  /** SSH login for traffic steps (callbox iperf). */
  creds?: { host: string; port?: number; username?: string; password?: string; privateKey?: string };
  /** Refuse to start when a requirement is only a warning (e.g. no phone). */
  strict?: boolean;
  /** Test Execution scenario (deploy topology) this run belongs to. */
  linkedTest?: { id: string; name?: string };
  /** eNB config text (e.g. the config Test Execution just deployed) for the ho_from_meas check. */
  configText?: string;
  /** Operator explicitly confirmed a network-initiated detach (only the safe
   *  form: no cause IE, re-attach/re-registration required). */
  allowNetworkDetach?: boolean;
  /** The system is reserved by this owner (a pre-conformance plan run); a run
   *  presenting the same token may use it. */
  reservation?: string;
  /** The UE may be missing from the core at start (an operator will register it). */
  allowUnregistered?: boolean;
}
