// Shared provisioning utility — runs ping → ssh-test → deploy for a system.
// Used on initial Add System AND on "Retry Provisioning" from the systems table.
import type { System, ProvisionStep } from '../types';

export interface ProvisionResult {
  success: boolean;
  error?: string;
  steps: ProvisionStep[];
  failedStep?: 'ping' | 'ssh-test' | 'deploy';
}

async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs: number) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ac.signal });
    clearTimeout(timer);
    return res;
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    throw err;
  }
}

export async function provisionSystem(system: System): Promise<ProvisionResult> {
  const credentials = {
    host: system.ip,
    username: system.username,
    ...(system.authMode === 'privateKey' && system.privateKey
      ? { privateKey: system.privateKey }
      : { password: system.password || '' }),
  };

  const steps: ProvisionStep[] = [];

  // Step 1: ping (ICMP + TCP/22)
  try {
    const pingRes = await fetchWithTimeout(
      '/api/systems/ping',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: system.ip, port: 22 }),
      },
      10000,
    ).then((r) => r.json());

    if (!pingRes.reachable) {
      const detail = buildPingErrorDetail(system.ip, pingRes.icmpAlive, pingRes.tcpOpen);
      steps.push({ name: 'ping', ok: false, detail });
      return { success: false, steps, error: detail, failedStep: 'ping' };
    }
    steps.push({ name: 'ping', ok: true, detail: 'ICMP + TCP/22 reachable' });
  } catch (err: any) {
    const msg = err?.message || 'ping request failed';
    steps.push({ name: 'ping', ok: false, detail: msg });
    return { success: false, steps, error: msg, failedStep: 'ping' };
  }

  // Step 2: ssh-test
  try {
    const sshRes = await fetchWithTimeout(
      '/api/systems/ssh-test',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      },
      15000,
    ).then((r) => r.json());

    if (!sshRes.success) {
      const detail = `SSH login failed: ${sshRes.error || 'authentication or connection error'}`;
      steps.push({ name: 'ssh-test', ok: false, detail });
      return { success: false, steps, error: detail, failedStep: 'ssh-test' };
    }
    steps.push({ name: 'ssh-test', ok: true, detail: 'Credentials verified' });
  } catch (err: any) {
    const msg = err?.message || 'ssh-test failed';
    steps.push({ name: 'ssh-test', ok: false, detail: msg });
    return { success: false, steps, error: msg, failedStep: 'ssh-test' };
  }

  // Step 3: deploy agent
  try {
    const deployRes = await fetchWithTimeout(
      '/api/systems/deploy',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      },
      60000,
    ).then((r) => r.json());

    if (!deployRes.success) {
      const failed = (deployRes.steps || []).find((s: any) => !s.ok);
      const detail =
        deployRes.error ||
        (failed ? `Deploy failed at "${failed.name}": ${failed.detail || ''}` : 'Deploy failed');
      steps.push({ name: 'deploy', ok: false, detail });
      if (Array.isArray(deployRes.steps)) steps.push(...deployRes.steps);
      return { success: false, steps, error: detail, failedStep: 'deploy' };
    }
    steps.push({ name: 'deploy', ok: true, detail: 'Agent deployed and healthy' });
  } catch (err: any) {
    const msg = err?.message || 'deploy failed';
    steps.push({ name: 'deploy', ok: false, detail: msg });
    return { success: false, steps, error: msg, failedStep: 'deploy' };
  }

  return { success: true, steps };
}

function buildPingErrorDetail(ip: string, icmpAlive: boolean, tcpOpen: boolean): string {
  if (!icmpAlive && !tcpOpen) {
    return (
      `Host ${ip} is not responding.\n\n` +
      `Possible causes:\n` +
      `• System is powered off or not yet booted\n` +
      `• IP address has changed (check DHCP lease on your router)\n` +
      `• Wrong IP — verify you typed the correct address\n` +
      `• The target is on a different network/VLAN not reachable from here`
    );
  }
  if (icmpAlive && !tcpOpen) {
    return (
      `Host ${ip} is online but SSH (port 22) is not accessible.\n\n` +
      `Possible causes:\n` +
      `• SSH service is not running — start with: sudo systemctl start ssh\n` +
      `• Firewall is blocking port 22 — check: sudo ufw status\n` +
      `• SSH is listening on a non-standard port`
    );
  }
  return `Host ${ip}:22 is not reachable`;
}
