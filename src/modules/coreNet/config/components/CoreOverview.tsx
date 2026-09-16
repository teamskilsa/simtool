// modules/coreNet/config/components/CoreOverview.tsx
//
// The customer-facing picture of an Amarisoft Core (ltemme / EPC + 5GC)
// configuration, rendered live beside the form: a strip of headline numbers,
// a left-to-right topology (subscriber ranges → radio → core → data
// networks, with IMS hanging off the core), the address plan as a table, and
// a plain-English narrative. Every number comes through derive.ts so the
// picture and the generated mme.cfg cannot disagree about who exists, which
// APN they land on, or whether the pool is big enough to hold them.
'use client';

import { useId, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LOG_PRESETS } from '../defaults';
import {
  addressList, defaultPdn, expandSubscribers, formatPlmn, imsDomainFor, incrementDigits,
  poolCapacity, totalSubscribers, underCapacityPdns,
} from '../derive';
import type { CoreConfig, PdnEntry, SubscriberRange } from '../types';

// ── Geometry of the topology drawing (viewBox units) ─────────────────────

const VIEW_W = 760;
const PAD_X = 10;
/** First row of boxes, below the column headings. */
const TOP = 24;
const ROW_GAP = 14;
/** Vertical room between the core box and the IMS box slung under it. */
const IMS_GAP = 30;
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

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** "510 addresses" — plural() would give "addresss". */
function addressCount(n: number): string {
  return `${n} address${n === 1 ? '' : 'es'}`;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

function numberWord(n: number): string {
  return n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
}

/** "a, b and c" — the reading voice, not a bare join. */
function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function algoName(a: SubscriberRange['simAlgo']): string {
  return a === 'xor' ? 'XOR' : a === 'tuak' ? 'TUAK' : 'Milenage';
}

function coreTitle(t: CoreConfig['network']['coreType']): string {
  return t === 'Combined' ? 'EPC + 5GC' : t;
}

function corePhrase(t: CoreConfig['network']['coreType']): string {
  return t === 'Combined' ? 'a combined EPC and 5G core' : t === '5GC' ? 'a 5G core' : 'an EPC';
}

function subscriberCount(r: SubscriberRange): number {
  return Math.max(0, Math.floor(r.count));
}

/** The last IMSI a range hands out. */
function lastImsi(r: SubscriberRange): string {
  return incrementDigits(r.startingImsi, Math.max(0, subscriberCount(r) - 1));
}

/** Gap between allocated addresses: Amarisoft spaces them by 2^ip_addr_shift. */
function spacing(p: PdnEntry): number {
  return Math.pow(2, Math.max(0, p.ipAddrShift));
}

function hasV4(p: PdnEntry): boolean {
  return p.pdnType === 'ipv4' || p.pdnType === 'ipv4v6';
}

/** The pool a customer would read off the APN, v4 first then v6 prefixes. */
function rangeText(p: PdnEntry): string {
  if (hasV4(p) && p.firstIpAddr.trim()) return `${p.firstIpAddr} – ${p.lastIpAddr}`;
  if (p.firstIpv6Prefix.trim()) return `${p.firstIpv6Prefix} – ${p.lastIpv6Prefix}`;
  return '—';
}

function firstQci(p: PdnEntry): number | null {
  return p.erabs[0]?.qci ?? p.slices[0]?.qosFlows[0]?.qci ?? null;
}

function pCscfOf(p: PdnEntry): string | null {
  return addressList(p.pCscfAddr)[0] ?? null;
}

// ── Topology model ───────────────────────────────────────────────────────

type Glyph = 'sim' | 'antenna' | 'core' | 'cloud';

interface BoxSpec {
  title: string;
  lines: string[];
  chips?: string[];
  /** Orange left accent — the thing actually being configured. */
  accent?: boolean;
  dashed?: boolean;
  /** Context only: drawn faded so it does not compete with the core. */
  subdued?: boolean;
  danger?: boolean;
  glyph?: Glyph;
}
interface Placed extends BoxSpec { x: number; y: number; w: number; h: number; cy: number }

interface Topology {
  width: number;
  height: number;
  headings: Array<{ x: number; text: string }>;
  subBoxes: Placed[];
  radioBox: Placed;
  coreBox: Placed;
  pdnBoxes: Placed[];
  imsBox: Placed | null;
  imsLink: { d: string; label: string; lx: number; ly: number } | null;
  /** Muted connector paths, drawn under the boxes. */
  links: string[];
  /** Core → APN, with the bearer's QCI on the link. */
  arrows: Array<{ d: string; tx: number; ty: number; text: string }>;
}

function boxHeight(s: BoxSpec): number {
  return 24 + 13 * s.lines.length + (s.chips && s.chips.length ? 17 : 0);
}

function colHeight(slots: number[]): number {
  return slots.reduce((a, b) => a + b, 0) + ROW_GAP * Math.max(0, slots.length - 1);
}

/** Spread the columns across the drawing. Slack goes mostly to the gaps
 *  (where the connectors and their labels live) and a little to the boxes;
 *  when the minimums do not fit in VIEW_W the drawing widens instead of
 *  squeezing text, since the SVG scales to the panel anyway. */
function placeColumns(widths: number[], minGaps: number[]): { xs: number[]; ws: number[]; viewW: number } {
  const sumW = widths.reduce((a, b) => a + b, 0);
  const sumG = minGaps.reduce((a, b) => a + b, 0);
  const viewW = Math.max(VIEW_W, 2 * PAD_X + sumW + sumG);
  const extra = viewW - 2 * PAD_X - sumW - sumG;
  const ws = widths.map(w => w + extra * 0.4 * (w / sumW));
  const gaps = minGaps.map(g => g + (extra * 0.6) / Math.max(1, minGaps.length));
  const xs: number[] = [];
  let x = PAD_X;
  ws.forEach((w, i) => {
    xs.push(x);
    x += w + (gaps[i] ?? 0);
  });
  return { xs, ws, viewW };
}

/** Stack a column's boxes top-down, the column centred on the tallest one. */
function placeColumn(specs: BoxSpec[], x: number, w: number, maxColH: number): Placed[] {
  const slots = specs.map(boxHeight);
  let y = TOP + (maxColH - colHeight(slots)) / 2;
  return specs.map(s => {
    const h = boxHeight(s);
    const placed: Placed = { ...s, x, y, w, h, cy: y + h / 2 };
    y += h + ROW_GAP;
    return placed;
  });
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M${r1(x1)} ${r1(y1)} C${r1(mx)} ${r1(y1)} ${r1(mx)} ${r1(y2)} ${r1(x2)} ${r1(y2)}`;
}

function buildTopology(cfg: CoreConfig): Topology {
  const net = cfg.network;
  const ranges = cfg.subscriber.ranges;
  const pdns = cfg.pdn.pdns;
  const needed = totalSubscribers(cfg);

  // Column 1 — subscriber ranges.
  const subSpecs: BoxSpec[] = ranges.map((r, i) => {
    const count = subscriberCount(r);
    const lines = [plural(count, 'subscriber'), `IMSI ${r.startingImsi}`];
    if (count > 1) lines.push(`… ${lastImsi(r)}`);
    lines.push(algoName(r.simAlgo) + (r.imsEnabled ? ' · IMS identities' : ''));
    return { title: `Range ${i + 1}`, lines, glyph: 'sim' as const };
  });
  if (!subSpecs.length) {
    subSpecs.push({ title: 'No subscribers', lines: ['add a range on the Subscribers step'], glyph: 'sim' });
  }

  // Column 2 — the radio, which this config does not own.
  const radioSpec: BoxSpec = {
    title: 'gNB / eNB',
    lines: ['(not configured here)'],
    dashed: true,
    subdued: true,
    glyph: 'antenna',
  };

  // Column 3 — the core itself.
  const coreChips: string[] = [];
  if (net.dcnrSupport) coreChips.push('DCNR');
  if (net.cpCiotOpt) coreChips.push('CP-CIoT');
  if (net.epsInterworking === 'with_n26') coreChips.push('N26');
  else if (net.epsInterworking === 'without_n26') coreChips.push('EPS interworking');
  const coreSpec: BoxSpec = {
    title: coreTitle(net.coreType),
    lines: [
      `PLMN ${formatPlmn(net.mcc, net.mnc)}`,
      `MME ${net.mmeGroupId}/${net.mmeCode}`,
      `GTP-U ${net.gtpAddr || '—'}`,
    ],
    chips: coreChips,
    accent: true,
    glyph: 'core',
  };

  // Column 4 — one data network per APN.
  const pdnSpecs: BoxSpec[] = pdns.map(p => {
    const cap = poolCapacity(p);
    const chips: string[] = [];
    if (p.emergency) chips.push('SOS');
    if (pCscfOf(p)) chips.push('IMS');
    const lines = [p.pdnType, rangeText(p)];
    if (cap != null) lines.push(addressCount(cap));
    const dns = addressList(p.dnsAddr)[0];
    if (dns) lines.push(`DNS ${dns}`);
    return {
      title: p.apn || '(no apn)',
      lines,
      chips,
      danger: cap != null && cap < needed,
      glyph: 'cloud' as const,
    };
  });
  if (!pdnSpecs.length) {
    pdnSpecs.push({ title: 'No APNs', lines: ['add one on the PDN step'], glyph: 'cloud' });
  }

  // Horizontal layout: the base widths and gaps sum to exactly VIEW_W.
  const { xs, ws, viewW } = placeColumns([176, 116, 154, 164], [44, 42, 44]);

  // Vertical layout.
  const maxColH = Math.max(
    colHeight(subSpecs.map(boxHeight)),
    boxHeight(radioSpec),
    boxHeight(coreSpec),
    colHeight(pdnSpecs.map(boxHeight)),
  );

  const subBoxes = placeColumn(subSpecs, xs[0], ws[0], maxColH);
  const radioBox = placeColumn([radioSpec], xs[1], ws[1], maxColH)[0];
  const coreBox = placeColumn([coreSpec], xs[2], ws[2], maxColH)[0];
  const pdnBoxes = placeColumn(pdnSpecs, xs[3], ws[3], maxColH);

  // IMS hangs below the core column, on its own dashed link.
  let imsBox: Placed | null = null;
  let imsLink: Topology['imsLink'] = null;
  if (cfg.ims.enabled) {
    const spec: BoxSpec = { title: 'IMS', lines: [cfg.ims.imsAddr || '—'], accent: true };
    const h = boxHeight(spec);
    const w = Math.min(ws[2], 130);
    const x = xs[2] + (ws[2] - w) / 2;
    const y = TOP + maxColH + IMS_GAP;
    imsBox = { ...spec, x, y, w, h, cy: y + h / 2 };
    const cx = coreBox.x + coreBox.w / 2;
    const ix = x + w / 2;
    imsLink = {
      d: curve(cx, coreBox.y + coreBox.h, ix, y),
      label: cfg.ims.rxEnabled ? `Rx · QCI ${cfg.ims.rxQciAudio}/${cfg.ims.rxQciVideo}` : 'SIP',
      lx: (cx + ix) / 2 + 6,
      ly: (coreBox.y + coreBox.h + y) / 2 + 3,
    };
  }

  const height = (imsBox ? imsBox.y + imsBox.h : TOP + maxColH) + 12;

  // Connectors. Subscribers reach the core through the radio, which the
  // boxes paint over, so the line reads as passing behind it.
  const links = subBoxes.map(b => curve(b.x + b.w, b.cy, coreBox.x, coreBox.cy));

  const arrows: Topology['arrows'] = pdnBoxes.map((b, i) => {
    const qci = pdns[i] ? firstQci(pdns[i]) : null;
    return {
      d: curve(coreBox.x + coreBox.w + 2, coreBox.cy, b.x - 6, b.cy),
      tx: (coreBox.x + coreBox.w + b.x) / 2,
      ty: (coreBox.cy + b.cy) / 2 - 4,
      text: qci == null ? '' : `QCI ${qci}`,
    };
  });

  const headingText = ['Subscribers', 'Radio', 'Core', 'Data networks'];
  const headings = xs.map((x, i) => ({ x, text: headingText[i] }));

  return { width: viewW, height, headings, subBoxes, radioBox, coreBox, pdnBoxes, imsBox, imsLink, links, arrows };
}

// ── Address plan ─────────────────────────────────────────────────────────

interface PlanRow {
  key: number;
  apn: string;
  type: string;
  range: string;
  spacing: string;
  capacity: string;
  short: number;
}

function buildPlan(cfg: CoreConfig): PlanRow[] {
  const needed = totalSubscribers(cfg);
  return cfg.pdn.pdns.map(p => {
    const cap = poolCapacity(p);
    const step = spacing(p);
    return {
      key: p.id,
      apn: p.apn || '(no apn)',
      type: p.pdnType,
      range: rangeText(p),
      spacing: `every ${step}`,
      capacity: cap == null ? '—' : String(cap),
      short: cap == null ? 0 : Math.max(0, needed - cap),
    };
  });
}

// ── Narrative ────────────────────────────────────────────────────────────

interface Sentence { text: string; italic?: boolean; danger?: boolean }

function narrate(cfg: CoreConfig): Sentence[] {
  const out: Sentence[] = [];
  const net = cfg.network;
  const ranges = cfg.subscriber.ranges;
  const pdns = cfg.pdn.pdns;
  const total = totalSubscribers(cfg);

  const desc = cfg.settings.description.trim();
  if (desc) out.push({ text: desc, italic: true });

  // What the core is.
  const caps: string[] = [];
  if (net.dcnrSupport) caps.push('dual connectivity with NR');
  if (net.cpCiotOpt) caps.push('control-plane CIoT optimisation');
  if (net.epsInterworking === 'with_n26') caps.push('EPS interworking over N26');
  else if (net.epsInterworking === 'without_n26') caps.push('EPS interworking without N26');
  out.push({
    text: `Serves PLMN ${formatPlmn(net.mcc, net.mnc)} as ${corePhrase(net.coreType)} on tracking area ${net.tac}, `
      + `identified as MME group ${net.mmeGroupId} code ${net.mmeCode}`
      + (caps.length ? `, advertising ${listPhrase(caps)}` : '')
      + '.',
  });

  // Who is in the database.
  if (!total) {
    out.push({ text: 'No subscribers are defined yet, so nothing can attach.' });
  } else if (ranges.length === 1 && ranges[0]) {
    const r = ranges[0];
    out.push({
      text: `${plural(subscriberCount(r), 'subscriber')} from IMSI ${r.startingImsi}, authenticated with ${algoName(r.simAlgo)}.`,
    });
  } else {
    const parts = ranges
      .filter(r => subscriberCount(r) > 0)
      .map(r => `${subscriberCount(r)} from IMSI ${r.startingImsi} with ${algoName(r.simAlgo)}`);
    out.push({ text: `${plural(total, 'subscriber')} in ${plural(ranges.length, 'range')}: ${listPhrase(parts)}.` });
  }

  // Which data networks they can reach.
  if (!pdns.length) {
    out.push({ text: 'No APN is configured, so attached subscribers would get no data network.' });
  } else {
    const first = pdns[0];
    const cap = first ? poolCapacity(first) : null;
    const qci = first ? firstQci(first) : null;
    const head = first
      ? `${first.apn || '(no apn)'} on ${rangeText(first)}`
        + (cap != null || qci != null
          ? ` (${[cap != null ? addressCount(cap) : null, qci != null ? `QCI ${qci}` : null]
            .filter(Boolean).join(', ')})`
          : '')
      : '';
    const rest = pdns.slice(1).map(p => {
      const name = p.apn || '(no apn)';
      if (p.emergency) return `${name} for emergency calls`;
      if (pCscfOf(p)) return `${name} for IMS signalling`;
      return name;
    });
    out.push({
      text: `${numberWord(pdns.length)} APN${pdns.length === 1 ? '' : 's'}: ${listPhrase([head, ...rest])}.`,
    });
  }

  // Voice.
  if (cfg.ims.enabled) {
    const vops = [cfg.ims.vopsEps ? 'EPS' : null, cfg.ims.vops5gs ? '5GS' : null, cfg.ims.vops5gsN3gpp ? 'non-3GPP' : null]
      .filter((s): s is string => !!s);
    const rx = cfg.ims.rxEnabled
      ? ` and the Rx interface asks for QCI ${cfg.ims.rxQciAudio} audio and QCI ${cfg.ims.rxQciVideo} video`
      : '';
    const emergency = cfg.ims.emergencyNumbers.length
      ? `; ${listPhrase(cfg.ims.emergencyNumbers.map(e => e.digits))} ${cfg.ims.emergencyNumbers.length === 1 ? 'is' : 'are'} recognised as emergency numbers`
      : '';
    out.push({
      text: `IMS is reachable at ${cfg.ims.imsAddr || 'no address'}${rx}`
        + (vops.length ? `, with IMS voice advertised on ${listPhrase(vops)}` : '')
        + `${emergency}.`,
    });
  } else {
    out.push({ text: 'Voice over IMS is off, so the core carries data bearers only.' });
  }

  // IMS identities in the subscriber database.
  const domains = uniq(
    ranges.filter(r => r.imsEnabled && subscriberCount(r) > 0)
      .map(r => r.imsDomain.trim() || imsDomainFor(net.mcc, net.mnc)),
  );
  if (domains.length) {
    out.push({
      text: `Subscribers get IMS identities in the domain ${listPhrase(domains)}.`,
    });
  }

  // Anything that will not fit.
  const short = underCapacityPdns(cfg);
  if (short.length) {
    const worst = short[0];
    const names = listPhrase(short.map(s => s.pdn.apn || '(no apn)'));
    out.push({
      danger: true,
      text: short.length === 1
        ? `APN ${names} can address only ${worst.capacity} of the ${worst.needed} subscribers — ${worst.needed - worst.capacity} would attach without an address.`
        : `APNs ${names} are too small for ${worst.needed} subscribers; the smallest holds ${worst.capacity}.`,
    });
  }

  // How it is logged.
  const preset = LOG_PRESETS[cfg.settings.logSettings]?.label ?? cfg.settings.logSettings;
  const file = cfg.settings.logFilename.trim() || `/tmp/${cfg.settings.configName || 'untitled'}.log`;
  out.push({ text: `Logs are written at the ${preset} preset to ${file}.` });
  return out;
}

// ── Component ────────────────────────────────────────────────────────────

export function CoreOverview({ cfg }: { cfg: CoreConfig }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const arrowHead = `${uid}-ah`;

  const model = useMemo(() => {
    const total = totalSubscribers(cfg);
    const def = defaultPdn(cfg);
    const defCap = def ? poolCapacity(def) : null;
    const pCscf = cfg.pdn.pdns.map(pCscfOf).find((a): a is string => !!a) ?? null;
    const subs = expandSubscribers(cfg, 1);
    const firstImsi = subs[0]?.imsi ?? cfg.subscriber.ranges[0]?.startingImsi ?? '—';

    const tiles = [
      {
        label: 'Subscribers',
        value: String(total),
        sub: total ? `from ${firstImsi}` : 'none defined',
      },
      {
        label: 'PLMN',
        value: formatPlmn(cfg.network.mcc, cfg.network.mnc),
        sub: cfg.network.coreType,
      },
      {
        label: 'APNs',
        value: String(cfg.pdn.pdns.length),
        sub: def ? `${def.apn || '(no apn)'} is default` : 'none defined',
      },
      {
        label: 'Address pool',
        value: defCap == null ? '—' : addressCount(defCap),
        sub: def ? `on ${def.apn || '(no apn)'}` : '—',
      },
      {
        label: 'Voice',
        value: cfg.ims.enabled ? 'IMS on' : 'IMS off',
        sub: cfg.ims.enabled ? (pCscf ? `P-CSCF ${pCscf}` : 'no P-CSCF on any APN') : 'data only',
      },
    ];

    return {
      tiles,
      topology: buildTopology(cfg),
      plan: buildPlan(cfg),
      sentences: narrate(cfg),
    };
  }, [cfg]);

  const { tiles, topology: tp, plan, sentences } = model;

  return (
    <div className="space-y-5 text-foreground">
      {/* 1. Summary strip */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))' }}>
        {tiles.map(t => (
          <div key={t.label} className="rounded-md border border-border bg-card px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.label}</div>
            <div className="text-sm font-semibold leading-tight">{t.value}</div>
            <div className="truncate text-[10px] leading-tight text-muted-foreground" title={t.sub}>{t.sub}</div>
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
            aria-label="Core topology: subscriber ranges, the radio, the core and its data networks"
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

            {/* Connectors first, so the boxes paint over them. */}
            {tp.links.map((d, i) => (
              <path key={i} d={d} fill="none" strokeWidth={1.2} opacity={0.6} className="stroke-muted-foreground" />
            ))}
            {tp.arrows.map((a, i) => (
              <path
                key={`a${i}`} d={a.d} fill="none" strokeWidth={1.4}
                className="stroke-primary" markerEnd={`url(#${arrowHead})`}
              />
            ))}
            {tp.imsLink && (
              <path
                d={tp.imsLink.d} fill="none" strokeWidth={1.2} strokeDasharray="4 3"
                className="stroke-primary" opacity={0.8}
              />
            )}

            <SvgBox b={tp.radioBox} />
            {tp.subBoxes.map((b, i) => <SvgBox key={`s${i}`} b={b} />)}
            <SvgBox b={tp.coreBox} />
            {tp.pdnBoxes.map((b, i) => <SvgBox key={`p${i}`} b={b} />)}
            {tp.imsBox && <SvgBox b={tp.imsBox} />}

            {/* Link labels sit above the boxes so they are never occluded. */}
            {tp.arrows.map((a, i) => a.text && (
              <text
                key={`t${i}`} x={a.tx} y={a.ty} fontSize={9} fontWeight={600}
                textAnchor="middle" className="fill-primary"
              >
                {a.text}
              </text>
            ))}
            {tp.imsLink && (
              <text x={tp.imsLink.lx} y={tp.imsLink.ly} fontSize={9} fontWeight={600} className="fill-primary">
                {tp.imsLink.label}
              </text>
            )}
          </svg>
        </div>
      </section>

      {/* 3. Address plan */}
      <section>
        <SectionLabel>Address plan</SectionLabel>
        {plan.length === 0 ? (
          <div className="text-[10px] text-muted-foreground">No APNs yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {['APN', 'Type', 'Range', 'Spacing', 'Capacity', 'Status'].map(h => (
                  <TableHead key={h} className="h-8 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.map(r => (
                <TableRow key={r.key}>
                  <TableCell className="py-1.5 text-xs font-medium">{r.apn}</TableCell>
                  <TableCell className="py-1.5 text-xs text-muted-foreground">{r.type}</TableCell>
                  <TableCell className="py-1.5 font-mono text-[11px]">{r.range}</TableCell>
                  <TableCell className="py-1.5 text-xs text-muted-foreground">{r.spacing}</TableCell>
                  <TableCell className="py-1.5 text-xs">{r.capacity}</TableCell>
                  <TableCell className={`py-1.5 text-xs ${r.short > 0 ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                    {r.short > 0 ? `short by ${r.short}` : 'ok'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* 4. Narrative */}
      <section>
        <SectionLabel>What this core does</SectionLabel>
        <ul className="list-disc space-y-1 pl-4 text-xs leading-snug">
          {sentences.map((s, i) => (
            <li
              key={i}
              className={s.italic ? 'italic text-muted-foreground' : s.danger ? 'text-destructive' : undefined}
            >
              {s.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 border-b border-border pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

function SvgBox({ b }: { b: Placed }) {
  const padL = b.accent ? 13 : 10;
  // Only the title shares a row with the glyph; body lines run under it.
  const titleW = b.w - padL - (b.glyph ? 26 : 8);
  const lineW = b.w - padL - 8;
  const gx = b.x + b.w - 20;
  const gy = b.y + 7;
  const faded = b.subdued ? 0.7 : 1;

  // Capability chips fill the reserved 17px strip at the foot of the box.
  const chips: Array<{ x: number; w: number; text: string }> = [];
  if (b.chips && b.chips.length) {
    let cx = b.x + padL;
    for (const text of b.chips) {
      const w = estWidth(text, 8) + 10;
      if (cx + w > b.x + b.w - 8) break;
      chips.push({ x: cx, w, text });
      cx += w + 4;
    }
  }
  const chipY = b.y + b.h - 17;

  return (
    <g opacity={faded}>
      <rect
        x={b.x} y={b.y} width={b.w} height={b.h} rx={6} strokeWidth={1}
        strokeDasharray={b.dashed ? '4 3' : undefined}
        className={b.danger ? 'fill-card stroke-destructive' : 'fill-card stroke-border'}
      />
      {b.accent && <rect x={b.x + 3} y={b.y + 7} width={3} height={b.h - 14} rx={1.5} className="fill-primary" />}
      <text
        x={b.x + padL} y={b.y + 15} fontSize={12} fontWeight={600}
        className={b.subdued ? 'fill-muted-foreground' : 'fill-foreground'}
      >
        {fitText(b.title, titleW * 0.95, 12)}
      </text>
      {b.lines.map((line, i) => (
        <text key={i} x={b.x + padL} y={b.y + 29 + 13 * i} fontSize={10} className="fill-muted-foreground">
          {fitText(line, lineW, 10)}
        </text>
      ))}
      {chips.map(c => (
        <g key={c.text}>
          <rect
            x={c.x} y={chipY} width={c.w} height={13} rx={6.5}
            className="fill-brand-orange-100 dark:fill-brand-orange-700"
          />
          <text
            x={c.x + c.w / 2} y={chipY + 9.4} fontSize={8} fontWeight={600} textAnchor="middle"
            className="fill-brand-orange-700 dark:fill-brand-orange-100"
          >
            {c.text}
          </text>
        </g>
      ))}
      {b.glyph === 'sim' && (
        <g fill="none" strokeWidth={1} className="stroke-muted-foreground">
          <path d={`M${gx} ${gy + 2} a2 2 0 0 1 2 -2 h5 l3 3 v10 a2 2 0 0 1 -2 2 h-8 a2 2 0 0 1 -2 -2 z`} />
          <rect x={gx + 2.5} y={gy + 5} width={5} height={5} rx={1} />
        </g>
      )}
      {b.glyph === 'antenna' && (
        <g fill="none" strokeWidth={1} className="stroke-muted-foreground">
          <circle cx={gx + 5} cy={gy + 4} r={1.6} className="fill-muted-foreground" />
          <line x1={gx + 5} y1={gy + 5.5} x2={gx + 5} y2={gy + 15} />
          <path d={`M${gx + 1} ${gy + 1} a4 4 0 0 0 0 6`} />
          <path d={`M${gx + 9} ${gy + 1} a4 4 0 0 1 0 6`} />
          <path d={`M${gx + 1.5} ${gy + 15} L${gx + 5} ${gy + 9} L${gx + 8.5} ${gy + 15}`} />
        </g>
      )}
      {b.glyph === 'core' && (
        <g fill="none" strokeWidth={1} className="stroke-muted-foreground">
          <rect x={gx - 1} y={gy} width={12} height={15} rx={2} />
          <line x1={gx - 1} y1={gy + 5} x2={gx + 11} y2={gy + 5} />
          <line x1={gx - 1} y1={gy + 10} x2={gx + 11} y2={gy + 10} />
          <circle cx={gx + 1.6} cy={gy + 2.5} r={0.9} className="fill-muted-foreground" />
          <circle cx={gx + 1.6} cy={gy + 7.5} r={0.9} className="fill-muted-foreground" />
          <circle cx={gx + 1.6} cy={gy + 12.5} r={0.9} className="fill-muted-foreground" />
        </g>
      )}
      {b.glyph === 'cloud' && (
        <g fill="none" strokeWidth={1} className="stroke-muted-foreground">
          <path d={`M${gx + 1} ${gy + 12} a3.2 3.2 0 0 1 0.6 -6.3 a4 4 0 0 1 7.5 -1.2 a3 3 0 0 1 0.4 5.9 z`} />
        </g>
      )}
    </g>
  );
}
