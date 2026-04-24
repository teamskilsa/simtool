// Core Config Builder — TestMatrix-style: main tabs with underline style.
//   General  |  PDN List  |  UE Database  |  Logging
import { useState } from 'react';
import { Shield, Globe, Smartphone, FileText } from 'lucide-react';
import { PDNSection } from './sections/PDNSection';
import { UeDbSection } from './sections/UeDbSection';
import { LogSection } from './sections/LogSection';
import { Field } from './sections/Field';
import { SectionToolbar } from './sections/SectionToolbar';
import { BoxedSection } from './BoxedSection';
import type { NRFormState } from './constants';

const TABS = [
  { id: 'general', label: 'General',     icon: Shield },
  { id: 'pdn',     label: 'PDN List',    icon: Globe },
  { id: 'uedb',    label: 'UE Database', icon: Smartphone },
  { id: 'log',     label: 'Logging',     icon: FileText },
] as const;

interface CoreConfigBuilderProps {
  form: NRFormState;
  onChange: (key: string, value: any) => void;
}

function GeneralSection({ form, onChange }: { form: NRFormState; onChange: (k: string, v: any) => void }) {
  const currentData = {
    plmn: form.plmn, tac: form.tac,
    amfAddr: form.amfAddr, gtpAddr: form.gtpAddr,
  };
  const handleLoad = (data: any) => {
    if (data.plmn) onChange('plmn', data.plmn);
    if (data.tac !== undefined) onChange('tac', data.tac);
    if (data.amfAddr) onChange('amfAddr', data.amfAddr);
    if (data.gtpAddr) onChange('gtpAddr', data.gtpAddr);
  };

  return (
    <div className="space-y-4">
      <SectionToolbar type="general" currentData={currentData} onLoad={handleLoad} />

      <BoxedSection title="Network Identity">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="MCC" value={form.plmn.mcc} onChange={v => onChange('plmn', { ...form.plmn, mcc: v })} placeholder="001" />
          <Field label="MNC" value={form.plmn.mnc} onChange={v => onChange('plmn', { ...form.plmn, mnc: v })} placeholder="01" />
          <Field label="TAC" value={form.tac} onChange={v => onChange('tac', v)} type="number" min={0} max={65535} />
        </div>
      </BoxedSection>

      <BoxedSection title="MME / AMF" subtitle="Addresses for S1AP / NGAP binding and GTP-U">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="MME/AMF Address" value={form.amfAddr} onChange={v => onChange('amfAddr', v)} placeholder="127.0.1.100" />
          <Field label="GTP Address" value={form.gtpAddr} onChange={v => onChange('gtpAddr', v)} placeholder="127.0.1.1" />
        </div>
      </BoxedSection>

      <BoxedSection title="Security" subtitle="NAS ciphering and integrity algorithms">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="NAS Integrity" value="eia2" onChange={() => {}} type="select"
            options={[{ value: 'eia0', label: 'EIA0 (null)' }, { value: 'eia1', label: 'EIA1 (SNOW)' }, { value: 'eia2', label: 'EIA2 (AES)' }]} />
          <Field label="NAS Ciphering" value="eea2" onChange={() => {}} type="select"
            options={[{ value: 'eea0', label: 'EEA0 (null)' }, { value: 'eea1', label: 'EEA1 (SNOW)' }, { value: 'eea2', label: 'EEA2 (AES)' }]} />
        </div>
      </BoxedSection>
    </div>
  );
}

export function CoreConfigBuilder({ form, onChange }: CoreConfigBuilderProps) {
  const [activeTab, setActiveTab] = useState<string>('general');

  return (
    <div className="space-y-4">
      {/* Main tabs — underline style */}
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap -mb-px gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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

      {/* Active content */}
      <div>
        {activeTab === 'general' && <GeneralSection form={form} onChange={onChange} />}
        {activeTab === 'pdn'     && <PDNSection form={form} onChange={onChange} />}
        {activeTab === 'uedb'    && <UeDbSection form={form} onChange={onChange} />}
        {activeTab === 'log'     && <LogSection form={form} onChange={onChange} />}
      </div>
    </div>
  );
}
