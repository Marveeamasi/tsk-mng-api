import { PrismaClient } from '@prisma/client';
import { config } from './env';
import logger from './logger';

// Prevent multiple Prisma instances in development (hot-reload issue)
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
  return new PrismaClient({
    log:
      config.env === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
    errorFormat: config.isProduction ? 'minimal' : 'pretty',
  });
};

export const prisma = global.__prisma ?? createPrismaClient();

if (!config.isProduction) {
  global.__prisma = prisma;
}

// Log slow queries in development
if (config.env === 'development') {
  (prisma as any).$on('query', (e: any) => {
    if (e.duration > 100) {
      logger.warn({ query: e.query, duration: `${e.duration}ms` }, 'Slow query detected');
    }
  });
}

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected');
  } catch (error) {
    logger.error({ error }, '❌ Database connection failed');
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
