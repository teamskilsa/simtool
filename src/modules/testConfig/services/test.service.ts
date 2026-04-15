// src/modules/testConfig/services/test.service.ts
import { ConfigItem, TestResult, TestStep } from '../types/testConfig.types';
import { logger } from '../utils/logger';

class TestService {
  private activeTests: Map<string, TestResult> = new Map();

  async executeTest(
    config: ConfigItem,
    baseUrl: string,
    onStepComplete?: (step: TestStep) => void
  ): Promise<TestResult> {
    const testId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const testResult: TestResult = {
      id: testId,
      configId: config.id,
      status: 'running',
      steps: [],
      startTime: new Date()
    };
    
    this.activeTests.set(testId, testResult);

    try {
      // Use your existing API endpoint structure
      const response = await fetch(`${baseUrl}/api/nodes/test/${config.module}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: config.content,
          filename: config.name
        }),
      });

      if (!response.ok) {
        throw new Error(`Test execution failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Process each step
      for (const step of result.steps) {
        const testStep: TestStep = {
          id: `${step.name}-${Date.now()}`,
          ...step,
          startTime: new Date(),
          endTime: new Date()
        };

        testResult.steps.push(testStep);
        onStepComplete?.(testStep);
      }

      testResult.status = result.success ? 'success' : 'failure';
      testResult.endTime = new Date();
      
    } catch (error) {
      logger.error('Test execution failed:', error);
      testResult.status = 'failure';
      testResult.endTime = new Date();
      testResult.error = error instanceof Error ? error.message : 'Test execution failed';
    }

    this.activeTests.set(testId, testResult);
    return testResult;
  }

  getTestStatus(testId: string): TestResult | undefined {
    return this.activeTests.get(testId);
  }

  getAllTestResults(): TestResult[] {
    return Array.from(this.activeTests.values());
  }
}

export const testService = new TestService();