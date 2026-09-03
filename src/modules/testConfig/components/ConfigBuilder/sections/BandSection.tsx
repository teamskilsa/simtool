import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Field } from './Field';
import { BoxedSection } from '../BoxedSection';
import { NR_BANDS, getBandSpec, BANDWIDTH_OPTIONS, SCS_OPTIONS } from '../constants';
import type { NRFormState } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function BandSection({ form, onChange }: Props) {
  const spec = getBandSpec(form.band);
  const isFR2 = (spec?.fr ?? form.fr2) === 1;
  const bwOpts = isFR2 ? BANDWIDTH_OPTIONS.FR2 : BANDWIDTH_OPTIONS.FR1;

  // Only the subcarrier spacings 3GPP allows for this band. Previously every
  // SCS was offered for every band, so FR1 cells could be given 120 kHz.
  const scsOpts = spec
    ? SCS_OPTIONS.filter(o => spec.scs.includes(o.value as number))
    : SCS_OPTIONS;

  /**
   * Picking a band settles the frequency range, duplex mode and carrier in
   * one move — they are properties of the band, not independent choices.
   * Bandwidth and SCS are snapped back into range when the new band cannot
   * carry the current value (e.g. FR1 100 MHz -> FR2, or 30 kHz -> n257).
   */
  const handleBandChange = (band: number) => {
    const next = getBandSpec(band);
    onChange('band', band);
    if (!next) return;

    onChange('fr2', next.fr);
    onChange('nrTdd', next.duplex);
    onChange('dlNrArfcn', next.defaultArfcn);

    const bwList = next.fr === 1 ? BANDWIDTH_OPTIONS.FR2 : BANDWIDTH_OPTIONS.FR1;
    if (!bwList.some(o => o.value === form.nrBandwidth)) {
      onChange('nrBandwidth', next.fr === 1 ? 100 : 20);
    }
    if (!next.scs.includes(form.subcarrierSpacing)) {
      onChange('subcarrierSpacing', next.scs[0]);
    }
  };

  const fr1Bands = NR_BANDS.filter(b => b.fr === 0);
  const fr2Bands = NR_BANDS.filter(b => b.fr === 1);

  return (
    <div className="space-y-4">
      <BoxedSection
        title="Band & Frequency"
        subtitle="The band sets the frequency range, duplex mode and default carrier"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* One list of every band, grouped by range. The old UI split bands
              across an FR selector, so the user had to choose FR *before*
              the band and nothing corrected FR if they changed band later. */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Band</Label>
            <Select
              value={String(form.band)}
              onValueChange={(v) => handleBandChange(Number(v))}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select band" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>FR1 — sub-6 GHz</SelectLabel>
                  {fr1Bands.map(b => (
                    <SelectItem
                      key={b.value}
                      value={String(b.value)}
                      description={b.duplex === 1 ? 'TDD' : 'FDD'}
                    >
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>FR2 — mmWave</SelectLabel>
                  {fr2Bands.map(b => (
                    <SelectItem
                      key={b.value}
                      value={String(b.value)}
                      description="TDD"
                    >
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <Field
            label="Bandwidth (MHz)"
            value={form.nrBandwidth}
            onChange={v => onChange('nrBandwidth', v)}
            type="select"
            options={bwOpts}
          />
          <Field
            label="Subcarrier Spacing"
            value={form.subcarrierSpacing}
            onChange={v => onChange('subcarrierSpacing', v)}
            type="select"
            options={scsOpts}
          />
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
                  checked={form.ssbArfcn !== null && form.ssbArfcn !== undefined}
                  onCheckedChange={(v) => onChange('ssbArfcn', v === true ? 0 : null)}
                />
                Override
              </label>
            </div>
            <Input
              type="number"
              min={0}
              max={26639}
              placeholder={
                form.ssbArfcn !== null && form.ssbArfcn !== undefined
                  ? 'Enter GSCN'
                  : 'auto-derived from band + DL ARFCN'
              }
              disabled={form.ssbArfcn === null || form.ssbArfcn === undefined}
              value={
                form.ssbArfcn !== null && form.ssbArfcn !== undefined
                  ? (form.ssbArfcn as number)
                  : ''
              }
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
