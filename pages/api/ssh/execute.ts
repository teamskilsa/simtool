// pages/api/ssh/execute.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { NodeSSH } from 'node-ssh';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { host, port, username, privateKey, command } = req.body;

  const ssh = new NodeSSH();

  try {
    await ssh.connect({
      host,
      port,
      username,
      privateKey
    });

    const result = await ssh.execCommand(command);
    
    res.status(200).json({
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  } finally {
    ssh.dispose();
  }
}
