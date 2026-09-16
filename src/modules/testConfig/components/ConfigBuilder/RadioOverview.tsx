// modules/testConfig/components/ConfigBuilder/RadioOverview.tsx
//
// The customer-facing picture of a radio config (Amarisoft lteenb / gnb):
// a strip of headline numbers, a left-to-right topology (UEs → cells →
// core), the TDD slot split when the carrier is TDD, and a plain-English
// narrative. It is the radio-side counterpart of the UE-SIM TestOverview
// and reads the very same form state the generator writes enb.cfg / gnb.cfg
// from, so the picture and the cfg cannot disagree about what the radio is.
//
// Every read here is defensive: these forms are user-edited and imported
// from real cfg files, so a field can be blank, NaN or missing entirely.
// Nothing in this file may throw on a half-filled form, and anything whose
// shape is not understood is omitted rather than guessed at.
'use client';

import { useId, useMemo } from 'react';
import { getBandSpec } from './constants';
import type { NRFormState, PdnEntry, RfPortEntry, UeDbEntry } from './constants';
import { LTE_BAND_OPTIONS, LTE_TDD_BANDS } from './lteConstants';
import type { LTEFormState } from './lteConstants';

export type RadioKind = 'nr' | 'lte' | 'nsa' | 'nbiot' | 'catm';

export interface RadioOverviewProps {
  type: RadioKind;
  nrForm: NRFormState;
  lteForm: LTEFormState;
}

// ── Geometry of the topology drawing (viewBox units) ─────────────────────

const VIEW_W = 760;
/** First row of boxes, below the column headings. */
const TOP = 26;
const ROW_GAP = 14;
const MAX_CHARS = 36;
/** UEs · Cells · Core — fixed columns, so the drawing always fills VIEW_W. */
const COL_X = [10, 250, 564];
const COL_W = [140, 214, 186];

// ── Small helpers ────────────────────────────────────────────────────────

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function numTxt(v: unknown, dash = '—'): string {
  return isNum(v) ? String(v) : dash;
}

function strTxt(v: unknown, dash = '—'): string {
  return typeof v === 'string' && v.trim() ? v.trim() : dash;
}

/** Defensive array read — the forms can carry null holes after an import. */
function list<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]).filter((x): x is T => x != null) : [];
}

/** NB-IoT carriers are 200 kHz, so MHz is the wrong unit below 1. */
function bwTxt(v: unknown): string {
  if (!isNum(v)) return '— MHz';
  return v > 0 && v < 1 ? `${Math.round(v * 1000)} kHz` : `${v} MHz`;
}

function countWord(n: number): string {
  return ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][n] ?? String(n);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Rough advance width of `s` in px for a Poppins-like face: digits and
 *  capitals are wide, punctuation and spaces narrow. Good enough to decide
 *  whether a line fits its box without measuring in the DOM. */
function estWidth(s: string, fontSize: number): number {
  let em = 0;
  for (const ch of s) {
    if (ch === '…') em += 0.9;
    else if (' ·.,:;-\'"'.includes(ch)) em += 0.3;
    else if ('()[]/|!ijlt'.includes(ch)) em += 0.34;
    else if (ch >= '0' && ch <= '9') em += 0.62;
    else if (ch >= 'A' && ch <= 'Z') em += 0.68;
    else em += 0.56;
  }
  return em * fontSize;
}

/** `s` if it fits in `w` px (and is not absurdly long), else a prefix with "…". */
function fitText(s: string, w: number, fontSize: number): string {
  if (s.length <= MAX_CHARS && estWidth(s, fontSize) <= w) return s;
  let t = s.slice(0, MAX_CHARS);
  while (t.length > 1 && estWidth(`${t.trimEnd()}…`, fontSize) > w) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M${r1(x1)} ${r1(y1)} C${r1(mx)} ${r1(y1)} ${r1(mx)} ${r1(y2)} ${r1(x2)} ${r1(y2)}`;
}

// ── Reading the two form shapes ──────────────────────────────────────────
//
// A cell's fields live either in `cells[]` or — for a config the multi-cell
// editor has never touched — mirrored flat on the form itself. Both satisfy
// these loose shapes, so one reader covers the array and the flat fallback.

interface NrCellLike {
  cellId?: number;
  pci?: number;
  band?: number;
  nrBandwidth?: number;
  subcarrierSpacing?: number;
  dlNrArfcn?: number;
  ssbArfcn?: number | null;
  ssbPosBitmap?: string;
  nrTdd?: number;
  fr2?: number;
  tddPattern?: { period: number; dlSlots: number; dlSymbols: number; ulSlots: number; ulSymbols: number };
}

interface LteCellLike {
  cellId?: number;
  pci?: number;
  band?: number;
  bandwidth?: number;
  dlEarfcn?: number;
  tddConfig?: number;
  tddSpecialSubframe?: number;
}

function nrCellsOf(f: NRFormState | undefined): NrCellLike[] {
  const cs = list<NrCellLike>(f?.cells);
  if (cs.length) return cs;
  return f ? [f] : [];
}

function lteCellsOf(f: LTEFormState | undefined): LteCellLike[] {
  const cs = list<LteCellLike>(f?.cells);
  if (cs.length) return cs;
  return f ? [f] : [];
}

function nrBandLabel(band: unknown): string {
  return isNum(band) ? `n${band}` : 'band —';
}

function lteBandLabel(band: unknown): string {
  return isNum(band) ? `B${band}` : 'band —';
}

/** "B7 (2.6 GHz)" for the narrative, plain "B7" when the band is unlisted. */
function lteBandLong(band: unknown): string {
  const o = isNum(band) ? LTE_BAND_OPTIONS.find(b => b.value === band) : undefined;
  return o ? o.label : lteBandLabel(band);
}

/** Duplex comes from the form, with the band table as the fallback — an
 *  imported cfg can leave nr_tdd out entirely and let the band decide. */
function nrIsTdd(c: NrCellLike): boolean {
  if (isNum(c.nrTdd)) return c.nrTdd === 1;
  const spec = isNum(c.band) ? getBandSpec(c.band) : undefined;
  return spec ? spec.duplex === 1 : false;
}

function lteIsTdd(c: LteCellLike): boolean {
  return isNum(c.band) ? LTE_TDD_BANDS.includes(c.band) : false;
}

function plmnOf(p: { mcc?: string; mnc?: string } | undefined): string | null {
  const mcc = strTxt(p?.mcc, '');
  const mnc = strTxt(p?.mnc, '');
  return mcc && mnc ? `${mcc}-${mnc}` : null;
}

const RAT_LABEL: Record<RadioKind, string> = {
  nr: '5G SA',
  lte: 'LTE',
  nsa: '5G NSA',
  nbiot: 'NB-IoT',
  catm: 'LTE-M',
};

const NODE_LABEL: Record<RadioKind, string> = {
  nr: 'gNB',
  lte: 'eNB',
  nsa: 'eNB anchor + gNB leg',
  nbiot: 'eNB',
  catm: 'eNB',
};

/** Which form carries the shared (non per-cell) fields for this RAT. */
function usesNr(kind: RadioKind): boolean {
  return kind === 'nr' || kind === 'nsa';
}

// ── Topology model ───────────────────────────────────────────────────────

interface BoxSpec { title: string; lines: string[]; chip?: string }
interface Placed extends BoxSpec { x: number; y: number; w: number; h: number; cy: number }

interface CellView {
  spec: BoxSpec;
  /** Label on this cell's connector to the core column. */
  coreLink: string;
  duplex: 'TDD' | 'FDD';
}

interface LinkView {
  d: string;
  dashed?: boolean;
  arrow?: boolean;
  label?: string;
  lx: number;
  ly: number;
}

interface Topology {
  height: number;
  headings: Array<{ x: number; text: string }>;
  ueBox: Placed;
  cellBoxes: Placed[];
  coreBox: Placed;
  links: LinkView[];
}

function boxHeight(lines: number): number {
  return 24 + 13 * Math.max(1, lines);
}

function colHeight(hs: number[]): number {
  return hs.reduce((a, b) => a + b, 0) + ROW_GAP * Math.max(0, hs.length - 1);
}

/** Stack a column's boxes top-down, the column centred on the tallest one. */
function placeColumn(specs: BoxSpec[], x: number, w: number, maxColH: number): Placed[] {
  const hs = specs.map(s => boxHeight(s.lines.length));
  let y = TOP + (maxColH - colHeight(hs)) / 2;
  return specs.map((s, i) => {
    const h = hs[i];
    const placed: Placed = { ...s, x, y, w, h, cy: y + h / 2 };
    y += h + ROW_GAP;
    return placed;
  });
}

function nrCellView(c: NrCellLike, i: number): CellView {
  const tdd = nrIsTdd(c);
  const lines = [
    `PCI ${numTxt(c.pci)}`,
    `${nrBandLabel(c.band)} · ${bwTxt(c.nrBandwidth)}`,
    `ARFCN ${numTxt(c.dlNrArfcn)}`,
  ];
  if (isNum(c.ssbArfcn)) lines.push(`SSB ${c.ssbArfcn}`);
  lines.push(`SCS ${numTxt(c.subcarrierSpacing)} kHz`);
  return {
    spec: { title: `Cell ${numTxt(c.cellId, String(i))}`, lines, chip: tdd ? 'TDD' : 'FDD' },
    coreLink: 'NGAP',
    duplex: tdd ? 'TDD' : 'FDD',
  };
}

function lteCellView(c: LteCellLike, i: number, kind: RadioKind, lte: LTEFormState | undefined): CellView {
  const tdd = lteIsTdd(c);
  const lines = [
    `PCI ${numTxt(c.pci)}`,
    `${lteBandLabel(c.band)} · ${bwTxt(c.bandwidth)}`,
    `EARFCN ${numTxt(c.dlEarfcn)}`,
  ];
  if (kind === 'nbiot') lines.push(`${strTxt(lte?.nbIotMode, 'inband')} · PRB ${numTxt(lte?.nbIotPrbIndex, '0')}`);
  if (kind === 'catm') lines.push(`CE mode ${strTxt(lte?.catMCeMode, 'A')}`);
  return {
    spec: { title: `Cell ${numTxt(c.cellId, String(i))}`, lines, chip: tdd ? 'TDD' : 'FDD' },
    coreLink: 'S1AP',
    duplex: tdd ? 'TDD' : 'FDD',
  };
}

function coreSpec(kind: RadioKind, nr: NRFormState | undefined, lte: LTEFormState | undefined): BoxSpec {
  const plmn = plmnOf(usesNr(kind) ? nr?.plmn : lte?.plmn) ?? plmnOf(lte?.plmn) ?? 'not set';
  if (kind === 'nsa') {
    const lines = [`MME ${strTxt(lte?.mmeAddr, 'not set')}`];
    const amf = strTxt(nr?.amfAddr, '');
    if (amf) lines.push(`AMF ${amf}`);
    lines.push(`PLMN ${plmn}`);
    return { title: 'EPC core', lines };
  }
  if (kind === 'nr') {
    return {
      title: 'AMF',
      lines: [strTxt(nr?.amfAddr, 'address not set'), `PLMN ${plmn}`, `gNB ID ${strTxt(nr?.gnbId)}`],
    };
  }
  return {
    title: 'MME',
    lines: [strTxt(lte?.mmeAddr, 'address not set'), `PLMN ${plmn}`, `eNB ID ${strTxt(lte?.enbId)}`],
  };
}

function buildTopology(kind: RadioKind, cells: CellView[], core: BoxSpec): Topology {
  // The radio config does not own the UEs — this column is only there to
  // show which side of the picture they arrive from.
  const ueSpec: BoxSpec = { title: 'UEs', lines: ['UEs attach here', 'not part of this config'] };
  const cellSpecs: BoxSpec[] = cells.length
    ? cells.map(c => c.spec)
    : [{ title: 'No cells', lines: ['add one on the Cell step'] }];

  const maxColH = Math.max(
    colHeight([boxHeight(ueSpec.lines.length)]),
    colHeight(cellSpecs.map(s => boxHeight(s.lines.length))),
    colHeight([boxHeight(core.lines.length)]),
  );

  const ueBox = placeColumn([ueSpec], COL_X[0], COL_W[0], maxColH)[0];
  const cellBoxes = placeColumn(cellSpecs, COL_X[1], COL_W[1], maxColH);
  const coreBox = placeColumn([core], COL_X[2], COL_W[2], maxColH)[0];

  const links: LinkView[] = [];
  cellBoxes.forEach((cell, i) => {
    // UEs → cell: the radio link. Only the first one carries a label.
    const x1 = ueBox.x + ueBox.w;
    const x2 = cell.x;
    links.push({
      d: curve(x1, ueBox.cy, x2, cell.cy),
      dashed: true,
      lx: (x1 + x2) / 2,
      ly: (ueBox.cy + cell.cy) / 2,
      label: i === 0 && cells.length ? `${cells[0].duplex} radio link` : undefined,
    });
    // cell → core.
    const x3 = cell.x + cell.w;
    const x4 = coreBox.x;
    links.push({
      d: curve(x3, cell.cy, x4, coreBox.cy),
      arrow: true,
      lx: (x3 + x4) / 2,
      ly: (cell.cy + coreBox.cy) / 2,
      label: cells[i]?.coreLink,
    });
  });

  const headings = [
    { x: COL_X[0], text: 'UEs' },
    { x: COL_X[1], text: 'Cells' },
    { x: COL_X[2], text: kind === 'nr' ? 'Core (5GC)' : 'Core (EPC)' },
  ];

  return { height: TOP + maxColH + 12, headings, ueBox, cellBoxes, coreBox, links };
}

// ── TDD pattern model ────────────────────────────────────────────────────

type SlotKind = 'D' | 'S' | 'U';

interface TddStrip {
  heading: string;
  blocks: Array<{ kind: SlotKind; label: string }>;
  /** Symbol split inside the special slot / subframe, when it is known. */
  special: { dl: number; gap: number; ul: number } | null;
  caption: string;
  unit: string;
}

/** 3GPP 36.211 table 4.2-2 — the seven LTE TDD UL/DL configurations. */
const LTE_TDD_PATTERN: Record<number, string> = {
  0: 'DSUUUDSUUU',
  1: 'DSUUDDSUUD',
  2: 'DSUDDDSUDD',
  3: 'DSUUUDDDDD',
  4: 'DSUUDDDDDD',
  5: 'DSUDDDDDDD',
  6: 'DSUUUDSUUD',
};

/** 3GPP 36.211 table 4.2-1, normal CP — DwPTS / GP / UpPTS symbols. */
const LTE_SPECIAL_SUBFRAME: Record<number, [number, number, number]> = {
  0: [3, 10, 1],
  1: [9, 4, 1],
  2: [10, 3, 1],
  3: [11, 2, 1],
  4: [12, 1, 1],
  5: [3, 9, 2],
  6: [9, 3, 2],
  7: [10, 2, 2],
  8: [11, 1, 2],
  9: [6, 6, 2],
};

/** Amarisoft's tdd_ul_dl_config: a period of `dlSlots` downlink slots, one
 *  special slot split `dlSymbols` / `ulSymbols` out of 14, then `ulSlots`
 *  uplink slots. Anything that does not fit that shape returns null. */
function nrTddStrip(c: NrCellLike, heading: string): TddStrip | null {
  const p = c.tddPattern;
  if (!p || typeof p !== 'object') return null;
  const { period, dlSlots, dlSymbols, ulSlots, ulSymbols } = p;
  if (![period, dlSlots, dlSymbols, ulSlots, ulSymbols].every(v => isNum(v) && v >= 0)) return null;
  if (period <= 0 || dlSlots + ulSlots < 1 || dlSlots + ulSlots > 80) return null;
  const symbols = dlSymbols + ulSymbols;
  if (symbols > 14) return null;
  const hasSpecial = symbols > 0;

  const blocks: TddStrip['blocks'] = [];
  for (let i = 0; i < dlSlots; i++) blocks.push({ kind: 'D', label: String(blocks.length) });
  if (hasSpecial) blocks.push({ kind: 'S', label: String(blocks.length) });
  for (let i = 0; i < ulSlots; i++) blocks.push({ kind: 'U', label: String(blocks.length) });

  // A period only holds period × 2^µ slots. More than that means the form is
  // mid-edit or came from a cfg we do not understand — drop the section.
  const scs = c.subcarrierSpacing;
  const mu = isNum(scs) && [15, 30, 60, 120].includes(scs) ? scs / 15 : null;
  if (mu != null && blocks.length > period * mu) return null;

  const scsTxt = isNum(scs) ? ` at ${scs} kHz SCS` : '';
  const specialTxt = hasSpecial
    ? ` · special slot ${dlSymbols} DL + ${14 - symbols} guard + ${ulSymbols} UL symbols`
    : '';
  return {
    heading,
    blocks,
    special: hasSpecial ? { dl: dlSymbols, gap: 14 - symbols, ul: ulSymbols } : null,
    caption: `${period} ms period · ${plural(blocks.length, 'slot')}${scsTxt}${specialTxt}`,
    unit: 'slot',
  };
}

function lteTddStrip(c: LteCellLike, heading: string): TddStrip | null {
  if (!isNum(c.tddConfig)) return null;
  const pattern = LTE_TDD_PATTERN[c.tddConfig];
  if (!pattern) return null;
  const blocks = pattern.split('').map((ch, i) => ({ kind: ch as SlotKind, label: String(i) }));
  const ssf = isNum(c.tddSpecialSubframe) ? LTE_SPECIAL_SUBFRAME[c.tddSpecialSubframe] : undefined;
  const dl = blocks.filter(b => b.kind === 'D').length;
  const ul = blocks.filter(b => b.kind === 'U').length;
  const ssfTxt = ssf
    ? ` · special subframe ${numTxt(c.tddSpecialSubframe)}: DwPTS ${ssf[0]} / GP ${ssf[1]} / UpPTS ${ssf[2]} symbols`
    : '';
  return {
    heading,
    blocks,
    special: ssf ? { dl: ssf[0], gap: ssf[1], ul: ssf[2] } : null,
    caption: `UL/DL configuration ${c.tddConfig} · 10 ms frame · ${dl} DL, ${ul} UL, ${blocks.length - dl - ul} special${ssfTxt}`,
    unit: 'subframe',
  };
}

// ── Narrative ────────────────────────────────────────────────────────────

function pdnSentence(f: NRFormState | undefined): string | null {
  const pdns = list<PdnEntry>(f?.pdnList);
  if (!pdns.length) return null;
  const names = pdns.map(p => strTxt(p?.access_point_name, 'unnamed'));
  const one = names.length === 1;
  return `${countWord(names.length)} data network${one ? '' : 's'} ${one ? 'is' : 'are'} configured: ${names.join(', ')}.`;
}

function ueDbSentence(f: NRFormState | undefined): string | null {
  const db = list<UeDbEntry>(f?.ueDb);
  if (!db.length) return null;
  const sims = db.reduce((a, u) => a + (isNum(u?.nb_ue) ? u.nb_ue : 1), 0);
  const first = strTxt(db[0]?.imsi, '');
  const entries = db.length === 1 ? '1 entry' : `${db.length} entries`;
  return `Its built-in subscriber database carries ${plural(sims, 'SIM')} over ${entries}${first ? `, starting at IMSI ${first}` : ''}.`;
}

function radioSentence(dl: unknown, ul: unknown, rfMode: unknown, rfPorts: unknown): string {
  const ant = isNum(dl) && isNum(ul) ? `${dl}×${ul} DL×UL antennas` : 'its configured antennas';
  const front = rfMode === 'split'
    ? 'an O-RAN 7.2 split fronthaul'
    : rfMode === 'ip' ? 'an IP (ZMQ) front end' : 'an SDR front end';
  const ports = list<RfPortEntry>(rfPorts).length;
  return `It drives ${ant} through ${front}${ports ? ` across ${plural(ports, 'RF port')}` : ''}.`;
}

function cellSentences(cells: CellView[]): string[] {
  if (!cells.length) return ['No cell is configured yet, so this radio would not transmit anything.'];
  if (cells.length <= 2) {
    return cells.map(c => {
      const pci = c.spec.lines.find(l => l.startsWith('PCI ')) ?? 'PCI —';
      const arfcn = c.spec.lines.find(l => l.startsWith('ARFCN ') || l.startsWith('EARFCN '));
      const ssb = c.spec.lines.find(l => l.startsWith('SSB '));
      const tail = [arfcn ? `on ${arfcn}` : '', ssb ? `with ${ssb.replace('SSB ', 'SSB at ')}` : '']
        .filter(Boolean).join(' ');
      return `${c.spec.title} broadcasts ${pci}${tail ? ` ${tail}` : ''}.`;
    });
  }
  const pcis = cells.map(c => (c.spec.lines[0] ?? 'PCI —').replace('PCI ', '')).join(', ');
  return [`Its ${cells.length} carriers broadcast PCIs ${pcis}; each one is drawn in the topology above.`];
}

function coreSentence(kind: RadioKind, nr: NRFormState | undefined, lte: LTEFormState | undefined): string {
  const plmn = plmnOf(usesNr(kind) ? nr?.plmn : lte?.plmn) ?? plmnOf(lte?.plmn);
  const adv = plmn ? `It advertises PLMN ${plmn}` : 'No PLMN is set yet';
  if (kind === 'nsa') {
    const mme = strTxt(lte?.mmeAddr, '');
    return `${adv}; the LTE anchor carries S1AP to ${mme ? `an MME at ${mme}` : 'an MME that has no address yet'}, and the NR leg rides that anchor over X2 instead of talking to a core itself.`;
  }
  if (kind === 'nr') {
    const amf = strTxt(nr?.amfAddr, '');
    return `${adv} and connects over NGAP to ${amf ? `an AMF at ${amf}` : 'an AMF that has no address yet'}.`;
  }
  const mme = strTxt(lte?.mmeAddr, '');
  return `${adv} and connects over S1AP to ${mme ? `an MME at ${mme}` : 'an MME that has no address yet'}.`;
}

function headSentence(
  kind: RadioKind,
  nrCells: NrCellLike[],
  lteCells: LteCellLike[],
  lte: LTEFormState | undefined,
): string {
  const nc = nrCells[0];
  const lc = lteCells[0];
  const nrPhrase = nc
    ? `${nrBandLabel(nc.band)}, ${bwTxt(nc.nrBandwidth)} ${nrIsTdd(nc) ? 'TDD' : 'FDD'} with ${numTxt(nc.subcarrierSpacing)} kHz subcarrier spacing`
    : 'no NR carrier';
  const ltePhrase = lc
    ? `${lteBandLong(lc.band)}, ${bwTxt(lc.bandwidth)} ${lteIsTdd(lc) ? 'TDD' : 'FDD'}`
    : 'no LTE carrier';

  switch (kind) {
    case 'nr': {
      const n = nrCells.length;
      return `A ${n === 1 ? 'single-cell' : `${n}-cell`} 5G SA gNB on band ${nrPhrase}.`;
    }
    case 'nsa':
      return `An EN-DC pair: an LTE anchor on band ${ltePhrase}, plus a 5G NR leg on band ${nrPhrase}.`;
    case 'nbiot':
      return `An NB-IoT eNB on band ${ltePhrase}, deployed ${strTxt(lte?.nbIotMode, 'inband')}.`;
    case 'catm': {
      const n = lteCells.length;
      return `An LTE-M (CAT-M1) eNB with ${n === 1 ? 'a single cell' : `${n} cells`} on band ${ltePhrase}.`;
    }
    default: {
      const n = lteCells.length;
      return `A ${n === 1 ? 'single-cell' : `${n}-cell`} LTE eNB on band ${ltePhrase}.`;
    }
  }
}

function tddSentence(strip: TddStrip | null): string | null {
  if (!strip) return null;
  const d = strip.blocks.filter(b => b.kind === 'D').length;
  const u = strip.blocks.filter(b => b.kind === 'U').length;
  const s = strip.blocks.filter(b => b.kind === 'S').length;
  const parts = [`${d} downlink`, s ? `${s} special` : '', `${u} uplink`].filter(Boolean);
  const lean = d > u ? 'downlink-heavy' : d < u ? 'uplink-heavy' : 'balanced';
  return `One TDD period carries ${parts.join(', ')} ${strip.unit}${strip.blocks.length === 1 ? '' : 's'} — a ${lean} ${d}:${u} split.`;
}

function narrate(
  kind: RadioKind,
  nr: NRFormState | undefined,
  lte: LTEFormState | undefined,
  nrCells: NrCellLike[],
  lteCells: LteCellLike[],
  cellViews: CellView[],
  strip: TddStrip | null,
): string[] {
  const out: string[] = [];
  out.push(headSentence(kind, nrCells, lteCells, lte));
  out.push(...cellSentences(cellViews));
  out.push(coreSentence(kind, nr, lte));

  const tdd = tddSentence(strip);
  if (tdd) out.push(tdd);

  out.push(usesNr(kind)
    ? radioSentence(nr?.nAntennaDl, nr?.nAntennaUl, nr?.rfMode, nr?.rfPorts)
    : radioSentence(lte?.nAntennaDl, lte?.nAntennaUl, lte?.rfMode, lte?.rfPorts));

  if (kind === 'nbiot') {
    out.push(`The carrier serves narrowband IoT devices only${isNum(lte?.nbIotPrbIndex) ? `, on PRB ${lte?.nbIotPrbIndex} of the host carrier` : ''}.`);
  }
  if (kind === 'catm') {
    out.push(`Coverage enhancement mode ${strTxt(lte?.catMCeMode, 'A')} is in force${isNum(lte?.catMRepetitions) ? `, with up to ${plural(lte?.catMRepetitions ?? 0, 'repetition')}` : ''}.`);
  }
  if (kind === 'nsa' && (nr?.enDcSupport || lte?.enDcSupport)) {
    out.push('Both legs carry en_dc_support, which is what lets a UE keep the LTE anchor while it adds the NR carrier.');
  }

  if (usesNr(kind)) {
    const pdn = pdnSentence(nr);
    if (pdn) out.push(pdn);
    const db = ueDbSentence(nr);
    if (db) out.push(db);
  }

  if (out.length < 4) {
    const log = usesNr(kind) ? nr?.logFilename : lte?.logFilename;
    const level = usesNr(kind) ? nr?.logLevel : lte?.logLevel;
    out.push(`Logs are written to ${strTxt(log, 'the default log file')} at "${strTxt(level, 'error')}" level.`);
  }
  return out.slice(0, 7);
}

// ── Component ────────────────────────────────────────────────────────────

export function RadioOverview({ type, nrForm, lteForm }: RadioOverviewProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const arrowHead = `${uid}-ah`;

  const model = useMemo(() => {
    const kind: RadioKind = RAT_LABEL[type] ? type : 'nr';
    const nr = nrForm;
    const lte = lteForm;

    const nrCells = usesNr(kind) ? nrCellsOf(nr) : [];
    const lteCells = kind === 'nr' ? [] : lteCellsOf(lte);

    // NSA draws the LTE anchor first, then the NR leg beneath it.
    const cellViews: CellView[] = [
      ...lteCells.map((c, i) => lteCellView(c, i, kind, lte)),
      ...nrCells.map((c, i) => {
        const v = nrCellView(c, i);
        return kind === 'nsa' ? { ...v, coreLink: 'X2 / EN-DC' } : v;
      }),
    ];

    // The TDD strip follows the first TDD carrier, preferring the NR leg —
    // that is where the slot format actually has to be understood.
    let strip: TddStrip | null = null;
    const tddNr = nrCells.find(c => nrIsTdd(c));
    if (tddNr) {
      strip = nrTddStrip(tddNr, `Cell ${numTxt(tddNr.cellId, '?')}${kind === 'nsa' ? ' · NR leg' : ''}`);
    }
    if (!strip) {
      const tddLte = lteCells.find(c => lteIsTdd(c));
      if (tddLte) {
        strip = lteTddStrip(tddLte, `Cell ${numTxt(tddLte.cellId, '?')}${kind === 'nsa' ? ' · LTE anchor' : ''}`);
      }
    }

    const first = cellViews[0];
    const antDl = usesNr(kind) ? nr?.nAntennaDl : lte?.nAntennaDl;
    const antUl = usesNr(kind) ? nr?.nAntennaUl : lte?.nAntennaUl;
    const coreAddr = kind === 'nr' ? strTxt(nr?.amfAddr, '') : strTxt(lte?.mmeAddr, '');

    const tiles = [
      { label: 'Cells', value: `${cellViews.length} · ${RAT_LABEL[kind]}` },
      { label: 'Band', value: first ? `${first.spec.lines[1] ?? '—'} · ${first.duplex}` : 'no cell' },
      { label: 'Antennas', value: isNum(antDl) && isNum(antUl) ? `${antDl}×${antUl}` : '—' },
      { label: 'PLMN', value: plmnOf(usesNr(kind) ? nr?.plmn : lte?.plmn) ?? plmnOf(lte?.plmn) ?? 'not set' },
      { label: kind === 'nr' ? 'Core (AMF)' : 'Core (MME)', value: coreAddr || 'not set' },
    ];

    return {
      kind,
      tiles,
      topology: buildTopology(kind, cellViews, coreSpec(kind, nr, lte)),
      strip,
      sentences: narrate(kind, nr, lte, nrCells, lteCells, cellViews, strip),
    };
  }, [type, nrForm, lteForm]);

  const { kind, tiles, topology: tp, strip, sentences } = model;

  return (
    <div className="space-y-5 text-foreground">
      {/* 1. Summary strip */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))' }}>
        {tiles.map(t => (
          <div key={t.label} className="rounded-md border border-border bg-card px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.label}</div>
            <div className="truncate text-sm font-semibold leading-tight" title={t.value}>{t.value}</div>
          </div>
        ))}
      </div>

      {/* 2. Topology */}
      <section>
        <SectionLabel>Topology · {NODE_LABEL[kind]}</SectionLabel>
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${VIEW_W} ${tp.height}`}
            className="block h-auto w-full min-w-[560px]"
            role="img"
            aria-label="Radio topology: UEs, the configured cells and the core network"
          >
            <defs>
              <marker
                id={arrowHead} viewBox="0 0 8 8" refX={7} refY={4} markerWidth={7} markerHeight={7}
                markerUnits="userSpaceOnUse" orient="auto-start-reverse"
              >
                <path d="M0.5,0.5 L7.5,4 L0.5,7.5 z" className="fill-muted-foreground" />
              </marker>
            </defs>

            {tp.headings.map(h => (
              <text key={h.text} x={h.x} y={12} fontSize={9.5} letterSpacing={0.8} className="fill-muted-foreground">
                {h.text.toUpperCase()}
              </text>
            ))}

            {tp.links.map((l, i) => (
              <path
                key={i} d={l.d} fill="none" strokeWidth={1.2} opacity={0.65}
                strokeDasharray={l.dashed ? '5 4' : undefined}
                markerEnd={l.arrow ? `url(#${arrowHead})` : undefined}
                className="stroke-muted-foreground"
              />
            ))}

            <SvgBox b={tp.ueBox} dashed muted glyph="phone" />
            {tp.cellBoxes.map((b, i) => <SvgBox key={`${b.title}-${i}`} b={b} accent glyph="antenna" />)}
            <SvgBox b={tp.coreBox} dashed glyph="server" />

            {tp.links.map((l, i) => {
              if (!l.label) return null;
              const w = estWidth(l.label, 9) + 10;
              return (
                <g key={`label-${i}`}>
                  <rect
                    x={l.lx - w / 2} y={l.ly - 8} width={w} height={15} rx={4} strokeWidth={1}
                    className="fill-card stroke-border"
                  />
                  <text
                    x={l.lx} y={l.ly + 3} fontSize={9} fontWeight={600} textAnchor="middle"
                    className="fill-muted-foreground"
                  >
                    {l.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* 3. TDD pattern — only for a TDD carrier whose shape we understand */}
      {strip && (
        <section>
          <SectionLabel>TDD pattern · {strip.heading}</SectionLabel>
          <div className="overflow-x-auto">
            <div className="flex min-w-[320px] items-stretch gap-[3px]">
              {strip.blocks.map((b, i) => (
                <div
                  key={i}
                  title={`${SLOT_NAME[b.kind]} ${strip.unit} ${b.label}`}
                  className={`flex min-w-0 flex-1 flex-col items-center rounded-sm border px-0.5 py-1 ${SLOT_CLS[b.kind]}`}
                >
                  <span className="text-[11px] font-semibold leading-none">{b.kind}</span>
                  <span className="mt-0.5 text-[9px] leading-none opacity-70">{b.label}</span>
                  {b.kind === 'S' && strip.special && (
                    <span className="mt-1 flex h-1 w-full overflow-hidden rounded-[1px]">
                      <span className="bg-brand-teal/70" style={{ flexGrow: strip.special.dl }} />
                      <span className="bg-muted-foreground/30" style={{ flexGrow: strip.special.gap }} />
                      <span className="bg-brand-orange/70" style={{ flexGrow: strip.special.ul }} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <Swatch cls="border-brand-teal/60 bg-brand-teal/25" label="D — downlink" />
            <Swatch cls="border-brand-amber/60 bg-brand-amber/25" label="S — special (DL · guard · UL)" />
            <Swatch cls="border-brand-orange/60 bg-brand-orange/25" label="U — uplink" />
            <span>{strip.caption}</span>
          </div>
        </section>
      )}

      {/* 4. Narrative */}
      <section>
        <SectionLabel>What this config does</SectionLabel>
        <ul className="list-disc space-y-1 pl-4 text-xs leading-snug">
          {sentences.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </section>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

const SLOT_NAME: Record<SlotKind, string> = { D: 'Downlink', S: 'Special', U: 'Uplink' };

// brand-* are real hex scales, so opacity modifiers work on them — the
// shadcn tokens (primary, card, …) are plain CSS variables and would
// generate nothing with /15.
const SLOT_CLS: Record<SlotKind, string> = {
  D: 'border-brand-teal/50 bg-brand-teal/15 text-brand-teal-600 dark:text-brand-teal-400',
  S: 'border-brand-amber/50 bg-brand-amber/15 text-brand-amber-700 dark:text-brand-amber-400',
  U: 'border-brand-orange/50 bg-brand-orange/15 text-brand-orange-600 dark:text-brand-orange-400',
};

function Swatch({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-2.5 w-2.5 rounded-[2px] border ${cls}`} />
      {label}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 border-b border-border pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

function SvgBox({ b, accent, dashed, muted, glyph }: {
  b: Placed;
  accent?: boolean;
  dashed?: boolean;
  muted?: boolean;
  glyph?: 'phone' | 'antenna' | 'server';
}) {
  const padL = accent ? 13 : 10;
  const chipW = b.chip ? estWidth(b.chip, 8) + 12 : 0;
  // Only the title shares a row with the duplex chip; body lines run under it.
  const titleW = b.w - padL - chipW - 14;
  const lineW = b.w - padL - (glyph ? 30 : 10);
  const gx = b.x + b.w - 22;
  const gy = b.y + b.h - 23;
  return (
    <g>
      <rect
        x={b.x} y={b.y} width={b.w} height={b.h} rx={6} strokeWidth={1}
        strokeDasharray={dashed ? '4 3' : undefined}
        className={muted ? 'fill-muted stroke-border' : 'fill-card stroke-border'}
      />
      {accent && <rect x={b.x + 3} y={b.y + 7} width={3} height={b.h - 14} rx={1.5} className="fill-primary" />}
      <text
        x={b.x + padL} y={b.y + 15} fontSize={12} fontWeight={600}
        className={muted ? 'fill-muted-foreground' : 'fill-foreground'}
      >
        {fitText(b.title, Math.max(20, titleW), 12)}
      </text>
      {b.chip && (
        <g>
          <rect
            x={b.x + b.w - 8 - chipW} y={b.y + 5} width={chipW} height={13} rx={6.5} strokeWidth={1}
            className="fill-brand-orange/10 stroke-brand-orange/50"
          />
          <text
            x={b.x + b.w - 8 - chipW / 2} y={b.y + 14} fontSize={8} fontWeight={700}
            textAnchor="middle" letterSpacing={0.4} className="fill-primary"
          >
            {b.chip}
          </text>
        </g>
      )}
      {b.lines.map((line, i) => (
        <text key={i} x={b.x + padL} y={b.y + 29 + 13 * i} fontSize={10} className="fill-muted-foreground">
          {fitText(line, Math.max(20, lineW), 10)}
        </text>
      ))}
      {glyph === 'phone' && (
        <g fill="none" strokeWidth={1} className="stroke-muted-foreground">
          <rect x={gx + 1} y={gy} width={10} height={15} rx={2} />
          <rect x={gx + 3} y={gy + 2.5} width={6} height={8.5} rx={0.8} />
        </g>
      )}
      {glyph === 'antenna' && (
        <g fill="none" strokeWidth={1} className="stroke-muted-foreground">
          <circle cx={gx + 5} cy={gy + 4} r={1.6} className="fill-muted-foreground" />
          <line x1={gx + 5} y1={gy + 5.5} x2={gx + 5} y2={gy + 15} />
          <path d={`M${gx + 1} ${gy + 1} a4 4 0 0 0 0 6`} />
          <path d={`M${gx + 9} ${gy + 1} a4 4 0 0 1 0 6`} />
          <path d={`M${gx + 1.5} ${gy + 15} L${gx + 5} ${gy + 9} L${gx + 8.5} ${gy + 15}`} />
        </g>
      )}
      {glyph === 'server' && (
        <g fill="none" strokeWidth={1} className="stroke-muted-foreground">
          <rect x={gx - 1} y={gy + 1} width={12} height={6} rx={1} />
          <rect x={gx - 1} y={gy + 9} width={12} height={6} rx={1} />
          <circle cx={gx + 8.5} cy={gy + 4} r={0.9} className="fill-muted-foreground" />
          <circle cx={gx + 8.5} cy={gy + 12} r={0.9} className="fill-muted-foreground" />
        </g>
      )}
    </g>
  );
}
