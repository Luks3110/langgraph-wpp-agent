import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConnection } from './supabase';
import { Database, TablesInsert } from './supabase.types';

export interface Repository<T> {
    create(data: TablesInsert<TableName>): Promise<T>;
    findById(id: string): Promise<T | null>;
    findAll(filter?: Partial<T>): Promise<T[]>;
    update(id: string, data: Partial<T>): Promise<T | null>;
    delete(id: string): Promise<boolean>;
}

type TableName = keyof Database['public']['Tables']

export abstract class SupabaseRepository<T> implements Repository<T> {
    protected client: SupabaseClient<Database>;
    protected tableName: TableName;

    constructor(tableName: TableName, connection?: SupabaseConnection) {
        this.tableName = tableName;
        this.client = connection
            ? connection.getClient()
            : SupabaseConnection.getInstance().getClient();
    }

    async create(data: TablesInsert<TableName>): Promise<T> {
        const { data: result, error } = await this.client
            .from(this.tableName)
            .insert(data)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create record in ${this.tableName}: ${error.message}`);
        }

        return result as T;
    }

    async findById(id: string): Promise<T | null> {
        const { data, error } = await this.client
            .from(this.tableName)
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Record not found
            }
            throw new Error(`Failed to find record in ${this.tableName}: ${error.message}`);
        }

        return data as T;
    }

    async findAll(filter?: Partial<T>): Promise<T[]> {
        let query = this.client
            .from(this.tableName)
            .select('*');

        if (filter) {
            Object.entries(filter).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    query = query.eq(key, value);
                }
            });
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Failed to find records in ${this.tableName}: ${error.message}`);
        }

        return data as T[];
    }

    async update(id: string, data: Partial<T>): Promise<T | null> {
        const { data: result, error } = await this.client
            .from(this.tableName)
            .update(data)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // Record not found
            }
            throw new Error(`Failed to update record in ${this.tableName}: ${error.message}`);
        }

        return result as T;
    }

    async delete(id: string): Promise<boolean> {
        const { error } = await this.client
            .from(this.tableName)
            .delete()
            .eq('id', id);

        if (error) {
            if (error.code === 'PGRST116') {
                return false; // Record not found
            }
            throw new Error(`Failed to delete record in ${this.tableName}: ${error.message}`);
        }

        return true;
    }
} 
