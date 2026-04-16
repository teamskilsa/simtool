import { NextApiRequest, NextApiResponse } from 'next';
import * as net from 'net';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { host, port = 22, timeoutMs = 3000 } = req.body ?? {};
    if (!host) return res.status(400).json({ error: 'host is required' });

    const reachable = await tcpProbe(String(host), Number(port), Number(timeoutMs));
    res.status(200).json({ host, port, reachable });
}

function tcpProbe(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let done = false;
        const finish = (ok: boolean) => {
            if (done) return;
            done = true;
            socket.destroy();
            resolve(ok);
        };
        socket.setTimeout(timeoutMs);
        socket.once('connect', () => finish(true));
        socket.once('error', () => finish(false));
        socket.once('timeout', () => finish(false));
        socket.connect(port, host);
    });
}
