/**
 * Webhook provider types supported by the system
 */
export enum WebhookProviderType {
    WHATSAPP = 'WHATSAPP',
    INSTAGRAM = 'INSTAGRAM',
    FACEBOOK = 'FACEBOOK',
    TWITTER = 'TWITTER',
    SLACK = 'SLACK',
    CUSTOM = 'CUSTOM'
}

/**
 * Metadata about the webhook trigger
 */
export interface WebhookTriggerMetadata {
    source: string;
    sourceType: string;
    actionType?: string;
    customerId?: string;
    clientId?: string;
    receivedAt: string;
    headers: Record<string, string>;
}

/**
 * Normalized webhook event payload
 */
export interface NormalizedWebhookPayload {
    eventType: string;
    customerId: string;
    timestamp: number;
    provider: WebhookProviderType;
    data: Record<string, any>;
    rawPayload: any;
    metadata?: Record<string, any>;
}

/**
 * Challenge response interface
 */
export interface ChallengeResponse {
    isChallenge: boolean;
    response?: string | Record<string, any>;
}

/**
 * Base interface for webhook provider adapters
 */
export interface BaseWebhookProviderAdapter {
    /**
     * Normalize the webhook payload into a standard format
     */
    normalizePayload(
        payload: any,
        headers: Record<string, string>,
        clientId: string
    ): Promise<NormalizedWebhookPayload>;

    /**
     * Verify the webhook signature
     */
    verifySignature(
        payload: any,
        headers: Record<string, string>,
        secret: string
    ): Promise<boolean>;

    /**
     * Handle verification challenges from the provider
     */
    handleChallenge(
        payload: any,
        headers: Record<string, string>
    ): Promise<ChallengeResponse>;
}

/**
 * Abstract base class for webhook provider adapters
 */
export abstract class BaseWebhookProviderAdapterImpl implements BaseWebhookProviderAdapter {
    abstract normalizePayload(
        payload: any,
        headers: Record<string, string>,
        clientId: string
    ): Promise<NormalizedWebhookPayload>;

    abstract verifySignature(
        payload: any,
        headers: Record<string, string>,
        secret: string
    ): Promise<boolean>;

    abstract handleChallenge(
        payload: any,
        headers: Record<string, string>
    ): Promise<ChallengeResponse>;

    /**
     * Extract metadata from headers
     */
    protected extractMetadataFromHeaders(headers: Record<string, string>): Record<string, any> {
        const metadata: Record<string, any> = {};

        // Common headers to extract
        const headersToExtract = [
            'user-agent',
            'content-type',
            'x-forwarded-for',
            'x-request-id'
        ];

        for (const header of headersToExtract) {
            if (headers[header]) {
                metadata[header] = headers[header];
            }
        }

        return metadata;
    }
}

/**
 * Factory for creating webhook provider adapters
 */
export class WebhookProviderAdapterFactory {
    private adapters: Map<WebhookProviderType, BaseWebhookProviderAdapter>;

    constructor() {
        this.adapters = new Map();
    }

    /**
     * Register a specific adapter
     */
    public registerAdapter(type: WebhookProviderType, adapter: BaseWebhookProviderAdapter): void {
        this.adapters.set(type, adapter);
    }

    /**
     * Get an adapter for a specific provider type
     */
    public getAdapter(type: WebhookProviderType): BaseWebhookProviderAdapter | undefined {
        return this.adapters.get(type);
    }
} 
