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
import { Label } from "@/components/ui/label";
import { Server, Radio, Smartphone, Activity, User, Lock, Key } from 'lucide-react';

interface SystemFormData {
  type: string;
  name: string;
  ip: string;
  username: string;
  password: string;
  authMode: 'password' | 'privateKey';
  privateKey: string;
}

interface SystemFormProps {
  data: SystemFormData;
  onChange: (field: keyof SystemFormData, value: any) => void;
}

const SYSTEM_TYPES = [
  { value: 'Callbox', label: 'Callbox', icon: Radio, description: 'LTE/5G Base Station' },
  { value: 'UESim', label: 'UE Simulator', icon: Smartphone, description: 'User Equipment Simulator' },
  { value: 'MME', label: 'MME', icon: Server, description: 'Mobility Management Entity' },
  { value: 'SPGW', label: 'SPGW', icon: Activity, description: 'Serving/PDN Gateway' },
];

export function SystemForm({ data, onChange }: SystemFormProps) {
  const { theme, mode } = useTheme();

  const getSelectClass = () => `
    ${mode === 'light'
      ? 'bg-white border-slate-200 hover:bg-slate-50/50'
      : 'bg-slate-800/75 border-slate-700 hover:bg-slate-800'
    }
    transition-colors focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30
  `;

  const getSelectContentClass = `
    ${mode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700'}
    shadow-lg rounded-md p-1 border
  `;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Select value={data.type} onValueChange={(value) => onChange('type', value)}>
          <SelectTrigger className={getSelectClass()}>
            <SelectValue placeholder="Select system type" />
          </SelectTrigger>
          <SelectContent className={getSelectContentClass}>
            {SYSTEM_TYPES.map((type) => (
              <SelectItem
                key={type.value}
                value={type.value}
                className={`
                  ${mode === 'light' ? 'hover:bg-slate-50' : 'hover:bg-slate-700'}
                  cursor-pointer rounded-md py-2 px-3 transition-colors
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

      <FormField label="System Name" value={data.name} onChange={(v) => onChange('name', v)} placeholder="Enter system name" />
      <FormField label="IP Address" value={data.ip} onChange={(v) => onChange('ip', v)} placeholder="192.168.1.100" />

      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-200 mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          SSH Credentials
        </div>

        <div className="space-y-4">
          <FormField label="Username" value={data.username} onChange={(v) => onChange('username', v)} placeholder="Enter SSH username" icon={User} />

          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-900 dark:text-slate-200">Authentication</Label>
            <Select value={data.authMode} onValueChange={(v) => onChange('authMode', v)}>
              <SelectTrigger className={getSelectClass()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={getSelectContentClass}>
                <SelectItem value="password">
                  <div className="flex items-center gap-2"><Lock className="w-4 h-4" /> Password</div>
                </SelectItem>
                <SelectItem value="privateKey">
                  <div className="flex items-center gap-2"><Key className="w-4 h-4" /> Private Key</div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {data.authMode === 'password' ? (
            <FormField
              label="Password"
              value={data.password}
              onChange={(v) => onChange('password', v)}
              placeholder="Enter SSH password"
              type="password"
              icon={Lock}
              autoComplete="new-password"
            />
          ) : (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-900 dark:text-slate-200">Private Key</Label>
              <textarea
                value={data.privateKey}
                onChange={(e) => onChange('privateKey', e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                rows={6}
                className={`
                  w-full rounded-md border p-3 font-mono text-xs
                  ${mode === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800/75 border-slate-700 text-slate-100'}
                  focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30
                `}
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
