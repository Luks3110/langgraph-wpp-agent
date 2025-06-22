/**
 * Zod validation schemas for workflow engine
 */

import { z } from "zod";

/**
 * Base step schema
 */
const baseStepSchema = z.object({
  name: z.string().min(1, "Step name is required"),
  displayName: z.string().min(1, "Display name is required"),
  nextAction: z.string().optional(),
  settings: z.record(z.any()).default({})
});

/**
 * Trigger step schema
 */
const triggerStepSchema = baseStepSchema.extend({
  type: z.literal("TRIGGER"),
  triggerType: z.string().min(1, "Trigger type is required")
});

/**
 * Action step schema
 */
const actionStepSchema = baseStepSchema.extend({
  type: z.literal("ACTION"),
  actionType: z.string().min(1, "Action type is required")
});

/**
 * Workflow definition schema
 */
export const workflowDefinitionSchema = z.object({
  id: z.string().min(1, "Workflow ID is required"),
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().optional(),
  version: z.number().int().positive().default(1),
  trigger: triggerStepSchema,
  steps: z.record(actionStepSchema).default({})
});

/**
 * Workflow creation payload schema
 */
export const workflowCreateSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().optional(),
  definition: workflowDefinitionSchema.omit({ id: true })
});

/**
 * Main workflow schema for API endpoints
 */
export const workflowSchema = workflowDefinitionSchema;

/**
 * Workflow update payload schema
 */
export const workflowUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  definition: workflowDefinitionSchema.omit({ id: true }).optional(),
  status: z.enum(["active", "inactive", "archived"]).optional()
});

/**
 * Workflow execution request schema
 */
export const workflowExecutionSchema = z.object({
  workflowId: z.string().min(1, "Workflow ID is required"),
  triggerPayload: z.any().optional().default({}),
  variables: z.record(z.any()).optional().default({})
});

/**
 * Step test request schema
 */
export const stepTestSchema = z.object({
  stepType: z.enum(["trigger", "action"]),
  nodeType: z.string().min(1, "Node type is required"),
  settings: z.record(z.any()).default({}),
  mockContext: z
    .object({
      triggerPayload: z.any().optional(),
      variables: z.record(z.any()).optional(),
      stepResults: z.map(z.string(), z.any()).optional()
    })
    .optional()
});

/**
 * Node schema definition
 */
export const nodePropertySchema: z.ZodType<any> = z.object({
  type: z.enum(["string", "number", "boolean", "object", "array"]),
  title: z.string().min(1),
  description: z.string().optional(),
  default: z.any().optional(),
  enum: z.array(z.any()).optional(),
  format: z.string().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  items: z.lazy(() => nodePropertySchema).optional(),
  properties: z.record(z.lazy(() => nodePropertySchema)).optional()
});

export const nodeConfigSchema = z.object({
  properties: z.record(nodePropertySchema),
  required: z.array(z.string()).optional()
});

/**
 * Validation error type
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Helper function to format Zod errors
 */
export function formatZodErrors(error: z.ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
    code: err.code
  }));
}

/**
 * Validate workflow definition
 */
export function validateWorkflowDefinition(data: unknown): {
  success: boolean;
  data?: z.infer<typeof workflowDefinitionSchema>;
  errors?: ValidationError[];
} {
  const result = workflowDefinitionSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: formatZodErrors(result.error) };
  }
}

/**
 * Validate workflow creation payload
 */
export function validateWorkflowCreate(data: unknown): {
  success: boolean;
  data?: z.infer<typeof workflowCreateSchema>;
  errors?: ValidationError[];
} {
  const result = workflowCreateSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: formatZodErrors(result.error) };
  }
}

/**
 * Validate workflow execution request
 */
export function validateWorkflowExecution(data: unknown): {
  success: boolean;
  data?: z.infer<typeof workflowExecutionSchema>;
  errors?: ValidationError[];
} {
  const result = workflowExecutionSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: formatZodErrors(result.error) };
  }
}
