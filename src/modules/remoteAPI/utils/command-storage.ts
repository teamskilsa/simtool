// src/modules/remoteAPI/utils/command-storage.ts

export interface SavedCommand {
  name: string;
  command: string;
  type: string;
  timestamp: string;
}

export const commandStorage = {
  saveCommand(name: string, command: string, type: string): void {
    const saved = this.getSavedCommands();
    saved.push({
      name,
      command,
      type,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('savedCommands', JSON.stringify(saved));
  },

  getSavedCommands(): SavedCommand[] {
    const saved = localStorage.getItem('savedCommands');
    return saved ? JSON.parse(saved) : [];
  },

  deleteCommand(name: string): void {
    const saved = this.getSavedCommands();
    const updated = saved.filter(cmd => cmd.name !== name);
    localStorage.setItem('savedCommands', JSON.stringify(updated));
  }
};