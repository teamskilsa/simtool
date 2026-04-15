export const GROUP_ACTIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  ADD_CONFIG: 'add_config',
  REMOVE_CONFIG: 'remove_config',
} as const;

export const MESSAGES = {
  CREATE_SUCCESS: 'Group created successfully',
  UPDATE_SUCCESS: 'Group updated successfully',
  DELETE_SUCCESS: 'Group deleted successfully',
  CREATE_ERROR: 'Failed to create group',
  UPDATE_ERROR: 'Failed to update group',
  DELETE_ERROR: 'Failed to delete group',
} as const;
