// Pre-conformance test plans (data/conformance/plans/<id>.json).
//   GET                              → { plans }
//   GET ?id=                         → { plan }
//   POST { action:'save', plan }     → { plan }   (validated)
//   POST { action:'restore', id? }   → restore one / all built-in plans
//   DELETE ?id=
import type { NextApiRequest, NextApiResponse } from 'next';
import { deletePlan, getPlan, listPlans, restorePlans, savePlan, validatePlan } from '@/modules/conformance/server/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      if (id) {
        const plan = await getPlan(id);
        return plan ? res.status(200).json({ success: true, plan }) : res.status(404).json({ success: false, error: 'Not found' });
      }
      return res.status(200).json({ success: true, plans: await listPlans() });
    }
    if (req.method === 'DELETE') {
      await deletePlan(String(req.query.id ?? ''));
      return res.status(200).json({ success: true });
    }
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
    const { action, plan, id } = req.body ?? {};
    if (action === 'validate') {
      const errors = validatePlan(plan);
      return res.status(200).json({ success: true, valid: errors.length === 0, errors });
    }
    if (action === 'save') {
      const errors = validatePlan(plan);
      if (errors.length) return res.status(200).json({ success: false, error: errors.join('; '), errors });
      return res.status(200).json({ success: true, plan: await savePlan(plan) });
    }
    if (action === 'restore') {
      await restorePlans(typeof id === 'string' && id ? id : undefined);
      return res.status(200).json({ success: true, plans: await listPlans() });
    }
    return res.status(400).json({ success: false, error: 'action must be save, validate or restore' });
  } catch (e: any) {
    return res.status(200).json({ success: false, error: e?.message || 'Plan request failed' });
  }
}
