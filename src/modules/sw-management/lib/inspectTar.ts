// Parse a `tar tzf` listing from an Amarisoft package into a DetectionResult.
// Pure function — no I/O, works on server or client.
import {
  KNOWN_COMPONENTS, KNOWN_TRX,
  type DetectionResult, type DetectedComponent, type DetectedTrx, type TargetArch,
} from '../types/detection';

export function parseTarListing(entries: string[], systemArch: TargetArch = 'unknown'): DetectionResult {
  // Drop directory entries, keep just filenames
  const files = entries.map(e => e.trim()).filter(Boolean);

  // Detect root directory — first segment of the first real path
  const firstPath = files.find(f => f.includes('/'));
  const rootDir = firstPath ? firstPath.split('/')[0] : undefined;

  // Extract version from root folder (e.g. "2026-04-22")
  const versionMatch = rootDir?.match(/^(\d{4}-\d{2}-\d{2})$/);
  const version = versionMatch ? versionMatch[1] : rootDir;

  // Look for install.sh at root
  const installScript = files.find(f => f === `${rootDir}/install.sh`);

  // ── Detect components ─────────────────────────────────────────────────────
  const components: DetectedComponent[] = KNOWN_COMPONENTS.map(meta => {
    const arches: TargetArch[] = [];
    for (const f of files) {
      const basename = f.includes('/') ? f.split('/').pop() || '' : f;
      if (!basename.endsWith('.tar.gz')) continue;
      if (!meta.pattern.test(basename)) continue;

      if (basename.includes('-aarch64-')) {
        if (!arches.includes('aarch64')) arches.push('aarch64');
      } else if (basename.includes('-linux-')) {
        if (!arches.includes('linux')) arches.push('linux');
      } else {
        // Architecture-independent (e.g. ltewww-VERSION.tar.gz)
        if (!arches.includes('linux')) arches.push('linux');
        if (!arches.includes('aarch64')) arches.push('aarch64');
      }
    }

    const available = arches.length > 0;
    return {
      id: meta.id,
      label: meta.label,
      description: meta.description,
      arches,
      available,
      defaultOn: meta.defaultOn && available,
      subOf: meta.subOf,
    };
  });

  // ── Detect TRX drivers ────────────────────────────────────────────────────
  const trxDrivers: DetectedTrx[] = KNOWN_TRX
    .map(meta => {
      const arches: TargetArch[] = [];
      const pattern = new RegExp(`^trx_${meta.id}(-(linux|aarch64))?-`);
      for (const f of files) {
        const basename = f.includes('/') ? f.split('/').pop() || '' : f;
        if (!basename.endsWith('.tar.gz')) continue;
        if (!pattern.test(basename)) continue;
        if (basename.includes('-aarch64-')) {
          if (!arches.includes('aarch64')) arches.push('aarch64');
        } else if (basename.includes('-linux-')) {
          if (!arches.includes('linux')) arches.push('linux');
        } else {
          if (!arches.includes('linux')) arches.push('linux');
        }
      }
      return { id: meta.id, label: meta.label, arches };
    })
    .filter(t => t.arches.length > 0);

  // ── Count licenses ────────────────────────────────────────────────────────
  const licenses = files.filter(f => {
    const parts = f.split('/');
    return parts.length >= 3 && parts[1] === 'licenses' && parts[2].endsWith('.key');
  }).length;

  return {
    success: true,
    version,
    rootDir,
    installScript,
    components,
    trxDrivers,
    licenses,
    targetArch: systemArch,
  };
}
