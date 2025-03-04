#!/usr/bin/env ts-node

/**
 * This script tests Redis and BullMQ functionality by sending 
 * a test message to a queue and consuming it.
 * 
 * Usage:
 * pnpm test-queue
 */

import { Queue, Worker } from 'bullmq';
import * as dotenv from 'dotenv';
import Redis from 'ioredis';
import * as path from 'path';

// Load environment variables from whatsapp-service
dotenv.config({ path: path.resolve(__dirname, '../apps/whatsapp-service/.env') });

// Redis connection configuration
const REDIS_CONFIG = {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
};

// Queue names
const TEST_QUEUE = 'test-queue';

// Create Redis client
const redisClient = new Redis(REDIS_CONFIG);

// Create test queue
const testQueue = new Queue(TEST_QUEUE, {
    connection: new Redis(REDIS_CONFIG),
});

// Test message
const testMessage = {
    id: 'test-' + Date.now(),
    text: 'Hello from BullMQ test!',
    timestamp: new Date().toISOString(),
};

async function main(): Promise<void> {
    try {
        // Test Redis connection
        console.log('Testing Redis connection...');
        const pingResult = await redisClient.ping();
        console.log(`Redis connection successful: ${pingResult}`);

        // Create worker to process messages
        console.log('Creating test worker...');
        const worker = new Worker(
            TEST_QUEUE,
            async (job) => {
                console.log('Received message:');
                console.log(JSON.stringify(job.data, null, 2));
                return { status: 'success', processedAt: new Date().toISOString() };
            },
            { connection: new Redis(REDIS_CONFIG) }
        );

        worker.on('completed', (job) => {
            console.log(`Job ${job?.id} completed with result:`, job?.returnvalue);
        });

        // Send test message
        console.log('Sending test message...');
        const job = await testQueue.add('test-job', testMessage);
        console.log(`Test message sent with job ID: ${job.id}`);

        // Wait for processing to complete
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Cleanup
        console.log('Cleaning up...');
        await worker.close();
        await testQueue.close();
        await redisClient.quit();

        console.log('Test completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

main().catch(console.error); 
