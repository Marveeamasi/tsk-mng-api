import Joi from 'joi';
import { ValidationError } from './errors';
import { Request } from 'express';

type ValidationTarget = 'body' | 'params' | 'query';

export const validate = <T>(
  schema: Joi.ObjectSchema<T>,
  data: unknown,
): T => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,   // collect ALL errors, not just first
    stripUnknown: true,  // remove fields not in schema
    convert: true,       // coerce types (string "1" -> number 1)
  });

  if (error) {
    const details = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message.replace(/['"]/g, ''),
    }));
    throw new ValidationError('Validation failed', details);
  }

  return value;
};

export const validateRequest = (req: Request, schema: Joi.ObjectSchema, target: ValidationTarget = 'body') => {
  req[target] = validate(schema, req[target]);
};

// ─── Reusable schema fragments ───────────────────────────────────────────────

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const uuidSchema = Joi.string().uuid({ version: 'uuidv4' });
