// Poll an Amarisoft license server (`ltelicense`) over its remote-API
// WebSocket and return the list of issued licenses.
//
// The license server speaks WebSocket on its remote-API port (9006 by
// default for `ltelicense`, 9050 in older configs). The "list" message
// returns an array of license entries. Optional auth: when `com_password`
// is set on the server the first frame is an `authenticate` challenge;
// the client responds with HMAC-SHA256("<type>:<password>:<name>", challenge).
// If `unsecure: true`, the password is sent plaintext. We support the
// secure flow first; fall back to unsecure if challenge omits a `name`.
//
// Reference: https://tech-academy.amarisoft.com/ltelicense.doc

import { NextApiRequest, NextApiResponse } from 'next';
import WebSocket from 'ws';
import * as crypto from 'crypto';

interface PollRequest {
  host: string;
  port?: number;          // defaults to 9006
  password?: string;      // optional; only needed if server requires auth
  tag?: string;           // optional filter passed to {message:"list", tag}
  full?: boolean;         // include extra detail in response
  ssl?: boolean;          // wss:// vs ws://; default false
  timeoutMs?: number;     // default 8000
}

interface LicenseEntry {
  uid?: string;
  products?: string;       // comma-separated, e.g. "lteenb,lteue"
  origin?: string;
  tag?: string;
  max?: number;
  version?: string;
  connections?: Array<{
    product?: string;
    name?: string;
    address?: string;
    lifetime?: number;
    shared_params?: Record<string, unknown>;
  }>;
  shared_params?: Record<string, unknown>;
  [k: string]: unknown;
}

interface PollResponse {
  success: boolean;
  error?: string;
  serverAddress: string;
  /** What the server reported. */
  licenses?: LicenseEntry[];
  /** Set if the server identified itself. */
  serverInfo?: Record<string, unknown>;
  /** Approximate total round-trip time. */
  ms?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = (req.body ?? {}) as PollRequest;
  const { host, port = 9006, password, tag, full, ssl = false, timeoutMs = 8000 } = body;
  if (!host) {
    return res.status(200).json({ success: false, error: 'host is required', serverAddress: '' });
  }

  const url = `${ssl ? 'wss' : 'ws'}://${host}:${port}`;
  const t0 = Date.now();

  try {
    const result = await pollLicenseServer({ url, password, tag, full, timeoutMs });
    return res.status(200).json({
      success: true,
      serverAddress: `${host}:${port}`,
      ms: Date.now() - t0,
      licenses: result.licenses,
      serverInfo: result.serverInfo,
    } satisfies PollResponse);
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      error: err?.message || 'Failed to poll license server',
      serverAddress: `${host}:${port}`,
      ms: Date.now() - t0,
    } satisfies PollResponse);
  }
}

interface ChallengeFrame {
  message: 'authenticate';
  type?: 'sha256' | 'plaintext';
  challenge?: string;
  name?: string;
  ready?: boolean;
  error?: string;
}

interface InternalResult {
  licenses: LicenseEntry[];
  serverInfo?: Record<string, unknown>;
}

async function pollLicenseServer(opts: {
  url: string;
  password?: string;
  tag?: string;
  full?: boolean;
  timeoutMs: number;
}): Promise<InternalResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(opts.url, {
      handshakeTimeout: Math.min(opts.timeoutMs, 5000),
      // Skip cert checks for self-signed certs that are common on lab servers.
      rejectUnauthorized: false,
    });

    let listSent = false;
    let resolved = false;
    const finish = (ok: boolean, value: any) => {
      if (resolved) return;
      resolved = true;
      try { ws.close(); } catch { /* already closed */ }
      ok ? resolve(value) : reject(value);
    };
    const timer = setTimeout(
      () => finish(false, new Error(`Timed out after ${opts.timeoutMs}ms — server didn't respond`)),
      opts.timeoutMs,
    );

    ws.on('open', () => {
      // Some servers prompt with `authenticate` first; others accept
      // `list` immediately. We wait briefly to see if a challenge
      // arrives before sending — the "open then nothing" path is
      // handled by sending list() if no challenge after 250ms.
      setTimeout(() => {
        if (!listSent && !resolved) sendList();
      }, 250);
    });

    const sendList = () => {
      listSent = true;
      const msg: any = { message: 'list', message_id: 'simtool-list' };
      if (opts.tag) msg.tag = opts.tag;
      if (opts.full) msg.full = true;
      ws.send(JSON.stringify(msg));
    };

    ws.on('message', (data: WebSocket.RawData) => {
      let frame: any;
      try { frame = JSON.parse(data.toString()); }
      catch { return; }

      // ── Handle authenticate challenge ──────────────────────────────
      if (frame.message === 'authenticate' && !frame.ready) {
        const ch = frame as ChallengeFrame;
        if (!opts.password) {
          finish(false, new Error('Server requires authentication but no password provided'));
          return;
        }
        try {
          let res: string;
          if (ch.type === 'plaintext') {
            res = opts.password;
          } else {
            // type=sha256 (default)
            const data = `${ch.type ?? 'sha256'}:${opts.password}:${ch.name ?? ''}`;
            res = crypto.createHmac('sha256', String(ch.challenge ?? ''))
              .update(data)
              .digest('hex');
          }
          ws.send(JSON.stringify({ message: 'authenticate', res }));
        } catch (e: any) {
          finish(false, new Error(`Auth signing failed: ${e?.message ?? e}`));
        }
        return;
      }

      // ── Auth accepted ──────────────────────────────────────────────
      if (frame.message === 'authenticate' && frame.ready) {
        if (!listSent) sendList();
        return;
      }

      // ── Auth rejected ──────────────────────────────────────────────
      if (frame.message === 'authenticate' && frame.error) {
        finish(false, new Error(`Auth rejected by server: ${frame.error}`));
        return;
      }

      // ── List response ──────────────────────────────────────────────
      if (frame.message === 'list' && frame.message_id === 'simtool-list') {
        if (frame.error) {
          finish(false, new Error(`Server returned error: ${frame.error}`));
          return;
        }
        clearTimeout(timer);
        const { licenses, ...rest } = frame;
        finish(true, {
          licenses: Array.isArray(licenses) ? licenses : [],
          serverInfo: Object.keys(rest).length > 0 ? rest : undefined,
        } satisfies InternalResult);
        return;
      }
    });

    ws.on('error', (err: Error) => finish(false, new Error(`WebSocket error: ${err.message}`)));
    ws.on('close', (code, reason) => {
      if (!resolved) {
        const why = reason?.toString() || `code ${code}`;
        finish(false, new Error(`Connection closed before list response (${why})`));
      }
    });
  });
}
