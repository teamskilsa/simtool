// modules/ueSim/testcase/derive.ts
//
// Pure derivations from a UeTestCase that more than one consumer needs:
// the generator (ue.cfg) and the overview (diagram + timeline) must agree
// on which UEs exist, what their identities are and when things happen,
// so that logic lives here once.

import type {
  Bitrate, GroupSelector, SubscriberGroup, TrafficProfile, UeTestCase,
  UserPlaneProfile,
} from './types';

// ── Identity ─────────────────────────────────────────────────────────────

/** "1010123456001" → "001010123456001". Simnovator stores SUPIs as numbers,
 *  which drops the PLMN's leading zeros; a 15-digit IMSI needs them back. */
export function supiToImsi(numericSupi: string | number, offset = 0): string {
  const digits = String(numericSupi).replace(/\D/g, '') || '0';
  const n = BigInt(digits) + BigInt(offset);
  return n.toString().padStart(15, '0');
}

export function plmnOfImsi(imsi: string, mncDigits: 2 | 3): { mcc: string; mnc: string } {
  return { mcc: imsi.slice(0, 3), mnc: imsi.slice(3, 3 + mncDigits) };
}

/** Add `offset` to a hex key, keeping its width. */
export function incrementHex(hex: string, offset: number): string {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '') || '0';
  if (offset === 0) return clean.toLowerCase();
  const n = BigInt('0x' + clean) + BigInt(offset);
  return n.toString(16).padStart(clean.length, '0').slice(-clean.length);
}

/** Simnovator's IMEISV numbering: the 6 digits before the trailing "02"
 *  carry the UE number, e.g. base 4085780000000102 → UE 64 = 4085780000006402. */
export function imeisvFor(base: string, ueNumber: number): string {
  const digits = (base.replace(/\D/g, '') || '4085780000000102').padEnd(16, '0').slice(0, 16);
  return digits.slice(0, 8) + String(ueNumber).padStart(6, '0').slice(-6) + digits.slice(14);
}

export interface DerivedUe {
  /** Global index across every group, in ue_list order (0-based). */
  index: number;
  group: SubscriberGroup;
  indexInGroup: number;
  imsi: string;
  K: string;
}

export function expandUes(tc: UeTestCase): DerivedUe[] {
  const out: DerivedUe[] = [];
  let index = 0;
  for (const g of tc.subscriber.groups) {
    const count = Math.max(0, Math.floor(g.ueCount));
    for (let i = 0; i < count; i++) {
      out.push({
        index,
        group: g,
        indexInGroup: i,
        imsi: supiToImsi(g.startingSupi, i * Math.max(1, g.nextSupi)),
        K: incrementHex(g.sharedKey, i * g.incrementSharedKey),
      });
      index += 1;
    }
  }
  return out;
}

export function totalUes(tc: UeTestCase): number {
  return tc.subscriber.groups.reduce((s, g) => s + Math.max(0, Math.floor(g.ueCount)), 0);
}

// ── Selection ────────────────────────────────────────────────────────────

export function selectorMatches(sel: GroupSelector, groupId: number): boolean {
  return sel === 'all' || sel === groupId;
}

/** The traffic profile that governs a group: the first whose selector
 *  names it, else the first "Apply to All", else null. */
export function trafficFor(tc: UeTestCase, groupId: number): TrafficProfile | null {
  const exact = tc.traffic.profiles.find(p => p.subscriberGroups === groupId);
  if (exact) return exact;
  return tc.traffic.profiles.find(p => p.subscriberGroups === 'all') ?? null;
}

export function userPlanesFor(tc: UeTestCase, groupId: number): UserPlaneProfile[] {
  return tc.userPlane.profiles.filter(
    p => p.dataType !== 'None' && selectorMatches(p.subscriberGroup, groupId),
  );
}

/** Remove a UE group and keep every cross-reference consistent: groups are
 *  renumbered 0..n-1 (that is what the chips show), so selectors above the
 *  removed id shift down, selectors naming only the removed group fall back
 *  to "all", and its mobility row goes away. */
export function removeSubscriberGroup(tc: UeTestCase, idx: number): UeTestCase {
  const removed = tc.subscriber.groups[idx];
  if (!removed || tc.subscriber.groups.length <= 1) return tc;
  const id = removed.id;
  const remap = (sel: GroupSelector): GroupSelector =>
    sel === 'all' || sel === id ? 'all' : sel > id ? sel - 1 : sel;
  return {
    ...tc,
    subscriber: {
      ...tc.subscriber,
      groups: tc.subscriber.groups.filter((_, i) => i !== idx).map((g, i) => ({ ...g, id: i })),
    },
    userPlane: { profiles: tc.userPlane.profiles.map(p => ({ ...p, subscriberGroup: remap(p.subscriberGroup) })) },
    traffic: { profiles: tc.traffic.profiles.map(p => ({ ...p, subscriberGroups: remap(p.subscriberGroups) })) },
    mobility: {
      ...tc.mobility,
      groups: tc.mobility.groups
        .filter(m => m.groupId !== id)
        .map(m => (m.groupId > id ? { ...m, groupId: m.groupId - 1 } : m)),
    },
  };
}

// ── Timing ───────────────────────────────────────────────────────────────

export interface UeSchedule {
  ue: DerivedUe;
  powerOn: number;
  /** null = stays on. */
  powerOff: number | null;
  flows: Array<{ profile: UserPlaneProfile; start: number; end: number }>;
}

/** Attach time of the n-th UE of a group under a traffic profile.
 *  Simnovator spaces UEs evenly at 1/attachRate seconds after attachDelay
 *  (64 UEs at 8/s power on at 0, 0.125, 0.25 …); both attach types compile
 *  to that schedule, the type itself is recorded on the test case. */
export function attachTime(profile: TrafficProfile | null, n: number): number {
  if (!profile) return 0;
  const rate = Math.max(0.001, profile.attachRate);
  const delay = Math.max(0, profile.attachDelay);
  return round3(delay + n / rate);
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** Length of one user-plane session including its loops. */
export function flowLength(p: UserPlaneProfile): number {
  const one = Math.max(0, p.duration);
  if (!p.loop || p.loopCount < 2) return one;
  return one * p.loopCount + Math.max(0, p.loopGap) * (p.loopCount - 1);
}

/** Length of one power cycle sequence including its loops. */
export function cycleLength(tp: TrafficProfile): number | null {
  if (tp.powerOnDuration <= 0) return null;
  if (tp.loopProfile !== 'Enable' || tp.loopCount < 2) return tp.powerOnDuration;
  return tp.powerOnDuration * tp.loopCount + Math.max(0, tp.powerOffDuration) * (tp.loopCount - 1);
}

export function scheduleFor(tc: UeTestCase): UeSchedule[] {
  return expandUes(tc).map(ue => {
    const tp = trafficFor(tc, ue.group.id);
    const on = attachTime(tp, ue.indexInGroup);
    const len = tp ? cycleLength(tp) : null;
    const off = len == null ? null : on + len;
    const flows = userPlanesFor(tc, ue.group.id).map(profile => {
      const start = on + Math.max(0, profile.startDelay);
      return { profile, start, end: start + flowLength(profile) };
    });
    return { ue, powerOn: on, powerOff: off, flows };
  });
}

/** Wall-clock length of the whole test in seconds. */
export function testLength(tc: UeTestCase): number {
  let end = 0;
  for (const s of scheduleFor(tc)) {
    if (s.powerOff != null) end = Math.max(end, s.powerOff);
    for (const f of s.flows) end = Math.max(end, f.end);
    end = Math.max(end, s.powerOn);
  }
  return end;
}

// ── Bitrates ─────────────────────────────────────────────────────────────

export function bitrateToBps(b: Bitrate): number {
  const mult = b.unit === 'Gbps' ? 1e9 : b.unit === 'Mbps' ? 1e6 : 1e3;
  return b.value * mult;
}

/** Mbps as a number, the unit Simnovator's iperf profile carries. */
export function bitrateToMbps(b: Bitrate): number {
  return Math.round((bitrateToBps(b) / 1e6) * 1000) / 1000;
}

/** iperf-style suffix: 150 Mbps → "150M". */
export function bitrateToIperf(b: Bitrate): string {
  const suffix = b.unit === 'Gbps' ? 'G' : b.unit === 'Mbps' ? 'M' : 'K';
  return `${b.value}${suffix}`;
}

export function formatBitrate(b: Bitrate): string {
  return `${b.value} ${b.unit}`;
}

/** Aggregate offered load across all UEs in a direction, in Mbps. */
export function aggregateMbps(tc: UeTestCase, dir: 'DL' | 'UL'): number {
  let bps = 0;
  for (const g of tc.subscriber.groups) {
    for (const p of userPlanesFor(tc, g.id)) {
      if (p.dataType !== 'IPERF') continue;
      const wants = p.fileTransferAction === 'Both' || p.fileTransferAction === dir;
      if (!wants) continue;
      bps += bitrateToBps(dir === 'DL' ? p.dlBitrate : p.ulBitrate) * Math.max(0, g.ueCount);
    }
  }
  return bps / 1e6;
}

export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}
