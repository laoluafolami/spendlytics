/*
  # Fix Security and Performance Issues
  
  This migration addresses critical security and performance issues identified in the database audit:
  
  1. **Foreign Key Indexes**
     - Add covering indexes for all foreign key columns that don't have them
     - Improves join performance and prevents table scans
  
  2. **RLS Policy Optimization**
     - Update all RLS policies to use `(select auth.uid())` instead of `auth.uid()`
     - Prevents re-evaluation of auth functions for each row
     - Significantly improves query performance at scale
  
  3. **Security Fixes**
     - Remove dangerous "Allow all operations" policy that bypasses RLS
     - Ensures proper row-level security is enforced
  
  4. **Function Security**
     - Fix search_path for functions to prevent SQL injection risks
*/

-- ============================================================================
-- PART 1: Add Missing Foreign Key Indexes
-- ============================================================================

-- expense_tags table
CREATE INDEX IF NOT EXISTS idx_expense_tags_tag_id ON public.expense_tags(tag_id);

-- expenses table  
CREATE INDEX IF NOT EXISTS idx_expenses_receipt_id ON public.expenses(receipt_id);

-- income table
CREATE INDEX IF NOT EXISTS idx_income_category_fkey ON public.income(category_id);

-- recurring_expenses table
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_category_fkey ON public.recurring_expenses(category_id);

-- recurring_transactions table
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_user_fkey ON public.recurring_transactions(user_id);

-- ============================================================================
-- PART 2: Remove Dangerous RLS Policy
-- ============================================================================

-- Remove the policy that allows unrestricted access
DROP POLICY IF EXISTS "Allow all operations on expenses" ON public.expenses;

-- ============================================================================
-- PART 3: Optimize RLS Policies - Profiles
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- PART 4: Optimize RLS Policies - Categories
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

CREATE POLICY "Users can view own categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own categories"
  ON public.categories FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own categories"
  ON public.categories FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own categories"
  ON public.categories FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- PART 5: Optimize RLS Policies - Expenses
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;

CREATE POLICY "Users can view own expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own expenses"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own expenses"
  ON public.expenses FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own expenses"
  ON public.expenses FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- PART 6: Optimize RLS Policies - Receipts
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can insert own receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can update own receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can delete own receipts" ON public.receipts;

CREATE POLICY "Users can view own receipts"
  ON public.receipts FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own receipts"
  ON public.receipts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own receipts"
  ON public.receipts FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own receipts"
  ON public.receipts FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- PART 7: Optimize RLS Policies - Income
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own income" ON public.income;
DROP POLICY IF EXISTS "Users can insert own income" ON public.income;
DROP POLICY IF EXISTS "Users can update own income" ON public.income;
DROP POLICY IF EXISTS "Users can delete own income" ON public.income;

CREATE POLICY "Users can view own income"
  ON public.income FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own income"
  ON public.income FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own income"
  ON public.income FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own income"
  ON public.income FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- PART 8: Optimize RLS Policies - Budgets
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budgets;

CREATE POLICY "Users can view own budgets"
  ON public.budgets FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own budgets"
  ON public.budgets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own budgets"
  ON public.budgets FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own budgets"
  ON public.budgets FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- PART 9: Optimize RLS Policies - Recurring Expenses
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own recurring expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Users can insert own recurring expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Users can update own recurring expenses" ON public.recurring_expenses;
DROP POLICY IF EXISTS "Users can delete own recurring expenses" ON public.recurring_expenses;

CREATE POLICY "Users can view own recurring expenses"
  ON public.recurring_expenses FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own recurring expenses"
  ON public.recurring_expenses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own recurring expenses"
  ON public.recurring_expenses FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own recurring expenses"
  ON public.recurring_expenses FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- PART 10: Optimize RLS Policies - Tags
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can insert own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can update own tags" ON public.tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON public.tags;

CREATE POLICY "Users can view own tags"
  ON public.tags FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own tags"
  ON public.tags FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own tags"
  ON public.tags FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own tags"
  ON public.tags FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- PART 11: Optimize RLS Policies - Expense Tags
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own expense tags" ON public.expense_tags;
DROP POLICY IF EXISTS "Users can insert own expense tags" ON public.expense_tags;
DROP POLICY IF EXISTS "Users can delete own expense tags" ON public.expense_tags;

CREATE POLICY "Users can view own expense tags"
  ON public.expense_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE expenses.id = expense_tags.expense_id
      AND expenses.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert own expense tags"
  ON public.expense_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE expenses.id = expense_tags.expense_id
      AND expenses.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete own expense tags"
  ON public.expense_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses
      WHERE expenses.id = expense_tags.expense_id
      AND expenses.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- PART 12: Optimize RLS Policies - Savings Goals
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can insert own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can update own savings goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can delete own savings goals" ON public.savings_goals;

CREATE POLICY "Users can view own savings goals"
  ON public.savings_goals FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own savings goals"
  ON public.savings_goals FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own savings goals"
  ON public.savings_goals FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own savings goals"
  ON public.savings_goals FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- PART 13: Optimize RLS Policies - Notifications
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- PART 14: Optimize RLS Policies - Recurring Transactions
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own recurring transactions" ON public.recurring_transactions;
DROP POLICY IF EXISTS "Users can create own recurring transactions" ON public.recurring_transactions;
DROP POLICY IF EXISTS "Users can update own recurring transactions" ON public.recurring_transactions;
DROP POLICY IF EXISTS "Users can delete own recurring transactions" ON public.recurring_transactions;

CREATE POLICY "Users can view own recurring transactions"
  ON public.recurring_transactions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can create own recurring transactions"
  ON public.recurring_transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own recurring transactions"
  ON public.recurring_transactions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own recurring transactions"
  ON public.recurring_transactions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- PART 15: Fix Function Search Paths
-- ============================================================================

-- Recreate create_default_categories function with secure search_path
CREATE OR REPLACE FUNCTION public.create_default_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (user_id, name, icon, color, type, is_default)
  VALUES
    (NEW.id, 'Food & Dining', '🍔', '#ef4444', 'expense', true),
    (NEW.id, 'Transportation', '🚗', '#f59e0b', 'expense', true),
    (NEW.id, 'Shopping', '🛍️', '#ec4899', 'expense', true),
    (NEW.id, 'Entertainment', '🎬', '#8b5cf6', 'expense', true),
    (NEW.id, 'Bills & Utilities', '💡', '#06b6d4', 'expense', true),
    (NEW.id, 'Healthcare', '⚕️', '#10b981', 'expense', true),
    (NEW.id, 'Salary', '💰', '#22c55e', 'income', true),
    (NEW.id, 'Business', '💼', '#3b82f6', 'income', true);
  
  RETURN NEW;
END;
$$;

-- Recreate update_updated_at_column function with secure search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
