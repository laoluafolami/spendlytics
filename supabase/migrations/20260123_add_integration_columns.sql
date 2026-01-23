-- ============================================================================
-- Integration Columns Migration
-- Created: 2026-01-23
--
-- Adds linking columns to enable cross-module integrations:
-- 1. Income -> Assets: linked_asset_id on app_income
-- 2. Expenses -> Liabilities: linked_liability_id on expenses
-- 3. Savings Goals -> Assets: linked_asset_id on app_savings_goals
-- ============================================================================

-- ============================================================================
-- ADD COLUMNS TO app_income TABLE
-- ============================================================================

-- Add linked_asset_id column (references assets table)
ALTER TABLE public.app_income
ADD COLUMN IF NOT EXISTS linked_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL;

-- Add linked_asset_name for display (denormalized)
ALTER TABLE public.app_income
ADD COLUMN IF NOT EXISTS linked_asset_name VARCHAR(255);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_income_linked_asset
ON public.app_income(linked_asset_id)
WHERE linked_asset_id IS NOT NULL;

-- ============================================================================
-- ADD COLUMNS TO expenses TABLE
-- ============================================================================

-- Add linked_liability_id column (references liabilities table)
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS linked_liability_id UUID REFERENCES public.liabilities(id) ON DELETE SET NULL;

-- Add linked_liability_name for display (denormalized)
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS linked_liability_name VARCHAR(255);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_expenses_linked_liability
ON public.expenses(linked_liability_id)
WHERE linked_liability_id IS NOT NULL;

-- ============================================================================
-- ADD COLUMNS TO app_savings_goals TABLE
-- ============================================================================

-- Add linked_asset_id column (references assets table)
ALTER TABLE public.app_savings_goals
ADD COLUMN IF NOT EXISTS linked_asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL;

-- Add linked_asset_name for display (denormalized)
ALTER TABLE public.app_savings_goals
ADD COLUMN IF NOT EXISTS linked_asset_name VARCHAR(255);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_savings_goals_linked_asset
ON public.app_savings_goals(linked_asset_id)
WHERE linked_asset_id IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.app_income.linked_asset_id IS 'Links income to an asset for automatic balance updates';
COMMENT ON COLUMN public.app_income.linked_asset_name IS 'Denormalized asset name for display purposes';

COMMENT ON COLUMN public.expenses.linked_liability_id IS 'Links expense (debt payment) to a liability for automatic balance reduction';
COMMENT ON COLUMN public.expenses.linked_liability_name IS 'Denormalized liability name for display purposes';

COMMENT ON COLUMN public.app_savings_goals.linked_asset_id IS 'Links savings goal to an asset to track balance as progress';
COMMENT ON COLUMN public.app_savings_goals.linked_asset_name IS 'Denormalized asset name for display purposes';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
