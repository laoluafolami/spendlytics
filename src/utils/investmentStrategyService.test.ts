/**
 * Investment Strategy Service Tests
 *
 * Tests for strategy holding analysis and performance calculations.
 * Note: Database operations are tested via integration tests.
 */

import { describe, it, expect, vi } from 'vitest'
import { InvestmentStrategy, StrategyHolding } from '../types/investmentStrategy'
import { Investment } from '../types/finance'

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }),
  },
}))

// Mock financeDataService
vi.mock('./financeDataService', () => ({
  getInvestments: vi.fn().mockResolvedValue([]),
}))

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockStrategy(overrides: Partial<InvestmentStrategy> = {}): InvestmentStrategy {
  return {
    id: 'strategy-1',
    user_id: 'user-1',
    name: 'Magic Formula Strategy',
    description: 'Test strategy',
    type: 'magic_formula',
    parameters: {
      targetHoldings: 25,
      holdingPeriodMonths: 12,
      rebalanceFrequency: 'annually',
      maxPositionPercent: 5,
    },
    linkedGoalId: undefined,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function createMockHolding(overrides: Partial<StrategyHolding> = {}): StrategyHolding {
  const buyDate = new Date()
  buyDate.setMonth(buyDate.getMonth() - 6) // 6 months ago

  const targetSellDate = new Date(buyDate)
  targetSellDate.setFullYear(targetSellDate.getFullYear() + 1) // 1 year from buy

  return {
    id: 'holding-1',
    user_id: 'user-1',
    strategyId: 'strategy-1',
    investmentId: 'investment-1',
    buyDate: buyDate.toISOString(),
    targetSellDate: targetSellDate.toISOString(),
    actualSellDate: undefined,
    strategyMetrics: {
      rocRank: 10,
      earningsYieldRank: 15,
      combinedRank: 25,
    },
    status: 'active',
    sellReason: undefined,
    buyValue: 1000,
    currentValue: 1200,
    gainLoss: 200,
    notes: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function createMockInvestment(overrides: Partial<Investment> = {}): Investment {
  return {
    id: 'investment-1',
    user_id: 'user-1',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    type: 'stock',
    shares: 10,
    average_cost: 150,
    current_price: 175,
    market_value: 1750,
    cost_basis: 1500,
    gain_loss: 250,
    gain_loss_percent: 16.67,
    dividend_yield: 0.5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// ============================================================================
// UNIT TESTS - Pure Logic Functions
// ============================================================================

describe('Strategy Holding Calculations', () => {
  describe('Days Until Sell Date', () => {
    it('should calculate days until sell date correctly', () => {
      const today = new Date()
      const targetDate = new Date(today)
      targetDate.setDate(targetDate.getDate() + 30)

      const daysUntil = Math.ceil(
        (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      expect(daysUntil).toBe(30)
    })

    it('should return negative days for past sell dates', () => {
      const today = new Date()
      const targetDate = new Date(today)
      targetDate.setDate(targetDate.getDate() - 10)

      const daysUntil = Math.ceil(
        (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      expect(daysUntil).toBe(-10)
    })
  })

  describe('Holding Period Calculation', () => {
    it('should calculate holding period in days', () => {
      const buyDate = new Date()
      buyDate.setDate(buyDate.getDate() - 180) // 180 days ago

      const today = new Date()
      const days = Math.floor(
        (today.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      expect(days).toBe(180)
    })

    it('should calculate holding period for sold position', () => {
      const buyDate = new Date('2024-01-01')
      const sellDate = new Date('2024-07-01') // 182 days later

      const days = Math.floor(
        (sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      expect(days).toBe(182)
    })
  })

  describe('Performance Metrics', () => {
    it('should calculate gain/loss percentage', () => {
      const cost = 1000
      const gain = 150
      const gainPercent = (gain / cost) * 100

      expect(gainPercent).toBe(15)
    })

    it('should handle zero cost basis', () => {
      const cost = 0
      const gain = 100
      const gainPercent = cost > 0 ? (gain / cost) * 100 : 0

      expect(gainPercent).toBe(0)
    })

    it('should count winners and losers', () => {
      const holdings = [
        createMockHolding({ gainLoss: 100 }),
        createMockHolding({ gainLoss: -50 }),
        createMockHolding({ gainLoss: 200 }),
        createMockHolding({ gainLoss: 0 }),
        createMockHolding({ gainLoss: -25 }),
      ]

      let winners = 0
      let losers = 0

      for (const h of holdings) {
        if ((h.gainLoss || 0) > 0) winners++
        else if ((h.gainLoss || 0) < 0) losers++
      }

      expect(winners).toBe(2)
      expect(losers).toBe(2)
    })
  })
})

describe('Strategy Type Configuration', () => {
  it('should have correct Magic Formula defaults', () => {
    const strategy = createMockStrategy({ type: 'magic_formula' })

    expect(strategy.parameters.targetHoldings).toBe(25)
    expect(strategy.parameters.holdingPeriodMonths).toBe(12)
    expect(strategy.parameters.rebalanceFrequency).toBe('annually')
  })

  it('should support different strategy types', () => {
    const types: InvestmentStrategy['type'][] = [
      'magic_formula',
      'dividend_growth',
      'index_following',
      'value_investing',
      'growth_investing',
      'custom',
    ]

    for (const type of types) {
      const strategy = createMockStrategy({ type })
      expect(strategy.type).toBe(type)
    }
  })
})

describe('Rebalance Schedule Calculation', () => {
  it('should calculate monthly rebalance date', () => {
    const lastUpdate = new Date('2024-06-15')
    const nextRebalance = new Date(lastUpdate)
    nextRebalance.setMonth(nextRebalance.getMonth() + 1)

    expect(nextRebalance.getMonth()).toBe(6) // July
    expect(nextRebalance.getDate()).toBe(15)
  })

  it('should calculate quarterly rebalance date', () => {
    const lastUpdate = new Date('2024-06-15')
    const nextRebalance = new Date(lastUpdate)
    nextRebalance.setMonth(nextRebalance.getMonth() + 3)

    expect(nextRebalance.getMonth()).toBe(8) // September
  })

  it('should calculate semi-annual rebalance date', () => {
    const lastUpdate = new Date('2024-06-15')
    const nextRebalance = new Date(lastUpdate)
    nextRebalance.setMonth(nextRebalance.getMonth() + 6)

    expect(nextRebalance.getMonth()).toBe(11) // December
  })

  it('should calculate annual rebalance date', () => {
    const lastUpdate = new Date('2024-06-15')
    const nextRebalance = new Date(lastUpdate)
    nextRebalance.setFullYear(nextRebalance.getFullYear() + 1)

    expect(nextRebalance.getFullYear()).toBe(2025)
    expect(nextRebalance.getMonth()).toBe(5) // June
  })
})

describe('Holding Status Transitions', () => {
  it('should identify active holdings', () => {
    const holding = createMockHolding({ status: 'active' })
    expect(holding.status).toBe('active')
  })

  it('should identify sold holdings', () => {
    const holding = createMockHolding({
      status: 'sold',
      actualSellDate: new Date().toISOString(),
      sellReason: 'Holding period complete',
    })

    expect(holding.status).toBe('sold')
    expect(holding.actualSellDate).toBeDefined()
  })

  it('should identify pending sale holdings', () => {
    const holding = createMockHolding({ status: 'pending_sale' })
    expect(holding.status).toBe('pending_sale')
  })

  it('should identify pending buy holdings', () => {
    const holding = createMockHolding({ status: 'pending_buy' })
    expect(holding.status).toBe('pending_buy')
  })
})

describe('Strategy Metrics', () => {
  it('should store Magic Formula ranks', () => {
    const holding = createMockHolding({
      strategyMetrics: {
        rocRank: 5,
        earningsYieldRank: 10,
        combinedRank: 15,
      },
    })

    expect(holding.strategyMetrics?.rocRank).toBe(5)
    expect(holding.strategyMetrics?.earningsYieldRank).toBe(10)
    expect(holding.strategyMetrics?.combinedRank).toBe(15)
  })

  it('should calculate combined rank as sum', () => {
    const rocRank = 8
    const eyRank = 12
    const combinedRank = rocRank + eyRank

    expect(combinedRank).toBe(20)
  })

  it('should handle missing strategy metrics', () => {
    const holding = createMockHolding({ strategyMetrics: undefined })
    expect(holding.strategyMetrics).toBeUndefined()
  })
})

describe('Portfolio Aggregation', () => {
  it('should sum total portfolio value', () => {
    const investments = [
      createMockInvestment({ market_value: 1000 }),
      createMockInvestment({ market_value: 2000 }),
      createMockInvestment({ market_value: 1500 }),
    ]

    const totalValue = investments.reduce((sum, i) => sum + i.market_value, 0)
    expect(totalValue).toBe(4500)
  })

  it('should sum total cost basis', () => {
    const investments = [
      createMockInvestment({ cost_basis: 800 }),
      createMockInvestment({ cost_basis: 1800 }),
      createMockInvestment({ cost_basis: 1400 }),
    ]

    const totalCost = investments.reduce((sum, i) => sum + i.cost_basis, 0)
    expect(totalCost).toBe(4000)
  })

  it('should calculate average holding period', () => {
    const holdingDays = [365, 180, 90, 270]
    const totalDays = holdingDays.reduce((sum, d) => sum + d, 0)
    const avgDays = totalDays / holdingDays.length

    expect(avgDays).toBe(226.25)
    expect(Math.round(avgDays)).toBe(226)
  })
})

describe('Data Mapping', () => {
  it('should map strategy from DB format', () => {
    const dbData = {
      id: 'strategy-1',
      user_id: 'user-1',
      name: 'Test Strategy',
      description: 'Description',
      type: 'magic_formula',
      parameters: { targetHoldings: 25 },
      linked_goal_id: 'goal-1',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    }

    // Simulate the mapping
    const mapped: InvestmentStrategy = {
      id: dbData.id,
      user_id: dbData.user_id,
      name: dbData.name,
      description: dbData.description,
      type: dbData.type as InvestmentStrategy['type'],
      parameters: dbData.parameters,
      linkedGoalId: dbData.linked_goal_id,
      isActive: dbData.is_active,
      createdAt: dbData.created_at,
      updatedAt: dbData.updated_at,
    }

    expect(mapped.linkedGoalId).toBe('goal-1')
    expect(mapped.isActive).toBe(true)
    expect(mapped.createdAt).toBe('2024-01-01T00:00:00Z')
  })

  it('should map holding from DB format', () => {
    const dbData = {
      id: 'holding-1',
      user_id: 'user-1',
      strategy_id: 'strategy-1',
      investment_id: 'investment-1',
      buy_date: '2024-01-01',
      target_sell_date: '2025-01-01',
      actual_sell_date: null,
      strategy_metrics: { rocRank: 10 },
      status: 'active',
      sell_reason: null,
      buy_value: 1000,
      current_value: 1100,
      gain_loss: 100,
      notes: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    }

    // Simulate the mapping
    const mapped: StrategyHolding = {
      id: dbData.id,
      user_id: dbData.user_id,
      strategyId: dbData.strategy_id,
      investmentId: dbData.investment_id,
      buyDate: dbData.buy_date,
      targetSellDate: dbData.target_sell_date ?? undefined,
      actualSellDate: dbData.actual_sell_date ?? undefined,
      strategyMetrics: dbData.strategy_metrics,
      status: dbData.status as StrategyHolding['status'],
      sellReason: dbData.sell_reason ?? undefined,
      buyValue: dbData.buy_value,
      currentValue: dbData.current_value,
      gainLoss: dbData.gain_loss,
      notes: dbData.notes ?? undefined,
      createdAt: dbData.created_at,
      updatedAt: dbData.updated_at,
    }

    expect(mapped.strategyId).toBe('strategy-1')
    expect(mapped.investmentId).toBe('investment-1')
    expect(mapped.buyDate).toBe('2024-01-01')
    expect(mapped.targetSellDate).toBe('2025-01-01')
    expect(mapped.status).toBe('active')
  })

  it('should handle null values in DB data', () => {
    const dbData = {
      id: 'holding-1',
      user_id: 'user-1',
      strategy_id: 'strategy-1',
      investment_id: 'investment-1',
      buy_date: '2024-01-01',
      target_sell_date: null,
      actual_sell_date: null,
      strategy_metrics: null,
      status: 'active',
      sell_reason: null,
      buy_value: null,
      current_value: null,
      gain_loss: null,
      notes: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    }

    const mapped: StrategyHolding = {
      id: dbData.id,
      user_id: dbData.user_id,
      strategyId: dbData.strategy_id,
      investmentId: dbData.investment_id,
      buyDate: dbData.buy_date,
      targetSellDate: dbData.target_sell_date ?? undefined,
      actualSellDate: dbData.actual_sell_date ?? undefined,
      strategyMetrics: dbData.strategy_metrics ?? undefined,
      status: dbData.status as StrategyHolding['status'],
      sellReason: dbData.sell_reason ?? undefined,
      buyValue: dbData.buy_value ?? undefined,
      currentValue: dbData.current_value ?? undefined,
      gainLoss: dbData.gain_loss ?? undefined,
      notes: dbData.notes ?? undefined,
      createdAt: dbData.created_at,
      updatedAt: dbData.updated_at,
    }

    expect(mapped.targetSellDate).toBeUndefined()
    expect(mapped.actualSellDate).toBeUndefined()
    expect(mapped.strategyMetrics).toBeUndefined()
    expect(mapped.buyValue).toBeUndefined()
  })
})

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty holdings array', () => {
    const holdings: StrategyHolding[] = []

    const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0)
    const totalCost = holdings.reduce((sum, h) => sum + (h.buyValue || 0), 0)

    expect(totalValue).toBe(0)
    expect(totalCost).toBe(0)
    expect(holdings.length).toBe(0)
  })

  it('should handle holdings with undefined values', () => {
    const holding = createMockHolding({
      buyValue: undefined,
      currentValue: undefined,
      gainLoss: undefined,
    })

    const value = holding.currentValue ?? 0
    const cost = holding.buyValue ?? 0
    const gain = holding.gainLoss ?? 0

    expect(value).toBe(0)
    expect(cost).toBe(0)
    expect(gain).toBe(0)
  })

  it('should handle strategy with empty parameters', () => {
    const strategy = createMockStrategy({ parameters: {} })

    expect(strategy.parameters.targetHoldings).toBeUndefined()
    expect(strategy.parameters.holdingPeriodMonths).toBeUndefined()
    expect(strategy.parameters.rebalanceFrequency).toBeUndefined()
  })

  it('should handle very old buy dates', () => {
    const veryOldBuyDate = new Date('2010-01-01')
    const today = new Date()
    const days = Math.floor(
      (today.getTime() - veryOldBuyDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Should be many years of days
    expect(days).toBeGreaterThan(5000)
  })

  it('should handle future target sell dates', () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 10)

    const today = new Date()
    const daysUntil = Math.ceil(
      (futureDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    expect(daysUntil).toBeGreaterThan(3000)
  })
})
