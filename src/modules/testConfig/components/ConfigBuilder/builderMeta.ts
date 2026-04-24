// Helpers to embed/extract builder form state in generated Amarisoft config files.
// The form state is written as a single-line JSON comment at the top of the file
// so the file remains valid Amarisoft syntax (comments are ignored by the parser)
// but we can reconstruct the builder form when loading a saved config.
//
// Format: /* @builder:{"type":"nr","form":{...}} */

const BUILDER_MARKER = '@builder:';

export interface BuilderMeta {
  type: 'nr' | 'lte' | 'nbiot' | 'catm' | 'core';
  form: Record<string, any>;
}

/** Embed builder metadata at the top of a generated config. */
export function embedBuilderMeta(configText: string, meta: BuilderMeta): string {
  const safeForm = JSON.stringify(meta);
  return `/* ${BUILDER_MARKER}${safeForm} */\n${configText}`;
}

/** Extract builder metadata from a saved config. Returns null if none found. */
export function extractBuilderMeta(configText: string): BuilderMeta | null {
  const pattern = new RegExp(`/\\*\\s*${BUILDER_MARKER}(\\{.*?\\})\\s*\\*/`);
  const match = configText.match(pattern);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}
