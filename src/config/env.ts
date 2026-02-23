import Joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  // Database
  DATABASE_URL: Joi.string().required().description('PostgreSQL connection string'),

  // JWT
  JWT_SECRET: Joi.string().min(32).required().description('JWT signing secret (min 32 chars)'),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(15 * 60 * 1000), // 15 min
  RATE_LIMIT_MAX: Joi.number().default(100),

  // CORS
  CORS_ORIGIN: Joi.string().default('*'),

  // Logging
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
}).unknown(true);

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Environment validation failed: ${error.message}\n\nMake sure you have a .env file with all required variables. See .env.example`);
}

export const config = {
  env: envVars.NODE_ENV as 'development' | 'production' | 'test',
  port: envVars.PORT as number,
  isProduction: envVars.NODE_ENV === 'production',
  isTest: envVars.NODE_ENV === 'test',

  db: {
    url: envVars.DATABASE_URL as string,
  },

  jwt: {
    secret: envVars.JWT_SECRET as string,
    expiresIn: envVars.JWT_EXPIRES_IN as string,
    refreshSecret: envVars.JWT_REFRESH_SECRET as string,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN as string,
  },

  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS as number,
    max: envVars.RATE_LIMIT_MAX as number,
  },

  cors: {
    origin: envVars.CORS_ORIGIN as string,
  },

  log: {
    level: envVars.LOG_LEVEL as string,
  },
};
