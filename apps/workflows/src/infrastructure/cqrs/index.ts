import { Redis } from 'ioredis';
import { z } from 'zod';
import { Command, CommandBus, CommandHandler, createCommandBus, createValidationMiddleware } from '../middleware/commandBus';
import { Query, QueryBus, QueryHandler, createQueryBus } from '../middleware/queryBus';
import { CacheMiddleware, createCacheMiddleware } from '../middleware/queryCaching';

export interface CQRSConfig {
    redis: Redis;
    cacheTTL?: number;
    cachePrefix?: string;
}

/**
 * CQRS infrastructure that provides command and query buses with validation and caching
 */
export class CQRSFramework {
    private commandBus: CommandBus;
    private queryBus: QueryBus;
    private cacheMiddleware: CacheMiddleware<Query>;

    constructor(private config: CQRSConfig) {
        // Initialize command bus with default middleware
        this.commandBus = createCommandBus();

        // Initialize query bus with default middleware
        this.queryBus = createQueryBus();

        // Initialize cache middleware
        this.cacheMiddleware = createCacheMiddleware<Query>(config.redis, {
            ttl: config.cacheTTL || 3600,
            prefix: config.cachePrefix || 'workflow-query'
        });

        // Add cache middleware to query bus
        this.queryBus.addMiddleware(this.cacheMiddleware);
    }

    /**
     * Get the command bus instance
     */
    getCommandBus(): CommandBus {
        return this.commandBus;
    }

    /**
     * Get the query bus instance
     */
    getQueryBus(): QueryBus {
        return this.queryBus;
    }

    /**
     * Get the cache middleware instance for direct cache operations
     */
    getCacheMiddleware(): CacheMiddleware<Query> {
        return this.cacheMiddleware;
    }

    /**
     * Register a command handler with validation
     */
    registerCommandHandler<T extends Command, R>(
        commandType: string,
        handler: CommandHandler<T, R>,
        schema?: z.ZodSchema<T>
    ): void {
        if (schema) {
            // Add validation middleware for this command type
            const validationMiddleware = createValidationMiddleware(schema);
            this.commandBus.addMiddleware(validationMiddleware);
        }

        // Register the handler
        this.commandBus.registerHandler(commandType, handler);
    }

    /**
     * Register a query handler
     */
    registerQueryHandler<T extends Query, R>(
        queryType: string,
        handler: QueryHandler<T, R>
    ): void {
        this.queryBus.registerHandler(queryType, handler);
    }

    /**
     * Execute a command
     */
    async executeCommand<T extends Command, R>(command: T): Promise<R> {
        return this.commandBus.execute(command);
    }

    /**
     * Execute a query
     */
    async executeQuery<T extends Query, R>(query: T): Promise<R> {
        return this.queryBus.execute(query);
    }

    /**
     * Invalidate cache for a specific query type
     */
    async invalidateQueryCache(queryType: string): Promise<number> {
        return this.cacheMiddleware.invalidateByType(queryType);
    }

    /**
     * Invalidate all query cache
     */
    async invalidateAllCache(): Promise<number> {
        return this.cacheMiddleware.invalidateAll();
    }
} 
