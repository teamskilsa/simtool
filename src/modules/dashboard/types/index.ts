// modules/dashboard/types/index.ts
import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  id: string;
  icon: LucideIcon;
  label: string;
  badge?: string;
  color: string;
  subItems?: {
    id: string;
    label: string;
    icon: LucideIcon;
  }[];
}

export interface ThemeConfig {
  name: string;
  gradient: string;
  accent: string;
  accentHover: string;
  blur: string;
  text: string;
  border: string;
  colors: {
    primary: string;
    primaryText: string;
    secondary: string;
    card: string;
    sidebar: string;
    header: string;
    hover: string;
    muted: string;
    divider: string;
  };
  badges: {
    default: string;
    new: string;
  };
}