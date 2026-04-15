import { ReactNode } from 'react';

export interface Group {
  id: string;
  name: string;
  parentId: string | null;
  description?: string;
  createdAt: Date;
  modifiedAt: Date;
  createdBy: string;
}

export interface ConfigItem {
  id: string;
  name: string;
  module: string;
  createdAt: Date;
  modifiedAt: Date;
}

export interface GroupConfigListProps {
  groupId: string | null;
  configs: ConfigItem[];
  selectedConfigs: Set<string>;
  onConfigSelect: (configId: string) => void;
  onConfigsAdd: (configIds: string[]) => void;
  onConfigsRemove: (configIds: string[]) => void;
}

export interface GroupManagementProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreate?: (group: Omit<Group, 'id'>) => void;  // Note the Omit<Group, 'id'>
  onGroupUpdate?: (group: Group) => void;
  onGroupDelete?: (groupId: string) => void;
}

export interface GroupTreeProps {
  groups: Group[];
  selectedGroupId: string | null;
  onSelect: (groupId: string) => void;
}

export interface GroupDetailsProps {
  group: Group | null;
  configs: string[];
  onUpdate: (group: Group) => void;
  onDelete: (groupId: string) => void;
  onDrop: (draggedId: string, targetId: string) => void;
  selection: GroupSelectionState;
  onSelectionChange: (selection: GroupSelectionState) => void;
}

export interface DragItem {
  type: 'GROUP';
  id: string;
  parentId: string | null;
}

export interface GroupSelectionState {
  selectedIds: Set<string>;
  lastSelected: string | null;
}