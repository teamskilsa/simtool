// src/components/theme/theme-selector.tsx
'use client';

import { Palette, Moon, Sun } from 'lucide-react';
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
import { Button } from "@/components/ui/button";

export function ThemeSelector() {
  const { theme, mode, setTheme, setMode } = useTheme();
  const themeConfig = themes[theme];
  
  return (
    <div className="flex items-center gap-2">
      <Select value={theme} onValueChange={setTheme}>
        <SelectTrigger 
          className="w-[180px] bg-white/50 border-input"
        >
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            <SelectValue placeholder="Select theme" />
          </div>
        </SelectTrigger>
        <SelectContent
          align="end"
          sideOffset={4}
          className="bg-white/98 border shadow-md"
        >
          <SelectGroup>
            <SelectLabel className="text-xs font-medium opacity-70">Primary Themes</SelectLabel>
            {themeGroups.primary.map(themeKey => (
              <SelectItem key={themeKey} value={themeKey}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${themes[themeKey].components.button.variants.default}`} />
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
                  <div className={`w-3 h-3 rounded-full ${themes[themeKey].components.button.variants.default}`} />
                  <span>{themes[themeKey].name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
      >
        {mode === 'light' ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}