// Pre-conformance reports (data/conformance/reports/<id>.json).
//   GET                         → { reports: PlanRunSummary[] }
//   GET ?id=                    → { report: PlanRunView }
//   GET ?id=&format=html|json|csv → download (every format carries the "not certified" disclaimer)
//   DELETE ?id=
// A report still saying "running" whose plan run is no longer in memory was
// cut off by a server restart; it is reported as state "error".
import type { NextApiRequest, NextApiResponse } from 'next';
import { deleteReport, getReport, listReports } from '@/modules/conformance/server/store';
import { getPlanRun, isPlanRunActive } from '@/modules/conformance/server/planRunner';
import { reportToCsv, reportToHtml } from '@/modules/conformance/lib/report';
import type { PlanRunSummary, PlanRunView } from '@/modules/conformance/types';

const LIVE = new Set(['preflight', 'running']);
function fixStale<T extends PlanRunSummary | PlanRunView>(r: T): T {
  if (LIVE.has(r.state) && !isPlanRunActive(r.id)) return { ...r, state: 'error' };
  return r;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'DELETE') {
      const id = String(req.query.id ?? '');
      if (isPlanRunActive(id)) return res.status(200).json({ success: false, error: 'That plan is still running' });
      await deleteReport(id);
      return res.status(200).json({ success: true });
    }
    if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (id) {
      const report = getPlanRun(id) ?? await getReport(id);
      if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
      const r = fixStale(report);
      const name = `pre-conformance-${r.planId}-${r.id}`;
      switch (req.query.format) {
        case 'html':
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          if (req.query.download !== '0') res.setHeader('Content-Disposition', `attachment; filename="${name}.html"`);
          return res.status(200).send(reportToHtml(r));
        case 'csv':
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
          return res.status(200).send(reportToCsv(r));
        case 'json':
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="${name}.json"`);
          return res.status(200).send(JSON.stringify(r, null, 2));
        default:
          return res.status(200).json({ success: true, report: r });
      }
    }
    const reports = (await listReports(Number(req.query.limit) || 200)).map(fixStale);
    return res.status(200).json({ success: true, reports });
  } catch (e: any) {
    return res.status(200).json({ success: false, error: e?.message || 'Could not read reports' });
  }
}
