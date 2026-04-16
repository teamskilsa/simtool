import { Router } from 'express';
import { nodeRoutes } from './node-routes';
import { SystemMonitor } from '../services/system-monitor';
import { logger } from '../utils/logger';

const router = Router();
const systemMonitor = new SystemMonitor();

router.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

router.get('/stats', async (_req, res) => {
    try {
        const stats = await systemMonitor.getStats();
        res.json(stats);
    } catch (error) {
        logger.error('Failed to get system stats:', error);
        res.status(500).json({
            error: 'Failed to get system stats',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

router.use('/nodes', nodeRoutes);

export default router;
