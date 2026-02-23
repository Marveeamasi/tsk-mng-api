import pino from 'pino';
import { config } from './env';

export const logger = pino({
  level: config.log.level,
  ...(config.isProduction
    ? {
        // In production: structured JSON logs for log aggregation (Datadog, CloudWatch, etc.)
        formatters: {
          level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {
        // In development: pretty-print for readability
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
  base: {
    service: 'taskflow-api',
    env: config.env,
  },
  redact: {
    // Never log sensitive fields
    paths: ['req.headers.authorization', 'req.body.password', 'req.body.token'],
    censor: '[REDACTED]',
  },
});

export default logger;
