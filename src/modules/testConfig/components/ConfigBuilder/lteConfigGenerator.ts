// Generates Amarisoft enb.cfg for LTE / NB-IoT / CAT-M1
import type { LTEFormState, LTECellEntry } from './lteConstants';
import { LTE_TDD_BANDS, makeDefaultLteCell } from './lteConstants';
import { formatGain } from './rfDefaults';

/**
 * For the 'ip' rf_driver, derive per-port { dst, src } pairs that match the
 * Amarisoft trx_ip config.cfg sample shape.
 *
 * trx_ip semantics (verified against canonical /root/enb/config/rf_driver/
 * config.cfg + the bind-address failure mode `Cannot assign requested
 * address`):
 *   • src<N> = LOCAL socket the daemon BINDS to. Must resolve to an
 *     address on the host running the daemon.
 *   • dst<N> = PEER address (e.g. UE simulator). Outbound sample target.
 *
 * Form-side mapping for legacy `args:` strings:
 *   tx_addr → src   (local bind for TX path)
 *   rx_addr → dst   (peer where RX arrives from)
 * Earlier versions had this flipped, which produced configs that tried
 * to bind to the user's PC IP from the callbox and failed at RF init.
 *
 * Recognized inputs:
 *   "tx_addr=tcp://LOCAL,rx_addr=tcp://PEER"  (legacy form)
 *   "src=tcp://LOCAL,dst=tcp://PEER"          (canonical names)
 *   "dst0=PEER,src0=LOCAL,dst1=…"             (already structured)
 *   ""                                         (defaults to loopback)
 *
 * Returns one { dst, src } per requested port. Missing ports get
 * 127.0.0.1 with a stride-of-2 port range starting at 4000, matching
 * the canonical Amarisoft sample.
 */
function parseIpPortsFromArgs(rfArgs: string | undefined, nPorts: number): Array<{ dst: string; src: string }> {
  const ports: Array<{ dst: string; src: string }> = [];
  const normalize = (v: string) => v.trim().replace(/^"+|"+$/g, '').replace(/^tcp:\/\//, '');

  // Read every key=value in the args string into a flat map.
  const map = new Map<string, string>();
  for (const tok of (rfArgs ?? '').split(/[,;]/)) {
    const m = tok.match(/^\s*([a-zA-Z_]\w*)\s*=\s*(.+?)\s*$/);
    if (m) map.set(m[1].toLowerCase(), normalize(m[2]));
  }

  // Pull explicit dstN/srcN if present, otherwise fall back. Note:
  //   tx_addr → src (local TX bind), rx_addr → dst (peer / RX source).
  for (let i = 0; i < nPorts; i++) {
    const dstK = map.get(`dst${i}`)
              ?? (i === 0 ? (map.get('dst') ?? map.get('rx_addr')) : undefined);
    const srcK = map.get(`src${i}`)
              ?? (i === 0 ? (map.get('src') ?? map.get('tx_addr')) : undefined);
    ports.push({
      dst: dstK || `127.0.0.1:${4000 + i * 2}`,
      src: srcK || `127.0.0.1:${4000 + i * 2 + 1}`,
    });
  }
  return ports;
}

/**
 * Format PLMN string: MCC (3-digit) + MNC (2- or 3-digit, zero-padded).
 * enb.cfg: cell_list[].plmn_list[].plmn — e.g. "00101" (MCC=001, MNC=01)
 */
function formatPlmn(mcc: string, mnc: string): string {
  const paddedMcc = mcc.padStart(3, '0').slice(-3);
  const mncLen = mnc.length >= 3 ? 3 : 2;
  const paddedMnc = mnc.padStart(mncLen, '0').slice(-mncLen);
  return `${paddedMcc}${paddedMnc}`;
}

/**
 * LTE channel bandwidth (MHz) → number of resource blocks. Amarisoft's
 * enb.cfg per-cell field is `n_rb_dl`, NOT `bandwidth` — emitting the
 * MHz value as `bandwidth: 5` gets you
 *   config/enb.cfg:45:7: expecting 'n_rb_dl' field
 * (NR cells DO use `bandwidth` in nr_cell_default — this only applies
 * to the LTE cell list.)
 */
function mhzToRbLte(mhz: number): number {
  // Form stores 1.4 as the literal 1.4 number. Round to one decimal
  // before lookup so 1.40000001 still resolves.
  const key = Math.round(Number(mhz) * 10) / 10;
  const map: Record<string, number> = {
    '1.4': 6, '3': 15, '5': 25, '10': 50, '15': 75, '20': 100,
  };
  return map[String(key)] ?? 50;  // 10 MHz default if something weird
}

export function generateLTEConfig(form: LTEFormState, ratMode: 'lte' | 'nbiot' | 'catm'): string {
  const isTdd = LTE_TDD_BANDS.includes(form.band);
  const ratLabel = ratMode === 'nbiot' ? 'NB-IoT' : ratMode === 'catm' ? 'CAT-M1 (eMTC)' : 'LTE';

  // ── log_options: build the same way NR generator does, honouring per-layer overrides ──
  // enb.cfg: log_options — e.g. "all.level=error,all.max_size=0,nas.level=debug,nas.max_size=1"
  const logParts: string[] = [];
  const lvl = form.logLevel || 'error';
  logParts.push(`all.level=${lvl}`, 'all.max_size=0');
  for (const [layer, level] of Object.entries(form.logLayers || {})) {
    if (level && level !== lvl) {
      logParts.push(`${layer}.level=${level}`, `${layer}.max_size=1`);
    }
  }
  const logOptions = logParts.join(',');

  // ── cipher / integ algo arrays ───────────────────────────────────────────────
  // Amarisoft's parser expects INTEGER values, AND on lteenb 2026-04-22+
  // the valid range is 1–3 ONLY. Earlier rounds of this bug:
  //   ["eea0", "eea2"]   → "algorithm identifier expected"
  //   [EEA0, EEA2]       → "unexpected identifier: EEA0"
  //   [0, 2, 3]          → "valid algorithm identifiers are between 1 and 3"
  //
  // 1=EEA1/SNOW, 2=EEA2/AES, 3=EEA3/ZUC (similarly for EIAn). 0 (null
  // cipher) is rejected by Amarisoft as insecure. We strip it both at
  // generation time AND in the deploy sanitizer so old saved configs
  // that had it inherit the fix.
  const toAlgoInt = (a: string | number) => {
    if (typeof a === 'number') return a;
    const m = String(a).match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : NaN;
  };
  const filterValidAlgo = (n: number) => Number.isFinite(n) && n >= 1 && n <= 3;

  // Default form value used to ship 'eea0' first; bumped to start at 1.
  const cipherArr = (form.cipherAlgoPref ?? ['eea1', 'eea2', 'eea3'])
    .map(toAlgoInt).filter(filterValidAlgo).join(', ');
  const integArr = (form.integAlgoPref ?? ['eia1', 'eia2', 'eia3'])
    .map(toAlgoInt).filter(filterValidAlgo).join(', ');

  // ── Build cell_list — emit every cell in form.cells[] ───────────────────────
  // The flat form fields (cellId, pci, ...) mirror cells[activeCellIdx]; the
  // currently-active cell uses the freshest flat values, others use their slot.
  const cellEntries: LTECellEntry[] = form.cells && form.cells.length > 0
    ? form.cells.map((c, i) =>
        i === (form.activeCellIdx ?? 0)
          ? {
              ...c,
              cellId: form.cellId,
              pci: form.pci,
              tac: form.tac,
              rfPort: form.rfPort,
              band: form.band,
              bandwidth: form.bandwidth,
              dlEarfcn: form.dlEarfcn,
              tddConfig: form.tddConfig,
              tddSpecialSubframe: form.tddSpecialSubframe,
            }
          : c
      )
    : [makeDefaultLteCell('Cell 1', {
        cellId: form.cellId, pci: form.pci, tac: form.tac, rfPort: form.rfPort,
        band: form.band, bandwidth: form.bandwidth, dlEarfcn: form.dlEarfcn,
        tddConfig: form.tddConfig, tddSpecialSubframe: form.tddSpecialSubframe,
      })];

  // ── Per-cell entries: ONLY the fields that genuinely vary per cell.
  //    Everything else lives in cell_default below — Amarisoft merges
  //    cell_default into each cell_list entry at parse time (docs:
  //    "cell_default ... will be merged with each element of cell_list").
  //
  //    Canonical Amarisoft sample (/root/enb/config/enb.default.cfg)
  //    keeps cell_list[] minimal:
  //      plmn_list, dl_earfcn, n_id_cell, cell_id, tac,
  //      root_sequence_index   (+ TDD / NB-IoT / CAT-M extras)
  //    Everything else (n_rb_dl, cell_barred, si_value_tag, sib_sched_list,
  //    pdsch_dedicated, pusch_dedicated, pucch_dedicated, prach_config_index,
  //    cipher_algo_pref, integ_algo_pref, srs_dedicated, mac_config, dpc, ...)
  //    sits in cell_default.
  //
  //    Earlier rounds of this bug emitted those fields per-cell and the
  //    parser balked with "expecting 'X' field" because they're declared
  //    once-per-config in cell_default, not per-cell.
  const cellListBlock = cellEntries.map((c, i) => {
    const cellTdd = LTE_TDD_BANDS.includes(c.band);
    const tddPart = cellTdd ? `
      tdd_ul_dl_config: ${c.tddConfig},
      tdd_special_subframe_pattern: ${c.tddSpecialSubframe},` : '';
    const nbiotPart = ratMode === 'nbiot'
      ? (form.nbIotMode === 'standalone'
          ? `\n      nb_iot: true,\n      nb_iot_mode: "standalone",`
          : `\n      nb_iot: true,\n      nb_iot_mode: "${form.nbIotMode}",\n      nb_iot_prb_index: ${form.nbIotPrbIndex},`)
      : '';
    const catmPart = ratMode === 'catm'
      ? `\n      ce_mode: "${form.catMCeMode}",\n      max_repetitions: ${form.catMRepetitions},`
      : '';
    const otherCellIds = cellEntries.filter((_, j) => j !== i).map(o => o.cellId);
    const scellPart = otherCellIds.length > 0 ? `
      scell_list: [${otherCellIds.map(id => `
        { cell_id: ${id}, cross_carrier_scheduling: false }`).join(',')}
      ],` : '';
    // rf_port only emitted when explicitly non-zero or multi-cell — single-cell
    // configs match the canonical sample which omits it.
    const rfPortPart = (cellEntries.length > 1 || (c.rfPort ?? 0) !== 0)
      ? `\n      rf_port: ${c.rfPort},` : '';

    return `    {
      /* ${c.name} */
      plmn_list: [{
        plmn: "${formatPlmn(form.plmn.mcc, form.plmn.mnc)}",
        attach_without_pdn: ${form.attachWithoutPdn},
        reserved: ${form.plmnReserved},
      }],
      dl_earfcn: ${c.dlEarfcn},
      n_id_cell: ${c.pci},
      cell_id: ${c.cellId},
      tac: ${c.tac},
      root_sequence_index: ${c.rootSequenceIndex},${rfPortPart}${tddPart}${nbiotPart}${catmPart}${scellPart}
    }`;
  }).join(',\n');

  // ── cell_default: shared / required parameters merged into every cell.
  //    This block must contain every field Amarisoft requires that isn't
  //    explicitly per-cell. Field order mirrors the canonical sample.
  //
  //    SRS bandwidth tuple varies by N_RB_DL (5/10/15/20 MHz). Values from
  //    /root/enb/config/enb.default.cfg.
  const nRbDl = mhzToRbLte(cellEntries[0]?.bandwidth ?? form.bandwidth);
  const srsBwTuple = (() => {
    if (nRbDl === 6)   return { config: 7, bw: 1 };
    if (nRbDl === 15)  return { config: 6, bw: 1 };
    if (nRbDl === 25)  return { config: 3, bw: 1 };
    if (nRbDl === 50)  return { config: 2, bw: 2 };
    if (nRbDl === 75)  return { config: 2, bw: 2 };
    return { config: 2, bw: 3 };  // 100 / 20 MHz
  })();
  // PRACH config index: 4 for FDD (subframe 4 every 10 ms), 15 for 1.4 MHz.
  const prachConfigIndex = nRbDl === 6 ? 15 : 4;
  // PUCCH dedicated — TDD adds tdd_ack_nack_feedback_mode.
  const pucchDedicated = isTdd
    ? `{ n1_pucch_sr_count: 11, cqi_pucch_n_rb: 1, tdd_ack_nack_feedback_mode: "multiplexing" }`
    : `{ n1_pucch_sr_count: 11, cqi_pucch_n_rb: 1 }`;

  const cellDefaultBlock = `  cell_default: {
    n_antenna_dl: ${form.nAntennaDl},
    n_antenna_ul: ${form.nAntennaUl},
    n_rb_dl: ${nRbDl},
    cyclic_prefix: "${form.cpMode}",
    phich_duration: "${form.phichDuration}",
    phich_resource: "${form.phichResource}",
    /* SIB1 */
    si_value_tag: 1,
    cell_barred: ${Boolean(cellEntries[0]?.cellBarred)},
    intra_freq_reselection: ${form.intraFreqReselection},
    q_rx_lev_min: ${form.qRxLevMin},
    p_max: ${form.pMax},
    si_window_length: ${form.siWindowLength},
    sib_sched_list: [
      { filename: "sib2_3.asn", si_periodicity: 16 },
    ],
    si_coderate: ${form.siCoderate},
    si_pdcch_format: 2,
    n_symb_cch: 0,
    pdsch_dedicated: { p_a: 0, p_b: -1 },
    pdcch_format: 2,
    prach_config_index: ${prachConfigIndex},
    prach_freq_offset: -1,
    pucch_dedicated: ${pucchDedicated},
    pusch_dedicated: {
      beta_offset_ack_index: 9,
      beta_offset_ri_index: 6,
      beta_offset_cqi_index: 6,
    },
    pusch_hopping_offset: -1,
    pusch_msg3_mcs: 0,
    initial_cqi: ${nRbDl === 6 ? 5 : 3},
    dl_256qam: true,
    ul_64qam: true,
    sr_period: ${form.srPeriod},
    cqi_period: ${form.cqiPeriod},
    srs_dedicated: {
      srs_bandwidth_config: ${srsBwTuple.config},
      srs_bandwidth: ${srsBwTuple.bw},
      srs_subframe_config: 3,
      srs_period: 40,
      srs_hopping_bandwidth: 0,
    },
    mac_config: { ul_max_harq_tx: ${form.ulMaxHarqTx}, dl_max_harq_tx: ${form.dlMaxHarqTx} },
    pusch_max_its: 6,
    dpc: ${form.dpc},
    dpc_pusch_snr_target: ${form.dpcPuschSnrTarget},
    dpc_pucch_snr_target: ${form.dpcPucchSnrTarget},
    cipher_algo_pref: [${cipherArr}],
    integ_algo_pref: [${integArr}],
    inactivity_timer: ${form.inactivityTimer},
    drb_config: "${form.drbConfig}",
  },`;

  // ── rf_driver block ──────────────────────────────────────────────────────
  // Shape varies by driver name. For 'sdr' and 'split' it's a small block
  // with `args:` (device path / O-RAN options). For 'ip' the trx_ip
  // driver requires a STRUCTURED block — no args: at all — with per-port
  // dst<N>/src<N> pairs and several driver-level fields. Source of truth
  // is /root/enb/config/rf_driver/config.cfg in the Amarisoft package.
  //
  // Wrong forms produce:
  //   args:"tx_addr=…,rx_addr=…"  → "Missing src port definitions"
  //   args:"src=…,dst=…"          → "Missing src port definitions"
  // because the parser literally looks for the field NAMES dst0/src0/…
  // not for an args string.
  const rfDriverBlock = (() => {
    if (form.rfMode === 'ip') {
      const nPorts = Math.max(1, Number(form.nAntennaDl ?? 1));
      const ipPorts = parseIpPortsFromArgs(form.rfArgs, nPorts);
      const portLines = ipPorts.map((p, i) =>
        `    /* Port ${i} */\n    dst${i}: "${p.dst}",\n    src${i}: "${p.src}",`,
      ).join('\n');
      // use_tcp / multi_thread come from rfArgs (UI-controllable). The
      // RF section exposes them as selects; defaults are 0/0 — the
      // values verified working against the user's callbox (192.168.1.240)
      // ↔ UE-sim (192.168.1.51) setup. With use_tcp:1 the daemon needs a
      // peer already listening; UDP (use_tcp:0) is more forgiving for
      // the typical eNB-first / UE-sim-second startup order.
      const argMap = new Map<string, string>();
      for (const tok of (form.rfArgs ?? '').split(/[,;]/)) {
        const m = tok.match(/^\s*([a-zA-Z_]\w*)\s*=\s*(.+?)\s*$/);
        if (m) argMap.set(m[1].toLowerCase(), m[2].trim());
      }
      const useTcp = (() => {
        const v = argMap.get('use_tcp');
        return v === '1' ? 1 : 0;
      })();
      const multiThread = (() => {
        const v = argMap.get('multi_thread');
        return v === '1' ? 1 : 0;
      })();
      return `rf_driver: {
    name: "ip",
    clock: "master",
    clock_factor: 1,
    debug: 0,
    packet_size: 3958,
    use_tcp: ${useTcp},
    multi_thread: ${multiThread},
${portLines}
  },`;
    }
    return `rf_driver: {
    // enb.cfg: rf_driver.name — sdr / split / ip
    name: "${form.rfMode}",
    // enb.cfg: rf_driver.args — content is mode-specific (device path for sdr,
    // O-RAN fronthaul opts for split). The 'ip' mode does NOT use args
    // (handled above) — it wants per-port dst<N>/src<N>.
    args: "${form.rfArgs}",
    // enb.cfg: rf_driver.rx_antenna
    rx_antenna: "${form.rxAntenna}",
  },`;
  })();

  return `/* ${ratLabel} eNB Configuration
 * Generated: ${new Date().toISOString()}
 * Band: ${form.band} | BW: ${form.bandwidth} MHz | ${isTdd ? 'TDD' : 'FDD'}
 */

{
  // enb.cfg: log_options — all.level=<global> then per-layer overrides
  log_options: "${logOptions}",
  // enb.cfg: log_filename
  log_filename: "${form.logFilename || '/tmp/enb0.log'}",

  com_addr: "[::]:9001",

  ${rfDriverBlock}

  // enb.cfg: tx_gain — scalar (all paths) or array (one per antenna)
  tx_gain: ${formatGain(form.txGain)},
  // enb.cfg: rx_gain — same shape as tx_gain
  rx_gain: ${formatGain(form.rxGain)},

  mme_list: [
    {
      // enb.cfg: mme_list[].mme_addr
      mme_addr: "${form.mmeAddr}",
    },
  ],

  // enb.cfg: gtp_addr
  gtp_addr: "${form.gtpAddr}",
  // enb.cfg: enb_id
  enb_id: ${form.enbId},

${cellDefaultBlock}

  cell_list: [
${cellListBlock}
  ],

  nr_cell_list: [],
}
`;
}
