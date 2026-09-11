// Stats data model for the Global / Cell / UE views.
//
// Shapes are taken from a live callbox (2026-09-11), not from docs:
//   stats   → cells{id: dl_bitrate, ul_bitrate (bps), dl_use_avg|min|max (0..1),
//             ue_count_*, ue_active_count_*, ue_inactive_count_*, drb_count_*,
//             dl|ul_sched_users_*, dl|ul_tx, dl|ul_retx, dl|ul_err}, cpu,
//             duration, rf_ports
//   ue_get  → ue_list[]{rnti, ran_ue_id|enb_ue_id, amf_ue_id|mme_ue_id,
//             cells[]{cell_id, dl|ul_bitrate, dl|ul_mcs, cqi, ri, pusch_snr,
//             epre, ul_path_loss, ul_phr, dl|ul_tx, dl|ul_retx, dl|ul_err}}
//   ue_get on the MME → ue_list[]{imsi, rat_type, registered, tac, tac_plmn}
//
// Retransmission % is retx / tx over the reporting interval, per direction.

export type ModuleKey = 'enb' | 'gnb' | 'mme' | 'ims' | 'ue';

const num = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/** Remote-API responses arrive as objects or JSON strings depending on path. */
export function parseMessage(raw: unknown): any {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw ?? null;
}

/** '—' for anything that is not a real number, so gaps never render as 0. */
export function fmt(v: unknown, digits = 1): string {
  if (v === undefined || v === null || v === '') return '—';
  const x = Number(v);
  if (!Number.isFinite(x)) return '—';
  return x.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtDuration(sec: unknown): string {
  if (sec === undefined || sec === null) return '—';
  const s = Number(sec);
  if (!Number.isFinite(s)) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// ── Cells ────────────────────────────────────────────────────────────────────

export interface CellRow {
  id: string;
  dlMbps: number; ulMbps: number;
  dlPrbAvg: number; dlPrbMax: number;
  ulPrbAvg: number; ulPrbMax: number;
  ues: number; activeUes: number; inactiveUes: number; drbs: number;
  dlSched: number; ulSched: number;
  dlRetxPct: number; ulRetxPct: number;
  dlErr: number; ulErr: number;
}

export function cellRows(stats: any): CellRow[] {
  const cells = stats?.cells && typeof stats.cells === 'object' ? stats.cells : {};
  return Object.entries(cells as Record<string, any>).map(([id, c]) => ({
    id,
    dlMbps: num(c?.dl_bitrate) / 1e6,
    ulMbps: num(c?.ul_bitrate) / 1e6,
    dlPrbAvg: num(c?.dl_use_avg) * 100,
    dlPrbMax: num(c?.dl_use_max) * 100,
    ulPrbAvg: num(c?.ul_use_avg) * 100,
    ulPrbMax: num(c?.ul_use_max) * 100,
    ues: num(c?.ue_count_avg),
    activeUes: num(c?.ue_active_count_avg),
    inactiveUes: num(c?.ue_inactive_count_avg),
    drbs: num(c?.drb_count_avg),
    dlSched: num(c?.dl_sched_users_avg),
    ulSched: num(c?.ul_sched_users_avg),
    dlRetxPct: pct(num(c?.dl_retx), num(c?.dl_tx)),
    ulRetxPct: pct(num(c?.ul_retx), num(c?.ul_tx)),
    dlErr: num(c?.dl_err),
    ulErr: num(c?.ul_err),
  }));
}

// ── Time series (Global) ─────────────────────────────────────────────────────

export interface TimePoint {
  t: number;
  dlMbps: number; ulMbps: number;
  /** Mean PRB use across cells, %. */
  dlPrb: number; ulPrb: number;
  ues: number; activeUes: number;
  dlRetxPct: number; ulRetxPct: number;
  /** Per-cell throughput, keyed by cell id — charted as `cells.<id>.dlMbps`. */
  cells: Record<string, { dlMbps: number; ulMbps: number }>;
}

export function toTimePoint(stats: any, t = Date.now()): TimePoint {
  const rows = cellRows(stats);

  if (rows.length === 0) {
    // Older builds and wrapper APIs report top-level throughput instead of cells.
    return {
      t,
      dlMbps: num(stats?.throughput?.dl) / 1e6,
      ulMbps: num(stats?.throughput?.ul) / 1e6,
      dlPrb: num(stats?.prb_utilization?.dl) * 100,
      ulPrb: num(stats?.prb_utilization?.ul) * 100,
      ues: num(stats?.connected_ue_count),
      activeUes: num(stats?.active_ue_count),
      dlRetxPct: 0, ulRetxPct: 0,
      cells: {},
    };
  }

  let dlTx = 0, ulTx = 0, dlRetx = 0, ulRetx = 0;
  for (const c of Object.values(stats.cells as Record<string, any>)) {
    dlTx += num(c?.dl_tx); ulTx += num(c?.ul_tx);
    dlRetx += num(c?.dl_retx); ulRetx += num(c?.ul_retx);
  }
  const cells: TimePoint['cells'] = {};
  for (const r of rows) cells[r.id] = { dlMbps: r.dlMbps, ulMbps: r.ulMbps };
  const sum = (pick: (r: CellRow) => number) => rows.reduce((a, r) => a + pick(r), 0);

  return {
    t,
    dlMbps: sum(r => r.dlMbps),
    ulMbps: sum(r => r.ulMbps),
    dlPrb: sum(r => r.dlPrbAvg) / rows.length,
    ulPrb: sum(r => r.ulPrbAvg) / rows.length,
    ues: sum(r => r.ues),
    activeUes: sum(r => r.activeUes),
    dlRetxPct: pct(dlRetx, dlTx),
    ulRetxPct: pct(ulRetx, ulTx),
    cells,
  };
}

// ── UEs ──────────────────────────────────────────────────────────────────────

export interface RadioUeRow {
  key: string;
  rnti?: number | string;
  ranUeId?: number;
  coreUeId?: number;
  cellId?: number;
  /** Cells the UE is scheduled on (>1 = carrier aggregation). */
  caCells: number;
  dlMbps: number; ulMbps: number;
  dlMcs?: number; ulMcs?: number;
  cqi?: number; ri?: number;
  snr?: number; epre?: number; pathLoss?: number; phr?: number;
  dlRetxPct: number; ulRetxPct: number;
}

export function radioUeRows(resp: any): RadioUeRow[] {
  const list: any[] = Array.isArray(resp?.ue_list) ? resp.ue_list : [];
  return list.map((u, i) => {
    const cs: any[] = Array.isArray(u?.cells) ? u.cells : [];
    const c = cs[0] ?? {};
    const ranUeId = u?.ran_ue_id ?? u?.enb_ue_id;
    return {
      key: String(ranUeId ?? u?.rnti ?? i),
      rnti: u?.rnti,
      ranUeId,
      coreUeId: u?.amf_ue_id ?? u?.mme_ue_id,
      cellId: c.cell_id,
      caCells: cs.length,
      dlMbps: cs.reduce((a, x) => a + num(x?.dl_bitrate), 0) / 1e6,
      ulMbps: cs.reduce((a, x) => a + num(x?.ul_bitrate), 0) / 1e6,
      dlMcs: c.dl_mcs, ulMcs: c.ul_mcs,
      cqi: c.cqi, ri: c.ri,
      snr: c.pusch_snr, epre: c.epre, pathLoss: c.ul_path_loss, phr: c.ul_phr,
      dlRetxPct: pct(num(c.dl_retx), num(c.dl_tx)),
      ulRetxPct: pct(num(c.ul_retx), num(c.ul_tx)),
    };
  });
}

export interface CoreUeRow {
  key: string;
  imsi: string;
  rat: string;
  registered?: boolean;
  tac?: number;
  plmn?: string;
}

export function coreUeRows(resp: any): CoreUeRow[] {
  const list: any[] = Array.isArray(resp?.ue_list) ? resp.ue_list : [];
  return list.map((u, i) => ({
    key: String(u?.imsi ?? i),
    imsi: u?.imsi ?? '—',
    rat: u?.rat_type ?? '—',
    registered: u?.registered,
    tac: u?.tac,
    plmn: u?.tac_plmn ?? u?.plmn,
  }));
}

const avgOf = (vals: Array<number | undefined>) => {
  const xs = vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;
};
export { avgOf };
