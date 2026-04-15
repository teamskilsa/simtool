import { useState, useEffect } from 'react';
import { User } from '../types';
import { loadUserData, saveUserData } from '../utils/storage';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // In a real app, this would be an API call
      const userData = await loadUserData();
      if (userData) {
        setUsers([userData]); // For now, just the current user
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (newUser: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => {
    const user: User = {
      ...newUser,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setUsers([...users, user]);
    await saveUserData(user);
    return user;
  };

  const updateUser = async (userId: string, updates: Partial<User>) => {
    const updatedUsers = users.map(user => 
      user.id === userId 
        ? { ...user, ...updates, updatedAt: new Date().toISOString() }
        : user
    );
    setUsers(updatedUsers);
    
    const updatedUser = updatedUsers.find(u => u.id === userId);
    if (updatedUser) {
      await saveUserData(updatedUser);
    }
  };

  return {
    users,
    loading,
    createUser,
    updateUser,
    loadUsers,
  };
}
