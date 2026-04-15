// src/modules/testConfig/components/SectionFiles/SectionList.tsx
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { FileText, Folder } from 'lucide-react';
import { useTheme } from '@/components/theme/context/theme-context';
import { themes } from '@/components/theme/themes';

interface Section {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: Section[];
}

interface SectionListProps {
  sections: Section[];
  onSelect: (section: Section) => void;
  selectedSection?: Section;
}

export const SectionList: React.FC<SectionListProps> = ({
  sections,
  onSelect,
  selectedSection
}) => {
  const { theme } = useTheme();
  const themeConfig = themes[theme];

  const renderSection = (section: Section, level = 0) => {
    const isSelected = selectedSection?.id === section.id;

    return (
      <div key={section.id}>
        <Card
          className={`
            p-2 cursor-pointer transition-all
            ${isSelected ? themeConfig.surfaces.selected : 'hover:bg-accent'}
          `}
          onClick={() => onSelect(section)}
          style={{ marginLeft: `${level * 1.5}rem` }}
        >
          <div className="flex items-center gap-2">
            {section.type === 'folder' ? (
              <Folder className="w-4 h-4" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            <span className="text-sm">{section.name}</span>
          </div>
        </Card>
        {section.children?.map((child) => renderSection(child, level + 1))}
      </div>
    );
  };

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-1 p-2">
        {sections.map((section) => renderSection(section))}
      </div>
    </ScrollArea>
  );
};
