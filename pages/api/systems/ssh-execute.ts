import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { host, port = 22, username, password, privateKey, passphrase, command } = req.body ?? {};

    if (!host || !username) {
        return res.status(400).json({ error: 'host and username are required' });
    }
    if (!command) {
        return res.status(400).json({ error: 'command is required' });
    }
    if (!password && !privateKey) {
        return res.status(400).json({ error: 'password or privateKey is required' });
    }

    const ssh = new NodeSSH();
    try {
        await ssh.connect({
            host: String(host),
            port: Number(port),
            username: String(username),
            ...(privateKey ? { privateKey: String(privateKey), passphrase } : { password: String(password) }),
            readyTimeout: 8000,
        });
        const result = await ssh.execCommand(String(command));
        res.status(200).json({
            success: true,
            output: result.stdout || result.stderr || '',
            stdout: result.stdout,
            stderr: result.stderr,
            code: result.code,
        });
    } catch (error: any) {
        res.status(200).json({ success: false, error: error?.message || 'SSH command execution failed' });
    } finally {
        ssh.dispose();
    }
}
