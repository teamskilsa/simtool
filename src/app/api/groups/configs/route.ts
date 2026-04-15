// app/api/groups/configs/route.ts
import { NextResponse } from 'next/server';
import { IndexManager } from '@/lib/storage/indexes/IndexManager';
import path from 'path';

const indexManager = new IndexManager(path.join(process.cwd(), 'data'));

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    console.log('Fetching configs for group:', groupId);

    if (!groupId) {
      return NextResponse.json(
        { error: 'groupId is required' },
        { status: 400 }
      );
    }

    // Get group configs from index
    const groupConfigs = await indexManager.getGroupConfigs();
    const configIds = groupConfigs[groupId] || [];

    console.log('Found configs:', configIds);
    
    return NextResponse.json(configIds);
  } catch (error) {
    console.error('Error fetching group configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group configurations' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId, groupId, configIds } = await request.json();

    if (!groupId || !configIds?.length || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get current group configs
    const groupConfigs = await indexManager.getGroupConfigs();
    
    // Initialize array if it doesn't exist
    if (!groupConfigs[groupId]) {
      groupConfigs[groupId] = [];
    }

    // Add new configs
    configIds.forEach((configId: string) => {
      if (!groupConfigs[groupId].includes(configId)) {
        groupConfigs[groupId].push(configId);
      }
    });

    // Save updated configs
    await indexManager.updateGroupConfigs(groupConfigs);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding configs to group:', error);
    return NextResponse.json(
      { error: 'Failed to add configurations to group' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId, groupId, configIds } = await request.json();

    if (!groupId || !configIds?.length || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get current group configs
    const groupConfigs = await indexManager.getGroupConfigs();
    
    // Remove configs
    if (groupConfigs[groupId]) {
      groupConfigs[groupId] = groupConfigs[groupId].filter(
        (id: string) => !configIds.includes(id)
      );
    }

    // Save updated configs
    await indexManager.updateGroupConfigs(groupConfigs);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing configs from group:', error);
    return NextResponse.json(
      { error: 'Failed to remove configurations from group' },
      { status: 500 }
    );
  }
}