// Database schema types
export interface Database {
    public: {
        Tables: {
            // ... existing tables ...
            scheduled_events: {
                Row: {
                    id: string
                    workflowId: string
                    nodeId: string
                    clientId: string
                    data: Json
                    schedule: Json | null
                    lastRun: string | null
                    nextRun: string | null
                    status: string
                    metadata: Json | null
                    createdAt: string
                    updatedAt: string
                }
                Insert: {
                    id?: string
                    workflowId: string
                    nodeId: string
                    clientId: string
                    data: Json
                    schedule?: Json | null
                    lastRun?: string | null
                    nextRun?: string | null
                    status?: string
                    metadata?: Json | null
                    createdAt?: string
                    updatedAt?: string
                }
                Update: {
                    id?: string
                    workflowId?: string
                    nodeId?: string
                    clientId?: string
                    data?: Json
                    schedule?: Json | null
                    lastRun?: string | null
                    nextRun?: string | null
                    status?: string
                    metadata?: Json | null
                    createdAt?: string
                    updatedAt?: string
                }
            }
            // ... existing code ...
        }
        // ... existing code ...
    }
    // ... existing code ...
} 
