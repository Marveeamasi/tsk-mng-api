import { createApp } from './app';
import { config } from './config/env';
import logger from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/database';

const startServer = async () => {
  // Connect to DB before accepting traffic
  await connectDatabase();

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, env: config.env },
      `🚀 TaskFlow API running on port ${config.port}`,
    );
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  // Allows in-flight requests to complete before the process exits.
  // Critical for zero-downtime deployments (k8s, ECS rolling deploys).

  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');

    server.close(async () => {
      logger.info('HTTP server closed');
      await disconnectDatabase();
      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Force close after 30s if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 30_000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // ── Unhandled rejections & exceptions ─────────────────────────────────────
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
    // In production, crash & let process manager restart
    if (config.isProduction) process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — shutting down');
    process.exit(1);
  });
};

startServer();
