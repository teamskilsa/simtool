// Pre-send validation of remote API requests against the 2026-09-11 catalogue.
//
// The console lets the user type any JSON, so this never silently rewrites a
// request. It reports:
//   error    -> the server would reject it (missing/badly typed/out of range
//               parameter, message newer than the server). Send is blocked.
//   warning  -> probably not what you meant (unknown key, alias, SIM-locking
//               default). Send allowed.
//   info     -> context (long-poll behaviour, alias accepted ...).
// and a danger level that drives the confirm dialog.
import {
  COMMON_REQUEST_PARAMS,
  COMPONENT_TYPES,
  findCommand,
  type ApiCommand,
  type CheckContext,
  type ComponentType,
  type Danger,
  type DangerAssessment,
  type ParamSpec,
  type ParamType,
  type ValidationIssue,
} from '../../../shared/default/templates/remoteapi';
import { versionAtLeast } from './version';
import type { RemoteAPIMessage } from '../types';

export interface RequestReport {
  index: number;
  message?: string;
  command?: ApiCommand;
  issues: ValidationIssue[];
  danger: DangerAssessment;
}

export interface ValidationReport {
  /** false when any error exists; the console refuses to send. */
  ok: boolean;
  /** Parsed request(s) in send order (only objects with a string `message`). */
  messages: RemoteAPIMessage[];
  /** true when the input was a JSON array (sent as one batch frame). */
  batch: boolean;
  items: RequestReport[];
  /** All issues, paths prefixed with `[i]` for batches. */
  issues: ValidationIssue[];
  danger: DangerAssessment;
}

const DANGER_RANK: Record<Danger, number> = { safe: 0, caution: 1, destructive: 2 };

export function maxDanger(a: Danger, b: Danger): Danger {
  return DANGER_RANK[a] >= DANGER_RANK[b] ? a : b;
}

export function parseRequestText(text: string): { value?: unknown; error?: string } {
  const t = text.trim();
  if (!t) return { error: 'Empty request' };
  try {
    return { value: JSON.parse(t) };
  } catch (e) {
    return { error: `Invalid JSON: ${(e as Error).message}` };
  }
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function matchesType(v: unknown, t: ParamType): boolean {
  switch (t) {
    case 'any': return v !== undefined;
    case 'integer': return typeof v === 'number' && Number.isInteger(v);
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'string': return typeof v === 'string';
    case 'boolean': return typeof v === 'boolean';
    case 'array': return Array.isArray(v);
    case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
  }
}

function checkValue(path: string, v: unknown, spec: ParamSpec, ctx: CheckContext): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const types = Array.isArray(spec.type) ? spec.type : [spec.type];
  if (!types.some(t => matchesType(v, t))) {
    out.push({ level: 'error', path, text: `expected ${types.join(' or ')}, got ${typeOf(v)}` });
    return out;
  }
  const scalars = Array.isArray(v) ? v : [v];
  if (Array.isArray(v) && spec.items) {
    v.forEach((item, i) => {
      if (!matchesType(item, spec.items!)) out.push({ level: 'error', path: `${path}[${i}]`, text: `expected ${spec.items}, got ${typeOf(item)}` });
    });
  }
  for (const s of scalars) {
    if (typeof s === 'number') {
      if (spec.min !== undefined && s < spec.min) out.push({ level: 'error', path, text: `${s} is below the minimum ${spec.min}${rangeText(spec)}` });
      if (spec.max !== undefined && s > spec.max) out.push({ level: 'error', path, text: `${s} is above the maximum ${spec.max}${rangeText(spec)}` });
    }
    if (spec.enum && (typeof s === 'string' || typeof s === 'number') && !spec.enum.includes(s)) {
      out.push({ level: 'error', path, text: `"${s}" is not one of ${spec.enum.join(', ')}` });
    }
    if (spec.pattern && typeof s === 'string' && !new RegExp(spec.pattern).test(s)) {
      out.push({ level: 'error', path, text: `"${s}" does not match ${spec.pattern}` });
    }
  }
  if (spec.minVersion && ctx.serverVersion && !versionAtLeast(ctx.serverVersion, spec.minVersion)) {
    out.push({ level: 'error', path, text: `${path} needs release ${spec.minVersion} or later; server runs ${ctx.serverVersion}` });
  }
  return out;
}

function rangeText(spec: ParamSpec) {
  return spec.min !== undefined && spec.max !== undefined ? ` (range [${spec.min}:${spec.max}])` : '';
}

/** Which catalogue components document this message (for "wrong server" hints). */
function componentsWith(message: string): ComponentType[] {
  return COMPONENT_TYPES.filter(c => findCommand(c, message));
}

export function validateOne(msg: unknown, ctx: CheckContext, index = 0): RequestReport {
  const issues: ValidationIssue[] = [];
  const safe: DangerAssessment = { level: 'safe', reasons: [] };
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
    return { index, issues: [{ level: 'error', path: '', text: 'Each request must be a JSON object' }], danger: safe };
  }
  const m = msg as Record<string, any>;
  if (typeof m.message !== 'string' || !m.message) {
    return { index, issues: [{ level: 'error', path: 'message', text: 'message (string) is mandatory' }], danger: safe };
  }

  // Common request envelope.
  for (const [key, spec] of Object.entries(COMMON_REQUEST_PARAMS)) {
    if (key === 'message' || m[key] === undefined) continue;
    issues.push(...checkValue(key, m[key], spec, ctx));
  }
  if (typeof m.loop_count === 'number' && m.loop_count > 0 && m.loop_delay === undefined) {
    issues.push({ level: 'error', path: 'loop_delay', text: 'loop_delay is mandatory when loop_count > 0' });
  }
  if (m.absolute_time === true && m.start_time === undefined) {
    issues.push({ level: 'warning', path: 'absolute_time', text: 'absolute_time has no effect without start_time' });
  }

  const command = findCommand(ctx.component, m.message);
  if (!command) {
    const elsewhere = componentsWith(m.message);
    issues.push({
      level: 'warning',
      path: 'message',
      text: elsewhere.length
        ? `"${m.message}" is a ${elsewhere.join('/')} message, not ${ctx.component}; the server will answer "Unknown message"`
        : `"${m.message}" is not in the 2026-09-11 ${ctx.component} docs; it is sent unchecked`,
    });
    const unknownDanger: DangerAssessment = { level: 'caution', reasons: [`"${m.message}" is not catalogued, so its effect is unknown.`] };
    return { index, message: m.message, issues, danger: unknownDanger };
  }

  if (command.minVersion && ctx.serverVersion && !versionAtLeast(ctx.serverVersion, command.minVersion)) {
    issues.push({ level: 'error', path: 'message', text: `${m.message} was added in ${command.minVersion}; server runs ${ctx.serverVersion}` });
  }

  const params = command.params ?? {};
  const known = new Set<string>(Object.keys(COMMON_REQUEST_PARAMS));
  for (const [name, spec] of Object.entries(params)) {
    known.add(name);
    const aliases = spec.aliases ?? [];
    aliases.forEach(a => known.add(a));
    const presentKey = m[name] !== undefined ? name : aliases.find(a => m[a] !== undefined);
    if (presentKey === undefined) {
      if (spec.required) issues.push({ level: 'error', path: name, text: `${name} is required: ${spec.help}` });
      continue;
    }
    if (presentKey !== name) {
      issues.push({ level: 'info', path: presentKey, text: `the docs name this field ${name}; ${presentKey} is accepted as an alias` });
    }
    issues.push(...checkValue(presentKey, m[presentKey], spec, ctx));
  }
  for (const group of command.oneOf ?? []) {
    if (!group.some(k => m[k] !== undefined)) {
      issues.push({ level: 'error', path: group[0], text: `one of ${group.join(' / ')} is required` });
    }
  }
  if (!command.openParams) {
    for (const key of Object.keys(m)) {
      if (!known.has(key)) issues.push({ level: 'warning', path: key, text: `${key} is not a documented ${m.message} parameter` });
    }
  }
  if (command.check) issues.push(...command.check(m, ctx));

  // Danger: static level, unless the body-based assessment decides.
  const assessed = command.assess?.(m, ctx) ?? null;
  const danger: DangerAssessment = assessed ?? {
    level: command.danger,
    reasons: command.danger === 'safe' ? [] : [command.dangerNote ?? `${m.message} changes live state.`],
  };
  if (assessed && assessed.level !== 'safe' && command.dangerNote && !assessed.reasons.includes(command.dangerNote)) {
    danger.reasons = [...assessed.reasons, command.dangerNote];
  }
  if (m.loop_count > 0 && danger.level !== 'safe') {
    danger.reasons = [...danger.reasons, `Repeated ${m.loop_count} times every ${m.loop_delay}s.`];
  }
  if (m.standalone === true && danger.level !== 'safe') {
    danger.reasons = [...danger.reasons, 'standalone: keeps running after this connection closes.'];
  }

  return { index, message: m.message, command, issues, danger };
}

export function validateRequest(input: unknown, ctx: CheckContext): ValidationReport {
  const batch = Array.isArray(input);
  const list = batch ? (input as unknown[]) : [input];
  const items = list.map((m, i) => validateOne(m, ctx, i));
  const issues: ValidationIssue[] = [];
  if (batch && list.length === 0) issues.push({ level: 'error', path: '', text: 'Empty message array' });
  for (const it of items) {
    for (const iss of it.issues) {
      issues.push(batch ? { ...iss, path: `[${it.index}]${iss.path ? '.' + iss.path : ''}` } : iss);
    }
  }

  let level: Danger = 'safe';
  const reasons: string[] = [];
  for (const it of items) {
    level = maxDanger(level, it.danger.level);
    for (const r of it.danger.reasons) {
      const line = batch ? `[${it.index}] ${it.message ?? '?'}: ${r}` : r;
      if (!reasons.includes(line)) reasons.push(line);
    }
  }

  // Batch-level: muting several cells at once.
  const muted = list.filter((m: any) => m && m.message === 'cell_gain' && typeof m.gain === 'number' && m.gain <= -100);
  if (muted.length >= 2) {
    level = 'destructive';
    reasons.unshift(`Mutes ${muted.length} cells in one go (cell_gain <= -100 dB on cells ${muted.map((m: any) => m.cell_id).join(', ')}).`);
  }

  const messages = list.filter((m): m is RemoteAPIMessage => !!m && typeof m === 'object' && !Array.isArray(m) && typeof (m as any).message === 'string');
  return {
    ok: !issues.some(i => i.level === 'error'),
    messages,
    batch,
    items,
    issues,
    danger: { level, reasons },
  };
}
