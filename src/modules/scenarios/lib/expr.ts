// Placeholder and condition evaluation for Mobility Scenarios. Shared by the
// server runner and the editor's validator, so no Node imports here.
//
// The context a run exposes (see server/runner.ts):
//   ue.{connected, enb_ue_id, ran_ue_id, mme_ue_id, pcell, scells, scellList,
//       contexts, rnti, imsi, imei, ip, registered}
//   mme.{registered, mme_ue_id, enb_ue_id, tac, m_tmsi, imsi, imeisv, ip}
//   enb.{ue_count}
//   cells[N].{id, pci, earfcn, band, gain, eci, tac}   — sorted by cell id
//   cellCount, cellById.<id>.{…}
//   params.*, vars.*, reply.<saveAs>.*, phone.{pci, earfcn, rsrp}
//   loop.i (innermost, 0-based), loop.n, marks.<name> (ms timestamps), now
//
// Expressions: numbers, 'strings', paths (a.b[expr].c), + - * / %, unary -,
// parentheses. No function calls, no assignment — nothing to escape into.
import type { Condition, LeafCondition } from '../types';

type Tok = { k: 'num'; v: number } | { k: 'str'; v: string } | { k: 'id'; v: string } | { k: 'op'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ k: 'num', v: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$-]/.test(src[j])) {
        // "a-b" is subtraction, not an identifier, unless no spaces are used
        // in a key like "s-tmsi"; treat '-' as part of the identifier only
        // when directly followed by a letter.
        if (src[j] === '-' && !/[A-Za-z]/.test(src[j + 1] ?? '')) break;
        j++;
      }
      out.push({ k: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "'" || c === '"') {
      const j = src.indexOf(c, i + 1);
      if (j < 0) throw new Error(`Unterminated string in "${src}"`);
      out.push({ k: 'str', v: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if ('+-*/%()[].'.includes(c)) { out.push({ k: 'op', v: c }); i++; continue; }
    throw new Error(`Unexpected "${c}" in expression "${src}"`);
  }
  return out;
}

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function member(obj: unknown, key: string | number): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (typeof key === 'string' && UNSAFE_KEYS.has(key)) throw new Error(`"${key}" is not allowed`);
  if (Array.isArray(obj) && key === 'length') return obj.length;
  if (typeof obj === 'string' && key === 'length') return obj.length;
  if (typeof obj !== 'object') return undefined;
  return Object.prototype.hasOwnProperty.call(obj, key) ? (obj as any)[key] : undefined;
}

export function evaluate(expr: string, ctx: Record<string, unknown>): unknown {
  const toks = tokenize(expr);
  let p = 0;
  const peek = () => toks[p];
  const eat = (v: string) => {
    const t = toks[p];
    if (!t || t.k !== 'op' || t.v !== v) throw new Error(`Expected "${v}" in "${expr}"`);
    p++;
  };
  const num = (v: unknown, op: string) => {
    const n = typeof v === 'number' ? v : Number(v);
    if (v === undefined || v === null || v === '' || !Number.isFinite(n)) {
      throw new Error(`"${op}" needs numbers in "${expr}" (got ${JSON.stringify(v)})`);
    }
    return n;
  };

  function primary(): unknown {
    const t = toks[p];
    if (!t) throw new Error(`Unexpected end of "${expr}"`);
    if (t.k === 'num') { p++; return t.v; }
    if (t.k === 'str') { p++; return t.v; }
    if (t.k === 'op' && t.v === '(') { p++; const v = additive(); eat(')'); return postfix(v); }
    if (t.k === 'id') {
      p++;
      if (t.v === 'true') return true;
      if (t.v === 'false') return false;
      if (t.v === 'null') return null;
      if (UNSAFE_KEYS.has(t.v)) throw new Error(`"${t.v}" is not allowed`);
      return postfix(Object.prototype.hasOwnProperty.call(ctx, t.v) ? ctx[t.v] : undefined);
    }
    throw new Error(`Unexpected "${t.v}" in "${expr}"`);
  }
  function postfix(v: unknown): unknown {
    for (;;) {
      const t = peek();
      if (t?.k === 'op' && t.v === '.') {
        p++;
        const id = toks[p++];
        if (!id || (id.k !== 'id' && id.k !== 'num')) throw new Error(`Expected a name after "." in "${expr}"`);
        v = member(v, String(id.v));
      } else if (t?.k === 'op' && t.v === '[') {
        p++;
        const key = additive();
        eat(']');
        v = member(v, typeof key === 'number' ? key : String(key));
      } else return v;
    }
  }
  function unary(): unknown {
    const t = peek();
    if (t?.k === 'op' && t.v === '-') { p++; return -num(unary(), '-'); }
    return primary();
  }
  function multiplicative(): unknown {
    let v = unary();
    for (;;) {
      const t = peek();
      if (t?.k !== 'op' || !'*/%'.includes(t.v) || t.v === '') return v;
      p++;
      const r = num(unary(), t.v);
      const l = num(v, t.v);
      if ((t.v === '/' || t.v === '%') && r === 0) throw new Error(`Division by zero in "${expr}"`);
      v = t.v === '*' ? l * r : t.v === '/' ? l / r : ((l % r) + r) % r;
    }
  }
  function additive(): unknown {
    let v = multiplicative();
    for (;;) {
      const t = peek();
      if (t?.k !== 'op' || (t.v !== '+' && t.v !== '-')) return v;
      p++;
      const r = multiplicative();
      v = t.v === '+' && (typeof v === 'string' || typeof r === 'string')
        ? `${v}${r}` : t.v === '+' ? num(v, '+') + num(r, '+') : num(v, '-') - num(r, '-');
    }
  }

  const v = additive();
  if (p !== toks.length) throw new Error(`Unexpected "${(toks[p] as any).v}" in "${expr}"`);
  return v;
}

const WHOLE = /^\$\{([^{}]+)\}$/;
const EMBEDDED = /\$\{([^{}]+)\}/g;

/** Resolve ${…} in a string. A string that is exactly one placeholder keeps the value's type. */
export function resolveString(s: string, ctx: Record<string, unknown>): unknown {
  const whole = s.match(WHOLE);
  if (whole) {
    const v = evaluate(whole[1], ctx);
    if (v === undefined) throw new Error(`\${${whole[1]}} is undefined`);
    return v;
  }
  return s.replace(EMBEDDED, (_m, e) => {
    const v = evaluate(e, ctx);
    if (v === undefined) throw new Error(`\${${e}} is undefined`);
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  });
}

/** Deep-resolve placeholders in any JSON value, including object keys. */
export function resolveDeep<T = unknown>(value: T, ctx: Record<string, unknown>): T {
  if (typeof value === 'string') return resolveString(value, ctx) as T;
  if (Array.isArray(value)) return value.map(v => resolveDeep(v, ctx)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const key = String(k.includes('${') ? resolveString(k, ctx) : k);
      if (UNSAFE_KEYS.has(key)) throw new Error(`"${key}" is not allowed as a key`);
      out[key] = resolveDeep(v, ctx);
    }
    return out as T;
  }
  return value;
}

export const hasPlaceholder = (v: unknown): boolean =>
  typeof v === 'string' ? v.includes('${')
    : Array.isArray(v) ? v.some(hasPlaceholder)
      : v && typeof v === 'object' ? Object.entries(v).some(([k, x]) => k.includes('${') || hasPlaceholder(x))
        : false;

/** Every expression inside ${…} (for validation). */
export function placeholderExprs(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') { for (const m of v.matchAll(EMBEDDED)) out.push(m[1]); }
  else if (Array.isArray(v)) v.forEach(x => placeholderExprs(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) { placeholderExprs(k, out); placeholderExprs(x, out); }
  }
  return out;
}

/** Syntax check only (unknown paths are fine — they depend on the run). */
export function checkExpr(expr: string): string | null {
  try { tokenize(expr); evaluate(expr, new Proxy({}, { has: () => true, get: () => 1 }) as any); return null; }
  catch (e: any) {
    const m = String(e?.message ?? e);
    return /needs numbers|Division by zero|is undefined/.test(m) ? null : m;
  }
}

// ─── Conditions ─────────────────────────────────────────────────────────────
const isLeaf = (c: Condition): c is LeafCondition => typeof (c as LeafCondition).path === 'string';

const eqLoose = (a: unknown, b: unknown) => {
  if (a === b) return true;
  if (typeof a === 'number' || typeof b === 'number') {
    const x = Number(a), y = Number(b);
    return a !== null && b !== null && a !== '' && b !== '' && Number.isFinite(x) && x === y;
  }
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return false;
};

export interface CondResult { ok: boolean; detail: string }

export function evalCondition(cond: Condition, ctx: Record<string, unknown>): CondResult {
  if (!isLeaf(cond)) {
    if ('all' in cond) {
      const rs = cond.all.map(c => evalCondition(c, ctx));
      return { ok: rs.every(r => r.ok), detail: rs.map(r => r.detail).join(' and ') };
    }
    if ('any' in cond) {
      const rs = cond.any.map(c => evalCondition(c, ctx));
      return { ok: rs.some(r => r.ok), detail: `(${rs.map(r => r.detail).join(' or ')})` };
    }
    if ('not' in cond) {
      const r = evalCondition(cond.not, ctx);
      return { ok: !r.ok, detail: `not(${r.detail})` };
    }
    return { ok: false, detail: 'invalid condition' };
  }
  let left: unknown;
  try { left = evaluate(cond.path, ctx); } catch (e: any) { return { ok: false, detail: `${cond.path}: ${e.message}` }; }
  let right: unknown = cond.value;
  try { right = resolveDeep(cond.value, ctx); } catch (e: any) { return { ok: false, detail: `value: ${e.message}` }; }
  const show = (v: unknown) => (v === undefined ? 'undefined' : JSON.stringify(v));
  const l = Number(left), r = Number(right);
  const numeric = left !== null && left !== undefined && left !== '' && Number.isFinite(l) && Number.isFinite(r);
  let ok: boolean;
  switch (cond.op) {
    case 'eq': ok = eqLoose(left, right); break;
    case 'ne': ok = !eqLoose(left, right); break;
    case 'gt': ok = numeric && l > r; break;
    case 'gte': ok = numeric && l >= r; break;
    case 'lt': ok = numeric && l < r; break;
    case 'lte': ok = numeric && l <= r; break;
    case 'in': ok = Array.isArray(right) && right.some(x => eqLoose(left, x)); break;
    case 'nin': ok = Array.isArray(right) && !right.some(x => eqLoose(left, x)); break;
    case 'exists': ok = left !== undefined && left !== null; break;
    case 'absent': ok = left === undefined || left === null; break;
    case 'truthy': ok = !!left && !(Array.isArray(left) && left.length === 0); break;
    case 'falsy': ok = !left || (Array.isArray(left) && left.length === 0); break;
    case 'match': try { ok = new RegExp(String(right)).test(String(left ?? '')); } catch { ok = false; } break;
    case 'contains': ok = Array.isArray(left) ? left.some(x => eqLoose(x, right))
      : typeof left === 'string' && left.includes(String(right)); break;
    default: ok = false;
  }
  const rhs = ['exists', 'absent', 'truthy', 'falsy'].includes(cond.op) ? '' : ` ${show(right)}`;
  return { ok, detail: `${cond.path}=${show(left)} ${cond.op}${rhs}` };
}

/** Does the condition (or any placeholder in it) read from a given root, e.g. "ue"? */
export function conditionReads(cond: Condition | undefined, root: string): boolean {
  if (!cond) return false;
  const re = new RegExp(`(^|[^A-Za-z0-9_.])${root}\\b`);
  return re.test(JSON.stringify(cond).replace(/"path":"/g, '"path":" '));
}
