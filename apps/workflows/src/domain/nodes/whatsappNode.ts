import { NodeExecutionStrategy } from '../execution/nodeStrategy.js';
import { ExecutionResult, ValidationResult, WorkflowContext } from '../execution/models.js';
import { WorkflowNodeQuery } from '../queries/index.js';

export interface WhatsAppNodeData {
    accessToken: string;
    phoneNumberId: string;
    messageType: 'text' | 'template' | 'media' | 'interactive';
    messageConfig: {
        // For text messages
        text?: string;
        // For template messages
        templateName?: string;
        templateLanguage?: string;
        templateParameters?: Array<{
            type: 'text' | 'currency' | 'date_time';
            text?: string;
            currency?: {
                fallback_value: string;
                code: string;
                amount_1000: number;
            };
            date_time?: {
                fallback_value: string;
                day_of_week?: number;
                year?: number;
                month?: number;
                day_of_month?: number;
                hour?: number;
                minute?: number;
            };
        }>;
        // For media messages
        mediaType?: 'image' | 'video' | 'audio' | 'document';
        mediaUrl?: string;
        mediaCaption?: string;
        // For interactive messages
        interactiveType?: 'button' | 'list';
        interactiveConfig?: any;
    };
    recipientMapping?: {
        phoneNumberField: string; // Field path to get phone number from input
        dynamicFields?: Record<string, string>; // Map input fields to message variables
    };
    errorHandling?: {
        retryOnFailure: boolean;
        maxRetries: number;
        retryDelay: number;
    };
}

export interface WhatsAppNodeInput {
    recipient: string;
    messageData?: Record<string, any>;
    [key: string]: any;
}

export class WhatsAppNodeStrategy implements NodeExecutionStrategy {
    private readonly BASE_URL = 'https://graph.facebook.com/v18.0';

    /**
     * Validate WhatsApp node configuration
     */
    async validate(node: WorkflowNodeQuery): Promise<ValidationResult> {
        const errors: string[] = [];
        const data = node.config as WhatsAppNodeData;

        if (!data) {
            return { isValid: false, errors: ['Node configuration is required'] };
        }

        // Validate required fields
        if (!data.accessToken) {
            errors.push('WhatsApp access token is required');
        }

        if (!data.phoneNumberId) {
            errors.push('WhatsApp phone number ID is required');
        }

        if (!data.messageType) {
            errors.push('Message type is required');
        }

        // Validate message configuration based on type
        if (data.messageType === 'text' && !data.messageConfig.text) {
            errors.push('Text message content is required for text message type');
        }

        if (data.messageType === 'template') {
            if (!data.messageConfig.templateName) {
                errors.push('Template name is required for template message type');
            }
            if (!data.messageConfig.templateLanguage) {
                errors.push('Template language is required for template message type');
            }
        }

        if (data.messageType === 'media') {
            if (!data.messageConfig.mediaType) {
                errors.push('Media type is required for media message type');
            }
            if (!data.messageConfig.mediaUrl) {
                errors.push('Media URL is required for media message type');
            }
        }

        // Validate recipient mapping
        if (!data.recipientMapping?.phoneNumberField) {
            errors.push('Phone number field mapping is required');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Execute WhatsApp node to send a message
     */
    async execute(context: WorkflowContext, node: WorkflowNodeQuery): Promise<ExecutionResult> {
        try {
            const data = node.config as WhatsAppNodeData;
            const input = this.getNodeInput(context, node);

            // Extract recipient phone number
            const phoneNumber = this.getNestedValue(input, data.recipientMapping!.phoneNumberField);
            if (!phoneNumber) {
                throw new Error(`Phone number not found at path: ${data.recipientMapping!.phoneNumberField}`);
            }

            // Prepare message payload
            const messagePayload = await this.prepareMessagePayload(data, input, phoneNumber);

            // Send message via WhatsApp API
            const response = await this.sendWhatsAppMessage(
                data.accessToken,
                data.phoneNumberId,
                messagePayload
            );

            return {
                success: true,
                output: {
                    messageId: response.messages[0].id,
                    recipient: phoneNumber,
                    messageType: data.messageType,
                    timestamp: new Date().toISOString(),
                    whatsappResponse: response
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }

    /**
     * Cleanup - no cleanup needed for WhatsApp messages
     */
    async cleanup(_context: WorkflowContext, _node: WorkflowNodeQuery): Promise<void> {
        // No cleanup needed
    }

    /**
     * Get node input data (helper method)
     */
    private getNodeInput(context: WorkflowContext, node: WorkflowNodeQuery): any {
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
                input[predecessorId] = result.output;
            }
        });

        return input;
    }

    /**
     * Prepare message payload based on message type
     */
    private async prepareMessagePayload(
        data: WhatsAppNodeData,
        input: any,
        phoneNumber: string
    ): Promise<Record<string, any>> {
        const basePayload = {
            messaging_product: 'whatsapp',
            to: phoneNumber
        };

        switch (data.messageType) {
            case 'text':
                return {
                    ...basePayload,
                    type: 'text',
                    text: {
                        body: this.processMessageTemplate(data.messageConfig.text || '', input, data.recipientMapping?.dynamicFields)
                    }
                };

            case 'template':
                const templatePayload = {
                    ...basePayload,
                    type: 'template',
                    template: {
                        name: data.messageConfig.templateName,
                        language: {
                            code: data.messageConfig.templateLanguage
                        }
                    }
                };

                if (data.messageConfig.templateParameters && data.messageConfig.templateParameters.length > 0) {
                    (templatePayload.template as any).components = [{
                        type: 'body',
                        parameters: data.messageConfig.templateParameters
                    }];
                }

                return templatePayload;

            case 'media':
                const mediaPayload: any = {
                    ...basePayload,
                    type: data.messageConfig.mediaType
                };

                mediaPayload[data.messageConfig.mediaType!] = {
                    link: data.messageConfig.mediaUrl
                };

                if (data.messageConfig.mediaCaption) {
                    mediaPayload[data.messageConfig.mediaType!].caption = 
                        this.processMessageTemplate(data.messageConfig.mediaCaption, input, data.recipientMapping?.dynamicFields);
                }

                return mediaPayload;

            case 'interactive':
                return {
                    ...basePayload,
                    type: 'interactive',
                    interactive: data.messageConfig.interactiveConfig
                };

            default:
                throw new Error(`Unsupported message type: ${data.messageType}`);
        }
    }

    /**
     * Process message template with dynamic values
     */
    private processMessageTemplate(template: string, input: any, dynamicFields?: Record<string, string>): string {
        let processedTemplate = template;

        // Replace dynamic field placeholders
        if (dynamicFields) {
            Object.entries(dynamicFields).forEach(([placeholder, inputPath]) => {
                const value = this.getNestedValue(input, inputPath);
                if (value !== undefined) {
                    processedTemplate = processedTemplate.replace(
                        new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g'),
                        String(value)
                    );
                }
            });
        }

        // Replace any remaining input field placeholders
        const placeholderRegex = /\{\{([^}]+)\}\}/g;
        processedTemplate = processedTemplate.replace(placeholderRegex, (match, fieldPath) => {
            const value = this.getNestedValue(input, fieldPath.trim());
            return value !== undefined ? String(value) : match;
        });

        return processedTemplate;
    }

    /**
     * Send message via WhatsApp API
     */
    private async sendWhatsAppMessage(
        accessToken: string,
        phoneNumberId: string,
        messagePayload: Record<string, any>
    ): Promise<any> {
        const url = `${this.BASE_URL}/${phoneNumberId}/messages`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messagePayload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`WhatsApp API error: ${errorData.error?.message || response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Get nested value from object using dot notation
     */
    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}