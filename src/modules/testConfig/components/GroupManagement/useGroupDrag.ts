// hooks/useGroupDrag.ts
import { useDrag, useDrop } from 'react-dnd';
import { Group } from '../types';

export const useGroupDrag = (group: Group) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'GROUP',
    item: { 
      type: 'GROUP',
      id: group.id,
      parentId: group.parentId 
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'GROUP',
    drop: (item: DragItem) => {
      return { id: group.id };
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return { isDragging, isOver, dragRef: drag, dropRef: drop };
};

// hooks/useGroupSelection.ts
import { useState, useCallback } from 'react';
import { GroupSelectionState } from '../types';

export const useGroupSelection = () => {
  const [selection, setSelection] = useState<GroupSelectionState>({
    selectedIds: new Set(),
    lastSelected: null
  });

  const handleSelect = useCallback((id: string, event: React.MouseEvent) => {
    setSelection(prev => {
      const newSelection = new Set(prev.selectedIds);

      if (event.ctrlKey || event.metaKey) {
        // Toggle selection
        if (newSelection.has(id)) {
          newSelection.delete(id);
        } else {
          newSelection.add(id);
        }
      } else if (event.shiftKey && prev.lastSelected) {
        // Range selection - you'll need to implement the range logic
      } else {
        // Single selection
        newSelection.clear();
        newSelection.add(id);
      }

      return {
        selectedIds: newSelection,
        lastSelected: id
      };
    });
  }, []);

  return { selection, handleSelect };
};