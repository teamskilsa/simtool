import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from './Field';
import { SectionToolbar } from './SectionToolbar';
import type { NRFormState, PdnEntry } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function PDNSection({ form, onChange }: Props) {
  const pdns = form.pdnList || [];

  const updatePdn = (idx: number, patch: Partial<PdnEntry>) => {
    const next = [...pdns];
    next[idx] = { ...next[idx], ...patch };
    onChange('pdnList', next);
  };

  const addPdn = () => {
    onChange('pdnList', [...pdns, { pdn_type: 'ipv4', access_point_name: '', first_ip_addr: '', last_ip_addr: '' }]);
  };

  const removePdn = (idx: number) => {
    onChange('pdnList', pdns.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <SectionToolbar
        type="pdn"
        currentData={pdns}
        onLoad={(data: PdnEntry[]) => onChange('pdnList', data)}
      />

      {pdns.map((pdn, idx) => (
        <div key={idx} className="grid grid-cols-6 gap-2 items-end p-2 rounded border bg-gray-50">
          <Field label="Type" value={pdn.pdn_type} onChange={v => updatePdn(idx, { pdn_type: v })} type="select"
            options={[{ value: 'ipv4', label: 'IPv4' }, { value: 'ipv6', label: 'IPv6' }, { value: 'ipv4v6', label: 'IPv4v6' }]} />
          <Field label="APN" value={pdn.access_point_name} onChange={v => updatePdn(idx, { access_point_name: v })} placeholder="internet" />
          <Field label="First IP" value={pdn.first_ip_addr} onChange={v => updatePdn(idx, { first_ip_addr: v })} placeholder="192.168.2.2" />
          <Field label="Last IP" value={pdn.last_ip_addr} onChange={v => updatePdn(idx, { last_ip_addr: v })} placeholder="192.168.2.254" />
          <Field label="DNS" value={pdn.dns_addr || ''} onChange={v => updatePdn(idx, { dns_addr: v })} placeholder="8.8.8.8" />
          <Button size="sm" variant="ghost" onClick={() => removePdn(idx)} className="h-8 text-red-500 hover:text-red-700">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}

      <Button size="sm" variant="outline" onClick={addPdn} className="h-7 text-xs">
        <Plus className="w-3 h-3 mr-1" /> Add APN
      </Button>
    </div>
  );
}
