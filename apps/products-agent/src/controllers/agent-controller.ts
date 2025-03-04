import { AgentRequestMessage, AgentResponseMessage } from '@products-monorepo/shared';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { runAgent } from '../agents/graph.js';
import { queueClient } from '../clients/queue.js';
import { addMessageToHistory, getChatHistory } from '../utils/chat-history.js';

/**
 * Controller for handling agent operations
 */
export class AgentController {
    /**
     * Process a message from WhatsApp
     */
    public async processMessage(req: Request, res: Response): Promise<void> {
        try {
            const message = req.body as AgentRequestMessage;

            if (!message || !message.from || !message.text) {
                console.error('Invalid message received:', message);
                res.status(400).json({ error: 'Invalid message format' });
                return;
            }

            // Acknowledge receipt immediately
            res.status(200).json({ status: 'Message received, processing' });

            // Process the message asynchronously
            this.handleMessageAsync(message).catch(error => {
                console.error('Error processing message asynchronously:', error);
            });
        } catch (error) {
            console.error('Error processing message:', error);
            res.status(500).json({ error: 'Failed to process message' });
        }
    }

    /**
     * Process a message asynchronously and send the response back
     */
    public async handleMessageAsync(message: AgentRequestMessage): Promise<void> {
        try {
            console.log(`Processing message from ${message.from}: ${message.text}`);

            // Add user message to chat history
            addMessageToHistory(message.from, 'user', message.text);

            // Get chat history
            const chatHistory = getChatHistory(message.from);

            // Run the agent
            const response = await runAgent(message.from, message.text, chatHistory);

            // Add assistant response to chat history
            addMessageToHistory(message.from, 'assistant', response);

            // Prepare response message
            const responseMessage: AgentResponseMessage = {
                to: message.from,
                text: response,
                messageId: randomUUID(),
                originalMessageId: message.messageId
            };

            // Send response back to WhatsApp service
            await queueClient.sendResponseToWhatsApp(responseMessage);
        } catch (error) {
            console.error('Error handling message asynchronously:', error);

            // Send error response back to user
            const errorResponse: AgentResponseMessage = {
                to: message.from,
                text: 'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.',
                messageId: randomUUID(),
                originalMessageId: message.messageId
            };

            await queueClient.sendResponseToWhatsApp(errorResponse);
        }
    }
}

// Export a singleton instance
export const agentController = new AgentController(); 
