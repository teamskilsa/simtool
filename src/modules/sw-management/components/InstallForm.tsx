import { useState, useEffect } from 'react';
import { Upload, FolderOpen, Radio, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUpload } from '@/components/ui/file-upload';
import type { InstallComponents, SoftwareSource, TrxDriver } from '../types';
import { getDefaultComponentsForType } from '../types';

interface InstallFormProps {
  hasSystem: boolean;
  systemType?: string;
  isInstalling: boolean;
  onInstall: (opts: {
    source: SoftwareSource;
    remotePath?: string;
    file?: File;
    components: InstallComponents;
    trxDriver: TrxDriver;
    mimo: boolean;
    useNat: boolean;
    useIPv6: boolean;
    ruIpAddress?: string;
  }) => void;
}

const TRX_OPTIONS: { value: TrxDriver; label: string }[] = [
  { value: 'sdr',  label: 'SDR' },
  { value: 'n2x0', label: 'N2x0' },
  { value: 'b2x0', label: 'B2x0' },
  { value: 'x3x0', label: 'X3x0' },
  { value: 'n3x0', label: 'N3x0' },
  { value: 's72',  label: 'S72 (DU)' },
];

interface ComponentRow {
  key: keyof InstallComponents;
  label: string;
  requires?: keyof InstallComponents;
  defaultAdvanced?: boolean;
}

const COMPONENT_ROWS: ComponentRow[] = [
  { key: 'enb',           label: 'eNB / gNB' },
  { key: 'epc',           label: 'EPC (MME + HSS)' },
  { key: 'ims',           label: 'IMS', requires: 'epc' },
  { key: 'ueSimulator',   label: 'UE Simulator' },
  { key: 'mbms',          label: 'MBMS Gateway' },
  { key: 'webInterface',  label: 'Web Interface' },
  { key: 'licenseServer', label: 'License Server' },
  { key: 'simServer',     label: 'SIM Server', requires: 'epc', defaultAdvanced: true },
  { key: 'satellite',     label: 'Satellite Utils', defaultAdvanced: true },
];

export function InstallForm({ hasSystem, systemType, isInstalling, onInstall }: InstallFormProps) {
  const [source, setSource] = useState<SoftwareSource>('remote-path');
  const [remotePath, setRemotePath] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [components, setComponents] = useState<InstallComponents>(() => getDefaultComponentsForType(systemType || ''));
  const [trxDriver, setTrxDriver] = useState<TrxDriver>('sdr');
  const [mimo, setMimo] = useState(true);
  const [useNat, setUseNat] = useState(true);
  const [useIPv6, setUseIPv6] = useState(false);
  const [ruIpAddress, setRuIpAddress] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Update defaults when the selected system's type changes
  useEffect(() => {
    setComponents(getDefaultComponentsForType(systemType || ''));
  }, [systemType]);

  const setComp = (key: keyof InstallComponents, value: boolean) => {
    setComponents((prev) => {
      const next = { ...prev, [key]: value };
      // Enforce dependencies — disable children when parent is turned off
      if (key === 'epc' && !value) {
        next.ims = false;
        next.simServer = false;
      }
      if (key === 'ltService' && !value) {
        next.ltServiceEnable = false;
      }
      return next;
    });
  };

  // At least one component must be selected
  const atLeastOneComponent = Object.values(components).some((v) => v === true);

  const canSubmit =
    hasSystem &&
    !isInstalling &&
    ((source === 'remote-path' && remotePath.trim().length > 0) || (source === 'upload' && file !== null)) &&
    (trxDriver !== 's72' || ruIpAddress.trim().length > 0) &&
    atLeastOneComponent;

  const handleInstall = () => {
    onInstall({
      source,
      remotePath: source === 'remote-path' ? remotePath : undefined,
      file: source === 'upload' ? file || undefined : undefined,
      components,
      trxDriver,
      mimo,
      useNat,
      useIPv6,
      ruIpAddress: trxDriver === 's72' ? ruIpAddress : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Software Source */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Software Package</Label>
        <RadioGroup value={source} onValueChange={(v) => setSource(v as SoftwareSource)} className="flex gap-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="remote-path" id="source-remote" />
            <Label htmlFor="source-remote" className="flex items-center gap-1.5 cursor-pointer">
              <FolderOpen className="h-4 w-4" /> Remote Path
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="upload" id="source-upload" />
            <Label htmlFor="source-upload" className="flex items-center gap-1.5 cursor-pointer">
              <Upload className="h-4 w-4" /> Upload File
            </Label>
          </div>
        </RadioGroup>

        {source === 'remote-path' && (
          <Input
            placeholder="/tmp/amarisoft-2026-04-09.tar.gz"
            value={remotePath}
            onChange={(e) => setRemotePath(e.target.value)}
          />
        )}

        {source === 'upload' && (
          <FileUpload
            onDrop={(files) => setFile(files[0] || null)}
            accept={{ 'application/gzip': ['.tar.gz', '.tgz'], 'application/x-tar': ['.tar'] }}
            maxFiles={1}
          >
            <div className="py-4">
              <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">
                {file ? file.name : 'Drop Amarisoft tar.gz here, or click to select'}
              </p>
              {file && (
                <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              )}
            </div>
          </FileUpload>
        )}
      </div>

      {/* Components */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Components</Label>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-md border p-3">
          {COMPONENT_ROWS.filter((r) => !r.defaultAdvanced || showAdvanced).map((row) => {
            const disabled = Boolean(row.requires && !components[row.requires]);
            return (
              <label
                key={row.key}
                className={`flex items-center gap-2 py-0.5 cursor-pointer ${disabled ? 'opacity-60' : ''}`}
              >
                <Checkbox
                  checked={components[row.key]}
                  disabled={disabled}
                  onCheckedChange={(checked) => setComp(row.key, Boolean(checked))}
                />
                <span className="text-sm">{row.label}</span>
              </label>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {showAdvanced ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Advanced
        </button>
      </div>

      {/* eNB config (only when eNB selected) */}
      {components.enb && (
        <div className="space-y-2 rounded-md border p-3">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Radio className="h-4 w-4" /> eNB Config
          </Label>

          <div className="flex items-center gap-3">
            <Label className="text-xs text-muted-foreground w-16 shrink-0">TRX</Label>
            <Select value={trxDriver} onValueChange={(v) => setTrxDriver(v as TrxDriver)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRX_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {trxDriver === 's72' && (
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground w-16 shrink-0">RU IP</Label>
              <Input className="h-8" placeholder="10.0.0.1" value={ruIpAddress} onChange={(e) => setRuIpAddress(e.target.value)} />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label className="text-sm">MIMO</Label>
            <Switch checked={mimo} onCheckedChange={setMimo} />
          </div>
        </div>
      )}

      {/* Service & network options */}
      <div className="space-y-2 rounded-md border p-3">
        <Label className="text-sm font-semibold">Service &amp; Network</Label>

        <div className="flex items-center justify-between">
          <Label className="text-sm">LTE auto service</Label>
          <Switch checked={components.ltService} onCheckedChange={(v) => setComp('ltService', v)} />
        </div>

        {components.ltService && (
          <div className="flex items-center justify-between ml-4 pl-2 border-l">
            <Label className="text-sm">Enable on boot</Label>
            <Switch checked={components.ltServiceEnable} onCheckedChange={(v) => setComp('ltServiceEnable', v)} />
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label className="text-sm">NAT for IPv4</Label>
          <Switch checked={useNat} onCheckedChange={setUseNat} />
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm">IPv6</Label>
          <Switch checked={useIPv6} onCheckedChange={setUseIPv6} />
        </div>
      </div>

      {/* Install Button */}
      <Button
        onClick={handleInstall}
        disabled={!canSubmit}
        size="lg"
        className="w-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300 disabled:text-white"
      >
        {isInstalling ? 'Installing...' : 'Install Software'}
      </Button>
    </div>
  );
}
