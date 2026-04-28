// app/api/scenarios/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Helper function to get scenarios file path. Defaults to ./data when the
// NEXT_PUBLIC_STORAGE_PATH env var isn't set (matches the rest of the
// file-storage layer, which roots everything under cwd/data).
function getStoragePath(): string {
  return process.env.NEXT_PUBLIC_STORAGE_PATH || path.join(process.cwd(), 'data');
}

function getScenariosPath() {
  return path.join(getStoragePath(), 'users/admin/scenarios.json');
}

// Helper function to read scenarios
async function readScenarios() {
  const scenariosPath = getScenariosPath();
  try {
    const content = await fs.readFile(scenariosPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return [];
  }
}

// Helper function to write scenarios
async function writeScenarios(scenarios: any[]) {
  const scenariosPath = getScenariosPath();
  const dir = path.dirname(scenariosPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(scenariosPath, JSON.stringify(scenarios, null, 2));
}

// GET - List all scenarios
export async function GET(request: Request) {
  try {
    // Check if we're requesting a specific scenario
    const url = new URL(request.url);
    const scenarioId = url.searchParams.get('id');

    if (scenarioId) {
      console.log(`[GET Scenario] Fetching scenario with ID: ${scenarioId}`);
      const scenarios = await readScenarios();
      const scenario = scenarios.find((s: any) => s.id === scenarioId);

      if (!scenario) {
        console.error(`[GET Scenario] Scenario not found with ID: ${scenarioId}`);
        return NextResponse.json(
          { error: 'Scenario not found' },
          { status: 404 }
        );
      }

      console.log('[GET Scenario] Found scenario:', scenario);
      return NextResponse.json(scenario);
    }

    // List all scenarios
    const scenarios = await readScenarios();
    return NextResponse.json(scenarios);
  } catch (error) {
    console.error('Error in GET /api/scenarios:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scenarios' },
      { status: 500 }
    );
  }
}

// POST - Create new scenario
export async function POST(request: Request) {
  try {
    const scenarios = await readScenarios();
    const scenarioData = await request.json();
    
    const newScenario = {
      id: Date.now().toString(),
      ...scenarioData,
      createdAt: new Date().toISOString()
    };
    
    scenarios.push(newScenario);
    await writeScenarios(scenarios);
    
    return NextResponse.json(newScenario);
  } catch (error) {
    console.error('Error in POST /api/scenarios:', error);
    return NextResponse.json(
      { error: 'Failed to create scenario' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const scenarioId = body.id;

    if (!scenarioId) {
      return NextResponse.json({ error: 'Scenario ID is required' }, { status: 400 });
    }

    console.log('[DELETE] Deleting scenario:', scenarioId);
    const scenariosPath = getScenariosPath();
    const content = await fs.readFile(scenariosPath, 'utf-8');
    const scenarios = JSON.parse(content);
    
    const updatedScenarios = scenarios.filter((s: any) => s.id !== scenarioId);
    await fs.writeFile(scenariosPath, JSON.stringify(updatedScenarios, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to delete scenario' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Scenario ID is required' }, { status: 400 });
    }

    const scenariosPath = getScenariosPath();
    const content = await fs.readFile(scenariosPath, 'utf-8');
    const scenarios = JSON.parse(content);
    
    const updatedScenarios = scenarios.map((s: any) => 
      s.id === id ? { ...s, ...body, id } : s
    );

    await fs.writeFile(scenariosPath, JSON.stringify(updatedScenarios, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update scenario' }, { status: 500 });
  }
}