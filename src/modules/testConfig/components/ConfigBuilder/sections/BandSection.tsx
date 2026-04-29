import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from './Field';
import { BoxedSection } from '../BoxedSection';
import { BAND_OPTIONS, BANDWIDTH_OPTIONS, SCS_OPTIONS, DEFAULT_ARFCN } from '../constants';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function BandSection({ form, onChange }: Props) {
  const isFR2 = form.fr2 === 1;
  const bandOpts = isFR2 ? BAND_OPTIONS.FR2 : BAND_OPTIONS.FR1;
  const bwOpts = isFR2 ? BANDWIDTH_OPTIONS.FR2 : BANDWIDTH_OPTIONS.FR1;

  const handleBandChange = (band: number) => {
    onChange('band', band);
    const arfcn = DEFAULT_ARFCN[band] || (isFR2 ? 2079167 : 632628);
    onChange('dlNrArfcn', arfcn);
  };

  // SSB ARFCN (Amarisoft `gscn`) override:
  //   null  → checkbox off, field disabled, omitted from generated config.
  //          Amarisoft auto-derives the SSB position from band + DL NR-ARFCN.
  //   number → checkbox on, value emitted as `gscn: N`.
  const ssbOverrideOn = form.ssbArfcn !== null && form.ssbArfcn !== undefined;
  const toggleSsbOverride = (on: boolean) => {
    // Toggling on starts at 0 — the placeholder shows the user it's a
    // GSCN, and they edit it from there. Toggling off discards the value.
    onChange('ssbArfcn', on ? 0 : null);
  };

  return (
    <div className="space-y-4">
      <BoxedSection title="Band & Frequency" subtitle={isFR2 ? 'FR2 mmWave bands' : 'FR1 sub-6 GHz bands'}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Band" value={form.band} onChange={handleBandChange} type="select" options={bandOpts} />
          <Field label="Bandwidth (MHz)" value={form.nrBandwidth} onChange={v => onChange('nrBandwidth', v)} type="select" options={bwOpts} />
          <Field label="Subcarrier Spacing" value={form.subcarrierSpacing} onChange={v => onChange('subcarrierSpacing', v)} type="select" options={SCS_OPTIONS} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          {/* DL NR-ARFCN (DL carrier center) */}
          <Field
            label="DL NR-ARFCN"
            value={form.dlNrArfcn}
            onChange={v => onChange('dlNrArfcn', v)}
            type="number" min={0} max={3279165}
          />

          {/* SSB ARFCN override — checkbox-gated. Sits next to DL NR-ARFCN
              because they're frequency-domain neighbors and users compare
              them when matching a UE's expected sync raster. */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">
                SSB ARFCN
                <span className="ml-1.5 text-muted-foreground font-normal">
                  ({isFR2 ? 'GSCN, FR2' : 'GSCN'})
                </span>
              </Label>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={ssbOverrideOn}
                  onCheckedChange={(v) => toggleSsbOverride(v === true)}
                />
                Override
              </label>
            </div>
            <Input
              type="number"
              min={0}
              max={26639}
              placeholder={ssbOverrideOn ? 'Enter GSCN' : 'auto-derived from band + DL ARFCN'}
              disabled={!ssbOverrideOn}
              value={ssbOverrideOn ? (form.ssbArfcn as number) : ''}
              onChange={e => {
                const raw = e.target.value.trim();
                onChange('ssbArfcn', raw === '' ? 0 : Number(raw));
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Off → omitted from config (Amarisoft picks the SSB position).
              On → emits <code className="font-mono">gscn</code> in
              <code className="font-mono"> nr_cell_list[]</code>.
            </p>
          </div>
        </div>
      </BoxedSection>
    </div>
  );
}
