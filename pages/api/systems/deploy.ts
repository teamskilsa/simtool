import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';
import * as fs from 'fs/promises';
import * as path from 'path';

const AGENT_PORT = parseInt(process.env.AGENT_PORT || '9050', 10);
const REMOTE_BASE = process.env.REMOTE_BASE || 'simtool/version_1';
const REMOTE_FILE = 'server.js';

// Where the bundled agent lives on this (Next.js) host
const AGENT_BUNDLE_PATH =
    process.env.AGENT_BUNDLE_PATH ||
    path.join(process.cwd(), 'agent', 'dist', 'server.js');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { host, port = 22, username, password, privateKey, passphrase } = req.body ?? {};

    if (!host || !username) return res.status(400).json({ error: 'host and username are required' });
    if (!password && !privateKey) return res.status(400).json({ error: 'password or privateKey is required' });

    const steps: Array<{ name: string; ok: boolean; detail?: string }> = [];
    const ssh = new NodeSSH();

    try {
        // Verify local bundle exists first
        try {
            await fs.access(AGENT_BUNDLE_PATH);
        } catch {
            return res.status(500).json({
                success: false,
                error: `Agent bundle not found at ${AGENT_BUNDLE_PATH}. Run 'npm run build' in the agent/ directory.`,
            });
        }

        // Step 1: connect
        await ssh.connect({
            host: String(host),
            port: Number(port),
            username: String(username),
            ...(privateKey ? { privateKey: String(privateKey), passphrase } : { password: String(password) }),
            readyTimeout: 8000,
        });
        steps.push({ name: 'ssh-connect', ok: true });

        // Step 2: resolve remote home dir for the connected user
        const homeRes = await ssh.execCommand('printf %s "$HOME"');
        const remoteHome = homeRes.stdout.trim();
        if (!remoteHome || homeRes.code !== 0) {
            return res.status(200).json({ success: false, steps, error: 'Could not resolve $HOME on target' });
        }
        const remoteDir = path.posix.join(remoteHome, REMOTE_BASE);
        steps.push({ name: 'resolve-home', ok: true, detail: remoteDir });

        // Step 3: check node
        const nodeCheck = await ssh.execCommand('command -v node && node --version');
        const nodeOk = nodeCheck.code === 0;
        steps.push({
            name: 'node-check',
            ok: nodeOk,
            detail: nodeOk ? nodeCheck.stdout.trim() : 'node not found on target',
        });
        if (!nodeOk) {
            return res.status(200).json({ success: false, steps, error: 'node is required on target but was not found' });
        }

        // Step 4: mkdir ~/simtool/version_1
        const mkdir = await ssh.execCommand(`mkdir -p '${remoteDir}'`);
        steps.push({ name: 'mkdir', ok: mkdir.code === 0, detail: mkdir.stderr || remoteDir });
        if (mkdir.code !== 0) return res.status(200).json({ success: false, steps });

        // Step 5: kill any previous agent on this port (ignore errors)
        await ssh.execCommand(`(fuser -k ${AGENT_PORT}/tcp 2>/dev/null) || (pkill -f 'node .*${REMOTE_FILE}' 2>/dev/null) || true`);
        steps.push({ name: 'cleanup-old', ok: true });

        // Step 6: SCP the bundle
        const remotePath = path.posix.join(remoteDir, REMOTE_FILE);
        await ssh.putFile(AGENT_BUNDLE_PATH, remotePath);
        steps.push({ name: 'scp-bundle', ok: true, detail: remotePath });

        // Step 7: start detached
        const startCmd = `nohup node ${remotePath} > '${remoteDir}/agent.log' 2>&1 & disown; sleep 1; pgrep -f '${REMOTE_FILE}' | head -1`;
        const startRes = await ssh.execCommand(`bash -lc "${startCmd.replace(/"/g, '\\"')}"`);
        const pid = startRes.stdout.trim();
        steps.push({ name: 'start-agent', ok: !!pid, detail: pid ? `pid=${pid}` : startRes.stderr });
        if (!pid) return res.status(200).json({ success: false, steps });

        // Step 8: verify /api/health
        let healthy = false;
        let healthDetail = '';
        for (let i = 0; i < 6; i++) {
            await new Promise((r) => setTimeout(r, 800));
            try {
                const ac = new AbortController();
                const t = setTimeout(() => ac.abort(), 2000);
                const resp = await fetch(`http://${host}:${AGENT_PORT}/api/health`, { signal: ac.signal });
                clearTimeout(t);
                if (resp.ok) {
                    healthDetail = await resp.text();
                    healthy = true;
                    break;
                }
            } catch (e: any) {
                healthDetail = e?.message || 'fetch failed';
            }
        }
        steps.push({ name: 'verify-health', ok: healthy, detail: healthDetail });

        return res.status(200).json({ success: healthy, steps });
    } catch (error: any) {
        return res.status(200).json({ success: false, error: error?.message || 'deploy failed', steps });
    } finally {
        ssh.dispose();
    }
}
