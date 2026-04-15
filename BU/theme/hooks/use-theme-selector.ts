import { useTheme } from '../context/theme-context';
import { themes, type ThemeType } from '../themes';

export function useThemeSelector() {
  const { theme, setTheme } = useTheme();
  // Ensure we always have a valid theme by falling back to 'blue' if the current theme is invalid
  const currentTheme = (themes[theme] ? theme : 'blue') as ThemeType;
  const themeConfig = themes[currentTheme];

  return {
    currentTheme,
    themeConfig,
    setTheme,
    themes,
  };
}