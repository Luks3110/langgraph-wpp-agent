import { Context, Next } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

// Enhanced validation error type
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export class ValidationFailedError extends Error {
  public validationErrors: ValidationError[];
  
  constructor(message: string, validationErrors: ValidationError[]) {
    super(message);
    this.name = 'ValidationFailedError';
    this.validationErrors = validationErrors;
  }
}

// Base validation middleware interface
export interface ValidationMiddleware<T> {
  validate(data: unknown): Promise<T> | T;
}

// Zod validation middleware implementation
export class ZodValidationMiddleware<T> implements ValidationMiddleware<T> {
  constructor(private schema: z.ZodSchema<T>) {}

  validate(data: unknown): T {
    const result = this.schema.safeParse(data);
    
    if (!result.success) {
      const validationErrors: ValidationError[] = result.error.errors.map((err: z.ZodIssue) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
      
      throw new ValidationFailedError('Validation failed', validationErrors);
    }
    
    return result.data;
  }
}

// Enhanced validation response formatter
export function formatValidationResponse(error: ValidationFailedError) {
  return {
    success: false,
    error: 'Validation failed',
    details: error.validationErrors,
    timestamp: new Date().toISOString()
  };
}

// Create enhanced zValidator with better error handling
export function createEnhancedValidator<T>(
  target: 'json' | 'query' | 'param' | 'header' | 'form',
  schema: z.ZodSchema<T>
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const validationErrors: ValidationError[] = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
      
      return c.json(formatValidationResponse(
        new ValidationFailedError('Request validation failed', validationErrors)
      ), 400);
    }
  });
}

// Common validation schemas
export const commonSchemas = {
  uuid: z.string().uuid('Invalid UUID format'),
  tenantId: z.string().uuid('Invalid tenant ID format'),
  paginationQuery: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  }),
  timestampRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  })
};

// Middleware for global error handling
export function validationErrorHandler() {
  return async (c: Context, next: Next) => {
    try {
      await next();
    } catch (error) {
      if (error instanceof ValidationFailedError) {
        return c.json(formatValidationResponse(error), 400);
      }
      
      // Re-throw other errors to be handled by global error handler
      throw error;
    }
  };
}

// Type-safe request validator helper
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const middleware = new ZodValidationMiddleware(schema);
  return middleware.validate(data);
}

// Enhanced body parser with validation
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const validatedData = validateRequest(schema, body);
      
      // Attach validated data to context
      c.set('validatedBody', validatedData);
      await next();
    } catch (error) {
      if (error instanceof ValidationFailedError) {
        return c.json(formatValidationResponse(error), 400);
      }
      throw error;
    }
  };
}

// Enhanced query parameter validator
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return async (c: Context, next: Next) => {
    try {
      const query = c.req.query();
      const validatedQuery = validateRequest(schema, query);
      
      // Attach validated query to context
      c.set('validatedQuery', validatedQuery);
      await next();
    } catch (error) {
      if (error instanceof ValidationFailedError) {
        return c.json(formatValidationResponse(error), 400);
      }
      throw error;
    }
  };
}

// Enhanced parameter validator
export function validateParams<T>(schema: z.ZodSchema<T>) {
  return async (c: Context, next: Next) => {
    try {
      const params = c.req.param();
      const validatedParams = validateRequest(schema, params);
      
      // Attach validated params to context
      c.set('validatedParams', validatedParams);
      await next();
    } catch (error) {
      if (error instanceof ValidationFailedError) {
        return c.json(formatValidationResponse(error), 400);
      }
      throw error;
    }
  };
}