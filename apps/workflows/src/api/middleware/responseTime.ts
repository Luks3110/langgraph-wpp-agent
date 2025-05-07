import { Context, Next } from 'hono';

/**
 * Middleware to track response time
 * 
 * Adds X-Response-Time header with the response time in milliseconds
 */
export function responseTimeMiddleware() {
    return async (c: Context, next: Next) => {
        // Record start time
        const start = Date.now();

        // Continue to next middleware
        await next();

        // Calculate response time after all middleware and handler has completed
        const duration = Date.now() - start;

        // Add response time header
        c.header('X-Response-Time', `${duration}ms`);

        return c.res;
    };
} 
