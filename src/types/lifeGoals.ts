/**
 * Life Goals Type Definitions
 *
 * Flexible goal tracking system that allows users to define their own
 * categories, targets, and milestones without hardcoded values.
 */

// ============================================================================
// GOAL TARGET TYPES
// ============================================================================

/**
 * Target types determine how a goal's progress is measured
 */
export type GoalTargetType = 'numeric' | 'boolean' | 'milestone'

/**
 * Linked metric types for auto-tracking from app data
 */
export type LinkedMetricType =
  // Existing metrics
  | 'net_worth'
  | 'total_assets'
  | 'total_investments'
  | 'passive_income'
  | 'savings_rate'
  | 'total_income'
  | 'total_real_estate'
  | 'custom'
  // NEW metrics for enhanced portfolio tracking
  | 'total_liabilities'           // Total debt outstanding
  | 'debt_free_progress'          // (initial_debt - current_debt) / initial_debt * 100
  | 'investment_gain'             // Total unrealized gains from portfolio
  | 'portfolio_dividend_income'   // Annual dividend income from portfolio
  | 'emergency_fund_months'       // Liquid assets / monthly expenses
  | 'portfolio_count'             // Number of investment holdings
  | 'real_estate_units'           // Count of real_estate assets
  | 'winners_count'               // Investments with positive gain
  | 'portfolio_yield_on_cost'     // Total YOC from portfolio

/**
 * Goal priority levels
 */
export type GoalPriority = 'low' | 'medium' | 'high' | 'critical'

/**
 * Goal status
 */
export type GoalStatus = 'not_started' | 'in_progress' | 'on_track' | 'behind' | 'completed' | 'paused'

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * User-defined goal category
 * Users create their own categories (e.g., "Financial", "Health", "Career")
 */
export interface GoalCategory {
  id: string
  user_id: string
  name: string
  description?: string
  color: string
  icon: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Main Life Goal interface
 */
export interface LifeGoal {
  id: string
  user_id: string
  category_id: string
  category_name?: string // Denormalized for display

  // Basic info
  title: string
  description?: string
  priority: GoalPriority
  status: GoalStatus

  // Target configuration
  target_type: GoalTargetType
  target_value?: number        // For numeric goals
  target_unit?: string         // e.g., "$", "units", "apartments"
  current_value: number        // Current progress (0-100 for boolean, actual for numeric)

  // Auto-linking (optional)
  linked_metric?: LinkedMetricType
  linked_metric_multiplier?: number // For custom calculations

  // Timeline
  start_date?: string
  target_date?: string

  // Tracking
  notes?: string
  tags?: string[]

  // Metadata
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Goal milestone for breaking down large goals
 */
export interface GoalMilestone {
  id: string
  user_id: string
  goal_id: string

  title: string
  description?: string
  target_value?: number
  target_date?: string

  is_completed: boolean
  completed_at?: string

  sort_order: number
  created_at: string
  updated_at: string
}

/**
 * Goal progress snapshot for historical tracking
 */
export interface GoalProgressSnapshot {
  id: string
  user_id: string
  goal_id: string
  value: number
  date: string
  notes?: string
  created_at: string
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

/**
 * User drift detection settings
 */
export interface UserDriftSettings {
  id: string
  user_id: string

  // Global drift thresholds (can be overridden per goal)
  warning_threshold_days: number    // Days behind before warning (default: 30)
  critical_threshold_days: number   // Days behind before critical (default: 90)

  // Notification preferences
  enable_drift_alerts: boolean
  alert_frequency: 'daily' | 'weekly' | 'monthly'

  // Review preferences
  enable_weekly_review: boolean
  review_day: number // 0-6 (Sunday-Saturday)

  created_at: string
  updated_at: string
}

// ============================================================================
// TEMPLATES (Optional starter templates)
// ============================================================================

/**
 * Goal template for quick setup (users can customize or ignore)
 */
export interface GoalTemplate {
  id: string
  name: string
  description: string
  category_suggestion: string
  target_type: GoalTargetType
  suggested_unit?: string
  linked_metric?: LinkedMetricType
  default_milestones?: Array<{
    title: string
    percentage: number // What % of goal this milestone represents
  }>
  icon: string
  color: string
}

// ============================================================================
// FORM DATA
// ============================================================================

export interface GoalFormData {
  title: string
  description: string
  category_id: string
  priority: GoalPriority
  target_type: GoalTargetType
  target_value: string
  target_unit: string
  current_value: string
  linked_metric: LinkedMetricType | ''
  start_date: string
  target_date: string
  notes: string
  tags: string[]
}

export interface CategoryFormData {
  name: string
  description: string
  color: string
  icon: string
}

export interface MilestoneFormData {
  title: string
  description: string
  target_value: string
  target_date: string
}

// ============================================================================
// DEFAULTS & CONSTANTS
// ============================================================================

/**
 * Default drift settings for new users
 */
export const DEFAULT_DRIFT_SETTINGS: Omit<UserDriftSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  warning_threshold_days: 30,
  critical_threshold_days: 90,
  enable_drift_alerts: true,
  alert_frequency: 'weekly',
  enable_weekly_review: true,
  review_day: 0, // Sunday
}

/**
 * Suggested category colors
 */
export const CATEGORY_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EF4444', // Red
  '#6366F1', // Indigo
  '#14B8A6', // Teal
] as const

/**
 * Available icons for categories
 */
export const CATEGORY_ICONS = [
  'Target',
  'DollarSign',
  'TrendingUp',
  'Heart',
  'Briefcase',
  'Home',
  'GraduationCap',
  'Users',
  'Globe',
  'Rocket',
  'Award',
  'Star',
  'Zap',
  'Flame',
  'Mountain',
] as const

/**
 * Priority configurations
 */
export const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  medium: { label: 'Medium', color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  high: { label: 'High', color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  critical: { label: 'Critical', color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30' },
} as const

/**
 * Status configurations
 */
export const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  in_progress: { label: 'In Progress', color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  on_track: { label: 'On Track', color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  behind: { label: 'Behind', color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  completed: { label: 'Completed', color: 'text-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
  paused: { label: 'Paused', color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-800' },
} as const

/**
 * Linked metric labels
 */
export const LINKED_METRIC_LABELS: Record<LinkedMetricType, string> = {
  // Existing
  net_worth: 'Net Worth',
  total_assets: 'Total Assets',
  total_investments: 'Investment Portfolio Value',
  passive_income: 'Passive Income (Monthly)',
  savings_rate: 'Savings Rate (%)',
  total_income: 'Total Income (Monthly)',
  total_real_estate: 'Real Estate Value',
  custom: 'Custom Calculation',
  // NEW metrics
  total_liabilities: 'Total Liabilities',
  debt_free_progress: 'Debt Freedom Progress (%)',
  investment_gain: 'Investment Unrealized Gains',
  portfolio_dividend_income: 'Portfolio Annual Dividends',
  emergency_fund_months: 'Emergency Fund (Months)',
  portfolio_count: 'Number of Holdings',
  real_estate_units: 'Real Estate Units Count',
  winners_count: 'Winning Investments Count',
  portfolio_yield_on_cost: 'Portfolio Yield on Cost (%)',
}

/**
 * Optional starter templates (users can use these or create from scratch)
 */
export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: 'template-emergency-fund',
    name: 'Emergency Fund',
    description: '3-6 months of expenses saved',
    category_suggestion: 'Financial Security',
    target_type: 'numeric',
    suggested_unit: '$',
    linked_metric: 'total_assets',
    default_milestones: [
      { title: '1 Month Saved', percentage: 17 },
      { title: '3 Months Saved', percentage: 50 },
      { title: '6 Months Saved', percentage: 100 },
    ],
    icon: 'Shield',
    color: '#10B981',
  },
  {
    id: 'template-debt-free',
    name: 'Become Debt Free',
    description: 'Pay off all consumer debt',
    category_suggestion: 'Financial Freedom',
    target_type: 'numeric',
    suggested_unit: '%',
    linked_metric: 'debt_free_progress',
    default_milestones: [
      { title: '25% Paid Off', percentage: 25 },
      { title: '50% Paid Off', percentage: 50 },
      { title: '75% Paid Off', percentage: 75 },
      { title: 'Debt Free!', percentage: 100 },
    ],
    icon: 'CheckCircle',
    color: '#8B5CF6',
  },
  {
    id: 'template-investment-portfolio',
    name: 'Investment Portfolio Target',
    description: 'Build investment portfolio to target value',
    category_suggestion: 'Wealth Building',
    target_type: 'numeric',
    suggested_unit: '$',
    linked_metric: 'total_investments',
    default_milestones: [
      { title: '25% of Target', percentage: 25 },
      { title: '50% of Target', percentage: 50 },
      { title: '75% of Target', percentage: 75 },
      { title: 'Target Reached', percentage: 100 },
    ],
    icon: 'TrendingUp',
    color: '#3B82F6',
  },
  {
    id: 'template-passive-income',
    name: 'Passive Income Goal',
    description: 'Generate consistent passive income',
    category_suggestion: 'Financial Independence',
    target_type: 'numeric',
    suggested_unit: '$/month',
    linked_metric: 'passive_income',
    icon: 'Coins',
    color: '#F59E0B',
  },
  {
    id: 'template-net-worth',
    name: 'Net Worth Milestone',
    description: 'Reach a specific net worth target',
    category_suggestion: 'Wealth Building',
    target_type: 'numeric',
    suggested_unit: '$',
    linked_metric: 'net_worth',
    icon: 'Landmark',
    color: '#06B6D4',
  },
  {
    id: 'template-savings-rate',
    name: 'Savings Rate Target',
    description: 'Maintain a specific savings rate',
    category_suggestion: 'Financial Habits',
    target_type: 'numeric',
    suggested_unit: '%',
    linked_metric: 'savings_rate',
    icon: 'PiggyBank',
    color: '#EC4899',
  },
  // NEW templates for enhanced portfolio tracking
  {
    id: 'template-dividend-income',
    name: 'Dividend Income Goal',
    description: 'Build portfolio for annual dividend income',
    category_suggestion: 'Passive Income',
    target_type: 'numeric',
    suggested_unit: '$/year',
    linked_metric: 'portfolio_dividend_income',
    default_milestones: [
      { title: 'First $1,000/year', percentage: 10 },
      { title: '$5,000/year', percentage: 50 },
      { title: 'Target Income', percentage: 100 },
    ],
    icon: 'DollarSign',
    color: '#10B981',
  },
  {
    id: 'template-emergency-fund-months',
    name: 'Emergency Fund (Months)',
    description: 'Build emergency fund measured in months of expenses',
    category_suggestion: 'Financial Security',
    target_type: 'numeric',
    suggested_unit: 'months',
    linked_metric: 'emergency_fund_months',
    default_milestones: [
      { title: '1 Month', percentage: 17 },
      { title: '3 Months', percentage: 50 },
      { title: '6 Months', percentage: 100 },
    ],
    icon: 'Shield',
    color: '#06B6D4',
  },
  {
    id: 'template-portfolio-size',
    name: 'Portfolio Diversification',
    description: 'Build a diversified portfolio with target number of holdings',
    category_suggestion: 'Investment Strategy',
    target_type: 'numeric',
    suggested_unit: 'holdings',
    linked_metric: 'portfolio_count',
    icon: 'BarChart3',
    color: '#8B5CF6',
  },
  {
    id: 'template-real-estate-units',
    name: 'Real Estate Portfolio',
    description: 'Acquire real estate investment properties',
    category_suggestion: 'Real Estate',
    target_type: 'numeric',
    suggested_unit: 'units',
    linked_metric: 'real_estate_units',
    icon: 'Home',
    color: '#F59E0B',
  },
  {
    id: 'template-winning-portfolio',
    name: 'Winning Investments',
    description: 'Target number of investments in profit',
    category_suggestion: 'Investment Strategy',
    target_type: 'numeric',
    suggested_unit: 'winners',
    linked_metric: 'winners_count',
    icon: 'Trophy',
    color: '#10B981',
  },
  {
    id: 'template-yield-on-cost',
    name: 'Portfolio Yield on Cost',
    description: 'Achieve target yield on cost for dividend portfolio',
    category_suggestion: 'Dividend Growth',
    target_type: 'numeric',
    suggested_unit: '%',
    linked_metric: 'portfolio_yield_on_cost',
    icon: 'Percent',
    color: '#EC4899',
  },
  // Non-financial templates
  {
    id: 'template-custom-numeric',
    name: 'Custom Numeric Goal',
    description: 'Track any numeric goal with manual updates',
    category_suggestion: 'Custom',
    target_type: 'numeric',
    icon: 'Target',
    color: '#6366F1',
  },
  {
    id: 'template-milestone-goal',
    name: 'Milestone Goal',
    description: 'Track progress through key milestones',
    category_suggestion: 'Custom',
    target_type: 'milestone',
    icon: 'Flag',
    color: '#14B8A6',
  },
  {
    id: 'template-yes-no-goal',
    name: 'Yes/No Goal',
    description: 'Track a binary achievement goal',
    category_suggestion: 'Custom',
    target_type: 'boolean',
    icon: 'CheckCircle2',
    color: '#84CC16',
  },
]
