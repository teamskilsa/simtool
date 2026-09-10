// Emits the top-level `license_server` entry shared by every generator.
//
// Amarisoft refuses to start a daemon it cannot licence, so this line is the
// difference between a deployable config and one that dies at startup with
// "Tag X not found". It was missing from all four generators, which meant
// round-tripping a working production cfg through the builder quietly
// removed it.
export function licenseServerBlock(
  license?: { serverAddr?: string; tag?: string } | null,
): string {
  const addr = license?.serverAddr?.trim();
  if (!addr) return '';   // no address → omit; the box licences some other way
  const tag = license?.tag?.trim();
  return `
  license_server: {
    server_addr: "${addr}",${tag ? `\n    tag: "${tag}",` : ''}
  },
`;
}
