import React from 'react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { GripVertical } from 'lucide-react';
import { TestComponent } from '../../types';
import { cn } from '@/lib/utils';

interface ComponentCardProps {
  component: TestComponent;
  onUpdate: (component: TestComponent) => void;
}

export const ComponentCard: React.FC<ComponentCardProps> = ({
  component,
  onUpdate
}) => {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <GripVertical className="h-6 w-6 text-muted-foreground" />
        
        <Checkbox
          checked={component.required}
          onCheckedChange={(checked) => 
            onUpdate({ ...component, required: !!checked })
          }
        />
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{component.configName}</span>
            <Badge variant="outline">{component.type}</Badge>
          </div>
          
          <div className="mt-1 text-sm text-muted-foreground">
            {component.dependencies?.length 
              ? `Dependencies: ${component.dependencies.join(', ')}`
              : 'No dependencies'
            }
          </div>
        </div>

        <Badge
          variant={component.status === 'success' ? 'success' : 'secondary'}
          className={cn(
            "capitalize",
            component.status === 'running' && "animate-pulse"
          )}
        >
          {component.status}
        </Badge>
      </div>
    </Card>
  );
};
