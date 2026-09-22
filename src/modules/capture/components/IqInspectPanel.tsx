// Quick look at a fetched IQ file: averaged power spectrum over a bounded
// slice and an RMS/peak power timeline. The DSP runs in /api/capture/inspect;
// this only draws the result.
//
// StatsCharts' TimeSeriesChart is not reused: its X axis is wall-clock time,
// and a spectrum needs frequency. Same palette and chrome, recharts directly.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/components/theme/context/theme-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Kicker, Stat } from '@/components/ui/stat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SERIES_COLORS } from '@/modules/statLogs/components/enb/StatsCharts';
import { fmtBytes, fmtHz } from '../lib/limits';
import type { InspectResult } from '../server/inspect.server';
import type { CaptureSummary } from '../server/store';

function useChrome() {
  const { mode } = useTheme();
  const dark = mode === 'dark';
  return {
    grid: dark ? '#14414f' : '#dbe7ec',
    axis: dark ? '#a0bbc4' : '#5c7480',
    tooltipBg: dark ? '#00303f' : '#ffffff',
    tooltipBorder: dark ? '#1d4c5b' : '#c2d5dd',
    text: dark ? '#f2f9fb' : '#00303f',
  };
}

const FFT_SIZES = [512, 1024, 2048, 4096, 8192];

export function IqInspectPanel({ capture, onClose }: { capture: CaptureSummary; onClose: () => void }) {
  const c = useChrome();
  const iqFiles = capture.files.filter(f => f.kind === 'iq');
  const [file, setFile] = useState(iqFiles[0]?.name ?? '');
  const [fftSize, setFftSize] = useState('2048');
  const [offset, setOffset] = useState('0');
  const [absolute, setAbsolute] = useState(true);
  const [result, setResult] = useState<InspectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ id: capture.id, file, fftSize, offsetSec: String(Number(offset) || 0), frames: '64' });
    const r = await fetch(`/api/capture/inspect?${q}`).then(x => x.json()).catch(e => ({ success: false, error: e.message }));
    if (r.success) setResult(r.result); else { setResult(null); setError(r.error ?? 'Inspect failed'); }
    setLoading(false);
  }, [capture.id, file, fftSize, offset]);

  useEffect(() => { run(); }, [file, fftSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = capture.files.find(f => f.name === file);
  const centre = result?.centerFreqHz;
  const useAbs = absolute && centre !== undefined;
  const toX = (f: number) => (useAbs ? (centre! + f) / 1e6 : f / 1e6);
  const spectrum = (result?.spectrum.points ?? []).map(p => ({ x: toX(p.f), p: Number(p.p.toFixed(2)) }));
  const timeline = (result?.timeline.points ?? []).map(p => ({ t: Number(p.t.toFixed(5)), rms: Number(p.rmsDb.toFixed(2)), peak: Number(p.peakDb.toFixed(2)) }));
  const peak = result?.spectrum.peaks[0];
  const significant = (result?.spectrum.peaks ?? []).filter(p => p.p >= (result?.spectrum.noiseFloorDb ?? 0) + 10);
  const tooltip = {
    contentStyle: { background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, borderRadius: 8, fontSize: 12, color: c.text },
    labelStyle: { color: c.axis, fontSize: 11 },
  };

  return (
    <Card accent className="space-y-3 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1 space-y-1">
          <Kicker>Inspect IQ · {capture.label}</Kicker>
          <Select value={file} onValueChange={setFile}>
            <SelectTrigger><SelectValue placeholder="Pick a file" /></SelectTrigger>
            <SelectContent>
              {iqFiles.map(f => (
                <SelectItem key={f.name} value={f.name}
                  description={`${f.direction?.toUpperCase() ?? ''} ch ${f.channel ?? '?'} · port ${f.rfPort ?? '?'} · ${fmtBytes(f.bytes)}${f.centerFreqHz ? ` · ${fmtHz(f.centerFreqHz)}` : ''}`}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-28 space-y-1">
          <Kicker>FFT size</Kicker>
          <Select value={fftSize} onValueChange={setFftSize}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{FFT_SIZES.map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-28 space-y-1">
          <Kicker>Offset s</Kicker>
          <Input type="number" min={0} step={0.001} className="num h-9" value={offset} onChange={e => setOffset(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" className="h-9" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}Analyse
        </Button>
        {centre !== undefined && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => setAbsolute(a => !a)}>
            {useAbs ? 'Show offset' : 'Show absolute'}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="ml-auto" onClick={onClose} aria-label="Close inspector"><X className="h-4 w-4" /></Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Sample rate" value={result.sampleRateKnown ? (result.sampleRate / 1e6).toFixed(2) : '?'} unit={result.sampleRateKnown ? 'Msps' : ''}
              hint={result.sampleRateKnown ? `${result.totalSamples.toLocaleString()} samples` : 'unknown — axis in bins'} />
            <Stat label="Duration" value={(result.durationSec * 1000).toFixed(1)} unit="ms" hint={meta ? fmtBytes(meta.bytes) : undefined} />
            <Stat label="Strongest peak" value={peak ? peak.p.toFixed(1) : '—'} unit="dBFS"
              hint={peak ? `${useAbs ? fmtHz(centre! + peak.f) : `${peak.f >= 0 ? '+' : ''}${fmtHz(peak.f)}`}` : undefined} />
            <Stat label="Noise floor (median bin)" value={result.spectrum.noiseFloorDb.toFixed(1)} unit="dBFS"
              hint={`${result.spectrum.frames} × ${result.spectrum.fftSize} FFT, ${fmtHz(result.spectrum.binHz)}/bin`} />
          </div>

          <Card className="p-2">
            <div className="flex items-center justify-between px-2 pt-1">
              <Kicker>Power spectrum ({useAbs ? 'MHz' : 'MHz offset from centre'}) · {(result.spectrum.spanSec * 1000).toFixed(1)} ms from {result.spectrum.offsetSec.toFixed(3)} s</Kicker>
              <span className="font-mono text-[10px] text-muted-foreground">dBFS</span>
            </div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spectrum} margin={{ top: 10, right: 12, bottom: 0, left: -6 }}>
                  <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} stroke={c.axis} tick={{ fontSize: 10, fill: c.axis }}
                    tickFormatter={(v: number) => v.toFixed(useAbs ? 1 : 2)} tickLine={false} axisLine={{ stroke: c.grid }} minTickGap={40} />
                  <YAxis stroke={c.axis} tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} width={48} domain={['auto', 'auto']} />
                  <Tooltip {...tooltip} labelFormatter={(v: any) => `${Number(v).toFixed(4)} MHz`} formatter={(v: any) => [`${v} dBFS`, 'Power']} />
                  {peak && <ReferenceLine x={toX(peak.f)} stroke={SERIES_COLORS[1]} strokeDasharray="4 4" />}
                  <Line type="linear" dataKey="p" name="Power" stroke={SERIES_COLORS[0]} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {significant.length > 0 && (
              <p className="px-2 pb-1 font-mono text-[11px] text-muted-foreground">
                Peaks ≥ 10 dB above the floor: {significant.map(p => `${useAbs ? fmtHz(centre! + p.f) : `${p.f >= 0 ? '+' : ''}${fmtHz(p.f)}`} ${p.p.toFixed(1)} dBFS`).join(' · ')}
              </p>
            )}
          </Card>

          <Card className="p-2">
            <div className="flex items-center justify-between px-2 pt-1">
              <Kicker>Power timeline · {result.timeline.points.length} blocks of {result.timeline.blockSamples} samples across the file</Kicker>
              <span className="font-mono text-[10px] text-muted-foreground">dBFS vs s</span>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline} margin={{ top: 10, right: 12, bottom: 0, left: -6 }}>
                  <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} stroke={c.axis} tick={{ fontSize: 10, fill: c.axis }}
                    tickFormatter={(v: number) => v.toFixed(3)} tickLine={false} axisLine={{ stroke: c.grid }} minTickGap={40} />
                  <YAxis stroke={c.axis} tick={{ fontSize: 10, fill: c.axis }} tickLine={false} axisLine={false} width={48} domain={['auto', 'auto']} />
                  <Tooltip {...tooltip} labelFormatter={(v: any) => `${Number(v).toFixed(4)} s`} formatter={(v: any, name: any) => [`${v} dBFS`, name]} />
                  <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, color: c.axis }} />
                  <Line type="linear" dataKey="peak" name="Peak" stroke={SERIES_COLORS[1]} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="linear" dataKey="rms" name="RMS" stroke={SERIES_COLORS[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </Card>
  );
}
