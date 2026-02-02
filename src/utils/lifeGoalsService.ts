/**
 * Life Goals Data Service
 *
 * Unified data layer for Life Goals, Categories, Milestones, and Drift Settings
 * Follows the same pattern as financeDataService with Supabase-first and localStorage fallback
 */

import { supabase } from '../lib/supabase'
import {
  LifeGoal,
  GoalCategory,
  GoalMilestone,
  GoalProgressSnapshot,
  UserDriftSettings,
  DEFAULT_DRIFT_SETTINGS,
  LinkedMetricType,
} from '../types/lifeGoals'
import { getAssets, getLiabilities, getInvestments } from './financeDataService'

// ============================================================================
// CONFIGURATION
// ============================================================================

const STORAGE_KEYS = {
  goals: 'spendlytics_life_goals',
  categories: 'spendlytics_goal_categories',
  milestones: 'spendlytics_goal_milestones',
  progress: 'spendlytics_goal_progress',
  driftSettings: 'spendlytics_drift_settings',
  syncQueue: 'spendlytics_life_goals_sync_queue',
}

interface SyncQueueItem {
  table: 'life_goals' | 'goal_categories' | 'goal_milestones' | 'goal_progress_snapshots' | 'user_drift_settings'
  operation: 'insert' | 'update' | 'delete'
  data: any
  timestamp: number
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

function loadSingleFromLocalStorage<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : null
  } catch (error) {
    console.error(`Error loading from localStorage (${key}):`, error)
    return null
  }
}

function saveToLocalStorage<T>(key: string, data: T[] | T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error(`Error saving to localStorage (${key}):`, error)
  }
}

function addToSyncQueue(item: SyncQueueItem): void {
  try {
    const queue = loadFromLocalStorage<SyncQueueItem>(STORAGE_KEYS.syncQueue)
    queue.push(item)
    saveToLocalStorage(STORAGE_KEYS.syncQueue, queue)
  } catch (error) {
    console.error('Error adding to sync queue:', error)
  }
}

// ============================================================================
// GOAL CATEGORIES OPERATIONS
// ============================================================================

export async function getGoalCategories(): Promise<GoalCategory[]> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('goal_categories')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error

      saveToLocalStorage(STORAGE_KEYS.categories, data || [])
      return data || []
    } catch (error) {
      console.error('Error fetching goal categories from Supabase:', error)
      return loadFromLocalStorage<GoalCategory>(STORAGE_KEYS.categories)
    }
  }

  return loadFromLocalStorage<GoalCategory>(STORAGE_KEYS.categories)
}

export async function createGoalCategory(
  category: Omit<GoalCategory, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<GoalCategory | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  const newCategory: GoalCategory = {
    ...category,
    id: crypto.randomUUID(),
    user_id: userId || 'local',
    created_at: now,
    updated_at: now,
  }

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('goal_categories')
        .insert([{ ...newCategory, user_id: userId }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating goal category in Supabase:', error)
      addToSyncQueue({ table: 'goal_categories', operation: 'insert', data: newCategory, timestamp: Date.now() })
    }
  }

  const localCategories = loadFromLocalStorage<GoalCategory>(STORAGE_KEYS.categories)
  saveToLocalStorage(STORAGE_KEYS.categories, [newCategory, ...localCategories])

  return newCategory
}

export async function updateGoalCategory(id: string, updates: Partial<GoalCategory>): Promise<GoalCategory | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('goal_categories')
        .update({ ...updates, updated_at: now })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating goal category in Supabase:', error)
      addToSyncQueue({ table: 'goal_categories', operation: 'update', data: { id, ...updates }, timestamp: Date.now() })
    }
  }

  const localCategories = loadFromLocalStorage<GoalCategory>(STORAGE_KEYS.categories)
  const updatedLocal = localCategories.map(c => c.id === id ? { ...c, ...updates, updated_at: now } : c)
  saveToLocalStorage(STORAGE_KEYS.categories, updatedLocal)

  return updatedLocal.find(c => c.id === id) || null
}

export async function deleteGoalCategory(id: string): Promise<boolean> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { error } = await supabase
        .from('goal_categories')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting goal category from Supabase:', error)
      addToSyncQueue({ table: 'goal_categories', operation: 'delete', data: { id }, timestamp: Date.now() })
    }
  }

  const localCategories = loadFromLocalStorage<GoalCategory>(STORAGE_KEYS.categories)
  saveToLocalStorage(STORAGE_KEYS.categories, localCategories.filter(c => c.id !== id))

  return true
}

// ============================================================================
// LIFE GOALS OPERATIONS
// ============================================================================

export async function getLifeGoals(): Promise<LifeGoal[]> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('life_goals')
        .select(`
          *,
          goal_categories (name)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Flatten the category name
      const goals = (data || []).map(g => ({
        ...g,
        category_name: g.goal_categories?.name || undefined,
        goal_categories: undefined,
      }))

      saveToLocalStorage(STORAGE_KEYS.goals, goals)
      return goals
    } catch (error) {
      console.error('Error fetching life goals from Supabase:', error)
      return loadFromLocalStorage<LifeGoal>(STORAGE_KEYS.goals)
    }
  }

  return loadFromLocalStorage<LifeGoal>(STORAGE_KEYS.goals)
}

export async function getLifeGoal(id: string): Promise<LifeGoal | null> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('life_goals')
        .select(`
          *,
          goal_categories (name)
        `)
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (error) throw error

      return {
        ...data,
        category_name: data.goal_categories?.name || undefined,
        goal_categories: undefined,
      }
    } catch (error) {
      console.error('Error fetching life goal from Supabase:', error)
      const localGoals = loadFromLocalStorage<LifeGoal>(STORAGE_KEYS.goals)
      return localGoals.find(g => g.id === id) || null
    }
  }

  const localGoals = loadFromLocalStorage<LifeGoal>(STORAGE_KEYS.goals)
  return localGoals.find(g => g.id === id) || null
}

export async function createLifeGoal(
  goal: Omit<LifeGoal, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<LifeGoal | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  const newGoal: LifeGoal = {
    ...goal,
    id: crypto.randomUUID(),
    user_id: userId || 'local',
    is_active: true,
    created_at: now,
    updated_at: now,
  }

  if (userId) {
    try {
      // Remove category_name before insert (it's denormalized)
      const { category_name: _category_name, ...goalData } = newGoal
      const { data, error } = await supabase
        .from('life_goals')
        .insert([{ ...goalData, user_id: userId }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating life goal in Supabase:', error)
      addToSyncQueue({ table: 'life_goals', operation: 'insert', data: newGoal, timestamp: Date.now() })
    }
  }

  const localGoals = loadFromLocalStorage<LifeGoal>(STORAGE_KEYS.goals)
  saveToLocalStorage(STORAGE_KEYS.goals, [newGoal, ...localGoals])

  return newGoal
}

export async function updateLifeGoal(id: string, updates: Partial<LifeGoal>): Promise<LifeGoal | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  // Remove denormalized fields
  const { category_name: _category_name, ...cleanUpdates } = updates

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('life_goals')
        .update({ ...cleanUpdates, updated_at: now })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating life goal in Supabase:', error)
      addToSyncQueue({ table: 'life_goals', operation: 'update', data: { id, ...cleanUpdates }, timestamp: Date.now() })
    }
  }

  const localGoals = loadFromLocalStorage<LifeGoal>(STORAGE_KEYS.goals)
  const updatedLocal = localGoals.map(g => g.id === id ? { ...g, ...updates, updated_at: now } : g)
  saveToLocalStorage(STORAGE_KEYS.goals, updatedLocal)

  return updatedLocal.find(g => g.id === id) || null
}

export async function deleteLifeGoal(id: string): Promise<boolean> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { error } = await supabase
        .from('life_goals')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting life goal from Supabase:', error)
      addToSyncQueue({ table: 'life_goals', operation: 'delete', data: { id }, timestamp: Date.now() })
    }
  }

  const localGoals = loadFromLocalStorage<LifeGoal>(STORAGE_KEYS.goals)
  saveToLocalStorage(STORAGE_KEYS.goals, localGoals.filter(g => g.id !== id))

  return true
}

// ============================================================================
// GOAL MILESTONES OPERATIONS
// ============================================================================

export async function getGoalMilestones(goalId: string): Promise<GoalMilestone[]> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('goal_milestones')
        .select('*')
        .eq('user_id', userId)
        .eq('goal_id', goalId)
        .order('sort_order', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error('Error fetching goal milestones from Supabase:', error)
      const localMilestones = loadFromLocalStorage<GoalMilestone>(STORAGE_KEYS.milestones)
      return localMilestones.filter(m => m.goal_id === goalId)
    }
  }

  const localMilestones = loadFromLocalStorage<GoalMilestone>(STORAGE_KEYS.milestones)
  return localMilestones.filter(m => m.goal_id === goalId)
}

export async function createGoalMilestone(
  milestone: Omit<GoalMilestone, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<GoalMilestone | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  const newMilestone: GoalMilestone = {
    ...milestone,
    id: crypto.randomUUID(),
    user_id: userId || 'local',
    created_at: now,
    updated_at: now,
  }

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('goal_milestones')
        .insert([{ ...newMilestone, user_id: userId }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating goal milestone in Supabase:', error)
      addToSyncQueue({ table: 'goal_milestones', operation: 'insert', data: newMilestone, timestamp: Date.now() })
    }
  }

  const localMilestones = loadFromLocalStorage<GoalMilestone>(STORAGE_KEYS.milestones)
  saveToLocalStorage(STORAGE_KEYS.milestones, [...localMilestones, newMilestone])

  return newMilestone
}

export async function updateGoalMilestone(id: string, updates: Partial<GoalMilestone>): Promise<GoalMilestone | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('goal_milestones')
        .update({ ...updates, updated_at: now })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating goal milestone in Supabase:', error)
      addToSyncQueue({ table: 'goal_milestones', operation: 'update', data: { id, ...updates }, timestamp: Date.now() })
    }
  }

  const localMilestones = loadFromLocalStorage<GoalMilestone>(STORAGE_KEYS.milestones)
  const updatedLocal = localMilestones.map(m => m.id === id ? { ...m, ...updates, updated_at: now } : m)
  saveToLocalStorage(STORAGE_KEYS.milestones, updatedLocal)

  return updatedLocal.find(m => m.id === id) || null
}

export async function deleteGoalMilestone(id: string): Promise<boolean> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { error } = await supabase
        .from('goal_milestones')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Error deleting goal milestone from Supabase:', error)
      addToSyncQueue({ table: 'goal_milestones', operation: 'delete', data: { id }, timestamp: Date.now() })
    }
  }

  const localMilestones = loadFromLocalStorage<GoalMilestone>(STORAGE_KEYS.milestones)
  saveToLocalStorage(STORAGE_KEYS.milestones, localMilestones.filter(m => m.id !== id))

  return true
}

// ============================================================================
// GOAL PROGRESS SNAPSHOTS
// ============================================================================

export async function saveGoalProgress(
  snapshot: Omit<GoalProgressSnapshot, 'id' | 'user_id' | 'created_at'>
): Promise<GoalProgressSnapshot | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  const newSnapshot: GoalProgressSnapshot = {
    ...snapshot,
    id: crypto.randomUUID(),
    user_id: userId || 'local',
    created_at: now,
  }

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('goal_progress_snapshots')
        .insert([{ ...newSnapshot, user_id: userId }])
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error saving goal progress snapshot to Supabase:', error)
    }
  }

  const localProgress = loadFromLocalStorage<GoalProgressSnapshot>(STORAGE_KEYS.progress)
  saveToLocalStorage(STORAGE_KEYS.progress, [newSnapshot, ...localProgress])

  return newSnapshot
}

export async function getGoalProgressHistory(goalId: string, limit: number = 30): Promise<GoalProgressSnapshot[]> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('goal_progress_snapshots')
        .select('*')
        .eq('user_id', userId)
        .eq('goal_id', goalId)
        .order('date', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching goal progress history from Supabase:', error)
      const localProgress = loadFromLocalStorage<GoalProgressSnapshot>(STORAGE_KEYS.progress)
      return localProgress.filter(p => p.goal_id === goalId).slice(0, limit)
    }
  }

  const localProgress = loadFromLocalStorage<GoalProgressSnapshot>(STORAGE_KEYS.progress)
  return localProgress.filter(p => p.goal_id === goalId).slice(0, limit)
}

// ============================================================================
// USER DRIFT SETTINGS
// ============================================================================

export async function getDriftSettings(): Promise<UserDriftSettings | null> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('user_drift_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

      if (data) {
        saveToLocalStorage(STORAGE_KEYS.driftSettings, data)
        return data
      }

      // Create default settings if none exist
      return await createDriftSettings(DEFAULT_DRIFT_SETTINGS)
    } catch (error) {
      console.error('Error fetching drift settings from Supabase:', error)
      return loadSingleFromLocalStorage<UserDriftSettings>(STORAGE_KEYS.driftSettings)
    }
  }

  return loadSingleFromLocalStorage<UserDriftSettings>(STORAGE_KEYS.driftSettings)
}

export async function createDriftSettings(
  settings: Omit<UserDriftSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<UserDriftSettings | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  const newSettings: UserDriftSettings = {
    ...settings,
    id: crypto.randomUUID(),
    user_id: userId || 'local',
    created_at: now,
    updated_at: now,
  }

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('user_drift_settings')
        .insert([{ ...newSettings, user_id: userId }])
        .select()
        .single()

      if (error) throw error

      saveToLocalStorage(STORAGE_KEYS.driftSettings, data)
      return data
    } catch (error) {
      console.error('Error creating drift settings in Supabase:', error)
      addToSyncQueue({ table: 'user_drift_settings', operation: 'insert', data: newSettings, timestamp: Date.now() })
    }
  }

  saveToLocalStorage(STORAGE_KEYS.driftSettings, newSettings)
  return newSettings
}

export async function updateDriftSettings(updates: Partial<UserDriftSettings>): Promise<UserDriftSettings | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('user_drift_settings')
        .update({ ...updates, updated_at: now })
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      saveToLocalStorage(STORAGE_KEYS.driftSettings, data)
      return data
    } catch (error) {
      console.error('Error updating drift settings in Supabase:', error)
      addToSyncQueue({ table: 'user_drift_settings', operation: 'update', data: updates, timestamp: Date.now() })
    }
  }

  const localSettings = loadSingleFromLocalStorage<UserDriftSettings>(STORAGE_KEYS.driftSettings)
  if (localSettings) {
    const updatedSettings = { ...localSettings, ...updates, updated_at: now }
    saveToLocalStorage(STORAGE_KEYS.driftSettings, updatedSettings)
    return updatedSettings
  }

  return null
}

// ============================================================================
// AUTO-SYNC: Fetch metrics from app data
// ============================================================================

/**
 * Fetch the current value of a linked metric from app data
 */
export async function getLinkedMetricValue(metric: LinkedMetricType): Promise<number> {
  try {
    switch (metric) {
      case 'net_worth': {
        const [assets, liabilities] = await Promise.all([getAssets(), getLiabilities()])
        const totalAssets = assets.reduce((sum, a) => sum + (a.value || 0), 0)
        const totalLiabilities = liabilities.reduce((sum, l) => sum + (l.current_balance || 0), 0)
        return totalAssets - totalLiabilities
      }

      case 'total_assets': {
        const assets = await getAssets()
        return assets.reduce((sum, a) => sum + (a.value || 0), 0)
      }

      case 'total_investments': {
        const investments = await getInvestments()
        return investments.reduce((sum, i) => sum + (i.market_value || 0), 0)
      }

      case 'total_real_estate': {
        const assets = await getAssets()
        return assets
          .filter(a => a.type === 'real_estate')
          .reduce((sum, a) => sum + (a.value || 0), 0)
      }

      case 'passive_income': {
        // Fetch income marked as passive (dividends, rental, royalties)
        const userId = await getCurrentUserId()
        if (!userId) return 0

        const { data } = await supabase
          .from('app_income')
          .select('amount, category')
          .eq('user_id', userId)
          .in('category', ['Dividends', 'Rental', 'Royalties', 'Investment', 'Other Passive'])

        if (!data) return 0

        // Calculate monthly average from last 3 months
        return data.reduce((sum, i) => sum + (i.amount || 0), 0) / 3
      }

      case 'total_income': {
        const userId = await getCurrentUserId()
        if (!userId) return 0

        // Get current month's income
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        const { data } = await supabase
          .from('app_income')
          .select('amount')
          .eq('user_id', userId)
          .gte('date', startOfMonth)

        if (!data) return 0
        return data.reduce((sum, i) => sum + (i.amount || 0), 0)
      }

      case 'savings_rate': {
        const userId = await getCurrentUserId()
        if (!userId) return 0

        // Calculate from current month
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        const [incomeResult, expenseResult] = await Promise.all([
          supabase.from('app_income').select('amount').eq('user_id', userId).gte('date', startOfMonth),
          supabase.from('expenses').select('amount').eq('user_id', userId).gte('date', startOfMonth)
        ])

        const totalIncome = (incomeResult.data || []).reduce((sum, i) => sum + (i.amount || 0), 0)
        const totalExpenses = (expenseResult.data || []).reduce((sum, e) => sum + (e.amount || 0), 0)

        if (totalIncome === 0) return 0
        return ((totalIncome - totalExpenses) / totalIncome) * 100
      }

      // NEW METRICS IMPLEMENTATION

      case 'total_liabilities': {
        const liabilities = await getLiabilities()
        return liabilities.reduce((sum, l) => sum + (l.current_balance || 0), 0)
      }

      case 'debt_free_progress': {
        // This metric requires an initial debt value to calculate progress
        // For now, we return 100 - (current_debt_as_percent_of_original)
        // The user should set the target_value to their initial debt amount
        const liabilities = await getLiabilities()
        const currentDebt = liabilities.reduce((sum, l) => sum + (l.current_balance || 0), 0)
        const initialDebt = liabilities.reduce((sum, l) => sum + (l.principal_amount || l.current_balance || 0), 0)

        if (initialDebt === 0) return 100 // No debt = 100% debt free
        const paidOff = initialDebt - currentDebt
        return Math.max(0, Math.min(100, (paidOff / initialDebt) * 100))
      }

      case 'investment_gain': {
        const investments = await getInvestments()
        return investments.reduce((sum, i) => sum + (i.gain_loss || 0), 0)
      }

      case 'portfolio_dividend_income': {
        const investments = await getInvestments()
        return investments.reduce((sum, inv) => {
          // Prefer dividend_per_share if available
          if (inv.dividend_per_share) {
            return sum + (inv.dividend_per_share * inv.shares)
          } else if (inv.dividend_yield && inv.market_value) {
            return sum + (inv.market_value * (inv.dividend_yield / 100))
          }
          return sum
        }, 0)
      }

      case 'emergency_fund_months': {
        const userId = await getCurrentUserId()
        if (!userId) return 0

        // Get liquid assets
        const assets = await getAssets()
        const liquidAssets = assets
          .filter(a => a.category === 'liquid' || a.type === 'cash' || a.type === 'bank_account')
          .reduce((sum, a) => sum + (a.value || 0), 0)

        // Calculate average monthly expenses (last 3 months)
        const now = new Date()
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString()

        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount')
          .eq('user_id', userId)
          .gte('date', threeMonthsAgo)

        if (!expenses || expenses.length === 0) return 0
        const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
        const monthlyExpenses = totalExpenses / 3

        if (monthlyExpenses === 0) return 0
        return liquidAssets / monthlyExpenses
      }

      case 'portfolio_count': {
        const investments = await getInvestments()
        return investments.length
      }

      case 'real_estate_units': {
        const assets = await getAssets()
        return assets.filter(a => a.type === 'real_estate').length
      }

      case 'winners_count': {
        const investments = await getInvestments()
        return investments.filter(i => i.gain_loss > 0).length
      }

      case 'portfolio_yield_on_cost': {
        const investments = await getInvestments()
        const totalDividends = investments.reduce((sum, inv) => {
          if (inv.dividend_per_share) {
            return sum + (inv.dividend_per_share * inv.shares)
          } else if (inv.dividend_yield && inv.market_value) {
            return sum + (inv.market_value * (inv.dividend_yield / 100))
          }
          return sum
        }, 0)
        const totalCostBasis = investments.reduce((sum, i) => sum + (i.cost_basis || 0), 0)

        if (totalCostBasis === 0) return 0
        return (totalDividends / totalCostBasis) * 100
      }

      case 'custom':
      default:
        return 0
    }
  } catch (error) {
    console.error(`Error fetching metric ${metric}:`, error)
    return 0
  }
}

/**
 * Sync all goals that have linked metrics - auto-update their current values
 */
export async function syncLinkedGoals(): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = []
  let synced = 0

  try {
    const goals = await getLifeGoals()
    const linkedGoals = goals.filter(g => g.linked_metric && g.is_active && g.status !== 'completed')

    for (const goal of linkedGoals) {
      try {
        const metricValue = await getLinkedMetricValue(goal.linked_metric!)

        // Apply multiplier if set
        const adjustedValue = metricValue * (goal.linked_metric_multiplier || 1)

        // Only update if value changed
        if (Math.abs(adjustedValue - goal.current_value) > 0.01) {
          await updateLifeGoal(goal.id, { current_value: adjustedValue })
          synced++
        }
      } catch (error) {
        errors.push(`Failed to sync goal "${goal.title}": ${error}`)
      }
    }
  } catch (error) {
    errors.push(`Failed to fetch goals: ${error}`)
  }

  return { synced, errors }
}

/**
 * Get all metric values at once (for dashboard display)
 */
export async function getAllMetricValues(): Promise<Record<LinkedMetricType, number>> {
  const metrics: LinkedMetricType[] = [
    // Existing
    'net_worth', 'total_assets', 'total_investments', 'passive_income',
    'savings_rate', 'total_income', 'total_real_estate', 'custom',
    // New metrics
    'total_liabilities', 'debt_free_progress', 'investment_gain',
    'portfolio_dividend_income', 'emergency_fund_months', 'portfolio_count',
    'real_estate_units', 'winners_count', 'portfolio_yield_on_cost'
  ]

  const values: Record<string, number> = {}

  await Promise.all(
    metrics.map(async (metric) => {
      values[metric] = await getLinkedMetricValue(metric)
    })
  )

  return values as Record<LinkedMetricType, number>
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate goal progress percentage
 */
export function calculateGoalProgress(goal: LifeGoal): number {
  if (goal.target_type === 'boolean') {
    return goal.current_value >= 100 ? 100 : 0
  }

  if (goal.target_type === 'numeric' && goal.target_value && goal.target_value > 0) {
    const progress = (goal.current_value / goal.target_value) * 100
    return Math.min(100, Math.max(0, progress))
  }

  return 0
}

/**
 * Calculate days until target date
 */
export function daysUntilTarget(goal: LifeGoal): number | null {
  if (!goal.target_date) return null

  const target = new Date(goal.target_date)
  const today = new Date()
  const diffTime = target.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Determine if goal is drifting (behind schedule)
 */
export function isGoalDrifting(goal: LifeGoal, settings: UserDriftSettings): 'none' | 'warning' | 'critical' {
  if (goal.status === 'completed' || goal.status === 'paused') return 'none'
  if (!goal.target_date || !goal.start_date) return 'none'

  const progress = calculateGoalProgress(goal)
  const start = new Date(goal.start_date)
  const target = new Date(goal.target_date)
  const today = new Date()

  // Calculate expected progress based on time elapsed
  const totalDuration = target.getTime() - start.getTime()
  const elapsed = today.getTime() - start.getTime()
  const expectedProgress = (elapsed / totalDuration) * 100

  // How far behind are we?
  const drift = expectedProgress - progress

  // Convert drift percentage to estimated days behind
  const daysPerPercent = totalDuration / (1000 * 60 * 60 * 24 * 100)
  const daysBehind = drift * daysPerPercent

  if (daysBehind >= settings.critical_threshold_days) return 'critical'
  if (daysBehind >= settings.warning_threshold_days) return 'warning'

  return 'none'
}

/**
 * Format currency value
 */
export function formatGoalValue(value: number, unit?: string): string {
  if (unit === '$' || unit?.toLowerCase().includes('$')) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value)
  }

  if (unit === '%') {
    return `${value.toFixed(1)}%`
  }

  return `${value.toLocaleString()} ${unit || ''}`.trim()
}
