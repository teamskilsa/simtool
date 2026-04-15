// app/actions/ssh.ts
'use server';

import { Client } from 'ssh2';

export async function testSSHConnection(
  ip: string,
  username: string,
  password: string
) {
  const conn = new Client();

  try {
    await new Promise((resolve, reject) => {
      conn.on('ready', () => {
        resolve(true);
      }).on('error', (err) => {
        reject(err);
      }).connect({
        host: ip,
        port: 22,
        username,
        password,
        readyTimeout: 5000,
        keepaliveInterval: 10000,
      });
    });

    return {
      success: true,
      message: 'SSH connection successful'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SSH connection failed'
    };
  } finally {
    conn.end();
  }
}
