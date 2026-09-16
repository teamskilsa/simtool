// Step 3 — Subscribers (ue_db).
//
// One chip per range, with the total and the "separate database file"
// switch on the right of the chip row; the active range's form in three
// columns (identity · credentials · IMS identities) and a preview of the
// subscribers the range expands to underneath. The preview mirrors
// expandSubscribers() in derive.ts exactly, so what it shows is what the
// generated ue_db contains.
'use client';

import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { InfoHint } from '@/modules/testConfig/components/ConfigBuilder/InfoHint';
import { Field } from '@/modules/testConfig/components/ConfigBuilder/sections/Field';
import { GroupChips } from '@/modules/ueSim/testcase/components/GroupChips';
import { makeSubscriberRange } from '../../defaults';
import { imsDomainFor, incrementDigits, incrementHex, incrementMsisdn, plmnString } from '../../derive';
import type { NetworkStepData, SimAlgorithm, SubscriberRange, SubscriberStepData } from '../../types';

interface Props {
  data: SubscriberStepData;
  network: NetworkStepData;
  activeIdx: number;
  onActiveChange: (i: number) => void;
  onChange: (next: SubscriberStepData) => void;
}

const MAX_RANGES = 8;
const PREVIEW_HEAD = 5;

const BOOL_OPTIONS = [{ value: 'False', label: 'False' }, { value: 'True', label: 'True' }];

const ALGOS: { value: SimAlgorithm; label: string }[] = [
  { value: 'xor', label: 'xor' },
  { value: 'milenage', label: 'milenage' },
  { value: 'tuak', label: 'tuak' },
];

const OP_TYPES: { value: SubscriberRange['opType']; label: string }[] = [
  { value: 'none', label: 'none' },
  { value: 'OP', label: 'OP' },
  { value: 'OPc', label: 'OPc' },
];

const TH = 'h-8 px-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground';
const TD = 'px-2 py-1 text-xs';

interface PreviewRow {
  index: number;
  imsi: string;
  K: string;
  msisdn: string;
  impu: string;
}

/** The same expansion expandSubscribers() performs, for one range. */
function previewAt(r: SubscriberRange, i: number, fallbackDomain: string): PreviewRow {
  const imsi = incrementDigits(r.startingImsi, i);
  const domain = r.imsDomain.trim() || fallbackDomain;
  const msisdn = incrementMsisdn(r.msisdnBase, i);
  const shortNumber = r.shortNumberBase.trim() ? incrementDigits(r.shortNumberBase, i) : '';
  const impu = [
    imsi,
    ...(msisdn ? [`tel:${msisdn}`, `sip:${msisdn}`] : []),
    ...(shortNumber ? [`tel:${shortNumber}`] : []),
  ];
  return {
    index: i,
    imsi,
    K: incrementHex(r.K, i * r.incrementK),
    msisdn,
    impu: impu.join(', '),
  };
}

function truncate(value: string, max = 40): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function SubscriberStep({ data, network, activeIdx, onActiveChange, onChange }: Props) {
  const range = data.ranges[activeIdx] ?? data.ranges[0];

  const patch = (p: Partial<SubscriberRange>) => {
    onChange({ ...data, ranges: data.ranges.map((r, i) => (i === activeIdx ? { ...r, ...p } : r)) });
  };

  const addRange = () => {
    if (data.ranges.length >= MAX_RANGES) return;
    const next = makeSubscriberRange(data.ranges.length, {
      simAlgo: range.simAlgo, K: range.K, opType: range.opType, opValue: range.opValue,
      imsEnabled: range.imsEnabled, imsDomain: range.imsDomain, imsPassword: range.imsPassword,
      // Start where the previous range ends so IMSIs never collide.
      startingImsi: incrementDigits(range.startingImsi, Math.max(1, Math.floor(range.count))),
      msisdnBase: incrementMsisdn(range.msisdnBase, Math.max(1, Math.floor(range.count))),
    });
    onChange({ ...data, ranges: [...data.ranges, next] });
    onActiveChange(data.ranges.length);
  };

  const removeRange = (idx: number) => {
    if (data.ranges.length <= 1) return;
    const ranges = data.ranges.filter((_, i) => i !== idx).map((r, i) => ({ ...r, id: i }));
    onChange({ ...data, ranges });
    onActiveChange(Math.max(0, Math.min(activeIdx, ranges.length - 1)));
  };

  const total = data.ranges.reduce((s, r) => s + Math.max(0, Math.floor(r.count)), 0);
  const plmn = plmnString(network.mcc, network.mnc);
  const fallbackDomain = imsDomainFor(network.mcc, network.mnc);
  const count = Math.max(0, Math.floor(range.count));
  const firstImsi = incrementDigits(range.startingImsi, 0);
  const lastImsi = incrementDigits(range.startingImsi, Math.max(0, count - 1));
  const imsiMismatch = !range.startingImsi.startsWith(plmn);

  const headRows = Array.from({ length: Math.min(PREVIEW_HEAD, count) }, (_, i) => previewAt(range, i, fallbackDomain));
  const showGap = count > PREVIEW_HEAD + 1;
  const tailRow = count > PREVIEW_HEAD ? previewAt(range, count - 1, fallbackDomain) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <GroupChips
          label="Range"
          count={data.ranges.length}
          active={activeIdx}
          onSelect={onActiveChange}
          onAdd={addRange}
          onRemove={removeRange}
          max={MAX_RANGES}
          detail={i => `${data.ranges[i].count} UE`}
        />
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">Total subscribers:</span>
            <span className="font-semibold text-primary">{total}</span>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Switch checked={data.separateFile} onCheckedChange={v => onChange({ ...data, separateFile: !!v })} />
            <span>Separate database file</span>
          </label>
          {data.separateFile && (
            <div className="w-[220px]">
              <Field
                label="Filename" value={data.includeFilename}
                onChange={v => onChange({ ...data, includeFilename: String(v).trim() })}
                placeholder="ue_db.cfg"
                hint={<InfoHint>Written as include &quot;&lt;file&gt;&quot; in mme.cfg, the way the bench keeps 1000 subscribers out of the main file.</InfoHint>}
              />
            </div>
          )}
        </div>
      </div>

      <div className="wizard-cols">
        {/* Column 1 — identity */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-foreground">Identity</div>
          <Field
            label="Count" required type="number" value={range.count} min={1} max={5000}
            onChange={v => patch({ count: Math.max(1, Math.round(v)) })}
          />
          <Field
            label="Starting IMSI" required value={range.startingImsi}
            onChange={v => patch({ startingImsi: String(v).replace(/\D/g, '').slice(0, 15) })}
            placeholder="15 digits"
            hint={<InfoHint>First subscriber {firstImsi}, last {lastImsi}.</InfoHint>}
          />
          {imsiMismatch && (
            <div className="pl-[124px] -mt-2 text-[11px] text-destructive">
              Does not start with the PLMN {plmn}; the core will not find this subscriber.
            </div>
          )}
        </div>

        {/* Column 2 — credentials */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-foreground">Credentials</div>
          <Field
            label="Algorithm" required type="select" value={range.simAlgo}
            options={ALGOS}
            onChange={v => patch({ simAlgo: v as SimAlgorithm })}
          />
          <Field
            label="Shared Key (K)" required value={range.K}
            onChange={v => patch({ K: String(v).trim() })}
            placeholder="32 hex chars"
          />
          <Field
            label="Increment K" type="number" value={range.incrementK} min={0}
            onChange={v => patch({ incrementK: Math.max(0, Math.round(v)) })}
            hint={<InfoHint>Added to K per subscriber. 0 means they all share one key.</InfoHint>}
          />
          <Field
            label="OP Type" type="select" value={range.opType}
            options={OP_TYPES}
            disabled={range.simAlgo === 'xor'}
            onChange={v => patch({ opType: v as SubscriberRange['opType'] })}
            hint={range.simAlgo === 'xor'
              ? <InfoHint>XOR authentication needs no operator key, so OP/OPc is not written for this range.</InfoHint>
              : <InfoHint>OP is the operator key; OPc is the per-subscriber form derived from it.</InfoHint>}
          />
          {range.opType !== 'none' && (
            <Field
              label="OP Value" value={range.opValue}
              onChange={v => patch({ opValue: String(v).trim() })}
              placeholder="32 hex chars"
            />
          )}
          <Field label="AMF" value={range.amf} onChange={v => patch({ amf: String(v).trim() })} placeholder="0x9001" />
          <Field label="SQN" value={range.sqn} onChange={v => patch({ sqn: String(v).trim() })} placeholder="000000000000" />
        </div>

        {/* Column 3 — IMS identities */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-foreground">IMS identities</div>
          <Field
            label="IMS Identities" type="select" value={range.imsEnabled ? 'True' : 'False'}
            options={BOOL_OPTIONS}
            onChange={v => patch({ imsEnabled: v === 'True' })}
            hint={<InfoHint>Adds impi, impu, domain and pwd to every subscriber so they can register with IMS.</InfoHint>}
          />
          {range.imsEnabled && (
            <>
              <Field
                label="IMS Domain" value={range.imsDomain}
                onChange={v => patch({ imsDomain: String(v).trim() })}
                placeholder={fallbackDomain}
                hint={<InfoHint>Left empty, the 3GPP form derived from the PLMN is used.</InfoHint>}
              />
              <Field
                label="IMS Password" value={range.imsPassword}
                onChange={v => patch({ imsPassword: String(v) })}
              />
              <Field
                label="MSISDN Base" value={range.msisdnBase}
                onChange={v => patch({ msisdnBase: String(v).trim() })}
                placeholder="+917600000000"
                hint={<InfoHint>Incremented per subscriber.</InfoHint>}
              />
              <Field
                label="Short Number Base" value={range.shortNumberBase}
                onChange={v => patch({ shortNumberBase: String(v).trim() })}
                placeholder="600"
              />
            </>
          )}
        </div>
      </div>

      {/* Preview of the ue_db entries this range expands to */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-foreground">Subscriber preview</div>
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={TH}>IMSI</TableHead>
                <TableHead className={TH}>K</TableHead>
                <TableHead className={TH}>MSISDN</TableHead>
                <TableHead className={TH}>IMPU</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {headRows.map(row => (
                <TableRow key={row.index}>
                  <TableCell className={`${TD} font-mono`}>{row.imsi}</TableCell>
                  <TableCell className={`${TD} font-mono text-muted-foreground`}>{row.K}</TableCell>
                  <TableCell className={`${TD} font-mono`}>{row.msisdn || '—'}</TableCell>
                  <TableCell className={`${TD} font-mono text-muted-foreground`}>
                    {range.imsEnabled ? truncate(row.impu) : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {showGap && (
                <TableRow>
                  <TableCell className={`${TD} text-muted-foreground`} colSpan={4}>
                    … {count - PREVIEW_HEAD - 1} more
                  </TableCell>
                </TableRow>
              )}
              {tailRow && (
                <TableRow key={tailRow.index}>
                  <TableCell className={`${TD} font-mono`}>{tailRow.imsi}</TableCell>
                  <TableCell className={`${TD} font-mono text-muted-foreground`}>{tailRow.K}</TableCell>
                  <TableCell className={`${TD} font-mono`}>{tailRow.msisdn || '—'}</TableCell>
                  <TableCell className={`${TD} font-mono text-muted-foreground`}>
                    {range.imsEnabled ? truncate(tailRow.impu) : '—'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
