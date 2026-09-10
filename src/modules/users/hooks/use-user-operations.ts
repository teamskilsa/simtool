// modules/users/hooks/use-user-operations.ts
import { useState, useEffect } from 'react';
import type { User, UserPreferences } from '../types';
import { userUtils } from '@/modules/auth/lib/auth-utils';

export function useUserOperations() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const storedUsers = userUtils.getStoredUsers();
      setUsers(storedUsers);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newUser: User = {
        ...userData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      userUtils.addUser(newUser);
      await loadUsers();
      return newUser;
    } catch (err) {
      setError('Failed to create user');
      throw err;
    }
  };

  // Edit User sends a partial preferences object (only notifications) and,
  // when it was changed, a new password.
  const updateUser = async (
    userId: string,
    updates: Omit<Partial<User>, 'preferences'> & { preferences?: Partial<UserPreferences>; password?: string },
  ) => {
    try {
      // Merge preferences instead of replacing them: the edit form carries only
      // notifications, and the shallow update wiped the user's theme, sidebar
      // and visibility preferences on every save.
      const existing = userUtils.getStoredUsers().find(u => u.id === userId);
      const { preferences, ...rest } = updates;
      userUtils.updateUser(userId, {
        ...rest,
        ...(preferences && existing
          ? { preferences: { ...existing.preferences, ...preferences } }
          : {}),
        updatedAt: new Date().toISOString(),
      });
      await loadUsers();
    } catch (err) {
      setError('Failed to update user');
      throw err;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const adminUsers = users.filter(u => u.role === 'admin');
      const userToDelete = users.find(u => u.id === userId);

      if (userToDelete?.role === 'admin' && adminUsers.length === 1) {
        throw new Error('Cannot delete the last admin user');
      }

      userUtils.deleteUser(userId);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      throw err;
    }
  };

  return {
    users,
    loading,
    error,
    createUser,
    updateUser,
    deleteUser,
    loadUsers,
  };
}