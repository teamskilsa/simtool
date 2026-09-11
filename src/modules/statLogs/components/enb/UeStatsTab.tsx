// UE tab — per-UE radio KPIs (eNB/gNB) or registrations (MME), as
// Simnovator's Statistics → UE.
//
// ue_get is polled only while this tab is open: a loaded callbox lists
// hundreds of UEs (319 on the dev callbox), which is far too heavy to fetch
// every second behind a hidden tab.
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Stat } from '@/components/ui/stat';
import { cn } from '@/lib/utils';
import {
  avgOf, coreUeRows, fmt, parseMessage, radioUeRows,
  type CoreUeRow, type ModuleKey, type RadioUeRow,
} from './statsModel';

const UE_POLL_MS = 3000;
const PAGE_SIZE = 50;

interface UeStatsTabProps {
  module: ModuleKey;
  isConnected: boolean;
  /** True while the UE tab is the visible one. */
  active: boolean;
  request: (msg: Record<string, unknown>) => Promise<any>;
}

type Col<R> = {
  key: string;
  label: string;
  numeric?: boolean;
  sort: (r: R) => number | string | undefined;
  render: (r: R) => React.ReactNode;
  tone?: 'dl' | 'ul';
};

const RADIO_COLS: Col<RadioUeRow>[] = [
  { key: 'rnti',     label: 'RNTI',       numeric: true, sort: r => Number(r.rnti), render: r => r.rnti ?? '—' },
  { key: 'ranUeId',  label: 'RAN UE ID',  numeric: true, sort: r => r.ranUeId, render: r => r.ranUeId ?? '—' },
  { key: 'coreUeId', label: 'Core UE ID', numeric: true, sort: r => r.coreUeId, render: r => r.coreUeId ?? '—' },
  { key: 'cellId',   label: 'Cell',       numeric: true, sort: r => r.cellId, render: r => r.cellId ?? '—' },
  { key: 'caCells',  label: 'CA',         numeric: true, sort: r => r.caCells, render: r => r.caCells },
  { key: 'dlMbps',   label: 'DL Mbps',    numeric: true, sort: r => r.dlMbps, render: r => fmt(r.dlMbps, 2), tone: 'dl' },
  { key: 'dlMcs',    label: 'DL MCS',     numeric: true, sort: r => r.dlMcs, render: r => fmt(r.dlMcs, 1), tone: 'dl' },
  { key: 'cqi',      label: 'CQI',        numeric: true, sort: r => r.cqi, render: r => fmt(r.cqi, 0), tone: 'dl' },
  { key: 'ri',       label: 'RI',         numeric: true, sort: r => r.ri, render: r => fmt(r.ri, 0), tone: 'dl' },
  { key: 'dlRetx',   label: 'DL retx %',  numeric: true, sort: r => r.dlRetxPct, render: r => fmt(r.dlRetxPct, 2), tone: 'dl' },
  { key: 'ulMbps',   label: 'UL Mbps',    numeric: true, sort: r => r.ulMbps, render: r => fmt(r.ulMbps, 2), tone: 'ul' },
  { key: 'ulMcs',    label: 'UL MCS',     numeric: true, sort: r => r.ulMcs, render: r => fmt(r.ulMcs, 1), tone: 'ul' },
  { key: 'snr',      label: 'SNR dB',     numeric: true, sort: r => r.snr, render: r => fmt(r.snr, 1), tone: 'ul' },
  { key: 'epre',     label: 'EPRE dBm',   numeric: true, sort: r => r.epre, render: r => fmt(r.epre, 1), tone: 'ul' },
  { key: 'pathLoss', label: 'Path loss',  numeric: true, sort: r => r.pathLoss, render: r => fmt(r.pathLoss, 0), tone: 'ul' },
  { key: 'phr',      label: 'PHR',        numeric: true, sort: r => r.phr, render: r => fmt(r.phr, 0), tone: 'ul' },
  { key: 'ulRetx',   label: 'UL retx %',  numeric: true, sort: r => r.ulRetxPct, render: r => fmt(r.ulRetxPct, 2), tone: 'ul' },
];

const CORE_COLS: Col<CoreUeRow>[] = [
  { key: 'imsi', label: 'IMSI', sort: r => r.imsi, render: r => <span className="num">{r.imsi}</span> },
  { key: 'rat',  label: 'RAT',  sort: r => r.rat, render: r => r.rat },
  {
    key: 'registered', label: 'Registered', sort: r => (r.registered ? 1 : 0),
    render: r => (r.registered === undefined ? '—' : r.registered ? 'Yes' : 'No'),
  },
  { key: 'tac',  label: 'TAC',  numeric: true, sort: r => r.tac, render: r => r.tac ?? '—' },
  { key: 'plmn', label: 'PLMN', sort: r => r.plmn, render: r => r.plmn ?? '—' },
];

const TH = 'whitespace-nowrap px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-label';

export function UeStatsTab({ module, isConnected, active, request }: UeStatsTabProps) {
  const [resp, setResp] = useState<any>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string>(module === 'mme' ? 'imsi' : 'dlMbps');
  const [sortDesc, setSortDesc] = useState(module !== 'mme');
  const [page, setPage] = useState(0);

  const supported = module === 'enb' || module === 'gnb' || module === 'mme';
  const isCore = module === 'mme';

  useEffect(() => {
    setResp(null);
    setUpdatedAt(null);
    setError(null);
    setPage(0);
    setSortKey(module === 'mme' ? 'imsi' : 'dlMbps');
    setSortDesc(module !== 'mme');
  }, [module]);

  useEffect(() => {
    if (!active || !isConnected || !supported) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const raw = await request(isCore ? { message: 'ue_get' } : { message: 'ue_get', stats: true });
        if (cancelled) return;
        setResp(parseMessage(raw));
        setUpdatedAt(Date.now());
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'ue_get failed');
      }
    };
    tick();
    const id = setInterval(tick, UE_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [active, isConnected, supported, isCore, request]);

  const radioRows = useMemo(() => (isCore ? [] : radioUeRows(resp)), [resp, isCore]);
  const coreRows = useMemo(() => (isCore ? coreUeRows(resp) : []), [resp, isCore]);

  if (!supported) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Per-UE statistics come from an eNB, gNB or MME remote API. Pick one of those modules.
      </Card>
    );
  }
  if (!isConnected && !resp) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Connect to a system to list its UEs.
      </Card>
    );
  }

  return isCore ? (
    <UeTable
      rows={coreRows}
      cols={CORE_COLS}
      match={(r, q) => r.imsi.includes(q) || String(r.plmn ?? '').includes(q)}
      placeholder="Filter by IMSI or PLMN"
      summary={
        <>
          <Stat label="UEs" value={fmt(coreRows.length, 0)} />
          <Stat label="Registered" value={fmt(coreRows.filter(r => r.registered).length, 0)} />
        </>
      }
      {...{ query, setQuery, sortKey, setSortKey, sortDesc, setSortDesc, page, setPage, updatedAt, error }}
    />
  ) : (
    <UeTable
      rows={radioRows}
      cols={RADIO_COLS}
      match={(r, q) =>
        [r.rnti, r.ranUeId, r.coreUeId].some(v => v !== undefined && String(v).includes(q))}
      placeholder="Filter by RNTI or UE ID"
      summary={
        <>
          <Stat label="UEs" value={fmt(radioRows.length, 0)} />
          <Stat label="Total DL" value={fmt(radioRows.reduce((a, r) => a + r.dlMbps, 0), 1)} unit="Mbps" />
          <Stat label="Avg CQI" value={fmt(avgOf(radioRows.map(r => r.cqi)), 1)} />
          <Stat label="Avg DL MCS" value={fmt(avgOf(radioRows.map(r => r.dlMcs)), 1)} />
          <Stat label="Avg SNR" value={fmt(avgOf(radioRows.map(r => r.snr)), 1)} unit="dB" />
        </>
      }
      {...{ query, setQuery, sortKey, setSortKey, sortDesc, setSortDesc, page, setPage, updatedAt, error }}
    />
  );
}

interface UeTableProps<R extends { key: string }> {
  rows: R[];
  cols: Col<R>[];
  match: (r: R, q: string) => boolean;
  placeholder: string;
  summary: React.ReactNode;
  query: string; setQuery: (q: string) => void;
  sortKey: string; setSortKey: (k: string) => void;
  sortDesc: boolean; setSortDesc: (d: boolean) => void;
  page: number; setPage: (p: number) => void;
  updatedAt: number | null;
  error: string | null;
}

function UeTable<R extends { key: string }>({
  rows, cols, match, placeholder, summary,
  query, setQuery, sortKey, setSortKey, sortDesc, setSortDesc, page, setPage, updatedAt, error,
}: UeTableProps<R>) {
  const filtered = useMemo(() => {
    const q = query.trim();
    const base = q ? rows.filter(r => match(r, q)) : rows;
    const col = cols.find(c => c.key === sortKey);
    if (!col) return base;
    return [...base].sort((a, b) => {
      const va = col.sort(a), vb = col.sort(b);
      // Missing values sort last in either direction.
      if (va === undefined || (typeof va === 'number' && Number.isNaN(va))) return 1;
      if (vb === undefined || (typeof vb === 'number' && Number.isNaN(vb))) return -1;
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDesc ? -cmp : cmp;
    });
  }, [rows, cols, match, query, sortKey, sortDesc]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const onSort = (key: string) => {
    if (key === sortKey) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
    setPage(0);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{summary}</div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(0); }}
              placeholder={placeholder}
              className="h-8 w-60 pl-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {error ? <span className="text-destructive">{error}</span> : null}
            <span className="num">
              {filtered.length} UE{filtered.length === 1 ? '' : 's'}
              {updatedAt ? ` · updated ${new Date(updatedAt).toLocaleTimeString()}` : ''}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="num px-1">{current + 1}/{pages}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr className="border-b border-border">
                {cols.map(c => {
                  const sorted = c.key === sortKey;
                  return (
                    <th
                      key={c.key}
                      className={cn(
                        TH,
                        c.numeric ? 'text-right' : 'text-left',
                        c.tone === 'dl' ? 'text-brand-orange-700 dark:text-brand-orange-400'
                          : c.tone === 'ul' ? 'text-brand-teal-600 dark:text-brand-teal-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSort(c.key)}
                        className={cn('inline-flex items-center gap-1 hover:text-foreground', c.numeric && 'flex-row-reverse')}
                      >
                        {c.label}
                        {sorted ? (sortDesc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={cols.length} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {rows.length === 0 ? 'No UEs reported yet.' : 'No UEs match that filter.'}
                  </td>
                </tr>
              ) : (
                visible.map(r => (
                  <tr key={r.key} className="border-b border-border last:border-0 hover:bg-accent/60">
                    {cols.map(c => (
                      <td
                        key={c.key}
                        className={cn('whitespace-nowrap px-3 py-1.5', c.numeric ? 'num text-right' : 'text-left')}
                      >
                        {c.render(r)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
