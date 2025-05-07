-- Database schema for workflow engine

-- Scheduled events table
CREATE TABLE IF NOT EXISTS scheduled_events (
    id UUID PRIMARY KEY,
    workflowId UUID NOT NULL REFERENCES workflows(id),
    nodeId VARCHAR(255) NOT NULL,
    clientId VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    schedule JSONB, -- Contains frequency, startTime, endTime, timezone
    lastRun TIMESTAMP,
    nextRun TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'paused', 'completed'
    metadata JSONB,
    createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for efficient querying of due events
CREATE INDEX IF NOT EXISTS idx_scheduled_events_nextrun ON scheduled_events(nextRun) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_scheduled_events_client ON scheduled_events(clientId); 
