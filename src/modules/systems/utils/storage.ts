// modules/systems/utils/storage.ts
const SYSTEMS_STORAGE_KEY = 'stored_systems';

export const systemsStorage = {
  getSystems: () => {
    try {
      const stored = localStorage.getItem(SYSTEMS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading systems:', error);
      return [];
    }
  },

  saveSystems: (systems: any[]) => {
    try {
      localStorage.setItem(SYSTEMS_STORAGE_KEY, JSON.stringify(systems));
    } catch (error) {
      console.error('Error saving systems:', error);
    }
  },

  addSystem: (system: any) => {
    const systems = systemsStorage.getSystems();
    systems.push(system);
    systemsStorage.saveSystems(systems);
  },

  updateSystem: (id: string, updates: any) => {
    const systems = systemsStorage.getSystems();
    const index = systems.findIndex((s: any) => s.id === id);
    if (index !== -1) {
      systems[index] = { ...systems[index], ...updates };
      systemsStorage.saveSystems(systems);
    }
  },

  deleteSystem: (id: string) => {
    const systems = systemsStorage.getSystems();
    const filtered = systems.filter((s: any) => s.id !== id);
    systemsStorage.saveSystems(filtered);
  }
};

// Add this to ensure systems persist across auth changes
export const preserveSystemsOnLogout = () => {
  const systems = systemsStorage.getSystems();
  if (systems.length > 0) {
    const systemsBackup = JSON.stringify(systems);
    localStorage.setItem('systems_backup', systemsBackup);
  }
};

export const restoreSystemsAfterLogin = () => {
  const backup = localStorage.getItem('systems_backup');
  if (backup) {
    localStorage.setItem(SYSTEMS_STORAGE_KEY, backup);
    localStorage.removeItem('systems_backup');
  }
};