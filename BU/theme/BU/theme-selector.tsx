'use client';

import { Palette } from 'lucide-react';
import { useTheme } from './context/theme-context';
import { themes, themeGroups } from './themes';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const themeConfig = themes[theme];
  
  return (
    <div style={{ width: '180px' }}>
      <Select value={theme} onValueChange={setTheme}>
        <SelectTrigger 
          className={`${themeConfig.components.input} ${themeConfig.components.inputFocus}`}
        >
          <div className="flex items-center gap-2">
            <Palette className={`h-4 w-4 ${themeConfig.text}`} />
            <SelectValue placeholder="Select theme" />
          </div>
        </SelectTrigger>
        <SelectContent
          align="end"
          sideOffset={4}
          className={`${themeConfig.components.dropdown} backdrop-blur-md`}
        >
          <SelectGroup>
            <SelectLabel className="text-xs font-medium opacity-70">Primary Themes</SelectLabel>
            {themeGroups.primary.map(themeKey => (
              <SelectItem key={themeKey} value={themeKey}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${themes[themeKey].accent}`} />
                  <span>{themes[themeKey].name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel className="text-xs font-medium opacity-70 pt-2">Accent Themes</SelectLabel>
            {themeGroups.accent.map(themeKey => (
              <SelectItem key={themeKey} value={themeKey}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${themes[themeKey].accent}`} />
                  <span>{themes[themeKey].name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}