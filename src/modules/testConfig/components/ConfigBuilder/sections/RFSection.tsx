// RF Driver — mode + mode-specific configuration.
//   sdr   : direct USRP / Amarisoft SDR. args = device path(s).
//   split : O-RAN 7.2 fronthaul (DU side). Structured fields per Amarisoft
//           docs: VLAN, NIC, IQ compression, c/u-plane MAC, c/u-plane port,
//           cells_rf_port_mapping. Composed into rf_driver.args on change.
//   ip    : ZMQ-style IP RF. tx_addr / rx_addr as tcp://HOST:PORT.
//
// rfArgs is the source-of-truth in form state; for Split mode the structured
// fields read/write specific keys via parseRfArgs/setRfArg helpers.
import { Field } from './Field';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { SectionToolbar } from './SectionToolbar';
import { BoxedSection } from '../BoxedSection';
import { Split72Fields } from './Split72Fields';
import type { NRFormState } from '../constants';
import { defaultRfArgs, rfArgsHint, parseRfArgs, setRfArg, type RfMode } from '../rfDefaults';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function RFSection({ form, onChange }: Props) {
  const currentRf = {
    rfMode: form.rfMode, rfArgs: form.rfArgs, rxAntenna: form.rxAntenna,
  };
  const handleLoad = (data: any, _name?: string) => {
    Object.entries(data).forEach(([k, v]) => onChange(k, v));
  };

  const handleModeChange = (mode: RfMode) => {
    onChange('rfMode', mode);
    onChange('rfArgs', defaultRfArgs(mode, form.nAntennaDl));
  };

  const resetArgs = () => onChange('rfArgs', defaultRfArgs(form.rfMode as RfMode, form.nAntennaDl));

  return (
    <div className="space-y-4">
      <SectionToolbar type="rf" currentData={currentRf} onLoad={handleLoad} />

      <BoxedSection
        title="RF Driver"
        subtitle="Radio frontend selection. Configuration depends on mode."
        action={
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={resetArgs} title="Reset to defaults for current mode">
            <RotateCcw className="w-3 h-3" />
            Reset
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="RF Mode"
            value={form.rfMode}
            onChange={(v: RfMode) => handleModeChange(v)}
            type="select"
            options={[
              { value: 'sdr',   label: 'SDR (direct radio)' },
              { value: 'split', label: 'Split 7.2 (O-RAN DU)' },
              { value: 'ip',    label: 'IP (ZMQ / sockets)' },
            ]}
          />
          {form.rfMode === 'sdr' && (
            <Field
              label="RX Antenna"
              value={form.rxAntenna}
              onChange={v => onChange('rxAntenna', v)}
              type="select"
              options={[{ value: 'rx', label: 'RX' }, { value: 'tx_rx', label: 'TX/RX' }]}
            />
          )}
        </div>

        {/* Mode-specific body */}
        <div className="mt-4">
          {form.rfMode === 'sdr' && (
            <>
              <Field
                label="Device Path (rf_driver.args)"
                value={form.rfArgs}
                onChange={v => onChange('rfArgs', v)}
                placeholder={defaultRfArgs('sdr', form.nAntennaDl)}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">{rfArgsHint('sdr')}</p>
            </>
          )}

          {form.rfMode === 'split' && (
            <Split72Fields rfArgs={form.rfArgs} onChange={v => onChange('rfArgs', v)} />
          )}

          {form.rfMode === 'ip' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="TX Address"
                  value={parseRfArgs(form.rfArgs).tx_addr || ''}
                  onChange={v => onChange('rfArgs', setRfArg(form.rfArgs, 'tx_addr', v))}
                  placeholder="tcp://127.0.0.1:2000"
                />
                <Field
                  label="RX Address"
                  value={parseRfArgs(form.rfArgs).rx_addr || ''}
                  onChange={v => onChange('rfArgs', setRfArg(form.rfArgs, 'rx_addr', v))}
                  placeholder="tcp://127.0.0.1:2001"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">{rfArgsHint('ip')}</p>
            </>
          )}
        </div>
      </BoxedSection>
    </div>
  );
}
