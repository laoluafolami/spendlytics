-- SPENDLYTICS DATABASE SETUP
-- Run this entire script in Supabase SQL Editor

-- 1. Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  amount decimal(10, 2) NOT NULL,
  category text NOT NULL,
  description text DEFAULT '',
  date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'Cash',
  tags text[] DEFAULT '{}',
  receipt_url text,
  is_recurring boolean DEFAULT false,
  recurrence_frequency text,
  recurrence_end_date date,
  session_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 2. Create app_budgets table
CREATE TABLE IF NOT EXISTS app_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  category text NOT NULL,
  amount numeric NOT NULL,
  budget_month integer NOT NULL,
  budget_year integer NOT NULL,
  session_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_budgets ENABLE ROW LEVEL SECURITY;

-- 3. Create app_income table
CREATE TABLE IF NOT EXISTS app_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  description text NOT NULL,
  amount numeric NOT NULL,
  category text NOT NULL DEFAULT 'other',
  date date NOT NULL DEFAULT CURRENT_DATE,
  session_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_income ENABLE ROW LEVEL SECURITY;

-- 4. Create app_savings_goals table
CREATE TABLE IF NOT EXISTS app_savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  target_amount numeric NOT NULL,
  current_amount numeric DEFAULT 0,
  deadline date,
  session_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_savings_goals ENABLE ROW LEVEL SECURITY;

-- 5. Create app_filter_presets table
CREATE TABLE IF NOT EXISTS app_filter_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  filters jsonb NOT NULL,
  session_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_filter_presets ENABLE ROW LEVEL SECURITY;

-- 6. Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  feature_budgets boolean DEFAULT true,
  feature_income boolean DEFAULT true,
  feature_payment_methods boolean DEFAULT true,
  feature_tags boolean DEFAULT true,
  feature_receipts boolean DEFAULT false,
  feature_recurring boolean DEFAULT true,
  feature_advanced_filters boolean DEFAULT true,
  feature_budget_alerts boolean DEFAULT true,
  feature_savings_goals boolean DEFAULT true,
  feature_reports boolean DEFAULT true,
  feature_spending_trends boolean DEFAULT true,
  feature_notifications boolean DEFAULT false,
  feature_unusual_spending boolean DEFAULT true,
  feature_tax_reports boolean DEFAULT false,
  feature_date_range_filter boolean DEFAULT true,
  feature_amount_range_filter boolean DEFAULT true,
  feature_saved_filters boolean DEFAULT true,
  feature_import_csv boolean DEFAULT false,
  feature_auto_categorize boolean DEFAULT false,
  feature_export_excel boolean DEFAULT true,
  feature_auto_backup boolean DEFAULT false,
  feature_bill_reminders boolean DEFAULT true,
  feature_custom_categories boolean DEFAULT false,
  feature_multi_currency boolean DEFAULT false,
  feature_exchange_rates boolean DEFAULT false,
  session_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for expenses (authenticated users)
DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;

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

-- 8. RLS Policies for app_budgets
CREATE POLICY "Users can view own budgets"
  ON app_budgets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets"
  ON app_budgets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets"
  ON app_budgets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets"
  ON app_budgets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 9. RLS Policies for app_income
CREATE POLICY "Users can view own income"
  ON app_income FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own income"
  ON app_income FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own income"
  ON app_income FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own income"
  ON app_income FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 10. RLS Policies for app_savings_goals
CREATE POLICY "Users can view own savings_goals"
  ON app_savings_goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own savings_goals"
  ON app_savings_goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own savings_goals"
  ON app_savings_goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own savings_goals"
  ON app_savings_goals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 11. RLS Policies for app_filter_presets
CREATE POLICY "Users can view own filter_presets"
  ON app_filter_presets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own filter_presets"
  ON app_filter_presets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own filter_presets"
  ON app_filter_presets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own filter_presets"
  ON app_filter_presets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 12. RLS Policies for app_settings
CREATE POLICY "Users can view own settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON app_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Done! Your database is ready.
