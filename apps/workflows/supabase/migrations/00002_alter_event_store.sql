-- Add new columns to the existing event_store table
ALTER TABLE event_store 
  ADD COLUMN IF NOT EXISTS job_id VARCHAR,
  ADD COLUMN IF NOT EXISTS workflow_id VARCHAR,
  ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'processed';

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_event_store_job_id ON event_store(job_id);
CREATE INDEX IF NOT EXISTS idx_event_store_workflow_id ON event_store(workflow_id);
CREATE INDEX IF NOT EXISTS idx_event_store_status ON event_store(status); 
