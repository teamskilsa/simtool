import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';

export const useDialogStyles = () => {
  const { theme, mode } = useTheme();
  const themeConfig = themes[theme];

  const getBackgroundStyle = () => {
    return themeConfig.dialogs.glass.background[mode];
  };

  const getBorderStyle = () => {
    return themeConfig.dialogs.glass.border[mode];
  };

  const getInputStyle = () => {
    return `
      ${themeConfig.dialogs.glass.input[mode]}
      ${mode === 'light' ? 'hover:bg-white' : 'hover:bg-slate-800'}
      placeholder:text-slate-400
      transition-colors
    `;
  };

  const getEffects = () => {
    return `
      ${themeConfig.dialogs.effects.blur}
      ${themeConfig.dialogs.effects.saturation}
      ${themeConfig.effects.glass.medium}
    `;
  };

  return {
    getBackgroundStyle,
    getBorderStyle,
    getInputStyle,
    getEffects
  };
};
