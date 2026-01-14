/*
  # Add Enhanced Expense Tracker Features (Simple Version)

  ## Overview
  This migration adds enhanced features to the simple expense tracker app
  that works without authentication (anonymous access).

  ## New Tables
  
  ### 1. app_budgets
    - `id` (uuid, primary key)
    - `category` (text) - expense category
    - `amount` (numeric) - budget limit amount
    - `budget_month` (integer) - month (1-12)
    - `budget_year` (integer) - year
    - `created_at`, `updated_at` (timestamptz)
  
  ### 2. app_income
    - `id` (uuid, primary key)
    - `description` (text) - income description
    - `amount` (numeric) - income amount
    - `category` (text) - income category
    - `date` (date) - income date
    - `created_at` (timestamptz)
  
  ### 3. app_savings_goals
    - `id` (uuid, primary key)
    - `name` (text) - goal name
    - `target_amount` (numeric) - target amount
    - `current_amount` (numeric) - current saved amount
    - `deadline` (date) - target date
    - `created_at`, `updated_at` (timestamptz)
  
  ### 4. app_filter_presets
    - `id` (uuid, primary key)
    - `name` (text) - preset name
    - `filters` (jsonb) - filter configuration
    - `created_at` (timestamptz)
  
  ### 5. app_settings
    - `id` (uuid, primary key, only one row)
    - Feature toggle flags for each enhanced feature
    - `created_at`, `updated_at` (timestamptz)
  
  ## Modifications to Existing Tables
  
  ### expenses table additions
    - `payment_method` (text) - payment method used
    - `tags` (text array) - tags for organization
    - `receipt_url` (text) - URL to receipt image
    - `is_recurring` (boolean) - whether expense is recurring
    - `recurrence_frequency` (text) - frequency of recurrence
    - `recurrence_end_date` (date) - when to stop recurring

  ## Security
    - Enable RLS on all new tables
    - Add policies for anonymous access (consistent with existing expenses table)
    
  ## Notes
    - Tables prefixed with 'app_' to avoid conflicts with existing schema
    - All tables allow anonymous access (no authentication required)
    - Single-user application design
*/

-- Add new columns to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurrence_frequency text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurrence_end_date date;

-- Create app_budgets table
CREATE TABLE IF NOT EXISTS app_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  amount numeric NOT NULL,
  budget_month integer NOT NULL,
  budget_year integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon access to app_budgets"
  ON app_budgets
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_app_budgets_category_month_year 
  ON app_budgets(category, budget_month, budget_year);

-- Create app_income table
CREATE TABLE IF NOT EXISTS app_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric NOT NULL,
  category text NOT NULL DEFAULT 'other',
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon access to app_income"
  ON app_income
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_app_income_date ON app_income(date);
CREATE INDEX IF NOT EXISTS idx_app_income_category ON app_income(category);

-- Create app_savings_goals table
CREATE TABLE IF NOT EXISTS app_savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_amount numeric NOT NULL,
  current_amount numeric DEFAULT 0,
  deadline date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon access to app_savings_goals"
  ON app_savings_goals
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create app_filter_presets table
CREATE TABLE IF NOT EXISTS app_filter_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  filters jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon access to app_filter_presets"
  ON app_filter_presets
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create app_settings table (single row for app-wide settings)
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_budgets boolean DEFAULT true,
  feature_income boolean DEFAULT true,
  feature_payment_methods boolean DEFAULT true,
  feature_tags boolean DEFAULT true,
  feature_receipts boolean DEFAULT false,
  feature_recurring boolean DEFAULT true,
  feature_advanced_filters boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon access to app_settings"
  ON app_settings
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method ON expenses(payment_method);
CREATE INDEX IF NOT EXISTS idx_expenses_tags ON expenses USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_expenses_is_recurring ON expenses(is_recurring);

-- Insert default settings if none exist
INSERT INTO app_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM app_settings LIMIT 1);