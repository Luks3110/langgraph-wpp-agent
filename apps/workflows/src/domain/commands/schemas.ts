import { z } from 'zod';
import type {
    TriggerMetadata,
    WorkflowDefinitionCommand
} from './index';

// Base schema for all commands
export const commandSchema = z.object({
    type: z.string(),
    tenantId: z.string().uuid()
});

// Position schema
const positionSchema = z.object({
    x: z.number(),
    y: z.number()
});

// Node command schema
export const workflowNodeCommandSchema = z.object({
    id: z.string(),
    type: z.string(),
    name: z.string().min(1).max(100),
    position: positionSchema,
    config: z.record(z.unknown()).optional()
});

// Edge command schema
export const workflowEdgeCommandSchema = z.object({
    source: z.string(),
    target: z.string(),
    condition: z.string().optional()
});

// Workflow definition schema
export const createWorkflowCommandSchema = commandSchema.extend({
    type: z.literal('workflow.create'),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    nodes: z.array(workflowNodeCommandSchema),
    edges: z.array(workflowEdgeCommandSchema),
    tags: z.array(z.string()).optional()
});

// UpdateWorkflowCommand schema
export const updateWorkflowCommandSchema = commandSchema.extend({
    type: z.literal('workflow.update'),
    id: z.string().uuid(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    nodes: z.array(workflowNodeCommandSchema).optional(),
    edges: z.array(workflowEdgeCommandSchema).optional(),
    tags: z.array(z.string()).optional()
});

// DeleteWorkflowCommand schema
export const deleteWorkflowCommandSchema = commandSchema.extend({
    type: z.literal('workflow.delete'),
    id: z.string().uuid()
});

// PublishWorkflowCommand schema
export const publishWorkflowCommandSchema = commandSchema.extend({
    type: z.literal('workflow.publish'),
    id: z.string().uuid()
});

// Trigger metadata schema
const triggerMetadataSchema = z.object({
    source: z.string(),
    sourceType: z.string(),
    actionType: z.string().optional(),
    customerId: z.string().optional(),
    clientId: z.string().optional(),
    receivedAt: z.string().datetime()
});

// Node trigger command schema
export const triggerNodeCommandSchema = commandSchema.extend({
    type: z.literal('node.trigger'),
    nodeId: z.string(),
    input: z.record(z.unknown()),
    metadata: triggerMetadataSchema
});

// Webhook registration schema
export const webhookRegistrationCommandSchema = commandSchema.extend({
    type: z.literal('webhook.register'),
    name: z.string().min(1).max(100),
    workflowId: z.string().uuid(),
    nodeId: z.string(),
    provider: z.enum(['instagram', 'facebook', 'twitter', 'custom']),
    config: z.record(z.unknown()).optional()
});

// WebhookDeactivationCommand schema
export const webhookDeactivationCommandSchema = commandSchema.extend({
    type: z.literal('webhook.deactivate'),
    webhookId: z.string().uuid()
});

// ProcessWebhookEventCommand schema
export const processWebhookEventCommandSchema = commandSchema.extend({
    type: z.literal('webhook.process'),
    webhookId: z.string().uuid(),
    payload: z.record(z.unknown()),
    headers: z.record(z.string())
});

// Export types
export type CommandWithType<T extends string> = { type: T } & z.infer<typeof commandSchema>;
export type CreateWorkflowCommand = z.infer<typeof createWorkflowCommandSchema>;
export type UpdateWorkflowCommand = z.infer<typeof updateWorkflowCommandSchema>;
export type DeleteWorkflowCommand = z.infer<typeof deleteWorkflowCommandSchema>;
export type PublishWorkflowCommand = z.infer<typeof publishWorkflowCommandSchema>;
export type TriggerNodeCommand = z.infer<typeof triggerNodeCommandSchema>;
export type WebhookRegistrationCommandWithType = z.infer<typeof webhookRegistrationCommandSchema>;
export type WebhookDeactivationCommand = z.infer<typeof webhookDeactivationCommandSchema>;
export type ProcessWebhookEventCommand = z.infer<typeof processWebhookEventCommandSchema>;

// Type validation helper functions
export function validateWorkflowDefinitionCommand(
    data: unknown
): z.SafeParseReturnType<unknown, WorkflowDefinitionCommand> {
    // We need to cast here because our Zod schema adds the type field
    // but the interface doesn't have it
    return createWorkflowCommandSchema.safeParse(data) as z.SafeParseReturnType<unknown, WorkflowDefinitionCommand>;
}

export function validateWebhookRegistrationCommand(
    data: unknown
): z.SafeParseReturnType<unknown, WebhookRegistrationCommandWithType> {
    return webhookRegistrationCommandSchema.safeParse(data);
}

export function validateTriggerNodeCommand(
    data: unknown
): z.SafeParseReturnType<unknown, TriggerNodeCommand> {
    // Instead of directly returning the schema result, we need to handle the type conversion more explicitly
    const result = triggerNodeCommandSchema.safeParse(data);

    if (!result.success) {
        return result as z.SafeParseError<TriggerNodeCommand>;
    }

    // Ensure we return a properly typed object
    const validData: TriggerNodeCommand = {
        type: result.data.type,
        tenantId: result.data.tenantId,
        nodeId: result.data.nodeId,
        input: result.data.input,
        metadata: result.data.metadata as TriggerMetadata
    };

    return {
        success: true,
        data: validData
    } as z.SafeParseSuccess<TriggerNodeCommand>;
} 
