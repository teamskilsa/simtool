// Root-level cfg entries shared by the NR and LTE generators.
//
// Both are omitted unless they carry something, so a config that never had
// them keeps exactly the output it had before these existed.
import type { RfPortEntry } from './constants';

/** cfg root: en_dc_support. Written only when on. */
export function enDcSupportLine(enabled?: boolean): string {
  return enabled ? '\n  en_dc_support: true,\n' : '';
}

function literal(v: string | number | boolean): string {
  return typeof v === 'string' ? JSON.stringify(v) : String(v);
}

/**
 * cfg root: rf_ports[].
 *
 * Empty entries are emitted as `{}` rather than dropped: on FR1 the array
 * carries no fields and only declares how many RF ports exist, so dropping
 * them would change the port count. Keys the builder has no field for are
 * written back from `extra`, so an imported port is reproduced as it was.
 */
export function rfPortsBlock(ports?: RfPortEntry[] | null): string {
  if (!ports || ports.length === 0) return '';
  const entries = ports.map(p => {
    const lines: string[] = [];
    if (p?.dlFreq !== null && p?.dlFreq !== undefined) lines.push(`      rf_dl_freq: ${p.dlFreq}, /* MHz */`);
    if (p?.ulFreq !== null && p?.ulFreq !== undefined) lines.push(`      rf_ul_freq: ${p.ulFreq}, /* MHz */`);
    for (const [k, v] of Object.entries(p?.extra ?? {})) lines.push(`      ${k}: ${literal(v)},`);
    return lines.length ? `    {\n${lines.join('\n')}\n    }` : '    {}';
  }).join(',\n');
  return `\n  rf_ports: [\n${entries},\n  ],\n`;
}
