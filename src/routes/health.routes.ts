import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { config } from '../config/env';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const start = Date.now();

  let dbStatus = 'ok';
  let dbLatency = 0;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - start;
  } catch {
    dbStatus = 'error';
  }

  const isHealthy = dbStatus === 'ok';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: config.env,
    version: process.env.npm_package_version ?? '1.0.0',
    services: {
      database: {
        status: dbStatus,
        latencyMs: dbLatency,
      },
    },
    memory: {
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  });
});

export default router;
