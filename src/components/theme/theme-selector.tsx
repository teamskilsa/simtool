// src/components/theme/theme-selector.tsx
//
// This used to be a colour-variant dropdown (Indigo, Rose, Amber, ...) beside a
// light/dark button. SimTool now wears the Simnovus palette shared with SimQA
// and the Simnovator GUI, so the variant picker is gone and only the mode
// toggle remains. The export name is kept so existing call sites (login page)
// keep working.
'use client';

import { ModeToggle } from './mode-toggle';

export function ThemeSelector() {
  return <ModeToggle />;
}
