// GET /api/qa/runs/:runId/cases/:caseId/evidence
//   → fetch the evidence bundle for one case run. Includes the
//     generated cfgs (text) and the captured logs / screen hardcopy
//     / ots.log tail. UI's case-detail panel renders this.
//
// Optional query: ?file=<name>  — fetch a single file's raw text.

import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import { evidenceDir, readEvidenceFile } from '@/modules/qa/store';
import { loadRun } from '@/modules/qa/store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { runId, caseId, file } = req.query;
  if (typeof runId !== 'string' || typeof caseId !== 'string') {
    return res.status(400).json({ error: 'runId and caseId required' });
  }

  // Sanity check: run must exist and reference this case.
  const run = await loadRun(runId);
  if (!run) return res.status(404).json({ error: `unknown runId: ${runId}` });
  const caseRecord = run.cases.find((c) => c.caseId === caseId);
  if (!caseRecord) return res.status(404).json({ error: `case ${caseId} not in run ${runId}` });

  // Single-file fetch.
  if (typeof file === 'string') {
    // Refuse path traversal.
    if (file.includes('/') || file.includes('..')) {
      return res.status(400).json({ error: 'invalid file name' });
    }
    const content = await readEvidenceFile(runId, caseId, file);
    if (content === null) return res.status(404).json({ error: `file not found: ${file}` });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(content);
  }

  // Bundle index.
  const dir = evidenceDir(runId, caseId);
  let files: string[] = [];
  try {
    files = await fs.readdir(dir);
  } catch (e: any) {
    if (e?.code !== 'ENOENT') throw e;
  }
  return res.status(200).json({
    runId,
    caseId,
    case: caseRecord,
    files,
    // Convenience link template the UI can use to GET each file.
    fileUrl: `/api/qa/runs/${runId}/cases/${caseId}/evidence?file={NAME}`,
  });
}
