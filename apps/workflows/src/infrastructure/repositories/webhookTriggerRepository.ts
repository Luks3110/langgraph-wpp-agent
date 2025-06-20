import { SupabaseConnection } from '../database/supabase.js';
import { Database } from '../database/supabase.types.js';

export type WebhookTrigger = Database['public']['Tables']['webhook_triggers']['Row'];
export type WebhookTriggerInsert = Database['public']['Tables']['webhook_triggers']['Insert'];
export type WebhookTriggerUpdate = Database['public']['Tables']['webhook_triggers']['Update'];

export interface WebhookTriggerRepository {
    createTrigger(trigger: WebhookTriggerInsert): Promise<WebhookTrigger>;
    getTrigger(triggerId: string): Promise<WebhookTrigger | null>;
    getTriggerByPath(webhookPath: string): Promise<WebhookTrigger | null>;
    getTriggersByWorkflow(workflowId: string): Promise<WebhookTrigger[]>;
    updateTrigger(triggerId: string, updates: WebhookTriggerUpdate): Promise<WebhookTrigger>;
    deleteTrigger(triggerId: string): Promise<void>;
    listTriggers(tenantId?: string): Promise<WebhookTrigger[]>;
}

export class SupabaseWebhookTriggerRepository implements WebhookTriggerRepository {
    constructor(private supabase: SupabaseConnection) {}

    /**
     * Create a new webhook trigger
     */
    async createTrigger(trigger: WebhookTriggerInsert): Promise<WebhookTrigger> {
        const { data, error } = await this.supabase
            .getClient()
            .from('webhook_triggers')
            .insert(trigger)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create webhook trigger: ${error.message}`);
        }

        return data;
    }

    /**
     * Get a webhook trigger by ID
     */
    async getTrigger(triggerId: string): Promise<WebhookTrigger | null> {
        const { data, error } = await this.supabase
            .getClient()
            .from('webhook_triggers')
            .select('*')
            .eq('id', triggerId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            throw new Error(`Failed to get webhook trigger: ${error.message}`);
        }

        return data;
    }

    /**
     * Get a webhook trigger by webhook path
     */
    async getTriggerByPath(webhookPath: string): Promise<WebhookTrigger | null> {
        const { data, error } = await this.supabase
            .getClient()
            .from('webhook_triggers')
            .select('*')
            .eq('webhook_path', webhookPath)
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Not found
            }
            throw new Error(`Failed to get webhook trigger by path: ${error.message}`);
        }

        return data;
    }

    /**
     * Get webhook triggers by workflow ID
     */
    async getTriggersByWorkflow(workflowId: string): Promise<WebhookTrigger[]> {
        const { data, error } = await this.supabase
            .getClient()
            .from('webhook_triggers')
            .select('*')
            .eq('workflow_id', workflowId)
            .order('created_at', { ascending: true });

        if (error) {
            throw new Error(`Failed to get webhook triggers by workflow: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Update a webhook trigger
     */
    async updateTrigger(triggerId: string, updates: WebhookTriggerUpdate): Promise<WebhookTrigger> {
        const { data, error } = await this.supabase
            .getClient()
            .from('webhook_triggers')
            .update(updates)
            .eq('id', triggerId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update webhook trigger: ${error.message}`);
        }

        return data;
    }

    /**
     * Delete a webhook trigger
     */
    async deleteTrigger(triggerId: string): Promise<void> {
        const { error } = await this.supabase
            .getClient()
            .from('webhook_triggers')
            .delete()
            .eq('id', triggerId);

        if (error) {
            throw new Error(`Failed to delete webhook trigger: ${error.message}`);
        }
    }

    /**
     * List webhook triggers
     */
    async listTriggers(tenantId?: string): Promise<WebhookTrigger[]> {
        let query = this.supabase
            .getClient()
            .from('webhook_triggers')
            .select('*');

        if (tenantId) {
            query = query.eq('tenant_id', tenantId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to list webhook triggers: ${error.message}`);
        }

        return data || [];
    }
}