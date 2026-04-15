// app/api/scenarios/execute/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

async function readScenarios() {
  const storagePath = process.env.NEXT_PUBLIC_STORAGE_PATH;
  if (!storagePath) {
    throw new Error('Storage path not configured');
  }

  const scenariosPath = path.join(storagePath, 'users/admin/scenarios.json');
  try {
    const content = await fs.readFile(scenariosPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[readScenarios] Error reading scenarios:', error);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scenarioId = searchParams.get('id');

    if (!scenarioId) {
      console.error('[Execute] No scenario ID provided');
      return NextResponse.json(
        { error: 'Scenario ID is required' },
        { status: 400 }
      );
    }

    console.log(`[Execute] Fetching scenario for execution: ${scenarioId}`);
    const scenarios = await readScenarios();
    const scenario = scenarios.find((s: any) => s.id === scenarioId);

    if (!scenario) {
      console.error(`[Execute] Scenario not found: ${scenarioId}`);
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }

    // Validate scenario has required properties
    if (!scenario.topology || !scenario.system || !scenario.moduleConfigs) {
      console.error(`[Execute] Invalid scenario structure:`, scenario);
      return NextResponse.json(
        { error: 'Invalid scenario structure' },
        { status: 400 }
      );
    }

    console.log(`[Execute] Found scenario:`, {
      id: scenario.id,
      name: scenario.name,
      topology: scenario.topology,
      modules: scenario.moduleConfigs.map((m: any) => m.module)
    });

    // Update lastRun timestamp
    scenario.lastRun = new Date().toISOString();
    const updatedScenarios = scenarios.map((s: any) => 
      s.id === scenarioId ? scenario : s
    );
    
    const storagePath = process.env.NEXT_PUBLIC_STORAGE_PATH;
    const scenariosPath = path.join(storagePath!, 'users/admin/scenarios.json');
    await fs.writeFile(scenariosPath, JSON.stringify(updatedScenarios, null, 2));

    return NextResponse.json(scenario);
  } catch (error) {
    console.error('[Execute] Error processing execution request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}