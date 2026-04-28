// Amarisoft .cfg parser — converts a raw enb.cfg / gnb.cfg / mme.cfg into a JS object.
//
// The Amarisoft config format is C-flavoured pseudo-JSON:
//   - C preprocessor (#define, #if, #ifdef, #ifndef, #else, #elif, #endif)
//   - `include "path"` directives (we ignore — separate file)
//   - C/C++ comments (//, /* */)
//   - Unquoted object keys (cell_id: 1)
//   - Hex literals (0x1A2D0)
//   - Bare identifier values (true, false, null, or a token like "milenage")
//   - Trailing commas allowed
//
// This module is dependency-free and runs in both Node and browser.

// ─── Preprocessor ───────────────────────────────────────────────────────────

/**
 * Run a small subset of C preprocessor over the source so the parser only
 * sees one branch of every #if/#else block. Best-effort:
 *   - tracks `#define KEY VALUE` (numeric or token) for use in `#if KEY == VAL`
 *   - `#ifdef KEY` / `#ifndef KEY` checked against the symbol table
 *   - unknown conditions default to TRUE (we keep the #if branch and drop #else)
 *   - `include "..."` lines are stripped
 */
function preprocess(src: string): string {
  const defines: Record<string, string> = {};
  const out: string[] = [];
  // Each frame represents one #if level. `active` is the current branch's
  // emit-status; `taken` records whether ANY branch at this level has fired.
  const stack: { active: boolean; taken: boolean; parentActive: boolean }[] = [
    { active: true, taken: true, parentActive: true },
  ];

  const isActive = () => stack[stack.length - 1].active;

  const evalCond = (cond: string): boolean => {
    cond = cond.trim();
    // KEY == VAL  /  KEY != VAL
    let m = cond.match(/^(\w+)\s*(==|!=)\s*(\w+|\d+|0x[0-9a-fA-F]+)$/);
    if (m) {
      const [, key, op, valTok] = m;
      const lhs = defines[key];
      if (lhs === undefined) return op !== '==';
      // Compare numerically when possible
      const lhsNum = Number(lhs);
      const rhsNum = Number(valTok);
      if (!isNaN(lhsNum) && !isNaN(rhsNum)) {
        return op === '==' ? lhsNum === rhsNum : lhsNum !== rhsNum;
      }
      return op === '==' ? lhs === valTok : lhs !== valTok;
    }
    // defined(KEY)
    m = cond.match(/^defined\s*\(\s*(\w+)\s*\)$/);
    if (m) return defines[m[1]] !== undefined;
    // bare identifier — true if defined and non-zero
    m = cond.match(/^(\w+)$/);
    if (m) {
      const v = defines[m[1]];
      if (v === undefined) return false;
      const n = Number(v);
      return isNaN(n) ? Boolean(v) : n !== 0;
    }
    // Anything more complex — default to true so we don't drop user content
    return true;
  };

  for (const rawLine of src.split('\n')) {
    const trimmed = rawLine.trim();

    // ── Directives ────────────────────────────────────────────────────────
    // #define KEY VALUE
    let m = trimmed.match(/^#\s*define\s+(\w+)\s+(.+?)(?:\s*\/\/.*|\s*\/\*.*\*\/\s*)?$/);
    if (m && isActive()) {
      defines[m[1]] = m[2].trim();
      continue;
    }
    if (/^#\s*define\b/.test(trimmed)) continue;

    // #undef KEY
    m = trimmed.match(/^#\s*undef\s+(\w+)/);
    if (m) { if (isActive()) delete defines[m[1]]; continue; }

    // #if cond
    m = trimmed.match(/^#\s*if\s+(.+)$/);
    if (m) {
      const parentActive = isActive();
      const cond = parentActive ? evalCond(m[1]) : false;
      stack.push({ active: cond, taken: cond, parentActive });
      continue;
    }
    // #ifdef KEY
    m = trimmed.match(/^#\s*ifdef\s+(\w+)/);
    if (m) {
      const parentActive = isActive();
      const cond = parentActive ? defines[m[1]] !== undefined : false;
      stack.push({ active: cond, taken: cond, parentActive });
      continue;
    }
    // #ifndef KEY
    m = trimmed.match(/^#\s*ifndef\s+(\w+)/);
    if (m) {
      const parentActive = isActive();
      const cond = parentActive ? defines[m[1]] === undefined : false;
      stack.push({ active: cond, taken: cond, parentActive });
      continue;
    }
    // #elif cond
    m = trimmed.match(/^#\s*elif\s+(.+)$/);
    if (m) {
      const cur = stack[stack.length - 1];
      if (!cur.parentActive) { cur.active = false; continue; }
      if (cur.taken) { cur.active = false; continue; }
      const cond = evalCond(m[1]);
      cur.active = cond;
      if (cond) cur.taken = true;
      continue;
    }
    // #else
    if (/^#\s*else\b/.test(trimmed)) {
      const cur = stack[stack.length - 1];
      cur.active = cur.parentActive && !cur.taken;
      if (cur.active) cur.taken = true;
      continue;
    }
    // #endif
    if (/^#\s*endif\b/.test(trimmed)) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    // #include / #pragma / other — drop
    if (/^#\s*\w+/.test(trimmed)) continue;
    // bare `include "..."` (Amarisoft-specific, no #)
    if (/^include\s+["'].+["']/.test(trimmed)) continue;

    if (isActive()) out.push(rawLine);
  }

  // ── Macro substitution: replace defined identifiers with their values ──
  // Walk character-by-character so we never substitute inside strings or
  // comments. This is necessary for things like `n_rb_dl: N_RB_DL,`.
  const text = out.join('\n');
  if (Object.keys(defines).length === 0) return text;

  // Sort keys longest-first so partial matches don't shadow longer ones
  const keys = Object.keys(defines).sort((a, b) => b.length - a.length);
  const result: string[] = [];
  let i = 0;
  const len = text.length;
  while (i < len) {
    const c = text[i];
    // Skip strings
    if (c === '"' || c === "'") {
      const quote = c; result.push(c); i++;
      while (i < len && text[i] !== quote) {
        if (text[i] === '\\' && i + 1 < len) { result.push(text[i], text[i + 1]); i += 2; continue; }
        result.push(text[i++]);
      }
      if (i < len) { result.push(text[i]); i++; }
      continue;
    }
    // Skip line comments
    if (c === '/' && text[i + 1] === '/') {
      while (i < len && text[i] !== '\n') { result.push(text[i++]); }
      continue;
    }
    // Skip block comments
    if (c === '/' && text[i + 1] === '*') {
      result.push(text[i], text[i + 1]); i += 2;
      while (i < len && !(text[i] === '*' && text[i + 1] === '/')) { result.push(text[i++]); }
      if (i < len) { result.push(text[i], text[i + 1]); i += 2; }
      continue;
    }
    // Try macro at word boundary
    if (/[A-Za-z_]/.test(c) && (i === 0 || !/[A-Za-z0-9_]/.test(text[i - 1]))) {
      let matched = false;
      for (const k of keys) {
        if (text.startsWith(k, i) && (i + k.length >= len || !/[A-Za-z0-9_]/.test(text[i + k.length]))) {
          result.push(defines[k]);
          i += k.length;
          matched = true;
          break;
        }
      }
      if (matched) continue;
    }
    result.push(c); i++;
  }
  return result.join('');
}

// ─── Lexer ──────────────────────────────────────────────────────────────────

type Token =
  | { type: 'LBRACE' | 'RBRACE' | 'LBRACKET' | 'RBRACKET' | 'COLON' | 'COMMA' | 'EOF'; pos: number }
  | { type: 'STRING'; value: string; pos: number }
  | { type: 'NUMBER'; value: number; pos: number }
  | { type: 'IDENT'; value: string; pos: number };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = src.length;

  while (i < len) {
    const c = src[i];

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }

    // Comments
    if (c === '/' && src[i + 1] === '/') {
      while (i < len && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < len && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // Punctuation
    if (c === '{') { tokens.push({ type: 'LBRACE', pos: i }); i++; continue; }
    if (c === '}') { tokens.push({ type: 'RBRACE', pos: i }); i++; continue; }
    if (c === '[') { tokens.push({ type: 'LBRACKET', pos: i }); i++; continue; }
    if (c === ']') { tokens.push({ type: 'RBRACKET', pos: i }); i++; continue; }
    if (c === ':') { tokens.push({ type: 'COLON', pos: i }); i++; continue; }
    if (c === ',') { tokens.push({ type: 'COMMA', pos: i }); i++; continue; }
    if (c === ';') { i++; continue; }   // Amarisoft sometimes uses semicolons

    // String literal
    if (c === '"') {
      const startPos = i;
      i++;
      let s = '';
      while (i < len && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < len) {
          const esc = src[i + 1];
          s += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '\r' : esc;
          i += 2;
          continue;
        }
        s += src[i++];
      }
      i++; // consume closing "
      tokens.push({ type: 'STRING', value: s, pos: startPos });
      continue;
    }

    // Number (decimal / hex / float / negative)
    if (c === '-' || (c >= '0' && c <= '9')) {
      const startPos = i;
      let n = '';
      if (c === '-') { n += c; i++; }
      if (src[i] === '0' && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
        n += src[i] + src[i + 1]; i += 2;
        while (i < len && /[0-9a-fA-F]/.test(src[i])) n += src[i++];
        tokens.push({ type: 'NUMBER', value: parseInt(n.replace('-', ''), 16) * (n.startsWith('-') ? -1 : 1), pos: startPos });
        continue;
      }
      while (i < len && /[0-9.eE+\-]/.test(src[i]) && !(src[i] === '-' && i !== startPos)) {
        if (src[i] === '+' && i !== startPos && src[i - 1] !== 'e' && src[i - 1] !== 'E') break;
        if (src[i] === '-' && i !== startPos && src[i - 1] !== 'e' && src[i - 1] !== 'E') break;
        n += src[i++];
      }
      const num = parseFloat(n);
      if (isNaN(num)) {
        // Not actually a number — emit as ident
        tokens.push({ type: 'IDENT', value: n, pos: startPos });
      } else {
        tokens.push({ type: 'NUMBER', value: num, pos: startPos });
      }
      continue;
    }

    // Identifier / keyword
    if (/[A-Za-z_]/.test(c)) {
      const startPos = i;
      let id = '';
      while (i < len && /[A-Za-z0-9_]/.test(src[i])) id += src[i++];
      tokens.push({ type: 'IDENT', value: id, pos: startPos });
      continue;
    }

    // Skip unrecognised char
    i++;
  }

  tokens.push({ type: 'EOF', pos: i });
  return tokens;
}

// ─── Parser ─────────────────────────────────────────────────────────────────

class CfgParser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek() { return this.tokens[this.pos]; }
  private advance() { return this.tokens[this.pos++]; }
  private consume(type: Token['type']) {
    const t = this.tokens[this.pos];
    if (t.type !== type) throw new Error(`Parser: expected ${type} at ${t.pos}, got ${t.type}`);
    this.pos++;
    return t;
  }

  parseRoot(): any {
    // Skip junk before the root object (rare, but Amarisoft headers can include floating tokens)
    while (this.peek().type !== 'LBRACE' && this.peek().type !== 'EOF') this.advance();
    if (this.peek().type !== 'LBRACE') throw new Error('Parser: no root object found');
    return this.parseObject();
  }

  private parseValue(): any {
    const t = this.peek();
    switch (t.type) {
      case 'LBRACE':   return this.parseObject();
      case 'LBRACKET': return this.parseArray();
      case 'STRING':   this.advance(); return t.value;
      case 'NUMBER':   this.advance(); return t.value;
      case 'IDENT':
        this.advance();
        if (t.value === 'true')  return true;
        if (t.value === 'false') return false;
        if (t.value === 'null')  return null;
        return t.value;   // bare identifier as a string token
      default:
        throw new Error(`Parser: unexpected token ${t.type} at ${t.pos}`);
    }
  }

  private parseObject(): Record<string, any> {
    this.consume('LBRACE');
    const obj: Record<string, any> = {};
    while (this.peek().type !== 'RBRACE' && this.peek().type !== 'EOF') {
      const keyTok = this.advance();
      const key =
        keyTok.type === 'IDENT'  ? keyTok.value :
        keyTok.type === 'STRING' ? keyTok.value :
        keyTok.type === 'NUMBER' ? String(keyTok.value) :
        '';
      if (!key) throw new Error(`Parser: invalid key token ${keyTok.type} at ${keyTok.pos}`);
      this.consume('COLON');
      obj[key] = this.parseValue();
      if (this.peek().type === 'COMMA') this.advance();
    }
    if (this.peek().type === 'RBRACE') this.advance();
    return obj;
  }

  private parseArray(): any[] {
    this.consume('LBRACKET');
    const arr: any[] = [];
    while (this.peek().type !== 'RBRACKET' && this.peek().type !== 'EOF') {
      arr.push(this.parseValue());
      if (this.peek().type === 'COMMA') this.advance();
    }
    if (this.peek().type === 'RBRACKET') this.advance();
    return arr;
  }
}

// ─── Public entry point ─────────────────────────────────────────────────────

/** Parse an Amarisoft .cfg into a plain JS object. Throws on malformed input. */
export function parseAmarisoftConfig(text: string): Record<string, any> {
  const preprocessed = preprocess(text);
  const tokens = tokenize(preprocessed);
  const parser = new CfgParser(tokens);
  return parser.parseRoot();
}

/** Safe variant — returns null instead of throwing. */
export function tryParseAmarisoftConfig(text: string): Record<string, any> | null {
  try {
    return parseAmarisoftConfig(text);
  } catch {
    return null;
  }
}

/** A file referenced by a main .cfg — drb config, SIB asn, RF driver include, etc. */
export interface ReferencedFile {
  /** Where this reference came from */
  type: 'drb_config' | 'sib_filename' | 'include' | 'meas_config' | 'other';
  /** Relative path / filename as it appears in the cfg */
  filename: string;
  /** Optional context (e.g. "cell_default.sib_sched_list[0]") */
  source?: string;
}

/**
 * Extract every external file the .cfg depends on. Looks at:
 *   - `include "path"`            — preprocessor includes (raw text)
 *   - `drb_config: "drb.cfg"`     — radio bearer config
 *   - `filename: "sib2_3.asn"`    — SIB schedule filenames (inside sib_sched_list)
 *   - `*meas_config*.asn`         — measurement configs
 *
 * Result is deduped on filename; returned in roughly the order they appear.
 */
export function extractReferencedFiles(text: string): ReferencedFile[] {
  const seen = new Set<string>();
  const out: ReferencedFile[] = [];

  const add = (r: ReferencedFile) => {
    if (!r.filename || seen.has(r.filename)) return;
    seen.add(r.filename);
    out.push(r);
  };

  // ── 1. `include "..."` directives — pre-preprocessor, raw text ──────────
  for (const m of text.matchAll(/include\s+["']([^"']+)["']/g)) {
    add({ type: 'include', filename: m[1] });
  }

  // ── 2. drb_config: "..." (LTE) or drb_nr.cfg (NR) ───────────────────────
  for (const m of text.matchAll(/drb_config\s*:\s*["']([^"']+)["']/g)) {
    add({ type: 'drb_config', filename: m[1] });
  }

  // ── 3. SIB schedule filenames — inside sib_sched_list[].filename ────────
  // Match `filename: "sib2_3.asn"` (loose; SIB context implied by the ASN extension)
  for (const m of text.matchAll(/filename\s*:\s*["']([^"']+\.asn[a-zA-Z0-9]*)["']/g)) {
    add({ type: 'sib_filename', filename: m[1] });
  }

  // ── 4. Generic measurement / scheduling .asn references ────────────────
  // Catches lines like `meas_config_filename: "meas_config_periodic.asn"`
  for (const m of text.matchAll(/(?:meas_config|sib_filename|measurement_config)\s*\w*\s*:\s*["']([^"']+)["']/g)) {
    add({ type: 'meas_config', filename: m[1] });
  }

  return out;
}

/** Parse `log_options` string back into level + per-layer overrides. */
export function parseLogOptions(s: string): { level: string; layers: Record<string, string> } {
  const result = { level: 'error', layers: {} as Record<string, string> };
  if (!s) return result;
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\w+)\.(\w+)\s*=\s*(\S+)/);
    if (!m) continue;
    const [, layer, field, value] = m;
    if (field !== 'level') continue;
    if (layer === 'all') result.level = value;
    else result.layers[layer] = value;
  }
  return result;
}
