export const simpleTheme = {
  name: 'Simple',
  gradient: 'bg-gradient-to-br from-gray-100 via-gray-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900',
  accent: 'bg-blue-600',
  accentHover: 'hover:bg-blue-700',
  accentFocus: 'focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
  blur: 'bg-white/70 dark:bg-gray-800/70',
  text: 'text-blue-600 dark:text-blue-400',
  border: 'border-gray-200 dark:border-gray-700',
  colors: {
    primary: 'bg-blue-600 dark:bg-blue-500',
    primaryLight: 'bg-blue-500 dark:bg-blue-400',
    primaryDark: 'bg-blue-700 dark:bg-blue-600',
    primaryText: 'text-blue-600 dark:text-blue-400',
    secondary: 'bg-gray-100 dark:bg-gray-800',
    secondaryHover: 'hover:bg-gray-200 dark:hover:bg-gray-700',
    card: 'bg-white dark:bg-gray-800',
    cardHover: 'hover:bg-gray-50 dark:hover:bg-gray-700',
    sidebar: 'bg-white dark:bg-gray-800',
    header: 'bg-white dark:bg-gray-800',
    hover: 'hover:bg-gray-100 dark:hover:bg-gray-700',
    muted: 'text-gray-600 dark:text-gray-300',
    mutedHover: 'hover:text-gray-900 dark:hover:text-white',
    divider: 'border-gray-200 dark:border-gray-700',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-amber-600 dark:text-amber-400',
    error: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
    surface: 'bg-white dark:bg-gray-800',
    surfaceHover: 'hover:bg-gray-50 dark:hover:bg-gray-700'
  },
  badges: {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    new: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400',
    success: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-400'
  },
  status: {
    online: 'bg-green-500',
    offline: 'bg-gray-500',
    busy: 'bg-red-500',
    away: 'bg-amber-500'
  },
  components: {
    input: 'bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg',
    inputFocus: 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
    button: 'bg-blue-600 text-white dark:bg-blue-500',
    buttonHover: 'hover:bg-blue-700 dark:hover:bg-blue-600',
    card: 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700',
    cardHover: 'hover:bg-white/90 dark:hover:bg-gray-800/90 hover:shadow-lg',
    dropdown: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg',
    dropdownHover: 'hover:bg-gray-100 dark:hover:bg-gray-700',
    tooltip: 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-2 py-1 rounded text-sm',
    modal: 'bg-white dark:bg-gray-800 shadow-xl rounded-lg',
    toast: 'bg-white dark:bg-gray-800 shadow-lg rounded-lg border-l-4'
  }
} as const;
