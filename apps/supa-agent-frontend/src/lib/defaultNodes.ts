import { CharacterNode, DeploymentNode, KnowledgeNode, TestingNode } from "@/utils/flow-types";
import { InstagramNodeData, MercadoLivreQANodeData, NodeType, WebhookNodeData, WhatsAppNodeData } from "./workflowGraph";

export type NodeDataMapping = {
    character: CharacterNode['data'];
    knowledge: KnowledgeNode['data'];
    testing: TestingNode['data'];
    deployment: DeploymentNode['data'];
    mercadolivreQa: MercadoLivreQANodeData;
    whatsapp: WhatsAppNodeData;
    instagram: InstagramNodeData;
    webhook: WebhookNodeData;
    custom: Record<string, any>;
    decision: Record<string, any>;
    delay: Record<string, any>;
    function: Record<string, any>;
    http: Record<string, any>;
    transformation: Record<string, any>;
    trigger: Record<string, any>;
}

export type TypedNode<T extends NodeType> = {
    type: T;
    data: NodeDataMapping[T];
}

export const defaultNodes: {
    [K in NodeType]?: TypedNode<K>
} = {
    character: {
        type: "character",
        data: { name: "New Character", personality: "Default" },
    },
    knowledge: {
        type: "knowledge",
        data: { domain: "General", sources: "None" },
    },
    testing: {
        type: "testing",
        data: { testCases: "0", status: "Not started" },
    },
    deployment: {
        type: "deployment",
        data: { environment: "Development", status: "Not deployed" },
    },
    mercadolivreQa: {
        type: "mercadolivreQa",
        data: {
            apiConfigured: false,
            rulesCount: 0,
            defaultResponseSet: false,
            responseDelay: "Immediate",
        },
    },
    whatsapp: {
        type: "whatsapp",
        data: {
            apiConfigured: false,
            phoneNumberConfigured: false,
            messageTemplatesCount: 0,
            autoReplyEnabled: false,
            responseDelay: "Immediate",
        },
    },
    instagram: {
        type: "instagram",
        data: {
            name: "Instagram Integration",
            apiConfigured: false,
            accessToken: "",
            igBusinessId: "",
            webhookVerifyToken: "",
            webhookSecret: "",
            messageEvents: [],
            reactionEvents: false,
            postbackEvents: false,
            seenEvents: false,
            referralEvents: false,
        },
    },
    webhook: {
        type: "webhook",
        data: {
            name: "Webhook Integration",
            url: "",
            method: "POST",
            headers: {},
            payload: "",
            timeout: 30,
            retryCount: 3,
        },
    },
}
