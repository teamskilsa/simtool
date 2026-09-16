// Step 4 — IMS & Voice.
//
// Off, this step writes nothing at all — no ims_list, no VoPS flags, no
// emergency numbers — so the switch at the top is the whole story and the
// rest of the form only appears when it is on. On, the IMS server and the
// VoPS flags sit on the left, the Rx interface toward the P-CSCF and the
// emergency number list on the right.
'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InfoHint } from '@/modules/testConfig/components/ConfigBuilder/InfoHint';
import { Field } from '@/modules/testConfig/components/ConfigBuilder/sections/Field';
import { QCI_OPTIONS } from '../../defaults';
import type { EmergencyNumber, ImsStepData } from '../../types';

const BOOL_OPTIONS = [{ value: 'False', label: 'False' }, { value: 'True', label: 'True' }];

const TH = 'h-8 px-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground';
const TD = 'px-2 py-1 text-xs';

function parseCategory(value: string): number {
  const clean = value.trim().replace(/^0x/i, '');
  const n = parseInt(clean || '0', 16);
  return Number.isFinite(n) ? Math.max(0, Math.min(0xff, n)) : 0;
}

export function ImsStep({ data, onChange }: { data: ImsStepData; onChange: (next: ImsStepData) => void }) {
  const patch = (p: Partial<ImsStepData>) => onChange({ ...data, ...p });

  const patchNumber = (idx: number, p: Partial<EmergencyNumber>) => {
    patch({ emergencyNumbers: data.emergencyNumbers.map((n, i) => (i === idx ? { ...n, ...p } : n)) });
  };

  return (
    <div className="space-y-5">
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <Switch checked={data.enabled} onCheckedChange={v => patch({ enabled: !!v })} />
        <span>IMS and voice enabled</span>
      </label>

      {!data.enabled ? (
        <div className="text-xs text-muted-foreground">
          IMS is off. No ims_list, VoPS flags or emergency numbers are written, and the UE cannot register for voice.
        </div>
      ) : (
        <div className="wizard-cols">
          {/* Column 1 — the IMS server */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-foreground">IMS server</div>
            <Field
              label="IMS Address" required value={data.imsAddr}
              onChange={v => patch({ imsAddr: String(v).trim() })}
            />
            <Field
              label="Bind Address" required value={data.bindAddr}
              onChange={v => patch({ bindAddr: String(v).trim() })}
            />

            <div className="rounded-md bg-muted/40 px-3 py-2 space-y-2">
              <div className="text-xs font-semibold text-foreground">Voice over PS</div>
              <Field
                label="VoPS on EPS" type="select" value={data.vopsEps ? 'True' : 'False'}
                options={BOOL_OPTIONS}
                onChange={v => patch({ vopsEps: v === 'True' })}
              />
              <Field
                label="VoPS on 5GS (3GPP)" type="select" value={data.vops5gs ? 'True' : 'False'}
                options={BOOL_OPTIONS}
                onChange={v => patch({ vops5gs: v === 'True' })}
              />
              <Field
                label="VoPS on 5GS (non-3GPP)" type="select" value={data.vops5gsN3gpp ? 'True' : 'False'}
                options={BOOL_OPTIONS}
                onChange={v => patch({ vops5gsN3gpp: v === 'True' })}
              />
            </div>
          </div>

          {/* Column 2 — Rx interface and emergency numbers */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-foreground">Rx interface</div>
            <Field
              label="Rx Enabled" type="select" value={data.rxEnabled ? 'True' : 'False'}
              options={BOOL_OPTIONS}
              onChange={v => patch({ rxEnabled: v === 'True' })}
              hint={<InfoHint>The Rx interface lets the P-CSCF ask the core for dedicated voice/video bearers.</InfoHint>}
            />
            {data.rxEnabled && (
              <>
                <Field
                  label="Rx Bind Address" required value={data.rxBindAddr}
                  onChange={v => patch({ rxBindAddr: String(v).trim() })}
                />
                <Field
                  label="QCI Audio" type="select" value={data.rxQciAudio}
                  options={QCI_OPTIONS}
                  onChange={v => patch({ rxQciAudio: Number(v) })}
                />
                <Field
                  label="QCI Video" type="select" value={data.rxQciVideo}
                  options={QCI_OPTIONS}
                  onChange={v => patch({ rxQciVideo: Number(v) })}
                />
              </>
            )}

            <div className="rounded-md bg-muted/40 px-3 py-2 space-y-2">
              <div className="text-xs font-semibold text-foreground">Emergency numbers</div>
              <div className="rounded-md border border-border bg-background overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={TH}>Digits</TableHead>
                      <TableHead className={TH}>
                        <span className="inline-flex items-center gap-1">
                          Category
                          <InfoHint>
                            Service-category bits, 3GPP 24.008 table 10.5.135d: bit 1 Police, 2 Ambulance,
                            3 Fire, 4 Marine, 5 Mountain rescue. 0x1f means all of them.
                          </InfoHint>
                        </span>
                      </TableHead>
                      <TableHead className={TH}></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.emergencyNumbers.map((n, i) => (
                      <TableRow key={i}>
                        <TableCell className={TD}>
                          <Input
                            className="h-7 w-24 text-xs font-mono" value={n.digits}
                            onChange={e => patchNumber(i, { digits: e.target.value.replace(/\D/g, '') })}
                            placeholder="112"
                          />
                        </TableCell>
                        <TableCell className={TD}>
                          <Input
                            className="h-7 w-24 text-xs font-mono"
                            value={`0x${n.category.toString(16)}`}
                            onChange={e => patchNumber(i, { category: parseCategory(e.target.value) })}
                          />
                        </TableCell>
                        <TableCell className={TD}>
                          <button
                            type="button"
                            title="Remove number"
                            onClick={() => patch({ emergencyNumbers: data.emergencyNumbers.filter((_, j) => j !== i) })}
                            className="p-1 rounded text-muted-foreground hover:bg-red-500 hover:text-white"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button
                type="button" variant="outline" size="sm" className="text-xs"
                onClick={() => patch({ emergencyNumbers: [...data.emergencyNumbers, { category: 0x1f, digits: '' }] })}
              >
                Add number
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
