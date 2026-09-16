// Step 1 — Cell.
//
// Top row: Product · RAT Type · Carrier Aggregation · Mobility (test-wide).
// Then one chip per cell and the cell's own form in three columns, laid
// out as Simnovator does: identity on the left (type, duplex, NTN, band,
// ARFCN, bandwidth, SCS), radio on the right (RF card, antennas, gains).
'use client';

import { InfoHint } from '@/modules/testConfig/components/ConfigBuilder/InfoHint';
import { Field } from '@/modules/testConfig/components/ConfigBuilder/sections/Field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GroupChips } from '../GroupChips';
import { LTE_BANDS, NR_BANDS, RF_CARDS, makeCell } from '../../defaults';
import type { CellConfig, CellStepData, RatType, Scs } from '../../types';

interface Props {
  data: CellStepData;
  activeIdx: number;
  onActiveChange: (i: number) => void;
  onChange: (next: CellStepData) => void;
  /** Called when RAT changes so the Subscriber step can re-seed release/category. */
  onRatChange?: (rat: RatType) => void;
}

const SCS_OPTIONS: Scs[] = [15, 30, 60, 120];

function resizeGains(list: number[], n: number, fill: number): number[] {
  const out = list.slice(0, n);
  while (out.length < n) out.push(out[out.length - 1] ?? fill);
  return out;
}

export function CellStep({ data, activeIdx, onActiveChange, onChange, onRatChange }: Props) {
  const isNr = data.ratType === '5G:SA';
  const cell = data.cells[activeIdx] ?? data.cells[0];

  const patchCell = (patch: Partial<CellConfig>) => {
    onChange({ ...data, cells: data.cells.map((c, i) => (i === activeIdx ? { ...c, ...patch } : c)) });
  };

  const setRat = (rat: RatType) => {
    // Cells are re-seeded — an n78/100 MHz cell means nothing to a 4G UE.
    onChange({ ...data, ratType: rat, cells: data.cells.map((c, i) => makeCell(i, rat, { rfCard: c.rfCard })) });
    onRatChange?.(rat);
  };

  const setBand = (band: string) => {
    if (isNr) {
      const info = NR_BANDS.find(b => b.band === band);
      if (!info) return patchCell({ band });
      patchCell({
        band, duplexMode: info.duplex, dlNrArfcn: info.dlNrArfcn, ssbNrArfcn: info.ssbNrArfcn, scs: info.scs,
        bandwidth: info.bandwidths.includes(cell.bandwidth) ? cell.bandwidth : info.bandwidths[info.bandwidths.length - 1],
      });
    } else {
      const info = LTE_BANDS.find(b => b.band === band);
      if (!info) return patchCell({ band });
      patchCell({
        band, duplexMode: info.duplex, dlEarfcn: info.dlEarfcn,
        bandwidth: info.bandwidths.includes(cell.bandwidth) ? cell.bandwidth : info.bandwidths[info.bandwidths.length - 1],
      });
    }
  };

  const bandwidths = isNr
    ? NR_BANDS.find(b => b.band === cell.band)?.bandwidths ?? [10, 20, 40, 50, 60, 80, 100]
    : LTE_BANDS.find(b => b.band === cell.band)?.bandwidths ?? [5, 10, 15, 20];

  const addCell = () => {
    // Start the new cell on the first SDR device no existing cell uses: a
    // cell occupies one device per two DL antennas.
    const taken = new Set<number>();
    for (const c of data.cells) {
      const start = parseInt(c.rfCard, 10) || 0;
      for (let i = 0; i < Math.max(1, Math.ceil(c.dlAntennas / 2)); i++) taken.add(start + i);
    }
    let free = 0;
    while (taken.has(free)) free += 1;
    const next = makeCell(data.cells.length, data.ratType, {
      band: cell.band, bandwidth: cell.bandwidth, scs: cell.scs, duplexMode: cell.duplexMode,
      dlAntennas: cell.dlAntennas, ulAntennas: cell.ulAntennas,
      txGain: [...cell.txGain], rxGain: [...cell.rxGain],
      rfCard: String(free),
    });
    onChange({ ...data, cells: [...data.cells, next] });
    onActiveChange(data.cells.length);
  };

  const removeCell = (idx: number) => {
    if (data.cells.length <= 1) return;
    const cells = data.cells.filter((_, i) => i !== idx).map((c, i) => ({ ...c, id: i }));
    onChange({ ...data, cells });
    onActiveChange(Math.max(0, Math.min(activeIdx, cells.length - 1)));
  };

  return (
    <div className="space-y-5">
      {/* Test-wide row */}
      <div className="cfg-field-grid pb-4 border-b border-border">
        <Field label="Product" value={data.product} onChange={() => {}} disabled />
        <Field
          label="RAT Type" required type="select" value={data.ratType}
          options={[{ value: '5G:SA', label: '5G:SA' }, { value: '4G', label: '4G (LTE)' }]}
          onChange={v => setRat(v as RatType)}
        />
        <Field
          label="Carrier Aggregation" type="select" value={data.carrierAggregation ? 'True' : 'False'}
          options={[{ value: 'False', label: 'False' }, { value: 'True', label: 'True' }]}
          onChange={v => onChange({ ...data, carrierAggregation: v === 'True' })}
          hint={<InfoHint>Recorded on the test case. A UE simulator follows the CA configuration the gNB signals; add a second cell below for the SCell.</InfoHint>}
        />
        <Field
          label="Mobility" type="select" value={data.mobility ? 'True' : 'False'}
          options={[{ value: 'False', label: 'False' }, { value: 'True', label: 'True' }]}
          onChange={v => onChange({ ...data, mobility: v === 'True' })}
          hint={<InfoHint>Turns on the channel simulator and the Mobility step (positions, speed, fading model).</InfoHint>}
        />
      </div>

      <GroupChips
        label="Cell"
        count={data.cells.length}
        active={activeIdx}
        onSelect={onActiveChange}
        onAdd={addCell}
        onRemove={removeCell}
        max={4}
        detail={i => (isNr ? data.cells[i].band : `B${data.cells[i].band}`)}
      />

      <div className="wizard-cols">
        {/* Left column — identity */}
        <div className="space-y-3">
          <Field label="Cell Type" required value={isNr ? '5G' : '4G'} onChange={() => {}} disabled />
          <Field
            label="Duplex Mode" required type="select" value={cell.duplexMode}
            options={[{ value: 'TDD', label: 'TDD' }, { value: 'FDD', label: 'FDD' }]}
            onChange={v => patchCell({ duplexMode: v })}
          />
          <Field
            label="NTN" type="select" value={cell.ntn ? 'True' : 'False'}
            options={[{ value: 'False', label: 'False' }, { value: 'True', label: 'True' }]}
            onChange={v => patchCell({ ntn: v === 'True' })}
            hint={<InfoHint>Non-terrestrial network cell. Recorded on the test case for the report; timing follows what the cell broadcasts.</InfoHint>}
          />
          <Field
            label="Band" required type="select" value={cell.band}
            options={(isNr ? NR_BANDS : LTE_BANDS).map(b => ({ value: b.band, label: isNr ? b.band : `Band ${b.band}` }))}
            onChange={setBand}
            hint={<InfoHint>Picking a band seeds the ARFCN, duplex mode and SCS with that band's usual values. Edit them below if the cell under test differs.</InfoHint>}
          />

          {isNr ? (
            <div className="rounded-md bg-muted/40 px-3 py-2 space-y-2">
              <div className="text-xs font-semibold text-foreground">NRARFCN</div>
              <Field
                label="DL-NR-ARFCN" required type="number" value={cell.dlNrArfcn} min={0} max={3279165}
                onChange={v => patchCell({ dlNrArfcn: v })}
                hint={<InfoHint>Centre of the carrier. Must match the gNB's dl_nr_arfcn.</InfoHint>}
              />
              <Field
                label="SSB NR-ARFCN" required type="number" value={cell.ssbNrArfcn} min={0} max={3279165}
                onChange={v => patchCell({ ssbNrArfcn: v })}
              />
            </div>
          ) : (
            <Field
              label="DL EARFCN" required type="number" value={cell.dlEarfcn} min={0} max={70000}
              onChange={v => patchCell({ dlEarfcn: v })}
            />
          )}

          <Field
            label="Bandwidth (MHz)" required type="select" value={cell.bandwidth}
            options={bandwidths.map(b => ({ value: b, label: String(b) }))}
            onChange={v => patchCell({ bandwidth: Number(v) })}
          />
          {isNr && (
            <Field
              label="SCS (KHz)" required type="select" value={cell.scs}
              options={SCS_OPTIONS.map(s => ({ value: s, label: String(s) }))}
              onChange={v => patchCell({ scs: Number(v) as Scs })}
              hint={<InfoHint>Subcarrier spacing. 30 kHz for FR1 TDD bands, 15 kHz for FDD, 120 kHz for FR2.</InfoHint>}
            />
          )}
        </div>

        {/* Right column — radio */}
        <div className="space-y-3">
          <Field
            label="RF Card" required type="select" value={cell.rfCard}
            options={RF_CARDS.map(r => ({ value: r, label: r }))}
            onChange={v => patchCell({ rfCard: v })}
            hint={<InfoHint>The SDR device this cell starts on. One device carries two antennas, so this cell uses {Math.max(1, Math.ceil(cell.dlAntennas / 2))} device(s) from /dev/sdr{cell.rfCard}. Every device in use becomes a devN entry in rf_driver.args.</InfoHint>}
          />

          <div className="rounded-md bg-muted/40 px-3 py-2 space-y-2">
            <div className="text-xs font-semibold text-foreground">Antenna Configuration</div>
            <Field
              label="DL Antennas" required type="select" value={cell.dlAntennas}
              options={[1, 2, 4].map(n => ({ value: n, label: String(n) }))}
              onChange={v => {
                const n = Number(v) as 1 | 2 | 4;
                patchCell({ dlAntennas: n, rxGain: resizeGains(cell.rxGain, n, 10) });
              }}
            />
            <Field
              label="UL Antennas" required type="select" value={cell.ulAntennas}
              options={[1, 2].map(n => ({ value: n, label: String(n) }))}
              onChange={v => {
                const n = Number(v) as 1 | 2;
                patchCell({ ulAntennas: n, txGain: resizeGains(cell.txGain, n, 80) });
              }}
            />
          </div>

          <GainRow
            label="Tx Gain (dB)"
            values={cell.txGain}
            hint="One value per UL antenna (the UE transmits on UL). Written to tx_gain."
            onChange={txGain => patchCell({ txGain })}
          />
          <GainRow
            label="Rx Gain (dB)"
            values={cell.rxGain}
            hint="One value per DL antenna (the UE receives on DL). Written to rx_gain."
            onChange={rxGain => patchCell({ rxGain })}
          />
        </div>
      </div>
    </div>
  );
}

function GainRow({ label, values, hint, onChange }: {
  label: string; values: number[]; hint: string; onChange: (v: number[]) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
      <Label className="text-xs text-muted-foreground w-[116px] shrink-0 flex items-center gap-1">
        <span>{label}<span className="text-destructive ml-0.5">*</span></span>
        <InfoHint>{hint}</InfoHint>
      </Label>
      <div className="flex items-center gap-2 flex-wrap">
        {values.map((v, i) => (
          <Input
            key={i}
            type="number"
            className="h-8 w-16 text-sm"
            value={v}
            min={0}
            max={120}
            onChange={e => {
              const next = [...values];
              next[i] = parseFloat(e.target.value) || 0;
              onChange(next);
            }}
          />
        ))}
      </div>
    </div>
  );
}
