import { NextRequest, NextResponse } from 'next/server';
import { getStorageAdapter } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const userId = formData.get('userId') as string;

    if (!files.length || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const storage = getStorageAdapter();
    const results = await Promise.all(
      files.map(async (file) => {
        const content = await file.text();
        // Determine module from filename or content
        const module = file.name.startsWith('enb-') ? 'enb' :
                      file.name.startsWith('gnb-') ? 'gnb' :
                      file.name.startsWith('mme-') ? 'mme' :
                      file.name.startsWith('ims-') ? 'ims' : 'enb';

        return storage.configs.create({
          name: file.name,
          module,
          content,
          size: file.size,
          metadata: {
            version: 1,
            tags: [],
            isTemplate: false,
            visibility: 'private',
            path: `/root/${module}/config/${file.name}`,
            checksum: '',
            description: ''
          },
          sharing: {
            ownerId: userId,
            sharedWith: []
          },
          status: 'active',
          createdBy: {
            id: userId,
            username: 'System'
          },
          updatedBy: {
            id: userId,
            username: 'System'
          }
        });
      })
    );

    const failed = results.filter(r => !r.success);
    if (failed.length) {
      return NextResponse.json(
        { error: `Failed to import ${failed.length} files` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};