// src/components/theme/types/theme.types.ts

// Base color scales for consistent color management
export type ColorScale = {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
};

export type Shadows = {
  sm: string;
  base: string;
  md: string;
  lg: string;
  xl: string;
  inner: string;
  none: string;
};

// Add Typography types
export type Typography = {
  font: {
    sans: string;
    mono: string;
    heading: string;
  };
  weight: {
    normal: string;
    medium: string;
    semibold: string;
    bold: string;
  };
  size: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
  };
  spacing: {
    tight: string;
    normal: string;
    wide: string;
  };
};

// Semantic color mapping
export type SemanticColors = {
  primary: ColorScale & { foreground: string };
  secondary: ColorScale & { foreground: string };
  accent: ColorScale & { foreground: string };
  destructive: ColorScale & { foreground: string };
  success: ColorScale & { foreground: string };
  warning: ColorScale & { foreground: string };
  info: ColorScale & { foreground: string };
};

// Status indicators
export type StatusColors = {
  online: string;
  offline: string;
  busy: string;
  away: string;
  error: string;
  success: string;
  warning: string;
  info: string;
};

// Surface styles for different contexts
export type Surfaces = {
  page: {
    background: string;
    foreground: string;
    border: string;
  };
  card: {
    background: string;
    foreground: string;
    border: string;
    hover: string;
  };
  sidebar: {
    background: string;
    foreground: string;
    border: string;
    hover: string;
  };
  header: {
    background: string;
    foreground: string;
    border: string;
  };
  dropdown: {
    background: string;
    foreground: string;
    border: string;
    hover: string;
  };
  modal: {
    background: string;
    foreground: string;
    border: string;
    overlay: string;
  };
  input: {
    background: string;
    border: string;
    text: string;
    placeholder: string;
    focus: string;
    hover: string;
  };
};

// Component-specific styles
export type ComponentStyles = {
  button: {
    base: string;
    variants: {
      default: string;
      secondary: string;
      outline: string;
      ghost: string;
      link: string;
      destructive: string;
    };
    sizes: {
      sm: string;
      default: string;
      lg: string;
      icon: string;
    };
    states: {
      active: string;
      disabled: string;
      loading: string;
    };
  };
  input: {
    base: string;
    variants: {
      default: string;
      filled: string;
      outline: string;
      ghost: string;
    };
    states: {
      focus: string;
      error: string;
      disabled: string;
    };
  };
  select: {
    trigger: string;
    content: string;
    item: string;
    itemHighlighted: string;
  };
  badge: {
    base: string;
    variants: {
      default: string;
      secondary: string;
      outline: string;
      destructive: string;
    };
  };
  card: {
    base: string;
    interactive: string;
    header: string;
    content: string;
    footer: string;
  };
  navigation: {
    item: string;
    itemActive: string;
    itemIcon: string;
    subItem: string;
    subItemActive: string;
  };
};

// Effects and animations
export type Effects = {
  blur: {
    sm: string;
    md: string;
    lg: string;
  };
  glass: {
    light: string;
    medium: string;
    heavy: string;
  };
  animation: {
    fade: string;
    slide: string;
    scale: string;
    spin: string;
  };
  transition: {
    fast: string;
    default: string;
    slow: string;
  };
};

// Dialog specific styles
export type DialogStyles = {
  header: {
    background: string;
    text: string;
  };
  content: {
    background: string;
    border: string;
  };
  input: {
    background: string;
    border: string;
    text: string;
    placeholder: string;
    focus: string;
    hover: string;
  };
  sizes: {
    sm: { width: string; maxWidth: string };
    md: { width: string; maxWidth: string };
    lg: { width: string; maxWidth: string };
  };
  effects: {
    blur: string;
    saturation: string;
  };
};

// Main theme configuration type
export interface ThemeConfig {
  name: string;
  colors: SemanticColors;
  typography: Typography;  
  status: StatusColors;
  surfaces: Surfaces;
  components: ComponentStyles;
  effects: Effects;
  shadows: Shadows;
  gradients: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  dialogs: DialogStyles;
  darkMode?: {
    colors: Partial<SemanticColors>;
    surfaces: Partial<Surfaces>;
    effects: Partial<Effects>;
    dialogs?: Partial<DialogStyles>;
  };
}

// Theme utility types
export type ThemeMode = 'light' | 'dark';
export type ThemeVariant = 'simple' | 'teal' | 'indigo' | 'rose' | 'amber' | 'emerald' | 'sky';

// Theme context type
export interface ThemeContextType {
  theme: ThemeVariant;
  setTheme: (theme: ThemeVariant) => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}