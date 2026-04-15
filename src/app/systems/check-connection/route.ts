// app/systems/check-connection/route.ts
import { NextResponse } from 'next/server';
import { Client } from 'ssh2';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ip, username, password } = body;

    console.log('Testing connection for:', { ip, username, hasPassword: !!password });

    // Basic validation
    if (!ip || !username || !password) {
      return NextResponse.json({ 
        success: false, 
        error: 'IP address, username, and password are required' 
      }, { status: 400 });
    }

    // Test SSH connection
    const sshResult = await testSSHConnection(ip, username, password);
    
    return NextResponse.json({
      success: sshResult.success,
      details: {
        canPing: true,
        sshAvailable: true,
        credentialsValid: sshResult.success
      },
      error: sshResult.error
    });

  } catch (error) {
    console.error('Connection check error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection check failed' 
    }, { status: 500 });
  }
}

async function testSSHConnection(ip: string, username: string, password: string) {
  return new Promise<{success: boolean, error?: string}>((resolve) => {
    const conn = new Client();
    
    const timeout = setTimeout(() => {
      conn.end();
      resolve({ success: false, error: 'Connection timeout' });
    }, 5000);

    conn.on('ready', () => {
      clearTimeout(timeout);
      conn.end();
      resolve({ success: true });
    }).on('error', (err) => {
      clearTimeout(timeout);
      resolve({ success: false, error: err.message });
    }).connect({
      host: ip,
      port: 22,
      username,
      password,
      readyTimeout: 4000,
    });
  });
}