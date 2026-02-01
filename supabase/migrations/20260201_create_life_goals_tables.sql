-- ============================================================================
-- Spendlytics Life Goals Tables Migration
-- Created: 2026-02-01
--
-- This migration creates tables for:
-- 1. goal_categories - User-defined goal categories
-- 2. life_goals - Main goals tracking
-- 3. goal_milestones - Milestones for breaking down goals
-- 4. goal_progress_snapshots - Historical progress tracking
-- 5. user_drift_settings - User preferences for drift detection
-- ============================================================================

-- ============================================================================
-- TABLE: goal_categories
-- Description: User-defined categories for organizing life goals
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.goal_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Category details
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) NOT NULL DEFAULT '#3B82F6',  -- Hex color
    icon VARCHAR(50) NOT NULL DEFAULT 'Target',    -- Lucide icon name

    -- Ordering
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure unique category names per user
    CONSTRAINT unique_category_name_per_user UNIQUE (user_id, name)
);

-- Indexes for goal_categories
CREATE INDEX IF NOT EXISTS idx_goal_categories_user_id ON public.goal_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_categories_user_active ON public.goal_categories(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_goal_categories_sort ON public.goal_categories(user_id, sort_order);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_goal_categories_updated_at ON public.goal_categories;
CREATE TRIGGER update_goal_categories_updated_at
    BEFORE UPDATE ON public.goal_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: life_goals
-- Description: Main life goals tracking with flexible target types
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.life_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.goal_categories(id) ON DELETE SET NULL,

    -- Goal details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN (
        'low', 'medium', 'high', 'critical'
    )),
    status VARCHAR(20) NOT NULL DEFAULT 'not_started' CHECK (status IN (
        'not_started', 'in_progress', 'on_track', 'behind', 'completed', 'paused'
    )),

    -- Target configuration
    target_type VARCHAR(20) NOT NULL DEFAULT 'numeric' CHECK (target_type IN (
        'numeric', 'boolean', 'milestone'
    )),
    target_value DECIMAL(18, 2),           -- For numeric goals
    target_unit VARCHAR(50),               -- e.g., "$", "units", "apartments"
    current_value DECIMAL(18, 2) NOT NULL DEFAULT 0,

    -- Auto-linking to tracked metrics (optional)
    linked_metric VARCHAR(50) CHECK (linked_metric IN (
        'net_worth', 'total_assets', 'total_investments', 'passive_income',
        'savings_rate', 'total_income', 'total_real_estate', 'custom', NULL
    )),
    linked_metric_multiplier DECIMAL(10, 4) DEFAULT 1,  -- For custom calculations

    -- Timeline
    start_date DATE,
    target_date DATE,

    -- Additional metadata
    notes TEXT,
    tags TEXT[],  -- Array of tags

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for life_goals
CREATE INDEX IF NOT EXISTS idx_life_goals_user_id ON public.life_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_life_goals_user_active ON public.life_goals(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_life_goals_category ON public.life_goals(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_life_goals_status ON public.life_goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_life_goals_priority ON public.life_goals(user_id, priority);
CREATE INDEX IF NOT EXISTS idx_life_goals_target_date ON public.life_goals(user_id, target_date);
CREATE INDEX IF NOT EXISTS idx_life_goals_linked_metric ON public.life_goals(user_id, linked_metric) WHERE linked_metric IS NOT NULL;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_life_goals_updated_at ON public.life_goals;
CREATE TRIGGER update_life_goals_updated_at
    BEFORE UPDATE ON public.life_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: goal_milestones
-- Description: Milestones for breaking down large goals into smaller steps
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.goal_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES public.life_goals(id) ON DELETE CASCADE,

    -- Milestone details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_value DECIMAL(18, 2),
    target_date DATE,

    -- Completion status
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,

    -- Ordering
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for goal_milestones
CREATE INDEX IF NOT EXISTS idx_goal_milestones_user_id ON public.goal_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal_id ON public.goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_sort ON public.goal_milestones(goal_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_completed ON public.goal_milestones(goal_id, is_completed);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_goal_milestones_updated_at ON public.goal_milestones;
CREATE TRIGGER update_goal_milestones_updated_at
    BEFORE UPDATE ON public.goal_milestones
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: goal_progress_snapshots
-- Description: Historical progress tracking for goals (for charts/trends)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.goal_progress_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_id UUID NOT NULL REFERENCES public.life_goals(id) ON DELETE CASCADE,

    -- Snapshot data
    value DECIMAL(18, 2) NOT NULL,
    date DATE NOT NULL,
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure one snapshot per goal per date
    CONSTRAINT unique_goal_progress_date UNIQUE (goal_id, date)
);

-- Indexes for goal_progress_snapshots
CREATE INDEX IF NOT EXISTS idx_goal_progress_user_id ON public.goal_progress_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal_id ON public.goal_progress_snapshots(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_date ON public.goal_progress_snapshots(goal_id, date DESC);

-- ============================================================================
-- TABLE: user_drift_settings
-- Description: User preferences for drift detection and alerts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_drift_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Drift thresholds (days behind schedule before alerting)
    warning_threshold_days INTEGER NOT NULL DEFAULT 30,
    critical_threshold_days INTEGER NOT NULL DEFAULT 90,

    -- Notification preferences
    enable_drift_alerts BOOLEAN NOT NULL DEFAULT true,
    alert_frequency VARCHAR(20) NOT NULL DEFAULT 'weekly' CHECK (alert_frequency IN (
        'daily', 'weekly', 'monthly'
    )),

    -- Review preferences
    enable_weekly_review BOOLEAN NOT NULL DEFAULT true,
    review_day INTEGER NOT NULL DEFAULT 0 CHECK (review_day >= 0 AND review_day <= 6),  -- 0=Sunday, 6=Saturday

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One settings row per user
    CONSTRAINT unique_user_drift_settings UNIQUE (user_id)
);

-- Indexes for user_drift_settings
CREATE INDEX IF NOT EXISTS idx_drift_settings_user_id ON public.user_drift_settings(user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_user_drift_settings_updated_at ON public.user_drift_settings;
CREATE TRIGGER update_user_drift_settings_updated_at
    BEFORE UPDATE ON public.user_drift_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.goal_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.life_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_progress_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_drift_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- GOAL CATEGORIES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own goal categories" ON public.goal_categories;
CREATE POLICY "Users can view own goal categories"
    ON public.goal_categories FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goal categories" ON public.goal_categories;
CREATE POLICY "Users can insert own goal categories"
    ON public.goal_categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goal categories" ON public.goal_categories;
CREATE POLICY "Users can update own goal categories"
    ON public.goal_categories FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own goal categories" ON public.goal_categories;
CREATE POLICY "Users can delete own goal categories"
    ON public.goal_categories FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- LIFE GOALS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own life goals" ON public.life_goals;
CREATE POLICY "Users can view own life goals"
    ON public.life_goals FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own life goals" ON public.life_goals;
CREATE POLICY "Users can insert own life goals"
    ON public.life_goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own life goals" ON public.life_goals;
CREATE POLICY "Users can update own life goals"
    ON public.life_goals FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own life goals" ON public.life_goals;
CREATE POLICY "Users can delete own life goals"
    ON public.life_goals FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- GOAL MILESTONES POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own goal milestones" ON public.goal_milestones;
CREATE POLICY "Users can view own goal milestones"
    ON public.goal_milestones FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goal milestones" ON public.goal_milestones;
CREATE POLICY "Users can insert own goal milestones"
    ON public.goal_milestones FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goal milestones" ON public.goal_milestones;
CREATE POLICY "Users can update own goal milestones"
    ON public.goal_milestones FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own goal milestones" ON public.goal_milestones;
CREATE POLICY "Users can delete own goal milestones"
    ON public.goal_milestones FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- GOAL PROGRESS SNAPSHOTS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own goal progress" ON public.goal_progress_snapshots;
CREATE POLICY "Users can view own goal progress"
    ON public.goal_progress_snapshots FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goal progress" ON public.goal_progress_snapshots;
CREATE POLICY "Users can insert own goal progress"
    ON public.goal_progress_snapshots FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goal progress" ON public.goal_progress_snapshots;
CREATE POLICY "Users can update own goal progress"
    ON public.goal_progress_snapshots FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own goal progress" ON public.goal_progress_snapshots;
CREATE POLICY "Users can delete own goal progress"
    ON public.goal_progress_snapshots FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- USER DRIFT SETTINGS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own drift settings" ON public.user_drift_settings;
CREATE POLICY "Users can view own drift settings"
    ON public.user_drift_settings FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own drift settings" ON public.user_drift_settings;
CREATE POLICY "Users can insert own drift settings"
    ON public.user_drift_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own drift settings" ON public.user_drift_settings;
CREATE POLICY "Users can update own drift settings"
    ON public.user_drift_settings FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own drift settings" ON public.user_drift_settings;
CREATE POLICY "Users can delete own drift settings"
    ON public.user_drift_settings FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate goal progress percentage
CREATE OR REPLACE FUNCTION calculate_goal_progress(p_goal_id UUID)
RETURNS DECIMAL(5, 2) AS $$
DECLARE
    v_goal RECORD;
    v_progress DECIMAL(5, 2);
BEGIN
    SELECT target_type, target_value, current_value INTO v_goal
    FROM public.life_goals
    WHERE id = p_goal_id;

    IF v_goal IS NULL THEN
        RETURN 0;
    END IF;

    IF v_goal.target_type = 'boolean' THEN
        RETURN CASE WHEN v_goal.current_value >= 100 THEN 100 ELSE 0 END;
    END IF;

    IF v_goal.target_type = 'numeric' AND v_goal.target_value > 0 THEN
        v_progress := (v_goal.current_value / v_goal.target_value) * 100;
        RETURN LEAST(100, GREATEST(0, v_progress));
    END IF;

    RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get goals needing attention (behind schedule)
CREATE OR REPLACE FUNCTION get_goals_needing_attention(p_user_id UUID)
RETURNS TABLE (
    goal_id UUID,
    title VARCHAR(255),
    progress DECIMAL(5, 2),
    days_behind INTEGER,
    drift_level VARCHAR(20)
) AS $$
DECLARE
    v_settings RECORD;
BEGIN
    -- Get user's drift settings
    SELECT warning_threshold_days, critical_threshold_days INTO v_settings
    FROM public.user_drift_settings
    WHERE user_id = p_user_id;

    -- Use defaults if no settings
    IF v_settings IS NULL THEN
        v_settings.warning_threshold_days := 30;
        v_settings.critical_threshold_days := 90;
    END IF;

    RETURN QUERY
    SELECT
        g.id AS goal_id,
        g.title,
        calculate_goal_progress(g.id) AS progress,
        CASE
            WHEN g.target_date IS NOT NULL AND g.start_date IS NOT NULL THEN
                -- Calculate how many days behind based on expected vs actual progress
                GREATEST(0, (
                    -- Expected progress days
                    EXTRACT(EPOCH FROM (CURRENT_DATE - g.start_date)) / 86400 *
                    -- Percentage expected
                    (100::DECIMAL / NULLIF(EXTRACT(EPOCH FROM (g.target_date - g.start_date)) / 86400, 0))
                    -- Minus actual progress percentage
                    - calculate_goal_progress(g.id)
                )::INTEGER)
            ELSE 0
        END AS days_behind,
        CASE
            WHEN g.target_date IS NULL OR g.start_date IS NULL THEN 'none'
            WHEN (
                EXTRACT(EPOCH FROM (CURRENT_DATE - g.start_date)) / 86400 *
                (100::DECIMAL / NULLIF(EXTRACT(EPOCH FROM (g.target_date - g.start_date)) / 86400, 0))
                - calculate_goal_progress(g.id)
            ) >= v_settings.critical_threshold_days THEN 'critical'
            WHEN (
                EXTRACT(EPOCH FROM (CURRENT_DATE - g.start_date)) / 86400 *
                (100::DECIMAL / NULLIF(EXTRACT(EPOCH FROM (g.target_date - g.start_date)) / 86400, 0))
                - calculate_goal_progress(g.id)
            ) >= v_settings.warning_threshold_days THEN 'warning'
            ELSE 'none'
        END AS drift_level
    FROM public.life_goals g
    WHERE g.user_id = p_user_id
      AND g.is_active = true
      AND g.status NOT IN ('completed', 'paused')
      AND g.target_date IS NOT NULL
      AND g.start_date IS NOT NULL
    ORDER BY
        CASE
            WHEN (
                EXTRACT(EPOCH FROM (CURRENT_DATE - g.start_date)) / 86400 *
                (100::DECIMAL / NULLIF(EXTRACT(EPOCH FROM (g.target_date - g.start_date)) / 86400, 0))
                - calculate_goal_progress(g.id)
            ) >= v_settings.critical_threshold_days THEN 1
            WHEN (
                EXTRACT(EPOCH FROM (CURRENT_DATE - g.start_date)) / 86400 *
                (100::DECIMAL / NULLIF(EXTRACT(EPOCH FROM (g.target_date - g.start_date)) / 86400, 0))
                - calculate_goal_progress(g.id)
            ) >= v_settings.warning_threshold_days THEN 2
            ELSE 3
        END,
        g.target_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get goal statistics for a user
CREATE OR REPLACE FUNCTION get_goal_statistics(p_user_id UUID)
RETURNS TABLE (
    total_goals INTEGER,
    completed_goals INTEGER,
    in_progress_goals INTEGER,
    goals_on_track INTEGER,
    goals_behind INTEGER
) AS $$
DECLARE
    v_settings RECORD;
BEGIN
    -- Get user's drift settings
    SELECT warning_threshold_days, critical_threshold_days INTO v_settings
    FROM public.user_drift_settings
    WHERE user_id = p_user_id;

    IF v_settings IS NULL THEN
        v_settings.warning_threshold_days := 30;
        v_settings.critical_threshold_days := 90;
    END IF;

    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER AS total_goals,
        COUNT(*) FILTER (WHERE status = 'completed')::INTEGER AS completed_goals,
        COUNT(*) FILTER (WHERE status IN ('in_progress', 'on_track', 'behind'))::INTEGER AS in_progress_goals,
        COUNT(*) FILTER (WHERE status = 'on_track')::INTEGER AS goals_on_track,
        COUNT(*) FILTER (WHERE
            status NOT IN ('completed', 'paused')
            AND target_date IS NOT NULL
            AND start_date IS NOT NULL
            AND (
                EXTRACT(EPOCH FROM (CURRENT_DATE - start_date)) / 86400 *
                (100::DECIMAL / NULLIF(EXTRACT(EPOCH FROM (target_date - start_date)) / 86400, 0))
                - calculate_goal_progress(id)
            ) >= v_settings.warning_threshold_days
        )::INTEGER AS goals_behind
    FROM public.life_goals
    WHERE user_id = p_user_id AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant table permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.life_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_milestones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_progress_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_drift_settings TO authenticated;

-- Grant function execution
GRANT EXECUTE ON FUNCTION calculate_goal_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_goals_needing_attention(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_goal_statistics(UUID) TO authenticated;

-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================

COMMENT ON TABLE public.goal_categories IS 'User-defined categories for organizing life goals';
COMMENT ON TABLE public.life_goals IS 'Main life goals with flexible target types (numeric, boolean, milestone)';
COMMENT ON TABLE public.goal_milestones IS 'Milestones for breaking down large goals into achievable steps';
COMMENT ON TABLE public.goal_progress_snapshots IS 'Historical progress snapshots for trend analysis and charts';
COMMENT ON TABLE public.user_drift_settings IS 'User preferences for drift detection thresholds and alerts';

COMMENT ON COLUMN public.life_goals.target_type IS 'numeric: track a number, boolean: yes/no goal, milestone: track via milestones';
COMMENT ON COLUMN public.life_goals.linked_metric IS 'Optional auto-tracking from app data (net_worth, passive_income, etc.)';
COMMENT ON COLUMN public.user_drift_settings.warning_threshold_days IS 'Days behind schedule before showing warning';
COMMENT ON COLUMN public.user_drift_settings.critical_threshold_days IS 'Days behind schedule before showing critical alert';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
