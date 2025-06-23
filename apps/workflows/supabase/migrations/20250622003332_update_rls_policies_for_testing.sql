-- Update RLS policies to enforce user-based access control
-- This migration replaces the permissive testing policies with proper security

-- Drop ALL existing policies to avoid conflicts
DO $$ 
DECLARE
    pol record;
BEGIN
    -- Drop all policies on workflow_executions
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'workflow_executions' LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON workflow_executions';
    END LOOP;
    
    -- Drop all policies on workflow_triggers
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'workflow_triggers' LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON workflow_triggers';
    END LOOP;
    
    -- Drop all policies on execution_steps
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'execution_steps' LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON execution_steps';
    END LOOP;
    
    -- Drop all policies on workflows
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'workflows' LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON workflows';
    END LOOP;
END $$;

-- Create proper user-based policies for workflows table
-- First, ensure RLS is enabled on workflows
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- Create comprehensive workflow policies
CREATE POLICY "Users can view their own workflows" ON workflows
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create workflows" ON workflows
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own workflows" ON workflows
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own workflows" ON workflows
  FOR DELETE USING (created_by = auth.uid());

-- Service role can read workflows for system operations (webhook triggers, queue processing)
CREATE POLICY "Service role can read workflows" ON workflows
  FOR SELECT TO service_role USING (true);

-- Create user-based policies for workflow_executions
CREATE POLICY "Users can view executions of their workflows" ON workflow_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workflows 
      WHERE workflows.id = workflow_executions.workflow_id 
      AND workflows.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create executions for their workflows" ON workflow_executions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflows 
      WHERE workflows.id = workflow_executions.workflow_id 
      AND workflows.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update executions of their workflows" ON workflow_executions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workflows 
      WHERE workflows.id = workflow_executions.workflow_id 
      AND workflows.created_by = auth.uid()
    )
  );

-- Service role can manage executions for system operations (queue processing)
CREATE POLICY "Service role can manage executions" ON workflow_executions
  FOR ALL TO service_role USING (true);

-- Create user-based policies for workflow_triggers
CREATE POLICY "Users can manage triggers for their workflows" ON workflow_triggers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workflows 
      WHERE workflows.id = workflow_triggers.workflow_id 
      AND workflows.created_by = auth.uid()
    )
  );

-- Service role can read triggers for webhook operations
CREATE POLICY "Service role can read triggers" ON workflow_triggers
  FOR SELECT TO service_role USING (true);

-- Create user-based policies for execution_steps
CREATE POLICY "Users can view execution steps for their workflows" ON execution_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workflow_executions we
      JOIN workflows w ON w.id = we.workflow_id
      WHERE we.id = execution_steps.execution_id 
      AND w.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create execution steps for their workflows" ON execution_steps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflow_executions we
      JOIN workflows w ON w.id = we.workflow_id
      WHERE we.id = execution_steps.execution_id 
      AND w.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update execution steps for their workflows" ON execution_steps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM workflow_executions we
      JOIN workflows w ON w.id = we.workflow_id
      WHERE we.id = execution_steps.execution_id 
      AND w.created_by = auth.uid()
    )
  );

-- Service role can manage execution steps for system operations
CREATE POLICY "Service role can manage execution steps" ON execution_steps
  FOR ALL TO service_role USING (true);

-- Note: For production webhook triggers, you may need a service role policy
-- to allow the webhook service to trigger workflows without user context:
-- 
-- CREATE POLICY "Service role can execute workflows" ON workflow_executions
--   FOR INSERT TO service_role WITH CHECK (true);
-- 
-- And use the service role key for webhook executions
