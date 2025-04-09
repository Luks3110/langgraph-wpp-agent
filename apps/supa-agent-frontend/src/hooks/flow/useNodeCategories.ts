import { NodeCategory } from '@/utils/flow-types';
import { useMemo } from 'react';

export function useNodeCategories() {
    // Define categories and their nodes
    const nodeCategories = useMemo<NodeCategory[]>(() => [
        {
            title: "TRIGGERS",
            nodes: [
                {
                    type: "webhook",
                    label: "Webhook",
                    description: "Receive data from external services",
                    icon: "code",
                    color: "blue",
                },
                {
                    type: "whatsapp",
                    label: "WhatsApp",
                    description: "Receive messages from WhatsApp",
                    icon: "messageSquare",
                    color: "blue",
                },
                {
                    type: "instagram",
                    label: "Instagram",
                    description: "Receive messages from Instagram",
                    icon: "instagram",
                    color: "purple",
                },
                {
                    type: "whatsapp",
                    label: "Schedule",
                    description: "Trigger flow at scheduled times",
                    icon: "clock",
                    color: "blue",
                },
            ],
        },
        {
            title: "LOGIC",
            nodes: [
                {
                    type: "character",
                    label: "Condition",
                    description: "Branch based on conditions",
                    icon: "gitMerge",
                    color: "purple",
                },
                {
                    type: "character",
                    label: "Filter",
                    description: "Filter data based on criteria",
                    icon: "filter",
                    color: "purple",
                },
            ],
        },
        {
            title: "AI",
            nodes: [
                {
                    type: "knowledge",
                    label: "Knowledge Base",
                    description: "Query your knowledge base",
                    icon: "database",
                    color: "green",
                },
                {
                    type: "mercadolivreQa",
                    label: "AI Response",
                    description: "Generate AI powered responses",
                    icon: "sparkles",
                    color: "green",
                },
            ],
        },
        {
            title: "ACTIONS",
            nodes: [
                {
                    type: "whatsapp",
                    label: "Send Message",
                    description: "Send messages to users",
                    icon: "send",
                    color: "amber",
                },
            ],
        },
        {
            title: "INTEGRATIONS",
            nodes: [
                {
                    type: "instagram",
                    label: "Instagram",
                    description: "Instagram messaging integration",
                    icon: "instagram",
                    color: "purple",
                },
                {
                    type: "webhook",
                    label: "Webhook",
                    description: "Send data to external services",
                    icon: "webhook",
                    color: "blue",
                },
            ],
        },
    ], []);

    return { nodeCategories };
} 
