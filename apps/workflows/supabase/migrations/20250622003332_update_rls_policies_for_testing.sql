-- Update RLS policies to allow workflow engine operations
-- This migration updates the RLS policies to allow the workflow engine to operate

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view executions of their workflows" ON workflow_executions;
DROP POLICY IF EXISTS "Users can manage triggers for their workflows" ON workflow_triggers;
DROP POLICY IF EXISTS "Users can view execution steps for their workflows" ON execution_steps;

-- Create more permissive policies for the workflow engine
-- Allow all operations on workflow_executions for now (can be tightened later)
CREATE POLICY "Allow workflow engine operations on executions" ON workflow_executions
  FOR ALL USING (true);

-- Allow all operations on workflow_triggers
CREATE POLICY "Allow workflow engine operations on triggers" ON workflow_triggers
  FOR ALL USING (true);

-- Allow all operations on execution_steps
CREATE POLICY "Allow workflow engine operations on steps" ON execution_steps
  FOR ALL USING (true);

-- Also allow insert operations specifically
CREATE POLICY "Allow workflow engine inserts on executions" ON workflow_executions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow workflow engine inserts on triggers" ON workflow_triggers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow workflow engine inserts on steps" ON execution_steps
  FOR INSERT WITH CHECK (true);

-- For production, you would want to create more specific policies like:
-- CREATE POLICY "Service role can manage all workflow data" ON workflow_executions
--   FOR ALL TO service_role USING (true);
-- 
-- And use the service role key for the workflow engine operations
