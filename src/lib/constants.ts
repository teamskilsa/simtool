// Shared configuration constants
// Agent gateway port — the port where the deployed agent listens on remote systems
export const AGENT_GATEWAY_PORT = process.env.NEXT_PUBLIC_AGENT_GATEWAY_PORT || '9050';

// Build the agent gateway base URL for a given host IP
export function agentUrl(ip: string, path: string = ''): string {
  return `http://${ip}:${AGENT_GATEWAY_PORT}${path}`;
}
