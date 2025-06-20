import { NodeExecutionStrategy } from '../execution/nodeStrategy.js';
import { ExecutionResult, ValidationResult, WorkflowContext } from '../execution/models.js';
import { WorkflowNodeQuery } from '../queries/index.js';

export interface WebhookTriggerNodeData {
    webhookPath: string;
    webhookSecret?: string;
    validateSignature?: boolean;
    inputMapping?: Record<string, string>;
    filters?: Array<{
        field: string;
        operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'exists';
        value: any;
    }>;
}

export interface WebhookTriggerInput {
    payload: Record<string, any>;
    headers: Record<string, string>;
    webhookPath: string;
    timestamp: string;
}

export class WebhookTriggerNodeStrategy implements NodeExecutionStrategy {
    /**
     * Validate webhook trigger node configuration
     */
    async validate(node: WorkflowNodeQuery): Promise<ValidationResult> {
        const errors: string[] = [];
        const data = node.config as WebhookTriggerNodeData;

        if (!data) {
            return { isValid: false, errors: ['Node configuration is required'] };
        }

        // Validate webhook path
        if (!data.webhookPath) {
            errors.push('Webhook path is required');
        } else if (!data.webhookPath.startsWith('/')) {
            errors.push('Webhook path must start with /');
        }

        // Validate signature validation settings
        if (data.validateSignature && !data.webhookSecret) {
            errors.push('Webhook secret is required when signature validation is enabled');
        }

        // Validate filters
        if (data.filters) {
            data.filters.forEach((filter, index) => {
                if (!filter.field) {
                    errors.push(`Filter ${index + 1}: field is required`);
                }
                if (!filter.operator) {
                    errors.push(`Filter ${index + 1}: operator is required`);
                }
                if (filter.operator !== 'exists' && filter.value === undefined) {
                    errors.push(`Filter ${index + 1}: value is required for operator ${filter.operator}`);
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Execute webhook trigger node
     * This processes webhook data and prepares it for the next node
     */
    async execute(context: WorkflowContext, node: WorkflowNodeQuery): Promise<ExecutionResult> {
        try {
            const data = node.config as WebhookTriggerNodeData;
            
            // Get webhook input from context variables
            const webhookInput = context.variables as WebhookTriggerInput;
            
            if (!webhookInput || !webhookInput.payload) {
                throw new Error('Webhook input data not found in context');
            }

            const { payload, headers, webhookPath, timestamp } = webhookInput;

            // Validate webhook path matches
            if (data.webhookPath !== webhookPath) {
                throw new Error(`Webhook path mismatch: expected ${data.webhookPath}, got ${webhookPath}`);
            }

            // Apply filters if configured
            if (data.filters && data.filters.length > 0) {
                const filterResults = this.applyFilters(payload, data.filters);
                if (!filterResults.passed) {
                    return {
                        success: false,
                        error: new Error(`Webhook payload failed filters: ${filterResults.failedFilters.join(', ')}`)
                    };
                }
            }

            // Apply input mapping if configured
            let mappedOutput = payload;
            if (data.inputMapping) {
                mappedOutput = this.applyInputMapping(payload, data.inputMapping);
            }

            // Include webhook metadata
            const output = {
                ...mappedOutput,
                _webhook: {
                    path: webhookPath,
                    timestamp,
                    headers: headers,
                    originalPayload: payload
                }
            };

            return {
                success: true,
                output
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    /**
     * Cleanup - no cleanup needed for webhook triggers
     */
    async cleanup(_context: WorkflowContext, _node: WorkflowNodeQuery): Promise<void> {
        // No cleanup needed
    }

    /**
     * Apply filters to webhook payload
     */
    private applyFilters(payload: Record<string, any>, filters: WebhookTriggerNodeData['filters']): {
        passed: boolean;
        failedFilters: string[];
    } {
        const failedFilters: string[] = [];

        if (!filters) {
            return { passed: true, failedFilters: [] };
        }

        for (const filter of filters) {
            const fieldValue = this.getNestedValue(payload, filter.field);
            const passed = this.evaluateFilter(fieldValue, filter.operator, filter.value);

            if (!passed) {
                failedFilters.push(`${filter.field} ${filter.operator} ${filter.value}`);
            }
        }

        return {
            passed: failedFilters.length === 0,
            failedFilters
        };
    }

    /**
     * Evaluate a single filter condition
     */
    private evaluateFilter(fieldValue: any, operator: string, expectedValue: any): boolean {
        switch (operator) {
            case 'equals':
                return fieldValue === expectedValue;
            case 'contains':
                return typeof fieldValue === 'string' && fieldValue.includes(expectedValue);
            case 'startsWith':
                return typeof fieldValue === 'string' && fieldValue.startsWith(expectedValue);
            case 'endsWith':
                return typeof fieldValue === 'string' && fieldValue.endsWith(expectedValue);
            case 'gt':
                return typeof fieldValue === 'number' && fieldValue > expectedValue;
            case 'lt':
                return typeof fieldValue === 'number' && fieldValue < expectedValue;
            case 'exists':
                return fieldValue !== undefined && fieldValue !== null;
            default:
                return false;
        }
    }

    /**
     * Apply input mapping to transform webhook payload
     */
    private applyInputMapping(payload: Record<string, any>, mapping: Record<string, string>): Record<string, any> {
        const result: Record<string, any> = {};

        for (const [outputKey, inputPath] of Object.entries(mapping)) {
            const value = this.getNestedValue(payload, inputPath);
            this.setNestedValue(result, outputKey, value);
        }

        return result;
    }

    /**
     * Get nested value from object using dot notation
     */
    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Set nested value in object using dot notation
     */
    private setNestedValue(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        const lastKey = keys.pop();
        
        if (!lastKey) return;

        const target = keys.reduce((current, key) => {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            return current[key];
        }, obj);

        target[lastKey] = value;
    }

    /**
     * Generate webhook URL for this trigger
     */
    generateWebhookUrl(baseUrl: string, webhookPath: string): string {
        return `${baseUrl.replace(/\/$/, '')}${webhookPath.startsWith('/') ? webhookPath : '/' + webhookPath}`;
    }

    /**
     * Validate webhook signature (for secure webhooks)
     */
    validateWebhookSignature(
        payload: string,
        signature: string,
        secret: string,
        algorithm: 'sha256' | 'sha1' = 'sha256'
    ): boolean {
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac(algorithm, secret)
            .update(payload)
            .digest('hex');

        // Support different signature formats
        const normalizedSignature = signature.replace(/^(sha256=|sha1=)/, '');
        
        return crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'hex'),
            Buffer.from(normalizedSignature, 'hex')
        );
    }
}