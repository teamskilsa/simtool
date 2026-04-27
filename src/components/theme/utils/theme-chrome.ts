/**
 * theme-chrome.ts
 * Static Tailwind-class lookups for header / sidebar backgrounds.
 * We use a static object so Tailwind's JIT can see every class at build time —
 * never build class strings dynamically (e.g. `bg-${theme}-600`).
 */
import type { ThemeVariant } from '../themes';

/** Solid background for the app chrome (header bar, sidebar panel). */
export const THEME_CHROME_BG: Record<ThemeVariant, string> = {
  indigo:  'bg-indigo-600',
  rose:    'bg-rose-600',
  amber:   'bg-amber-600',
  emerald: 'bg-emerald-600',
  sky:     'bg-sky-600',
  teal:    'bg-teal-600',
};

/** Slightly-darker hover colour for individual nav items inside the chrome. */
export const THEME_CHROME_ITEM_HOVER: Record<ThemeVariant, string> = {
  indigo:  'hover:bg-indigo-700',
  rose:    'hover:bg-rose-700',
  amber:   'hover:bg-amber-700',
  emerald: 'hover:bg-emerald-700',
  sky:     'hover:bg-sky-700',
  teal:    'hover:bg-teal-700',
};
