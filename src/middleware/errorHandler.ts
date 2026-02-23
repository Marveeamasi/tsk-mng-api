import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/errors';
import logger from '../config/logger';
import { config } from '../config/env';
import { ApiResponse } from '../utils/response';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  // ── Operational errors (known, expected) ────────────────────────────────
  if (err instanceof AppError) {
    logger.warn(
      { err, requestId: req.headers['x-request-id'], path: req.path, method: req.method },
      `[${err.code}] ${err.message}`,
    );

    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // ── Prisma errors ────────────────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn({ err }, `Prisma error: ${err.code}`);

    if (err.code === 'P2002') {
      // Unique constraint violation
      const field = (err.meta?.target as string[])?.join(', ') ?? 'field';
      res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: `${field} already exists` },
      });
      return;
    }

    if (err.code === 'P2025') {
      // Record not found (e.g., on update/delete)
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Record not found' },
      });
      return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid data provided' },
    });
    return;
  }

  // ── JWT errors (shouldn't reach here but just in case) ──────────────────
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
    return;
  }

  // ── Unknown / programming errors ─────────────────────────────────────────
  logger.error(
    { err, stack: err.stack, path: req.path, method: req.method, body: req.body },
    'Unhandled error',
  );

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
      // Only expose stack trace in development
      ...(config.env === 'development' && { stack: err.stack }),
    },
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
};
