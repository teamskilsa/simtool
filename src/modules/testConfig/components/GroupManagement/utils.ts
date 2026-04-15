import { Group } from './types';

export const buildGroupTree = (groups: Group[]): Group[] => {
  const groupMap = new Map(groups.map(group => [group.id, { ...group, children: [] }]));
  const roots: Group[] = [];

  for (const group of groups) {
    if (group.parentId === null) {
      roots.push(groupMap.get(group.id)!);
    } else {
      const parent = groupMap.get(group.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(groupMap.get(group.id)!);
      }
    }
  }

  return roots;
};

export const getAllDescendants = (groups: Group[], groupId: string): string[] => {
  const descendants: string[] = [];
  
  const traverse = (id: string) => {
    const children = groups.filter(g => g.parentId === id);
    children.forEach(child => {
      descendants.push(child.id);
      traverse(child.id);
    });
  };

  traverse(groupId);
  return descendants;
};

export const getGroupPath = (groups: Group[], groupId: string): Group[] => {
  const path: Group[] = [];
  let current = groups.find(g => g.id === groupId);
  
  while (current) {
    path.unshift(current);
    current = current.parentId 
      ? groups.find(g => g.id === current?.parentId) 
      : null;
  }
  
  return path;
};

export const canMoveGroup = (
  groups: Group[],
  sourceId: string,
  targetId: string
): boolean => {
  // Prevent moving to own descendant
  const descendants = getAllDescendants(groups, sourceId);
  return !descendants.includes(targetId);
};