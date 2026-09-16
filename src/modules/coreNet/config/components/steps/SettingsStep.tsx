// Step 5 — Settings.
//
// Name, log preset and note on the left, the ltemme-level knobs and the NAS
// algorithm preference on the right, and under them the field map from
// generateMmeCfg so the operator can see, for every field in the wizard,
// whether it becomes an mme.cfg key, a ue_db entry, or only a line in the
// header. Validation issues, when the parent has any, sit at the top so a
// failed save attempt lands the user where the problems are listed.
'use client';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { InfoHint } from '@/modules/testConfig/components/ConfigBuilder/InfoHint';
import { Field } from '@/modules/testConfig/components/ConfigBuilder/sections/Field';
import { LOG_PRESETS, NAS_ALGOS } from '../../defaults';
import { FIELD_MAP, type FieldMapping } from '../../generateMmeCfg';
import type { LogPreset, SettingsStepData } from '../../types';

interface Props {
  data: SettingsStepData;
  onChange: (next: SettingsStepData) => void;
  issues: string[];
}

const KIND_BADGE: Record<FieldMapping['kind'], { label: string; className: string }> = {
  cfg: { label: 'mme.cfg key', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  db: { label: 'ue_db entry', className: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400' },
  header: { label: 'header only', className: 'border-border bg-muted text-muted-foreground' },
};

const TH = 'h-8 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground';

export function SettingsStep({ data, onChange, issues }: Props) {
  const patch = (p: Partial<SettingsStepData>) => onChange({ ...data, ...p });

  const logOptions = LOG_PRESETS[data.logSettings]?.logOptions ?? '';

  const toggle = (list: number[], value: number, on: boolean): number[] => (
    on ? (list.includes(value) ? list : [...list, value]) : list.filter(v => v !== value)
  );

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
        {/* Column 1 — identity */}
        <div className="space-y-3">
          <Field
            label="Configuration Name" required inline={false} value={data.configName}
            onChange={v => patch({ configName: String(v) })}
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
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              rows={2}
              className="min-h-0 text-sm"
              value={data.description}
              onChange={e => patch({ description: e.target.value })}
              placeholder="optional note, goes into the header of mme.cfg"
            />
          </div>
        </div>

        {/* Column 2 — ltemme-level knobs */}
        <div className="space-y-3">
          <div className="rounded-md bg-muted/40 px-3 py-2 space-y-2">
            <div className="text-xs font-semibold text-foreground">Advanced</div>
            <Field
              label="Remote API Port" type="number" value={data.comPort} min={1024} max={65535}
              onChange={v => patch({ comPort: Math.round(v) })}
              hint={<InfoHint>com_addr 0.0.0.0:&lt;port&gt;; 9000 is ltemme&apos;s default</InfoHint>}
            />
            <Field
              label="Log Filename" value={data.logFilename}
              onChange={v => patch({ logFilename: String(v) })}
              placeholder={`/tmp/${data.configName || 'config'}.log`}
            />
            <Field
              label="Licence Server" value={data.licenseServerAddr}
              onChange={v => patch({ licenseServerAddr: String(v).trim() })}
            />
            <Field
              label="Licence Tag" value={data.licenseTag}
              onChange={v => patch({ licenseTag: String(v).trim() })}
              hint={<InfoHint>rnd-mme on the lab bench.</InfoHint>}
            />

            <NasPref
              label="NAS Cipher Preference"
              values={data.nasCipherPref}
              onToggle={(value, on) => patch({ nasCipherPref: toggle(data.nasCipherPref, value, on) })}
            />
            <NasPref
              label="NAS Integrity Preference"
              values={data.nasIntegPref}
              onToggle={(value, on) => patch({ nasIntegPref: toggle(data.nasIntegPref, value, on) })}
            />
          </div>
        </div>
      </div>

      {/* Field map */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-foreground">Where each parameter goes</div>
        <p className="text-xs text-muted-foreground">
          Every field is embedded in the header of the generated mme.cfg so the configuration reopens exactly.
          Rows marked header only have no ltemme key.
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

/** Checkbox rows over NAS_ALGOS; the order of the array is the preference. */
function NasPref({ label, values, onToggle }: {
  label: string;
  values: number[];
  onToggle: (value: number, on: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <Label className="text-xs text-muted-foreground w-[116px] shrink-0 leading-tight flex items-center gap-1 pt-1">
        <span>{label}</span>
        <InfoHint>Most preferred first. EEA0/EIA0 are always implicit and need not be listed.</InfoHint>
      </Label>
      <div className="flex-1 min-w-0 space-y-1">
        {NAS_ALGOS.map(algo => (
          <label key={algo.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox
              checked={values.includes(algo.value)}
              onCheckedChange={v => onToggle(algo.value, !!v)}
            />
            {algo.label}
          </label>
        ))}
        <div className="font-mono text-[11px] text-muted-foreground">
          [{values.join(', ')}]
        </div>
      </div>
    </div>
  );
}
