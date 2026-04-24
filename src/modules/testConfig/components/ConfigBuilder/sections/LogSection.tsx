import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Field } from './Field';
import { SectionToolbar } from './SectionToolbar';

interface Props { form: any; onChange: (key: string, value: any) => void; }

const LOG_LAYERS = ['phy', 'mac', 'rlc', 'pdcp', 'rrc', 'nas', 's1ap', 'ngap', 'x2ap', 'xnap', 'gtpu'];
const LOG_LEVELS = [
  { value: 'none', label: 'None' },
  { value: 'error', label: 'Error' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' },
];

export function LogSection({ form, onChange }: Props) {
  const [showLayers, setShowLayers] = useState(false);
  const [showPcap, setShowPcap] = useState(false);

  const logFilename = form.logFilename || '/tmp/gnb0.log';
  const logLevel = form.logLevel || 'error';
  const logLayers = form.logLayers || {};
  const pcapFilename = form.pcapFilename || '';

  const currentLog = {
    logFilename: form.logFilename, logLevel: form.logLevel, logLayers: form.logLayers,
  };
  const handleLoad = (data: any, _name?: string) => {
    if (data.logFilename !== undefined) onChange('logFilename', data.logFilename);
    if (data.logLevel !== undefined) onChange('logLevel', data.logLevel);
    if (data.logLayers !== undefined) onChange('logLayers', data.logLayers);
  };

  return (
    <div className="space-y-4">
      <SectionToolbar type="log" currentData={currentLog} onLoad={handleLoad} />
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">General</h4>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Log Filename" value={logFilename} onChange={v => onChange('logFilename', v)} placeholder="/tmp/gnb0.log" />
        <Field label="Global Log Level" value={logLevel} onChange={v => onChange('logLevel', v)} type="select" options={LOG_LEVELS} />
      </div>

      {/* Per-layer levels (collapsible) */}
      <button onClick={() => setShowLayers(!showLayers)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        {showLayers ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Per-Layer Log Levels
      </button>
      {showLayers && (
        <div className="grid grid-cols-4 gap-2">
          {LOG_LAYERS.map(layer => (
            <Field
              key={layer}
              label={layer.toUpperCase()}
              value={logLayers[layer] || logLevel}
              onChange={v => onChange('logLayers', { ...logLayers, [layer]: v })}
              type="select"
              options={LOG_LEVELS}
            />
          ))}
        </div>
      )}

      {/* PCAP (collapsible) */}
      <button onClick={() => setShowPcap(!showPcap)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        {showPcap ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        PCAP Capture (Wireshark)
      </button>
      {showPcap && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="PCAP Filename" value={pcapFilename} onChange={v => onChange('pcapFilename', v)} placeholder="/tmp/gnb.pcap" />
          <Field label="Max Data Length" value={form.pcapMaxLen || 65536} onChange={v => onChange('pcapMaxLen', v)} type="number" />
        </div>
      )}
    </div>
  );
}
