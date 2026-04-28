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

// ── Cell Section ────────────────────────────────────────────────────────────
function CellSection({ form, onChange }: { form: LTEFormState; onChange: (k: string, v: any) => void }) {
  return (
    <div className="space-y-4">

      {/* ── Cell Identity ── */}
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Cell</h4>
      <div className="grid grid-cols-4 gap-3">
        {/* enb.cfg: cell_list[].cell_id */}
        <Field label="Cell ID" value={form.cellId} onChange={v => onChange('cellId', v)} type="number" min={0} max={255} />
        {/* enb.cfg: cell_list[].n_id_cell */}
        <Field label="PCI" value={form.pci} onChange={v => onChange('pci', v)} type="number" min={0} max={503} />
        {/* enb.cfg: cell_list[].tac */}
        <Field label="TAC" value={form.tac} onChange={v => onChange('tac', v)} type="number" min={0} max={65535} />
        {/* enb.cfg: cell_list[].rf_port */}
        <Field label="RF Port" value={form.rfPort} onChange={v => onChange('rfPort', v)} type="number" min={0} max={7} />
      </div>

      {/* ── PLMN ── */}
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">PLMN</h4>
      <div className="grid grid-cols-3 gap-3">
        {/* enb.cfg: cell_list[].plmn_list[].plmn (MCC portion) */}
        <Field label="MCC" value={form.plmn.mcc} onChange={v => onChange('plmn', { ...form.plmn, mcc: v })} />
        {/* enb.cfg: cell_list[].plmn_list[].plmn (MNC portion) */}
        <Field label="MNC" value={form.plmn.mnc} onChange={v => onChange('plmn', { ...form.plmn, mnc: v })} />
        {/* enb.cfg: cell_list[].cyclic_prefix */}
        <Field label="CP Mode" value={form.cpMode} onChange={v => onChange('cpMode', v)} type="select"
          options={[{ value: 'normal', label: 'Normal' }, { value: 'extended', label: 'Extended' }]} />
      </div>
      <div className="flex gap-4">
        {/* enb.cfg: cell_list[].plmn_list[].attach_without_pdn */}
        <Field label="Attach without PDN" value={form.attachWithoutPdn} onChange={v => onChange('attachWithoutPdn', v)} type="checkbox" />
        {/* enb.cfg: cell_list[].plmn_list[].reserved */}
        <Field label="PLMN Reserved" value={form.plmnReserved} onChange={v => onChange('plmnReserved', v)} type="checkbox" />
      </div>

      {/* ── PHICH ── */}
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">PHICH</h4>
      <div className="grid grid-cols-2 gap-3">
        {/* enb.cfg: cell_list[].phich_duration */}
        <Field label="Duration" value={form.phichDuration} onChange={v => onChange('phichDuration', v)} type="select"
          options={[{ value: 'normal', label: 'Normal' }, { value: 'extended', label: 'Extended' }]} />
        {/* enb.cfg: cell_list[].phich_resource */}
        <Field label="Resource" value={form.phichResource} onChange={v => onChange('phichResource', v)} type="select"
          options={[{ value: '1/6', label: '1/6' }, { value: '1/2', label: '1/2' }, { value: '1', label: '1' }, { value: '2', label: '2' }]} />
      </div>

      {/* ── Cell Access / SIB1 ── */}
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Cell Access</h4>
      <div className="grid grid-cols-2 gap-3">
        {/* enb.cfg: cell_list[].q_rx_lev_min  (dBm) */}
        <Field label="q_rx_lev_min (dBm)" value={form.qRxLevMin} onChange={v => onChange('qRxLevMin', v)} type="number" min={-140} max={-44} />
        {/* enb.cfg: cell_list[].p_max  (dBm) */}
        <Field label="p_max (dBm)" value={form.pMax} onChange={v => onChange('pMax', v)} type="number" min={-30} max={33} />
      </div>
      <div className="flex gap-4">
        {/* enb.cfg: cell_list[].cell_barred */}
        <Field label="Cell Barred" value={form.cellBarred} onChange={v => onChange('cellBarred', v)} type="checkbox" />
        {/* enb.cfg: cell_list[].intra_freq_reselection */}
        <Field label="Intra-Freq Reselection" value={form.intraFreqReselection} onChange={v => onChange('intraFreqReselection', v)} type="checkbox" />
      </div>

      {/* ── System Information ── */}
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">System Info</h4>
      <div className="grid grid-cols-2 gap-3">
        {/* enb.cfg: cell_list[].si_coderate */}
        <Field label="SI Code Rate" value={form.siCoderate} onChange={v => onChange('siCoderate', v)} type="number" min={0.05} max={1.0} step="0.05" />
        {/* TODO(amarisoft-doc-verify): enb.cfg: cell_list[].si_window_length (ms) */}
        <Field label="SI Window (ms)" value={form.siWindowLength} onChange={v => onChange('siWindowLength', v)} type="number" min={1} max={1000} />
      </div>

      {/* ── Scheduler ── */}
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Scheduler</h4>
      <div className="grid grid-cols-3 gap-3">
        {/* enb.cfg: cell_list[].sr_period  (ms) */}
        <Field label="SR Period (ms)" value={form.srPeriod} onChange={v => onChange('srPeriod', v)} type="number" min={1} max={160} />
        {/* enb.cfg: cell_list[].cqi_period  (ms) */}
        <Field label="CQI Period (ms)" value={form.cqiPeriod} onChange={v => onChange('cqiPeriod', v)} type="number" min={1} max={160} />
        {/* enb.cfg: cell_list[].inactivity_timer  (ms) */}
        <Field label="Inactivity Timer (ms)" value={form.inactivityTimer} onChange={v => onChange('inactivityTimer', v)} type="number" min={0} max={300000} />
      </div>
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

// ── RF Section ──────────────────────────────────────────────────────────────
function RFSection({ form, onChange }: { form: LTEFormState; onChange: (k: string, v: any) => void }) {
  return (
    <div className="space-y-4">

      {/* ── Antenna ── */}
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Antenna</h4>
      <div className="grid grid-cols-2 gap-3">
        {/* enb.cfg: cell_list[].n_antenna_dl */}
        <Field label="DL Antennas" value={form.nAntennaDl} onChange={v => onChange('nAntennaDl', v)} type="select"
          options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 4, label: '4' }]} />
        {/* enb.cfg: cell_list[].n_antenna_ul */}
        <Field label="UL Antennas" value={form.nAntennaUl} onChange={v => onChange('nAntennaUl', v)} type="select"
          options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]} />
      </div>

      {/* ── RF Driver ── */}
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">RF</h4>
      <div className="grid grid-cols-3 gap-3">
        {/* enb.cfg: rf_driver.name */}
        <Field label="RF Mode" value={form.rfMode} onChange={v => onChange('rfMode', v)} type="select"
          options={[{ value: 'sdr', label: 'SDR' }, { value: 'split', label: 'Split 7.2' }, { value: 'ip', label: 'IP' }]} />
        {/* enb.cfg: tx_gain */}
        <Field label="TX Gain (dB)" value={form.txGain} onChange={v => onChange('txGain', v)} type="number" min={0} max={100} />
        {/* enb.cfg: rx_gain */}
        <Field label="RX Gain (dB)" value={form.rxGain} onChange={v => onChange('rxGain', v)} type="number" min={0} max={100} />
      </div>

      {/* ── Network / S1 ── */}
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Network</h4>
      <div className="grid grid-cols-3 gap-3">
        {/* enb.cfg: mme_list[].mme_addr */}
        <Field label="MME Address" value={form.mmeAddr} onChange={v => onChange('mmeAddr', v)} placeholder="127.0.1.100" />
        {/* enb.cfg: gtp_addr */}
        <Field label="GTP Address" value={form.gtpAddr} onChange={v => onChange('gtpAddr', v)} placeholder="127.0.1.1" />
        {/* enb.cfg: enb_id */}
        <Field label="eNB ID" value={form.enbId} onChange={v => onChange('enbId', v)} placeholder="0x1A2D0" />
      </div>

      {/* ── MAC / HARQ ── */}
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">MAC / HARQ</h4>
      <div className="grid grid-cols-2 gap-3">
        {/* enb.cfg: cell_list[].mac_config.ul_max_harq_tx */}
        <Field label="UL Max HARQ Tx" value={form.ulMaxHarqTx} onChange={v => onChange('ulMaxHarqTx', v)} type="number" min={1} max={32} />
        {/* enb.cfg: cell_list[].mac_config.dl_max_harq_tx */}
        <Field label="DL Max HARQ Tx" value={form.dlMaxHarqTx} onChange={v => onChange('dlMaxHarqTx', v)} type="number" min={1} max={32} />
      </div>

      {/* ── Power Control ── */}
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Power Control</h4>
      <div className="flex items-start gap-4">
        {/* enb.cfg: cell_list[].dpc */}
        <div className="pt-1">
          <Field label="DPC Enable" value={form.dpc} onChange={v => onChange('dpc', v)} type="checkbox" />
        </div>
        <div className="grid grid-cols-2 gap-3 flex-1">
          {/* enb.cfg: cell_list[].dpc_pusch_snr_target  (dB) */}
          <Field label="PUSCH SNR Target (dB)" value={form.dpcPuschSnrTarget} onChange={v => onChange('dpcPuschSnrTarget', v)} type="number" min={-10} max={40} disabled={!form.dpc} />
          {/* enb.cfg: cell_list[].dpc_pucch_snr_target  (dB) */}
          <Field label="PUCCH SNR Target (dB)" value={form.dpcPucchSnrTarget} onChange={v => onChange('dpcPucchSnrTarget', v)} type="number" min={-10} max={40} disabled={!form.dpc} />
        </div>
      </div>

      {/* ── Bearers ── */}
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Bearers</h4>
      <div className="grid grid-cols-1 gap-3">
        {/* enb.cfg: cell_list[].drb_config */}
        <Field label="DRB Config File" value={form.drbConfig} onChange={v => onChange('drbConfig', v)} placeholder="drb.cfg" />
      </div>

      {/* ── Security ── */}
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Security Algorithms</h4>
      <AlgoSelector
        label="Ciphering (cipher_algo_pref)"
        value={form.cipherAlgoPref}
        options={['eea0', 'eea2', 'eea3', 'eea1']}
        onChange={v => onChange('cipherAlgoPref', v)}
      />
      <AlgoSelector
        label="Integrity (integ_algo_pref)"
        value={form.integAlgoPref}
        options={['eia2', 'eia3', 'eia1', 'eia0']}
        onChange={v => onChange('integAlgoPref', v)}
      />
    </div>
  );
}

// ── AlgoSelector — ordered multi-select for cipher/integ algorithm prefs ───
function AlgoSelector({ label, value, options, onChange }: {
  label: string;
  value: string[];
  options: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (algo: string) => {
    if (value.includes(algo)) {
      onChange(value.filter(a => a !== algo));
    } else {
      onChange([...value, algo]);
    }
  };
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(algo => (
          <button
            key={algo}
            type="button"
            onClick={() => toggle(algo)}
            className={`px-2 py-0.5 rounded text-xs font-mono border transition-colors ${
              value.includes(algo)
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
            }`}
          >
            {algo}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Order: {value.join(' → ') || '(none)'}</p>
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
