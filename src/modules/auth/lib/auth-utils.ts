// modules/auth/lib/auth-utils.ts
import { z } from 'zod';
import type { LoginCredentials, User } from '../types';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const USERS_STORAGE_KEY = 'stored_users';

// Default admin user configuration
export const DEFAULT_ADMIN: User = {
  id: 'admin',
  username: 'admin',
  password: 'admin123', // Default password is admin123
  role: 'admin',
  preferences: {
    theme: 'indigo',
    sidebarOpen: true,
    defaultVisibility: 'private',
    notifications: {
      configChanges: true,
      teamUpdates: true,
    },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Initialize system with default admin
const initializeSystem = () => {
  if (typeof window === 'undefined') return;
  
  const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
  if (!storedUsers) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([DEFAULT_ADMIN]));
    console.log('System initialized with default admin');
  }
};

// Only initialize on client side
if (typeof window !== 'undefined') {
  initializeSystem();
}

export const mockAuthService = {
  login: async (credentials: LoginCredentials): Promise<{ user: User }> => {
    console.log('Login attempt:', credentials); // Debug log

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check for default admin login
    if (credentials.username.toLowerCase() === 'admin' && 
        credentials.password === 'admin123') {
      // Always use DEFAULT_ADMIN for admin login
      console.log('Admin login successful'); // Debug log
      return { user: DEFAULT_ADMIN };
    }

    // Get stored users
    const storedUsersJson = typeof window !== 'undefined' ? localStorage.getItem(USERS_STORAGE_KEY) : null;
    const storedUsers: User[] = storedUsersJson ? JSON.parse(storedUsersJson) : [];

    console.log('Stored users:', storedUsers); // Debug log

    // Find user by username (case-insensitive)
    const user = storedUsers.find(
      u => u.username.toLowerCase() === credentials.username.toLowerCase()
    );

    if (!user) {
      console.log('User not found'); // Debug log
      throw new Error('User not found');
    }

    if (user.password !== credentials.password) {
      console.log('Invalid password'); // Debug log
      throw new Error('Invalid password');
    }

    console.log('Login successful:', user); // Debug log
    return { user };
  }
};

// Add users utility functions
export const userUtils = {
  getStoredUsers: (): User[] => {
    if (typeof window === 'undefined') return [];
    const storedUsersJson = localStorage.getItem(USERS_STORAGE_KEY);
    return storedUsersJson ? JSON.parse(storedUsersJson) : [];
  },

  updateStoredUsers: (users: User[]): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  },

  addUser: (user: User): void => {
    const users = userUtils.getStoredUsers();
    users.push(user);
    userUtils.updateStoredUsers(users);
  },

  updateUser: (userId: string, updates: Partial<User>): void => {
    const users = userUtils.getStoredUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      userUtils.updateStoredUsers(users);
    }
  },

  deleteUser: (userId: string): void => {
    const users = userUtils.getStoredUsers();
    const filteredUsers = users.filter(u => u.id !== userId);
    userUtils.updateStoredUsers(filteredUsers);
  }
};