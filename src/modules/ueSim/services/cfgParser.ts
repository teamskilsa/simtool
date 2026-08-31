// modules/ueSim/services/cfgParser.ts
//
// Parser for Amarisoft ue.cfg files. The format is a permissive JSON dialect
// with C-style preprocessor directives (#define, #if, #endif, #include) and
// C-style comments (/* */, //). Key differences from strict JSON:
//
//   - Keys are unquoted (`bandwidth: 5` instead of `"bandwidth": 5`)
//   - Strings can use double or single quotes (rare but legal)
//   - Trailing commas are allowed
//   - Hex number literals (0x9001) are common for amf, sqn fields
//   - Comments can appear anywhere
//   - The whole file body is a single object literal at the top level
//     (the outermost { ... } is implicit — Amarisoft files start with `{`
//     directly after #defines, and end with `}`)
//
// Strategy:
//   1. Walk the source line by line in a preprocessor pass to:
//        - Strip /* */ and // comments
//        - Resolve #define constants
//        - Evaluate #if / #endif blocks
//        - Inline known #include paths (we leave unknown includes as warnings)
//   2. Tokenise + parse the cleaned source as a single JS-object-literal
//      using a hand-rolled recursive descent parser. We don't use eval() or
//      the Function constructor — both are CSP-unfriendly and a security risk
//      for user-supplied input.
//
// Output:
//   { raw: <plain object>, warnings: string[] }
//
// Errors throw with a line/col message.

import type { ParsedUeCfg } from '../types';

interface PreprocessResult {
  text: string;
  warnings: string[];
}

interface DefineMap {
  [name: string]: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Stage 1 — strip // and /* */ comments in ONE string-aware pass, preserving
// line numbers. A single scanner is essential: comment text often contains
// apostrophes ("don't"), which must not poison the string state used to
// decide whether the *other* comment kind starts.
// ────────────────────────────────────────────────────────────────────────────

function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let inString = false;
  let quote = '';
  while (i < src.length) {
    const ch = src[i];
    const nx = src[i + 1];
    if (inString) {
      if (ch === '\\' && i + 1 < src.length) {
        out += ch + nx;
        i += 2;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = '';
      }
      out += ch;
      i++;
      continue;
    }
    if (ch === '/' && nx === '*') {
      const end = src.indexOf('*/', i + 2);
      // Replace the comment with spaces, preserving newlines
      const block = end < 0 ? src.slice(i) : src.slice(i, end + 2);
      out += block.replace(/[^\n]/g, ' ');
      if (end < 0) return out; // unterminated — rest of file was comment
      i = end + 2;
      continue;
    }
    if (ch === '/' && nx === '/') {
      // Consume to end of line, keeping the newline itself
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      out += ch;
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Stage 3 — preprocessor: #define, #if, #endif, #include
// ────────────────────────────────────────────────────────────────────────────

function preprocess(src: string): PreprocessResult {
  const warnings: string[] = [];
  const defines: DefineMap = {};
  const lines = src.split('\n');
  const out: string[] = [];

  // Stack of include-states for #if/#endif. Top of stack = whether we're
  // currently emitting lines. takenStack tracks whether any branch of the
  // current #if/#elif/#else chain has already been taken.
  const ifStack: boolean[] = [true];
  const takenStack: boolean[] = [true];
  const isEmitting = () => ifStack.every(Boolean);
  const parentEmitting = () => ifStack.slice(0, -1).every(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // #define NAME VALUE
    const defMatch = trimmed.match(/^#\s*define\s+(\w+)\s+(.+?)\s*$/);
    if (defMatch) {
      if (isEmitting()) {
        defines[defMatch[1]] = defMatch[2];
      }
      out.push(''); // preserve line number
      continue;
    }

    // #define NAME — value-less flag define (e.g. `#define TDD`)
    const flagMatch = trimmed.match(/^#\s*define\s+(\w+)\s*$/);
    if (flagMatch) {
      if (isEmitting()) {
        defines[flagMatch[1]] = '1';
      }
      out.push('');
      continue;
    }

    // #ifdef NAME / #ifndef NAME
    const ifdefMatch = trimmed.match(/^#\s*if(n?)def\s+(\w+)\s*$/);
    if (ifdefMatch) {
      const defined = defines[ifdefMatch[2]] != null;
      const truthy = ifdefMatch[1] === 'n' ? !defined : defined;
      ifStack.push(truthy && isEmitting());
      takenStack.push(truthy);
      out.push('');
      continue;
    }

    // #elif EXPR — taken only if no earlier branch in this chain was
    const elifMatch = trimmed.match(/^#\s*elif\s+(.+?)\s*$/);
    if (elifMatch) {
      if (ifStack.length > 1) {
        ifStack.pop();
        const taken = takenStack.pop()!;
        const branch = !taken && evalIfExpr(elifMatch[1], defines);
        ifStack.push(branch && parentEmitting());
        takenStack.push(taken || branch);
      }
      out.push('');
      continue;
    }

    // #if EXPR — supports `#if NAME` and `#if NAME == VALUE`
    const ifMatch = trimmed.match(/^#\s*if\s+(.+?)\s*$/);
    if (ifMatch) {
      const expr = ifMatch[1];
      const truthy = evalIfExpr(expr, defines);
      ifStack.push(truthy && isEmitting());
      takenStack.push(truthy);
      out.push('');
      continue;
    }

    // #else
    if (/^#\s*else\b/.test(trimmed)) {
      if (ifStack.length > 1) {
        ifStack.pop();
        const taken = takenStack.pop()!;
        ifStack.push(!taken && parentEmitting());
        takenStack.push(true);
      }
      out.push('');
      continue;
    }

    // #endif
    if (/^#\s*endif\b/.test(trimmed)) {
      if (ifStack.length > 1) {
        ifStack.pop();
        takenStack.pop();
      }
      out.push('');
      continue;
    }

    // #include "path" — outside any include resolution context, just warn
    const incMatch = trimmed.match(/^#?\s*include\s+["']([^"']+)["']\s*$/);
    if (incMatch) {
      if (isEmitting()) {
        warnings.push(`Unresolved include: "${incMatch[1]}" — fields from this file will be missing.`);
      }
      out.push('');
      continue;
    }

    // Any other #-directive: warn and drop the line instead of letting the
    // raw `#...` text reach the JSON stage (which would hard-fail the parse).
    if (trimmed.startsWith('#')) {
      if (isEmitting()) {
        warnings.push(`Ignored unsupported directive: "${trimmed.slice(0, 60)}"`);
      }
      out.push('');
      continue;
    }

    if (!isEmitting()) {
      out.push('');
      continue;
    }

    // Substitute defines token-by-token (string-aware so we don't replace
    // inside string literals).
    out.push(substituteDefines(raw, defines));
  }

  return { text: out.join('\n'), warnings };
}

function evalIfExpr(expr: string, defines: DefineMap): boolean {
  expr = expr.trim();
  // Form: NAME == VALUE
  const eqMatch = expr.match(/^(\w+)\s*==\s*(.+)$/);
  if (eqMatch) {
    const name = eqMatch[1];
    const want = eqMatch[2].trim();
    return (defines[name] ?? '0') === want;
  }
  // Form: NAME — truthy if defined and non-zero
  if (/^\w+$/.test(expr)) {
    const v = defines[expr];
    if (v == null) return false;
    return v !== '0' && v.toLowerCase() !== 'false';
  }
  // Numeric literal
  if (/^-?\d+$/.test(expr)) return parseInt(expr, 10) !== 0;
  return false;
}

function substituteDefines(line: string, defines: DefineMap): string {
  // Token-aware: only replace identifiers outside strings
  let out = '';
  let i = 0;
  let inString = false;
  let quote = '';
  while (i < line.length) {
    const ch = line[i];
    if (!inString && (ch === '"' || ch === "'")) {
      inString = true;
      quote = ch;
      out += ch;
      i++;
      continue;
    }
    if (inString) {
      if (ch === '\\' && i + 1 < line.length) {
        out += ch + line[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = '';
      }
      out += ch;
      i++;
      continue;
    }
    // Identifier?
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      if (defines[word] != null) {
        out += defines[word];
      } else {
        out += word;
      }
      i = j;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Stage 4 — JSON5-ish recursive-descent parser
// ────────────────────────────────────────────────────────────────────────────

interface Cursor {
  src: string;
  pos: number;
  line: number;
  col: number;
}

function makeCursor(src: string): Cursor {
  return { src, pos: 0, line: 1, col: 1 };
}

function err(c: Cursor, msg: string): never {
  throw new Error(`Parse error at line ${c.line} col ${c.col}: ${msg}`);
}

function advance(c: Cursor, n = 1): void {
  for (let k = 0; k < n; k++) {
    if (c.src[c.pos] === '\n') {
      c.line++;
      c.col = 1;
    } else {
      c.col++;
    }
    c.pos++;
  }
}

function skipWs(c: Cursor): void {
  while (c.pos < c.src.length && /\s/.test(c.src[c.pos])) advance(c);
}

function peek(c: Cursor): string {
  return c.src[c.pos] ?? '';
}

function consume(c: Cursor, ch: string): void {
  if (peek(c) !== ch) err(c, `expected '${ch}', got '${peek(c) || 'EOF'}'`);
  advance(c);
}

function parseValue(c: Cursor): unknown {
  skipWs(c);
  const ch = peek(c);
  if (ch === '{') return parseObject(c);
  if (ch === '[') return parseArray(c);
  if (ch === '"' || ch === "'") return parseString(c);
  if (ch === '-' || (ch >= '0' && ch <= '9')) return parseNumber(c);
  // identifier — true / false / null or bareword
  if (/[A-Za-z_]/.test(ch)) {
    const id = parseIdentifier(c);
    if (id === 'true') return true;
    if (id === 'false') return false;
    if (id === 'null') return null;
    // Bareword used as a value — Amarisoft sometimes uses unquoted strings
    return id;
  }
  err(c, `unexpected character '${ch}'`);
}

function parseObject(c: Cursor): Record<string, unknown> {
  consume(c, '{');
  const obj: Record<string, unknown> = {};
  skipWs(c);
  while (peek(c) !== '}') {
    skipWs(c);
    if (peek(c) === '}') break;
    // Key
    let key: string;
    const ch = peek(c);
    if (ch === '"' || ch === "'") {
      key = parseString(c);
    } else if (/[A-Za-z_]/.test(ch)) {
      key = parseIdentifier(c);
    } else {
      err(c, `expected key, got '${ch || 'EOF'}'`);
    }
    skipWs(c);
    consume(c, ':');
    const value = parseValue(c);
    obj[key] = value;
    skipWs(c);
    if (peek(c) === ',') {
      advance(c);
      skipWs(c);
      continue;
    }
    break;
  }
  skipWs(c);
  consume(c, '}');
  return obj;
}

function parseArray(c: Cursor): unknown[] {
  consume(c, '[');
  const arr: unknown[] = [];
  skipWs(c);
  while (peek(c) !== ']') {
    skipWs(c);
    if (peek(c) === ']') break;
    arr.push(parseValue(c));
    skipWs(c);
    if (peek(c) === ',') {
      advance(c);
      skipWs(c);
      continue;
    }
    break;
  }
  skipWs(c);
  consume(c, ']');
  return arr;
}

function parseString(c: Cursor): string {
  const quote = peek(c);
  if (quote !== '"' && quote !== "'") err(c, `expected string`);
  advance(c);
  let out = '';
  while (c.pos < c.src.length && peek(c) !== quote) {
    if (peek(c) === '\\') {
      advance(c);
      const esc = peek(c);
      const map: Record<string, string> = {
        n: '\n', r: '\r', t: '\t', b: '\b', f: '\f',
        '"': '"', "'": "'", '\\': '\\', '/': '/',
      };
      if (esc in map) {
        out += map[esc];
        advance(c);
      } else {
        out += esc;
        advance(c);
      }
      continue;
    }
    out += peek(c);
    advance(c);
  }
  if (peek(c) !== quote) err(c, `unterminated string`);
  advance(c);
  return out;
}

function parseNumber(c: Cursor): number {
  let s = '';
  if (peek(c) === '-') { s += '-'; advance(c); }
  // Hex literal 0xNN
  if (peek(c) === '0' && (c.src[c.pos + 1] === 'x' || c.src[c.pos + 1] === 'X')) {
    s += '0x';
    advance(c, 2);
    while (c.pos < c.src.length && /[0-9a-fA-F]/.test(peek(c))) {
      s += peek(c);
      advance(c);
    }
    return parseInt(s, 16);
  }
  while (c.pos < c.src.length && /[0-9]/.test(peek(c))) {
    s += peek(c);
    advance(c);
  }
  if (peek(c) === '.') {
    s += '.';
    advance(c);
    while (c.pos < c.src.length && /[0-9]/.test(peek(c))) {
      s += peek(c);
      advance(c);
    }
  }
  if (peek(c) === 'e' || peek(c) === 'E') {
    s += peek(c);
    advance(c);
    if (peek(c) === '+' || peek(c) === '-') {
      s += peek(c);
      advance(c);
    }
    while (c.pos < c.src.length && /[0-9]/.test(peek(c))) {
      s += peek(c);
      advance(c);
    }
  }
  const n = Number(s);
  if (Number.isNaN(n)) err(c, `invalid number "${s}"`);
  return n;
}

function parseIdentifier(c: Cursor): string {
  let s = '';
  while (c.pos < c.src.length && /[A-Za-z0-9_]/.test(peek(c))) {
    s += peek(c);
    advance(c);
  }
  return s;
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

export function parseUeCfg(source: string): ParsedUeCfg {
  // Stages 1–3
  const noComments = stripComments(source);
  const { text, warnings } = preprocess(noComments);

  // The cfg may or may not have a leading { after the #defines. Normalise.
  const trimmed = text.trim();
  const wrapped = trimmed.startsWith('{') ? trimmed : `{${trimmed}}`;

  const cursor = makeCursor(wrapped);
  const obj = parseObject(cursor);

  return {
    raw: obj,
    warnings,
  };
}
