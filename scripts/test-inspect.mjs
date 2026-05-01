// Smoke test for parseTarListing — runs the real parser against synthetic
// listings to verify the per-package-shape rules (UE-only build, full kit,
// custom rootDir).
import { parseTarListing } from '../src/modules/sw-management/lib/inspectTar.ts';

function summarize(label, result) {
  console.log(`\n── ${label} ──`);
  console.log(`  rootDir       : ${result.rootDir}`);
  console.log(`  version       : ${result.version}`);
  console.log(`  installScript : ${result.installScript}`);
  console.log(`  licenses      : ${result.licenses}`);
  const avail = result.components.filter(c => c.available);
  console.log(`  components    :`);
  for (const c of avail) {
    const mark = c.defaultOn ? '✓' : '☐';
    console.log(`     ${mark} ${c.id.padEnd(10)} ${c.label}`);
  }
  console.log(`  trx           : ${result.trxDrivers.map(t => t.id).join(', ') || '(none)'}`);
}

// ── 1. Custom-prefix UE-only build (what the user uploaded) ───────────
summarize('UE-only build (simnovus-UE-PB-*)', parseTarListing([
  'simnovus-UE-PB-2026-04-22/install.sh',
  'simnovus-UE-PB-2026-04-22/lteue-linux-2026-04-22.tar.gz',
  'simnovus-UE-PB-2026-04-22/lteots-linux-2026-04-22.tar.gz',
  'simnovus-UE-PB-2026-04-22/lteview-linux-2026-04-22.tar.gz',
  'simnovus-UE-PB-2026-04-22/ltewww-2026-04-22.tar.gz',
  'simnovus-UE-PB-2026-04-22/trx_sdr-linux-2026-04-22.tar.gz',
  'simnovus-UE-PB-2026-04-22/trx_uhd-linux-2026-04-22.tar.gz',
  'simnovus-UE-PB-2026-04-22/trx_b2x0-linux-2026-04-22.tar.gz',
  'simnovus-UE-PB-2026-04-22/licenses/sample.key',
], 'linux'));

// ── 2. Full kit — eNB+MME+UE all present, expect static defaults ──────
summarize('Full kit (2026-04-22)', parseTarListing([
  '2026-04-22/install.sh',
  '2026-04-22/lteenb-linux-2026-04-22.tar.gz',
  '2026-04-22/ltemme-linux-2026-04-22.tar.gz',
  '2026-04-22/lteue-linux-2026-04-22.tar.gz',
  '2026-04-22/lteots-linux-2026-04-22.tar.gz',
], 'linux'));

// ── 3. eNB-only build — single primary, eNB stays on (already was) ────
summarize('eNB-only build', parseTarListing([
  'callbox-2026-04-22/install.sh',
  'callbox-2026-04-22/lteenb-linux-2026-04-22.tar.gz',
  'callbox-2026-04-22/lteots-linux-2026-04-22.tar.gz',
], 'linux'));
