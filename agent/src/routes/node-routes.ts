import { Router } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as net from 'net';

const router = Router();
const execAsync = promisify(exec);

interface ModuleConfig {
    defaultPath: string;
    filePattern: RegExp;
    targetFile: string;
    port?: number;
}

const MODULE_CONFIGS: Record<string, ModuleConfig> = {
    'enb': {
        defaultPath: '/root/enb/config',
        filePattern: /^enb.*\.cfg$/,
        targetFile: 'enb.cfg',
        port: 9001
    },
    'gnb': {
        defaultPath: '/root/enb/config',
        filePattern: /^gnb.*\.cfg$/,
        targetFile: 'enb.cfg',
        port: 9001
    },
    'mme': {
        defaultPath: '/root/mme/config',
        filePattern: /^mme.*\.cfg$/,
        targetFile: 'mme.cfg',
        port: 9000
    },
    'ims': {
        defaultPath: '/root/mme/config',
        filePattern: /^ims.*\.cfg$/,
        targetFile: 'ims.cfg',
        port: 9003
    },
    'ue': {
        defaultPath: '/root/ue/config',
        filePattern: /^ue.*\.cfg$/,
        targetFile: 'ue.cfg',
        port: 9002
    },
    'ue_db': {
        defaultPath: '/root/mme/config',
        filePattern: /^ue.*\.db$/,
        targetFile: '',
    }
};

// Existing routes
router.get('/configs/:module/list', async (req, res) => {
    try {
        const { module } = req.params;
        const { path: customPath } = req.query;
        
        const moduleConfig = MODULE_CONFIGS[module as keyof typeof MODULE_CONFIGS];
        if (!moduleConfig) {
            return res.status(400).json({ error: `Invalid module: ${module}` });
        }

        const configPath = customPath ? String(customPath) : moduleConfig.defaultPath;
        const files = await fs.readdir(configPath);
        const configFiles = files.filter(file => moduleConfig.filePattern.test(file));

        const configList = await Promise.all(configFiles.map(async file => {
            const filePath = path.join(configPath, file);
            const stats = await fs.stat(filePath);
            
            return {
                id: file,
                name: file,
                module,
                path: filePath,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
                size: stats.size
            };
        }));

        res.json(configList);
    } catch (error) {
        logger.error('Error fetching config list:', error);
        res.status(500).json({ error: 'Failed to fetch configuration list' });
    }
});

router.get('/configs/:module/:filename', async (req, res) => {
    try {
        const { module, filename } = req.params;
        const { path: customPath } = req.query;
        
        const moduleConfig = MODULE_CONFIGS[module as keyof typeof MODULE_CONFIGS];
        if (!moduleConfig) {
            return res.status(400).json({ error: `Invalid module: ${module}` });
        }

        const configPath = customPath ? String(customPath) : moduleConfig.defaultPath;
        const filePath = path.join(configPath, filename);
        
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);

        res.json({
            name: filename,
            module,
            path: filePath,
            content,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            size: stats.size
        });
    } catch (error) {
        logger.error('Error:', error);
        res.status(404).json({ 
            error: 'Configuration not found',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// New execute route for testing
router.post('/configs/:module/execute', async (req, res) => {
    try {
        const { module } = req.params;
        const { content, name } = req.body;
        
        logger.info(`[TEST] Executing test for module: ${module}, config: ${name}`);
        
        const moduleConfig = MODULE_CONFIGS[module as keyof typeof MODULE_CONFIGS];
        if (!moduleConfig) {
            return res.status(400).json({ error: `Invalid module: ${module}` });
        }

        const result: any = {
            copySuccess: false,
            copyMessage: '',
            restartSuccess: false,
            restartError: '',
            portStatus: false
        };

        try {
            // Step 1: Copy Configuration
            const targetPath = moduleConfig.defaultPath;
            const targetFile = moduleConfig.targetFile || name;
            const fullPath = path.join(targetPath, targetFile);

            logger.info(`[TEST] Copying configuration to ${fullPath}`);
            await fs.writeFile(fullPath, content);
            
            result.copySuccess = true;
            result.copyMessage = `Configuration copied to ${fullPath}`;
            logger.info(`[TEST] ${result.copyMessage}`);

            // Step 2: Restart Service (skip for ue_db)
            if (module !== 'ue_db') {
                try {
                    logger.info('[TEST] Restarting LTE service');
                    await execAsync('service lte restart');
                    result.restartSuccess = true;
                    logger.info('[TEST] LTE service restarted successfully');

                    // Step 3: Check Port Status
                    if (moduleConfig.port) {
                        logger.info(`[TEST] Checking port ${moduleConfig.port}`);
                        // Wait for service to start
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        // Check port multiple times
                        for (let i = 0; i < 3; i++) {
                            const isPortOpen = await checkPort(moduleConfig.port);
                            if (isPortOpen) {
                                result.portStatus = true;
                                break;
                            }
                            logger.info(`[TEST] Port check attempt ${i + 1} failed, retrying...`);
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }

                        logger.info(`[TEST] Port ${moduleConfig.port} status: ${result.portStatus ? 'open' : 'closed'}`);
                    }
                } catch (error) {
                    result.restartSuccess = false;
                    result.restartError = error instanceof Error ? error.message : 'Service restart failed';
                    logger.error('[TEST] Service restart failed:', error);
                }
            }

            res.json(result);

        } catch (error) {
            logger.error('[TEST] Configuration copy failed:', error);
            res.status(500).json({
                error: 'Failed to copy configuration',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }

    } catch (error) {
        logger.error('[TEST] Test execution failed:', error);
        res.status(500).json({
            error: 'Test execution failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

async function checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        
        const onError = () => {
            socket.destroy();
            resolve(false);
        };

        socket.setTimeout(1000);
        socket.on('error', onError);
        socket.on('timeout', onError);

        socket.connect(port, 'localhost', () => {
            socket.destroy();
            resolve(true);
        });
    });
}

export const nodeRoutes = router;