-- ============================================================================
-- Spendlytics Finance Tables Migration
-- Created: 2026-01-22
--
-- This migration creates tables for:
-- 1. assets - Track user assets (cash, investments, property, etc.)
-- 2. liabilities - Track user debts (loans, credit cards, etc.)
-- 3. investments - Track investment portfolio (stocks, crypto, ETFs)
-- 4. net_worth_snapshots - Historical net worth tracking
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTION: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- TABLE: assets
-- Description: Tracks all user assets for balance sheet
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Asset details
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'cash', 'bank_account', 'investment', 'stocks', 'bonds',
        'mutual_funds', 'real_estate', 'vehicle', 'retirement',
        'business', 'collectible', 'other'
    )),
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'liquid', 'marketable', 'long_term', 'personal'
    )),

    -- Valuation
    value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    purchase_date DATE,
    purchase_price DECIMAL(15, 2),

    -- Metadata
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for assets
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_active ON public.assets(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(user_id, category);
CREATE INDEX IF NOT EXISTS idx_assets_type ON public.assets(user_id, type);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_assets_updated_at ON public.assets;
CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON public.assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: liabilities
-- Description: Tracks all user debts and liabilities
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.liabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Liability details
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'credit_card', 'personal_loan', 'mortgage', 'car_loan',
        'student_loan', 'business_loan', 'family_loan', 'other'
    )),

    -- Amounts
    principal_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    current_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',

    -- Payment details
    interest_rate DECIMAL(5, 2),  -- Annual interest rate %
    minimum_payment DECIMAL(15, 2),
    due_date INTEGER CHECK (due_date >= 1 AND due_date <= 31),  -- Day of month

    -- Metadata
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for liabilities
CREATE INDEX IF NOT EXISTS idx_liabilities_user_id ON public.liabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_user_active ON public.liabilities(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_liabilities_type ON public.liabilities(user_id, type);
CREATE INDEX IF NOT EXISTS idx_liabilities_due_date ON public.liabilities(user_id, due_date);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_liabilities_updated_at ON public.liabilities;
CREATE TRIGGER update_liabilities_updated_at
    BEFORE UPDATE ON public.liabilities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: investments
-- Description: Tracks investment portfolio holdings
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Investment identity
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'stock', 'etf', 'mutual_fund', 'bond', 'crypto',
        'reit', 'commodity', 'other'
    )),

    -- Holdings
    shares DECIMAL(18, 8) NOT NULL DEFAULT 0,  -- Supports crypto fractional shares
    average_cost DECIMAL(15, 4) NOT NULL DEFAULT 0,
    current_price DECIMAL(15, 4) NOT NULL DEFAULT 0,

    -- Calculated values (stored for performance)
    market_value DECIMAL(15, 2) GENERATED ALWAYS AS (shares * current_price) STORED,
    cost_basis DECIMAL(15, 2) GENERATED ALWAYS AS (shares * average_cost) STORED,
    gain_loss DECIMAL(15, 2) GENERATED ALWAYS AS ((shares * current_price) - (shares * average_cost)) STORED,
    gain_loss_percent DECIMAL(10, 4) GENERATED ALWAYS AS (
        CASE
            WHEN (shares * average_cost) > 0
            THEN (((shares * current_price) - (shares * average_cost)) / (shares * average_cost)) * 100
            ELSE 0
        END
    ) STORED,

    -- Additional info
    purchase_date DATE,
    dividend_yield DECIMAL(5, 2),  -- Annual dividend yield %
    last_dividend DECIMAL(15, 4),
    sector VARCHAR(100),
    currency VARCHAR(3) DEFAULT 'NGN',

    -- Metadata
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for investments
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_active ON public.investments(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_investments_symbol ON public.investments(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_investments_type ON public.investments(user_id, type);
CREATE INDEX IF NOT EXISTS idx_investments_sector ON public.investments(user_id, sector);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_investments_updated_at ON public.investments;
CREATE TRIGGER update_investments_updated_at
    BEFORE UPDATE ON public.investments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: net_worth_snapshots
-- Description: Historical net worth tracking for charts/trends
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.net_worth_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Snapshot data
    date DATE NOT NULL,
    total_assets DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_liabilities DECIMAL(15, 2) NOT NULL DEFAULT 0,
    net_worth DECIMAL(15, 2) GENERATED ALWAYS AS (total_assets - total_liabilities) STORED,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure one snapshot per user per date
    CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- Indexes for net_worth_snapshots
CREATE INDEX IF NOT EXISTS idx_net_worth_user_id ON public.net_worth_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_net_worth_date ON public.net_worth_snapshots(user_id, date DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.net_worth_snapshots ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ASSETS POLICIES
-- ============================================================================

-- Users can view their own assets
DROP POLICY IF EXISTS "Users can view own assets" ON public.assets;
CREATE POLICY "Users can view own assets"
    ON public.assets FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own assets
DROP POLICY IF EXISTS "Users can insert own assets" ON public.assets;
CREATE POLICY "Users can insert own assets"
    ON public.assets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own assets
DROP POLICY IF EXISTS "Users can update own assets" ON public.assets;
CREATE POLICY "Users can update own assets"
    ON public.assets FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own assets
DROP POLICY IF EXISTS "Users can delete own assets" ON public.assets;
CREATE POLICY "Users can delete own assets"
    ON public.assets FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- LIABILITIES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own liabilities" ON public.liabilities;
CREATE POLICY "Users can view own liabilities"
    ON public.liabilities FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own liabilities" ON public.liabilities;
CREATE POLICY "Users can insert own liabilities"
    ON public.liabilities FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own liabilities" ON public.liabilities;
CREATE POLICY "Users can update own liabilities"
    ON public.liabilities FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own liabilities" ON public.liabilities;
CREATE POLICY "Users can delete own liabilities"
    ON public.liabilities FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- INVESTMENTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own investments" ON public.investments;
CREATE POLICY "Users can view own investments"
    ON public.investments FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own investments" ON public.investments;
CREATE POLICY "Users can insert own investments"
    ON public.investments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own investments" ON public.investments;
CREATE POLICY "Users can update own investments"
    ON public.investments FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own investments" ON public.investments;
CREATE POLICY "Users can delete own investments"
    ON public.investments FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- NET WORTH SNAPSHOTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own net worth snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users can view own net worth snapshots"
    ON public.net_worth_snapshots FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own net worth snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users can insert own net worth snapshots"
    ON public.net_worth_snapshots FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own net worth snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users can update own net worth snapshots"
    ON public.net_worth_snapshots FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own net worth snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users can delete own net worth snapshots"
    ON public.net_worth_snapshots FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate total assets for a user
CREATE OR REPLACE FUNCTION get_total_assets(p_user_id UUID)
RETURNS DECIMAL(15, 2) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(value) FROM public.assets WHERE user_id = p_user_id AND is_active = true),
        0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate total liabilities for a user
CREATE OR REPLACE FUNCTION get_total_liabilities(p_user_id UUID)
RETURNS DECIMAL(15, 2) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(current_balance) FROM public.liabilities WHERE user_id = p_user_id AND is_active = true),
        0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate total investment value for a user
CREATE OR REPLACE FUNCTION get_total_investments(p_user_id UUID)
RETURNS DECIMAL(15, 2) AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(market_value) FROM public.investments WHERE user_id = p_user_id AND is_active = true),
        0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate net worth for a user
CREATE OR REPLACE FUNCTION get_net_worth(p_user_id UUID)
RETURNS DECIMAL(15, 2) AS $$
DECLARE
    v_assets DECIMAL(15, 2);
    v_liabilities DECIMAL(15, 2);
BEGIN
    v_assets := get_total_assets(p_user_id);
    v_liabilities := get_total_liabilities(p_user_id);
    RETURN v_assets - v_liabilities;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a net worth snapshot
CREATE OR REPLACE FUNCTION create_net_worth_snapshot(p_user_id UUID, p_currency VARCHAR(3) DEFAULT 'NGN')
RETURNS UUID AS $$
DECLARE
    v_snapshot_id UUID;
    v_assets DECIMAL(15, 2);
    v_liabilities DECIMAL(15, 2);
BEGIN
    v_assets := get_total_assets(p_user_id);
    v_liabilities := get_total_liabilities(p_user_id);

    INSERT INTO public.net_worth_snapshots (user_id, date, total_assets, total_liabilities, currency)
    VALUES (p_user_id, CURRENT_DATE, v_assets, v_liabilities, p_currency)
    ON CONFLICT (user_id, date)
    DO UPDATE SET
        total_assets = EXCLUDED.total_assets,
        total_liabilities = EXCLUDED.total_liabilities
    RETURNING id INTO v_snapshot_id;

    RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant table permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.liabilities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.net_worth_snapshots TO authenticated;

-- Grant function execution
GRANT EXECUTE ON FUNCTION get_total_assets(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_total_liabilities(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_total_investments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_net_worth(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_net_worth_snapshot(UUID, VARCHAR) TO authenticated;

-- ============================================================================
-- SAMPLE DATA (Optional - Comment out in production)
-- ============================================================================

-- Uncomment below to insert sample data for testing
/*
-- Sample assets
INSERT INTO public.assets (user_id, name, type, category, value, currency, notes)
SELECT
    auth.uid(),
    'Emergency Fund',
    'bank_account',
    'liquid',
    500000,
    'NGN',
    'GTBank savings account'
WHERE auth.uid() IS NOT NULL;

-- Sample liability
INSERT INTO public.liabilities (user_id, name, type, principal_amount, current_balance, interest_rate, minimum_payment, due_date, currency)
SELECT
    auth.uid(),
    'Credit Card',
    'credit_card',
    100000,
    75000,
    24.5,
    15000,
    25,
    'NGN'
WHERE auth.uid() IS NOT NULL;

-- Sample investment
INSERT INTO public.investments (user_id, symbol, name, type, shares, average_cost, current_price, sector, currency)
SELECT
    auth.uid(),
    'AAPL',
    'Apple Inc.',
    'stock',
    10,
    150.00,
    185.00,
    'Technology',
    'USD'
WHERE auth.uid() IS NOT NULL;
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE public.assets IS 'User assets for balance sheet tracking';
COMMENT ON TABLE public.liabilities IS 'User debts and liabilities';
COMMENT ON TABLE public.investments IS 'Investment portfolio holdings with real-time price updates';
COMMENT ON TABLE public.net_worth_snapshots IS 'Historical net worth snapshots for trend analysis';
