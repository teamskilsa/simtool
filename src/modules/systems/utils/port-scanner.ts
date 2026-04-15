// modules/systems/utils/port-scanner.ts
const COMMON_PORTS = [22, 80, 443, 9001];

export async function scanPorts(ip: string) {
  const results = [];
  
  for (const port of COMMON_PORTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      
      const response = await fetch(`http://${ip}:${port}`, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors'
      });
      
      clearTimeout(timeoutId);
      results.push({ port, open: true });
    } catch (error) {
      results.push({ port, open: false });
    }
  }
  
  return results;
}
