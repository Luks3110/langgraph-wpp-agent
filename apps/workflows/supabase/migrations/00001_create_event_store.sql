-- Create event store table for persistent event storage only if it doesn't exist
CREATE TABLE IF NOT EXISTS event_store (
  id UUID PRIMARY KEY,
  event_type VARCHAR NOT NULL,
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  sequence_number BIGINT NOT NULL,
  job_id VARCHAR,
  workflow_id VARCHAR,
  status VARCHAR DEFAULT 'processed'
);

-- Create indexes (these are idempotent with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_event_store_tenant_id ON event_store(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_store_event_type ON event_store(event_type);
CREATE INDEX IF NOT EXISTS idx_event_store_timestamp ON event_store(timestamp);
CREATE INDEX IF NOT EXISTS idx_event_store_sequence ON event_store(sequence_number);
CREATE INDEX IF NOT EXISTS idx_event_store_job_id ON event_store(job_id);
CREATE INDEX IF NOT EXISTS idx_event_store_workflow_id ON event_store(workflow_id);
CREATE INDEX IF NOT EXISTS idx_event_store_status ON event_store(status); 
