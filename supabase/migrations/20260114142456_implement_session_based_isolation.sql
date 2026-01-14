/*
  # Implement Session-Based Data Isolation

  ## Overview
  This migration implements session-based data isolation to fix the security
  vulnerability where anonymous users could access all data in the database.
  
  With this change, each browser session gets a unique session ID, and users
  can only access data associated with their session ID.

  ## Security Improvements
    1. Data Isolation - Users can only see their own data
    2. Anonymous Support - Still allows anonymous usage without authentication
    3. Secure RLS - Replaces permissive "USING (true)" policies with session checks

  ## Changes
    1. Add session_id column to all tables that store user data
    2. Create index on session_id for query performance
    3. Update RLS policies to filter by session_id
    4. Remove overly permissive policies that allowed unrestricted access

  ## Tables Modified
    - expenses
    - app_settings
    - app_budgets
    - app_income
    - app_savings_goals
    - app_filter_presets

  ## Important Notes
    - Existing data will have NULL session_id (needs client-side migration)
    - Client code must generate and include session_id in all queries
*/

-- Add session_id column to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS session_id text;
CREATE INDEX IF NOT EXISTS idx_expenses_session_id ON expenses(session_id);

-- Add session_id column to app_settings table
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS session_id text;
CREATE INDEX IF NOT EXISTS idx_app_settings_session_id ON app_settings(session_id);

-- Add session_id column to app_budgets table
ALTER TABLE app_budgets ADD COLUMN IF NOT EXISTS session_id text;
CREATE INDEX IF NOT EXISTS idx_app_budgets_session_id ON app_budgets(session_id);

-- Add session_id column to app_income table
ALTER TABLE app_income ADD COLUMN IF NOT EXISTS session_id text;
CREATE INDEX IF NOT EXISTS idx_app_income_session_id ON app_income(session_id);

-- Add session_id column to app_savings_goals table
ALTER TABLE app_savings_goals ADD COLUMN IF NOT EXISTS session_id text;
CREATE INDEX IF NOT EXISTS idx_app_savings_goals_session_id ON app_savings_goals(session_id);

-- Add session_id column to app_filter_presets table
ALTER TABLE app_filter_presets ADD COLUMN IF NOT EXISTS session_id text;
CREATE INDEX IF NOT EXISTS idx_app_filter_presets_session_id ON app_filter_presets(session_id);

-- Drop old insecure policies
DROP POLICY IF EXISTS "Allow anon access to simple expenses" ON expenses;
DROP POLICY IF EXISTS "Allow anon access to app_settings" ON app_settings;
DROP POLICY IF EXISTS "Allow anon access to app_budgets" ON app_budgets;
DROP POLICY IF EXISTS "Allow anon access to app_income" ON app_income;
DROP POLICY IF EXISTS "Allow anon access to app_savings_goals" ON app_savings_goals;
DROP POLICY IF EXISTS "Allow anon access to app_filter_presets" ON app_filter_presets;

-- Create secure session-based policies for expenses
CREATE POLICY "Users can view own session expenses"
  ON expenses
  FOR SELECT
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can insert own session expenses"
  ON expenses
  FOR INSERT
  TO anon
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can update own session expenses"
  ON expenses
  FOR UPDATE
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id')
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can delete own session expenses"
  ON expenses
  FOR DELETE
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

-- Create secure session-based policies for app_settings
CREATE POLICY "Users can view own session settings"
  ON app_settings
  FOR SELECT
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can insert own session settings"
  ON app_settings
  FOR INSERT
  TO anon
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can update own session settings"
  ON app_settings
  FOR UPDATE
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id')
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can delete own session settings"
  ON app_settings
  FOR DELETE
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

-- Create secure session-based policies for app_budgets
CREATE POLICY "Users can view own session budgets"
  ON app_budgets
  FOR SELECT
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can insert own session budgets"
  ON app_budgets
  FOR INSERT
  TO anon
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can update own session budgets"
  ON app_budgets
  FOR UPDATE
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id')
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can delete own session budgets"
  ON app_budgets
  FOR DELETE
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

-- Create secure session-based policies for app_income
CREATE POLICY "Users can view own session income"
  ON app_income
  FOR SELECT
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can insert own session income"
  ON app_income
  FOR INSERT
  TO anon
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can update own session income"
  ON app_income
  FOR UPDATE
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id')
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can delete own session income"
  ON app_income
  FOR DELETE
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

-- Create secure session-based policies for app_savings_goals
CREATE POLICY "Users can view own session savings goals"
  ON app_savings_goals
  FOR SELECT
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can insert own session savings goals"
  ON app_savings_goals
  FOR INSERT
  TO anon
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can update own session savings goals"
  ON app_savings_goals
  FOR UPDATE
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id')
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can delete own session savings goals"
  ON app_savings_goals
  FOR DELETE
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

-- Create secure session-based policies for app_filter_presets
CREATE POLICY "Users can view own session filter presets"
  ON app_filter_presets
  FOR SELECT
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can insert own session filter presets"
  ON app_filter_presets
  FOR INSERT
  TO anon
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can update own session filter presets"
  ON app_filter_presets
  FOR UPDATE
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id')
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id');

CREATE POLICY "Users can delete own session filter presets"
  ON app_filter_presets
  FOR DELETE
  TO anon
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id');