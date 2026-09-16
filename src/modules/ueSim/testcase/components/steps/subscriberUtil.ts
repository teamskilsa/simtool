// Small helpers the Subscriber step shares with the overview.
import type { SubscriberGroup } from '../../types';
export { supiToImsi } from '../../derive';

export function totalUesOfGroups(groups: SubscriberGroup[]): number {
  return groups.reduce((s, g) => s + Math.max(0, Math.floor(g.ueCount)), 0);
}
