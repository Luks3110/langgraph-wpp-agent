import { Query, QueryMiddleware } from './queryCaching';

export { Query, QueryMiddleware };

export interface QueryHandler<T extends Query, R = unknown> {
    handle(query: T): Promise<R>;
}

export class QueryBus {
    private handlers = new Map<string, QueryHandler<any, unknown>>();
    private middleware: QueryMiddleware[] = [];

    registerHandler<T extends Query, R>(
        queryType: string,
        handler: QueryHandler<T, R>
    ): void {
        this.handlers.set(queryType, handler);
    }

    addMiddleware(middleware: QueryMiddleware): void {
        this.middleware.push(middleware);
    }

    async execute<T extends Query, R>(query: T): Promise<R> {
        const handler = this.handlers.get(query.type);

        if (!handler) {
            throw new Error(`No handler registered for query type: ${query.type}`);
        }

        // Create middleware chain
        let chain = (cmd: Query) => handler.handle(cmd as T);

        // Build the middleware chain in reverse order
        for (let i = this.middleware.length - 1; i >= 0; i--) {
            const middleware = this.middleware[i];
            const nextChain = chain;
            chain = (cmd: Query) => middleware.execute(cmd, nextChain);
        }

        // Execute the middleware chain
        return chain(query) as Promise<R>;
    }
}

export class LoggingQueryMiddleware implements QueryMiddleware {
    async execute(query: Query, next: (query: Query) => Promise<unknown>): Promise<unknown> {
        console.log(`Executing query: ${query.type}`);

        try {
            const startTime = Date.now();
            const result = await next(query);
            const duration = Date.now() - startTime;

            console.log(`Query ${query.type} executed successfully in ${duration}ms`);
            return result;
        } catch (error) {
            console.error(`Error executing query ${query.type}:`, error);
            throw error;
        }
    }
}

// Factory function to create a query bus with default middleware
export function createQueryBus(): QueryBus {
    const queryBus = new QueryBus();

    // Add default middleware
    queryBus.addMiddleware(new LoggingQueryMiddleware());

    return queryBus;
} 
