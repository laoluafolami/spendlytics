/*
  # Add Authenticated User Access to Filter Presets

  This migration adds RLS policies to allow authenticated users to access
  the app_filter_presets table.

  ## Changes Made
  
  ### RLS Policies Added
  - **app_filter_presets**: Added SELECT, INSERT, UPDATE, DELETE policies for authenticated users

  ## Security Notes
  - Authenticated users can now perform all CRUD operations on filter presets
  - Policies use `true` condition to allow access (session-based isolation)
  - Anonymous users still have access via existing policies
*/

-- Add authenticated user policies for app_filter_presets
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_filter_presets' 
    AND policyname = 'Authenticated users can view app_filter_presets'
  ) THEN
    CREATE POLICY "Authenticated users can view app_filter_presets"
      ON app_filter_presets FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_filter_presets' 
    AND policyname = 'Authenticated users can insert app_filter_presets'
  ) THEN
    CREATE POLICY "Authenticated users can insert app_filter_presets"
      ON app_filter_presets FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_filter_presets' 
    AND policyname = 'Authenticated users can update app_filter_presets'
  ) THEN
    CREATE POLICY "Authenticated users can update app_filter_presets"
      ON app_filter_presets FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_filter_presets' 
    AND policyname = 'Authenticated users can delete app_filter_presets'
  ) THEN
    CREATE POLICY "Authenticated users can delete app_filter_presets"
      ON app_filter_presets FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
