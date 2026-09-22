// Saved Mobility Scenario results (data/scenario-runs/<id>.json).
//   GET ?scenarioId=&linkedTestId=&limit=   → { runs: RunSummary[] }
//   GET ?id=                                → { run }
//   GET ?id=&format=csv|json                → file download
//   DELETE ?id=
// A file still saying "running" whose run is no longer in memory was cut off
// by a server restart; it is reported as state "error".
import type { NextApiRequest, NextApiResponse } from 'next';
import { deleteRun, getRun, listRuns, runToCsv } from '@/modules/scenarios/server/store';
import { isActive } from '@/modules/scenarios/server/runner';
import type { RunSummary } from '@/modules/scenarios/types';

const LIVE = new Set(['preflight', 'running', 'teardown']);
function fixStale<T extends RunSummary>(r: T): T {
  if (LIVE.has(r.state) && !isActive(r.id)) return { ...r, state: 'error', error: r.error ?? 'Interrupted (server restarted during the run)' };
  return r;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'DELETE') {
      await deleteRun(String(req.query.id ?? ''));
      return res.status(200).json({ success: true });
    }
    if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (id) {
      const run = await getRun(id);
      if (!run) return res.status(404).json({ success: false, error: 'Run not found' });
      const fixed = fixStale(run);
      const format = req.query.format;
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="mobility-${fixed.scenarioId}-${fixed.id}.csv"`);
        return res.status(200).send(runToCsv(fixed));
      }
      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="mobility-${fixed.scenarioId}-${fixed.id}.json"`);
        return res.status(200).send(JSON.stringify(fixed, null, 2));
      }
      return res.status(200).json({ success: true, run: fixed });
    }
    const runs = await listRuns({
      scenarioId: typeof req.query.scenarioId === 'string' ? req.query.scenarioId : undefined,
      linkedTestId: typeof req.query.linkedTestId === 'string' ? req.query.linkedTestId : undefined,
      limit: Number(req.query.limit) || undefined,
    });
    return res.status(200).json({ success: true, runs: runs.map(fixStale) });
  } catch (e: any) {
    return res.status(200).json({ success: false, error: e?.message || 'Could not read mobility runs' });
  }
}
