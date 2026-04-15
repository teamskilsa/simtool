// src/modules/testConfig/services/testRunner.service.ts

import { ConfigItem, ModuleType } from '../types/testConfig.types';

export interface TestStep {
    id: string;
    name: string;
    status: 'running' | 'success' | 'failure';
    message: string;
    startTime: Date;
    endTime?: Date;
    error?: string;
}

export interface TestResult {
    id: string;
    configId: string;
    status: 'running' | 'success' | 'failure';
    steps: TestStep[];
    startTime: Date;
    endTime?: Date;
    error?: string;
}

interface ModuleConfig {
    targetPath: string;
    targetFile: string;
    port?: number;
}

const MODULE_CONFIGS: Record<ModuleType, ModuleConfig> = {
    'enb': {
        targetPath: '/root/enb/config',
        targetFile: 'enb.cfg',
        port: 9001
    },
    'gnb': {
        targetPath: '/root/enb/config',
        targetFile: 'enb.cfg',
        port: 9001
    },
    'mme': {
        targetPath: '/root/mme/config',
        targetFile: 'mme.cfg',
        port: 9000
    },
    'ims': {
        targetPath: '/root/mme/config',
        targetFile: 'ims.cfg',
        port: 9003
    },
    'ue': {
        targetPath: '/root/ue/config',
        targetFile: 'ue.cfg',
        port: 9002
    },
    'ue_db': {
        targetPath: '/root/mme/config',
        targetFile: '', // Will use original filename
    }
};

class TestRunnerService {
    private activeTests: Map<string, TestResult> = new Map();

    async executeTest(
        config: ConfigItem,
        serverUrl: string,
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
            // Step 1: Copy Configuration
            const copyStep: TestStep = {
                id: `copy-${Date.now()}`,
                name: 'Copy Configuration',
                status: 'running',
                message: 'Copying configuration file...',
                startTime: new Date()
            };

            testResult.steps.push(copyStep);
            onStepComplete?.(copyStep);

            // Call backend API to execute test
            const response = await fetch(`${serverUrl}/api/nodes/configs/${config.module}/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: config.content,
                    name: config.name
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to execute test: ${response.statusText}`);
            }

            const result = await response.json();

            // Update copy step
            copyStep.status = result.copySuccess ? 'success' : 'failure';
            copyStep.message = result.copyMessage || 'Configuration copied successfully';
            copyStep.endTime = new Date();
            onStepComplete?.(copyStep);

            // Step 2: Service Restart (skip for ue_db)
            if (config.module !== 'ue_db') {
                const restartStep: TestStep = {
                    id: `restart-${Date.now()}`,
                    name: 'Restart Service',
                    status: 'running',
                    message: 'Restarting LTE service...',
                    startTime: new Date()
                };

                testResult.steps.push(restartStep);
                onStepComplete?.(restartStep);

                if (result.restartSuccess) {
                    restartStep.status = 'success';
                    restartStep.message = 'LTE service restarted successfully';
                } else {
                    restartStep.status = 'failure';
                    restartStep.error = result.restartError;
                    throw new Error('Service restart failed');
                }
                restartStep.endTime = new Date();
                onStepComplete?.(restartStep);

                // Step 3: Port Check (if applicable)
                const moduleConfig = MODULE_CONFIGS[config.module];
                if (moduleConfig.port) {
                    const portStep: TestStep = {
                        id: `port-${Date.now()}`,
                        name: 'Check Port Status',
                        status: 'running',
                        message: `Checking port ${moduleConfig.port}...`,
                        startTime: new Date()
                    };

                    testResult.steps.push(portStep);
                    onStepComplete?.(portStep);

                    if (result.portStatus) {
                        portStep.status = 'success';
                        portStep.message = `Port ${moduleConfig.port} is open and service is running`;
                    } else {
                        portStep.status = 'failure';
                        portStep.error = `Port ${moduleConfig.port} is not accessible`;
                        throw new Error('Port check failed');
                    }
                    portStep.endTime = new Date();
                    onStepComplete?.(portStep);
                }
            }

            testResult.status = 'success';
            
        } catch (error) {
            testResult.status = 'failure';
            testResult.error = error instanceof Error ? error.message : 'Unknown error occurred';
        }

        testResult.endTime = new Date();
        this.activeTests.set(testId, testResult);
        return testResult;
    }

    getTestStatus(testId: string): TestResult | undefined {
        return this.activeTests.get(testId);
    }

    getAllTestResults(): TestResult[] {
        return Array.from(this.activeTests.values());
    }

    getLatestTestForConfig(configId: string): TestResult | undefined {
        return Array.from(this.activeTests.values())
            .filter(test => test.configId === configId)
            .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];
    }
}

export const testRunnerService = new TestRunnerService();