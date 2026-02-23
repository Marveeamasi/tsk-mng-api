import 'express-async-errors'; // Must be first — patches async route handlers
import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import pinoHttp from 'pino-http';

import { config } from './config/env';
import logger from './config/logger';
import { apiLimiter } from './middleware/rateLimiter';
import { requestId } from './middleware/requestId';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import taskRoutes from './routes/task.routes';
import projectRoutes from './routes/project.routes';
import healthRoutes from './routes/health.routes';

export const createApp = (): Application => {
  const app = express();

  // ── Security headers ───────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: config.isProduction,
    crossOriginEmbedderPolicy: config.isProduction,
  }));

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.use(cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  // ── Compression ───────────────────────────────────────────────────────────
  app.use(compression());

  // ── Request ID tracking ───────────────────────────────────────────────────
  app.use(requestId);

  // ── HTTP request logging ─────────────────────────────────────────────────
  app.use(pinoHttp({
    logger,
    customLogLevel: (_req, res) => {
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url} → ${res.statusCode}`,
    // Don't log health checks to reduce noise
    autoLogging: { ignore: (req) => req.url === '/health' },
  }));

  // ── Body parsing ─────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Global rate limiter ───────────────────────────────────────────────────
  app.use('/api', apiLimiter);

  // ── Trust proxy (needed for rate limiting behind reverse proxy) ──────────
  app.set('trust proxy', 1);

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/projects', projectRoutes);

  // ── 404 handler ───────────────────────────────────────────────────────────
  app.use(notFoundHandler);

  // ── Centralized error handler (must be last) ─────────────────────────────
  app.use(errorHandler);

  return app;
};
