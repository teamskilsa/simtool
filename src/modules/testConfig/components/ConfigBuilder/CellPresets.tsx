// One-click starting points for a cell.
//
// The unit people actually think in is "n78, 100 MHz, TDD, SCS 30" — the
// saved configs in this repo are literally named that way
// (nr-n78-100mhz-tdd-sa-scs30). Building that from an empty form means
// five separate picks, so offer it as a single chip and let the user
// adjust from there.
'use client';

import { Sparkles } from 'lucide-react';
import { getBandSpec } from './constants';
import type { NRFormState } from './constants';

interface Preset {
  id: string;
  label: string;
  detail: string;
  values: Partial<NRFormState>;
}

/** Band-derived fields (fr2, nrTdd, dlNrArfcn) are filled in on apply from
 *  NR_BANDS, so a preset only has to state what makes it distinctive. */
const PRESETS: Preset[] = [
  {
    id: 'n78-100-scs30',
    label: 'n78 · 100 MHz',
    detail: 'TDD · SCS 30 · 2×2 — the common sub-6 5G SA cell',
    values: { band: 78, nrBandwidth: 100, subcarrierSpacing: 30, nAntennaDl: 2, nAntennaUl: 2 },
  },
  {
    id: 'n78-20-scs30',
    label: 'n78 · 20 MHz',
    detail: 'TDD · SCS 30 · narrow carrier for low-throughput tests',
    values: { band: 78, nrBandwidth: 20, subcarrierSpacing: 30, nAntennaDl: 2, nAntennaUl: 2 },
  },
  {
    id: 'n41-100-scs30',
    label: 'n41 · 100 MHz',
    detail: 'TDD · SCS 30 · 2.5 GHz',
    values: { band: 41, nrBandwidth: 100, subcarrierSpacing: 30, nAntennaDl: 2, nAntennaUl: 2 },
  },
  {
    id: 'n7-20-fdd',
    label: 'n7 · 20 MHz',
    detail: 'FDD · SCS 15 · paired spectrum',
    values: { band: 7, nrBandwidth: 20, subcarrierSpacing: 15, nAntennaDl: 2, nAntennaUl: 2 },
  },
  {
    id: 'n258-200-fr2',
    label: 'n258 · 200 MHz',
    detail: 'FR2 mmWave · TDD · SCS 120',
    values: { band: 258, nrBandwidth: 200, subcarrierSpacing: 120, nAntennaDl: 2, nAntennaUl: 2 },
  },
];

interface Props {
  form: NRFormState;
  onChange: (key: string, value: any) => void;
}

export function CellPresets({ form, onChange }: Props) {
  const apply = (preset: Preset) => {
    Object.entries(preset.values).forEach(([k, v]) => onChange(k, v));
    // Keep the band-derived fields consistent with the same table the Band
    // selector uses, rather than duplicating them in every preset.
    const spec = getBandSpec(preset.values.band as number);
    if (spec) {
      onChange('fr2', spec.fr);
      onChange('nrTdd', spec.duplex);
      onChange('dlNrArfcn', spec.defaultArfcn);
    }
  };

  /** Highlight the preset matching the current form, if any. */
  const activeId = PRESETS.find(p =>
    p.values.band === form.band
    && p.values.nrBandwidth === form.nrBandwidth
    && p.values.subcarrierSpacing === form.subcarrierSpacing,
  )?.id;

  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
          Start from
        </span>
        <span className="text-xs text-muted-foreground">— then adjust anything below</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => {
          const active = p.id === activeId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => apply(p)}
              title={p.detail}
              className={
                'text-left px-3 py-1.5 rounded-lg border text-xs transition-colors '
                + (active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background hover:border-primary/40 hover:bg-muted')
              }
            >
              <span className="font-medium">{p.label}</span>
              {active && <span className="ml-1.5 text-[10px] opacity-70">current</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
