// Visual gNB config builder.
//
// ONE level of tabs. There used to be three: main tabs, then sub-tabs inside
// "Cell" (5) and "Layers" (7), then a bordered card around each group inside
// those. Finding a field meant remembering which of ~14 panes it was hiding
// in, and nothing on screen told you where you were.
//
// Now every tab is a flat, scrollable page of groups. A group is a heading on
// a rule (see BoxedSection) over one FIELD_GRID, so the whole builder is two
// levels deep: pick a tab, scan for a heading. Nothing is more than one click
// and one scroll away, and Ctrl-F finds any field on the page.
import { useState } from 'react';
import { RadioTower, Layers, Server, FileText, Database, Info } from 'lucide-react';
import { RFSection, ChannelSimSection, LogSection } from './sections';
import { CellEssentials } from './sections/CellEssentials';
import { AntennaSection } from './sections/AntennaSection';
import { MmeInfoSection } from './sections/MmeInfoSection';
import { DependenciesSection } from './sections/DependenciesSection';
import {
  FrequentlyUsedLayer, PhyLayer, MacLayer, RlcPdcpLayer, RrcNasLayer, SibsLayer, SSBLayer,
} from './sections/layers';
import { CellTabs } from './CellTabs';
import { CellPresets } from './CellPresets';
import { TddPatternFields } from './sections/TddPatternFields';
import { TAB_LIST, TAB_TRIGGER, TAB_TRIGGER_ACTIVE, TAB_TRIGGER_IDLE, TAB_ICON } from '@/components/ui/tab-styles';
import { DEFAULT_NR_FORM, type NRFormState } from './constants';
import type { ReferencedFile } from './cfgParser';

const MAIN_TABS = [
  { id: 'cell',   label: 'Cell',         icon: RadioTower },
  { id: 'layers', label: 'Layers',       icon: Layers },
  { id: 'mme',    label: 'MME Info',     icon: Server },
  { id: 'log',    label: 'Log Setting',  icon: FileText },
  { id: 'deps',   label: 'Dependencies', icon: Database },
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

  const renderMainContent = () => {
    switch (mainTab) {
      case 'cell':
        return (
          <div className="space-y-6">
            <CellTabs form={form} onChange={onChange} />
            <CellPresets form={form} onChange={onChange} />
            <CellEssentials form={form} onChange={onChange} />
            {/* TDD only applies to TDD bands — omitted entirely on FDD rather
                than shown as an inert pane. */}
            {form.nrTdd === 1 && <TddPatternFields form={form} onChange={onChange} />}
            <AntennaSection form={form} onChange={onChange} />
            <RFSection form={form} onChange={onChange} />
            <ChannelSimSection form={form} onChange={onChange} />
          </div>
        );

      case 'layers':
        return (
          <div className="space-y-6">
            <div className="flex items-start gap-2 p-2.5 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground">
              <Info className={`${TAB_ICON} shrink-0 mt-px text-muted-foreground/70`} />
              <div>
                <span className="font-medium text-foreground">Shared via nr_cell_default.</span>{' '}
                Everything on this page is emitted under{' '}
                <code className="font-mono">nr_cell_default</code>, so every cell in the
                gNB inherits it. Amarisoft also allows per-cell overrides inside{' '}
                <code className="font-mono">nr_cell_list[i]</code> — that's a future
                enhancement; today these are config-wide.
              </div>
            </div>

            <FrequentlyUsedLayer form={form} onChange={onChange} />
            <SSBLayer form={form} onChange={onChange} />
            <RrcNasLayer form={form} onChange={onChange} />
            <RlcPdcpLayer form={form} onChange={onChange} />
            <MacLayer form={form} onChange={onChange} />
            <PhyLayer form={form} onChange={onChange} />
            <SibsLayer form={form} onChange={onChange} />
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

export { DEFAULT_NR_FORM };
export type { NRFormState };
