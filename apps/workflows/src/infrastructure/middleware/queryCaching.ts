import { Redis } from 'ioredis';

export interface CacheConfig {
    ttl: number;
    prefix: string;
    invalidationPatterns?: string[];
}

export interface Query {
    type: string;
    [key: string]: unknown;
}

export interface QueryMiddleware<T extends Query = Query> {
    execute(query: T, next: (query: T) => Promise<unknown>): Promise<unknown>;
}

export interface CacheKeyGenerator<T extends Query> {
    generate(query: T): string;
}

export class DefaultCacheKeyGenerator<T extends Query> implements CacheKeyGenerator<T> {
    constructor(private prefix: string) { }

    generate(query: T): string {
        const queryType = query.type;
        // Create a stable hash based on the query properties
        // This creates a unique key based on the query type and parameters
        const paramsHash = JSON.stringify(
            Object.entries(query)
                .filter(([key]) => key !== 'type')
                .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        );

        return `${this.prefix}:${queryType}:${Buffer.from(paramsHash).toString('base64')}`;
    }
}

export class CacheMiddleware<T extends Query> implements QueryMiddleware<T> {
    private keyGenerator: CacheKeyGenerator<T>;

    constructor(
        private redis: Redis,
        private config: CacheConfig,
        keyGenerator?: CacheKeyGenerator<T>
    ) {
        this.keyGenerator = keyGenerator || new DefaultCacheKeyGenerator<T>(config.prefix);
    }

    async execute(query: T, next: (query: T) => Promise<unknown>): Promise<unknown> {
        const cacheKey = this.keyGenerator.generate(query);

        try {
            // Try to get from cache first
            const cachedResult = await this.redis.get(cacheKey);

            if (cachedResult) {
                // Cache hit - return parsed result
                return JSON.parse(cachedResult);
            }

            // Cache miss - execute the query
            const result = await next(query);

            // Cache the result
            await this.redis.set(
                cacheKey,
                JSON.stringify(result),
                'EX',
                this.config.ttl
            );

            return result;
        } catch (error) {
            console.error(`Cache error for query ${query.type}:`, error);
            // On cache error, still try to execute the query
            return next(query);
        }
    }

    async invalidateCache(pattern: string): Promise<number> {
        try {
            // Use SCAN to find keys matching the pattern
            const keys = await this.scanKeys(`${this.config.prefix}:${pattern}*`);

            if (keys.length > 0) {
                // Delete all matching keys
                await this.redis.del(...keys);
            }

            return keys.length;
        } catch (error) {
            console.error(`Cache invalidation error for pattern ${pattern}:`, error);
            return 0;
        }
    }

    async invalidateByType(queryType: string): Promise<number> {
        return this.invalidateCache(`${queryType}:`);
    }

    async invalidateAll(): Promise<number> {
        return this.invalidateCache('');
    }

    private async scanKeys(pattern: string): Promise<string[]> {
        const allKeys: string[] = [];
        let cursor = '0';

        do {
            // Use SCAN to get matching keys in batches
            const [nextCursor, keys] = await this.redis.scan(
                cursor,
                'MATCH',
                pattern,
                'COUNT',
                1000
            );

            cursor = nextCursor;
            allKeys.push(...keys);
        } while (cursor !== '0');

        return allKeys;
    }
}

// Factory function to create a cache middleware with default configuration
export function createCacheMiddleware<T extends Query>(
    redis: Redis,
    config: Partial<CacheConfig> = {}
): CacheMiddleware<T> {
    const defaultConfig: CacheConfig = {
        ttl: 3600, // 1 hour default TTL
        prefix: 'query-cache',
        invalidationPatterns: []
    };

    return new CacheMiddleware<T>(
        redis,
        { ...defaultConfig, ...config }
    );
} 
