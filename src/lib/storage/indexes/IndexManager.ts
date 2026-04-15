import fs from 'fs/promises';
import path from 'path';
import { GroupMetadata, GroupConfigIndex, TypeIndex } from '@/modules/testConfig/types/group.types';

export class IndexManager {
  private readonly basePath: string;
  private readonly indexesPath: string;
  private readonly usersPath: string;
  private readonly groupConfigsPath: string;
  private readonly typeIndexPath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.indexesPath = path.join(basePath, '_indexes');
    this.usersPath = path.join(basePath, 'users');
    this.groupConfigsPath = path.join(this.indexesPath, 'group-configs.json');
    this.typeIndexPath = path.join(this.indexesPath, 'type-index.json');
  }

  async initializeIndexes(): Promise<void> {
    try {
      // Ensure base directories exist
      await fs.mkdir(this.indexesPath, { recursive: true });
      await fs.mkdir(this.usersPath, { recursive: true });
      
      // Initialize empty indexes if they don't exist
      const emptyGroupConfigs: GroupConfigIndex = {};
      const emptyTypeIndex: TypeIndex = {};

      await this.writeIfNotExists(this.groupConfigsPath, emptyGroupConfigs);
      await this.writeIfNotExists(this.typeIndexPath, emptyTypeIndex);

      // Initialize admin user directory if it doesn't exist
      const adminPath = path.join(this.usersPath, 'admin');
      await fs.mkdir(adminPath, { recursive: true });
      
      // Initialize admin's groups metadata
      const adminGroupsPath = path.join(adminPath, 'groups.json');
      const emptyGroupMetadata: GroupMetadata = { groups: {} };
      await this.writeIfNotExists(adminGroupsPath, emptyGroupMetadata);

    } catch (error) {
      console.error('Failed to initialize indexes:', error);
      throw error;
    }
  }

  private async writeIfNotExists(filePath: string, data: any): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }
  }

  async getGroupMetadata(userId: string = 'admin'): Promise<GroupMetadata> {
    const userGroupsPath = path.join(this.usersPath, userId, 'groups.json');
    try {
      const data = await fs.readFile(userGroupsPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist, create it with empty structure
      const emptyMetadata: GroupMetadata = { groups: {} };
      await fs.mkdir(path.dirname(userGroupsPath), { recursive: true });
      await fs.writeFile(userGroupsPath, JSON.stringify(emptyMetadata, null, 2));
      return emptyMetadata;
    }
  }

  async getGroupConfigs(): Promise<GroupConfigIndex> {
    try {
      const data = await fs.readFile(this.groupConfigsPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist, create it with empty structure
      const emptyConfigs: GroupConfigIndex = {};
      await fs.writeFile(this.groupConfigsPath, JSON.stringify(emptyConfigs, null, 2));
      return emptyConfigs;
    }
  }

  async getTypeIndex(): Promise<TypeIndex> {
    try {
      const data = await fs.readFile(this.typeIndexPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // If file doesn't exist, create it with empty structure
      const emptyIndex: TypeIndex = {};
      await fs.writeFile(this.typeIndexPath, JSON.stringify(emptyIndex, null, 2));
      return emptyIndex;
    }
  }

  async updateGroupMetadata(metadata: GroupMetadata, userId: string = 'admin'): Promise<void> {
    const userGroupsPath = path.join(this.usersPath, userId, 'groups.json');
    await fs.mkdir(path.dirname(userGroupsPath), { recursive: true });
    await fs.writeFile(userGroupsPath, JSON.stringify(metadata, null, 2));
  }

  async updateGroupConfigs(index: GroupConfigIndex): Promise<void> {
    await fs.writeFile(this.groupConfigsPath, JSON.stringify(index, null, 2));
  }

  async updateTypeIndex(index: TypeIndex): Promise<void> {
    await fs.writeFile(this.typeIndexPath, JSON.stringify(index, null, 2));
  }

  async addConfigToGroup(groupId: string, configId: string): Promise<void> {
    const groupConfigs = await this.getGroupConfigs();
    if (!groupConfigs[groupId]) {
      groupConfigs[groupId] = [];
    }
    if (!groupConfigs[groupId].includes(configId)) {
      groupConfigs[groupId].push(configId);
      await this.updateGroupConfigs(groupConfigs);
    }
  }

  async removeConfigFromGroup(groupId: string, configId: string): Promise<void> {
    const groupConfigs = await this.getGroupConfigs();
    if (groupConfigs[groupId]) {
      groupConfigs[groupId] = groupConfigs[groupId].filter(id => id !== configId);
      await this.updateGroupConfigs(groupConfigs);
    }
  }
}