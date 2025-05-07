import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './supabase.types';

interface SupabaseConfig {
    url: string;
    key: string;
    options?: {
        auth?: {
            autoRefreshToken?: boolean;
            persistSession?: boolean;
        };
        global?: {
            headers?: Record<string, string>;
        };
    };
}

export class SupabaseConnection {
    private static instance: SupabaseConnection;
    private client: SupabaseClient<Database>;

    private constructor(config: SupabaseConfig) {
        this.client = createClient<Database>(
            config.url,
            config.key,
            config.options
        );
    }

    public static getInstance(config?: SupabaseConfig): SupabaseConnection {
        if (!SupabaseConnection.instance) {
            if (!config) {
                const url = process.env.SUPABASE_URL;
                const key = process.env.SUPABASE_KEY;

                if (!url || !key) {
                    throw new Error('Supabase URL and key must be provided in environment variables');
                }

                config = { url, key };
            }

            SupabaseConnection.instance = new SupabaseConnection(config);
        }

        return SupabaseConnection.instance;
    }

    public getClient(): SupabaseClient<Database> {
        return this.client;
    }

    public async healthCheck(): Promise<boolean> {
        try {
            const { error } = await this.client.from('channels').select('*').limit(1);
            return !error;
        } catch (error) {
            console.error('Supabase health check failed:', error);
            return false;
        }
    }
} 
