import { SupabaseConnection } from '../database/supabase.js';

export interface WebhookData {
    id: string;
    tenant_id: string;
    provider: string;
    endpoint: string;
    node_id: string;
    workflow_id: string;
    created_at: string;
    updated_at: string;
    last_triggered_at?: string;
    is_active: boolean;
    secret?: string;
}

export class WebhookRepository {
    private supabaseConnection: SupabaseConnection;

    constructor(supabaseConnection: SupabaseConnection) {
        this.supabaseConnection = supabaseConnection;
    }

    /**
     * Get webhook by ID
     */
    async getWebhookById(webhookId: string): Promise<WebhookData | null> {
        try {
            const { data, error } = await this.supabaseConnection.getClient()
                .from('webhooks')
                .select('*')
                .eq('id', webhookId)
                .single();

            if (error) {
                console.error(`Error retrieving webhook ${webhookId}:`, error);
                return null;
            }

            return data as WebhookData;
        } catch (error) {
            console.error(`Error retrieving webhook ${webhookId}:`, error);
            return null;
        }
    }

    /**
     * Update webhook last triggered timestamp
     */
    async updateLastTriggeredAt(webhookId: string): Promise<void> {
        try {
            await this.supabaseConnection.getClient()
                .from('webhooks')
                .update({
                    last_triggered_at: new Date().toISOString()
                })
                .eq('id', webhookId);
        } catch (error) {
            console.error(`Error updating webhook ${webhookId} last triggered timestamp:`, error);
        }
    }

    /**
     * Get all active webhooks for a tenant
     */
    async getActiveWebhooksByTenant(tenantId: string): Promise<WebhookData[]> {
        try {
            const { data, error } = await this.supabaseConnection.getClient()
                .from('webhooks')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('is_active', true);

            if (error) {
                console.error(`Error retrieving webhooks for tenant ${tenantId}:`, error);
                return [];
            }

            return data as WebhookData[];
        } catch (error) {
            console.error(`Error retrieving webhooks for tenant ${tenantId}:`, error);
            return [];
        }
    }

    /**
     * Get webhooks by node ID
     */
    async getWebhooksByNodeId(nodeId: string): Promise<WebhookData[]> {
        try {
            const { data, error } = await this.supabaseConnection.getClient()
                .from('webhooks')
                .select('*')
                .eq('node_id', nodeId);

            if (error) {
                console.error(`Error retrieving webhooks for node ${nodeId}:`, error);
                return [];
            }

            return data as WebhookData[];
        } catch (error) {
            console.error(`Error retrieving webhooks for node ${nodeId}:`, error);
            return [];
        }
    }

    /**
     * Create a new webhook
     */
    async createWebhook(webhook: Omit<WebhookData, 'id' | 'created_at' | 'updated_at'>): Promise<WebhookData | null> {
        try {
            const { data, error } = await this.supabaseConnection.getClient()
                .from('webhooks')
                .insert({
                    ...webhook,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating webhook:', error);
                return null;
            }

            return data as WebhookData;
        } catch (error) {
            console.error('Error creating webhook:', error);
            return null;
        }
    }

    /**
     * Update webhook
     */
    async updateWebhook(webhookId: string, updates: Partial<WebhookData>): Promise<WebhookData | null> {
        try {
            // Ensure we don't update id, created_at
            const { id, created_at, ...validUpdates } = updates as any;

            const { data, error } = await this.supabaseConnection.getClient()
                .from('webhooks')
                .update({
                    ...validUpdates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', webhookId)
                .select()
                .single();

            if (error) {
                console.error(`Error updating webhook ${webhookId}:`, error);
                return null;
            }

            return data as WebhookData;
        } catch (error) {
            console.error(`Error updating webhook ${webhookId}:`, error);
            return null;
        }
    }

    /**
     * Delete webhook
     */
    async deleteWebhook(webhookId: string): Promise<boolean> {
        try {
            const { error } = await this.supabaseConnection.getClient()
                .from('webhooks')
                .delete()
                .eq('id', webhookId);

            if (error) {
                console.error(`Error deleting webhook ${webhookId}:`, error);
                return false;
            }

            return true;
        } catch (error) {
            console.error(`Error deleting webhook ${webhookId}:`, error);
            return false;
        }
    }
} 
