// Visual gNB/eNB config builder — TestMatrix-style layout:
//   Main tabs:  Cell  |  Layers  |  MME Info  |  Log Setting  |  Dependencies
//
// "Cell" is now a single merged tab with all per-cell config grouped in
// BoxedSections (no sub-tabs). Conditional sections (TDD pattern, FR-specific
// band options) appear when relevant. Multi-cell strip lives at the top.
//
// SSB Configuration moved to Layers/SSB so the Cell tab stays focused.
import { useState } from 'react';
import {
  RadioTower, Layers, Server, FileText,
  Zap, Gauge, Network, MessageSquare, Radio, Signal, Database, Info,
} from 'lucide-react';
import {
  CellSection, BandSection, RFSection, ChannelSimSection, LogSection,
} from './sections';
import { AntennaSection } from './sections/AntennaSection';
import { MmeInfoSection } from './sections/MmeInfoSection';
import { DependenciesSection } from './sections/DependenciesSection';
import {
  FrequentlyUsedLayer, PhyLayer, MacLayer, RlcPdcpLayer, RrcNasLayer, SibsLayer, SSBLayer,
} from './sections/layers';
import { CellTabs } from './CellTabs';
import { DEFAULT_NR_FORM, type NRFormState } from './constants';
import type { ReferencedFile } from './cfgParser';

// Main tabs — top level
const MAIN_TABS = [
  { id: 'cell',   label: 'Cell',         icon: RadioTower },
  { id: 'layers', label: 'Layers',       icon: Layers },
  { id: 'mme',    label: 'MME Info',     icon: Server },
  { id: 'log',    label: 'Log Setting',  icon: FileText },
  { id: 'deps',   label: 'Dependencies', icon: Database },
] as const;

// Sub-tabs inside "Layers" (added SSB)
const LAYER_SUB_TABS = [
  { id: 'freq',    label: 'Frequently Used', icon: Zap },
  { id: 'ssb',     label: 'SSB',             icon: Radio },
  { id: 'rrcnas',  label: 'RRC & NAS',       icon: MessageSquare },
  { id: 'rlcpdcp', label: 'RLC & PDCP',      icon: Network },
  { id: 'mac',     label: 'MAC',             icon: Gauge },
  { id: 'phy',     label: 'PHY',             icon: Radio },
  { id: 'sibs',    label: 'SIBs',            icon: Signal },
] as const;

interface ConfigBuilderProps {
  form: NRFormState;
  onChange: (key: string, value: any) => void;
  /** External files referenced by the current config (drb.cfg, sib*.asn, includes) */
  dependencies?: ReferencedFile[];
  /** Filenames already in storage — used to mark deps as available vs missing */
  availableFiles?: string[];
}

export function ConfigBuilder({ form, onChange, dependencies = [], availableFiles = [] }: ConfigBuilderProps) {
  const [mainTab, setMainTab] = useState<string>('cell');
  const [layerSubTab, setLayerSubTab] = useState<string>('freq');

  const renderMainContent = () => {
    switch (mainTab) {
      case 'cell':
        // Single merged Cell tab — all per-cell config in one place.
        return (
          <div className="space-y-4">
            <CellTabs form={form} onChange={onChange} />
            <CellSection form={form} onChange={onChange} />
            <BandSection form={form} onChange={onChange} />
            <AntennaSection form={form} onChange={onChange} />
            <RFSection form={form} onChange={onChange} />
            <ChannelSimSection form={form} onChange={onChange} />
          </div>
        );

      case 'layers':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-md border border-blue-200 bg-blue-50/40 text-xs text-blue-900">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-600" />
              <div>
                <span className="font-medium">Shared via nr_cell_default.</span> Layer
                fields (HARQ, scheduler, SIBs, RLC/PDCP timers, security algos, ...) are
                emitted under <code className="font-mono">nr_cell_default</code> so every
                cell in the gNB inherits them. Amarisoft also allows per-cell overrides
                inside <code className="font-mono">nr_cell_list[i]</code> — that's a future
                enhancement; today these are config-wide.
              </div>
            </div>

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
              {layerSubTab === 'ssb'     && <SSBLayer form={form} onChange={onChange} />}
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

      case 'deps':
        return <DependenciesSection refs={dependencies} available={availableFiles} />;

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
