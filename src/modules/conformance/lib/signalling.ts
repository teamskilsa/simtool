// Message matchers for Amarisoft RRC / NAS log entries, per RAT.
//
// A log_get entry's first line is "<channel>: <message>" for RRC (e.g.
// "DCCH-NR: RRC reconfiguration complete", "CCCH: RRC connection request") and
// "<protocol>: <message>" for NAS in the core log (e.g. "5GMM: Registration
// request", "EMM: Attach request"). The regexes accept spaces, '_' / '-' or
// camelCase between words ("rrcReconfigurationComplete"), and a message never
// matches its own "…complete" / "…request" relatives.
import type { LogSeqItem } from '@/modules/scenarios/types';
import type { Rat } from '../types';

const SEP = '[\\s_-]*';
const w = (...words: string[]) => words.join(SEP);
const not = (...tails: string[]) => `(?!${SEP}(?:${tails.join('|')}))`;

export interface RrcNames {
  setupReq: string; setup: string; setupCpl: string;
  reconf: string; reconfCpl: string; release: string;
  reestReq: string; reest: string; reestCpl: string;
  measReport: string; paging: string; smc: string;
  /** What marks a handover inside the reconfiguration's decoded body. */
  mobility: string;
  scellAdd: string; scellRelease: string;
}

export const RRC: Record<Rat, RrcNames> = {
  nr: {
    setupReq: w('rrc', 'setup', 'request'),
    setup: `${w('rrc', 'setup')}${not('request', 'complete')}`,
    setupCpl: w('rrc', 'setup', 'complete'),
    reconf: `${w('rrc', 'reconfiguration')}${not('complete')}`,
    reconfCpl: w('rrc', 'reconfiguration', 'complete'),
    release: `${w('rrc', 'release')}`,
    reestReq: w('rrc', 're-?establishment', 'request'),
    reest: `${w('rrc', 're-?establishment')}${not('request', 'complete')}`,
    reestCpl: w('rrc', 're-?establishment', 'complete'),
    measReport: w('measurement', 'report'),
    paging: '\\bpaging\\b',
    smc: w('security', 'mode', 'command'),
    mobility: 'reconfigurationWithSync',
    scellAdd: 'sCellToAddModList',
    scellRelease: 'sCellToReleaseList',
  },
  lte: {
    setupReq: w('rrc', 'connection', 'request'),
    setup: `${w('rrc', 'connection', 'setup')}${not('complete')}`,
    setupCpl: w('rrc', 'connection', 'setup', 'complete'),
    reconf: `${w('rrc', 'connection', 'reconfiguration')}${not('complete')}`,
    reconfCpl: w('rrc', 'connection', 'reconfiguration', 'complete'),
    release: w('rrc', 'connection', 'release'),
    reestReq: w('rrc', 'connection', 're-?establishment', 'request'),
    reest: `${w('rrc', 'connection', 're-?establishment')}${not('request', 'complete', 'reject')}`,
    reestCpl: w('rrc', 'connection', 're-?establishment', 'complete'),
    measReport: w('measurement', 'report'),
    paging: '\\bpaging\\b',
    smc: w('security', 'mode', 'command'),
    mobility: 'mobilityControlInfo',
    scellAdd: 'sCellToAddModList',
    scellRelease: 'sCellToReleaseList',
  },
};

export interface NasNames {
  regReq: string; authReq: string; authResp: string; smc: string; smcCpl: string;
  regAccept: string; regCpl: string;
  sessReq?: string; sessAccept?: string;
  serviceReq: string;
  tauReq?: string; tauAccept?: string;
  detachUe: string; detachNw: string; detachAccept: string;
}

export const NAS: Record<Rat, NasNames> = {
  nr: {
    regReq: `\\b${w('registration', 'request')}`,
    authReq: w('authentication', 'request'),
    authResp: w('authentication', 'response'),
    smc: w('security', 'mode', 'command'),
    smcCpl: w('security', 'mode', 'complete'),
    regAccept: `\\b${w('registration', 'accept')}`,
    regCpl: `\\b${w('registration', 'complete')}`,
    sessReq: w('pdu', 'session', 'establishment', 'request'),
    sessAccept: w('pdu', 'session', 'establishment', 'accept'),
    serviceReq: w('service', 'request'),
    detachUe: w('de-?registration', 'request'),
    detachNw: w('de-?registration', 'request'),
    detachAccept: w('de-?registration', 'accept'),
  },
  lte: {
    regReq: w('attach', 'request'),
    authReq: w('authentication', 'request'),
    authResp: w('authentication', 'response'),
    smc: w('security', 'mode', 'command'),
    smcCpl: w('security', 'mode', 'complete'),
    regAccept: w('attach', 'accept'),
    regCpl: w('attach', 'complete'),
    serviceReq: w('service', 'request'),
    tauReq: w('tracking', 'area', 'update', 'request'),
    tauAccept: w('tracking', 'area', 'update', 'accept'),
    detachUe: w('detach', 'request'),
    detachNw: w('detach', 'request'),
    detachAccept: w('detach', 'accept'),
  },
};

/** RRC item on the eNB/gNB log. */
export const rrcItem = (msg: string, label: string, extra: Partial<LogSeqItem> = {}): LogSeqItem =>
  ({ target: 'enb', layer: 'RRC', msg, label, ...extra });
/** NAS item on the MME/AMF log. */
export const nasItem = (msg: string, label: string, extra: Partial<LogSeqItem> = {}): LogSeqItem =>
  ({ target: 'mme', layer: 'NAS', msg, label, ...extra });

type Levels = Partial<Record<'enb' | 'mme', Record<string, 'error' | 'warn' | 'info' | 'debug'>>>;
/** Log layers a case raises to debug (restored by the runner's teardown). */
export const logLevels = (rat: Rat): Levels => (rat === 'nr'
  ? { enb: { rrc: 'debug', ngap: 'debug' }, mme: { nas: 'debug', ngap: 'debug' } }
  : { enb: { rrc: 'debug', s1ap: 'debug' }, mme: { nas: 'debug', s1ap: 'debug' } });

export const ratLabel = (r: Rat) => (r === 'nr' ? 'NR SA' : 'LTE');
