export interface Group {
  id: string;
  name: string;
  parentId: string | null;
  description?: string;
  createdAt: Date;
  modifiedAt: Date;
  createdBy: string;
}

export interface GroupMetadata {
  groups: Record<string, Group>;
}

export interface GroupConfigIndex {
  [groupId: string]: string[];  // configIds
}

export interface TypeIndex {
  [type: string]: string[];    // configIds
}

export interface IndexFiles {
  groupMetadata: GroupMetadata;
  groupConfigs: GroupConfigIndex;
  typeIndex: TypeIndex;
}