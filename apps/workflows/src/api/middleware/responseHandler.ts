import { Context } from 'hono';

// Standard API response interface
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  requestId?: string;
}

// Paginated response interface
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Error response interface
export interface ErrorResponse extends ApiResponse<never> {
  success: false;
  error: string;
  details?: any;
  stack?: string;
}

// Response helper class
export class ResponseHandler {
  /**
   * Send a successful response
   */
  static success<T>(
    c: Context,
    data?: T,
    message?: string,
    statusCode: number = 200
  ) {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      requestId: c.get('requestId') || undefined
    };

    return c.json(response, statusCode);
  }

  /**
   * Send a paginated successful response
   */
  static paginatedSuccess<T>(
    c: Context,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    },
    message?: string,
    statusCode: number = 200
  ) {
    const totalPages = Math.ceil(pagination.total / pagination.limit);
    
    const response: PaginatedApiResponse<T> = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      requestId: c.get('requestId') || undefined,
      pagination: {
        ...pagination,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrevious: pagination.page > 1
      }
    };

    return c.json(response, statusCode);
  }

  /**
   * Send an error response
   */
  static error(
    c: Context,
    error: string,
    statusCode: number = 500,
    details?: any
  ) {
    const response: ErrorResponse = {
      success: false,
      error,
      details,
      timestamp: new Date().toISOString(),
      requestId: c.get('requestId') || undefined
    };

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && details instanceof Error) {
      response.stack = details.stack;
    }

    return c.json(response, statusCode);
  }

  /**
   * Send a validation error response
   */
  static validationError(
    c: Context,
    errors: Array<{ field: string; message: string; code: string }>,
    message = 'Validation failed'
  ) {
    const response: ErrorResponse = {
      success: false,
      error: message,
      details: errors,
      timestamp: new Date().toISOString(),
      requestId: c.get('requestId') || undefined
    };

    return c.json(response, 400);
  }

  /**
   * Send a not found response
   */
  static notFound(c: Context, message = 'Resource not found') {
    return this.error(c, message, 404);
  }

  /**
   * Send an unauthorized response
   */
  static unauthorized(c: Context, message = 'Unauthorized') {
    return this.error(c, message, 401);
  }

  /**
   * Send a forbidden response
   */
  static forbidden(c: Context, message = 'Forbidden') {
    return this.error(c, message, 403);
  }

  /**
   * Send a conflict response
   */
  static conflict(c: Context, message = 'Conflict') {
    return this.error(c, message, 409);
  }

  /**
   * Send a bad request response
   */
  static badRequest(c: Context, message = 'Bad Request', details?: any) {
    return this.error(c, message, 400, details);
  }

  /**
   * Send an internal server error response
   */
  static internalError(c: Context, message = 'Internal Server Error') {
    return this.error(c, message, 500);
  }
}

// Middleware to add request ID to context
export function requestIdMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    const requestId = c.req.header('x-request-id') || 
                     crypto.randomUUID?.() || 
                     `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    c.set('requestId', requestId);
    c.header('x-request-id', requestId);
    
    await next();
  };
}

// Global error handler middleware
export function globalErrorHandler() {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      await next();
    } catch (error) {
      console.error('Global error handler caught error:', error);

      // Handle specific error types
      if (error instanceof Error) {
        if (error.name === 'ValidationFailedError') {
          return ResponseHandler.validationError(
            c,
            (error as any).validationErrors || [],
            error.message
          );
        }

        if (error.message.includes('not found')) {
          return ResponseHandler.notFound(c, error.message);
        }

        if (error.message.includes('unauthorized')) {
          return ResponseHandler.unauthorized(c, error.message);
        }

        if (error.message.includes('forbidden')) {
          return ResponseHandler.forbidden(c, error.message);
        }

        // Development error details
        if (process.env.NODE_ENV === 'development') {
          return ResponseHandler.internalError(c, error.message);
        }
      }

      // Generic error response
      return ResponseHandler.internalError(c);
    }
  };
}

// Type-safe response builders
export const responses = {
  success: ResponseHandler.success,
  paginatedSuccess: ResponseHandler.paginatedSuccess,
  error: ResponseHandler.error,
  validationError: ResponseHandler.validationError,
  notFound: ResponseHandler.notFound,
  unauthorized: ResponseHandler.unauthorized,
  forbidden: ResponseHandler.forbidden,
  conflict: ResponseHandler.conflict,
  badRequest: ResponseHandler.badRequest,
  internalError: ResponseHandler.internalError
} as const;