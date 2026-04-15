// modules/systems/components/shared/SystemForm.tsx
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from './FormField';
import { Server, Radio, Smartphone, Activity, User, Lock } from 'lucide-react';

interface SystemFormData {
  type: string;
  name: string;
  ip: string;
  username: string;  // Added for SSH
  password: string;  // Added for SSH
}

interface SystemFormProps {
  data: SystemFormData;
  onChange: (field: keyof SystemFormData, value: any) => void;
}

const SYSTEM_TYPES = [
  {
    value: 'Callbox',
    label: 'Callbox',
    icon: Radio,
    description: 'LTE/5G Base Station'
  },
  {
    value: 'UESim',
    label: 'UE Simulator',
    icon: Smartphone,
    description: 'User Equipment Simulator'
  },
  {
    value: 'MME',
    label: 'MME',
    icon: Server,
    description: 'Mobility Management Entity'
  },
  {
    value: 'SPGW',
    label: 'SPGW',
    icon: Activity,
    description: 'Serving/PDN Gateway'
  }
];

export function SystemForm({ data, onChange }: SystemFormProps) {
  const { theme, mode } = useTheme();
  const themeConfig = themes[theme];

  const getSelectClass = () => `
    ${mode === 'light' 
      ? 'bg-white border-slate-200 hover:bg-slate-50/50' 
      : 'bg-slate-800/75 border-slate-700 hover:bg-slate-800'
    }
    transition-colors
    focus:ring-2
    focus:ring-indigo-500/20
    focus:border-indigo-500/30
  `;

  const getSelectContentClass = `
    ${mode === 'light' 
      ? 'bg-white border-slate-200' 
      : 'bg-slate-800 border-slate-700'
    }
    shadow-lg
    rounded-md
    p-1
    border
  `;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Select
          value={data.type}
          onValueChange={(value) => onChange('type', value)}
        >
          <SelectTrigger className={getSelectClass()}>
            <SelectValue placeholder="Select system type" />
          </SelectTrigger>
          <SelectContent className={getSelectContentClass}>
            {SYSTEM_TYPES.map((type) => (
              <SelectItem 
                key={type.value} 
                value={type.value}
                className={`
                  ${mode === 'light' 
                    ? 'hover:bg-slate-50' 
                    : 'hover:bg-slate-700'
                  }
                  cursor-pointer
                  rounded-md
                  py-2
                  px-3
                  transition-colors
                `}
              >
                <div className="flex items-center gap-2">
                  <type.icon className={`w-4 h-4 text-${theme}-500`} />
                  <div>
                    <div className="font-medium">{type.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {type.description}
                    </div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <FormField
        label="System Name"
        value={data.name}
        onChange={(value) => onChange('name', value)}
        placeholder="Enter system name"
      />

      <FormField
        label="IP Address"
        value={data.ip}
        onChange={(value) => onChange('ip', value)}
        placeholder="192.168.1.100"
      />

      {/* SSH Credentials Section */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-200 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          SSH Credentials
        </div>
        
        <div className="space-y-4">
          <FormField
            label="Username"
            value={data.username}
            onChange={(value) => onChange('username', value)}
            placeholder="Enter SSH username"
            icon={User}
          />

          <FormField
            label="Password"
            value={data.password}
            onChange={(value) => onChange('password', value)}
            placeholder="Enter SSH password"
            type="password"
            icon={Lock}
            autoComplete="new-password"
          />
        </div>
      </div>
    </div>
  );
}