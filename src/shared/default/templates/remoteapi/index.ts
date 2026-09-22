// Amarisoft remote API command catalogue (docs 2026-09-11).
//
//   getCatalogue('ENB')          -> every documented eNB message SimTool knows
//   findCommand('MME', 'ue_del') -> the entry used for validation / confirm
//
// Component entries override common ones with the same message name
// (e.g. the eNB `config_set` knows about cells/rf_ports, the common one only
// about logs), but the common entry's presets are kept.
import type { ApiCommand, ComponentType } from './common/types';
import { commonCommands } from './common/messages';
import { enbCommands } from './enb';
import { mmeCommands } from './mme';
import { imsCommands } from './ims';
import { ueCommands } from './ue';
import { mbmsCommands } from './mbms';
import { licenseCommands } from './license';

export * from './common/types';
export { COMMON_REQUEST_PARAMS } from './common/messages';
export { CATALOGUE_VERSION, V_CANCEL } from './common/helpers';
export { enbCommands, mmeCommands, imsCommands, ueCommands, mbmsCommands, licenseCommands };

const SPECIFIC: Record<ComponentType, ApiCommand[]> = {
  ENB: enbCommands,
  MME: mmeCommands,
  IMS: imsCommands,
  UE: ueCommands,
  MBMS: mbmsCommands,
  LICENSE: licenseCommands,
};

const cache = new Map<ComponentType, ApiCommand[]>();

export function getCatalogue(component: ComponentType): ApiCommand[] {
  const hit = cache.get(component);
  if (hit) return hit;
  const specific = SPECIFIC[component] ?? [];
  const byName = new Map(specific.map(c => [c.message, c]));
  const merged: ApiCommand[] = [];
  for (const c of commonCommands(component)) {
    const override = byName.get(c.message);
    if (!override) { merged.push(c); continue; }
    // Keep the common presets (e.g. log level presets) on the override.
    const presets = [...(override.presets ?? []), ...(c.presets ?? []), { label: c.label, body: c.example }];
    const seen = new Set<string>();
    override.presets = presets.filter(p => {
      const k = JSON.stringify(p.body);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  const out = [...merged, ...specific];
  cache.set(component, out);
  return out;
}

export function findCommand(component: ComponentType, message: string): ApiCommand | undefined {
  return getCatalogue(component).find(c => c.message === message);
}

/** Categories in display order. */
export function getCategories(component: ComponentType): string[] {
  const order = ['Monitoring', 'Radio', 'Mobility', 'Cell config', 'Subscribers', 'Bearers', 'Users', 'Messaging', 'Calls', 'UEs', 'Sessions', 'Services', 'Licenses', 'PWS', 'Links', 'Core config', 'IMS config', 'Logs', 'System'];
  const cats = Array.from(new Set(getCatalogue(component).map(c => c.category)));
  return cats.sort((a, b) => {
    const ia = order.indexOf(a); const ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}
