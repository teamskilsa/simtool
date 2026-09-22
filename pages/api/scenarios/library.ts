// Mobility Scenarios library (data/scenarios/<id>.json).
//   GET                               → { scenarios }
//   GET ?id=                          → { scenario }
//   POST { action:'save', scenario }  → { scenario }            (validated)
//   POST { action:'validate', scenario } → { issues }
//   POST { action:'restore', id? }    → restore one / all built-ins
//   DELETE ?id=                       → removes the file
// Lives beside the app-router /api/scenarios (Test Execution's deploy
// scenarios) without clashing: this is /api/scenarios/library.
import type { NextApiRequest, NextApiResponse } from 'next';
import { deleteScenario, getScenario, listScenarios, restoreBuiltin, saveScenario } from '@/modules/scenarios/server/store';
import { validateScenario } from '@/modules/scenarios/lib/validate';
import { MESSAGES, BLOCKED } from '@/modules/scenarios/lib/catalog';
import schema from '@/modules/scenarios/schema/mobility-scenario.schema.json';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      if (req.query.schema !== undefined) return res.status(200).json({ success: true, schema, messages: MESSAGES, blocked: BLOCKED });
      const id = typeof req.query.id === 'string' ? req.query.id : '';
      if (id) {
        const scenario = await getScenario(id);
        return scenario ? res.status(200).json({ success: true, scenario }) : res.status(404).json({ success: false, error: 'Not found' });
      }
      return res.status(200).json({ success: true, scenarios: await listScenarios() });
    }
    if (req.method === 'DELETE') {
      const id = String(req.query.id ?? '');
      await deleteScenario(id);
      return res.status(200).json({ success: true });
    }
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const { action, scenario, id } = req.body ?? {};
    if (action === 'validate') {
      const issues = validateScenario(scenario);
      return res.status(200).json({ success: true, valid: !issues.some(i => i.level === 'error'), issues });
    }
    if (action === 'save') {
      const issues = validateScenario(scenario);
      if (issues.some(i => i.level === 'error')) return res.status(200).json({ success: false, error: 'Scenario has errors', issues });
      const saved = await saveScenario(scenario);
      return res.status(200).json({ success: true, scenario: saved, issues });
    }
    if (action === 'restore') {
      await restoreBuiltin(typeof id === 'string' && id ? id : undefined);
      return res.status(200).json({ success: true, scenarios: await listScenarios() });
    }
    return res.status(400).json({ success: false, error: 'action must be save, validate or restore' });
  } catch (e: any) {
    return res.status(200).json({ success: false, error: e?.message || 'Mobility scenario library request failed', issues: e?.issues });
  }
}
