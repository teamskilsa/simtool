import { ThemeConfig } from "@/components/theme/types/theme.types";

declare module "@/components/theme/types/theme.types" {
  interface ThemeConfig {
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
}

export type DialogSize = 'sm' | 'md' | 'lg';
export type DialogPadding = 'sm' | 'md' | 'lg';
export type DialogRadius = 'sm' | 'md' | 'lg';
