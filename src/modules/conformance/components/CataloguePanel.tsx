// The pre-conformance catalogue: filter by RAT, category and automation; the
// detail pane shows the spec references, preconditions, procedure and pass
// criteria of the selected case.
'use client';

import { useMemo, useState } from 'react';
import { Hand, ShieldAlert, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Kicker } from '@/components/ui/stat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CATEGORIES, type TestCaseDef } from '../types';
import { CASES, specText } from '../lib/cases';
import { RatBadges } from './shared';

const ALL = 'all';

export function CataloguePanel() {
  const [rat, setRat] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [automation, setAutomation] = useState(ALL);
  const [selected, setSelected] = useState<string>(CASES[0].id);

  const list = useMemo(() => CASES.filter(c =>
    (rat === ALL || c.rat === 'both' || c.rat === rat)
    && (category === ALL || c.category === category)
    && (automation === ALL || c.automation === automation)), [rat, category, automation]);
  const current = CASES.find(c => c.id === selected) ?? list[0];

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-end gap-3 p-3">
        <div className="w-40 space-y-1">
          <Kicker>RAT</Kicker>
          <Select value={rat} onValueChange={setRat}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>NR SA and LTE</SelectItem>
              <SelectItem value="nr">NR SA</SelectItem>
              <SelectItem value="lte">LTE</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-56 space-y-1">
          <Kicker>Category</Kicker>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48 space-y-1">
          <Kicker>Automation</Kicker>
          <Select value={automation} onValueChange={setAutomation}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              <SelectItem value="automatic">Automatic</SelectItem>
              <SelectItem value="operator-prompted">Operator-prompted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="ml-auto max-w-md text-[11px] leading-snug text-muted-foreground">
          References name the 3GPP <em>procedure</em> each check follows. They are not TS 38.523 / 36.523 test cases, and a PASS here does not certify a device.
        </p>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">ID</TableHead>
                <TableHead>Case</TableHead>
                <TableHead className="w-28">RAT</TableHead>
                <TableHead className="w-28">Automation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">No case matches these filters.</TableCell></TableRow>}
              {list.map(c => (
                <TableRow key={c.id} className={cn('cursor-pointer', current?.id === c.id && 'bg-accent')} onClick={() => setSelected(c.id)}>
                  <TableCell className="align-top font-mono text-[11px]">{c.id}</TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{c.title}</span>
                      {c.measurement && <Badge variant="outline" className="h-5 px-1.5 text-[10px]">measurement</Badge>}
                      {c.risky && <Badge variant="warning" className="h-5 px-1.5 text-[10px]">needs confirmation</Badge>}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{c.category}</div>
                  </TableCell>
                  <TableCell className="align-top"><RatBadges rat={c.rat} /></TableCell>
                  <TableCell className="align-top text-xs">
                    <span className="inline-flex items-center gap-1">{c.automation === 'automatic' ? <Zap className="h-3 w-3" /> : <Hand className="h-3 w-3" />}{c.automation}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {current && <CaseDetail c={current} />}
      </div>
    </div>
  );
}

export function CaseDetail({ c }: { c: TestCaseDef }) {
  const Section = ({ title, items }: { title: string; items: string[] }) => (items.length ? (
    <div>
      <Kicker className="mb-1">{title}</Kicker>
      <ul className="list-disc space-y-0.5 pl-4 text-xs leading-snug">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  ) : null);
  return (
    <Card className="space-y-3 p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
          <RatBadges rat={c.rat} />
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{c.category}</Badge>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{c.automation}</Badge>
        </div>
        <h3 className="mt-1 text-base font-semibold">{c.title}</h3>
        <p className="text-sm text-muted-foreground">{c.summary}</p>
      </div>
      {c.risky && (
        <div className="flex gap-2 rounded border border-amber-500/50 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0" /><span><b>Operator confirmation required.</b> {c.risky.confirm}</span>
        </div>
      )}
      <div>
        <Kicker className="mb-1">3GPP procedure reference</Kicker>
        <div className="space-y-0.5 text-xs">
          {(['nr', 'lte'] as const).filter(r => c.specs[r]?.length).map(r => (
            <div key={r}><span className="font-medium">{r === 'nr' ? 'NR SA' : 'LTE'}: </span>{c.specs[r]!.map(specText).join('; ')}</div>
          ))}
        </div>
      </div>
      <Section title="Preconditions" items={c.preconditions} />
      <Section title="Procedure" items={c.procedure} />
      <Section title="Pass criteria" items={c.passCriteria} />
      <Section title="Inconclusive when" items={c.inconclusiveWhen} />
      {c.measurement && <Section title="Measurement" items={[`${c.measurement.stat}(${c.measurement.metric}) in ${c.measurement.unit} ≤ the “${c.params.find(p => p.key === c.measurement!.thresholdParam)?.label ?? c.measurement.thresholdParam}” parameter → PASS, else FAIL.`]} />}
      <Section title="Notes" items={c.notes ?? []} />
      {c.params.length > 0 && (
        <div>
          <Kicker className="mb-1">Parameters (defaults)</Kicker>
          <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            {c.params.map(p => (
              <div key={p.key} className="rounded border border-border px-2 py-1">
                <div className="flex justify-between gap-2"><span className="font-medium">{p.label}</span><span className="num font-mono">{String(p.default)}</span></div>
                <div className="text-[11px] text-muted-foreground">{p.help}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
