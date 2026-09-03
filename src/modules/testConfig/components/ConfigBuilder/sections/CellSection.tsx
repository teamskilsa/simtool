// NR Cell — identity + (conditional) TDD pattern. SSB Configuration moved
// to Layers/SSB; Band, Antenna, RF, Channel Sim render alongside in the
// merged Cell tab.
import { Label } from '@/components/ui/label';
import { Field } from './Field';
import { SectionToolbar } from './SectionToolbar';
import { BoxedSection } from '../BoxedSection';
import { InfoHint } from '../InfoHint';
import { getBandSpec } from '../constants';
import type { NRFormState } from '../constants';

/** A value the band determines — shown, not asked for. The "why" is a
 *  tooltip rather than a caption under every field. */
function DerivedField({ label, value, from }: { label: string; value: string; from: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium flex items-center gap-1.5">
        {label}
        <InfoHint>Determined by {from}. Change the band to change it.</InfoHint>
      </Label>
      <div className="h-9 flex items-center px-3 rounded-md border border-dashed border-border bg-muted/40">
        <span className="text-sm text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function CellSection({ form, onChange }: Props) {
  const currentCell = {
    cellId: form.cellId, nrTdd: form.nrTdd, fr2: form.fr2,
    band: form.band, nrBandwidth: form.nrBandwidth, subcarrierSpacing: form.subcarrierSpacing,
    dlNrArfcn: form.dlNrArfcn, ssbPosBitmap: form.ssbPosBitmap, tddPattern: form.tddPattern,
  };
  const handleLoad = (data: any, _name?: string) => {
    Object.entries(data).forEach(([k, v]) => onChange(k, v));
  };

  const spec = getBandSpec(form.band);
  const bandLabel = spec ? `band ${spec.label.split(' ')[0]}` : 'the selected band';

  return (
    <div className="space-y-3">
      <SectionToolbar type="cell" currentData={currentCell} onLoad={handleLoad} />

      {/* Mode and Frequency Range are properties of the band, not free
          choices — n78 *is* FR1 TDD. They were editable selects, which let
          the user emit impossible cells (n78 + FDD) and left them stale
          when the band changed. Now they read back what the band implies. */}
      <BoxedSection title="Identity" hint="Duplex mode and frequency range are properties of the band, so they are shown here rather than asked for. Change the band to change them.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Cell ID" value={form.cellId} onChange={v => onChange('cellId', v)} type="number" min={0} max={1007} />
          <DerivedField
            label="Mode"
            value={form.nrTdd === 1 ? 'TDD' : 'FDD'}
            from={bandLabel}
          />
          <DerivedField
            label="Frequency Range"
            value={form.fr2 === 1 ? 'FR2 (mmWave)' : 'FR1 (sub-6)'}
            from={bandLabel}
          />
        </div>
      </BoxedSection>

    </div>
  );
}
