// LTE / NB-IoT / CAT-M1 config builder — restructured to mirror the NR builder:
//   Main tabs:   Cell  |  Layers  |  MME Info  |  Log Setting
//   Inside Cell: Cell Info / Band / RF / (IoT — when nbiot/catm)
//   Inside Layers: Frequently Used / MAC / Power / Security
import { useState } from 'react';
import {
  RadioTower, Settings2, Wifi, FileText, Signal, Layers, Server,
  Zap, Gauge, Antenna, Lock,
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
import {
  FrequentlyUsedLte, MacLte, PowerLte, SecurityLte,
} from './sections/lte-layers';
import { LTECellTabs } from './LTECellTabs';
import { BoxedSection } from './BoxedSection';

// ── Cell Section — only the per-cell IDENTITY fields. Everything else
//   (PHICH, Cell Access, SIB1, Scheduler, HARQ) lives under the Layers tab;
//   PLMN / MME / eNB ID lives under the MME Info tab. Mirrors NR CellSection.
function CellSection({ form, onChange }: { form: LTEFormState; onChange: (k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <BoxedSection title="Cell Identity" subtitle="enb.cfg: cell_list[].{cell_id, n_id_cell, tac, rf_port}">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Cell ID" value={form.cellId} onChange={v => onChange('cellId', v)} type="number" min={0} max={255} />
          <Field label="PCI" value={form.pci} onChange={v => onChange('pci', v)} type="number" min={0} max={503} />
          <Field label="TAC" value={form.tac} onChange={v => onChange('tac', v)} type="number" min={0} max={65535} />
          <Field label="RF Port" value={form.rfPort} onChange={v => onChange('rfPort', v)} type="number" min={0} max={7} />
        </div>
      </BoxedSection>

      <p className="text-[11px] text-muted-foreground px-1">
        PLMN / MME address / eNB ID → <span className="font-medium">MME Info</span> tab •
        Cell access / SIB / Scheduler / HARQ / Power / Security → <span className="font-medium">Layers</span> tab
      </p>
    </div>
  );
}

// ── Band Section ────────────────────────────────────────────────────────────
function BandSection({ form, onChange, ratMode }: { form: LTEFormState; onChange: (k: string, v: any) => void; ratMode: string }) {
  const isTdd = LTE_TDD_BANDS.includes(form.band);
  const bwOptions = ratMode === 'nbiot' ? NBIOT_BW_OPTIONS : ratMode === 'catm' ? CATM_BW_OPTIONS : LTE_BW_OPTIONS;

  const handleBandChange = (band: number) => {
    onChange('band', band);
    onChange('dlEarfcn', DEFAULT_LTE_EARFCN[band] || 3100);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Band</h4>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Band" value={form.band} onChange={handleBandChange} type="select" options={LTE_BAND_OPTIONS} />
        {/* enb.cfg: cell_list[].bandwidth */}
        <Field label="Bandwidth" value={form.bandwidth} onChange={v => onChange('bandwidth', v)} type="select" options={bwOptions} />
        {/* enb.cfg: cell_list[].dl_earfcn */}
        <Field label="DL EARFCN" value={form.dlEarfcn} onChange={v => onChange('dlEarfcn', v)} type="number" min={0} max={65535} />
      </div>
      {isTdd && (
        <>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">TDD</h4>
          <div className="grid grid-cols-2 gap-3">
            {/* enb.cfg: cell_list[].tdd_ul_dl_config */}
            <Field label="TDD Config" value={form.tddConfig} onChange={v => onChange('tddConfig', v)} type="select" options={LTE_TDD_CONFIGS} />
            {/* enb.cfg: cell_list[].tdd_special_subframe_pattern */}
            <Field label="Special Subframe" value={form.tddSpecialSubframe} onChange={v => onChange('tddSpecialSubframe', v)} type="number" min={0} max={9} />
          </div>
        </>
      )}
      <div className="flex items-center gap-2">
        {isTdd && <Badge variant="outline">TDD</Badge>}
        {!isTdd && <Badge variant="outline">FDD</Badge>}
        {ratMode === 'nbiot' && <Badge className="bg-orange-100 text-orange-700 border-orange-300">NB-IoT</Badge>}
        {ratMode === 'catm' && <Badge className="bg-cyan-100 text-cyan-700 border-cyan-300">CAT-M1</Badge>}
      </div>
    </div>
  );
}

// ── RF Section — only the rf_driver/* fields. Antenna count, gains and
//   network/MME, HARQ, Power, Security all moved to Layers / MME Info tabs.
function RFSection({ form, onChange }: { form: LTEFormState; onChange: (k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <BoxedSection title="RF Driver" subtitle="enb.cfg: rf_driver.{name, rx_antenna} + tx_gain / rx_gain">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="RF Mode" value={form.rfMode} onChange={v => onChange('rfMode', v)} type="select"
            options={[{ value: 'sdr', label: 'SDR' }, { value: 'split', label: 'Split 7.2' }, { value: 'ip', label: 'IP' }]} />
          <Field label="RX Antenna" value={form.rxAntenna} onChange={v => onChange('rxAntenna', v)} type="select"
            options={[{ value: 'rx', label: 'RX' }, { value: 'tx_rx', label: 'TX/RX' }]} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <Field label="TX Gain (dB)" value={form.txGain} onChange={v => onChange('txGain', v)} type="number" min={0} max={120} />
          <Field label="RX Gain (dB)" value={form.rxGain} onChange={v => onChange('rxGain', v)} type="number" min={0} max={80} />
        </div>
      </BoxedSection>
      <p className="text-[11px] text-muted-foreground px-1">
        Antenna count → <span className="font-medium">Layers → Power &amp; Antenna</span> •
        MME / S1 / eNB ID → <span className="font-medium">MME Info</span> tab
      </p>
    </div>
  );
}

// ── IoT Section (NB-IoT / CAT-M specific) ───────────────────────────────────
function IoTSection({ form, onChange, ratMode }: { form: LTEFormState; onChange: (k: string, v: any) => void; ratMode: string }) {
  if (ratMode === 'nbiot') {
    return (
      <div className="space-y-4">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">NB-IoT</h4>
        <div className="grid grid-cols-2 gap-3">
          {/* enb.cfg: cell_list[].nb_iot_mode */}
          <Field label="Deployment Mode" value={form.nbIotMode} onChange={v => onChange('nbIotMode', v)} type="select"
            options={[
              { value: 'standalone', label: 'Standalone' },
              { value: 'inband', label: 'In-Band' },
              { value: 'guardband', label: 'Guard Band' },
            ]} />
          {form.nbIotMode !== 'standalone' && (
            // enb.cfg: cell_list[].nb_iot_prb_index
            <Field label="PRB Index" value={form.nbIotPrbIndex} onChange={v => onChange('nbIotPrbIndex', v)} type="number" min={0} max={49} />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Note: NB-IoT schema shape varies between Amarisoft release trains
          (<code>nb_cell_list</code> vs flags in <code>cell_list</code>). Full NB-IoT coverage is in a follow-up PR.
        </p>
      </div>
    );
  }
  if (ratMode === 'catm') {
    return (
      <div className="space-y-4">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">CAT-M1 / eMTC</h4>
        <div className="grid grid-cols-2 gap-3">
          {/* enb.cfg: cell_list[].ce_mode */}
          <Field label="CE Mode" value={form.catMCeMode} onChange={v => onChange('catMCeMode', v)} type="select"
            options={[{ value: 'A', label: 'CE Mode A' }, { value: 'B', label: 'CE Mode B' }]} />
          {/* enb.cfg: cell_list[].max_repetitions */}
          <Field label="Max Repetitions" value={form.catMRepetitions} onChange={v => onChange('catMRepetitions', v)} type="number" min={1} max={2048} />
        </div>
      </div>
    );
  }
  return null;
}

// ── Main LTE Config Builder ─────────────────────────────────────────────────
interface LTEConfigBuilderProps {
  form: LTEFormState;
  onChange: (key: string, value: any) => void;
  ratMode: 'lte' | 'nbiot' | 'catm';
}

// Top-level tabs (mirror NR ConfigBuilder)
const MAIN_TABS = [
  { id: 'cell',   label: 'Cell',        icon: RadioTower },
  { id: 'layers', label: 'Layers',      icon: Layers },
  { id: 'mme',    label: 'MME Info',    icon: Server },
  { id: 'log',    label: 'Log Setting', icon: FileText },
] as const;

// Sub-tabs inside "Layers"
const LAYER_SUB_TABS = [
  { id: 'freq',     label: 'Frequently Used', icon: Zap },
  { id: 'mac',      label: 'MAC',             icon: Gauge },
  { id: 'power',    label: 'Power & Antenna', icon: Antenna },
  { id: 'security', label: 'Security',        icon: Lock },
] as const;

export function LTEConfigBuilder({ form, onChange, ratMode }: LTEConfigBuilderProps) {
  const hasIoT = ratMode === 'nbiot' || ratMode === 'catm';

  // Cell sub-tabs (depend on RAT mode — NB-IoT/CAT-M get an extra IoT tab)
  const CELL_SUB_TABS = [
    { id: 'cellinfo', label: 'Cell Info', icon: RadioTower },
    { id: 'band',     label: 'Band',      icon: Settings2 },
    { id: 'rf',       label: 'RF',        icon: Wifi },
    ...(hasIoT ? [{ id: 'iot' as const, label: ratMode === 'nbiot' ? 'NB-IoT' : 'CAT-M', icon: Signal }] : []),
  ];

  const [mainTab, setMainTab] = useState<string>('cell');
  const [cellSubTab, setCellSubTab] = useState<string>('cellinfo');
  const [layerSubTab, setLayerSubTab] = useState<string>('freq');

  const renderCellContent = () => {
    switch (cellSubTab) {
      case 'cellinfo': return <CellSection form={form} onChange={onChange} />;
      case 'band':     return <BandSection form={form} onChange={onChange} ratMode={ratMode} />;
      case 'rf':       return <RFSection form={form} onChange={onChange} />;
      case 'iot':      return <IoTSection form={form} onChange={onChange} ratMode={ratMode} />;
      default:         return null;
    }
  };

  const renderMainContent = () => {
    switch (mainTab) {
      case 'cell':
        return (
          <div className="space-y-4">
            {/* Multi-cell strip — only for plain LTE (CA), only on per-cell sub-tabs */}
            {ratMode === 'lte' && (cellSubTab === 'cellinfo' || cellSubTab === 'band') && (
              <LTECellTabs form={form} onChange={onChange} />
            )}

            {/* Sub-navigation */}
            <div className="flex flex-wrap items-center gap-2">
              {CELL_SUB_TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = cellSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setCellSubTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div>{renderCellContent()}</div>
          </div>
        );

      case 'layers':
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {LAYER_SUB_TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = layerSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setLayerSubTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div>
              {layerSubTab === 'freq'     && <FrequentlyUsedLte form={form} onChange={onChange} />}
              {layerSubTab === 'mac'      && <MacLte form={form} onChange={onChange} />}
              {layerSubTab === 'power'    && <PowerLte form={form} onChange={onChange} />}
              {layerSubTab === 'security' && <SecurityLte form={form} onChange={onChange} />}
            </div>
          </div>
        );

      case 'mme':
        return <MmeInfoSectionLte form={form} onChange={onChange} />;

      case 'log':
        return <LogSection form={form as any} onChange={onChange} />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Main tab bar — TestMatrix-style underline (matches NR builder) */}
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap -mb-px gap-1">
          {MAIN_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = mainTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMainTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div>{renderMainContent()}</div>
    </div>
  );
}
