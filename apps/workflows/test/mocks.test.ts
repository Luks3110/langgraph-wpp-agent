// @ts-nocheck
import Redis from 'ioredis-mock';
import { describe, expect, it } from 'vitest';
import { createMockRedis, createMockRedisConnection, createMockSupabaseClient } from './mocks';

describe('Mocks', () => {
    describe('Redis Mocks', () => {
        it('createMockRedis should return a Redis instance', () => {
            const redis = createMockRedis();
            expect(redis).toBeInstanceOf(Redis);
        });

        it('createMockRedisConnection should return a connection with getConnection method', () => {
            const connection = createMockRedisConnection();
            expect(connection.getConnection).toBeDefined();
            expect(typeof connection.getConnection).toBe('function');

            const redis = connection.getConnection();
            expect(redis).toBeInstanceOf(Redis);
        });

        it('Redis mock should support basic operations', async () => {
            const redis = createMockRedis();

            // Test set
            await redis.set('test-key', 'test-value');

            // Test get
            const value = await redis.get('test-key');
            expect(value).toBe('test-value');
        });
    });

    describe('Supabase Mocks', () => {
        it('createMockSupabaseClient should return a client with necessary methods', () => {
            const client = createMockSupabaseClient();

            expect(client.from).toBeDefined();
            expect(client.from().select).toBeDefined();
            expect(client.from().insert).toBeDefined();
            expect(client.from().update).toBeDefined();
            expect(client.from().delete).toBeDefined();
            expect(client.from().eq).toBeDefined();
            expect(client.from().single).toBeDefined();
        });

        it('Mock client methods should be chainable', () => {
            const client = createMockSupabaseClient();

            const result = client
                .from('test-table')
                .select('*')
                .eq('id', '123')
                .single();

            expect(result).toEqual({
                data: null,
                error: null
            });
        });
    });
}); 
