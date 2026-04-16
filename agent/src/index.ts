import express from 'express';
import cors from 'cors';
import mainRouter from './routes';
import { logger } from './utils/logger';

const app = express();
const port = Number(process.env.PORT) || 9050;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

app.use(express.json());

app.use('/api', mainRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(port, () => {
    logger.info(`pro1_1 target agent listening on port ${port}`);
});

export default app;
