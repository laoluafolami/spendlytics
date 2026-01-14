/*
  # Remove Unused Database Indexes

  ## Overview
  This migration removes unused indexes that are wasting storage space
  and slowing down write operations without providing any query benefits.

  ## Changes
    - Drop all unused indexes identified by the database analysis
    - Keeps primary key indexes and actively used indexes intact

  ## Security Impact
    - Improves write performance
    - Reduces storage overhead
    - No impact on data security or access control
*/

-- Drop unused indexes on profiles table
DROP INDEX IF EXISTS idx_profiles_user_id;

-- Drop unused indexes on categories table
DROP INDEX IF EXISTS idx_categories_user_id;
DROP INDEX IF EXISTS idx_categories_type;

-- Drop unused indexes on expenses table
DROP INDEX IF EXISTS idx_expenses_user_id;
DROP INDEX IF EXISTS idx_expenses_category_id;
DROP INDEX IF EXISTS idx_expenses_category;
DROP INDEX IF EXISTS idx_expenses_receipt_id;
DROP INDEX IF EXISTS idx_expenses_payment_method;
DROP INDEX IF EXISTS idx_expenses_tags;
DROP INDEX IF EXISTS idx_expenses_is_recurring;

-- Drop unused indexes on income table
DROP INDEX IF EXISTS idx_income_user_id;
DROP INDEX IF EXISTS idx_income_date;
DROP INDEX IF EXISTS idx_income_category_fkey;

-- Drop unused indexes on receipts table
DROP INDEX IF EXISTS idx_receipts_user_id;

-- Drop unused indexes on budgets table
DROP INDEX IF EXISTS idx_budgets_user_id;
DROP INDEX IF EXISTS idx_budgets_category_id;

-- Drop unused indexes on recurring_expenses table
DROP INDEX IF EXISTS idx_recurring_expenses_user_id;
DROP INDEX IF EXISTS idx_recurring_expenses_next_due_date;
DROP INDEX IF EXISTS idx_recurring_expenses_category_fkey;

-- Drop unused indexes on recurring_transactions table
DROP INDEX IF EXISTS idx_recurring_transactions_user_fkey;

-- Drop unused indexes on tags table
DROP INDEX IF EXISTS idx_tags_user_id;

-- Drop unused indexes on savings_goals table
DROP INDEX IF EXISTS idx_savings_goals_user_id;

-- Drop unused indexes on notifications table
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_notifications_is_read;

-- Drop unused indexes on expense_tags table
DROP INDEX IF EXISTS idx_expense_tags_tag_id;

-- Drop unused indexes on app_income table
DROP INDEX IF EXISTS idx_app_income_date;
DROP INDEX IF EXISTS idx_app_income_category;

-- Drop unused indexes on app_budgets table
DROP INDEX IF EXISTS idx_app_budgets_category_month_year;