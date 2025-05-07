import { Context, Next } from 'hono';
import { LoggerService } from '../../infrastructure/monitoring/logger';

/**
 * Middleware to log API requests
 */
export function loggingMiddleware() {
    return async (c: Context, next: Next) => {
        // Get logger instance
        const logger = LoggerService.getInstance();

        // Extract info from request
        const method = c.req.method;
        const url = c.req.url;
        const ip = c.req.header('x-forwarded-for') || 'unknown';
        const userAgent = c.req.header('user-agent') || 'unknown';

        // Log request
        logger.http(`${method} ${url}`, {
            method,
            url,
            ip,
            userAgent
        });

        // Continue to next middleware
        await next();

        // Log response
        const status = c.res.status;
        const responseTime = c.res.headers.get('X-Response-Time') || '0ms';

        switch (true) {
            case status >= 500:
                logger.error(`${method} ${url} ${status}`, {
                    method,
                    url,
                    status,
                    responseTime
                });
                break;
            case status >= 400:
                logger.warn(`${method} ${url} ${status}`, {
                    method,
                    url,
                    status,
                    responseTime
                });
                break;
            default:
                logger.http(`${method} ${url} ${status}`, {
                    method,
                    url,
                    status,
                });
                break;
        }

        return c.res;
    };
} 
