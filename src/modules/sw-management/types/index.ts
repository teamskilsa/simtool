export type TrxDriver = 'sdr' | 'n2x0' | 'b2x0' | 'x3x0' | 'n3x0' | 's72';
export type SoftwareSource = 'upload' | 'remote-path';

export interface InstallComponents {
  // Core: eNB is always installed (required base station)
  enb: boolean;
  // EPC (MME + HSS) — optional but needed for callbox
  epc: boolean;
  // IMS — requires EPC
  ims: boolean;
  // Sim server — requires EPC
  simServer: boolean;
  // MBMS gateway — optional
  mbms: boolean;
  // UE Simulator — optional
  ueSimulator: boolean;
  // Satellite utilities — optional
  satellite: boolean;
  // Web interface — optional
  webInterface: boolean;
  // License server — optional
  licenseServer: boolean;
  // LTE automatic service installation
  ltService: boolean;
  // Enable service on boot (requires ltService)
  ltServiceEnable: boolean;
}

export interface InstallOptions {
  source: SoftwareSource;
  remotePath?: string;
  components: InstallComponents;
  trxDriver: TrxDriver;
  mimo: boolean;
  useNat: boolean;
  useIPv6: boolean;
  ruIpAddress?: string;
}

export interface InstallStep {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface InstallResult {
  success: boolean;
  steps: InstallStep[];
  installLog?: string;
  error?: string;
}

export const DEFAULT_COMPONENTS: InstallComponents = {
  enb: true,
  epc: true,
  ims: true,
  simServer: false,
  mbms: false,
  ueSimulator: false,
  satellite: false,
  webInterface: true,
  licenseServer: false,
  ltService: true,
  ltServiceEnable: false,
};

// Smart defaults per system type.
// UESim → only UE Simulator component.
// Everything else (Callbox, MME, SPGW) → full NW stack (eNB + EPC + IMS + Web).
export function getDefaultComponentsForType(type: string): InstallComponents {
  if (type === 'UESim') {
    return {
      enb: false,
      epc: false,
      ims: false,
      simServer: false,
      mbms: false,
      ueSimulator: true,
      satellite: false,
      webInterface: true,
      licenseServer: false,
      ltService: true,
      ltServiceEnable: false,
    };
  }
  return { ...DEFAULT_COMPONENTS };
}
