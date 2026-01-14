/*
  # Restore Anonymous Access for Simple Expense Tracker

  This migration restores the ability for the simple expense tracker to work without authentication.
  
  ## Context
  The expenses table (created in 20260114125656_create_expenses_table.sql) was designed as a 
  simple expense tracker without authentication or user_id. The previous security migration 
  removed the "Allow all operations" policy, which broke the app's ability to add expenses.
  
  ## Changes
  1. Add back policy for anonymous (anon) users to access the simple expenses table
  2. This only applies to the basic expenses table without user_id
  3. The authenticated user policies remain in place for other tables (profiles, categories, etc.)
  
  ## Note
  The simple expenses table is different from the full expense tracking schema. It's designed
  for demo/personal use without authentication.
*/

-- Add policy to allow anonymous users to access the simple expenses table
CREATE POLICY "Allow anon access to simple expenses"
  ON public.expenses
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
