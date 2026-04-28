// Reverse-engineer a parsed Amarisoft .cfg (output of cfgParser.parseAmarisoftConfig)
// back into builder form state. Best-effort: unknown fields fall back to defaults.
//
// Public API:
//   importCfgToBuilder(text)         → { type, form } | null
//   detectConfigType(ast, fileName?) → 'nr' | 'lte' | 'core' | 'unknown'
import {
  DEFAULT_NR_FORM, DEFAULT_LAYERS, makeDefaultCell,
  type NRFormState, type LayersConfig, type NRCellEntry,
  type PdnEntry, type UeDbEntry,
} from './constants';
import { DEFAULT_LTE_FORM, DEFAULT_LTE_EARFCN, type LTEFormState } from './lteConstants';
import { tryParseAmarisoftConfig, parseLogOptions } from './cfgParser';

export type BuilderConfigType = 'nr' | 'lte' | 'nbiot' | 'catm' | 'core';

export interface ImportedBuilderState {
  type: BuilderConfigType;
  form: NRFormState | LTEFormState;
  /** Non-fatal warnings about fields the parser couldn't map */
  warnings: string[];
}

// ─── Type detection ─────────────────────────────────────────────────────────

/**
 * Decide which RAT family a parsed config belongs to. Looks at top-level keys
 * and falls back to filename hints (gnb*.cfg → nr, mme*.cfg → core, etc).
 */
export function detectConfigType(
  ast: Record<string, any> | null,
  fileName?: string,
): BuilderConfigType | 'unknown' {
  if (!ast) return 'unknown';

  // ── Strong signals (top-level keys) ───────────────────────────────────────
  // MME / EPC config has ue_db, pdn_list, mme_group_id at root
  if (ast.ue_db !== undefined || ast.pdn_list !== undefined || ast.mme_group_id !== undefined) {
    return 'core';
  }
  // NR (gNB SA) config has nr_cell_list (or nr_cell_default) and amf_list
  if (ast.amf_list !== undefined || ast.gnb_id !== undefined || hasNonEmpty(ast.nr_cell_list)) {
    return 'nr';
  }
  // LTE / NB-IoT / CAT-M eNB has cell_list and mme_list
  if (hasNonEmpty(ast.cell_list) || ast.mme_list !== undefined || ast.enb_id !== undefined) {
    // Refine: check NB-IoT / CAT-M markers in the first cell
    const cell = ast.cell_list?.[0] || {};
    if (cell.nb_iot === true || cell.nb_iot_mode) return 'nbiot';
    if (cell.ce_mode || cell.max_repetitions !== undefined) return 'catm';
    return 'lte';
  }

  // ── Fallback: filename hint ───────────────────────────────────────────────
  if (fileName) {
    const lower = fileName.toLowerCase();
    if (/^mme|^ims|\.db$/.test(lower)) return 'core';
    if (lower.startsWith('gnb') || lower.includes('-nr') || lower.includes('-sa')) return 'nr';
    if (lower.includes('nbiot') || lower.includes('nb-iot')) return 'nbiot';
    if (lower.includes('catm') || lower.includes('cat-m')) return 'catm';
    if (lower.startsWith('enb') || lower.includes('-lte')) return 'lte';
  }

  return 'unknown';
}

function hasNonEmpty(v: any): boolean {
  return Array.isArray(v) && v.length > 0;
}

// ─── PLMN / hex helpers ─────────────────────────────────────────────────────

function splitPlmn(plmnStr: any): { mcc: string; mnc: string } {
  const s = String(plmnStr ?? '');
  if (s.length === 5) return { mcc: s.slice(0, 3), mnc: s.slice(3) };
  if (s.length === 6) return { mcc: s.slice(0, 3), mnc: s.slice(3) };
  return { mcc: '001', mnc: '01' };
}

/** Convert any numeric form (123 / 0x7B / "0x7B") to a "0xNNN" string for the form. */
function toHexString(v: any, fallback: string): string {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'number') return '0x' + v.toString(16).toUpperCase();
  const s = String(v).trim();
  if (/^0x[0-9a-fA-F]+$/i.test(s)) return s.toUpperCase().replace('0X', '0x');
  const n = Number(s);
  if (!isNaN(n)) return '0x' + n.toString(16).toUpperCase();
  return s;
}

function num(v: any, fallback: number): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = Number(v); return isNaN(n) ? fallback : n; }
  return fallback;
}

function bool(v: any, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

function str(v: any, fallback: string): string {
  return typeof v === 'string' ? v : v === undefined || v === null ? fallback : String(v);
}

// ─── NR (gNB SA) mapper ─────────────────────────────────────────────────────

function astToNRForm(ast: Record<string, any>, warnings: string[]): NRFormState {
  const cellDefault = ast.nr_cell_default || {};
  const cellList: any[] = Array.isArray(ast.nr_cell_list) ? ast.nr_cell_list : [];
  const cell0 = cellList[0] || {};

  const plmnEntry = (cellDefault.plmn_list?.[0]) || (cell0.plmn_list?.[0]) || {};
  const { mcc, mnc } = splitPlmn(plmnEntry.plmn);

  const tddCfg = cellDefault.tdd_ul_dl_config?.pattern1 || cellDefault.tdd_ul_dl_config || {};
  const isTdd = !!cellDefault.tdd_ul_dl_config;

  const band = num(cell0.band ?? cellDefault.band, DEFAULT_NR_FORM.band);
  const isFR2 = band >= 257 && band <= 261;

  const logOpts = parseLogOptions(str(ast.log_options, ''));

  // Build per-cell entries
  const cells: NRCellEntry[] = (cellList.length > 0 ? cellList : [{}]).map((c: any, i: number) =>
    makeDefaultCell(`Cell ${i + 1}`, {
      cellId: num(c.cell_id, DEFAULT_NR_FORM.cellId),
      band: num(c.band, band),
      nrBandwidth: num(c.bandwidth ?? cellDefault.bandwidth, DEFAULT_NR_FORM.nrBandwidth),
      subcarrierSpacing: num(c.subcarrier_spacing, DEFAULT_NR_FORM.subcarrierSpacing),
      dlNrArfcn: num(c.dl_nr_arfcn, DEFAULT_NR_FORM.dlNrArfcn),
      ssbPosBitmap: str(c.ssb_pos_bitmap, DEFAULT_NR_FORM.ssbPosBitmap),
      nrTdd: isTdd ? 1 : 0,
      fr2: isFR2 ? 1 : 0,
      tddPattern: {
        period:    num(tddCfg.period,     DEFAULT_NR_FORM.tddPattern.period),
        dlSlots:   num(tddCfg.dl_slots,   DEFAULT_NR_FORM.tddPattern.dlSlots),
        dlSymbols: num(tddCfg.dl_symbols, DEFAULT_NR_FORM.tddPattern.dlSymbols),
        ulSlots:   num(tddCfg.ul_slots,   DEFAULT_NR_FORM.tddPattern.ulSlots),
        ulSymbols: num(tddCfg.ul_symbols, DEFAULT_NR_FORM.tddPattern.ulSymbols),
      },
    }),
  );

  // Layer-level params live in nr_cell_default
  const layers: LayersConfig = {
    ...DEFAULT_LAYERS,
    srPeriod:                     num(cellDefault.sr_period,                     DEFAULT_LAYERS.srPeriod),
    cqiPeriod:                    num(cellDefault.cqi_period,                    DEFAULT_LAYERS.cqiPeriod),
    dl256qam:                     bool(cellDefault.dl_256qam,                    DEFAULT_LAYERS.dl256qam),
    ul64qam:                      bool(cellDefault.ul_64qam,                     DEFAULT_LAYERS.ul64qam),
    qRxLevMin:                    num(cellDefault.q_rx_lev_min,                  DEFAULT_LAYERS.qRxLevMin),
    pMax:                         num(cellDefault.p_max,                         DEFAULT_LAYERS.pMax),
    inactivityTimer:              num(cellDefault.inactivity_timer,              DEFAULT_LAYERS.inactivityTimer),
    pdschMcsTable:                str(cellDefault.pdsch?.mcs_table,              DEFAULT_LAYERS.pdschMcsTable),
    puschMcsTable:                str(cellDefault.pusch?.mcs_table,              DEFAULT_LAYERS.puschMcsTable),
    prachConfigIndex:             num(cellDefault.prach?.prach_config_index,     DEFAULT_LAYERS.prachConfigIndex),
    prachRootSeqIndex:            num(cellDefault.root_sequence_index,           DEFAULT_LAYERS.prachRootSeqIndex),
    raResponseWindowSize:         num(cellDefault.prach?.ra_response_window,     DEFAULT_LAYERS.raResponseWindowSize),
    macContentionResolutionTimer: num(cellDefault.prach?.ra_contention_resolution_timer, DEFAULT_LAYERS.macContentionResolutionTimer),
    ulMaxHarqTx:                  num(cellDefault.mac_config?.ul_max_harq_tx,    DEFAULT_LAYERS.ulMaxHarqTx),
    dlMaxHarqTx:                  num(cellDefault.mac_config?.dl_max_harq_tx,    DEFAULT_LAYERS.dlMaxHarqTx),
    msg3MaxHarqTx:                num(cellDefault.mac_config?.msg3_max_harq_tx,  DEFAULT_LAYERS.msg3MaxHarqTx),
    sibCellBarred:                bool(cellDefault.cell_barred,                  DEFAULT_LAYERS.sibCellBarred),
    sibIntraFreqReselection:      bool(cellDefault.intra_freq_reselection,       DEFAULT_LAYERS.sibIntraFreqReselection),
  };

  return {
    cellId:           num(cell0.cell_id ?? cellDefault.n_id_cell, DEFAULT_NR_FORM.cellId),
    nrTdd:            isTdd ? 1 : 0,
    fr2:              isFR2 ? 1 : 0,
    plmn:             { mcc, mnc },
    tac:              num(plmnEntry.tac, DEFAULT_NR_FORM.tac),
    ssbPeriod:        num(cellDefault.ssb_period, DEFAULT_NR_FORM.ssbPeriod),
    dmrsTypeAPos:     num(cellDefault.dmrs_type_a_pos, DEFAULT_NR_FORM.dmrsTypeAPos),
    band,
    nrBandwidth:      num(cellDefault.bandwidth, DEFAULT_NR_FORM.nrBandwidth),
    subcarrierSpacing: num(cell0.subcarrier_spacing, DEFAULT_NR_FORM.subcarrierSpacing),
    dlNrArfcn:        num(cell0.dl_nr_arfcn, DEFAULT_NR_FORM.dlNrArfcn),
    ssbPosBitmap:     str(cell0.ssb_pos_bitmap, DEFAULT_NR_FORM.ssbPosBitmap),
    tddPattern:       cells[0].tddPattern,
    nAntennaDl:       num(cellDefault.n_antenna_dl, DEFAULT_NR_FORM.nAntennaDl),
    nAntennaUl:       num(cellDefault.n_antenna_ul, DEFAULT_NR_FORM.nAntennaUl),
    rfMode:           (str(ast.rf_driver?.name, 'sdr') === 'ip' ? 'ip' : 'sdr') as 'sdr' | 'split' | 'ip',
    txGain:           num(ast.tx_gain, DEFAULT_NR_FORM.txGain),
    rxGain:           num(ast.rx_gain, DEFAULT_NR_FORM.rxGain),
    rxAntenna:        str(ast.rf_driver?.rx_antenna, DEFAULT_NR_FORM.rxAntenna),
    amfAddr:          str(ast.amf_list?.[0]?.amf_addr, DEFAULT_NR_FORM.amfAddr),
    gtpAddr:          str(ast.gtp_addr, DEFAULT_NR_FORM.gtpAddr),
    gnbId:            toHexString(ast.gnb_id, DEFAULT_NR_FORM.gnbId),
    channelSim:       false,
    channelType:      DEFAULT_NR_FORM.channelType,
    noiseLevel:       DEFAULT_NR_FORM.noiseLevel,
    logFilename:      str(ast.log_filename, DEFAULT_NR_FORM.logFilename),
    logLevel:         logOpts.level,
    logLayers:        logOpts.layers,
    pcapFilename:     '',
    pcapMaxLen:       DEFAULT_NR_FORM.pcapMaxLen,
    pdnList:          DEFAULT_NR_FORM.pdnList,
    ueDb:             DEFAULT_NR_FORM.ueDb,
    cells,
    activeCellIdx:    0,
    layers,
  };
}

// ─── LTE (eNB) mapper ───────────────────────────────────────────────────────

function astToLTEForm(ast: Record<string, any>, warnings: string[]): LTEFormState {
  const cellList: any[] = Array.isArray(ast.cell_list) ? ast.cell_list : [];
  const cell0 = cellList[0] || {};

  // Multi-cell (carrier aggregation) — surface as a warning since the LTE
  // builder currently edits a single cell. Cell 0 is loaded; cells[1..] kept
  // in the source file and round-tripped untouched on save.
  if (cellList.length > 1) {
    warnings.push(
      `Detected ${cellList.length}-cell carrier aggregation. Only Cell 1 is loaded into the builder; ` +
      `the additional cell${cellList.length > 2 ? 's' : ''} (cell_id=` +
      `${cellList.slice(1).map((c: any) => c.cell_id ?? '?').join(', ')}) ` +
      `will be lost if you re-save from the builder.`
    );
  }

  // Cell-default block (LTE puts shared params in cell_default, not in cell_list[i])
  const cellDefault = ast.cell_default || {};
  // Plmn list can live on the cell or in cell_default; cell_default uses bare strings ("00101")
  const plmnEntry = (cell0.plmn_list?.[0]) || (cellDefault.plmn_list?.[0]) || {};
  const plmnRaw = typeof plmnEntry === 'string' ? plmnEntry : plmnEntry.plmn;
  const { mcc, mnc } = splitPlmn(plmnRaw);
  const logOpts = parseLogOptions(str(ast.log_options, ''));

  // Try to derive band from EARFCN by closest-match reverse lookup.
  // EARFCN ranges per band are non-overlapping; closest-band heuristic is good enough.
  const earfcn = num(cell0.dl_earfcn, DEFAULT_LTE_FORM.dlEarfcn);
  const derivedBand = (() => {
    let bestBand = DEFAULT_LTE_FORM.band;
    let bestDist = Infinity;
    for (const [b, e] of Object.entries(DEFAULT_LTE_EARFCN)) {
      const dist = Math.abs(earfcn - (e as number));
      if (dist < bestDist) { bestDist = dist; bestBand = Number(b); }
    }
    // Sanity bound: only trust the derived band if EARFCN is reasonably close
    return bestDist < 5000 ? bestBand : DEFAULT_LTE_FORM.band;
  })();

  // cipher_algo_pref / integ_algo_pref live in cell_default in real Amarisoft files.
  // Numeric integrity values (e.g. [2, 1]) -> 'eia2', 'eia1' for the form.
  const rawCipher = cell0.cipher_algo_pref ?? cellDefault.cipher_algo_pref;
  const rawInteg  = cell0.integ_algo_pref  ?? cellDefault.integ_algo_pref;
  const intToEea = (n: any) => typeof n === 'number' ? `eea${n}` : String(n);
  const intToEia = (n: any) => typeof n === 'number' ? `eia${n}` : String(n);
  const cipher = Array.isArray(rawCipher) && rawCipher.length > 0
    ? rawCipher.map(intToEea) : DEFAULT_LTE_FORM.cipherAlgoPref;
  const integ  = Array.isArray(rawInteg) && rawInteg.length > 0
    ? rawInteg.map(intToEia)  : DEFAULT_LTE_FORM.integAlgoPref;

  // Helper: cell value, falling back to cell_default if absent on the cell
  const cv = (cell: any, key: string) => cell?.[key] !== undefined ? cell[key] : cellDefault[key];

  // Bandwidth in Amarisoft is `n_rb_dl` (number of resource blocks: 6/15/25/50/75/100).
  // Map back to MHz for the form.
  const nRbDl = num(cv(cell0, 'n_rb_dl') ?? cv(cell0, 'bandwidth'), 0);
  const rbToMhz: Record<number, number> = { 6: 1.4, 15: 3, 25: 5, 50: 10, 75: 15, 100: 20 };
  const bandwidth = rbToMhz[nRbDl] ?? num(cv(cell0, 'bandwidth'), DEFAULT_LTE_FORM.bandwidth);

  // TDD detection — Amarisoft uses `uldl_config` in cell_default (not tdd_ul_dl_config like NR)
  const tddConfigVal = num(cv(cell0, 'tdd_ul_dl_config') ?? cv(cell0, 'uldl_config'), DEFAULT_LTE_FORM.tddConfig);
  const tddSpVal = num(cv(cell0, 'tdd_special_subframe_pattern') ?? cv(cell0, 'sp_config'), DEFAULT_LTE_FORM.tddSpecialSubframe);

  return {
    cellId:               num(cell0.cell_id, DEFAULT_LTE_FORM.cellId),
    pci:                  num(cell0.n_id_cell, DEFAULT_LTE_FORM.pci),
    tac:                  num(cell0.tac, DEFAULT_LTE_FORM.tac),
    rfPort:               num(cell0.rf_port, DEFAULT_LTE_FORM.rfPort),
    plmn:                 { mcc, mnc },
    attachWithoutPdn:     bool(plmnEntry.attach_without_pdn, DEFAULT_LTE_FORM.attachWithoutPdn),
    plmnReserved:         bool(plmnEntry.reserved, DEFAULT_LTE_FORM.plmnReserved),
    band:                 derivedBand,
    bandwidth,
    dlEarfcn:             earfcn,
    cpMode:               (str(cv(cell0, 'cyclic_prefix'), 'normal') as 'normal' | 'extended'),
    phichDuration:        (str(cv(cell0, 'phich_duration'), 'normal') as 'normal' | 'extended'),
    phichResource:        str(cv(cell0, 'phich_resource'), DEFAULT_LTE_FORM.phichResource),
    tddConfig:            tddConfigVal,
    tddSpecialSubframe:   tddSpVal,
    nAntennaDl:           num(cv(cell0, 'n_antenna_dl'), DEFAULT_LTE_FORM.nAntennaDl),
    nAntennaUl:           num(cv(cell0, 'n_antenna_ul'), DEFAULT_LTE_FORM.nAntennaUl),
    rfMode:               (str(ast.rf_driver?.name, 'sdr') === 'ip' ? 'ip' : 'sdr') as 'sdr' | 'split' | 'ip',
    txGain:               num(ast.tx_gain, DEFAULT_LTE_FORM.txGain),
    rxGain:               num(ast.rx_gain, DEFAULT_LTE_FORM.rxGain),
    rxAntenna:            str(ast.rf_driver?.rx_antenna, DEFAULT_LTE_FORM.rxAntenna),
    mmeAddr:              str(ast.mme_list?.[0]?.mme_addr, DEFAULT_LTE_FORM.mmeAddr),
    gtpAddr:              str(ast.gtp_addr, DEFAULT_LTE_FORM.gtpAddr),
    enbId:                toHexString(ast.enb_id, DEFAULT_LTE_FORM.enbId),
    cellBarred:           bool(cv(cell0, 'cell_barred'), DEFAULT_LTE_FORM.cellBarred),
    intraFreqReselection: bool(cv(cell0, 'intra_freq_reselection'), DEFAULT_LTE_FORM.intraFreqReselection),
    qRxLevMin:            num(cv(cell0, 'q_rx_lev_min'), DEFAULT_LTE_FORM.qRxLevMin),
    pMax:                 num(cv(cell0, 'p_max'), DEFAULT_LTE_FORM.pMax),
    siCoderate:           num(cv(cell0, 'si_coderate'), DEFAULT_LTE_FORM.siCoderate),
    siWindowLength:       num(cv(cell0, 'si_window_length'), DEFAULT_LTE_FORM.siWindowLength),
    srPeriod:             num(cv(cell0, 'sr_period'), DEFAULT_LTE_FORM.srPeriod),
    cqiPeriod:            num(cv(cell0, 'cqi_period'), DEFAULT_LTE_FORM.cqiPeriod),
    ulMaxHarqTx:          num(cv(cell0, 'mac_config')?.ul_max_harq_tx, DEFAULT_LTE_FORM.ulMaxHarqTx),
    dlMaxHarqTx:          num(cv(cell0, 'mac_config')?.dl_max_harq_tx, DEFAULT_LTE_FORM.dlMaxHarqTx),
    dpc:                  bool(cv(cell0, 'dpc'), DEFAULT_LTE_FORM.dpc),
    dpcPuschSnrTarget:    num(cv(cell0, 'dpc_pusch_snr_target'), DEFAULT_LTE_FORM.dpcPuschSnrTarget),
    dpcPucchSnrTarget:    num(cv(cell0, 'dpc_pucch_snr_target'), DEFAULT_LTE_FORM.dpcPucchSnrTarget),
    inactivityTimer:      num(cv(cell0, 'inactivity_timer'), DEFAULT_LTE_FORM.inactivityTimer),
    drbConfig:            str(cv(cell0, 'drb_config'), DEFAULT_LTE_FORM.drbConfig),
    cipherAlgoPref:       cipher,
    integAlgoPref:        integ,
    nbIot:                bool(cv(cell0, 'nb_iot'), DEFAULT_LTE_FORM.nbIot),
    nbIotMode:            (str(cv(cell0, 'nb_iot_mode'), DEFAULT_LTE_FORM.nbIotMode) as any),
    nbIotPrbIndex:        num(cv(cell0, 'nb_iot_prb_index'), DEFAULT_LTE_FORM.nbIotPrbIndex),
    catM:                 cv(cell0, 'ce_mode') !== undefined,
    catMCeMode:           (str(cv(cell0, 'ce_mode'), 'A') as 'A' | 'B'),
    catMRepetitions:      num(cv(cell0, 'max_repetitions'), DEFAULT_LTE_FORM.catMRepetitions),
    logFilename:          str(ast.log_filename, DEFAULT_LTE_FORM.logFilename),
    logLevel:             logOpts.level,
    logLayers:            logOpts.layers,
  };
}

// ─── Core (mme.cfg) mapper — populates the NRFormState used by CoreConfigBuilder ──

function astToCoreForm(ast: Record<string, any>, warnings: string[]): NRFormState {
  const { mcc, mnc } = splitPlmn(ast.plmn);
  const pdnList: PdnEntry[] = Array.isArray(ast.pdn_list)
    ? ast.pdn_list.map((p: any) => ({
        pdn_type:          str(p.pdn_type, 'ipv4'),
        access_point_name: str(p.access_point_name, 'internet'),
        first_ip_addr:     str(p.first_ip_addr, '192.168.2.2'),
        last_ip_addr:      str(p.last_ip_addr, '192.168.2.254'),
        dns_addr:          p.dns_addr ? String(p.dns_addr) : undefined,
        ims_vops:          p.ims_vops ? true : undefined,
      }))
    : DEFAULT_NR_FORM.pdnList;

  const ueDb: UeDbEntry[] = Array.isArray(ast.ue_db)
    ? ast.ue_db.map((u: any) => ({
        sim_algo: str(u.sim_algo, 'milenage'),
        imsi:     str(u.imsi, '001010000000001'),
        K:        str(u.K, '00112233445566778899aabbccddeeff'),
        opc:      str(u.opc, '63bfa50ee6523365ff14c1f45f88737d'),
        amf:      typeof u.amf === 'number' ? u.amf : 0x9001,
        sqn:      str(u.sqn, '000000000000'),
        nb_ue:    num(u.nb_ue, 1),
        ims:      Boolean(u.impi || u.impu || u.domain),
      }))
    : DEFAULT_NR_FORM.ueDb;

  const logOpts = parseLogOptions(str(ast.log_options, ''));

  return {
    ...DEFAULT_NR_FORM,
    plmn:        { mcc, mnc },
    tac:         num(ast.tac, DEFAULT_NR_FORM.tac),
    gtpAddr:     str(ast.gtp_addr, DEFAULT_NR_FORM.gtpAddr),
    pdnList,
    ueDb,
    logFilename: str(ast.log_filename, '/tmp/mme.log'),
    logLevel:    logOpts.level,
    logLayers:   logOpts.layers,
  };
}

// ─── Public entry point ─────────────────────────────────────────────────────

/**
 * Convert raw Amarisoft .cfg text into builder form state.
 *
 * Returns null if the file can't be parsed at all. Otherwise returns the
 * detected RAT type, a complete form (defaults filled in for missing fields),
 * and any warnings about fields that couldn't be mapped.
 */
export function importCfgToBuilder(text: string, fileName?: string): ImportedBuilderState | null {
  const ast = tryParseAmarisoftConfig(text);
  if (!ast) return null;

  const detected = detectConfigType(ast, fileName);
  if (detected === 'unknown') return null;

  const warnings: string[] = [];

  if (detected === 'core') {
    return { type: 'core', form: astToCoreForm(ast, warnings), warnings };
  }
  if (detected === 'nr') {
    return { type: 'nr', form: astToNRForm(ast, warnings), warnings };
  }
  // LTE family: nbiot / catm / lte
  const lteForm = astToLTEForm(ast, warnings);
  if (detected === 'nbiot') return { type: 'nbiot', form: lteForm, warnings };
  if (detected === 'catm')  return { type: 'catm',  form: lteForm, warnings };
  return { type: 'lte', form: lteForm, warnings };
}
