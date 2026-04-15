// route.ts
import { NextResponse } from 'next/server';
import { getStorageAdapter } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';

// Helper to ensure directory exists
async function ensureDirectoryExists(dirPath: string) {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

export async function POST(request: NextRequest) {
    try {
      const { config, userId } = await request.json();
      
      console.log('API - Received import request:', {
        name: config.name,
        module: config.module,
        contentLength: config.content?.length
      });
  
      if (!config.name || !config.module || !config.content) {
        console.error('Missing required fields:', { 
          hasName: !!config.name, 
          hasModule: !!config.module, 
          hasContent: !!config.content 
        });
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }
  
      const storageAdapter = getStorageAdapter();
      
      // Create the config file
      const result = await storageAdapter.configs.create({
        name: config.name,
        module: config.module,
        content: config.content,
        path: config.path || `/root/${config.module}/config/${config.name}`,
        size: config.content.length,
        isServerConfig: true,
        metadata: {
          version: 1,
          tags: [],
          isTemplate: false,
          visibility: 'private',
          path: config.path || `/root/${config.module}/config/${config.name}`,
          checksum: '',
          description: ''
        },
        sharing: {
          ownerId: userId,
          sharedWith: []
        },
        createdBy: {
          id: userId,
          username: 'System'
        },
        updatedBy: {
          id: userId,
          username: 'System'
        },
        status: 'active'
      });
  
      if (!result.success) {
        console.error('Storage create failed:', result.error);
        return NextResponse.json(
          { error: result.error?.message || 'Failed to create config' },
          { status: 500 }
        );
      }
  
      console.log('Config created successfully:', result.data?.name);
      return NextResponse.json(result.data);
  
    } catch (error) {
      console.error('Failed to create config:', error);
      return NextResponse.json(
        { error: 'Failed to create config' },
        { status: 500 }
      );
    }
  }

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const configId = searchParams.get('configId');

    if (!userId || !configId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const storageAdapter = getStorageAdapter();
    const result = await storageAdapter.configs.delete(configId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error?.message || 'Failed to delete config' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete config:', error);
    return NextResponse.json(
      { error: 'Failed to delete config' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userId');
      console.log('GET /api/configs - userId:', userId);

      if (!userId) {
          return NextResponse.json({ error: 'userId is required' }, { status: 400 });
      }

      const storageAdapter = getStorageAdapter();
      const result = await storageAdapter.configs.list({
          sharing: {
              ownerId: userId
          }
      });

      if (!result.success) {
          throw new Error(result.error?.message || 'Failed to fetch configurations');
      }

      return NextResponse.json(result.data || []);
  } catch (error) {
      console.error('Error in GET /api/configs:', error);
      return NextResponse.json(
          { error: 'Failed to fetch configurations' },
          { status: 500 }
      );
  }
}