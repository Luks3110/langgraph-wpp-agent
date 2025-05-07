import { z } from 'zod';
import {
    WebhookRegistrationCommand,
    WorkflowDefinitionCommand
} from '../domain/commands/index';
import {
    Command,
    CommandBus,
    CommandHandler,
    createCommandBus,
    createValidationMiddleware
} from '../infrastructure/middleware/commandBus';

// Define concrete command types with types property
interface CreateWorkflowCommand extends WorkflowDefinitionCommand, Command {
    type: 'workflow.create';
}

interface RegisterWebhookCommand extends WebhookRegistrationCommand, Command {
    type: 'webhook.register';
}

// Command handlers
class CreateWorkflowHandler implements CommandHandler<CreateWorkflowCommand> {
    async handle(command: CreateWorkflowCommand): Promise<void> {
        console.log('Creating workflow:', command.name);
        // Actual implementation would store the workflow
    }
}

class RegisterWebhookHandler implements CommandHandler<RegisterWebhookCommand> {
    async handle(command: RegisterWebhookCommand): Promise<void> {
        console.log('Registering webhook:', command.name, 'for workflow:', command.workflowId);
        // Actual implementation would register the webhook
    }
}

// Set up command bus with validation
function setupCommandBus(): CommandBus {
    const commandBus = createCommandBus();

    // Create workflow command validation middleware
    const createWorkflowSchema = z.object({
        type: z.literal('workflow.create'),
        name: z.string().min(3).max(100),
        tenantId: z.string().uuid(),
        nodes: z.array(z.object({
            id: z.string().uuid(),
            type: z.string().min(1),
            name: z.string().min(1),
            config: z.record(z.unknown()).optional(),
            position: z.object({
                x: z.number(),
                y: z.number()
            }).optional()
        })).min(1),
        edges: z.array(z.object({
            source: z.string().uuid(),
            target: z.string().uuid(),
            condition: z.string().optional()
        })),
        description: z.string().max(500).optional(),
        tags: z.array(z.string()).optional()
    });

    const registerWebhookSchema = z.object({
        type: z.literal('webhook.register'),
        name: z.string().min(3).max(100),
        workflowId: z.string().uuid(),
        nodeId: z.string().uuid(),
        tenantId: z.string().uuid(),
        provider: z.string().min(1),
        config: z.record(z.unknown()).optional()
    });

    // Create validation middlewares
    const createWorkflowValidation = createValidationMiddleware<CreateWorkflowCommand>(
        createWorkflowSchema
    );

    const registerWebhookValidation = createValidationMiddleware<RegisterWebhookCommand>(
        registerWebhookSchema
    );

    // Add validation middleware
    commandBus.addMiddleware(createWorkflowValidation);
    commandBus.addMiddleware(registerWebhookValidation);

    // Register handlers
    commandBus.registerHandler('workflow.create', new CreateWorkflowHandler());
    commandBus.registerHandler('webhook.register', new RegisterWebhookHandler());

    return commandBus;
}

// Example usage
async function runExample() {
    const commandBus = setupCommandBus();

    // Valid workflow command
    const createWorkflowCommand: CreateWorkflowCommand = {
        type: 'workflow.create',
        name: 'My Workflow',
        tenantId: 'c0e9e9d0-7a6e-4b6b-8e3c-f2d9b6a7e9d0',
        nodes: [
            {
                id: 'a0e9e9d0-7a6e-4b6b-8e3c-f2d9b6a7e9d0',
                type: 'start',
                name: 'Start',
                position: { x: 100, y: 100 }
            },
            {
                id: 'b0e9e9d0-7a6e-4b6b-8e3c-f2d9b6a7e9d0',
                type: 'end',
                name: 'End',
                position: { x: 400, y: 100 }
            }
        ],
        edges: [
            {
                source: 'a0e9e9d0-7a6e-4b6b-8e3c-f2d9b6a7e9d0',
                target: 'b0e9e9d0-7a6e-4b6b-8e3c-f2d9b6a7e9d0'
            }
        ]
    };

    // Invalid workflow command (missing required fields)
    const invalidWorkflowCommand = {
        type: 'workflow.create',
        name: 'Invalid Workflow',
        // missing tenantId and nodes
        edges: []
    };

    try {
        console.log('Executing valid workflow command...');
        await commandBus.execute(createWorkflowCommand);

        console.log('\nExecuting invalid workflow command...');
        await commandBus.execute(invalidWorkflowCommand as unknown as CreateWorkflowCommand);
    } catch (error) {
        console.error('Error during command execution:',
            error instanceof Error ? error.message : String(error));
    }
}

// Node CommonJS check - won't work in ESM, for demonstration only
if (typeof require !== 'undefined' && require.main === module) {
    runExample().catch(console.error);
}

export { runExample, setupCommandBus };

