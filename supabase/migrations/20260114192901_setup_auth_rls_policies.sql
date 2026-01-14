/*
  # Setup Authentication RLS Policies

  ## Overview
  This migration sets up proper Row Level Security (RLS) policies for authenticated users.
  It removes the old anonymous access policies and establishes secure authenticated-only access.

  ## Changes Made

  ### 1. Policy Cleanup
  - Drops all existing RLS policies on the expenses table
  - Removes outdated anonymous and session-based access policies

  ### 2. New Security Model
  - Implements authenticated user-based access control
  - Each user can only access their own expense records
  - All operations (SELECT, INSERT, UPDATE, DELETE) are restricted by user_id

  ### 3. RLS Policies Created
  - **"Users can view own expenses"**: Allows authenticated users to SELECT only their expenses
  - **"Users can insert own expenses"**: Allows authenticated users to INSERT expenses with their user_id
  - **"Users can update own expenses"**: Allows authenticated users to UPDATE only their expenses
  - **"Users can delete own expenses"**: Allows authenticated users to DELETE only their expenses

  ## Security Notes
  - RLS remains enabled on the expenses table
  - All policies require authentication (TO authenticated)
  - Policies verify user_id matches auth.uid() for data isolation
  - No anonymous access is allowed
*/

-- Drop all existing policies on expenses table
DROP POLICY IF EXISTS "Anon users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Anon users can insert expenses" ON expenses;
DROP POLICY IF EXISTS "Anon users can update expenses" ON expenses;
DROP POLICY IF EXISTS "Anon users can delete expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;
DROP POLICY IF EXISTS "Allow anonymous read access to expenses" ON expenses;
DROP POLICY IF EXISTS "Allow anonymous insert access to expenses" ON expenses;
DROP POLICY IF EXISTS "Allow anonymous update access to expenses" ON expenses;
DROP POLICY IF EXISTS "Allow anonymous delete access to expenses" ON expenses;

-- Create new authenticated-only policies
CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
