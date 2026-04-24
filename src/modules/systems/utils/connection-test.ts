// modules/systems/utils/connection-test.ts
import type { System } from '../types';
import { agentUrl } from '@/lib/constants';

async function checkSSHConnection(system: System): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Create request body exactly matching the working curl command
    const requestBody = {
      username: system.username || '',
      password: system.password || '',
      host: system.ip || 'localhost'
    };

    console.log('Testing SSH connection:', {
      url: agentUrl(system.ip, '/api/ssh/test'),
      body: { ...requestBody, password: '****' }
    });

    const response = await fetch(agentUrl(system.ip, '/api/ssh/test'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('SSH test failed:', data);
      return { 
        success: false, 
        error: data.error || 'SSH connection failed' 
      };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('SSH check failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'SSH check failed' 
    };
  }
}

export async function testConnection(system: System) {
  console.log('Testing connection for system:', {
    ip: system.ip,
    username: system.username,
    hasPassword: !!system.password
  });

  // Validate required parameters
  if (!system.ip) {
    return [{
      name: 'Validation',
      success: false,
      error: 'Missing IP address'
    }];
  }

  if (!system.username || !system.password) {
    return [{
      name: 'Validation',
      success: false,
      error: 'Missing SSH credentials'
    }];
  }

  // Test SSH connection
  const sshResult = await checkSSHConnection(system);

  return [{
    name: 'SSH Connection',
    success: sshResult.success,
    error: sshResult.error
  }];
}