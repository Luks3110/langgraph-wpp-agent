import { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { CQRSFramework } from '../../src/infrastructure/cqrs';
import { Command } from '../../src/infrastructure/middleware/commandBus';
import { Query } from '../../src/infrastructure/middleware/queryCaching';

// Mock Redis
vi.mock('ioredis', () => {
    const Redis = vi.fn();
    Redis.prototype.get = vi.fn();
    Redis.prototype.set = vi.fn();
    Redis.prototype.del = vi.fn();
    Redis.prototype.scan = vi.fn();
    return { Redis };
});

describe('CQRS Framework', () => {
    let cqrs: CQRSFramework;
    let redis: Redis;

    beforeEach(() => {
        redis = new Redis();
        cqrs = new CQRSFramework({ redis });
    });

    describe('Command Validation', () => {
        interface TestCommand extends Command {
            type: 'test.command';
            id: string;
            name: string;
            value?: number;
        }

        const testCommandSchema = z.object({
            type: z.literal('test.command'),
            tenantId: z.string().uuid(),
            id: z.string().uuid(),
            name: z.string().min(3),
            value: z.number().optional()
        });

        it('should validate command with schema and execute if valid', async () => {
            // Setup
            const handleFn = vi.fn().mockResolvedValue('success');
            const handler = { handle: handleFn };

            // Register
            cqrs.registerCommandHandler<TestCommand, string>(
                'test.command',
                handler,
                testCommandSchema
            );

            // Valid command
            const command: TestCommand = {
                type: 'test.command',
                tenantId: '123e4567-e89b-12d3-a456-426614174000',
                id: '123e4567-e89b-12d3-a456-426614174001',
                name: 'test'
            };

            // Execute
            await expect(cqrs.executeCommand(command)).resolves.toBe('success');
            expect(handleFn).toHaveBeenCalledWith(command);
        });

        it('should reject command that fails validation', async () => {
            // Setup
            const handleFn = vi.fn().mockResolvedValue('success');
            const handler = { handle: handleFn };

            // Register
            cqrs.registerCommandHandler<TestCommand, string>(
                'test.command',
                handler,
                testCommandSchema
            );

            // Invalid command (name too short)
            const command: TestCommand = {
                type: 'test.command',
                tenantId: '123e4567-e89b-12d3-a456-426614174000',
                id: '123e4567-e89b-12d3-a456-426614174001',
                name: 'te' // Too short, should be min 3
            };

            // Execute and expect rejection
            await expect(cqrs.executeCommand(command)).rejects.toThrow();
            expect(handleFn).not.toHaveBeenCalled();
        });
    });

    describe('Query Caching', () => {
        interface TestQuery extends Query {
            type: 'test.query';
            id: string;
            includeDetails?: boolean;
        }

        it('should return cached result if available', async () => {
            // Setup
            const handleFn = vi.fn().mockResolvedValue({ data: 'fresh data' });
            const handler = { handle: handleFn };
            const cachedData = { data: 'cached data' };

            // Mock Redis get to return cached data
            vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cachedData));

            // Register
            cqrs.registerQueryHandler<TestQuery, any>(
                'test.query',
                handler
            );

            // Query
            const query: TestQuery = {
                type: 'test.query',
                id: '123'
            };

            // Execute
            const result = await cqrs.executeQuery(query);

            // Verify
            expect(result).toEqual(cachedData);
            expect(handleFn).not.toHaveBeenCalled(); // Handler should not be called
            expect(redis.get).toHaveBeenCalled();
            expect(redis.set).not.toHaveBeenCalled();
        });

        it('should execute query and cache result if not in cache', async () => {
            // Setup
            const freshData = { data: 'fresh data' };
            const handleFn = vi.fn().mockResolvedValue(freshData);
            const handler = { handle: handleFn };

            // Mock Redis get to return null (cache miss)
            vi.mocked(redis.get).mockResolvedValue(null);

            // Register
            cqrs.registerQueryHandler<TestQuery, any>(
                'test.query',
                handler
            );

            // Query
            const query: TestQuery = {
                type: 'test.query',
                id: '123'
            };

            // Execute
            const result = await cqrs.executeQuery(query);

            // Verify
            expect(result).toEqual(freshData);
            expect(handleFn).toHaveBeenCalledWith(query);
            expect(redis.get).toHaveBeenCalled();
            expect(redis.set).toHaveBeenCalled();
        });

        it('should invalidate cache by query type', async () => {
            // Setup
            vi.mocked(redis.scan).mockResolvedValueOnce(['0', ['key1', 'key2']]);
            vi.mocked(redis.del).mockResolvedValue(2);

            // Execute
            const count = await cqrs.invalidateQueryCache('test.query');

            // Verify
            expect(count).toBe(2);
            expect(redis.scan).toHaveBeenCalled();
            expect(redis.del).toHaveBeenCalledWith('key1', 'key2');
        });
    });
}); 
