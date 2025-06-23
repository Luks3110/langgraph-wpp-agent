-- Fix RLS policies to allow user creation and updates
-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;
DROP POLICY IF EXISTS "Service role can update users" ON public.users;

-- Create policies for users table
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = user_id::uuid);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = user_id::uuid);

-- Allow service role to insert and update users (for triggers and server actions)
CREATE POLICY "Service role can insert users" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update users" ON public.users
    FOR UPDATE USING (true);

-- Create function to handle new user creation in public.users table
-- This function runs with elevated privileges (security definer)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        id,
        user_id,
        email,
        name,
        full_name,
        avatar_url,
        token_identifier,
        created_at
    )
    VALUES (
        NEW.id,
        NEW.id::text,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.email,
        NEW.created_at
    );
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- User already exists, update instead
        UPDATE public.users 
        SET 
            email = NEW.email,
            name = COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
            avatar_url = NEW.raw_user_meta_data->>'avatar_url',
            updated_at = NOW()
        WHERE user_id = NEW.id::text;
        RETURN NEW;
    WHEN OTHERS THEN
        -- Log error but don't fail the auth operation
        RAISE LOG 'Error creating user in public.users: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to automatically create user in public.users when auth user is created
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also handle updates to auth.users (for profile updates)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- First, add INSERT policy for users table to allow trigger-based user creation
DO $$
BEGIN
    -- Check if the INSERT policy for users exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND policyname = 'Allow user creation via trigger'
    ) THEN
        -- Create policy to allow user creation via trigger (SECURITY DEFINER functions)
        EXECUTE 'CREATE POLICY "Allow user creation via trigger" ON public.users
                FOR INSERT WITH CHECK (true)';
    END IF;

    -- Check if the UPDATE policy for users exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND policyname = 'Allow user updates via trigger'
    ) THEN
        -- Create policy to allow user updates via trigger
        EXECUTE 'CREATE POLICY "Allow user updates via trigger" ON public.users
                FOR UPDATE USING (true) WITH CHECK (true)';
    END IF;

    -- Check if the INSERT policy for subscriptions exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'subscriptions' 
        AND policyname = 'Service role can manage subscriptions'
    ) THEN
        -- Create policy for subscriptions to allow service role to create/update subscriptions
        EXECUTE 'CREATE POLICY "Service role can manage subscriptions" ON public.subscriptions
                FOR ALL TO service_role USING (true) WITH CHECK (true)';
    END IF;

    -- Also add a policy to allow users to insert their own subscriptions
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'subscriptions' 
        AND policyname = 'Users can insert own subscriptions'
    ) THEN
        EXECUTE 'CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions
                FOR INSERT WITH CHECK (auth.uid()::text = user_id)';
    END IF;
END
$$;

-- Also make sure the trigger functions have proper security context
-- Re-create the handle_new_user function with proper security
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET
    email = NEW.email,
    name = COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    avatar_url = NEW.raw_user_meta_data->>'avatar_url',
    updated_at = NEW.updated_at
  WHERE user_id = NEW.id::text;
  
  -- If no rows were updated, the user might not exist in public.users
  -- This can happen if the trigger failed previously, so let's insert them
  IF NOT FOUND THEN
    INSERT INTO public.users (
      id,
      user_id,
      email,
      name,
      full_name,
      avatar_url,
      token_identifier,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.id::text,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.email,
      NEW.created_at,
      NEW.updated_at
    );
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error but don't fail the auth process
    RAISE LOG 'Error in handle_user_update: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
