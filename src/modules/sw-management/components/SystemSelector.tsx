import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { System } from '@/modules/systems/types';

interface SystemSelectorProps {
  systems: System[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function SystemSelector({ systems, selectedId, onSelect }: SystemSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Target System</label>
      <Select value={selectedId} onValueChange={onSelect}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a connected system" />
        </SelectTrigger>
        <SelectContent>
          {systems.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No systems available</div>
          )}
          {systems.map((sys) => (
            <SelectItem key={sys.id} value={String(sys.id)}>
              <span className="flex items-center gap-2">
                <span className="font-medium">{sys.name}</span>
                <span className="text-muted-foreground text-xs">{sys.ip}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
