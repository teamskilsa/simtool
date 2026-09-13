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
import { InfoHint } from '../InfoHint';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { SectionToolbar } from './SectionToolbar';
import { RfPortsGroup } from './RfPortsGroup';
import { BoxedSection } from '../BoxedSection';
import { Split72Fields } from './Split72Fields';
import type { NRFormState } from '../constants';
import { defaultRfArgs, rfArgsHint, parseRfArgs, setRfArg, type RfMode } from '../rfDefaults';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; bare?: boolean; }

export function RFSection({ form, onChange, bare }: Props) {
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
      <BoxedSection
        bare={bare}
        title="RF Driver"
        hint="Radio frontend selection. The fields below change with the chosen mode."
        action={
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={resetArgs} title="Reset to defaults for current mode">
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
            <SectionToolbar type="rf" currentData={currentRf} onLoad={handleLoad} />
          </div>
        }
      >
        <div className="cfg-field-grid">
          <Field inline
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
            <Field inline
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
            <Field inline
              label="Device Path"
              hint={<InfoHint>Emitted as <code className="font-mono">rf_driver.args</code>. {rfArgsHint('sdr')}</InfoHint>}
              value={form.rfArgs}
              onChange={v => onChange('rfArgs', v)}
              placeholder={defaultRfArgs('sdr', form.nAntennaDl)}
            />
          )}

          {form.rfMode === 'split' && (
            <Split72Fields rfArgs={form.rfArgs} onChange={v => onChange('rfArgs', v)} />
          )}

          {form.rfMode === 'ip' && (
            <>
              <div className="cfg-field-grid">
                <Field inline
                  label="TX Address"
                  value={parseRfArgs(form.rfArgs).tx_addr || ''}
                  onChange={v => onChange('rfArgs', setRfArg(form.rfArgs, 'tx_addr', v))}
                  placeholder="tcp://127.0.0.1:2000"
                />
                <Field inline
                  label="RX Address"
                  value={parseRfArgs(form.rfArgs).rx_addr || ''}
                  onChange={v => onChange('rfArgs', setRfArg(form.rfArgs, 'rx_addr', v))}
                  placeholder="tcp://127.0.0.1:2001"
                />
              </div>
              {/* trx_ip transport / threading toggles. These map to
                  rf_driver.use_tcp and rf_driver.multi_thread in the
                  emitted cfg. UDP + single-thread (0/0) is the default
                  that worked end-to-end on the user's callbox. */}
              <div className="cfg-field-grid mt-4">
                <Field inline
                  label="Transport (rf_driver.use_tcp)"
                  value={parseRfArgs(form.rfArgs).use_tcp ?? '0'}
                  onChange={v => onChange('rfArgs', setRfArg(form.rfArgs, 'use_tcp', v))}
                  type="select"
                  options={[
                    { value: '0', label: 'UDP (use_tcp=0) — default, eNB-first startup OK' },
                    { value: '1', label: 'TCP (use_tcp=1) — peer must be listening first' },
                  ]}
                />
                <Field inline
                  label="Threading (rf_driver.multi_thread)"
                  value={parseRfArgs(form.rfArgs).multi_thread ?? '0'}
                  onChange={v => onChange('rfArgs', setRfArg(form.rfArgs, 'multi_thread', v))}
                  type="select"
                  options={[
                    { value: '0', label: 'Single-thread (multi_thread=0) — default' },
                    { value: '1', label: 'Multi-thread (multi_thread=1) — per-port worker' },
                  ]}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">{rfArgsHint('ip')}</p>
            </>
          )}
        </div>
      </BoxedSection>

      <RfPortsGroup
        ports={form.rfPorts ?? []}
        cellNames={(form.cells ?? []).map(c => c.name)}
        showEmpty={form.fr2 === 1}
        hint="cfg root: rf_ports[]. FR2 needs an external frequency translator; these are its DL/UL frequencies per port. Blank ports emit as {} and only declare that the port exists."
        onChange={ports => onChange('rfPorts', ports)}
      />
    </div>
  );
}
