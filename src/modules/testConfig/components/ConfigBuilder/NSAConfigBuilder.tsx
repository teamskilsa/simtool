// NSA / EN-DC config builder — single config that owns BOTH the LTE anchor
// (cell_list) AND the NR secondary (nr_cell_list). The user toggles between
// the two sides; each side renders the existing LTE or NR builder.
import { useState } from 'react';
import { RadioTower, Wifi, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LTEConfigBuilder } from './LTEConfigBuilder';
import { ConfigBuilder } from './ConfigBuilder';
import type { NSAFormState } from './nsaConstants';
import type { LTEFormState } from './lteConstants';
import type { NRFormState } from './constants';
import type { ReferencedFile } from './cfgParser';

interface NSAConfigBuilderProps {
  form: NSAFormState;
  onChange: (key: 'lteForm' | 'nrForm', value: LTEFormState | NRFormState) => void;
  /** External files referenced by the current config (drb.cfg, sib*.asn, includes) */
  dependencies?: ReferencedFile[];
  /** Filenames already in storage — used to mark deps as available vs missing */
  availableFiles?: string[];
}

export function NSAConfigBuilder({
  form, onChange,
  dependencies = [], availableFiles = [],
}: NSAConfigBuilderProps) {
  const [side, setSide] = useState<'lte' | 'nr'>('lte');

  // Adapter: existing LTEConfigBuilder/ConfigBuilder expect (key, value) flat
  // updates, but our parent stores nested form state. Bridge by replacing the
  // whole side-form on each field change.
  const handleLteFieldChange = (key: string, value: any) => {
    onChange('lteForm', { ...form.lteForm, [key]: value });
  };
  const handleNrFieldChange = (key: string, value: any) => {
    onChange('nrForm', { ...form.nrForm, [key]: value });
  };

  return (
    <div className="space-y-3">
      {/* NSA banner — always visible so user knows this is a dual-RAT config */}
      <div className="flex items-start gap-2 p-3 rounded-lg border border-purple-200 bg-purple-50/50 text-xs">
        <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-purple-900">NSA / EN-DC Configuration</p>
          <p className="text-purple-700/80">
            Single config with {form.lteForm.cells.length} LTE anchor cell{form.lteForm.cells.length === 1 ? '' : 's'} (band {form.lteForm.band})
            {' '}and {form.nrForm.cells.length} NR secondary cell{form.nrForm.cells.length === 1 ? '' : 's'} (band n{form.nrForm.band}).
            Use the toggle to edit each side.
          </p>
        </div>
      </div>

      {/* RAT side switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setSide('lte')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            side === 'lte' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white'
          }`}
        >
          <Wifi className="w-4 h-4" />
          LTE Anchor
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${
            side === 'lte' ? 'bg-white/20 border-white/40 text-white' : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}>
            {form.lteForm.cells.length}
          </Badge>
        </button>
        <button
          onClick={() => setSide('nr')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            side === 'nr' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white'
          }`}
        >
          <RadioTower className="w-4 h-4" />
          NR Secondary
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${
            side === 'nr' ? 'bg-white/20 border-white/40 text-white' : 'bg-purple-50 border-purple-200 text-purple-700'
          }`}>
            {form.nrForm.cells.length}
          </Badge>
        </button>
      </div>

      {/* Active side's existing builder — deps are config-wide (combined output)
          so we forward the same list to whichever side is on screen. */}
      {side === 'lte' ? (
        <LTEConfigBuilder
          form={form.lteForm}
          onChange={handleLteFieldChange}
          ratMode="lte"
          dependencies={dependencies}
          availableFiles={availableFiles}
        />
      ) : (
        <ConfigBuilder
          form={form.nrForm}
          onChange={handleNrFieldChange}
          dependencies={dependencies}
          availableFiles={availableFiles}
        />
      )}
    </div>
  );
}
