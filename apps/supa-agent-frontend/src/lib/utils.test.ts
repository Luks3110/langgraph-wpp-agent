// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateWebhookUrl } from './utils';

describe('utils', () => {
    describe('generateWebhookUrl', () => {
        // Store the original window.location
        const originalLocation = window.location;

        beforeEach(() => {
            // Mock the window.location.origin
            Object.defineProperty(window, 'location', {
                value: {
                    origin: 'https://example.com',
                },
                writable: true,
            });
        });

        afterEach(() => {
            // Restore original location
            Object.defineProperty(window, 'location', {
                value: originalLocation,
                writable: true,
            });
        });

        it('should generate a webhook URL with the correct format', () => {
            const nodeType = 'mercadolivreQa';
            const userId = 'user-123';
            const workflowId = 'workflow-456';

            const url = generateWebhookUrl(nodeType, userId, workflowId);

            expect(url).toBe('https://example.com/api/webhooks/mercadolivreQa/user-123/workflow-456');
        });

        it('should handle different node types', () => {
            const nodeType = 'customNode';
            const userId = 'user-123';
            const workflowId = 'workflow-456';

            const url = generateWebhookUrl(nodeType, userId, workflowId);

            expect(url).toBe('https://example.com/api/webhooks/customNode/user-123/workflow-456');
        });
    });
}); 
