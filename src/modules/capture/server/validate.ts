// Input validation for the Capture feature. Every value that reaches a shell
// command on the callbox, a remote API message or a path on the SimTool host
// goes through one of these first.
import * as crypto from 'crypto';

export const isIPv4 = (s: unknown): s is string =>
  typeof s === 'string' &&
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(s);

export const isPort = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 65535;

export const toPort = (v: unknown, dflt: number): number => {
  if (v === undefined || v === null || v === '') return dflt;
  const n = Number(v);
  if (!isPort(n)) throw new Error(`Invalid port: ${String(v).slice(0, 20)}`);
  return n;
};

export const clampInt = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

/** Capture ids: 12 lowercase hex characters, generated server side. */
export const newCaptureId = () => crypto.randomBytes(6).toString('hex');
export const isCaptureId = (s: unknown): s is string => typeof s === 'string' && /^[a-f0-9]{12}$/.test(s);

/** Files SimTool creates on the box. Cleanup only ever touches paths that
 *  match these — never a path taken verbatim from a request or a response. */
export const boxIqPattern = (id: string) => new RegExp(`^/tmp/simtool-iq-${id}-(rx|tx)-\\d{1,3}\\.bin$`);
export const boxPcapPath = (id: string) => `/tmp/simtool-pcap-${id}.pcap`;
/** Name the user is told to give a console `pcap -w` capture. */
export const isConsolePcapPath = (s: unknown): s is string =>
  typeof s === 'string' && /^\/tmp\/simtool-enbpcap-[a-f0-9]{12}\.pcap$/.test(s);

/** Local file names inside data/captures/<id>/. No separators, no dot-files. */
export const isLocalFileName = (s: unknown): s is string =>
  typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(s) && !s.includes('..');

/** Network interface for tcpdump. */
export const isIfName = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9._-]{1,15}$/.test(s);

/** Free-text labels stored in manifests; never used in a shell. */
export const cleanLabel = (s: unknown, max = 80) =>
  typeof s === 'string' ? s.replace(/[\x00-\x1f]/g, '').slice(0, max) : '';

export interface SshCreds { host: string; port?: number; username?: string; password?: string; privateKey?: string }

export const hasSshLogin = (c: Partial<SshCreds> | undefined | null) =>
  !!c?.username && !!(c.password || c.privateKey);

/** Normalises creds from a request. Throws if the host is not an IPv4. */
export function parseCreds(raw: any): SshCreds {
  if (!isIPv4(raw?.host)) throw new Error('System IP must be an IPv4 address');
  return {
    host: raw.host,
    port: toPort(raw.port, 22),
    username: typeof raw.username === 'string' ? raw.username : undefined,
    password: typeof raw.password === 'string' ? raw.password : undefined,
    privateKey: typeof raw.privateKey === 'string' ? raw.privateKey : undefined,
  };
}

/** Single-quote for a POSIX shell. Only used on values already validated. */
export const shq = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
