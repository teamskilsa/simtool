// Parse a `tar tzf` listing from an Amarisoft package into a DetectionResult.
// Pure function — no I/O, works on server or client.
import {
  KNOWN_COMPONENTS, KNOWN_TRX,
  type DetectionResult, type DetectedComponent, type DetectedTrx, type TargetArch,
} from '../types/detection';

/**
 * "Primary service" components — things that fundamentally change what the
 * box does (eNB, UE simulator, MME, etc.). When a tarball contains exactly
 * one of these (e.g. a `simnovus-UE-PB-*.tar.gz` UE-only build), we want
 * that one defaulted ON regardless of its individual `defaultOn` flag —
 * otherwise the "auto-detect didn't pick anything to install" complaint
 * wins. Infra components (ots / view / www) are NOT primaries.
 */
const PRIMARY_SERVICE_IDS = new Set(['enb', 'mme', 'ue', 'n3iwf', 'mbmsgw', 'sat', 'probe', 'scan']);

export function parseTarListing(entries: string[], systemArch: TargetArch = 'unknown'): DetectionResult {
  // Drop directory entries, keep just filenames
  const files = entries.map(e => e.trim()).filter(Boolean);

  // Detect root directory — most-common first segment, not just the first
  // path's. Custom packagers (e.g. simnovus-UE-PB-2026-04-22) sometimes
  // mix a parallel siblings dir for licenses/notes that would otherwise
  // hijack our detection if we picked the alphabetically-first one.
  const firstSegmentCounts = new Map<string, number>();
  for (const f of files) {
    if (!f.includes('/')) continue;
    const seg = f.split('/')[0];
    firstSegmentCounts.set(seg, (firstSegmentCounts.get(seg) ?? 0) + 1);
  }
  let rootDir: string | undefined;
  let bestCount = 0;
  for (const [seg, count] of firstSegmentCounts) {
    if (count > bestCount) { bestCount = count; rootDir = seg; }
  }

  // Extract version: any YYYY-MM-DD anywhere in the rootDir, falling back
  // to the dates embedded in component tarballs (lteenb-linux-2026-04-22).
  const dateAnywhere = (s: string | undefined) => s?.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  let version = dateAnywhere(rootDir);
  if (!version) {
    for (const f of files) {
      const d = dateAnywhere(f.split('/').pop());
      if (d) { version = d; break; }
    }
  }
  // If we still have nothing, fall back to the rootDir name (better than
  // showing 'undefined') so users at least see SOMETHING.
  if (!version) version = rootDir;

  // Find install.sh anywhere in the tar — at the root of the canonical
  // dir, OR sitting bare alongside other stuff. First match wins.
  const installScript = files.find(f => /(^|\/)install\.sh$/.test(f));

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

    // A component is "available" only if the package has a tar for the
    // detected system arch. If arch is unknown we accept anything.
    const available = systemArch !== 'unknown'
      ? arches.includes(systemArch)
      : arches.length > 0;
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

  // ── Per-package shape adjustment ──────────────────────────────────────────
  // Static defaultOn flags assume a "full callbox" tarball. They're wrong
  // for narrow packages — e.g. a UE-only build has lteue but no lteenb /
  // ltemme, yet ue.defaultOn=false ships, so the user sees a UE package
  // detected but no UE box checked. ("It didn't auto-detect the UE sim
  // build.")
  //
  // Rule: if exactly one PRIMARY service is available in the package,
  // default it on. Multiple primaries = full kit, keep static defaults
  // (eNB/MME on, UE off) so users running a callbox don't get the UE
  // checked accidentally.
  const availablePrimaries = components.filter(c => c.available && PRIMARY_SERVICE_IDS.has(c.id));
  if (availablePrimaries.length === 1) {
    availablePrimaries[0].defaultOn = true;
  }

  // ── Detect TRX drivers — only include ones usable on the target arch ──────
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
          // No arch suffix → works on both
          if (!arches.includes('linux')) arches.push('linux');
          if (!arches.includes('aarch64')) arches.push('aarch64');
        }
      }
      return { id: meta.id, label: meta.label, arches };
    })
    // Filter: must have a tar present AND that tar must support the target arch
    .filter(t =>
      t.arches.length > 0 &&
      (systemArch === 'unknown' || t.arches.includes(systemArch))
    );

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
