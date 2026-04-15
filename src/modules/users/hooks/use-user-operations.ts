// modules/users/hooks/use-user-operations.ts
import { useState, useEffect } from 'react';
import type { User } from '../types';
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

  const updateUser = async (userId: string, updates: Partial<User>) => {
    try {
      userUtils.updateUser(userId, {
        ...updates,
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