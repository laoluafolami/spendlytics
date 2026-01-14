/*
  # Add Authenticated User Access to App Tables

  This migration adds RLS policies to allow authenticated users to access
  app_budgets, app_income, and app_savings_goals tables.

  ## Changes Made
  
  ### RLS Policies Added
  - **app_budgets**: Added SELECT, INSERT, UPDATE, DELETE policies for authenticated users
  - **app_income**: Added SELECT, INSERT, UPDATE, DELETE policies for authenticated users  
  - **app_savings_goals**: Added SELECT, INSERT, UPDATE, DELETE policies for authenticated users

  ## Security Notes
  - Authenticated users can now perform all CRUD operations on these tables
  - Policies use `true` condition to allow access (session-based isolation)
  - Anonymous users still have access via existing policies
*/

-- Add authenticated user policies for app_budgets
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_budgets' 
    AND policyname = 'Authenticated users can view app_budgets'
  ) THEN
    CREATE POLICY "Authenticated users can view app_budgets"
      ON app_budgets FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_budgets' 
    AND policyname = 'Authenticated users can insert app_budgets'
  ) THEN
    CREATE POLICY "Authenticated users can insert app_budgets"
      ON app_budgets FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_budgets' 
    AND policyname = 'Authenticated users can update app_budgets'
  ) THEN
    CREATE POLICY "Authenticated users can update app_budgets"
      ON app_budgets FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_budgets' 
    AND policyname = 'Authenticated users can delete app_budgets'
  ) THEN
    CREATE POLICY "Authenticated users can delete app_budgets"
      ON app_budgets FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Add authenticated user policies for app_income
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_income' 
    AND policyname = 'Authenticated users can view app_income'
  ) THEN
    CREATE POLICY "Authenticated users can view app_income"
      ON app_income FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_income' 
    AND policyname = 'Authenticated users can insert app_income'
  ) THEN
    CREATE POLICY "Authenticated users can insert app_income"
      ON app_income FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_income' 
    AND policyname = 'Authenticated users can update app_income'
  ) THEN
    CREATE POLICY "Authenticated users can update app_income"
      ON app_income FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_income' 
    AND policyname = 'Authenticated users can delete app_income'
  ) THEN
    CREATE POLICY "Authenticated users can delete app_income"
      ON app_income FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Add authenticated user policies for app_savings_goals
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_savings_goals' 
    AND policyname = 'Authenticated users can view app_savings_goals'
  ) THEN
    CREATE POLICY "Authenticated users can view app_savings_goals"
      ON app_savings_goals FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_savings_goals' 
    AND policyname = 'Authenticated users can insert app_savings_goals'
  ) THEN
    CREATE POLICY "Authenticated users can insert app_savings_goals"
      ON app_savings_goals FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_savings_goals' 
    AND policyname = 'Authenticated users can update app_savings_goals'
  ) THEN
    CREATE POLICY "Authenticated users can update app_savings_goals"
      ON app_savings_goals FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_savings_goals' 
    AND policyname = 'Authenticated users can delete app_savings_goals'
  ) THEN
    CREATE POLICY "Authenticated users can delete app_savings_goals"
      ON app_savings_goals FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
