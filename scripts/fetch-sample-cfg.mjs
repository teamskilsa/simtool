// Fetch a known-working sample cfg from the user's callbox via SSH.
// Amarisoft ships sample configs at /root/<module>/config/. Reading one
// gives us the canonical structure + field ordering for that version.
//
// Run: node scripts/fetch-sample-cfg.mjs

import http from 'node:http';

const HOST = '192.168.1.240';
const USERNAME = 'sysadmin';
const PASSWORD = 'admin@123';

// Hit /api/systems/ssh-execute on the dev server, which already has SSH
// proxied. Reuse the existing infrastructure.
function ssh(cmd) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      host: HOST, port: 22, username: USERNAME, password: PASSWORD, command: cmd,
    });
    const req = http.request({
      method: 'POST', host: 'localhost', port: 3000,
      path: '/api/systems/ssh-execute',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let chunks = '';
      res.setEncoding('utf8');
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)); }
        catch (e) { reject(new Error(`bad JSON: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60_000, () => req.destroy(new Error('30s timeout')));
    req.write(body); req.end();
  });
}

async function main() {
  // List sample configs
  const list = await ssh(`echo 'admin@123' | sudo -S -p '' ls -la /root/enb/config/`);
  console.log('━ /root/enb/config/ ━'.padEnd(70, '━'));
  console.log(list.stdout || list.error);

  // Try a few well-known sample names; print whichever exists
  for (const name of ['enb.default.cfg', 'enb-default.cfg', 'enb-fdd.cfg', 'enb-tdd.cfg', 'enb-callbox.cfg', 'enb-ip.cfg']) {
    const r = await ssh(`echo 'admin@123' | sudo -S -p '' test -f /root/enb/config/${name} && echo 'admin@123' | sudo -S -p '' cat /root/enb/config/${name}`);
    if (r.stdout && r.stdout.length > 100) {
      console.log(`\n━ /root/enb/config/${name} (head 200 lines) ━`.padEnd(70, '━'));
      console.log(r.stdout.split('\n').slice(0, 200).join('\n'));
      break;
    }
  }
}

main().catch(e => { console.error('failed:', e.message); process.exit(1); });
