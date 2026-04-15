// modules/dashboard/components/dashboard-content.tsx
'use client';

import type { ThemeConfig } from '../types';

interface DashboardContentProps {
  activeSection: string;
  themeConfig: ThemeConfig;
}

export const DashboardContent = ({
  activeSection,
  themeConfig
}: DashboardContentProps) => {
  return (
    <div className="flex-1 p-6">
      <div className={`
        rounded-xl shadow-sm 
        ${themeConfig.colors.card}
        ${themeConfig.border}
        backdrop-blur-sm
      `}>
        <div className={`px-6 py-4 border-b ${themeConfig.border} flex items-center justify-between`}>
          <h1 className={`text-xl font-semibold ${themeConfig.colors.primaryText}`}>
            {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
          </h1>
          <div className="flex items-center space-x-3">
            <button className={`
              px-4 py-2 text-sm font-medium rounded-lg 
              ${themeConfig.colors.secondary} 
              ${themeConfig.colors.hover}
              transition-colors
            `}>
              Filter
            </button>
            <button className={`
              px-4 py-2 text-sm font-medium rounded-lg 
              ${themeConfig.accent} 
              text-white 
              ${themeConfig.accentHover}
              transition-colors
            `}>
              Create New
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className={`text-sm ${themeConfig.colors.muted}`}>
            Content for {activeSection} section will be displayed here.
          </div>
        </div>
      </div>
    </div>
  );
};