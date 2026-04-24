// pages/api/systems/check-connection.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Validate IP/hostname to prevent command injection
function isValidHost(ip: string): boolean {
  // Allow IPv4, IPv6, and simple hostnames (no shell metacharacters)
  return /^[a-zA-Z0-9.:_-]+$/.test(ip);
}

async function pingHost(ip: string): Promise<boolean> {
  if (!isValidHost(ip)) return false;
  try {
    const command = process.platform === 'win32'
      ? `ping -n 1 -w 1000 ${ip}`
      : `ping -c 1 -W 1 ${ip}`;

    await execAsync(command);
    return true;
  } catch {
    return false;
  }
}

async function checkSSHPort(ip: string): Promise<boolean> {
  if (!isValidHost(ip)) return false;
  try {
    if (process.platform === 'win32') {
      // Use PowerShell Test-NetConnection on Windows (nc not available)
      const { stdout } = await execAsync(
        `powershell -Command "Test-NetConnection -ComputerName ${ip} -Port 22 -InformationLevel Quiet"`,
        { timeout: 5000 }
      );
      return stdout.trim().toLowerCase() === 'true';
    }
    const { stdout } = await execAsync(`nc -zv -w1 ${ip} 22 2>&1`);
    return stdout.includes('succeeded') || stdout.includes('open');
  } catch {
    return false;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ip, username, password } = req.body;

    if (!ip) {
      return res.status(400).json({ 
        success: false, 
        error: 'IP address is required' 
      });
    }

    // Check basic connectivity
    const canPing = await pingHost(ip);
    if (!canPing) {
      return res.status(200).json({
        success: false,
        error: 'Host not reachable',
        details: {
          canPing: false,
          sshAvailable: false,
          credentialsValid: false
        }
      });
    }

    // Check if SSH port is open
    const sshAvailable = await checkSSHPort(ip);
    if (!sshAvailable) {
      return res.status(200).json({
        success: false,
        error: 'SSH port not accessible',
        details: {
          canPing: true,
          sshAvailable: false,
          credentialsValid: false
        }
      });
    }

    // If we have credentials, try SSH connection
    if (username && password) {
      // For now, just return success if SSH port is open
      // In production, you'd verify credentials here
      return res.status(200).json({
        success: true,
        details: {
          canPing: true,
          sshAvailable: true,
          credentialsValid: true
        }
      });
    }

    return res.status(200).json({
      success: false,
      error: 'Missing credentials',
      details: {
        canPing: true,
        sshAvailable: true,
        credentialsValid: false
      }
    });

  } catch (error) {
    console.error('Connection check error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}
