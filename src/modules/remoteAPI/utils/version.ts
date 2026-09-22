// Amarisoft release versions are dates: "2026-06-12". Banners may append a
// build suffix ("2026-06-12.1", "2026-06-12-rc1"), so only the date prefix is
// compared.

const DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;

/** YYYYMMDD as a number, or null when the string holds no release date. */
export function parseReleaseVersion(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = DATE_RE.exec(v);
  if (!m) return null;
  return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
}

/**
 * true when `server` is at least `min`. Unknown server versions are treated
 * as new enough (we do not block what we cannot check).
 */
export function versionAtLeast(server: string | null | undefined, min: string): boolean {
  const s = parseReleaseVersion(server ?? undefined);
  const m = parseReleaseVersion(min);
  if (s === null || m === null) return true;
  return s >= m;
}
