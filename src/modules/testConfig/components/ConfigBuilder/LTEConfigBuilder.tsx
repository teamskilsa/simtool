// LTE / NB-IoT / CAT-M1 config builder — mirror of NR builder:
//   Main tabs:   Cell  |  Layers  |  MME Info  |  Log Setting  |  Dependencies
//   Cell tab is a single merged page (Identity, Band, RF, optional IoT) with
//   BoxedSections grouped vertically — no sub-tabs.
//   Layers tab: Frequently Used / MAC / Power / Security
import { useState } from 'react';
import { TAB_LIST, TAB_TRIGGER, TAB_TRIGGER_ACTIVE, TAB_TRIGGER_IDLE, TAB_ICON } from '@/components/ui/tab-styles';

import {
  RadioTower, FileText, Layers, Server, Database,
  Antenna, Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Field } from './sections/Field';
import {
  LTE_BAND_OPTIONS, LTE_BW_OPTIONS, LTE_TDD_CONFIGS, LTE_TDD_BANDS,
  DEFAULT_LTE_EARFCN, NBIOT_BW_OPTIONS, CATM_BW_OPTIONS,
  type LTEFormState,
} from './lteConstants';
import { LogSection } from './sections/LogSection';
import { MmeInfoSectionLte } from './sections/MmeInfoSectionLte';
import { DependenciesSection } from './sections/DependenciesSection';
import { AntennaSectionLte } from './sections/AntennaSectionLte';
import { RfPortsGroup } from './sections/RfPortsGroup';
import { Split72Fields } from './sections/Split72Fields';
import {
  FrequentlyUsedLte, MacLte, PowerLte, SecurityLte,
} from './sections/lte-layers';
import { LTECellTabs } from './LTECellTabs';
import { BoxedSection } from './BoxedSection';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import type { ReferencedFile } from './cfgParser';
import { defaultRfArgs, rfArgsHint, parseRfArgs, setRfArg, type RfMode } from './rfDefaults';

// ── Cell Section — only the per-cell IDENTITY fields. Everything else
//   (PHICH, Cell Access, SIB1, Scheduler, HARQ) lives under the Layers tab;
//   PLMN / MME / eNB ID lives under the MME Info tab. Mirrors NR CellSection.
function CellSection({ form, onChange }: { form: LTEFormState; onChange: (k: string, v: any) => void }) {
  return (
    <BoxedSection title="Cell Identity" subtitle="enb.cfg: cell_list[].{cell_id, n_id_cell, tac, rf_port}">
      <div className="cfg-field-grid">
        <Field label="Cell ID" value={form.cellId} onChange={v => onChange('cellId', v)} type="number" min={0} max={255} />
        <Field label="PCI" value={form.pci} onChange={v => onChange('pci', v)} type="number" min={0} max={503} />
        <Field label="TAC" value={form.tac} onChange={v => onChange('tac', v)} type="number" min={0} max={65535} />
        <Field label="RF Port" value={form.rfPort} onChange={v => onChange('rfPort', v)} type="number" min={0} max={7} />
      </div>
    </BoxedSection>
  );
}

// ── Band Section ────────────────────────────────────────────────────────────
// LTE band selection determines the duplex mode (FDD vs TDD) implicitly via
// LTE_TDD_BANDS. TDD-specific fields appear only when a TDD band is picked.
function BandSection({ form, onChange, ratMode }: { form: LTEFormState; onChange: (k: string, v: any) => void; ratMode: string }) {
  const isTdd = LTE_TDD_BANDS.includes(form.band);
  const bwOptions = ratMode === 'nbiot' ? NBIOT_BW_OPTIONS : ratMode === 'catm' ? CATM_BW_OPTIONS : LTE_BW_OPTIONS;

  const handleBandChange = (band: number) => {
    onChange('band', band);
    onChange('dlEarfcn', DEFAULT_LTE_EARFCN[band] || 3100);
  };

  return (
    <div className="space-y-4">
      <BoxedSection
        title="Band & Frequency"
        subtitle="Band selection auto-determines FDD/TDD duplex mode"
        action={
          <div className="flex items-center gap-1.5">
            <Badge variant="outline">{isTdd ? 'TDD' : 'FDD'}</Badge>
            {ratMode === 'nbiot' && <Badge className="bg-orange-100 text-orange-700 border-orange-300">NB-IoT</Badge>}
            {ratMode === 'catm' && <Badge className="bg-cyan-100 text-cyan-700 border-cyan-300">CAT-M1</Badge>}
          </div>
        }
      >
        <div className="cfg-field-grid">
          <Field label="Band" value={form.band} onChange={handleBandChange} type="select" options={LTE_BAND_OPTIONS} />
          <Field label="Bandwidth (MHz)" value={form.bandwidth} onChange={v => onChange('bandwidth', v)} type="select" options={bwOptions} />
          <Field label="DL EARFCN" value={form.dlEarfcn} onChange={v => onChange('dlEarfcn', v)} type="number" min={0} max={65535} />
        </div>
      </BoxedSection>

      {isTdd && (
        <BoxedSection title="TDD Pattern" subtitle="enb.cfg: cell_list[].{tdd_ul_dl_config, tdd_special_subframe_pattern}">
          <div className="cfg-field-grid">
            <Field label="TDD Config" value={form.tddConfig} onChange={v => onChange('tddConfig', v)} type="select" options={LTE_TDD_CONFIGS} />
            <Field label="Special Subframe" value={form.tddSpecialSubframe} onChange={v => onChange('tddSpecialSubframe', v)} type="number" min={0} max={9} />
          </div>
        </BoxedSection>
      )}
    </div>
  );
}

// ── RF Section — driver mode + mode-specific args.
//   Antenna count + TX/RX gain live in AntennaSectionLte (auto-bumped with
//   antenna count). Switching mode auto-fills args with sensible defaults.
function RFSection({ form, onChange }: { form: LTEFormState; onChange: (k: string, v: any) => void }) {
  const handleModeChange = (mode: RfMode) => {
    onChange('rfMode', mode);
    onChange('rfArgs', defaultRfArgs(mode, form.nAntennaDl));
  };
  const resetArgs = () => onChange('rfArgs', defaultRfArgs(form.rfMode as RfMode, form.nAntennaDl));

  return (
    <BoxedSection
      title="RF Driver"
      subtitle="enb.cfg: rf_driver.{name, args, rx_antenna}"
      action={
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={resetArgs} title="Reset args to defaults for current mode">
          <RotateCcw className="w-3 h-3" />
          Reset args
        </Button>
      }
    >
      <div className="cfg-field-grid">
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

      {/* Mode-specific body — same pattern as NR RFSection */}
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
            <div className="cfg-field-grid">
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
            {/* trx_ip transport / threading toggles. These map to
                rf_driver.use_tcp and rf_driver.multi_thread in the
                emitted cfg. UDP + single-thread (0/0) is the default
                that worked end-to-end on the user's callbox. */}
            <div className="cfg-field-grid mt-4">
              <Field
                label="Transport (rf_driver.use_tcp)"
                value={parseRfArgs(form.rfArgs).use_tcp ?? '0'}
                onChange={v => onChange('rfArgs', setRfArg(form.rfArgs, 'use_tcp', v))}
                type="select"
                options={[
                  { value: '0', label: 'UDP (use_tcp=0) — default, eNB-first startup OK' },
                  { value: '1', label: 'TCP (use_tcp=1) — peer must be listening first' },
                ]}
              />
              <Field
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
  );
}

// ── IoT Section (NB-IoT / CAT-M specific) ───────────────────────────────────
function IoTSection({ form, onChange, ratMode }: { form: LTEFormState; onChange: (k: string, v: any) => void; ratMode: string }) {
  if (ratMode === 'nbiot') {
    return (
      <BoxedSection
        title="NB-IoT"
        subtitle="enb.cfg: cell_list[].{nb_iot_mode, nb_iot_prb_index}"
      >
        <div className="cfg-field-grid">
          <Field label="Deployment Mode" value={form.nbIotMode} onChange={v => onChange('nbIotMode', v)} type="select"
            options={[
              { value: 'standalone', label: 'Standalone' },
              { value: 'inband', label: 'In-Band' },
              { value: 'guardband', label: 'Guard Band' },
            ]} />
          {form.nbIotMode !== 'standalone' && (
            <Field label="PRB Index" value={form.nbIotPrbIndex} onChange={v => onChange('nbIotPrbIndex', v)} type="number" min={0} max={49} />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          NB-IoT schema varies between Amarisoft release trains (<code>nb_cell_list</code> vs flags in <code>cell_list</code>).
        </p>
      </BoxedSection>
    );
  }
  if (ratMode === 'catm') {
    return (
      <BoxedSection
        title="CAT-M1 / eMTC"
        subtitle="enb.cfg: cell_list[].{ce_mode, max_repetitions}"
      >
        <div className="cfg-field-grid">
          <Field label="CE Mode" value={form.catMCeMode} onChange={v => onChange('catMCeMode', v)} type="select"
            options={[{ value: 'A', label: 'CE Mode A' }, { value: 'B', label: 'CE Mode B' }]} />
          <Field label="Max Repetitions" value={form.catMRepetitions} onChange={v => onChange('catMRepetitions', v)} type="number" min={1} max={2048} />
        </div>
      </BoxedSection>
    );
  }
  return null;
}

// ── Main LTE Config Builder ─────────────────────────────────────────────────
interface LTEConfigBuilderProps {
  form: LTEFormState;
  onChange: (key: string, value: any) => void;
  ratMode: 'lte' | 'nbiot' | 'catm';
  /** External files referenced by the current config (drb.cfg, sib*.asn, includes) */
  dependencies?: ReferencedFile[];
  /** Filenames already in storage — used to mark deps as available vs missing */
  availableFiles?: string[];
}

// Top-level tabs — mirror NR ConfigBuilder
const MAIN_TABS = [
  { id: 'cell',   label: 'Cell',         icon: RadioTower },
  { id: 'layers', label: 'Layers',       icon: Layers },
  { id: 'mme',    label: 'MME Info',     icon: Server },
  { id: 'log',    label: 'Log Setting',  icon: FileText },
  { id: 'deps',   label: 'Dependencies', icon: Database },
] as const;

export function LTEConfigBuilder({
  form, onChange, ratMode,
  dependencies = [], availableFiles = [],
}: LTEConfigBuilderProps) {
  const [mainTab, setMainTab] = useState<string>('cell');

  const renderMainContent = () => {
    switch (mainTab) {
      case 'cell':
        // Single merged Cell tab — Identity, Band & Frequency, Antennas+Gain,
        // RF Driver (mode-conditional), optional IoT specifics (NB-IoT / CAT-M).
        // Multi-cell strip only meaningful for plain LTE (CA), hidden for IoT.
        return (
          <div className="space-y-6">
            {ratMode === 'lte' && <LTECellTabs form={form} onChange={onChange} />}
            <CellSection form={form} onChange={onChange} />
            <BandSection form={form} onChange={onChange} ratMode={ratMode} />
            <AntennaSectionLte form={form} onChange={onChange} />
            <RFSection form={form} onChange={onChange} />
            <RfPortsGroup
              ports={form.rfPorts ?? []}
              cellNames={(form.cells ?? []).map(c => c.name)}
              showEmpty={false}
              hint="enb.cfg root: rf_ports[]. Shown because the imported config declares RF ports; they are written back as they were. Blank frequencies emit as {}."
              onChange={ports => onChange('rfPorts', ports)}
            />
            {(ratMode === 'nbiot' || ratMode === 'catm') && (
              <IoTSection form={form} onChange={onChange} ratMode={ratMode} />
            )}
          </div>
        );

      case 'layers':
        return (
          <div className="space-y-6">
            <div className="flex items-start gap-2 p-2.5 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground">
              <Info className={`${TAB_ICON} shrink-0 mt-px text-muted-foreground/70`} />
              <div>
                <span className="font-medium text-foreground">Shared via cell_default.</span>{' '}
                Everything on this page is emitted under{' '}
                <code className="font-mono">cell_default</code>, so every cell in this eNB
                inherits it. Amarisoft also allows per-cell overrides inside{' '}
                <code className="font-mono">cell_list[i]</code> — that's a future
                enhancement; today these are config-wide.
              </div>
            </div>

            <FrequentlyUsedLte form={form} onChange={onChange} />
            <MacLte form={form} onChange={onChange} />
            <PowerLte form={form} onChange={onChange} />
            <SecurityLte form={form} onChange={onChange} />
          </div>
        );

      case 'mme':
        return <MmeInfoSectionLte form={form} onChange={onChange} />;

      case 'log':
        return <LogSection form={form as any} onChange={onChange} />;

      case 'deps':
        return <DependenciesSection refs={dependencies} available={availableFiles} />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <nav className={TAB_LIST}>
        {MAIN_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = mainTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              className={`${TAB_TRIGGER} ${isActive ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER_IDLE}`}
            >
              <Icon className={TAB_ICON} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div>{renderMainContent()}</div>
    </div>
  );
}
