// Turn raw file probes from a target system into a SystemState: what Amarisoft
// release/components run there now, which TRX, MIMO, autostart, NAT, IPv6,
// licenses, and what install.sh will do with the active configs.
//
// Pure — no I/O. The server side (server/systemState.server.ts) collects the
// probes over SSH or via the SimTool agent's read route and calls in here, so
// both transports produce the same result.
import type {
  ActiveConfigState, SystemComponentState, SystemLicenseFile, SystemState,
  SystemStateEvidence, SystemStateSource, SystemStateWarning, TargetArch,
} from '../types/detection';
import { trxIdForRfDriver } from '../types/detection';

export type ProbeKind = 'file' | 'dir' | 'dev' | 'missing' | 'unknown';

export interface Probe {
  kind: ProbeKind;
  content?: string;
  /** true/false when lstat was possible (SSH); undefined otherwise. */
  isLink?: boolean;
}

/** Stat info from the agent's config list route (follows symlinks). */
export interface ListedConfig {
  name: string;
  size: number;
  modifiedAt: string;
  createdAt?: string;
}

export interface ProbeSet {
  via: SystemStateSource;
  files: Record<string, Probe>;
  /** Extra facts only a shell can give (SSH): lte_enabled, sdr_devs, usb_ettus, uname_m. */
  extras?: Record<string, string>;
  /** dir → listing, used to infer symlinks when lstat is unavailable. */
  listings?: Record<string, ListedConfig[]>;
  error?: string;
}

// ── Paths ──────────────────────────────────────────────────────────────────

/** Component id → install dir link name under the install dir (IDIR). */
export const COMPONENT_DIRS: Record<string, string> = {
  enb: 'enb', mme: 'mme', ue: 'ue', mbmsgw: 'mbms', view: 'view', ots: 'ots',
  license: 'license', sat: 'sat', n3iwf: 'n3iwf', probe: 'probe', scan: 'scan', monitor: 'monitor',
};

/** ots.cfg <COMP>_TYPE → component id. */
const OTS_TYPE_TO_ID: Record<string, string> = {
  MME: 'mme', IMS: 'ims', ENB: 'enb', UE: 'ue', MBMSGW: 'mbmsgw', SIMSERVER: 'simserver',
  LICENSE: 'license', N3IWF: 'n3iwf', PROBE: 'probe', SCAN: 'scan', SAT: 'sat', MONITOR: 'monitor',
};

const LICENSE_PRODUCTS = ['lteenb', 'ltemme', 'lteue', 'ltembmsgw', 'lteview', 'ltesat', 'ltelicense', 'lten3iwf', 'lteprobe', 'ltescan'];

export const UHD_HINT_PATHS = [
  '/usr/bin/uhd_find_devices', '/usr/local/bin/uhd_find_devices',
  '/usr/share/uhd', '/usr/local/share/uhd',
];

/** Phase 1: fixed paths. `idir` is the Amarisoft install dir (default /root). */
export function phase1Paths(idir: string, home = '/root'): { text: string[]; exist: string[] } {
  const text = [
    `${home}/.lte-install`,
    `${idir}/ots/config/ots.cfg`,
    `${idir}/ots/config/ots.default.cfg`,
    `${idir}/enb/config/enb.default.cfg`,
    `${idir}/enb/config/rf_driver/config.cfg`,
    `${idir}/mme/config/mme.default.cfg`,
    `${idir}/mme/config/ims.default.cfg`,
    `${idir}/mbms/config/mbmsgw.cfg`,
    `${idir}/ue/config/ue.default.cfg`,
    `${idir}/view/config/view.default.cfg`,
    '/var/www/html/lte/index.html',
    '/etc/.amarisoft-product/hostname',
    '/etc/.amarisoft-product/host-id',
    '/proc/sys/kernel/arch',
    '/proc/bus/pci/devices',
    ...LICENSE_PRODUCTS.map(p => `${home}/.amarisoft/${p}.key`),
  ];
  const exist = [
    ...Object.values(COMPONENT_DIRS).map(d => `${idir}/${d}`),
    '/var/www/html/lte',
    `${home}/.amarisoft`,
    '/etc/systemd/system/multi-user.target.wants/lte.service',
    '/lib/systemd/system/lte.service',
    '/usr/lib/systemd/system/lte.service',
    '/sys/bus/pci/drivers/sdr',
    ...UHD_HINT_PATHS,
  ];
  return { text, exist };
}

// ── Small parsers ──────────────────────────────────────────────────────────

const DATE_RE = /(\d{4}-\d{2}-\d{2})/;

function stripCfgComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"])\/\/[^\n]*/g, '$1');
}

export interface OtsComponent {
  name: string;        // MME, ENB, IMS, MBMSGW, ENB2 …
  id?: string;         // mapped component id
  type?: string;
  path?: string;
  configFile?: string;
  autostart?: boolean;
  init?: string;
}

export function parseOtsCfg(content: string): { components: OtsComponent[]; wwwPath?: string } {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const names: string[] = [];
  const vars: Record<string, string> = {};
  for (const l of lines) {
    const add = l.match(/^COMPONENTS\+?=\s*"([^"]*)"/);
    if (add) {
      if (!l.includes('+=')) names.length = 0;
      for (const n of add[1].split(/\s+/).filter(Boolean)) if (!names.includes(n)) names.push(n);
      continue;
    }
    const kv = l.match(/^([A-Z0-9_]+)="([^"]*)"/);
    if (kv) vars[kv[1]] = kv[2];
  }
  const components = names.map(name => {
    const type = vars[`${name}_TYPE`] || name.replace(/\d+$/, '');
    const autostartRaw = vars[`${name}_AUTOSTART`];
    return {
      name,
      type,
      id: OTS_TYPE_TO_ID[type],
      path: vars[`${name}_PATH`],
      configFile: vars[`${name}_CONFIG_FILE`],
      autostart: autostartRaw === undefined ? true : autostartRaw === 'y',
      init: vars[`${name}_INIT`],
    };
  });
  return { components, wwwPath: vars.WWW_PATH };
}

export function parseRfDriverName(cfg: string): string | undefined {
  const s = stripCfgComments(cfg);
  const m = s.match(/rf_driver\s*:\s*\{[\s\S]*?name\s*:\s*"([\w-]+)"/);
  return m?.[1];
}

export function parseAntennas(cfg: string): { dl?: number; ul?: number } {
  const s = stripCfgComments(cfg);
  const resolve = (tok: string): number | undefined => {
    if (/^\d+$/.test(tok)) return Number(tok);
    const d = s.match(new RegExp(`#define\\s+${tok}\\s+(\\d+)`));
    return d ? Number(d[1]) : undefined;
  };
  const maxOf = (key: string) => {
    let best: number | undefined;
    for (const m of s.matchAll(new RegExp(`${key}\\s*:\\s*(\\w+)`, 'g'))) {
      const v = resolve(m[1]);
      if (v !== undefined && (best === undefined || v > best)) best = v;
    }
    return best;
  };
  return { dl: maxOf('n_antenna_dl'), ul: maxOf('n_antenna_ul') };
}

export function parseLicense(path: string, content: string): SystemLicenseFile {
  // Keys have a binary header, so the first field may not start a line.
  // Try a clean field boundary first, then anywhere (the header byte before
  // the first field can be a letter).
  const get = (k: string) => (content.match(new RegExp(`(?<![A-Za-z_])${k}=([^\\n\\x00]*)`))
    ?? content.match(new RegExp(`${k}=([^\\n\\x00]*)`)))?.[1]?.trim();
  return {
    path,
    productId: get('product_id'),
    productIds: get('product_ids'),
    licenseUid: get('license_uid'),
    hostId: get('host_id'),
    maxVersion: get('version')?.match(DATE_RE)?.[1],
  };
}

/** Count PCI functions of Amarisoft SDR boards: driver column `sdr` or id 10ee:7024. */
export function countSdrPci(devices: string): number {
  let n = 0;
  for (const line of devices.split('\n')) {
    const cols = line.split('\t');
    if (cols.length < 2) continue;
    const id = (cols[1] || '').trim().toLowerCase();
    const driver = (cols[cols.length - 1] || '').trim();
    if (driver === 'sdr' || id === '10ee7024') n++;
  }
  return n;
}

// ── Main builder ───────────────────────────────────────────────────────────

const exists = (p?: Probe) => !!p && (p.kind === 'file' || p.kind === 'dir' || p.kind === 'dev');
const known = (p?: Probe) => !!p && p.kind !== 'unknown';

/**
 * Phase 2 paths, derived from phase 1: the configs the LTE service really
 * loads (from ots.cfg), and — over SSH — license files found by listing.
 */
export function phase2Paths(files: Record<string, Probe>, idir: string, home = '/root', extras?: Record<string, string>): string[] {
  const ots = files[`${idir}/ots/config/ots.cfg`]?.content;
  const out = new Set<string>();
  if (ots) {
    for (const c of parseOtsCfg(ots).components) {
      if (!c.configFile) continue;
      const base = c.path || (c.id && COMPONENT_DIRS[c.id] ? `${idir}/${COMPONENT_DIRS[c.id]}` : undefined);
      if (!base) continue;
      out.add(c.configFile.startsWith('/') ? c.configFile : `${base}/${c.configFile}`);
    }
  } else {
    out.add(`${idir}/enb/config/enb.cfg`);
    out.add(`${idir}/mme/config/mme.cfg`);
  }
  for (const f of (extras?.license_files || '').split(/\s+/).filter(Boolean)) {
    out.add(`${home}/.amarisoft/${f}`);
  }
  return Array.from(out);
}

export function buildSystemState(input: ProbeSet, opts: { idir: string; home?: string; packageVersion?: string }): SystemState {
  const { files, extras = {}, via } = input;
  const idir = opts.idir;
  const home = opts.home ?? '/root';
  const evidence: SystemStateEvidence[] = [];
  const warnings: SystemStateWarning[] = [];
  const f = (p: string) => files[p];
  const ev = (key: string, source: string, detail: string, inferred = false) =>
    evidence.push({ key, source, detail: detail.slice(0, 300), ...(inferred ? { inferred } : {}) });

  const anyKnown = Object.values(files).some(known);
  if (!anyKnown) {
    return {
      ok: false, via, error: input.error || 'Target system not reachable (no SSH and no SimTool agent response)',
      arch: 'unknown', installDir: idir, components: [], sdrBoards: 0, uhdPresent: null,
      autostart: null, nat: null, ipv6: null, ipv6Nat: null, licenses: [], activeConfigs: [], warnings: [], evidence: [],
    };
  }

  // Identity / arch
  const hostname = f('/etc/.amarisoft-product/hostname')?.content?.trim() || undefined;
  const hostId = f('/etc/.amarisoft-product/host-id')?.content?.trim() || undefined;
  if (hostname) ev('hostname', '/etc/.amarisoft-product/hostname', hostname);
  const machine = (extras.uname_m || f('/proc/sys/kernel/arch')?.content || '').trim();
  const arch: TargetArch = /x86_64|amd64/.test(machine) ? 'linux' : /aarch64|arm64/.test(machine) ? 'aarch64' : 'unknown';
  if (machine) ev('arch', extras.uname_m ? 'uname -m' : '/proc/sys/kernel/arch', machine);

  // Service config
  const otsPath = `${idir}/ots/config/ots.cfg`;
  const otsContent = f(otsPath)?.content;
  const ots = otsContent ? parseOtsCfg(otsContent) : { components: [] as OtsComponent[] };
  if (otsContent) {
    ev('service-components', otsPath, `COMPONENTS: ${ots.components.map(c => `${c.name}${c.autostart === false ? '(no autostart)' : ''}`).join(' ') || '(none)'}`);
  }

  // Versions
  const versionSources: Array<[string, string]> = [
    ['ots', `${idir}/ots/config/ots.default.cfg`],
    ['enb', `${idir}/enb/config/enb.default.cfg`],
    ['mme', `${idir}/mme/config/mme.default.cfg`],
    ['mbmsgw', `${idir}/mbms/config/mbmsgw.cfg`],
    ['ue', `${idir}/ue/config/ue.default.cfg`],
    ['view', `${idir}/view/config/view.default.cfg`],
    ['www', '/var/www/html/lte/index.html'],
  ];
  const compVersion: Record<string, string> = {};
  for (const [id, p] of versionSources) {
    const head = f(p)?.content?.slice(0, 400);
    const v = head?.match(DATE_RE)?.[1];
    if (v) compVersion[id] = v;
  }
  const counts = new Map<string, number>();
  for (const v of Object.values(compVersion)) counts.set(v, (counts.get(v) ?? 0) + 1);
  const installedVersion = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0];
  if (installedVersion) {
    ev('version', Object.entries(compVersion).map(([id]) => versionSources.find(s => s[0] === id)![1]).join(', '),
      Object.entries(compVersion).map(([id, v]) => `${id}=${v}`).join(' '));
  }

  // Components
  const activeById = new Map<string, OtsComponent>();
  for (const c of ots.components) if (c.id && !activeById.has(c.id)) activeById.set(c.id, c);
  const dirProbe = (id: string) => f(`${idir}/${COMPONENT_DIRS[id]}`);
  const installedOf = (id: string): boolean | null => {
    if (id === 'ims') {
      const p = f(`${idir}/mme/config/ims.default.cfg`);
      if (activeById.has('ims') || exists(p)) return true;
      return known(p) ? false : null;
    }
    if (id === 'simserver') return activeById.has('simserver') ? true : (otsContent ? false : null);
    if (id === 'www') {
      const p = f('/var/www/html/lte');
      return known(p) ? exists(p) : null;
    }
    const p = dirProbe(id);
    if (!p) return null;
    return known(p) ? exists(p) : null;
  };
  const ids = ['enb', 'mme', 'ims', 'simserver', 'ue', 'mbmsgw', 'n3iwf', 'sat', 'probe', 'scan', 'monitor', 'ots', 'view', 'www', 'license'];
  const components: SystemComponentState[] = ids.map(id => {
    const act = activeById.get(id);
    const installed = installedOf(id);
    return {
      id,
      installed,
      active: id === 'ots' ? ots.components.length > 0 : id === 'www' || id === 'view' ? !!installed : !!act,
      ...(act ? { autostart: act.autostart } : {}),
      ...(installed && compVersion[id === 'ims' || id === 'simserver' ? 'mme' : id] ? { version: compVersion[id === 'ims' || id === 'simserver' ? 'mme' : id] } : {}),
    };
  });
  ev('installed-dirs', `${idir}/{${Object.values(COMPONENT_DIRS).join(',')}}`,
    components.filter(c => c.installed).map(c => c.id).join(' ') || '(none)');

  // Active configs & TRX / antennas
  const activeConfigs: ActiveConfigState[] = [];
  const cfgPathFor = (c: OtsComponent) => {
    const base = c.path || (c.id && COMPONENT_DIRS[c.id] ? `${idir}/${COMPONENT_DIRS[c.id]}` : undefined);
    if (!c.configFile || !base) return undefined;
    return c.configFile.startsWith('/') ? c.configFile : `${base}/${c.configFile}`;
  };
  const enbOts = ots.components.find(c => c.id === 'enb');
  const enbCfgPath = (enbOts && cfgPathFor(enbOts)) || `${idir}/enb/config/enb.cfg`;
  const enbCfg = f(enbCfgPath)?.content;
  let rfDriver: string | undefined;
  let nAntennaDl: number | undefined;
  let nAntennaUl: number | undefined;
  if (enbCfg) {
    rfDriver = parseRfDriverName(enbCfg);
    let rfSource = enbCfgPath;
    if (!rfDriver && /include\s+"rf_driver\/config\.cfg"/.test(enbCfg)) {
      const inc = f(`${idir}/enb/config/rf_driver/config.cfg`)?.content;
      if (inc) { rfDriver = parseRfDriverName(inc); rfSource = `${idir}/enb/config/rf_driver/config.cfg`; }
    }
    const args = stripCfgComments(enbCfg).match(/rf_driver\s*:\s*\{[\s\S]*?args\s*:\s*"([^"]*)"/)?.[1];
    if (rfDriver) ev('trx', rfSource, `rf_driver.name: "${rfDriver}"${args ? `, args: "${args.slice(0, 120)}${args.length > 120 ? '…' : ''}"` : ''}`);
    const ant = parseAntennas(enbCfg);
    nAntennaDl = ant.dl; nAntennaUl = ant.ul;
    if (ant.dl || ant.ul) ev('mimo', enbCfgPath, `n_antenna_dl: ${ant.dl ?? '?'}, n_antenna_ul: ${ant.ul ?? '?'}`);
  }

  // Hardware
  const pci = f('/proc/bus/pci/devices')?.content;
  let sdrBoards = pci ? countSdrPci(pci) : 0;
  if (pci) ev('sdr-hw', '/proc/bus/pci/devices', `${sdrBoards} PCI function(s) with driver "sdr" / id 10ee:7024`);
  if (extras.sdr_devs !== undefined) {
    const n = Number(extras.sdr_devs) || 0;
    ev('sdr-hw', 'ls /dev/sdr*', `${n} /dev/sdr* device node(s)`);
    sdrBoards = Math.max(sdrBoards, n);
  }
  if (exists(f('/sys/bus/pci/drivers/sdr'))) ev('sdr-hw', '/sys/bus/pci/drivers/sdr', 'sdr kernel driver loaded');

  const uhdHits = UHD_HINT_PATHS.filter(p => exists(f(p)));
  const usbEttus = Number(extras.usb_ettus || 0);
  const uhdKnown = UHD_HINT_PATHS.some(p => known(f(p)));
  const uhdPresent: boolean | null = uhdHits.length > 0 || usbEttus > 0 ? true : uhdKnown ? false : null;
  ev('uhd', UHD_HINT_PATHS.join(', ') + (extras.usb_ettus !== undefined ? ', USB vendor 2500' : ''),
    uhdPresent ? `found: ${[...uhdHits, ...(usbEttus ? [`${usbEttus} Ettus USB device(s)`] : [])].join(', ')}` : uhdPresent === false ? 'no UHD tools, data dir or Ettus USB device found' : 'could not check');

  let recommendedTrx = trxIdForRfDriver(rfDriver);
  if (!recommendedTrx && sdrBoards > 0) recommendedTrx = 'sdr';
  if (rfDriver === 'sdr' && uhdPresent) {
    warnings.push({ level: 'info', text: 'UHD software is present but the eNB uses the SDR driver.' });
  }

  const mimo = nAntennaDl !== undefined ? nAntennaDl >= 2 : undefined;

  // Autostart
  let autostart: boolean | null = null;
  if (extras.lte_enabled) {
    autostart = extras.lte_enabled.trim() === 'enabled';
    ev('autostart', 'systemctl is-enabled lte', extras.lte_enabled.trim());
  } else {
    const wants = f('/etc/systemd/system/multi-user.target.wants/lte.service');
    const unit = [f('/lib/systemd/system/lte.service'), f('/usr/lib/systemd/system/lte.service')];
    if (exists(wants)) {
      autostart = true;
      ev('autostart', '/etc/systemd/system/multi-user.target.wants/lte.service', 'present → lte.service enabled');
    } else if (known(wants) && unit.some(exists)) {
      autostart = false;
      ev('autostart', '/etc/systemd/system/multi-user.target.wants/lte.service', 'absent (unit installed) → lte.service disabled');
    }
  }

  // NAT / IPv6 — install.sh writes them into MME_INIT (--no-nat, -6, --no-nat6)
  let nat: boolean | null = null, ipv6: boolean | null = null, ipv6Nat: boolean | null = null;
  const mmeOts = ots.components.find(c => c.id === 'mme');
  if (mmeOts) {
    const init = mmeOts.init ?? '';
    nat = !/--no-nat(\s|$)/.test(init);
    ipv6 = /(^|\s)-6(\s|$)/.test(init);
    ipv6Nat = ipv6 ? !/--no-nat6/.test(init) : null;
    ev('nat-ipv6', otsPath, `${mmeOts.name}_INIT="${init}" → NAT ${nat ? 'on' : 'off'}, IPv6 ${ipv6 ? 'on' : 'off'}${ipv6 ? `, IPv6 NAT ${ipv6Nat ? 'on' : 'off'}` : ''}`);
  }

  // Licenses
  const licenses: SystemLicenseFile[] = [];
  for (const [p, probe] of Object.entries(files)) {
    if (!p.startsWith(`${home}/.amarisoft/`) || !probe.content) continue;
    licenses.push(parseLicense(p, probe.content));
  }
  const licenseDirProbe = f(`${home}/.amarisoft`);
  const licenseDir = exists(licenseDirProbe) ? `${home}/.amarisoft/` : undefined;
  if (licenses.length) {
    ev('licenses', licenseDir || `${home}/.amarisoft/`, licenses.map(l =>
      `${l.path.split('/').pop()}: ${l.productIds || l.productId} uid=${l.licenseUid ?? '?'} host_id=${l.hostId ?? '?'} version≤${l.maxVersion ?? '?'}`).join(' | '));
  } else if (licenseDir) {
    ev('licenses', licenseDir, via === 'agent' ? 'directory exists; no file matched the guessed names (agent cannot list it)' : 'no license files found', via === 'agent');
  }
  if (opts.packageVersion) {
    for (const l of licenses) {
      if (l.maxVersion && l.maxVersion < opts.packageVersion) {
        warnings.push({ level: 'danger', text: `${l.path.split('/').pop()} (${l.productIds || l.productId}) only allows releases up to ${l.maxVersion}; ${opts.packageVersion} will not start with it.` });
      }
    }
  }

  // Active configs vs install.sh MigrateConfig:
  //  - default link names (enb.cfg, mme.cfg, ims.cfg, ue.cfg, ots.cfg) that are a
  //    SYMLINK are carried over; a REGULAR FILE is only imported as <name>.bak and
  //    the release's *.default.cfg becomes active.
  //  - other file names that don't exist in the new release are copied.
  //  - stock files (listed in config/.md5) that were edited are imported as .bak.
  const DEFAULT_LINKS = new Set(['enb.cfg', 'mme.cfg', 'ims.cfg', 'ue.cfg', 'ots.cfg', 'view.cfg', 'license.cfg', 'n3iwf.cfg', 'probe.cfg', 'scan.cfg', 'monitor.cfg', 'sat-mc.cfg']);
  const cfgEntries: Array<{ component: string; path: string }> = ots.components
    .map(c => ({ component: c.name, path: cfgPathFor(c) }))
    .filter((x): x is { component: string; path: string } => !!x.path);
  if (otsContent) cfgEntries.push({ component: 'OTS', path: otsPath });
  const seen = new Set<string>();
  for (const { component, path } of cfgEntries) {
    if (seen.has(path)) continue;
    seen.add(path);
    const base = path.split('/').pop()!;
    const dir = path.slice(0, path.length - base.length - 1);
    const probe = f(path);
    let isSymlink: boolean | null = probe?.isLink ?? null;
    let inferred = false;
    if (isSymlink === null) {
      const listing = input.listings?.[dir];
      const self = listing?.find(e => e.name === base);
      if (self) {
        // stat() follows links: a symlink shows up with the exact size and
        // timestamps of its target, which is listed too.
        const twin = listing!.find(e => e.name !== base && e.size === self.size && e.modifiedAt === self.modifiedAt
          && (!self.createdAt || !e.createdAt || e.createdAt === self.createdAt));
        isSymlink = !!twin;
        inferred = true;
      }
    }
    const isDefaultLinkName = DEFAULT_LINKS.has(base);
    // install.sh never calls MigrateConfig for the MBMS gateway.
    const migration: ActiveConfigState['migration'] = component.replace(/\d+$/, '') === 'MBMSGW' ? 'not-migrated'
      : !isDefaultLinkName ? 'kept'
      : isSymlink === null ? 'unknown' : isSymlink ? 'kept' : 'backup-only';
    activeConfigs.push({ component, path, isSymlink, ...(inferred ? { symlinkInferred: true } : {}), migration });
    ev('config', path, `${component}: ${isSymlink === null ? 'symlink state unknown' : isSymlink ? 'symlink' : 'regular file'} → ${migration}`, inferred);
  }
  const backups = activeConfigs.filter(c => c.migration === 'backup-only' && c.component !== 'OTS');
  if (backups.length) {
    warnings.push({
      level: 'danger',
      text: `Active config ${backups.map(b => b.path).join(', ')} ${backups.length > 1 ? 'are regular files' : 'is a regular file'}${backups.some(b => b.symlinkInferred) ? ' (inferred)' : ''}: install.sh only imports ${backups.length > 1 ? 'them' : 'it'} as *.bak and the new release's default config becomes active. Save a copy and restore it after the install.`,
    });
  }
  if (otsContent) {
    warnings.push({ level: 'info', text: 'The LTE service config (ots.cfg) is regenerated from the components you select: anything left unchecked stops being started by the service.' });
  }
  const notMigrated = activeConfigs.filter(c => c.migration === 'not-migrated');
  if (notMigrated.length) {
    warnings.push({ level: 'warn', text: `install.sh does not migrate ${notMigrated.map(c => c.path).join(', ')}: the new release's stock file is used. Re-apply any changes after the install.` });
  }
  const unknownCfg = activeConfigs.filter(c => c.migration === 'unknown' && c.component !== 'OTS');
  if (unknownCfg.length) {
    warnings.push({ level: 'warn', text: `Could not tell whether ${unknownCfg.map(c => c.path).join(', ')} ${unknownCfg.length > 1 ? 'are symlinks' : 'is a symlink'}; if not, install.sh keeps only a .bak copy.` });
  }

  return {
    ok: true, via, hostname, hostId, arch, installDir: idir, installedVersion, components,
    rfDriver, sdrBoards, uhdPresent, recommendedTrx, nAntennaDl, nAntennaUl, mimo,
    autostart, nat, ipv6, ipv6Nat, licenseDir, licenses, activeConfigs, warnings, evidence,
  };
}
