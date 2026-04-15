export type ComponentType = 'ENB' | 'UE' | 'MME' | 'IMS' | 'MBMS';

export interface CommandParam {
  type: 'number' | 'string' | 'boolean' | 'hex';
  description: string;
  required?: boolean;
  default?: any;
  validator?: (value: any) => boolean;
  min?: number;
  max?: number;
}

export interface CommandTemplate {
  id: string;
  category: string;
  subCategory?: string;
  label: string;
  command: string;
  description: string;
  requiresParams?: boolean;
  params?: Record<string, CommandParam>;
  notes?: string;
  example?: string;
}

export interface CellConfig {
  cell_id: number;
  [key: string]: any;
}
