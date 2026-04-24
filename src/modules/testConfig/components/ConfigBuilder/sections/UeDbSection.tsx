import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from './Field';
import { SectionToolbar } from './SectionToolbar';
import type { NRFormState, UeDbEntry } from '../constants';

interface Props { form: NRFormState; onChange: (key: string, value: any) => void; }

export function UeDbSection({ form, onChange }: Props) {
  const ues = form.ueDb || [];

  const updateUe = (idx: number, patch: Partial<UeDbEntry>) => {
    const next = [...ues];
    next[idx] = { ...next[idx], ...patch };
    onChange('ueDb', next);
  };

  const addUe = () => {
    onChange('ueDb', [...ues, { sim_algo: 'milenage', imsi: '', K: '', opc: '', amf: 0x9001, sqn: '000000000000', nb_ue: 1 }]);
  };

  const removeUe = (idx: number) => onChange('ueDb', ues.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4">
      <SectionToolbar
        type="uedb"
        currentData={ues}
        onLoad={(data: UeDbEntry[]) => onChange('ueDb', data)}
      />

      {ues.map((ue, idx) => (
        <div key={idx} className="space-y-2 p-2 rounded border bg-gray-50">
          <div className="grid grid-cols-4 gap-2">
            <Field label="IMSI" value={ue.imsi} onChange={v => updateUe(idx, { imsi: v })} placeholder="001010000000001" />
            <Field label="K" value={ue.K} onChange={v => updateUe(idx, { K: v })} placeholder="00112233..." />
            <Field label="OPc" value={ue.opc} onChange={v => updateUe(idx, { opc: v })} placeholder="63bfa50e..." />
            <Field label="# UEs" value={ue.nb_ue} onChange={v => updateUe(idx, { nb_ue: v })} type="number" min={1} />
          </div>
          <div className="grid grid-cols-4 gap-2 items-end">
            <Field label="Algo" value={ue.sim_algo} onChange={v => updateUe(idx, { sim_algo: v })} type="select"
              options={[{ value: 'milenage', label: 'Milenage' }, { value: 'xor', label: 'XOR' }, { value: 'tuak', label: 'TUAK' }]} />
            <Field label="AMF" value={`0x${ue.amf.toString(16)}`} onChange={v => updateUe(idx, { amf: parseInt(v, 16) || 0x9001 })} />
            <Field label="IMS" value={ue.ims || false} onChange={v => updateUe(idx, { ims: v })} type="checkbox" />
            <Button size="sm" variant="ghost" onClick={() => removeUe(idx)} className="h-8 text-red-500 hover:text-red-700">
              <Trash2 className="w-3 h-3 mr-1" /> Remove
            </Button>
          </div>
        </div>
      ))}

      <Button size="sm" variant="outline" onClick={addUe} className="h-7 text-xs">
        <Plus className="w-3 h-3 mr-1" /> Add UE Group
      </Button>
    </div>
  );
}
