import { WhatsAppMessage } from "@products-monorepo/shared";
import { Request, Response } from "express";
import { runAgent } from "../agents/graph.js";
import { whatsappClient } from "../clients/whatsapp.js";
import {
    addMessageToHistory,
    convertChatHistoryForAgent,
    getChatHistory
} from "../utils/chat-history.js";

/**
 * Controller for handling WhatsApp messages with LangGraph agent
 */
export class AgentWebhookController {
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
            console.error("Error verifying webhook:", error);
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
                req.headers["x-hub-signature-256"] as string
            );

            if (success) {
                res.status(200).send("EVENT_RECEIVED");
            } else {
                res.sendStatus(400);
            }
        } catch (error) {
            console.error("Error processing webhook:", error);
            res.sendStatus(400);
        }
    }

    /**
     * Handle WhatsApp message with LangGraph agent
     */
    public async handleWhatsAppMessage(message: WhatsAppMessage): Promise<void> {
        try {
            console.log(`Received message from ${message.from}: ${message.text}`);

            // Add user message to chat history
            await addMessageToHistory(message.from, "user", message.text);

            // Get chat history
            const chatHistory = await getChatHistory(message.from);
            const formattedHistory = convertChatHistoryForAgent(chatHistory);

            // Run the agent
            const result = await runAgent(
                message.from,
                message.text,
                message.messageId,
                formattedHistory
            );

            // If the agent generated a response, add it to chat history
            if (result.success && result.message) {
                await addMessageToHistory(message.from, "assistant", result.message);
            }
        } catch (error) {
            console.error("Error handling WhatsApp message with agent:", error);

            // Send error message to user
            try {
                const errorMessage = "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.";
                await whatsappClient.sendMessage(message.from, errorMessage);

                // Add error message to chat history
                await addMessageToHistory(message.from, "assistant", errorMessage);
            } catch (sendError) {
                console.error("Error sending error message:", sendError);
            }
        }
    }
}

// Export a singleton instance
export const agentWebhookController = new AgentWebhookController(); 
