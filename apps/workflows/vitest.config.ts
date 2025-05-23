import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['**/node_modules/**', '**/dist/**', '**/test/**']
        },
        include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
        setupFiles: ['./test/setup.ts']
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            'ioredis': 'ioredis-mock'
        }
    },
    esbuild: {
        // Suppress target warning
        logOverride: {
            'this-is-undefined-in-esm': 'silent',
            'unsupported-target': 'silent',
        },
        target: 'es2022'
    }
}); 
