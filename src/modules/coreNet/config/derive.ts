// modules/coreNet/config/derive.ts
//
// Pure derivations from a CoreConfig that both the generator and the visual
// overview need, so the two can never disagree: the subscriber list the
// ue_db expands to, and how many of them each APN pool can actually address.

import type { CoreConfig, PdnEntry, SubscriberRange } from './types';

// ── Identity ─────────────────────────────────────────────────────────────

/** Increment a numeric string, keeping its width: 001010123456001 → …002. */
export function incrementDigits(value: string, offset: number): string {
  const digits = value.replace(/\D/g, '') || '0';
  if (offset === 0) return digits;
  const n = BigInt(digits) + BigInt(offset);
  return n.toString().padStart(digits.length, '0');
}

/** Add an offset to a hex key, keeping its width. */
export function incrementHex(hex: string, offset: number): string {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '') || '0';
  if (offset === 0) return clean.toLowerCase();
  const n = BigInt('0x' + clean) + BigInt(offset);
  return n.toString(16).padStart(clean.length, '0').slice(-clean.length);
}

/** "+917600000000" + 3 → "+917600000003"; keeps any leading '+'. */
export function incrementMsisdn(base: string, offset: number): string {
  const plus = base.trim().startsWith('+');
  const digits = base.replace(/\D/g, '');
  if (!digits) return base;
  return (plus ? '+' : '') + incrementDigits(digits, offset);
}

/** ims.mnc001.mcc001.3gppnetwork.org, the 3GPP form, from the PLMN. */
export function imsDomainFor(mcc: string, mnc: string): string {
  const m = mnc.padStart(3, '0').slice(-3);
  const c = mcc.padStart(3, '0').slice(-3);
  return `ims.mnc${m}.mcc${c}.3gppnetwork.org`;
}

export interface DerivedSubscriber {
  index: number;
  range: SubscriberRange;
  indexInRange: number;
  imsi: string;
  K: string;
  msisdn: string;
  shortNumber: string;
  domain: string;
  impi: string;
  impu: string[];
}

export function expandSubscribers(cfg: CoreConfig, limit = Infinity): DerivedSubscriber[] {
  const out: DerivedSubscriber[] = [];
  const fallbackDomain = imsDomainFor(cfg.network.mcc, cfg.network.mnc);
  let index = 0;
  for (const r of cfg.subscriber.ranges) {
    const count = Math.max(0, Math.floor(r.count));
    for (let i = 0; i < count && out.length < limit; i++) {
      const imsi = incrementDigits(r.startingImsi, i);
      const domain = (r.imsDomain.trim() || fallbackDomain);
      const msisdn = incrementMsisdn(r.msisdnBase, i);
      const shortNumber = r.shortNumberBase.trim() ? incrementDigits(r.shortNumberBase, i) : '';
      out.push({
        index: index + i,
        range: r,
        indexInRange: i,
        imsi,
        K: incrementHex(r.K, i * r.incrementK),
        msisdn,
        shortNumber,
        domain,
        impi: `${imsi}@${domain}`,
        impu: [imsi, ...(msisdn ? [`tel:${msisdn}`, `sip:${msisdn}`] : []), ...(shortNumber ? [`tel:${shortNumber}`] : [])],
      });
    }
    index += count;
  }
  return out;
}

export function totalSubscribers(cfg: CoreConfig): number {
  return cfg.subscriber.ranges.reduce((s, r) => s + Math.max(0, Math.floor(r.count)), 0);
}

// ── Address pools ────────────────────────────────────────────────────────

export function ipv4ToInt(addr: string): number | null {
  const parts = addr.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

export function intToIpv4(n: number): string {
  return [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255].join('.');
}

/**
 * How many UEs an APN pool can address.
 *
 * Amarisoft spaces allocated addresses by 2^ip_addr_shift — the reference
 * config's own comment reads "difference between allocated IP addresses is 4"
 * beside ip_addr_shift: 2. A shift of 0 therefore allocates consecutively.
 */
export function poolCapacity(p: PdnEntry): number | null {
  if (p.pdnType === 'non-ip') return null;
  const first = ipv4ToInt(p.firstIpAddr);
  const last = ipv4ToInt(p.lastIpAddr);
  if (first == null || last == null || last < first) return null;
  const step = Math.pow(2, Math.max(0, p.ipAddrShift));
  return Math.floor((last - first) / step) + 1;
}

/** The default APN is the first entry, as Amarisoft documents it. */
export function defaultPdn(cfg: CoreConfig): PdnEntry | null {
  return cfg.pdn.pdns[0] ?? null;
}

/** APNs whose pool cannot cover every subscriber, worst first. */
export function underCapacityPdns(cfg: CoreConfig): Array<{ pdn: PdnEntry; capacity: number; needed: number }> {
  const needed = totalSubscribers(cfg);
  const out: Array<{ pdn: PdnEntry; capacity: number; needed: number }> = [];
  for (const p of cfg.pdn.pdns) {
    const cap = poolCapacity(p);
    if (cap != null && cap < needed) out.push({ pdn: p, capacity: cap, needed });
  }
  return out.sort((a, b) => a.capacity - b.capacity);
}

export function plmnString(mcc: string, mnc: string): string {
  const c = mcc.padStart(3, '0').slice(-3);
  const m = mnc.length >= 3 ? mnc.padStart(3, '0').slice(-3) : mnc.padStart(2, '0').slice(-2);
  return `${c}${m}`;
}

export function formatPlmn(mcc: string, mnc: string): string {
  return `${mcc.padStart(3, '0').slice(-3)}-${mnc}`;
}

/** Split a comma-separated address field into trimmed entries. */
export function addressList(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(Boolean);
}
