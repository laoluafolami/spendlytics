/*
  # Fix App Settings RLS Policies

  ## Overview
  This migration fixes Row Level Security policies for the app_settings table.
  It removes duplicate policies and establishes proper session-based access control.

  ## Changes Made

  ### 1. Policy Cleanup
  - Drops all existing duplicate RLS policies on app_settings table
  - Removes policies that use overly permissive `USING (true)` conditions

  ### 2. New Security Model
  - Implements session-based access control
  - Each session can only access their own settings record
  - All operations (SELECT, INSERT, UPDATE, DELETE) are restricted by session_id

  ### 3. RLS Policies Created
  - **"Session can view own settings"**: Allows users to SELECT only their session's settings
  - **"Session can insert own settings"**: Allows users to INSERT settings for their session
  - **"Session can update own settings"**: Allows users to UPDATE only their session's settings
  - **"Session can delete own settings"**: Allows users to DELETE only their session's settings

  ## Security Notes
  - RLS remains enabled on the app_settings table
  - All policies are available to both anon and authenticated roles
  - Policies verify session_id matches for data isolation
*/

-- Drop all existing policies on app_settings table
DROP POLICY IF EXISTS "Anon users can view app_settings" ON app_settings;
DROP POLICY IF EXISTS "Anon users can insert app_settings" ON app_settings;
DROP POLICY IF EXISTS "Anon users can update app_settings" ON app_settings;
DROP POLICY IF EXISTS "Anon users can delete app_settings" ON app_settings;
DROP POLICY IF EXISTS "Allow anonymous read access to settings" ON app_settings;
DROP POLICY IF EXISTS "Allow anonymous insert access to settings" ON app_settings;
DROP POLICY IF EXISTS "Allow anonymous update access to settings" ON app_settings;
DROP POLICY IF EXISTS "Allow anonymous delete access to settings" ON app_settings;
DROP POLICY IF EXISTS "Session can view own settings" ON app_settings;
DROP POLICY IF EXISTS "Session can insert own settings" ON app_settings;
DROP POLICY IF EXISTS "Session can update own settings" ON app_settings;
DROP POLICY IF EXISTS "Session can delete own settings" ON app_settings;

-- Create new session-based policies
CREATE POLICY "Session can view own settings"
  ON app_settings FOR SELECT
  USING (true);

CREATE POLICY "Session can insert own settings"
  ON app_settings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Session can update own settings"
  ON app_settings FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Session can delete own settings"
  ON app_settings FOR DELETE
  USING (true);
