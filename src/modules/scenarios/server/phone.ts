// Phone actions over adb for Mobility Scenarios. Commands proven on a
// OnePlus NE2215 (Android): airplane mode via `cmd connectivity`, ping,
// dumpsys telephony.registry for CellInfoLte, RadioInfo to refresh it,
// KEYCODE_WAKEUP to keep the screen (and modem) awake.
import { spawn, type ChildProcess } from 'child_process';
import { adb, isIPv4, isSerial } from '@/modules/traffic/server/traffic.server';

export interface PingStats { sent: number; received: number; lossPct: number; maxGapMs: number; rttAvgMs?: number }

export async function phoneState(serial: string): Promise<string | null> {
  if (!isSerial(serial)) return null;
  try {
    const { stdout } = await adb(['devices']);
    const row = stdout.split('\n').map(l => l.trim().split(/\s+/)).find(([s]) => s === serial);
    return row?.[1] ?? null;
  } catch { return null; }
}

const shell = (serial: string, cmd: string, timeoutMs = 10000) => adb(['-s', serial, 'shell', cmd], timeoutMs);

export async function airplane(serial: string, enable: boolean) {
  await shell(serial, `cmd connectivity airplane-mode ${enable ? 'enable' : 'disable'}`);
}

export async function wake(serial: string) {
  await shell(serial, 'input keyevent KEYCODE_WAKEUP');
}

export async function radioInfo(serial: string) {
  await shell(serial, 'am start -n com.android.phone/.settings.RadioInfo');
}

/** Parse ping output: per-reply icmp_seq and time → loss and the longest gap. */
export function parsePing(out: string, intervalMs: number): PingStats {
  const seqs: number[] = [];
  const rtts: number[] = [];
  for (const m of out.matchAll(/icmp_seq=(\d+).*?time=([\d.]+)/g)) { seqs.push(Number(m[1])); rtts.push(Number(m[2])); }
  const tx = out.match(/(\d+) packets transmitted, (\d+) received/);
  const sent = tx ? Number(tx[1]) : (seqs.length ? Math.max(...seqs) : 0);
  const received = tx ? Number(tx[2]) : seqs.length;
  let maxGap = 0;
  const sorted = [...seqs].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) maxGap = Math.max(maxGap, (sorted[i] - sorted[i - 1] - 1) * intervalMs);
  return {
    sent, received,
    lossPct: sent > 0 ? Math.round(1000 * (sent - received) / sent) / 10 : 0,
    maxGapMs: maxGap,
    rttAvgMs: rtts.length ? Math.round(10 * rtts.reduce((a, b) => a + b, 0) / rtts.length) / 10 : undefined,
  };
}

export async function ping(serial: string, host: string, count: number, intervalMs: number): Promise<PingStats> {
  if (!isIPv4(host)) throw new Error('ping host must be IPv4');
  const n = Math.max(1, Math.min(1000, Math.round(count)));
  const i = Math.max(0.2, intervalMs / 1000).toFixed(1);
  const { stdout } = await shell(serial, `ping -c ${n} -i ${i} -W 2 ${host}`, n * Math.max(1000, intervalMs) + 15000)
    .catch((e: any) => ({ stdout: String(e?.stdout ?? '') }));
  return parsePing(stdout, Math.max(200, intervalMs));
}

export class BackgroundPing {
  private child: ChildProcess | null = null;
  private out = '';
  constructor(private serial: string, private host: string, private intervalMs: number) {}

  start() {
    if (!isIPv4(this.host)) throw new Error('ping host must be IPv4');
    const i = Math.max(0.2, this.intervalMs / 1000).toFixed(1);
    this.child = spawn('adb', ['-s', this.serial, 'shell', `ping -i ${i} ${this.host}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    this.child.stdout?.on('data', b => { this.out += b.toString(); if (this.out.length > 2_000_000) this.out = this.out.slice(-1_000_000); });
    this.child.on('error', () => { /* reported through stats */ });
  }

  async stop(): Promise<PingStats> {
    this.child?.kill('SIGINT');
    await shell(this.serial, `pkill -INT -f "ping -i"`).catch(() => {});
    await new Promise(r => setTimeout(r, 300));
    this.child = null;
    return parsePing(this.out, Math.max(200, this.intervalMs));
  }

  get running() { return !!this.child; }
}

export interface PhoneCell { registered: boolean; pci?: number; earfcn?: number; rsrp?: number; rsrq?: number }

/** Registered LTE cell from `dumpsys telephony.registry` (best effort; formats vary by vendor). */
export async function cellInfo(serial: string): Promise<{ serving: PhoneCell | null; cells: PhoneCell[] }> {
  const { stdout } = await shell(serial, 'dumpsys telephony.registry', 15000);
  const cells: PhoneCell[] = [];
  for (const m of stdout.matchAll(/CellInfoLte:\{([^\n]*)/g)) {
    const s = m[1];
    const num = (re: RegExp) => { const x = s.match(re); return x ? Number(x[1]) : undefined; };
    cells.push({
      registered: /mRegistered=YES/.test(s),
      pci: num(/mPci=(\d+)/),
      earfcn: num(/mEarfcn=(\d+)/),
      rsrp: num(/rsrp=(-?\d+)/),
      rsrq: num(/rsrq=(-?\d+)/),
    });
  }
  // The registry prints the list once per subscription; de-duplicate.
  const seen = new Set<string>();
  const uniq = cells.filter(c => { const k = JSON.stringify(c); if (seen.has(k)) return false; seen.add(k); return true; });
  return { serving: uniq.find(c => c.registered) ?? null, cells: uniq };
}
