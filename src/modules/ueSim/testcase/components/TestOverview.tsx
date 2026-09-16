// modules/ueSim/testcase/components/TestOverview.tsx
//
// The customer-facing picture of a UE-SIM test case, rendered live beside
// the wizard: a strip of headline numbers, a left-to-right topology
// (UE groups → cells → network under test → traffic servers), one time
// lane per UE group, and a plain-English narrative. Every number comes
// through derive.ts so the picture and the generated ue.cfg cannot
// disagree about which UEs exist, where they camp or when things happen.
'use client';

import { useId, useMemo } from 'react';
import { LOG_PRESETS } from '../defaults';
import {
  aggregateMbps, expandUes, formatBitrate, formatSeconds, plmnOfImsi, scheduleFor,
  supiToImsi, testLength, totalUes, trafficFor, userPlanesFor,
} from '../derive';
import type { DerivedUe } from '../derive';
import type { CellConfig, SubscriberGroup, UeTestCase, UserPlaneProfile } from '../types';

// ── Geometry of the topology drawing (viewBox units) ─────────────────────

const VIEW_W = 760;
const PAD_X = 10;
/** First row of boxes, below the column headings. */
const TOP = 24;
const ROW_GAP = 14;
/** Height of one arrow label slot on a network→server link. */
const LABEL_H = 18;
const MAX_CHARS = 34;

// ── Small helpers ────────────────────────────────────────────────────────

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
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

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function fmtMbps(mbps: number): string {
  return mbps >= 1000 ? `${trimNum(mbps / 1000)} Gbps` : `${trimNum(mbps)} Mbps`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ueCount(g: SubscriberGroup): number {
  return Math.max(0, Math.floor(g.ueCount));
}

function serverKey(p: UserPlaneProfile): string {
  return p.destinationIp.trim() || '(no destination)';
}

/** Index of the cell a group camps on; a dangling servingCell falls back to cell 0. */
function servingCellIndex(tc: UeTestCase, g: SubscriberGroup): number {
  const i = tc.cell.cells.findIndex(c => c.id === g.servingCell);
  return i >= 0 ? i : 0;
}

function cellPhrase(c: CellConfig, isNr: boolean): string {
  const head = isNr ? `an ${c.band}` : `an LTE Band ${c.band}`;
  return `${head} ${c.bandwidth} MHz ${c.duplexMode}${c.ntn ? ' NTN' : ''} cell`;
}

function rfPhrase(c: CellConfig): string {
  return `SDR port${c.rfCard.includes('-') ? 's' : ''} ${c.rfCard}`;
}

function nssaiPhrase(g: SubscriberGroup): string {
  return `S-NSSAI sst ${g.nssai.map(n => `${n.sst}${n.sd ? `/${n.sd}` : ''}`).join(', ') || '–'}`;
}

function flowLabel(p: UserPlaneProfile): string {
  let text: string = p.dataType;
  if (p.dataType === 'IPERF') {
    const dirs: string[] = [];
    if (p.fileTransferAction !== 'UL') dirs.push(`DL ${formatBitrate(p.dlBitrate)}`);
    if (p.fileTransferAction !== 'DL') dirs.push(`UL ${formatBitrate(p.ulBitrate)}`);
    text = `IPERF ${dirs.join(' / ')}`;
  }
  return p.loop ? `${text} · loop` : text;
}

// ── Topology model ───────────────────────────────────────────────────────

interface BoxSpec { title: string; lines: string[] }
interface Placed extends BoxSpec { x: number; y: number; w: number; h: number; cy: number }
type ArrowDir = 'left' | 'right' | 'both';
interface ArrowLabel { text: string; dir: ArrowDir }
interface ServerSpec extends BoxSpec { labels: ArrowLabel[] }

interface Topology {
  width: number;
  height: number;
  headings: Array<{ x: number; text: string }>;
  ueBoxes: Placed[];
  cellBoxes: Placed[];
  netBox: Placed;
  serverBoxes: Placed[];
  /** Muted connector paths. */
  links: string[];
  arrows: Array<{ x1: number; x2: number; y: number; tx: number; ty: number; text: string; dir: ArrowDir }>;
  fading: { x: number; y: number; w: number; h: number; lines: string[] } | null;
}

function boxHeight(lines: number): number {
  return 24 + 13 * lines;
}

function colHeight(slots: number[]): number {
  return slots.reduce((a, b) => a + b, 0) + ROW_GAP * Math.max(0, slots.length - 1);
}

/** Spread the columns across the drawing. Slack goes mostly to the gaps
 *  (where the connectors and labels live) and a little to the boxes; when
 *  the minimums do not fit in VIEW_W the drawing widens instead of
 *  squeezing text, since the SVG scales to the panel anyway. */
function placeColumns(widths: number[], minGaps: number[]): { xs: number[]; ws: number[]; gaps: number[]; viewW: number } {
  const sumW = widths.reduce((a, b) => a + b, 0);
  const sumG = minGaps.reduce((a, b) => a + b, 0);
  const viewW = Math.max(VIEW_W, 2 * PAD_X + sumW + sumG);
  const extra = viewW - 2 * PAD_X - sumW - sumG;
  let ws = widths.slice();
  let gaps = minGaps.slice();
  if (gaps.length) {
    ws = ws.map(w => w + extra * 0.4 * (w / sumW));
    gaps = gaps.map(g => g + (extra * 0.6) / gaps.length);
  } else {
    ws = ws.map(w => w + extra * (w / sumW));
  }
  const xs: number[] = [];
  let x = PAD_X;
  ws.forEach((w, i) => {
    xs.push(x);
    x += w + (gaps[i] ?? 0);
  });
  return { xs, ws, gaps, viewW };
}

/** Stack a column's boxes top-down, the column centred on the tallest one.
 *  A slot may be taller than its box (server rows reserve room for labels). */
function placeColumn(specs: BoxSpec[], slots: number[], x: number, w: number, maxColH: number): Placed[] {
  let y = TOP + (maxColH - colHeight(slots)) / 2;
  return specs.map((s, i) => {
    const slot = slots[i] ?? boxHeight(s.lines.length);
    const h = boxHeight(s.lines.length);
    const placed: Placed = { ...s, x, y: y + (slot - h) / 2, w, h, cy: y + slot / 2 };
    y += slot + ROW_GAP;
    return placed;
  });
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M${r1(x1)} ${r1(y1)} C${r1(mx)} ${r1(y1)} ${r1(mx)} ${r1(y2)} ${r1(x2)} ${r1(y2)}`;
}

function buildTopology(tc: UeTestCase, ues: DerivedUe[]): Topology {
  const isNr = tc.cell.ratType === '5G:SA';
  const groups = tc.subscriber.groups;
  const cells = tc.cell.cells;

  // Column 1 — UE groups.
  const ueSpecs: BoxSpec[] = groups.map((g, gi) => {
    const count = ueCount(g);
    const mine = ues.filter(u => u.group.id === g.id);
    const first = mine[0]?.imsi ?? supiToImsi(g.startingSupi);
    const last = mine[mine.length - 1]?.imsi ?? supiToImsi(g.startingSupi, Math.max(0, count - 1) * Math.max(1, g.nextSupi));
    const plmn = plmnOfImsi(first, g.mncDigits);
    const lines = [`${count} UE`, `SUPI ${first}`];
    if (count > 1) lines.push(`… ${last}`);
    lines.push(`${g.algorithm} · PLMN ${plmn.mcc}-${plmn.mnc}`);
    if (g.networkSlicing === 'Enable') lines.push(nssaiPhrase(g));
    return { title: `UE Group ${gi}`, lines };
  });
  if (!ueSpecs.length) ueSpecs.push({ title: 'No UE groups', lines: ['add one on the Subscriber step'] });

  // Column 2 — cells.
  const cellSpecs: BoxSpec[] = cells.map((c, ci) => ({
    title: `Cell ${ci}${c.ntn ? ' · NTN' : ''}`,
    lines: isNr
      ? [
          `${c.band} · ${c.bandwidth} MHz · ${c.duplexMode}`,
          `SCS ${c.scs} kHz · ${c.dlAntennas}×${c.ulAntennas} ant`,
          `ARFCN ${c.dlNrArfcn}`,
          `RF ${c.rfCard}`,
        ]
      : [
          `Band ${c.band} · ${c.bandwidth} MHz · ${c.duplexMode}`,
          `${c.dlAntennas}×${c.ulAntennas} ant · EARFCN ${c.dlEarfcn}`,
          `RF ${c.rfCard}`,
        ],
  }));
  if (!cellSpecs.length) cellSpecs.push({ title: 'No cells', lines: ['add one on the Cell step'] });

  // Column 3 — the device under test.
  const netSpec: BoxSpec = { title: isNr ? 'gNB + 5G Core' : 'eNB + EPC', lines: ['(device under test)'] };

  // Column 4 — one server per distinct destination.
  const active = tc.userPlane.profiles.filter(p => p.dataType !== 'None');
  const applying = new Set<number>();
  for (const g of groups) for (const p of userPlanesFor(tc, g.id)) applying.add(p.id);
  const serverSpecs: ServerSpec[] = uniq(active.map(serverKey)).map(ip => {
    const mine = active.filter(p => serverKey(p) === ip);
    const lines = uniq(mine.map(p => `${p.dataType} ${p.transportProtocol}`));
    lines.push(`ports ${uniq(mine.map(p => `${p.startingPort}+`)).join(', ')}`);
    const labels: ArrowLabel[] = [];
    for (const p of mine) {
      if (!applying.has(p.id)) continue;
      if (p.dataType === 'IPERF') {
        if (p.fileTransferAction !== 'UL') labels.push({ text: `DL ${formatBitrate(p.dlBitrate)} per UE`, dir: 'left' });
        if (p.fileTransferAction !== 'DL') labels.push({ text: `UL ${formatBitrate(p.ulBitrate)} per UE`, dir: 'right' });
      } else if (p.dataType === 'PING') {
        labels.push({ text: 'ICMP', dir: 'both' });
      } else if (p.dataType === 'HTTP') {
        labels.push({ text: 'HTTP GET', dir: 'both' });
      }
    }
    const seen = new Set<string>();
    const dedup = labels.filter(l => {
      const k = `${l.dir}:${l.text}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { title: ip, lines, labels: dedup };
  });
  const hasServers = serverSpecs.length > 0;

  // Fading pill between UE groups and cells.
  const fadingLines = tc.cell.mobility && tc.mobility.channelModel !== 'None'
    ? [`${tc.mobility.channelModel} fading`, ...(tc.mobility.dopplerHz > 0 ? [`doppler ${tc.mobility.dopplerHz} Hz`] : [])]
    : null;

  // Horizontal layout.
  // Base widths sum with the gaps to exactly VIEW_W for the four-column,
  // no-fading case; the fading pill widens the first gap and shrinks boxes.
  const baseW = hasServers ? [172, 148, 116, 110] : [172, 148, 116];
  const minGaps = hasServers ? [fadingLines ? 92 : 48, 40, 106] : [fadingLines ? 92 : 48, 40];
  const { xs, ws, gaps, viewW } = placeColumns(baseW, minGaps);

  // Vertical layout.
  const ueSlots = ueSpecs.map(s => boxHeight(s.lines.length));
  const cellSlots = cellSpecs.map(s => boxHeight(s.lines.length));
  const netSlots = [boxHeight(netSpec.lines.length)];
  const srvSlots = serverSpecs.map(s => Math.max(boxHeight(s.lines.length), s.labels.length * LABEL_H + 6));
  const maxColH = Math.max(colHeight(ueSlots), colHeight(cellSlots), colHeight(netSlots), hasServers ? colHeight(srvSlots) : 0);
  const height = TOP + maxColH + 12;

  const ueBoxes = placeColumn(ueSpecs, ueSlots, xs[0], ws[0], maxColH);
  const cellBoxes = placeColumn(cellSpecs, cellSlots, xs[1], ws[1], maxColH);
  const netBox = placeColumn([netSpec], netSlots, xs[2], ws[2], maxColH)[0];
  const serverBoxes = hasServers ? placeColumn(serverSpecs, srvSlots, xs[3], ws[3], maxColH) : [];

  // Connectors.
  const links: string[] = [];
  if (cells.length) {
    groups.forEach((g, gi) => {
      const ue = ueBoxes[gi];
      const cell = cellBoxes[servingCellIndex(tc, g)] ?? cellBoxes[0];
      if (ue && cell) links.push(curve(ue.x + ue.w, ue.cy, cell.x, cell.cy));
    });
    for (const c of cellBoxes) links.push(curve(c.x + c.w, c.cy, netBox.x, netBox.cy));
  }

  const arrows: Topology['arrows'] = [];
  serverBoxes.forEach((srv, i) => {
    const labels = serverSpecs[i].labels;
    const level = Math.abs(srv.cy - netBox.cy) < 2;
    if (!(level && labels.length)) links.push(curve(netBox.x + netBox.w, netBox.cy, srv.x, srv.cy));
    const x1 = netBox.x + netBox.w + 4;
    const x2 = srv.x - 4;
    labels.forEach((l, li) => {
      const yc = srv.cy + (li - (labels.length - 1) / 2) * LABEL_H;
      arrows.push({ x1, x2, y: yc + 5, tx: (x1 + x2) / 2, ty: yc - 1, text: l.text, dir: l.dir });
    });
  });

  const fading = fadingLines
    ? {
        x: xs[0] + ws[0] + gaps[0] / 2,
        y: TOP + maxColH / 2,
        w: Math.max(...fadingLines.map(l => estWidth(l, 9) * 1.05)) + 14,
        h: 6 + 11 * fadingLines.length,
        lines: fadingLines,
      }
    : null;

  const headingText = ['UE Simulator', 'Cells', 'Network under test', 'Traffic server'];
  const headings = xs.map((x, i) => ({ x, text: headingText[i] }));

  return { width: viewW, height, headings, ueBoxes, cellBoxes, netBox, serverBoxes, links, arrows, fading };
}

// ── Timeline model ───────────────────────────────────────────────────────

interface Lane {
  key: number;
  label: string;
  height: number;
  /** null = the group has no UEs. */
  on: number | null;
  end: number;
  attachStart: number;
  attachEnd: number;
  attachLabel: string;
  flows: Array<{ start: number; end: number; label: string }>;
  off: number | null;
}

interface Timeline {
  total: number;
  ticks: string[];
  lanes: Lane[];
}

function buildTimeline(tc: UeTestCase, length: number): Timeline {
  const total = Math.max(10, length);
  const schedule = scheduleFor(tc);
  const lanes: Lane[] = tc.subscriber.groups.map((g, gi) => {
    const mine = schedule.filter(s => s.ue.group.id === g.id);
    const count = mine.length;
    const label = `UE Group ${gi} · ${count} UE`;
    if (!count) {
      return { key: gi, label, height: 28, on: null, end: total, attachStart: 0, attachEnd: 0, attachLabel: '', flows: [], off: null };
    }
    const first = mine[0];
    const last = mine[count - 1];
    const tp = trafficFor(tc, g.id);
    const flows = first.flows.map((f, i) => ({
      start: f.start,
      end: last.flows[i]?.end ?? f.end,
      label: flowLabel(f.profile),
    }));
    return {
      key: gi,
      label,
      height: 16 + 12 * Math.max(1, flows.length),
      on: first.powerOn,
      end: last.powerOff ?? total,
      attachStart: first.powerOn,
      attachEnd: last.powerOn,
      attachLabel: last.powerOn > first.powerOn ? `attach ${count} UE @ ${trimNum(tp?.attachRate ?? 1)}/s` : 'attach',
      flows,
      off: last.powerOff,
    };
  });
  const ticks = [0, 1, 2, 3, 4].map(k => formatSeconds(Math.round((total * k) / 4)));
  return { total, ticks, lanes };
}

// ── Narrative ────────────────────────────────────────────────────────────

interface Sentence { text: string; italic?: boolean }

function narrate(tc: UeTestCase, ues: DerivedUe[]): Sentence[] {
  const out: Sentence[] = [];
  const isNr = tc.cell.ratType === '5G:SA';
  const groups = tc.subscriber.groups;
  const cells = tc.cell.cells;
  const many = groups.length > 1;

  const desc = tc.settings.description.trim();
  if (desc) out.push({ text: desc, italic: true });

  // Who registers where.
  groups.forEach((g, gi) => {
    const count = ueCount(g);
    const cell = cells[servingCellIndex(tc, g)];
    const first = ues.find(u => u.group.id === g.id)?.imsi ?? supiToImsi(g.startingSupi);
    const plmn = plmnOfImsi(first, g.mncDigits);
    const ident = `${g.algorithm}, PLMN ${plmn.mcc}-${plmn.mnc}${g.networkSlicing === 'Enable' ? `, ${nssaiPhrase(g)}` : ''}`;
    const prefix = many ? `UE Group ${gi}: ` : '';
    if (!cell) {
      out.push({ text: `${prefix}${plural(count, 'UE')} (${ident}) ${count === 1 ? 'has' : 'have'} no cell to camp on.` });
      return;
    }
    const verb = isNr ? (count === 1 ? 'registers on' : 'register on') : (count === 1 ? 'attaches to' : 'attach to');
    out.push({
      text: `${prefix}${plural(count, 'UE')} (${ident}) ${verb} Cell ${servingCellIndex(tc, g)}, ${cellPhrase(cell, isNr)}, via ${rfPhrase(cell)}.`,
    });
  });

  // How they attach — one sentence per distinct traffic profile.
  const byProfile = new Map<number | 'none', number[]>();
  groups.forEach((g, gi) => {
    const tp = trafficFor(tc, g.id);
    const k = tp ? tp.id : 'none';
    byProfile.set(k, [...(byProfile.get(k) ?? []), gi]);
  });
  byProfile.forEach((gis, k) => {
    const subject = byProfile.size > 1 ? `UEs in UE Group${gis.length > 1 ? 's' : ''} ${gis.join(', ')}` : 'UEs';
    const tp = k === 'none' ? null : tc.traffic.profiles.find(p => p.id === k);
    if (!tp) {
      out.push({ text: `${subject} power on together at 0s (no traffic profile applies) and stay on.` });
      return;
    }
    const rate = `${trimNum(tp.attachRate)} per second`;
    const how = tp.attachType === 'Bursty' ? `in a burst, ${rate}` : `one after another, ${rate}`;
    const loop = tp.loopProfile === 'Enable' ? '; the attach cycle repeats in a loop' : '';
    out.push({ text: `${subject} attach ${how}, starting at ${formatSeconds(Math.max(0, tp.attachDelay))}${loop}.` });
  });

  // What traffic each UE generates.
  const applying = new Set<number>();
  for (const g of groups) for (const p of userPlanesFor(tc, g.id)) applying.add(p.id);
  const active = tc.userPlane.profiles.filter(p => applying.has(p.id));
  if (!active.length) {
    out.push({ text: 'No user-plane traffic is configured; the test exercises registration only.' });
  }
  for (const p of active) {
    const gi = p.subscriberGroup === 'all' ? -1 : groups.findIndex(g => g.id === p.subscriberGroup);
    const who = p.subscriberGroup === 'all' || !many || gi < 0 ? 'each UE' : `each UE in UE Group ${gi}`;
    const when = p.startDelay > 0 ? `${formatSeconds(p.startDelay)} after attaching, ` : 'as soon as it attaches, ';
    const dur = `for ${formatSeconds(Math.max(0, p.duration))}${p.loop ? ', looping until power-off' : ''}`;
    let what: string;
    if (p.dataType === 'IPERF') {
      const dirs: string[] = [];
      if (p.fileTransferAction !== 'UL') dirs.push(`${formatBitrate(p.dlBitrate)} downlink`);
      if (p.fileTransferAction !== 'DL') dirs.push(`${formatBitrate(p.ulBitrate)} uplink`);
      what = `runs iperf3 ${p.transportProtocol} to ${serverKey(p)}: ${dirs.join(' and ')} ${dur}`;
    } else if (p.dataType === 'PING') {
      what = `pings ${serverKey(p)} (ICMP) ${dur}`;
    } else {
      what = `fetches HTTP GET from ${serverKey(p)} ${dur}`;
    }
    out.push({ text: `${capitalize(when)}${who} ${what}.` });
  }

  // Mobility, only when the channel simulator is on.
  if (tc.cell.mobility) {
    const m = tc.mobility;
    const chan = m.channelModel !== 'None'
      ? `${m.channelModel} fading${m.dopplerHz > 0 ? ` with ${m.dopplerHz} Hz Doppler` : ''}`
      : 'no fading model';
    const parts = [chan, `reference signal power ${m.refSignalPower} dBm`];
    if (m.ulPowerAttenuation > 0) parts.push(`${m.ulPowerAttenuation} dB extra UL path loss`);
    const moves = groups.map((g, gi) => {
      const gm = m.groups.find(x => x.groupId === g.id);
      if (!gm) return null;
      const name = many ? `UE Group ${gi}` : 'the UEs';
      const s = many ? 's' : '';
      const where = `(${gm.x}, ${gm.y}) m`;
      return gm.speedKmh > 0
        ? `${name} start${s} at ${where} moving at ${gm.speedKmh} km/h on a ${gm.direction}° heading`
        : `${name} stay${s} at ${where}`;
    }).filter((s): s is string => !!s);
    out.push({ text: `Mobility is on: ${parts.join(', ')}${moves.length ? `; ${moves.join('; ')}` : ''}.` });
  }

  // When they switch off.
  const byOff = new Map<number, number[]>();
  groups.forEach((g, gi) => {
    const tp = trafficFor(tc, g.id);
    const d = tp ? Math.max(0, tp.powerOnDuration) : 0;
    byOff.set(d, [...(byOff.get(d) ?? []), gi]);
  });
  byOff.forEach((gis, d) => {
    const subject = byOff.size > 1 ? `UEs in UE Group${gis.length > 1 ? 's' : ''} ${gis.join(', ')}` : 'UEs';
    out.push({ text: d > 0 ? `${subject} power off ${formatSeconds(d)} after attaching.` : `${subject} stay on until the test is stopped.` });
  });

  const logs = LOG_PRESETS[tc.settings.logSettings]?.label ?? tc.settings.logSettings;
  out.push({ text: `Pass criterion: ${tc.settings.successSettings}. Logs: ${logs}.` });
  return out;
}

// ── Component ────────────────────────────────────────────────────────────

export function TestOverview({ tc }: { tc: UeTestCase }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const arrowHead = `${uid}-ah`;

  const model = useMemo(() => {
    const ues = expandUes(tc);
    const length = testLength(tc);
    const dl = aggregateMbps(tc, 'DL');
    const ul = aggregateMbps(tc, 'UL');
    const applying = new Set<number>();
    for (const g of tc.subscriber.groups) for (const p of userPlanesFor(tc, g.id)) applying.add(p.id);
    const types = uniq(tc.userPlane.profiles.filter(p => applying.has(p.id)).map(p => p.dataType));
    const load = !types.length
      ? 'no traffic'
      : dl || ul
        ? [dl ? `DL ${fmtMbps(dl)}` : null, ul ? `UL ${fmtMbps(ul)}` : null].filter(Boolean).join(' / ')
        : types.join(' + ');
    const tiles = [
      { label: 'UEs', value: String(totalUes(tc)) },
      { label: 'Cells', value: `${tc.cell.cells.length} · ${tc.cell.ratType}` },
      { label: 'Offered load', value: load },
      { label: 'Test length', value: formatSeconds(round1(length)) },
      { label: 'Pass criterion', value: tc.settings.successSettings },
    ];
    return {
      tiles,
      topology: buildTopology(tc, ues),
      timeline: buildTimeline(tc, length),
      sentences: narrate(tc, ues),
    };
  }, [tc]);

  const { tiles, topology: tp, timeline: tl, sentences } = model;
  const pct = (t: number) => Math.max(0, Math.min(100, (t / tl.total) * 100));
  const span = (a: number, b: number, minPx = 2) => ({
    left: `${pct(a)}%`,
    width: `${Math.max(0, pct(b) - pct(a))}%`,
    minWidth: minPx,
  });
  /** Put a label just right of `t`, or just left of `fallback` when `t` is near the end. */
  const labelAt = (t: number, fallback: number) =>
    pct(t) > 82 ? { right: `calc(${100 - pct(fallback)}% + 4px)` } : { left: `calc(${pct(t)}% + 4px)` };

  return (
    <div className="space-y-5 text-foreground">
      {/* 1. Summary strip */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))' }}>
        {tiles.map(t => (
          <div key={t.label} className="rounded-md border border-border bg-card px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.label}</div>
            <div className="text-sm font-semibold leading-tight">{t.value}</div>
          </div>
        ))}
      </div>

      {/* 2. Topology */}
      <section>
        <SectionLabel>Topology</SectionLabel>
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${tp.width} ${tp.height}`}
            className="block h-auto w-full min-w-[540px]"
            role="img"
            aria-label="Test topology: UE groups, cells, network under test and traffic servers"
          >
            <defs>
              <marker
                id={arrowHead} viewBox="0 0 8 8" refX={7} refY={4} markerWidth={7} markerHeight={7}
                markerUnits="userSpaceOnUse" orient="auto-start-reverse"
              >
                <path d="M0.5,0.5 L7.5,4 L0.5,7.5 z" className="fill-primary" />
              </marker>
            </defs>

            {tp.headings.map(h => (
              <text key={h.text} x={h.x} y={12} fontSize={9.5} letterSpacing={0.8} className="fill-muted-foreground">
                {h.text.toUpperCase()}
              </text>
            ))}

            {tp.links.map((d, i) => (
              <path key={i} d={d} fill="none" strokeWidth={1.2} opacity={0.6} className="stroke-muted-foreground" />
            ))}

            {tp.ueBoxes.map(b => <SvgBox key={b.title} b={b} accent glyph="phone" />)}
            {tp.cellBoxes.map(b => <SvgBox key={b.title} b={b} glyph="antenna" />)}
            <SvgBox b={tp.netBox} dashed />
            {tp.serverBoxes.map(b => <SvgBox key={b.title} b={b} glyph="server" />)}

            {tp.arrows.map((a, i) => (
              <g key={i}>
                <line
                  x1={a.x1} y1={a.y} x2={a.x2} y2={a.y} strokeWidth={1.4} className="stroke-primary"
                  markerStart={a.dir !== 'right' ? `url(#${arrowHead})` : undefined}
                  markerEnd={a.dir !== 'left' ? `url(#${arrowHead})` : undefined}
                />
                <text x={a.tx} y={a.ty} fontSize={9} fontWeight={600} textAnchor="middle" className="fill-primary">
                  {fitText(a.text, a.x2 - a.x1 - 4, 9)}
                </text>
              </g>
            ))}

            {tp.fading && (
              <g>
                <rect
                  x={tp.fading.x - tp.fading.w / 2} y={tp.fading.y - tp.fading.h / 2}
                  width={tp.fading.w} height={tp.fading.h} rx={tp.fading.lines.length > 1 ? 7 : tp.fading.h / 2}
                  strokeWidth={1} className="fill-card stroke-primary"
                />
                {tp.fading.lines.map((l, i) => (
                  <text
                    key={l} x={tp.fading!.x} y={tp.fading!.y - tp.fading!.h / 2 + 12 + i * 11}
                    fontSize={9} fontWeight={600} textAnchor="middle" className="fill-primary"
                  >
                    {l}
                  </text>
                ))}
              </g>
            )}
          </svg>
        </div>
      </section>

      {/* 3. Timeline */}
      <section>
        <SectionLabel>Timeline</SectionLabel>
        <div className="space-y-1.5">
          {tl.lanes.length === 0 && (
            <div className="text-[10px] text-muted-foreground">No UE groups yet.</div>
          )}
          {tl.lanes.map(lane => (
            <div key={lane.key} className="sm:flex sm:items-start sm:gap-2">
              <div className="truncate text-[10px] leading-4 text-muted-foreground sm:w-24 sm:shrink-0 sm:pt-1" title={lane.label}>
                {lane.label}
              </div>
              <div className="relative min-w-0 flex-1 overflow-hidden rounded-sm bg-secondary" style={{ height: lane.height }}>
                {[25, 50, 75].map(p => (
                  <div key={p} className="absolute inset-y-0 border-l border-border" style={{ left: `${p}%` }} />
                ))}
                {lane.on == null ? (
                  <div className="absolute inset-0 flex items-center px-2 text-[9px] text-muted-foreground">no UEs in this group</div>
                ) : (
                  <>
                    {/* powered on */}
                    <div
                      className="absolute bottom-0.5 top-0.5 rounded-sm bg-brand-mist/60 dark:bg-brand-mist/15"
                      style={span(lane.on, lane.end)}
                    />
                    {/* attach ramp */}
                    <div
                      className="absolute top-0.5 h-[10px] rounded-sm bg-brand-petrol/30 dark:bg-brand-mist/45"
                      style={span(lane.attachStart, lane.attachEnd, 2)}
                    />
                    <span
                      className="absolute top-0 whitespace-nowrap text-[9px] leading-[13px] text-muted-foreground"
                      style={labelAt(lane.attachEnd, lane.attachStart)}
                    >
                      {lane.attachLabel}
                    </span>
                    {/* user-plane flows */}
                    {lane.flows.map((f, i) => (
                      <div
                        key={i}
                        title={`${f.label} · ${formatSeconds(round1(f.start))} → ${formatSeconds(round1(f.end))}`}
                        className="absolute overflow-hidden whitespace-nowrap rounded-sm bg-primary px-1 text-[9px] leading-[11px] text-primary-foreground"
                        style={{ ...span(f.start, f.end, 3), top: 14 + i * 12, height: 11 }}
                      >
                        {f.label}
                      </div>
                    ))}
                    {/* power off */}
                    {lane.off != null && (
                      <>
                        <div className="absolute inset-y-0 w-0.5 bg-destructive" style={{ left: `${pct(lane.off)}%` }} />
                        <span
                          className="absolute top-0 text-[9px] leading-[13px] text-destructive"
                          style={labelAt(lane.off, lane.off)}
                        >
                          off
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {tl.lanes.length > 0 && (
            <div className="sm:flex sm:gap-2">
              <div className="hidden sm:block sm:w-24 sm:shrink-0" />
              <div className="relative h-4 flex-1 border-t border-border text-[9px] text-muted-foreground">
                {tl.ticks.map((t, i) => (
                  <span
                    key={i}
                    className="absolute top-0 whitespace-nowrap"
                    style={i === 0 ? { left: 0 } : i === tl.ticks.length - 1 ? { right: 0 } : { left: `${i * 25}%`, transform: 'translateX(-50%)' }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. Narrative */}
      <section>
        <SectionLabel>What this test does</SectionLabel>
        <ul className="list-disc space-y-1 pl-4 text-xs leading-snug">
          {sentences.map((s, i) => (
            <li key={i} className={s.italic ? 'italic text-muted-foreground' : undefined}>{s.text}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 border-b border-border pb-1 text-xs uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

function SvgBox({ b, accent, dashed, glyph }: {
  b: Placed;
  accent?: boolean;
  dashed?: boolean;
  glyph?: 'phone' | 'antenna' | 'server';
}) {
  const padL = accent ? 13 : 10;
  // Only the title shares a row with the glyph; body lines run under it.
  const titleW = b.w - padL - (glyph ? 26 : 8);
  const lineW = b.w - padL - 8;
  const gx = b.x + b.w - 20;
  const gy = b.y + 7;
  return (
    <g>
      <rect
        x={b.x} y={b.y} width={b.w} height={b.h} rx={6} strokeWidth={1}
        strokeDasharray={dashed ? '4 3' : undefined}
        className="fill-card stroke-border"
      />
      {accent && <rect x={b.x + 3} y={b.y + 7} width={3} height={b.h - 14} rx={1.5} className="fill-primary" />}
      <text x={b.x + padL} y={b.y + 15} fontSize={12} fontWeight={600} className="fill-foreground">
        {fitText(b.title, titleW * 0.95, 12)}
      </text>
      {b.lines.map((line, i) => (
        <text key={i} x={b.x + padL} y={b.y + 29 + 13 * i} fontSize={10} className="fill-muted-foreground">
          {fitText(line, lineW, 10)}
        </text>
      ))}
      {glyph === 'phone' && (
        <g fill="none" strokeWidth={1} className="stroke-muted-foreground">
          <rect x={gx} y={gy} width={10} height={15} rx={2} />
          <rect x={gx + 2} y={gy + 2.5} width={6} height={8.5} rx={0.8} />
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
          <rect x={gx - 1} y={gy} width={12} height={6} rx={1} />
          <rect x={gx - 1} y={gy + 8} width={12} height={6} rx={1} />
          <circle cx={gx + 8.5} cy={gy + 3} r={0.9} className="fill-muted-foreground" />
          <circle cx={gx + 8.5} cy={gy + 11} r={0.9} className="fill-muted-foreground" />
        </g>
      )}
    </g>
  );
}
