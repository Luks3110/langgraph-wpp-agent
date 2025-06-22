-- Fix workflows table structure for workflow engine
-- This migration modifies the existing workflows table to match our requirements

-- First, let's see what columns exist and add missing ones
DO $$ 
BEGIN
    -- Add definition column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'workflows' AND column_name = 'definition') THEN
        ALTER TABLE workflows ADD COLUMN definition JSONB;
    END IF;
    
    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'workflows' AND column_name = 'created_by') THEN
        ALTER TABLE workflows ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
    
    -- Add version column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'workflows' AND column_name = 'version') THEN
        ALTER TABLE workflows ADD COLUMN version INTEGER DEFAULT 1;
    END IF;
    
    -- Modify status column to have proper constraints if needed
    BEGIN
        ALTER TABLE workflows DROP CONSTRAINT IF EXISTS workflows_status_check;
        ALTER TABLE workflows ADD CONSTRAINT workflows_status_check 
            CHECK (status IN ('active', 'inactive', 'archived'));
    EXCEPTION
        WHEN duplicate_object THEN
            -- Constraint already exists, skip
            NULL;
    END;
END $$;

-- Ensure the definition column is NOT NULL (set default for existing rows)
UPDATE workflows SET definition = '{"id":"","name":"","version":1,"trigger":{"name":"","displayName":"","type":"TRIGGER","triggerType":"manual","settings":{}},"steps":{}}' 
WHERE definition IS NULL;

ALTER TABLE workflows ALTER COLUMN definition SET NOT NULL;

-- Create the missing tables if they don't exist
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  execution_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  trigger_payload JSONB,
  step_results JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('webhook', 'schedule', 'manual')),
  webhook_url TEXT,
  webhook_secret TEXT,
  schedule_cron TEXT,
  settings JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('trigger', 'action')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_execution_id ON workflow_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_at ON workflow_executions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_triggers_workflow_id ON workflow_triggers(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_webhook_url ON workflow_triggers(webhook_url);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_trigger_type ON workflow_triggers(trigger_type);

CREATE INDEX IF NOT EXISTS idx_execution_steps_execution_id ON execution_steps(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_steps_status ON execution_steps(status);
CREATE INDEX IF NOT EXISTS idx_execution_steps_created_at ON execution_steps(created_at);

-- Enable RLS on new tables
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_steps ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for the new tables (skip workflows as it may already have policies)
DO $$
BEGIN
    -- Policies for workflow_executions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view executions of their workflows' AND tablename = 'workflow_executions') THEN
        CREATE POLICY "Users can view executions of their workflows" ON workflow_executions
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM workflows 
              WHERE workflows.id = workflow_executions.workflow_id 
              AND (workflows.created_by = auth.uid() OR workflows.created_by IS NULL)
            )
          );
    END IF;
    
    -- Policies for workflow_triggers
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage triggers for their workflows' AND tablename = 'workflow_triggers') THEN
        CREATE POLICY "Users can manage triggers for their workflows" ON workflow_triggers
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM workflows 
              WHERE workflows.id = workflow_triggers.workflow_id 
              AND (workflows.created_by = auth.uid() OR workflows.created_by IS NULL)
            )
          );
    END IF;
    
    -- Policies for execution_steps
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view execution steps for their workflows' AND tablename = 'execution_steps') THEN
        CREATE POLICY "Users can view execution steps for their workflows" ON execution_steps
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM workflow_executions we
              JOIN workflows w ON w.id = we.workflow_id
              WHERE we.id = execution_steps.execution_id 
              AND (w.created_by = auth.uid() OR w.created_by IS NULL)
            )
          );
    END IF;
END $$;

-- Create or replace the update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for workflows updated_at if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_workflows_updated_at') THEN
        CREATE TRIGGER update_workflows_updated_at 
          BEFORE UPDATE ON workflows 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
