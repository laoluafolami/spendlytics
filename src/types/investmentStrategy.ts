/**
 * Investment Strategy Type Definitions
 *
 * Types for tracking investment strategies like Magic Formula,
 * Dividend Growth, Index Following, and custom strategies.
 */

// ============================================================================
// STRATEGY TYPES
// ============================================================================

/**
 * Strategy types
 */
export type StrategyType =
  | 'magic_formula'      // Joel Greenblatt's Magic Formula
  | 'dividend_growth'    // Dividend growth investing
  | 'index_following'    // Passive index following
  | 'value_investing'    // Value-based stock picking
  | 'growth_investing'   // Growth-focused investing
  | 'custom'             // User-defined strategy

/**
 * Rebalance frequency options
 */
export type RebalanceFrequency = 'monthly' | 'quarterly' | 'semi_annually' | 'annually'

/**
 * Strategy holding status
 */
export type HoldingStatus = 'active' | 'sold' | 'pending_sale' | 'pending_buy'

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Investment Strategy
 * Defines the rules and parameters for a specific investment approach
 */
export interface InvestmentStrategy {
  id: string
  user_id: string
  name: string
  description?: string
  type: StrategyType

  // Configurable parameters
  parameters: {
    // Portfolio size
    minHoldings?: number           // Minimum number of holdings
    maxHoldings?: number           // Maximum number of holdings (e.g., 20-30 for Magic Formula)
    targetHoldings?: number        // Target number of holdings

    // Holding period
    holdingPeriodMonths?: number   // How long to hold (e.g., 12 for Magic Formula 1-year)

    // Rebalancing
    rebalanceFrequency?: RebalanceFrequency
    rebalanceDay?: number          // Day of month for rebalancing

    // Position sizing
    maxPositionPercent?: number    // Max % of portfolio in single position
    minPositionAmount?: number     // Minimum $ amount per position

    // Entry/exit rules (for custom strategies)
    entryRules?: string[]
    exitRules?: string[]

    // Sector limits
    maxSectorPercent?: number      // Max % in any single sector
  }

  // Links
  linkedGoalId?: string            // Link to a Life Goal

  // Status
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Strategy Holding
 * Links an investment to a strategy with strategy-specific tracking
 */
export interface StrategyHolding {
  id: string
  user_id: string
  strategyId: string
  investmentId: string             // Links to Investment

  // Timing
  buyDate: string                  // When the position was opened
  targetSellDate?: string          // Calculated from buy_date + holding_period
  actualSellDate?: string          // When actually sold

  // Strategy-specific metrics (e.g., for Magic Formula)
  strategyMetrics?: {
    // Magic Formula specific
    rocRank?: number               // Return on Capital rank
    earningsYieldRank?: number     // Earnings Yield rank
    combinedRank?: number          // Combined rank

    // General metrics
    entryPrice?: number
    entryReason?: string
    targetPrice?: number
    stopLoss?: number
  }

  // Status
  status: HoldingStatus
  sellReason?: string              // Reason for selling

  // Performance tracking
  buyValue?: number                // Total value at buy
  currentValue?: number            // Current value
  gainLoss?: number                // Unrealized/realized gain

  // Metadata
  notes?: string
  createdAt: string
  updatedAt: string
}

/**
 * Strategy Performance Snapshot
 * Historical performance tracking for a strategy
 */
export interface StrategyPerformanceSnapshot {
  id: string
  user_id: string
  strategyId: string
  snapshotDate: string

  // Portfolio metrics
  totalValue: number
  totalCost: number
  totalGain: number
  totalGainPercent: number

  // Holdings breakdown
  holdingsCount: number
  winnersCount: number
  losersCount: number

  // Comparison
  benchmarkReturn?: number         // e.g., S&P 500 return

  createdAt: string
}

// ============================================================================
// FORM DATA
// ============================================================================

export interface StrategyFormData {
  name: string
  description: string
  type: StrategyType
  minHoldings: string
  maxHoldings: string
  targetHoldings: string
  holdingPeriodMonths: string
  rebalanceFrequency: RebalanceFrequency | ''
  maxPositionPercent: string
  linkedGoalId: string
}

// ============================================================================
// DEFAULTS & CONSTANTS
// ============================================================================

/**
 * Strategy type configurations
 */
export const STRATEGY_TYPE_CONFIG: Record<
  StrategyType,
  {
    label: string
    description: string
    color: string
    defaultParams: Partial<InvestmentStrategy['parameters']>
  }
> = {
  magic_formula: {
    label: 'Magic Formula',
    description: "Joel Greenblatt's value investing strategy using ROC and Earnings Yield",
    color: '#8B5CF6',
    defaultParams: {
      targetHoldings: 25,
      minHoldings: 20,
      maxHoldings: 30,
      holdingPeriodMonths: 12,
      rebalanceFrequency: 'annually',
      maxPositionPercent: 5,
    },
  },
  dividend_growth: {
    label: 'Dividend Growth',
    description: 'Focus on companies with consistent dividend growth history',
    color: '#10B981',
    defaultParams: {
      targetHoldings: 20,
      holdingPeriodMonths: 60, // 5 years
      maxPositionPercent: 5,
    },
  },
  index_following: {
    label: 'Index Following',
    description: 'Passive strategy following a market index',
    color: '#3B82F6',
    defaultParams: {
      rebalanceFrequency: 'quarterly',
    },
  },
  value_investing: {
    label: 'Value Investing',
    description: 'Buy undervalued companies with strong fundamentals',
    color: '#F59E0B',
    defaultParams: {
      targetHoldings: 15,
      holdingPeriodMonths: 36,
      maxPositionPercent: 10,
    },
  },
  growth_investing: {
    label: 'Growth Investing',
    description: 'Focus on companies with high growth potential',
    color: '#EC4899',
    defaultParams: {
      targetHoldings: 15,
      holdingPeriodMonths: 24,
      maxPositionPercent: 10,
    },
  },
  custom: {
    label: 'Custom Strategy',
    description: 'Define your own investment rules and parameters',
    color: '#6366F1',
    defaultParams: {},
  },
}

/**
 * Rebalance frequency labels
 */
export const REBALANCE_FREQUENCY_LABELS: Record<RebalanceFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annually: 'Semi-Annually',
  annually: 'Annually',
}

/**
 * Holding status labels
 */
export const HOLDING_STATUS_CONFIG: Record<
  HoldingStatus,
  { label: string; color: string; bgColor: string }
> = {
  active: {
    label: 'Active',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  sold: {
    label: 'Sold',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-700',
  },
  pending_sale: {
    label: 'Pending Sale',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  pending_buy: {
    label: 'Pending Buy',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
}
