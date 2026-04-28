// RF Driver — mode + mode-specific args. Antenna count and TX/RX gain live
// in the Antennas section.
//
// Modes:
//   sdr     — direct USRP / Amarisoft SDR. args = device path(s).
//   split   — O-RAN 7.2 fronthaul (DU side). args = vlan_id, if_name, BFP, ...
//   ip      — ZMQ-style IP RF. args = tx_addr/rx_addr socket pair.
import { Field } from './Field';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { SectionToolbar } from './SectionToolbar';
import { BoxedSection } from '../BoxedSection';
import type { NRFormState } from '../constants';
import { defaultRfArgs, rfArgsHint, type RfMode } from '../rfDefaults';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function RFSection({ form, onChange }: Props) {
  const currentRf = {
    rfMode: form.rfMode, rfArgs: form.rfArgs, rxAntenna: form.rxAntenna,
  };
  const handleLoad = (data: any, _name?: string) => {
    Object.entries(data).forEach(([k, v]) => onChange(k, v));
  };

  // Switching mode auto-fills the args field with sensible defaults for the
  // new mode (SDR device, ORAN fronthaul, ZMQ socket pair).
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
        subtitle="Radio frontend selection. Args content is mode-specific."
        action={
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={resetArgs} title="Reset args to defaults for current mode">
            <RotateCcw className="w-3 h-3" />
            Reset args
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

        <div className="mt-3">
          <Field
            label="rf_driver.args"
            value={form.rfArgs}
            onChange={v => onChange('rfArgs', v)}
            placeholder={defaultRfArgs(form.rfMode as RfMode, form.nAntennaDl)}
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">{rfArgsHint(form.rfMode as RfMode)}</p>
        </div>
      </BoxedSection>
    </div>
  );
}
