// Visual gNB/eNB config builder — TestMatrix-style layout:
//   Main tabs:  Cell  |  Layers  |  MME Info  |  Log Setting
//   Inside "Cell" tab, sub-nav: Cell Info / Band / Antenna / RF / Channel Sim
// Multi-cell support lives in the Cell tab via CellTabs strip.
import { useState } from 'react';
import {
  RadioTower, Layers, Server, FileText, Cpu, Wifi, Settings2, Antenna,
  Zap, Gauge, Network, MessageSquare, Radio, Signal,
} from 'lucide-react';
import {
  CellSection, BandSection, RFSection, ChannelSimSection, LogSection,
} from './sections';
import { AntennaSection } from './sections/AntennaSection';
import { MmeInfoSection } from './sections/MmeInfoSection';
import {
  FrequentlyUsedLayer, PhyLayer, MacLayer, RlcPdcpLayer, RrcNasLayer, SibsLayer,
} from './sections/layers';
import { CellTabs } from './CellTabs';
import { DEFAULT_NR_FORM, type NRFormState } from './constants';

// Main tabs — top level
const MAIN_TABS = [
  { id: 'cell',   label: 'Cell',        icon: RadioTower },
  { id: 'layers', label: 'Layers',      icon: Layers },
  { id: 'mme',    label: 'MME Info',    icon: Server },
  { id: 'log',    label: 'Log Setting', icon: FileText },
] as const;

// Sub-tabs inside "Cell"
const CELL_SUB_TABS = [
  { id: 'cellinfo', label: 'Cell Info',   icon: RadioTower },
  { id: 'band',     label: 'Band',        icon: Settings2 },
  { id: 'antenna',  label: 'Antenna',     icon: Antenna },
  { id: 'rf',       label: 'RF',          icon: Wifi },
  { id: 'chsim',    label: 'Channel Sim', icon: Cpu },
] as const;

// Sub-tabs inside "Layers"
const LAYER_SUB_TABS = [
  { id: 'freq',    label: 'Frequently Used', icon: Zap },
  { id: 'rrcnas', label: 'RRC & NAS',       icon: MessageSquare },
  { id: 'rlcpdcp', label: 'RLC & PDCP',      icon: Network },
  { id: 'mac',     label: 'MAC',             icon: Gauge },
  { id: 'phy',     label: 'PHY',             icon: Radio },
  { id: 'sibs',    label: 'SIBs',            icon: Signal },
] as const;

interface ConfigBuilderProps {
  form: NRFormState;
  onChange: (key: string, value: any) => void;
}

export function ConfigBuilder({ form, onChange }: ConfigBuilderProps) {
  const [mainTab, setMainTab] = useState<string>('cell');
  const [cellSubTab, setCellSubTab] = useState<string>('cellinfo');
  const [layerSubTab, setLayerSubTab] = useState<string>('freq');

  const renderCellContent = () => {
    switch (cellSubTab) {
      case 'cellinfo': return <CellSection form={form} onChange={onChange} />;
      case 'band':     return <BandSection form={form} onChange={onChange} />;
      case 'antenna':  return <AntennaSection form={form} onChange={onChange} />;
      case 'rf':       return <RFSection form={form} onChange={onChange} />;
      case 'chsim':    return <ChannelSimSection form={form} onChange={onChange} />;
      default:         return null;
    }
  };

  const renderMainContent = () => {
    switch (mainTab) {
      case 'cell':
        return (
          <div className="space-y-4">
            {/* Multi-cell strip — only on Cell Info & Band (per-cell fields) */}
            {(cellSubTab === 'cellinfo' || cellSubTab === 'band') && (
              <CellTabs form={form} onChange={onChange} />
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

            {/* Section content */}
            <div>{renderCellContent()}</div>
          </div>
        );

      case 'layers':
        return (
          <div className="space-y-4">
            {/* Sub-navigation */}
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

            {/* Layer content */}
            <div>
              {layerSubTab === 'freq'    && <FrequentlyUsedLayer form={form} onChange={onChange} />}
              {layerSubTab === 'rrcnas'  && <RrcNasLayer form={form} onChange={onChange} />}
              {layerSubTab === 'rlcpdcp' && <RlcPdcpLayer form={form} onChange={onChange} />}
              {layerSubTab === 'mac'     && <MacLayer form={form} onChange={onChange} />}
              {layerSubTab === 'phy'     && <PhyLayer form={form} onChange={onChange} />}
              {layerSubTab === 'sibs'    && <SibsLayer form={form} onChange={onChange} />}
            </div>
          </div>
        );

      case 'mme':
        return <MmeInfoSection form={form} onChange={onChange} />;

      case 'log':
        return <LogSection form={form} onChange={onChange} />;

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Main tab bar — TestMatrix-style underline style */}
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

      {/* Active main content */}
      <div>{renderMainContent()}</div>
    </div>
  );
}

export { DEFAULT_NR_FORM };
export type { NRFormState };
