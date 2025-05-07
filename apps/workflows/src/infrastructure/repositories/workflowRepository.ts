import { SupabaseRepository } from '../database/repository';
import { SupabaseConnection } from '../database/supabase';

export interface WorkflowEntity {
    id: string;
    name: string;
    description?: string;
    nodes: WorkflowNodeEntity[];
    edges: WorkflowEdgeEntity[];
    tenant_id: string;
    version: number;
    created_at: string;
    updated_at: string;
    tags?: string[];
    status: 'draft' | 'published' | 'archived';
}

export interface WorkflowNodeEntity {
    id: string;
    type: string;
    name: string;
    config?: Record<string, any>;
    position?: { x: number; y: number };
}

export interface WorkflowEdgeEntity {
    source: string;
    target: string;
    condition?: string;
}

export class WorkflowRepository extends SupabaseRepository<WorkflowEntity> {
    constructor(connection?: SupabaseConnection) {
        super('workflows', connection);
    }

    async findByTenantId(tenantId: string): Promise<WorkflowEntity[]> {
        return this.findAll({ tenant_id: tenantId });
    }

    async findByStatus(status: WorkflowEntity['status']): Promise<WorkflowEntity[]> {
        return this.findAll({ status });
    }

    async findByTags(tags: string[]): Promise<WorkflowEntity[]> {
        const { data, error } = await this.client
            .from(this.tableName)
            .select('*')
            .contains('tags', tags);

        if (error) {
            throw new Error(`Failed to find workflows by tags: ${error.message}`);
        }

        return data as WorkflowEntity[];
    }

    async publishWorkflow(id: string): Promise<WorkflowEntity | null> {
        const currentWorkflow = await this.findById(id);
        if (!currentWorkflow) {
            return null;
        }

        return this.update(id, {
            status: 'published',
            version: currentWorkflow.version + 1
        });
    }

    async archiveWorkflow(id: string): Promise<WorkflowEntity | null> {
        return this.update(id, { status: 'archived' });
    }
} 
