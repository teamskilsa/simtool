import { Activity } from '../types';

const ACTIVITY_STORAGE_KEY = 'user_activities';

export const logActivity = async (activity: Omit<Activity, 'id' | 'timestamp'>) => {
  try {
    const activities = await loadActivities();
    const newActivity: Activity = {
      ...activity,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    activities.push(newActivity);
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(activities));
    return newActivity;
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

export const loadActivities = async (): Promise<Activity[]> => {
  try {
    const data = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading activities:', error);
    return [];
  }
};

export const clearActivities = async (): Promise<void> => {
  localStorage.removeItem(ACTIVITY_STORAGE_KEY);
};
