import { User, UserPreferences } from '../types';

const USER_STORAGE_KEY = 'user_data';
const AUTH_STORAGE_KEY = 'auth_token';

export async function loadUserData(): Promise<User | null> {
  try {
    const data = localStorage.getItem(USER_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading user data:', error);
    return null;
  }
}

export async function saveUserData(user: User): Promise<void> {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Error saving user data:', error);
  }
}

export async function clearUserData(): Promise<void> {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing user data:', error);
  }
}

export const getDefaultPreferences = (): UserPreferences => ({
  theme: 'indigo',
  sidebarOpen: true,
  defaultVisibility: 'private',
  notifications: {
    configChanges: true,
    teamUpdates: true,
  },
});
