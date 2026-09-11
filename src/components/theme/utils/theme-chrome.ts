/**
 * theme-chrome.ts
 * Static Tailwind-class lookups for accent surfaces (primary buttons, avatars,
 * list-header accents) that used to follow the selected colour variant.
 *
 * SimTool now wears the Simnovus palette shared with SimQA and the Simnovator
 * GUI, so every variant resolves to the brand orange. The map is kept (rather
 * than deleting it) so the existing call sites need no edits. Static strings on
 * purpose: Tailwind's JIT must see every class at build time.
 */
import type { ThemeVariant } from '../themes';

const BRAND_BG = 'bg-brand-orange';
const BRAND_HOVER = 'hover:bg-brand-orange-600';

/** Solid accent background. */
export const THEME_CHROME_BG: Record<ThemeVariant, string> = {
  indigo:  BRAND_BG,
  rose:    BRAND_BG,
  amber:   BRAND_BG,
  emerald: BRAND_BG,
  sky:     BRAND_BG,
  teal:    BRAND_BG,
};

/** Slightly darker hover for items drawn on that accent. */
export const THEME_CHROME_ITEM_HOVER: Record<ThemeVariant, string> = {
  indigo:  BRAND_HOVER,
  rose:    BRAND_HOVER,
  amber:   BRAND_HOVER,
  emerald: BRAND_HOVER,
  sky:     BRAND_HOVER,
  teal:    BRAND_HOVER,
};
