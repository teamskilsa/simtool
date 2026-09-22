// What a run looks like while it happens: where the UE is, how many carriers
// it has, how long each handover took and what the radio was carrying at that
// moment.
//
// Two sources, both about once a second:
//   • /api/scenarios/jobs — the run itself (steps, asserts, metrics); polled by
//     the Run panel, handed down here as `run`.
//   • /api/traffic/ues    — the live radio (PCell, SCells, DL/UL bitrate, CQI),
//     polled here while the run is live. Polling stops when the run ends.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Kicker, Stat } from '@/components/ui/stat';
import type { CellInfo, RunView } from '../types';
import { statsOf, verdictLine } from '../lib/cellLabel';
import { CellMap } from './CellMap';
import { RunTimeline, markersOf, type RadioSample } from './RunTimeline';

const MAX_SAMPLES = 900; // ~15 min at 1 Hz

interface RadioUeRow { mmeUeId?: number; cellId?: number; scellIds: number[]; dlBps: number; ulBps: number; cqi?: number }
interface UesResponse {
  success: boolean;
  ues?: { imsi: string; mmeUeId?: number }[];
  radio?: { ueCount: number; dlBps: number; ulBps: number; ues: RadioUeRow[] } | null;
}

/** Radio snapshot of the one UE this run is about (by MME id, else the only one). */
function radioOf(r: UesResponse, imsi: string): RadioUeRow | undefined {
  const rows = r.radio?.ues ?? [];
  if (!rows.length) return undefined;
  const mmeUeId = r.ues?.find(u => u.imsi === imsi)?.mmeUeId;
  return (mmeUeId !== undefined && rows.find(x => x.mmeUeId === mmeUeId)) || (rows.length === 1 ? rows[0] : undefined);
}

/** Gains the run has set so far, from the runner's own cell_gain log lines:
 *  "cell_gain 3 → -42 dB" (ramps) and "→ enb {…"message":"cell_gain"…}". */
export function gainsFromEvents(events: RunView['events']): Map<number, number> {
  const out = new Map<number, number>();
  for (const e of events) {
    const ramp = /^cell_gain (\d+) → (-?[\d.]+) dB$/.exec(e.msg);
    if (ramp) { out.set(Number(ramp[1]), Number(ramp[2])); continue; }
    if (!/"message"\s*:\s*"cell_gain"/.test(e.msg)) continue;
    const id = /"cell_id"\s*:\s*(\d+)/.exec(e.msg);
    const gain = /"gain"\s*:\s*(-?[\d.]+)/.exec(e.msg);
    if (id && gain) out.set(Number(id[1]), Number(gain[1]));
  }
  return out;
}

export interface LiveRunViewProps {
  run: RunView;
  live: boolean;
  host: string;
  enbPort?: number;
  mmePort?: number;
  /** Cells read before the run started, used until the run reports its own. */
  fallbackCells?: CellInfo[];
}

export function LiveRunView({ run, live, host, enbPort = 9001, mmePort = 9000, fallbackCells = [] }: LiveRunViewProps) {
  const [samples, setSamples] = useState<RadioSample[]>([]);
  const [radio, setRadio] = useState<RadioUeRow | null>(null);
  const runIdRef = useRef(run.id);
  const busy = useRef(false);

  // A new run starts a fresh chart.
  useEffect(() => {
    if (runIdRef.current !== run.id) { runIdRef.current = run.id; setSamples([]); setRadio(null); }
  }, [run.id]);

  useEffect(() => {
    if (!live || !host) return;
    let stopped = false;
    const tick = async () => {
      if (busy.current || stopped) return;
      busy.current = true;
      try {
        const r: UesResponse = await fetch('/api/traffic/ues', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ host, enbPort, mmePort }),
        }).then(x => x.json());
        if (stopped || !r.success) return;
        const me = radioOf(r, run.imsi);
        setRadio(me ?? null);
        setSamples(prev => [...prev, {
          t: Date.now(),
          dlMbps: (me?.dlBps ?? r.radio?.dlBps ?? 0) / 1e6,
          ulMbps: (me?.ulBps ?? r.radio?.ulBps ?? 0) / 1e6,
          cqi: me?.cqi,
          pcell: me?.cellId,
        }].slice(-MAX_SAMPLES));
      } catch { /* the callbox blinked; the next tick tries again */ }
      finally { busy.current = false; }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => { stopped = true; clearInterval(t); };
  }, [live, host, enbPort, mmePort, run.imsi]);

  const cells = run.cells.length ? run.cells : fallbackCells;
  const stats = useMemo(() => statsOf(run.metrics), [run.metrics]);
  const ho = stats.find(s => s.name === 'ho_complete_ms');
  const ca = stats.find(s => s.name === 'ca_rebuild_ms');
  const others = stats.filter(s => s.name !== 'ho_complete_ms' && s.name !== 'ca_rebuild_ms');
  const markers = useMemo(() => markersOf(run.metrics, run.assertResults), [run.metrics, run.assertResults]);

  // Gains the run changed (ramps, drive tests): the runner logs every
  // cell_gain it sends, so the map can grey a cell out as it is faded down.
  // Without those events the tiles fall back to the config gains read at
  // preflight.
  const gains = useMemo(() => gainsFromEvents(run.events), [run.events]);

  // Where the UE is: the live radio while running, otherwise the last handover
  // the run asserted ("PCell = cell 4, one context").
  const assertedPcell = useMemo(() => {
    for (let i = run.assertResults.length - 1; i >= 0; i--) {
      const m = /PCell\s*=\s*cell\s*(\d+)/i.exec(run.assertResults[i].label);
      if (m && run.assertResults[i].passed) return Number(m[1]);
    }
    return undefined;
  }, [run.assertResults]);
  const pcell = radio?.cellId ?? assertedPcell;
  const scells = radio?.scellIds ?? [];

  // The cell the run is hopping to right now, for the "→" highlight.
  const target = useMemo(() => {
    const running = [...run.steps].reverse().find(s => s.status === 'running' && /cell\s*(\d+)/i.test(s.label));
    const m = running && /cell\s*(\d+)/i.exec(running.label);
    return m ? Number(m[1]) : undefined;
  }, [run.steps]);

  const dl = samples.at(-1)?.dlMbps ?? 0;
  const ul = samples.at(-1)?.ulMbps ?? 0;

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <CellMap
          cells={cells}
          pcell={pcell}
          scells={scells}
          gains={gains}
          target={target}
          hint={live ? 'Waiting for the UE to show up on the radio…' : 'Run finished — last known position.'}
        />
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Handover time"
          value={ho ? Math.round(ho.avg) : '—'}
          unit={ho ? 'ms avg' : undefined}
          tone={ho ? 'good' : 'default'}
          hint={ho ? `min ${Math.round(ho.min)} · max ${Math.round(ho.max)} · ${ho.n} handover${ho.n === 1 ? '' : 's'}` : 'ho_complete_ms — none yet'}
        />
        <Stat
          label="Carrier rebuild"
          value={ca ? Math.round(ca.avg) : '—'}
          unit={ca ? 'ms avg' : undefined}
          tone={ca ? 'good' : 'default'}
          hint={ca ? `min ${Math.round(ca.min)} · max ${Math.round(ca.max)} · n=${ca.n}` : 'ca_rebuild_ms — none yet'}
        />
        <Stat
          label="Carriers now"
          value={pcell !== undefined ? 1 + scells.length : '—'}
          unit={pcell !== undefined ? (scells.length ? `on cell ${pcell}` : 'no CA') : undefined}
          hint={scells.length ? `PCell ${pcell} + SCells ${scells.join(', ')}` : pcell !== undefined ? `PCell ${pcell}` : 'UE not on the radio'}
        />
        <Stat
          label="Throughput"
          value={`${dl.toFixed(dl >= 10 ? 0 : 2)} / ${ul.toFixed(ul >= 10 ? 0 : 2)}`}
          unit="Mbps DL/UL"
          hint={radio?.cqi !== undefined ? `CQI ${radio.cqi}${samples.length ? ` · ${samples.length} samples` : ''}` : live ? 'polling the callbox…' : 'not sampled'}
        />
      </div>

      {others.length > 0 && (
        <Card className="p-3">
          <Kicker className="mb-2">Other timings</Kicker>
          <div className="flex flex-wrap gap-2">
            {others.map(m => (
              <div key={m.name} className="rounded border border-border px-3 py-1.5">
                <div className="font-mono text-[11px] text-muted-foreground">{m.name}</div>
                <div className="num text-sm font-semibold">
                  {m.avg.toFixed(m.unit === 'ms' ? 0 : 1)} <span className="text-[11px] font-normal text-muted-foreground">{m.unit} avg · n={m.n}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-3">
        <RunTimeline samples={samples} markers={markers} startedAt={run.startedAt} endedAt={run.endedAt} />
      </Card>

      {!live && (
        <Card className="flex items-start gap-2 p-3">
          <Activity className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
          <div className="text-sm">
            <Badge variant={run.state === 'passed' ? 'success' : run.state === 'aborted' ? 'warning' : 'destructive'} className="mr-2">{run.state}</Badge>
            {verdictLine(run)}
          </div>
        </Card>
      )}
    </div>
  );
}
