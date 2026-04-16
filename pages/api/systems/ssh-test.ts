import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { host, port = 22, username, password, privateKey, passphrase } = req.body ?? {};

    if (!host || !username) {
        return res.status(400).json({ error: 'host and username are required' });
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
        const whoami = await ssh.execCommand('whoami');
        const uname = await ssh.execCommand('uname -a');
        res.status(200).json({
            success: true,
            whoami: whoami.stdout.trim(),
            uname: uname.stdout.trim(),
        });
    } catch (error: any) {
        res.status(200).json({ success: false, error: error?.message || 'SSH connection failed' });
    } finally {
        ssh.dispose();
    }
}
