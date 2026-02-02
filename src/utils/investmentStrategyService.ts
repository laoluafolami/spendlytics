/**
 * Investment Strategy Service
 *
 * Data service for managing investment strategies and holdings
 * Follows the same pattern as financeDataService
 */

import { supabase } from '../lib/supabase'
import {
  InvestmentStrategy,
  StrategyHolding,
} from '../types/investmentStrategy'
import { Investment } from '../types/finance'
import { getInvestments } from './financeDataService'

// ============================================================================
// CONFIGURATION
// ============================================================================

const STORAGE_KEYS = {
  strategies: 'spendlytics_investment_strategies',
  holdings: 'spendlytics_strategy_holdings',
  snapshots: 'spendlytics_strategy_snapshots',
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id || null
}

function loadFromLocalStorage<T>(key: string): T[] {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error(`Error loading from localStorage (${key}):`, error)
    return []
  }
}

function saveToLocalStorage<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error(`Error saving to localStorage (${key}):`, error)
  }
}

// ============================================================================
// STRATEGY OPERATIONS
// ============================================================================

export async function getStrategies(): Promise<InvestmentStrategy[]> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('investment_strategies')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Map snake_case to camelCase
      const strategies = (data || []).map(mapStrategyFromDb)
      saveToLocalStorage(STORAGE_KEYS.strategies, strategies)
      return strategies
    } catch (error) {
      console.error('Error fetching strategies from Supabase:', error)
      return loadFromLocalStorage<InvestmentStrategy>(STORAGE_KEYS.strategies)
    }
  }

  return loadFromLocalStorage<InvestmentStrategy>(STORAGE_KEYS.strategies)
}

export async function getStrategy(id: string): Promise<InvestmentStrategy | null> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('investment_strategies')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (error) throw error
      return mapStrategyFromDb(data)
    } catch (error) {
      console.error('Error fetching strategy from Supabase:', error)
      const local = loadFromLocalStorage<InvestmentStrategy>(STORAGE_KEYS.strategies)
      return local.find(s => s.id === id) || null
    }
  }

  const local = loadFromLocalStorage<InvestmentStrategy>(STORAGE_KEYS.strategies)
  return local.find(s => s.id === id) || null
}

export async function createStrategy(
  strategy: Omit<InvestmentStrategy, 'id' | 'user_id' | 'createdAt' | 'updatedAt'>
): Promise<InvestmentStrategy | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  const newStrategy: InvestmentStrategy = {
    ...strategy,
    id: crypto.randomUUID(),
    user_id: userId || 'local',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }

  if (userId) {
    try {
      const dbStrategy = mapStrategyToDb(newStrategy)
      const { data, error } = await supabase
        .from('investment_strategies')
        .insert([{ ...dbStrategy, user_id: userId }])
        .select()
        .single()

      if (error) throw error
      return mapStrategyFromDb(data)
    } catch (error) {
      console.error('Error creating strategy in Supabase:', error)
    }
  }

  const local = loadFromLocalStorage<InvestmentStrategy>(STORAGE_KEYS.strategies)
  saveToLocalStorage(STORAGE_KEYS.strategies, [newStrategy, ...local])
  return newStrategy
}

export async function updateStrategy(
  id: string,
  updates: Partial<InvestmentStrategy>
): Promise<InvestmentStrategy | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  if (userId) {
    try {
      const dbUpdates = mapStrategyToDb({ ...updates, updatedAt: now } as InvestmentStrategy)
      const { data, error } = await supabase
        .from('investment_strategies')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return mapStrategyFromDb(data)
    } catch (error) {
      console.error('Error updating strategy in Supabase:', error)
    }
  }

  const local = loadFromLocalStorage<InvestmentStrategy>(STORAGE_KEYS.strategies)
  const updated = local.map(s => s.id === id ? { ...s, ...updates, updatedAt: now } : s)
  saveToLocalStorage(STORAGE_KEYS.strategies, updated)
  return updated.find(s => s.id === id) || null
}

export async function deleteStrategy(id: string): Promise<boolean> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { error } = await supabase
        .from('investment_strategies')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting strategy from Supabase:', error)
    }
  }

  const local = loadFromLocalStorage<InvestmentStrategy>(STORAGE_KEYS.strategies)
  saveToLocalStorage(STORAGE_KEYS.strategies, local.filter(s => s.id !== id))
  return true
}

// ============================================================================
// STRATEGY HOLDINGS OPERATIONS
// ============================================================================

export async function getStrategyHoldings(strategyId: string): Promise<StrategyHolding[]> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('strategy_holdings')
        .select('*')
        .eq('user_id', userId)
        .eq('strategy_id', strategyId)
        .order('buy_date', { ascending: false })

      if (error) throw error

      const holdings = (data || []).map(mapHoldingFromDb)
      return holdings
    } catch (error) {
      console.error('Error fetching holdings from Supabase:', error)
      const local = loadFromLocalStorage<StrategyHolding>(STORAGE_KEYS.holdings)
      return local.filter(h => h.strategyId === strategyId)
    }
  }

  const local = loadFromLocalStorage<StrategyHolding>(STORAGE_KEYS.holdings)
  return local.filter(h => h.strategyId === strategyId)
}

export async function addHoldingToStrategy(
  holding: Omit<StrategyHolding, 'id' | 'user_id' | 'createdAt' | 'updatedAt'>
): Promise<StrategyHolding | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  const newHolding: StrategyHolding = {
    ...holding,
    id: crypto.randomUUID(),
    user_id: userId || 'local',
    createdAt: now,
    updatedAt: now,
  }

  if (userId) {
    try {
      const dbHolding = mapHoldingToDb(newHolding)
      const { data, error } = await supabase
        .from('strategy_holdings')
        .insert([{ ...dbHolding, user_id: userId }])
        .select()
        .single()

      if (error) throw error
      return mapHoldingFromDb(data)
    } catch (error) {
      console.error('Error adding holding to strategy in Supabase:', error)
    }
  }

  const local = loadFromLocalStorage<StrategyHolding>(STORAGE_KEYS.holdings)
  saveToLocalStorage(STORAGE_KEYS.holdings, [newHolding, ...local])
  return newHolding
}

export async function updateStrategyHolding(
  id: string,
  updates: Partial<StrategyHolding>
): Promise<StrategyHolding | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  if (userId) {
    try {
      const dbUpdates = mapHoldingToDb({ ...updates, updatedAt: now } as StrategyHolding)
      const { data, error } = await supabase
        .from('strategy_holdings')
        .update(dbUpdates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return mapHoldingFromDb(data)
    } catch (error) {
      console.error('Error updating holding in Supabase:', error)
    }
  }

  const local = loadFromLocalStorage<StrategyHolding>(STORAGE_KEYS.holdings)
  const updated = local.map(h => h.id === id ? { ...h, ...updates, updatedAt: now } : h)
  saveToLocalStorage(STORAGE_KEYS.holdings, updated)
  return updated.find(h => h.id === id) || null
}

export async function deleteStrategyHolding(id: string): Promise<boolean> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { error } = await supabase
        .from('strategy_holdings')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting holding from Supabase:', error)
    }
  }

  const local = loadFromLocalStorage<StrategyHolding>(STORAGE_KEYS.holdings)
  saveToLocalStorage(STORAGE_KEYS.holdings, local.filter(h => h.id !== id))
  return true
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Get holdings nearing their sell date (within X days)
 */
export async function getHoldingsNearingSellDate(
  strategyId?: string,
  daysThreshold: number = 30
): Promise<Array<StrategyHolding & { investment?: Investment; daysUntilSell: number }>> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  try {
    // Get all active holdings
    let query = supabase
      .from('strategy_holdings')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .not('target_sell_date', 'is', null)

    if (strategyId) {
      query = query.eq('strategy_id', strategyId)
    }

    const { data: holdings, error } = await query

    if (error) throw error

    // Get investments for matching
    const investments = await getInvestments()
    const investmentMap = new Map(investments.map(i => [i.id, i]))

    const today = new Date()
    const result: Array<StrategyHolding & { investment?: Investment; daysUntilSell: number }> = []

    for (const h of holdings || []) {
      const holding = mapHoldingFromDb(h)
      if (!holding.targetSellDate) continue

      const targetDate = new Date(holding.targetSellDate)
      const daysUntil = Math.ceil(
        (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysUntil > 0 && daysUntil <= daysThreshold) {
        result.push({
          ...holding,
          investment: investmentMap.get(holding.investmentId),
          daysUntilSell: daysUntil,
        })
      }
    }

    return result.sort((a, b) => a.daysUntilSell - b.daysUntilSell)
  } catch (error) {
    console.error('Error fetching holdings nearing sell date:', error)
    return []
  }
}

/**
 * Calculate strategy performance
 */
export async function getStrategyPerformance(strategyId: string): Promise<{
  totalValue: number
  totalCost: number
  totalGain: number
  totalGainPercent: number
  holdingsCount: number
  activeCount: number
  soldCount: number
  winnersCount: number
  losersCount: number
  avgHoldingPeriodDays: number
}> {
  const holdings = await getStrategyHoldings(strategyId)
  const investments = await getInvestments()
  const investmentMap = new Map(investments.map(i => [i.id, i]))

  let totalValue = 0
  let totalCost = 0
  let totalGain = 0
  let winnersCount = 0
  let losersCount = 0
  let activeCount = 0
  let soldCount = 0
  let totalHoldingDays = 0
  let holdingsWithDays = 0

  for (const holding of holdings) {
    const investment = investmentMap.get(holding.investmentId)

    if (holding.status === 'active' && investment) {
      activeCount++
      totalValue += investment.market_value
      totalCost += investment.cost_basis
      const gain = investment.gain_loss
      totalGain += gain

      if (gain > 0) winnersCount++
      else if (gain < 0) losersCount++

      // Calculate holding period
      const buyDate = new Date(holding.buyDate)
      const today = new Date()
      const days = Math.floor((today.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24))
      totalHoldingDays += days
      holdingsWithDays++
    } else if (holding.status === 'sold') {
      soldCount++

      // Include sold performance if available
      if (holding.gainLoss !== undefined) {
        totalGain += holding.gainLoss
        if (holding.gainLoss > 0) winnersCount++
        else if (holding.gainLoss < 0) losersCount++
      }

      // Calculate holding period for sold positions
      if (holding.actualSellDate) {
        const buyDate = new Date(holding.buyDate)
        const sellDate = new Date(holding.actualSellDate)
        const days = Math.floor((sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24))
        totalHoldingDays += days
        holdingsWithDays++
      }
    }
  }

  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0
  const avgHoldingPeriodDays = holdingsWithDays > 0 ? totalHoldingDays / holdingsWithDays : 0

  return {
    totalValue,
    totalCost,
    totalGain,
    totalGainPercent,
    holdingsCount: holdings.length,
    activeCount,
    soldCount,
    winnersCount,
    losersCount,
    avgHoldingPeriodDays: Math.round(avgHoldingPeriodDays),
  }
}

/**
 * Get rebalance reminders for strategies
 */
export async function getRebalanceReminders(): Promise<
  Array<{ strategy: InvestmentStrategy; daysUntilRebalance: number; nextRebalanceDate: Date }>
> {
  const strategies = await getStrategies()
  const reminders: Array<{
    strategy: InvestmentStrategy
    daysUntilRebalance: number
    nextRebalanceDate: Date
  }> = []

  const today = new Date()

  for (const strategy of strategies) {
    if (!strategy.isActive || !strategy.parameters.rebalanceFrequency) continue

    // Calculate next rebalance date based on frequency and last update
    const lastUpdate = new Date(strategy.updatedAt)
    const nextRebalance = new Date(lastUpdate)

    switch (strategy.parameters.rebalanceFrequency) {
      case 'monthly':
        nextRebalance.setMonth(nextRebalance.getMonth() + 1)
        break
      case 'quarterly':
        nextRebalance.setMonth(nextRebalance.getMonth() + 3)
        break
      case 'semi_annually':
        nextRebalance.setMonth(nextRebalance.getMonth() + 6)
        break
      case 'annually':
        nextRebalance.setFullYear(nextRebalance.getFullYear() + 1)
        break
    }

    const daysUntil = Math.ceil(
      (nextRebalance.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Include if within 30 days
    if (daysUntil <= 30) {
      reminders.push({
        strategy,
        daysUntilRebalance: daysUntil,
        nextRebalanceDate: nextRebalance,
      })
    }
  }

  return reminders.sort((a, b) => a.daysUntilRebalance - b.daysUntilRebalance)
}

// ============================================================================
// DATABASE MAPPING HELPERS
// ============================================================================

function mapStrategyFromDb(data: Record<string, unknown>): InvestmentStrategy {
  return {
    id: data.id as string,
    user_id: data.user_id as string,
    name: data.name as string,
    description: data.description as string | undefined,
    type: data.type as InvestmentStrategy['type'],
    parameters: (data.parameters as InvestmentStrategy['parameters']) || {},
    linkedGoalId: data.linked_goal_id as string | undefined,
    isActive: data.is_active as boolean,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  }
}

function mapStrategyToDb(strategy: Partial<InvestmentStrategy>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (strategy.id !== undefined) result.id = strategy.id
  if (strategy.name !== undefined) result.name = strategy.name
  if (strategy.description !== undefined) result.description = strategy.description
  if (strategy.type !== undefined) result.type = strategy.type
  if (strategy.parameters !== undefined) result.parameters = strategy.parameters
  if (strategy.linkedGoalId !== undefined) result.linked_goal_id = strategy.linkedGoalId
  if (strategy.isActive !== undefined) result.is_active = strategy.isActive
  if (strategy.updatedAt !== undefined) result.updated_at = strategy.updatedAt

  return result
}

function mapHoldingFromDb(data: Record<string, unknown>): StrategyHolding {
  return {
    id: data.id as string,
    user_id: data.user_id as string,
    strategyId: data.strategy_id as string,
    investmentId: data.investment_id as string,
    buyDate: data.buy_date as string,
    targetSellDate: data.target_sell_date as string | undefined,
    actualSellDate: data.actual_sell_date as string | undefined,
    strategyMetrics: (data.strategy_metrics as StrategyHolding['strategyMetrics']) || undefined,
    status: data.status as StrategyHolding['status'],
    sellReason: data.sell_reason as string | undefined,
    buyValue: data.buy_value as number | undefined,
    currentValue: data.current_value as number | undefined,
    gainLoss: data.gain_loss as number | undefined,
    notes: data.notes as string | undefined,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  }
}

function mapHoldingToDb(holding: Partial<StrategyHolding>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (holding.id !== undefined) result.id = holding.id
  if (holding.strategyId !== undefined) result.strategy_id = holding.strategyId
  if (holding.investmentId !== undefined) result.investment_id = holding.investmentId
  if (holding.buyDate !== undefined) result.buy_date = holding.buyDate
  if (holding.targetSellDate !== undefined) result.target_sell_date = holding.targetSellDate
  if (holding.actualSellDate !== undefined) result.actual_sell_date = holding.actualSellDate
  if (holding.strategyMetrics !== undefined) result.strategy_metrics = holding.strategyMetrics
  if (holding.status !== undefined) result.status = holding.status
  if (holding.sellReason !== undefined) result.sell_reason = holding.sellReason
  if (holding.buyValue !== undefined) result.buy_value = holding.buyValue
  if (holding.currentValue !== undefined) result.current_value = holding.currentValue
  if (holding.gainLoss !== undefined) result.gain_loss = holding.gainLoss
  if (holding.notes !== undefined) result.notes = holding.notes
  if (holding.updatedAt !== undefined) result.updated_at = holding.updatedAt

  return result
}
