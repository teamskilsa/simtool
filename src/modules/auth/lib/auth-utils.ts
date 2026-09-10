// modules/auth/lib/auth-utils.ts
import { z } from 'zod';
import type { LoginCredentials, User } from '../types';
import type { User as AppUser } from '@/modules/users/types';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const USERS_STORAGE_KEY = 'stored_users';

/** A user record as kept in localStorage: the app user plus its (mock-auth)
 *  password. The auth `User` type only has id/username/role, so these records
 *  — which also carry preferences and timestamps — fit nowhere they were used,
 *  and the user management screens could not load them as their own type. */
export type StoredUser = AppUser & { password?: string };

/** The session user never needs the password. Keep it out of auth state and
 *  out of the `user_data` copy the auth context writes to localStorage. */
function withoutPassword(stored: StoredUser): User {
  const { password, ...user } = stored;
  void password;
  return user;
}

// Default admin user configuration
export const DEFAULT_ADMIN: StoredUser = {
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
      return { user: withoutPassword(DEFAULT_ADMIN) };
    }

    // Get stored users
    const storedUsersJson = typeof window !== 'undefined' ? localStorage.getItem(USERS_STORAGE_KEY) : null;
    const storedUsers: StoredUser[] = storedUsersJson ? JSON.parse(storedUsersJson) : [];

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

    console.log('Login successful:', user.username); // Debug log
    return { user: withoutPassword(user) };
  }
};

// Add users utility functions
export const userUtils = {
  getStoredUsers: (): StoredUser[] => {
    if (typeof window === 'undefined') return [];
    const storedUsersJson = localStorage.getItem(USERS_STORAGE_KEY);
    return storedUsersJson ? JSON.parse(storedUsersJson) : [];
  },

  updateStoredUsers: (users: StoredUser[]): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  },

  addUser: (user: StoredUser): void => {
    const users = userUtils.getStoredUsers();
    users.push(user);
    userUtils.updateStoredUsers(users);
  },

  updateUser: (userId: string, updates: Partial<StoredUser>): void => {
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