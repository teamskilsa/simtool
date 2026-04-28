// Proxy route: fetches config list / config content from the Amarisoft agent running
// on a remote callbox. This avoids CORS issues that arise when the browser tries to
// hit http://{callbox-ip}:9050 directly from localhost:3000.
//
// GET  /api/systems/remote-configs?host=x&port=9050&module=enb          → list
// GET  /api/systems/remote-configs?host=x&port=9050&module=enb&filename=enb.cfg → content

import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { host, port = '9050', module, filename, path: customPath } = req.query;

  if (!host || !module) {
    return res.status(400).json({ error: 'host and module are required' });
  }

  const base = `http://${host}:${port}`;

  try {
    let url: string;
    if (filename) {
      // Fetch single config content
      url = `${base}/api/nodes/configs/${module}/${filename}`;
      if (customPath) url += `?path=${encodeURIComponent(String(customPath))}`;
    } else {
      // Fetch config list
      url = `${base}/api/nodes/configs/${module}/list`;
      if (customPath) url += `?path=${encodeURIComponent(String(customPath))}`;
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    const upstream = await fetch(url, { signal: ac.signal });
    clearTimeout(timer);

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return res.status(upstream.status).json({
        error: `Agent returned ${upstream.status}`,
        detail: text.slice(0, 200),
      });
    }

    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (error: any) {
    const isTimeout = error?.name === 'AbortError';
    return res.status(503).json({
      error: isTimeout
        ? `Timed out connecting to agent at ${host}:${port}`
        : `Cannot reach agent at ${host}:${port} — ${error?.message || 'unknown error'}`,
    });
  }
}
