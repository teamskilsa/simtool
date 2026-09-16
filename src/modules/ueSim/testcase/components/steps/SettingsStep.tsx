// Step 6 — Settings.
//
// Name, log preset and the pass/fail rule the report keys on, a note, and
// the few lteue-level knobs (API port, log file, RF driver) under Advanced.
// Below that the field map from generateUeCfg, so the operator can see for
// every wizard field whether it became an lteue key, a sim_event, or only a
// line in the header. Validation issues, when the parent has any, sit at
// the top so the last step is where a save attempt lands the user.
'use client';

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { InfoHint } from '@/modules/testConfig/components/ConfigBuilder/InfoHint';
import { Field } from '@/modules/testConfig/components/ConfigBuilder/sections/Field';
import { LOG_PRESETS, logOptionsFor } from '../../defaults';
import { FIELD_MAP, type FieldMapping } from '../../generateUeCfg';
import type { LogPreset, SettingsStepData, SuccessSetting } from '../../types';

interface Props {
  data: SettingsStepData;
  onChange: (next: SettingsStepData) => void;
  issues: string[];
  /** rf_driver.args the Cell step's RF cards would produce; shown as the placeholder. */
  derivedRfArgs: string;
}

const SUCCESS_SETTINGS: SuccessSetting[] = ['BLER Success', 'Attach Success', 'Throughput Success', 'Ping Success'];
const RF_DRIVERS = ['sdr', 'split', 'ip'];

const KIND_BADGE: Record<FieldMapping['kind'], { label: string; className: string }> = {
  cfg: { label: 'ue.cfg key', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  events: { label: 'sim_events', className: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400' },
  header: { label: 'header only', className: 'border-border bg-muted text-muted-foreground' },
};

const TH = 'h-8 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground';

export function SettingsStep({ data, onChange, issues, derivedRfArgs }: Props) {
  const patch = (p: Partial<SettingsStepData>) => onChange({ ...data, ...p });

  const logOptions = logOptionsFor(data.logSettings);
  const rfDrivers = RF_DRIVERS.includes(data.rfDriverName) ? RF_DRIVERS : [...RF_DRIVERS, data.rfDriverName];

  return (
    <div className="space-y-5">
      {issues.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <div className="font-semibold mb-1">Fix before saving</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {issues.map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
        </div>
      )}

      <div className="wizard-cols">
        {/* Left column — identity and report keys */}
        <div className="space-y-3">
          <Field
            label="Test Case Name" required inline={false} value={data.testCaseName}
            onChange={v => patch({ testCaseName: String(v) })}
            placeholder="required"
          />
          <Field
            label="Log Settings" required type="select" value={data.logSettings}
            options={(Object.keys(LOG_PRESETS) as LogPreset[]).map(k => ({ value: k, label: LOG_PRESETS[k].label }))}
            onChange={v => patch({ logSettings: v as LogPreset })}
            hint={(
              <InfoHint>
                Written to log_options as
                {' '}
                <code className="font-mono text-[11px] break-all">{logOptions}</code>
              </InfoHint>
            )}
          />
          <Field
            label="Success Settings" required type="select" value={data.successSettings}
            options={SUCCESS_SETTINGS.map(s => ({ value: s, label: s }))}
            onChange={v => patch({ successSettings: v as SuccessSetting })}
            hint={<InfoHint>how the test tool judges pass/fail; recorded in the header of ue.cfg</InfoHint>}
          />
        </div>

        {/* Right column — note and lteue-level knobs */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              rows={2}
              className="min-h-0 text-sm"
              value={data.description}
              onChange={e => patch({ description: e.target.value })}
              placeholder="optional note, goes into the header of ue.cfg"
            />
          </div>

          <div className="rounded-md bg-muted/40 px-3 py-2 space-y-2">
            <div className="text-xs font-semibold text-foreground">Advanced</div>
            <Field
              label="Remote API Port" type="number" value={data.comPort} min={1024} max={65535}
              onChange={v => patch({ comPort: Math.round(v) })}
              hint={<InfoHint>com_addr [::]:&lt;port&gt;; 9002 is lteue&apos;s default</InfoHint>}
            />
            <Field
              label="Log Filename" value={data.logFilename}
              onChange={v => patch({ logFilename: String(v) })}
              placeholder="/tmp/ue0.log"
            />
            <Field
              label="RF Driver" type="select" value={data.rfDriverName}
              options={rfDrivers.map(d => ({ value: d, label: d }))}
              onChange={v => patch({ rfDriverName: String(v) })}
            />
            <Field
              label="RF Driver Args" value={data.rfDriverArgs}
              onChange={v => patch({ rfDriverArgs: String(v) })}
              placeholder={derivedRfArgs}
              hint={<InfoHint>leave empty to derive from the RF cards chosen on the Cell step</InfoHint>}
            />
          </div>
        </div>
      </div>

      {/* Field map */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-foreground">Where each parameter goes</div>
        <p className="text-xs text-muted-foreground">
          Every field is embedded in the header of the generated ue.cfg so the test case reopens exactly.
          Rows marked header only have no lteue key; they are recorded for the report and applied by the test tool.
        </p>
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={TH}>Step</TableHead>
                <TableHead className={TH}>Field</TableHead>
                <TableHead className={TH}>Written to</TableHead>
                <TableHead className={TH}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FIELD_MAP.map((row, i) => {
                const firstOfStep = i === 0 || FIELD_MAP[i - 1].step !== row.step;
                const badge = KIND_BADGE[row.kind];
                return (
                  <TableRow key={`${row.step}-${row.field}`} className={firstOfStep && i > 0 ? 'border-t-2 border-t-border' : undefined}>
                    <TableCell className="py-1 text-xs font-medium whitespace-nowrap text-muted-foreground">
                      {firstOfStep ? row.step : ''}
                    </TableCell>
                    <TableCell className="py-1 text-xs">{row.field}</TableCell>
                    <TableCell className="py-1 font-mono text-[11px] text-muted-foreground">{row.target}</TableCell>
                    <TableCell className="py-1">
                      <Badge variant="outline" className={`px-1.5 py-0 text-[10px] font-medium whitespace-nowrap ${badge.className}`}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
