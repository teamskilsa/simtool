// LTE / NB-IoT / CAT-M1 config builder
import { useState } from 'react';
import { RadioTower, Settings2, Wifi, FileText, Signal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Field } from './sections/Field';
import {
  LTE_BAND_OPTIONS, LTE_BW_OPTIONS, LTE_TDD_CONFIGS, LTE_TDD_BANDS,
  DEFAULT_LTE_EARFCN, NBIOT_BW_OPTIONS, CATM_BW_OPTIONS,
  type LTEFormState,
} from './lteConstants';
import { LogSection } from './sections/LogSection';

// ── Cell Section ────────────────────────────────────────────────────────────
function CellSection({ form, onChange }: { form: LTEFormState; onChange: (k: string, v: any) => void }) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Cell</h4>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Cell ID" value={form.cellId} onChange={v => onChange('cellId', v)} type="number" min={0} max={255} />
        <Field label="PCI" value={form.pci} onChange={v => onChange('pci', v)} type="number" min={0} max={503} />
        <Field label="TAC" value={form.tac} onChange={v => onChange('tac', v)} type="number" min={0} max={65535} />
      </div>
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">PLMN</h4>
      <div className="grid grid-cols-3 gap-3">
        <Field label="MCC" value={form.plmn.mcc} onChange={v => onChange('plmn', { ...form.plmn, mcc: v })} />
        <Field label="MNC" value={form.plmn.mnc} onChange={v => onChange('plmn', { ...form.plmn, mnc: v })} />
        <Field label="CP Mode" value={form.cpMode} onChange={v => onChange('cpMode', v)} type="select"
          options={[{ value: 'normal', label: 'Normal' }, { value: 'extended', label: 'Extended' }]} />
      </div>
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">PHICH</h4>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration" value={form.phichDuration} onChange={v => onChange('phichDuration', v)} type="select"
          options={[{ value: 'normal', label: 'Normal' }, { value: 'extended', label: 'Extended' }]} />
        <Field label="Resource" value={form.phichResource} onChange={v => onChange('phichResource', v)} type="select"
          options={[{ value: '1/6', label: '1/6' }, { value: '1/2', label: '1/2' }, { value: '1', label: '1' }, { value: '2', label: '2' }]} />
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
        <Field label="Bandwidth" value={form.bandwidth} onChange={v => onChange('bandwidth', v)} type="select" options={bwOptions} />
        <Field label="DL EARFCN" value={form.dlEarfcn} onChange={v => onChange('dlEarfcn', v)} type="number" min={0} max={65535} />
      </div>
      {isTdd && (
        <>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">TDD</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="TDD Config" value={form.tddConfig} onChange={v => onChange('tddConfig', v)} type="select" options={LTE_TDD_CONFIGS} />
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
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Antenna</h4>
      <div className="grid grid-cols-2 gap-3">
        <Field label="DL Antennas" value={form.nAntennaDl} onChange={v => onChange('nAntennaDl', v)} type="select"
          options={[{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 4, label: '4' }]} />
        <Field label="UL Antennas" value={form.nAntennaUl} onChange={v => onChange('nAntennaUl', v)} type="select"
          options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]} />
      </div>
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">RF</h4>
      <div className="grid grid-cols-3 gap-3">
        <Field label="RF Mode" value={form.rfMode} onChange={v => onChange('rfMode', v)} type="select"
          options={[{ value: 'sdr', label: 'SDR' }, { value: 'split', label: 'Split 7.2' }, { value: 'ip', label: 'IP' }]} />
        <Field label="TX Gain (dB)" value={form.txGain} onChange={v => onChange('txGain', v)} type="number" min={0} max={100} />
        <Field label="RX Gain (dB)" value={form.rxGain} onChange={v => onChange('rxGain', v)} type="number" min={0} max={100} />
      </div>
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">Network</h4>
      <div className="grid grid-cols-3 gap-3">
        <Field label="MME Address" value={form.mmeAddr} onChange={v => onChange('mmeAddr', v)} placeholder="127.0.1.100" />
        <Field label="GTP Address" value={form.gtpAddr} onChange={v => onChange('gtpAddr', v)} placeholder="127.0.1.1" />
        <Field label="eNB ID" value={form.enbId} onChange={v => onChange('enbId', v)} placeholder="0x1A2D0" />
      </div>
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
      </div>
    );
  }
  if (ratMode === 'catm') {
    return (
      <div className="space-y-4">
        <h4 className="text-xs font-semibold uppercase text-muted-foreground">CAT-M1 / eMTC</h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CE Mode" value={form.catMCeMode} onChange={v => onChange('catMCeMode', v)} type="select"
            options={[{ value: 'A', label: 'CE Mode A' }, { value: 'B', label: 'CE Mode B' }]} />
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

export function LTEConfigBuilder({ form, onChange, ratMode }: LTEConfigBuilderProps) {
  const hasIoT = ratMode === 'nbiot' || ratMode === 'catm';

  const TABS = [
    { id: 'cell', label: 'Cell', icon: RadioTower },
    { id: 'band', label: 'Band', icon: Settings2 },
    { id: 'rf', label: 'RF', icon: Wifi },
    ...(hasIoT ? [{ id: 'iot', label: ratMode === 'nbiot' ? 'NB-IoT' : 'CAT-M', icon: Signal }] : []),
    { id: 'log', label: 'Log', icon: FileText },
  ];

  const [activeTab, setActiveTab] = useState('cell');

  return (
    <div className="space-y-3">
      <div className="flex gap-0.5 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center whitespace-nowrap ${
                activeTab === tab.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:shadow-sm'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border bg-white p-4">
        {activeTab === 'cell' && <CellSection form={form} onChange={onChange} />}
        {activeTab === 'band' && <BandSection form={form} onChange={onChange} ratMode={ratMode} />}
        {activeTab === 'rf' && <RFSection form={form} onChange={onChange} />}
        {activeTab === 'iot' && <IoTSection form={form} onChange={onChange} ratMode={ratMode} />}
        {activeTab === 'log' && <LogSection form={form as any} onChange={onChange} />}
      </div>
    </div>
  );
}
