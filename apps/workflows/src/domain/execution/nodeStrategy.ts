import { WorkflowNodeQuery } from '../queries';
import { ExecutionResult, ValidationResult, WorkflowContext } from './models';

/**
 * Strategy interface for executing different types of nodes
 */
export interface NodeExecutionStrategy {
    /**
     * Execute the node with the provided context
     */
    execute(context: WorkflowContext, node: WorkflowNodeQuery): Promise<ExecutionResult>;

    /**
     * Validate that the node is properly configured
     */
    validate(node: WorkflowNodeQuery): Promise<ValidationResult>;

    /**
     * Perform any necessary cleanup after the node has executed
     */
    cleanup(context: WorkflowContext, node: WorkflowNodeQuery): Promise<void>;
}

/**
 * Abstract base class for node execution strategies with common functionality
 */
export abstract class BaseNodeExecutionStrategy implements NodeExecutionStrategy {
    /**
     * Execute the node with the provided context
     */
    abstract execute(context: WorkflowContext, node: WorkflowNodeQuery): Promise<ExecutionResult>;

    /**
     * Validate that the node is properly configured
     */
    async validate(node: WorkflowNodeQuery): Promise<ValidationResult> {
        // By default, return valid if the node has an id, type, and name
        const errors: string[] = [];

        if (!node.id) {
            errors.push('Node is missing required id field');
        }

        if (!node.type) {
            errors.push('Node is missing required type field');
        }

        if (!node.name) {
            errors.push('Node is missing required name field');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Perform any necessary cleanup after the node has executed
     */
    async cleanup(_context: WorkflowContext, _node: WorkflowNodeQuery): Promise<void> {
        // Default implementation does nothing
        return Promise.resolve();
    }

    /**
     * Helper method to get input data for the node
     */
    protected getNodeInput(context: WorkflowContext, node: WorkflowNodeQuery): any {
        // If this is an entry node, use the workflow variables as input
        if (context.metadata.processedWorkflow?.entryNodes?.includes(node.id)) {
            return context.variables;
        }

        // Otherwise, get input from predecessor nodes
        const adjacencyList = context.metadata.processedWorkflow?.adjacencyList || {};
        const predecessors: string[] = [];

        // Find all predecessor nodes
        Object.entries(adjacencyList).forEach(([sourceId, targets]) => {
            if (Array.isArray(targets) && targets.includes(node.id)) {
                predecessors.push(sourceId);
            }
        });

        // If there are no predecessors, return empty object
        if (predecessors.length === 0) {
            return {};
        }

        // If there's only one predecessor, return its output directly
        if (predecessors.length === 1) {
            const predecessorId = predecessors[0];
            return context.nodeResults[predecessorId]?.output || {};
        }

        // If there are multiple predecessors, return an object with outputs from all
        const input: Record<string, any> = {};

        predecessors.forEach(predecessorId => {
            const result = context.nodeResults[predecessorId];
            if (result && result.output) {
                // Use the node id as key for the input
                input[predecessorId] = result.output;
            }
        });

        return input;
    }
}

/**
 * HTTP request node execution strategy
 */
export class HttpRequestNodeStrategy extends BaseNodeExecutionStrategy {
    async execute(context: WorkflowContext, node: WorkflowNodeQuery): Promise<ExecutionResult> {
        try {
            const input = this.getNodeInput(context, node);
            const config = node.config || {};

            // Extract HTTP request configuration
            const url = config.url || '';
            const method = config.method || 'GET';
            const headers = config.headers || {};
            const body = config.body ? JSON.stringify(config.body) : undefined;

            // Execute HTTP request
            const response = await fetch(url, {
                method,
                headers,
                body
            });

            // Process response
            const statusCode = response.status;
            const contentType = response.headers.get('content-type') || '';

            let responseData;
            if (contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                responseData = await response.text();
            }

            // Check if the request was successful
            const success = statusCode >= 200 && statusCode < 300;

            return {
                success,
                output: {
                    statusCode,
                    headers: Object.fromEntries(response.headers.entries()),
                    body: responseData
                },
                error: success ? undefined : new Error(`HTTP request failed with status ${statusCode}`)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    async validate(node: WorkflowNodeQuery): Promise<ValidationResult> {
        const baseResult = await super.validate(node);

        if (!baseResult.isValid) {
            return baseResult;
        }

        const errors: string[] = [];
        const config = node.config || {};

        if (!config.url) {
            errors.push('HTTP request node is missing required URL');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

/**
 * Transform node execution strategy
 */
export class TransformNodeStrategy extends BaseNodeExecutionStrategy {
    async execute(context: WorkflowContext, node: WorkflowNodeQuery): Promise<ExecutionResult> {
        try {
            const input = this.getNodeInput(context, node);
            const config = node.config || {};

            // Extract transformation configuration
            const transformationType = config.transformationType || 'map';
            const template = config.template || '';

            let output;

            // Apply the appropriate transformation
            switch (transformationType) {
                case 'map':
                    if (Array.isArray(input)) {
                        output = input.map(item => this.applyTemplate(template, item));
                    } else {
                        output = this.applyTemplate(template, input);
                    }
                    break;

                case 'filter':
                    if (Array.isArray(input)) {
                        output = input.filter(item => this.evaluateCondition(template, item));
                    } else {
                        output = this.evaluateCondition(template, input) ? input : null;
                    }
                    break;

                case 'reduce':
                    if (Array.isArray(input)) {
                        // For reduce, the template should be a function body
                        output = input.reduce((acc, curr) => {
                            // Create a function from the template
                            try {
                                const fn = new Function('accumulator', 'current', template);
                                return fn(acc, curr);
                            } catch (error) {
                                console.error('Error in reduce transformation:', error);
                                return acc;
                            }
                        }, config.initialValue);
                    } else {
                        output = input;
                    }
                    break;

                default:
                    output = input;
            }

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

    async validate(node: WorkflowNodeQuery): Promise<ValidationResult> {
        const baseResult = await super.validate(node);

        if (!baseResult.isValid) {
            return baseResult;
        }

        const errors: string[] = [];
        const config = node.config || {};

        if (!config.transformationType) {
            errors.push('Transform node is missing required transformationType');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Apply a template to transform data
     */
    private applyTemplate(template: string, data: any): any {
        if (!template) {
            return data;
        }

        try {
            // Create a function from the template
            const fn = new Function('data', `return ${template}`);
            return fn(data);
        } catch (error) {
            console.error('Error applying template:', error);
            return data;
        }
    }

    /**
     * Evaluate a condition expression
     */
    private evaluateCondition(condition: string, data: any): boolean {
        if (!condition) {
            return true;
        }

        try {
            // Create a function from the condition
            const fn = new Function('data', `return ${condition}`);
            return Boolean(fn(data));
        } catch (error) {
            console.error('Error evaluating condition:', error);
            return false;
        }
    }
}

/**
 * Webhook node execution strategy
 */
export class WebhookNodeStrategy extends BaseNodeExecutionStrategy {
    async execute(context: WorkflowContext, node: WorkflowNodeQuery): Promise<ExecutionResult> {
        // Webhook nodes are trigger points and don't execute directly
        // Their execution happens when the webhook is triggered
        return {
            success: true,
            output: this.getNodeInput(context, node)
        };
    }
}

/**
 * Factory for creating node execution strategies based on node type
 */
export class NodeExecutionFactory {
    private strategies: Map<string, NodeExecutionStrategy> = new Map();

    constructor() {
        // Register default strategies
        this.registerStrategy('http', new HttpRequestNodeStrategy());
        this.registerStrategy('transform', new TransformNodeStrategy());
        this.registerStrategy('webhook', new WebhookNodeStrategy());
    }

    /**
     * Register a strategy for a specific node type
     */
    registerStrategy(nodeType: string, strategy: NodeExecutionStrategy): void {
        this.strategies.set(nodeType, strategy);
    }

    /**
     * Create an execution strategy for the given node type
     */
    createStrategy(nodeType: string): NodeExecutionStrategy {
        const strategy = this.strategies.get(nodeType);

        if (!strategy) {
            throw new Error(`No execution strategy registered for node type: ${nodeType}`);
        }

        return strategy;
    }

    /**
     * Check if a strategy exists for the given node type
     */
    hasStrategy(nodeType: string): boolean {
        return this.strategies.has(nodeType);
    }
} 
