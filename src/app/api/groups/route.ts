import { NextResponse } from 'next/server';
import { IndexManager } from '@/lib/storage/indexes/IndexManager';
import path from 'path';

// Initialize IndexManager with the data directory path
const indexManager = new IndexManager(path.join(process.cwd(), 'data'));

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log('Fetching groups for user:', userId);

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const metadata = await indexManager.getGroupMetadata(userId);
    
    // Return array of groups
    const groups = Object.values(metadata.groups);
    console.log('Received groups:', groups);
    
    return NextResponse.json(groups);
  } catch (error) {
    console.error('Error in GET /api/groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    );
  }
}

// Fix for POST handler in /app/api/groups/route.ts
export async function POST(request: Request) {
    try {
      const body = await request.json();
      console.log('Creating group for user:', body);
  
      const { group, userId } = body;  // Expect group object
  
      // Check required fields
      if (!userId || !group?.name) {
        console.error('Missing required fields:', { userId, groupName: group?.name });
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }
  
      // Get existing metadata
      const metadata = await indexManager.getGroupMetadata(userId);
  
      // Create new group
      const newGroup = {
        id: `group-${Date.now()}`,
        name: group.name,
        parentId: group.parentId || null,
        description: group.description || '',
        createdBy: userId,
        createdAt: new Date(),
        modifiedAt: new Date()
      };
  
      // Add to metadata
      metadata.groups[newGroup.id] = newGroup;
      await indexManager.updateGroupMetadata(metadata, userId);
  
      // Initialize empty config list for new group
      const groupConfigs = await indexManager.getGroupConfigs();
      groupConfigs[newGroup.id] = [];
      await indexManager.updateGroupConfigs(groupConfigs);
  
      return NextResponse.json(newGroup);
    } catch (error) {
      console.error('Error in POST /api/groups:', error);
      return NextResponse.json(
        { error: 'Failed to create group' },
        { status: 500 }
      );
    }
  }
  
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId') || 'admin';
        const groupId = searchParams.get('groupId');

        console.log('Deleting group:', { userId, groupId });

        if (!groupId) {
            return NextResponse.json(
                { error: 'Missing groupId parameter' },
                { status: 400 }
            );
        }

        // Get current data
        const [metadata, groupConfigs] = await Promise.all([
            indexManager.getGroupMetadata(userId),
            indexManager.getGroupConfigs()
        ]);

        // Check if group exists
        if (!metadata.groups[groupId]) {
            return NextResponse.json(
                { error: 'Group not found' },
                { status: 404 }
            );
        }

        // Check for subgroups
        const hasSubgroups = Object.values(metadata.groups).some(g => g.parentId === groupId);
        if (hasSubgroups) {
            return NextResponse.json(
                { error: 'Cannot delete group with subgroups' },
                { status: 400 }
            );
        }

        // Delete group
        delete metadata.groups[groupId];
        delete groupConfigs[groupId];

        // Update both indexes
        await Promise.all([
            indexManager.updateGroupMetadata(metadata, userId),
            indexManager.updateGroupConfigs(groupConfigs)
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete group:', error);
        return NextResponse.json(
            { error: 'Failed to delete group' },
            { status: 500 }
        );
    }
}

export async function PUT(request: Request) {
  try {
    const { group, userId } = await request.json();
    console.log('Updating group:', { group, userId });

    if (!userId || !group?.id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get current metadata
    const metadata = await indexManager.getGroupMetadata(userId);
    
    // Verify group exists
    if (!metadata.groups[group.id]) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    // Update group
    metadata.groups[group.id] = {
      ...metadata.groups[group.id],
      name: group.name,
      description: group.description || '',
      modifiedAt: new Date()
    };

    await indexManager.updateGroupMetadata(metadata, userId);
    
    return NextResponse.json(metadata.groups[group.id]);
  } catch (error) {
    console.error('Error in PUT /api/groups:', error);
    return NextResponse.json(
      { error: 'Failed to update group' },
      { status: 500 }
    );
  }
}