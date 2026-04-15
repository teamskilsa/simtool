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

export interface ThemeConfig {
  name: string;
  colors: SemanticColors;
  status: StatusColors;
  surfaces: Surfaces;
  components: ComponentStyles;
  effects: Effects;
  gradients: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  darkMode?: {
    colors: {
      primary: Partial<ColorScale & { foreground: string }>;
      secondary: Partial<ColorScale & { foreground: string }>;
      accent: Partial<ColorScale & { foreground: string }>;
      destructive: Partial<ColorScale & { foreground: string }>;
      success: Partial<ColorScale & { foreground: string }>;
      warning: Partial<ColorScale & { foreground: string }>;
      info: Partial<ColorScale & { foreground: string }>;
    };
    surfaces: Partial<Surfaces>;
    effects: Partial<Effects>;
    dialogs: {
      glass: {
        background: {
          light: string;
          dark: string;
        };
        border: {
          light: string;
          dark: string;
        };
        input: {
          light: string;
          dark: string;
        };
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
  }

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

// Main theme configuration type
export interface ThemeConfig {
  name: string;
  colors: SemanticColors;
  status: StatusColors;
  surfaces: Surfaces;
  components: ComponentStyles;
  effects: Effects;
  gradients: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  darkMode?: {
    colors: Partial<SemanticColors>;
    surfaces: Partial<Surfaces>;
    effects: Partial<Effects>;
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
