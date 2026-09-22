// Built-in pre-conformance plans (copied to data/conformance/plans on first use).
import type { TestPlan } from '../types';
import { CASES } from './cases';

const ids = (...list: string[]) => list.map(caseId => ({ caseId }));

export const DEFAULT_PLANS: TestPlan[] = [
  {
    id: 'nr-sa-smoke', name: 'NR SA smoke', rat: 'nr', stopOnFail: false, interCaseMs: 2000,
    description: 'Quick NR SA sanity: PDU session, RRC release, re-establishment after RLF, paging from idle.',
    cases: ids('PC-REG-02', 'PC-RRC-01', 'PC-RRC-02', 'PC-IDLE-01'),
  },
  {
    id: 'nr-sa-mobility-ca', name: 'NR SA mobility & CA', rat: 'nr', stopOnFail: false, interCaseMs: 2000,
    description: 'NR SA handovers (intra-, inter-frequency, A3), registration update on TA change, SCell add/release and MAC CE activation, barring, handover interruption. Built for testDemo-6cell-2x3CC-HO.cfg.',
    cases: ids('PC-MOB-01', 'PC-MOB-02', 'PC-MOB-03', 'PC-MOB-04', 'PC-CA-01', 'PC-CA-02', 'PC-SI-01', 'PC-KPI-01'),
  },
  {
    id: 'lte-smoke', name: 'LTE smoke', rat: 'lte', stopOnFail: false, interCaseMs: 2000,
    description: 'Quick LTE sanity: default bearer, RRC release, re-establishment after RLF, paging from idle, load-balancing TAU.',
    cases: ids('PC-REG-02', 'PC-RRC-01', 'PC-RRC-02', 'PC-IDLE-01', 'PC-MOB-04'),
  },
  {
    id: 'lte-mobility-ca', name: 'LTE mobility & CA', rat: 'lte', stopOnFail: false, interCaseMs: 2000,
    description: 'LTE handovers (intra-, inter-frequency, A3), SCell add/release and MAC CE activation, barring, handover interruption.',
    cases: ids('PC-MOB-01', 'PC-MOB-02', 'PC-MOB-03', 'PC-CA-01', 'PC-CA-02', 'PC-SI-01', 'PC-KPI-01'),
  },
  {
    id: 'full-automatic', name: 'Full (all automatic)', rat: 'auto', stopOnFail: false, interCaseMs: 2000,
    description: 'Every automatic case in the catalogue (the network-initiated detach is excluded: it needs explicit confirmation). Operator-prompted cases are not included.',
    cases: CASES.filter(c => c.automation === 'automatic' && c.defaultInPlans && !c.risky).map(c => ({ caseId: c.id })),
  },
];
