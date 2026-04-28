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

  return (
    <div className="space-y-4">
      <BoxedSection title="Band & Frequency" subtitle={isFR2 ? 'FR2 mmWave bands' : 'FR1 sub-6 GHz bands'}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Band" value={form.band} onChange={handleBandChange} type="select" options={bandOpts} />
          <Field label="Bandwidth (MHz)" value={form.nrBandwidth} onChange={v => onChange('nrBandwidth', v)} type="select" options={bwOpts} />
          <Field label="Subcarrier Spacing" value={form.subcarrierSpacing} onChange={v => onChange('subcarrierSpacing', v)} type="select" options={SCS_OPTIONS} />
        </div>
        <div className="grid grid-cols-1 gap-4 mt-3">
          <Field label="DL NR-ARFCN" value={form.dlNrArfcn} onChange={v => onChange('dlNrArfcn', v)} type="number" min={0} max={3279165} />
        </div>
      </BoxedSection>
    </div>
  );
}
