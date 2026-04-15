import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface ConfigurationBoxProps {
  title?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  components?: {
    id: string;
    label: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }[];
  commonIp?: string;
  onCommonIpChange?: (ip: string) => void;
  useCommonIp?: boolean;
  onUseCommonIpChange?: (use: boolean) => void;
}

export function ConfigurationBox({
  title = "Configuration",
  icon = <Settings className="w-5 h-5" />,
  defaultOpen = false,
  className,
  components = [],
  commonIp = "",
  onCommonIpChange,
  useCommonIp = false,
  onUseCommonIpChange
}: ConfigurationBoxProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn(
      "rounded-xl overflow-hidden",
      "bg-white/50 dark:bg-gray-950/50",
      "backdrop-blur-sm",
      "border border-gray-200/50 dark:border-gray-800/50",
      "shadow-xl shadow-blue-500/5",
      "ring-1 ring-gray-200/50 dark:ring-gray-800/50",
      className
    )}>
      <Button
        variant="ghost"
        className={cn(
          "w-full px-4 py-3 h-auto",
          "flex items-center justify-between",
          "hover:bg-gray-100/50 dark:hover:bg-gray-900/50",
          "transition-colors"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold">{title}</span>
        </div>
        {isOpen ? 
          <ChevronUp className="w-4 h-4 text-gray-500" /> : 
          <ChevronDown className="w-4 h-4 text-gray-500" />
        }
      </Button>

      {isOpen && (
        <div className="p-4 space-y-4">
          {components.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {components.map((component) => (
                <div
                  key={component.id}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg",
                    "bg-gray-50/50 dark:bg-gray-900/50",
                    "border border-gray-200/50 dark:border-gray-800/50",
                    "transition-colors",
                    component.checked && "bg-blue-50/50 dark:bg-blue-900/50 border-blue-200/50 dark:border-blue-800/50"
                  )}
                >
                  <Checkbox
                    id={component.id}
                    checked={component.checked}
                    onCheckedChange={component.onCheckedChange}
                  />
                  <label
                    htmlFor={component.id}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {component.label}
                  </label>
                </div>
              ))}
            </div>
          )}

          {onCommonIpChange && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="use-common-ip"
                  checked={useCommonIp}
                  onCheckedChange={onUseCommonIpChange}
                />
                <label
                  htmlFor="use-common-ip"
                  className="text-sm font-medium cursor-pointer"
                >
                  Use same IP for all components
                </label>
              </div>

              {useCommonIp && (
                <div className="space-y-2">
                  <label className="text-sm text-gray-500">
                    Common IP:
                  </label>
                  <Input
                    value={commonIp}
                    onChange={(e) => onCommonIpChange(e.target.value)}
                    placeholder="e.g., 192.168.1.100"
                    className="max-w-md"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}