// Stream one file of a saved capture.
//   GET ?id=<id>&file=<name>  (file=manifest.json for the manifest)
// Supports a single byte Range so large IQ downloads can resume.
import type { NextApiRequest, NextApiResponse } from 'next';
import * as fs from 'fs';
import { pipeline } from 'stream/promises';
import { captureFile, readManifest } from '@/modules/capture/server/store';
import { isCaptureId } from '@/modules/capture/server/validate';

export const config = { api: { responseLimit: false } };

const TYPES: Record<string, string> = { '.pcap': 'application/vnd.tcpdump.pcap', '.log': 'text/plain; charset=utf-8', '.json': 'application/json' };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ error: 'Method not allowed' });
  const { id, file } = req.query;
  if (!isCaptureId(id) || typeof file !== 'string') return res.status(400).json({ error: 'id and file are required' });
  const manifest = await readManifest(id);
  if (!manifest) return res.status(404).json({ error: 'No such capture' });
  // Only files the manifest lists (plus the manifest itself) are served.
  if (file !== 'manifest.json' && !manifest.files.some(f => f.name === file)) return res.status(404).json({ error: 'No such file' });

  let full: string;
  try { full = captureFile(id, file); } catch { return res.status(400).json({ error: 'Invalid file name' }); }
  const st = await fs.promises.stat(full).catch(() => null);
  if (!st?.isFile()) return res.status(404).json({ error: 'File missing on disk' });

  const ext = file.slice(file.lastIndexOf('.'));
  res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${id}-${file}"`);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store');

  let start = 0, end = st.size - 1;
  const m = typeof req.headers.range === 'string' ? req.headers.range.match(/^bytes=(\d*)-(\d*)$/) : null;
  if (m && (m[1] || m[2])) {
    if (m[1]) { start = Number(m[1]); if (m[2]) end = Math.min(end, Number(m[2])); }
    else { start = Math.max(0, st.size - Number(m[2])); }
    if (start > end || start >= st.size) {
      res.setHeader('Content-Range', `bytes */${st.size}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${st.size}`);
  } else {
    res.status(200);
  }
  res.setHeader('Content-Length', String(st.size === 0 ? 0 : end - start + 1));
  if (req.method === 'HEAD' || st.size === 0) return res.end();
  try {
    await pipeline(fs.createReadStream(full, { start, end }), res);
  } catch {
    // Client went away mid-download; nothing to clean up.
    res.destroy();
  }
}
