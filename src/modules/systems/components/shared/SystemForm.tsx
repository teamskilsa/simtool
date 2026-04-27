// modules/systems/components/shared/SystemForm.tsx
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
import { useTheme } from '@/components/theme/context/theme-context';

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
  const { theme } = useTheme();

  return (
    <div className="space-y-4">
      {/* System Type */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">System Type</Label>
        <Select value={data.type} onValueChange={(value) => onChange('type', value)}>
          <SelectTrigger className="bg-background border-input text-foreground hover:border-ring/50 focus:ring-2 focus:ring-ring/30 focus:border-ring/50 transition-colors">
            <SelectValue placeholder="Select system type" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border shadow-lg">
            {SYSTEM_TYPES.map((type) => (
              <SelectItem
                key={type.value}
                value={type.value}
                className="cursor-pointer rounded-md py-2 px-3 text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus:bg-accent focus:text-accent-foreground"
              >
                <div className="flex items-center gap-2">
                  <type.icon className={`w-4 h-4 text-${theme}-500`} />
                  <div>
                    <div className="font-medium">{type.label}</div>
                    <div className="text-xs text-muted-foreground">{type.description}</div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <FormField label="System Name" value={data.name} onChange={(v) => onChange('name', v)} placeholder="Enter system name" />
      <FormField label="IP Address" value={data.ip} onChange={(v) => onChange('ip', v)} placeholder="192.168.1.100" />

      {/* SSH Credentials */}
      <div className="pt-4 border-t border-border">
        <div className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          SSH Credentials
        </div>

        <div className="space-y-4">
          <FormField label="Username" value={data.username} onChange={(v) => onChange('username', v)} placeholder="Enter SSH username" icon={User} />

          {/* Auth mode */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">Authentication</Label>
            <Select value={data.authMode} onValueChange={(v) => onChange('authMode', v)}>
              <SelectTrigger className="bg-background border-input text-foreground hover:border-ring/50 focus:ring-2 focus:ring-ring/30 focus:border-ring/50 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border shadow-lg">
                <SelectItem value="password" className="cursor-pointer text-popover-foreground focus:bg-accent focus:text-accent-foreground">
                  <div className="flex items-center gap-2"><Lock className="w-4 h-4" /> Password</div>
                </SelectItem>
                <SelectItem value="privateKey" className="cursor-pointer text-popover-foreground focus:bg-accent focus:text-accent-foreground">
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
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Private Key</Label>
              <textarea
                value={data.privateKey}
                onChange={(e) => onChange('privateKey', e.target.value)}
                placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"}
                rows={6}
                className="w-full rounded-md border border-input p-3 font-mono text-xs bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30 focus:border-ring/50 outline-none transition-colors"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
