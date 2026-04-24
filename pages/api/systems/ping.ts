import { NextApiRequest, NextApiResponse } from 'next';
import * as net from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { host, port = 22, timeoutMs = 3000 } = req.body ?? {};
    if (!host) return res.status(400).json({ error: 'host is required' });

    // Validate host to prevent command injection in the ICMP ping branch
    if (!/^[a-zA-Z0-9.:_-]+$/.test(String(host))) {
        return res.status(400).json({ error: 'invalid host format' });
    }

    const hostStr = String(host);
    const portNum = Number(port);
    const timeoutNum = Number(timeoutMs);

    // Run ICMP ping and TCP probe in parallel
    const [icmpAlive, tcpOpen] = await Promise.all([
        icmpPing(hostStr, timeoutNum),
        tcpProbe(hostStr, portNum, timeoutNum),
    ]);

    // reachable keeps backwards compat: true only when TCP port is open
    res.status(200).json({
        host: hostStr,
        port: portNum,
        reachable: tcpOpen,
        icmpAlive,
        tcpOpen,
    });
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

async function icmpPing(host: string, timeoutMs: number): Promise<boolean> {
    try {
        const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000));
        const cmd = process.platform === 'win32'
            ? `ping -n 1 -w ${timeoutMs} ${host}`
            : `ping -c 1 -W ${timeoutSec} ${host}`;
        const { stdout } = await execAsync(cmd, { timeout: timeoutMs + 1000 });
        // Windows prints "TTL=" on success, Linux prints "1 received"
        return /TTL=|bytes from|ttl=/i.test(stdout);
    } catch {
        return false;
    }
}
