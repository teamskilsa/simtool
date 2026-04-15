// src/components/theme/utils/palette.ts
export const palette = {
  // Base neutral colors
  gray: {
    50: 'rgb(249 250 251)',
    100: 'rgb(243 244 246)',
    200: 'rgb(229 231 235)',
    300: 'rgb(209 213 219)',
    400: 'rgb(156 163 175)',
    500: 'rgb(107 114 128)',
    600: 'rgb(75 85 99)',
    700: 'rgb(55 65 81)',
    800: 'rgb(31 41 55)',
    900: 'rgb(17 24 39)'
  },
  
  // Primary theme colors
  teal: {
    50: 'rgb(240 253 250)',
    100: 'rgb(204 251 241)',
    200: 'rgb(153 246 228)',
    300: 'rgb(94 234 212)',
    400: 'rgb(45 212 191)',
    500: 'rgb(20 184 166)',
    600: 'rgb(13 148 136)',
    700: 'rgb(15 118 110)',
    800: 'rgb(17 94 89)',
    900: 'rgb(19 78 74)'
  },
  
  indigo: {
    50: 'rgb(238 242 255)',
    100: 'rgb(224 231 255)',
    200: 'rgb(199 210 254)',
    300: 'rgb(165 180 252)',
    400: 'rgb(129 140 248)',
    500: 'rgb(99 102 241)',
    600: 'rgb(79 70 229)',
    700: 'rgb(67 56 202)',
    800: 'rgb(55 48 163)',
    900: 'rgb(49 46 129)'
  },

  sky: {
    50: 'rgb(240 249 255)',
    100: 'rgb(224 242 254)',
    200: 'rgb(186 230 253)',
    300: 'rgb(125 211 252)',
    400: 'rgb(56 189 248)',
    500: 'rgb(14 165 233)',
    600: 'rgb(2 132 199)',
    700: 'rgb(3 105 161)',
    800: 'rgb(7 89 133)',
    900: 'rgb(12 74 110)'
  },

  // Accent theme colors
  rose: {
    50: 'rgb(255 241 242)',
    100: 'rgb(255 228 230)',
    200: 'rgb(254 205 211)',
    300: 'rgb(253 164 175)',
    400: 'rgb(251 113 133)',
    500: 'rgb(244 63 94)',
    600: 'rgb(225 29 72)',
    700: 'rgb(190 18 60)',
    800: 'rgb(159 18 57)',
    900: 'rgb(136 19 55)'
  },

  amber: {
    50: 'rgb(255 251 235)',
    100: 'rgb(254 243 199)',
    200: 'rgb(253 230 138)',
    300: 'rgb(252 211 77)',
    400: 'rgb(251 191 36)',
    500: 'rgb(245 158 11)',
    600: 'rgb(217 119 6)',
    700: 'rgb(180 83 9)',
    800: 'rgb(146 64 14)',
    900: 'rgb(120 53 15)'
  },

  emerald: {
    50: 'rgb(236 253 245)',
    100: 'rgb(209 250 229)',
    200: 'rgb(167 243 208)',
    300: 'rgb(110 231 183)',
    400: 'rgb(52 211 153)',
    500: 'rgb(16 185 129)',
    600: 'rgb(5 150 105)',
    700: 'rgb(4 120 87)',
    800: 'rgb(6 95 70)',
    900: 'rgb(6 78 59)'
  },

  // Status/Feedback colors
  red: {
    500: 'rgb(239 68 68)',
    600: 'rgb(220 38 38)',
    700: 'rgb(185 28 28)'
  },
  green: {
    500: 'rgb(34 197 94)',
    600: 'rgb(22 163 74)',
    700: 'rgb(21 128 61)'
  }
} as const;

// Common status indicators
export const statusColors = {
  online: palette.green[500],
  offline: palette.gray[500],
  busy: palette.red[600],
  away: palette.amber[500],
  error: palette.red[600],
  success: palette.green[500],
  warning: palette.amber[500]
} as const;

// Common color combinations for components
export const commonColors = {
  white: '#ffffff',
  black: '#000000',
  background: {
    light: '#ffffff',
    dark: '#0a0a0a'
  },
  foreground: {
    light: '#171717',
    dark: '#ededed'
  },
  overlay: {
    light: 'rgb(0 0 0 / 0.5)',
    dark: 'rgb(0 0 0 / 0.7)'
  }
} as const;

// Glass effect opacities
export const glassOpacities = {
  light: {
    low: '0.5',
    medium: '0.7',
    high: '0.9'
  },
  dark: {
    low: '0.3',
    medium: '0.5',
    high: '0.7'
  }
} as const;
