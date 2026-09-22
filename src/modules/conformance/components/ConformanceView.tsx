// Pre-conformance — 3GPP-procedure-based protocol checks for NR SA and LTE on
// an Amarisoft callbox, with PASS / FAIL / INCONCLUSIVE verdicts, test plans
// and exportable reports. NOT certified conformance: see DISCLAIMER.
//
// Tabs: Catalogue (the cases), Plans (ordered cases + parameters), Run (live,
// with operator prompts), Reports (history + HTML / JSON / CSV).
// Server side: pages/api/conformance/{catalog,plans,run,jobs,reports}; each
// case runs through the Mobility Scenario runner.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { TAB_LIST, TAB_TRIGGER, TAB_TRIGGER_ACTIVE, TAB_TRIGGER_IDLE } from '@/components/ui/tab-styles';
import { cn } from '@/lib/utils';
import type { PlanRunSummary, TestPlan } from '../types';
import { CASES } from '../lib/cases';
import { CataloguePanel } from './CataloguePanel';
import { PlansPanel } from './PlansPanel';
import { RunPlanPanel } from './RunPlanPanel';
import { ReportsPanel } from './ReportsPanel';
import { Disclaimer } from './shared';

type Tab = 'catalogue' | 'plans' | 'run' | 'reports';

export function ConformanceView() {
  const [tab, setTab] = useState<Tab>('catalogue');
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [planId, setPlanId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reportsKey, setReportsKey] = useState(0);
  const [active, setActive] = useState<PlanRunSummary[]>([]);

  const loadPlans = useCallback(async (selectId?: string) => {
    const r = await fetch('/api/conformance/plans').then(x => x.json()).catch(e => ({ success: false, error: e.message }));
    if (!r.success) { setError(r.error ?? 'Could not load the plans'); return; }
    setError(null);
    setPlans(r.plans);
    setPlanId(cur => selectId ?? (cur && r.plans.some((p: TestPlan) => p.id === cur) ? cur : r.plans[0]?.id ?? ''));
  }, []);
  useEffect(() => { loadPlans(); }, [loadPlans]);

  useEffect(() => {
    const poll = () => fetch('/api/conformance/jobs').then(x => x.json()).then(r => r.success && setActive(r.runs.filter((x: PlanRunSummary) => !x.endedAt))).catch(() => {});
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'catalogue', label: `Catalogue (${CASES.length})` },
    { id: 'plans', label: `Plans (${plans.length})` },
    { id: 'run', label: active.length ? 'Run · 1 active' : 'Run' },
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<ClipboardCheck />}
        title="Pre-conformance"
        subtitle="3GPP-procedure checks for NR SA and LTE on the callbox — not certified conformance"
        actions={active.length > 0 ? <Badge variant="success">plan running</Badge> : undefined}
      />
      <Disclaimer />

      <div className={TAB_LIST}>
        {tabs.map(t => (
          <button key={t.id} className={cn(TAB_TRIGGER, tab === t.id ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER_IDLE)} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {error && <Card className="p-3 text-sm text-destructive">{error}</Card>}

      {tab === 'catalogue' && <CataloguePanel />}
      {tab === 'plans' && <PlansPanel plans={plans} onChanged={loadPlans} onRun={id => { setPlanId(id); setTab('run'); }} />}
      {/* Kept mounted so a running plan keeps polling (and its prompts keep popping up) on other tabs. */}
      <div className={tab === 'run' ? '' : 'hidden'}>
        <RunPlanPanel plans={plans} planId={planId} onPlanChange={setPlanId} onFinished={() => setReportsKey(k => k + 1)} />
      </div>
      {tab === 'reports' && <ReportsPanel refreshKey={reportsKey} />}
    </div>
  );
}

export default ConformanceView;
