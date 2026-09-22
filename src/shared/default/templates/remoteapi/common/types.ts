// Amarisoft remote API command catalogue: shared types.
//
// Every command entry is transcribed from the Amarisoft docs shipped with
// release 2026-09-11 (lteenb/ltemme/lteims/lteue/ltembmsgw/ltelicense,
// "Remote API" chapter). `docRef` names the doc and section so a reviewer can
// check an entry against the source. Facts learned on the live callbox
// (2026-06-12 build) that the docs do not state are called out in `notes`.
//
// This file must stay free of `@/` imports: the offline QA harness
// (scripts/qa/qa-remote-api.ts) loads the catalogue with tsx.

/** Remote API server type, as sent in the `ready`/`authenticate` banner. */
export type ComponentType = 'ENB' | 'UE' | 'MME' | 'IMS' | 'MBMS' | 'LICENSE';

export const COMPONENT_TYPES: ComponentType[] = ['ENB', 'MME', 'IMS', 'UE', 'MBMS', 'LICENSE'];

/** Default remote API ports (ws.js shortcuts in the 2026-09-11 release). */
export const DEFAULT_REMOTE_API_PORTS: Record<ComponentType, number> = {
  MME: 9000,
  ENB: 9001,
  UE: 9002,
  IMS: 9003,
  MBMS: 9004,
  LICENSE: 9006,
};

/** Banner `type` string -> SimTool component. MBMSGW is the only rename. */
export function componentFromBannerType(type: unknown): ComponentType | null {
  switch (String(type ?? '').toUpperCase()) {
    case 'ENB': return 'ENB';
    case 'MME': return 'MME';
    case 'IMS': return 'IMS';
    case 'UE': return 'UE';
    case 'MBMSGW':
    case 'MBMS': return 'MBMS';
    case 'LICENSE': return 'LICENSE';
    default: return null;
  }
}

export type ParamType = 'integer' | 'number' | 'string' | 'boolean' | 'object' | 'array' | 'any';

export interface ParamSpec {
  /** One type, or several when the docs allow e.g. "number or array of numbers". */
  type: ParamType | ParamType[];
  required?: boolean;
  /** Help text, condensed from the docs. */
  help: string;
  min?: number;
  max?: number;
  /** Allowed values (strings or numbers). */
  enum?: ReadonlyArray<string | number>;
  /** Element type when `type` includes 'array'. */
  items?: ParamType;
  /** Regex source the string value must match (e.g. IMSI digits). */
  pattern?: string;
  default?: unknown;
  /** Other key names the server accepts for this field. */
  aliases?: string[];
  /** First release that documents this parameter (YYYY-MM-DD). */
  minVersion?: string;
}

/**
 * safe:        read-only or trivially reversible.
 * caution:     changes live state (radio, links, bearers); confirm first.
 * destructive: data loss, SIM lockout, process exit or cell outage; confirm
 *              with an explicit warning.
 */
export type Danger = 'safe' | 'caution' | 'destructive';

export type IssueLevel = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  level: IssueLevel;
  /** Dotted path to the field, or '' for the whole message. */
  path: string;
  text: string;
}

export interface CheckContext {
  component: ComponentType;
  /** Server version from the ready banner, if known. */
  serverVersion?: string | null;
}

export interface DangerAssessment {
  level: Danger;
  reasons: string[];
}

export interface ApiCommand {
  message: string;
  components: ComponentType[];
  category: string;
  label: string;
  description: string;
  params?: Record<string, ParamSpec>;
  /** Each inner list: at least one of these keys must be present. */
  oneOf?: string[][];
  /** Body inserted into the editor when the command is picked. */
  example: Record<string, unknown>;
  /** Extra named bodies for common variants. */
  presets?: { label: string; body: Record<string, unknown> }[];
  /** Static danger level; `assess` may raise it based on the body. */
  danger: Danger;
  dangerNote?: string;
  /** True when the message only reads state. */
  readOnly: boolean;
  /** First release documenting this message. */
  minVersion?: string;
  /** e.g. "lteenb 10.6 LTE messages / handover". */
  docRef: string;
  /** The server may hold the response (log_get, ue_get update). */
  longPoll?: boolean;
  /** Free-form accepted keys (config_set, ue_add ...): skip unknown-key warnings. */
  openParams?: boolean;
  notes?: string;
  /** Extra checks beyond the generic param schema. */
  check?: (msg: Record<string, any>, ctx: CheckContext) => ValidationIssue[];
  /** Raise the danger level based on the body. */
  assess?: (msg: Record<string, any>, ctx: CheckContext) => DangerAssessment | null;
}

// ── Legacy template shape ───────────────────────────────────────────────────
// Kept for the older enb/config/* preset lists. New code uses ApiCommand.

export interface CommandParam {
  type: 'number' | 'string' | 'boolean' | 'hex';
  description: string;
  required?: boolean;
  default?: any;
  validator?: (value: any) => boolean;
  min?: number;
  max?: number;
}

export interface CommandTemplate {
  id: string;
  category: string;
  subCategory?: string;
  label: string;
  command: string;
  description: string;
  requiresParams?: boolean;
  params?: Record<string, CommandParam>;
  notes?: string;
  example?: string;
}

export interface CellConfig {
  cell_id: number;
  [key: string]: any;
}
