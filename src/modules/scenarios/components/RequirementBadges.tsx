import { Badge } from '@/components/ui/badge';
import type { ScenarioRequirements } from '../types';

export function RequirementBadges({ r }: { r: ScenarioRequirements }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">≥{r.minCells} cell{r.minCells === 1 ? '' : 's'}</Badge>
      {r.needsPhone && <Badge variant="warning" className="h-5 px-1.5 text-[10px]">phone</Badge>}
      {r.needsHoConfig && <Badge variant="default" className="h-5 px-1.5 text-[10px]">ho_from_meas</Badge>}
      {r.needsCa && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">CA / SCells</Badge>}
    </div>
  );
}
