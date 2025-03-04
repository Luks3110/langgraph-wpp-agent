import { AgentResponseMessage, WhatsAppMessage } from '@products-monorepo/shared';
import { Request, Response } from 'express';
import { queueClient } from '../clients/queue.js';
import { whatsappClient } from '../clients/whatsapp.js';

/**
 * WhatsApp webhook controller
 */
export class WebhookController {
    /**
     * Handle webhook verification request
     */
    public handleVerification(req: Request, res: Response): void {
        try {
            const challenge = whatsappClient.handleWebhookVerification(req.query);
            if (challenge) {
                res.status(200).send(challenge);
            } else {
                res.sendStatus(403);
            }
        } catch (error) {
            console.error('Error verifying webhook:', error);
            res.sendStatus(403);
        }
    }

    /**
     * Process incoming webhook data
     */
    public async processWebhook(req: Request, res: Response): Promise<void> {
        try {
            const success = await whatsappClient.processWebhook(
                req.body,
                (req as any).rawBody,
                req.headers['x-hub-signature-256'] as string
            );

            if (success) {
                res.status(200).send('EVENT_RECEIVED');
            } else {
                res.sendStatus(400);
            }
        } catch (error) {
            console.error('Error processing webhook:', error);
            res.sendStatus(400);
        }
    }

    /**
     * Handle agent responses and send them back to WhatsApp
     */
    public async handleAgentResponse(req: Request, res: Response): Promise<void> {
        try {
            const agentResponse = req.body as AgentResponseMessage;

            if (!agentResponse || !agentResponse.to || !agentResponse.text) {
                console.error('Invalid agent response received:', agentResponse);
                res.status(400).json({ error: 'Invalid agent response format' });
                return;
            }

            // Send message back to the WhatsApp user
            await whatsappClient.sendMessage(agentResponse.to, agentResponse.text);

            res.status(200).json({ status: 'Message sent successfully' });
        } catch (error) {
            console.error('Error handling agent response:', error);
            res.status(500).json({ error: 'Failed to send message to WhatsApp' });
        }
    }

    /**
     * Handle WhatsApp message and forward to agent
     */
    public async handleWhatsAppMessage(message: WhatsAppMessage): Promise<void> {
        try {
            console.log(`Received message from ${message.from}: ${message.text}`);

            // Forward the message to the agent service via BullMQ
            await queueClient.sendMessageToAgent({
                from: message.from,
                text: message.text,
                timestamp: message.timestamp,
                messageId: message.messageId
            });
        } catch (error) {
            console.error('Error handling WhatsApp message:', error);

            // Send error message to user
            await whatsappClient.sendMessage(
                message.from,
                'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.'
            );
        }
    }
}

// Export a singleton instance
export const webhookController = new WebhookController(); 
