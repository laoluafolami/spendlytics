/**
 * Finance Data Service
 *
 * Unified data layer for Assets, Liabilities, and Investments
 * Migrates from localStorage to Supabase with offline fallback
 *
 * Features:
 * - CRUD operations for all finance data
 * - Automatic sync between localStorage and Supabase
 * - Offline support with queue
 * - Real-time subscriptions (optional)
 */

import { supabase } from '../lib/supabase'
import { Asset, Liability, Investment, NetWorthSnapshot } from '../types/finance'

// ============================================================================
// TYPES
// ============================================================================

export interface DataServiceOptions {
  useSupabase: boolean
  offlineMode: boolean
}

export interface SyncResult {
  success: boolean
  synced: number
  errors: string[]
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const STORAGE_KEYS = {
  assets: 'spendlytics_assets',
  liabilities: 'spendlytics_liabilities',
  investments: 'spendlytics_investments',
  netWorthSnapshots: 'spendlytics_net_worth_snapshots',
  syncQueue: 'spendlytics_sync_queue',
}

// Offline sync queue
interface SyncQueueItem {
  table: 'assets' | 'liabilities' | 'investments'
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

function saveToLocalStorage<T>(key: string, data: T[]): void {
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
// ASSETS OPERATIONS
// ============================================================================

export async function getAssets(): Promise<Asset[]> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Also save to localStorage for offline access
      saveToLocalStorage(STORAGE_KEYS.assets, data || [])
      return data || []
    } catch (error) {
      console.error('Error fetching assets from Supabase:', error)
      // Fall back to localStorage
      return loadFromLocalStorage<Asset>(STORAGE_KEYS.assets)
    }
  }

  return loadFromLocalStorage<Asset>(STORAGE_KEYS.assets)
}

export async function createAsset(asset: Omit<Asset, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Asset | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  const newAsset: Asset = {
    ...asset,
    id: crypto.randomUUID(),
    user_id: userId || 'local',
    is_active: true,
    created_at: now,
    updated_at: now,
  }

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('assets')
        .insert([{ ...newAsset, user_id: userId }])
        .select()
        .single()

      if (error) throw error

      // Update localStorage cache (don't add - will be fetched on next getAssets)
      return data
    } catch (error) {
      console.error('Error creating asset in Supabase:', error)
      // Add to sync queue for later
      addToSyncQueue({ table: 'assets', operation: 'insert', data: newAsset, timestamp: Date.now() })
      // Fall through to localStorage save
    }
  }

  // Save to localStorage (only when offline or Supabase failed)
  const localAssets = loadFromLocalStorage<Asset>(STORAGE_KEYS.assets)
  saveToLocalStorage(STORAGE_KEYS.assets, [newAsset, ...localAssets])

  return newAsset
}

export async function updateAsset(id: string, updates: Partial<Asset>): Promise<Asset | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('assets')
        .update({ ...updates, updated_at: now })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error updating asset in Supabase:', error)
      addToSyncQueue({ table: 'assets', operation: 'update', data: { id, ...updates }, timestamp: Date.now() })
      // Fall through to localStorage update
    }
  }

  // Update localStorage (only when offline or Supabase failed)
  const localAssets = loadFromLocalStorage<Asset>(STORAGE_KEYS.assets)
  const updatedLocal = localAssets.map(a => a.id === id ? { ...a, ...updates, updated_at: now } : a)
  saveToLocalStorage(STORAGE_KEYS.assets, updatedLocal)

  return updatedLocal.find(a => a.id === id) || null
}

export async function deleteAsset(id: string): Promise<boolean> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { error } = await supabase
        .from('assets')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('Error deleting asset from Supabase:', error)
      addToSyncQueue({ table: 'assets', operation: 'delete', data: { id }, timestamp: Date.now() })
      // Fall through to localStorage delete
    }
  }

  // Remove from localStorage (only when offline or Supabase failed)
  const localAssets = loadFromLocalStorage<Asset>(STORAGE_KEYS.assets)
  saveToLocalStorage(STORAGE_KEYS.assets, localAssets.filter(a => a.id !== id))

  return true
}

// ============================================================================
// LIABILITIES OPERATIONS
// ============================================================================

export async function getLiabilities(): Promise<Liability[]> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('liabilities')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      saveToLocalStorage(STORAGE_KEYS.liabilities, data || [])
      return data || []
    } catch (error) {
      console.error('Error fetching liabilities from Supabase:', error)
      return loadFromLocalStorage<Liability>(STORAGE_KEYS.liabilities)
    }
  }

  return loadFromLocalStorage<Liability>(STORAGE_KEYS.liabilities)
}

export async function createLiability(liability: Omit<Liability, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Liability | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  const newLiability: Liability = {
    ...liability,
    id: crypto.randomUUID(),
    user_id: userId || 'local',
    is_active: true,
    created_at: now,
    updated_at: now,
  }

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('liabilities')
        .insert([{ ...newLiability, user_id: userId }])
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error creating liability in Supabase:', error)
      addToSyncQueue({ table: 'liabilities', operation: 'insert', data: newLiability, timestamp: Date.now() })
      // Fall through to localStorage save
    }
  }

  // Save to localStorage (only when offline or Supabase failed)
  const localLiabilities = loadFromLocalStorage<Liability>(STORAGE_KEYS.liabilities)
  saveToLocalStorage(STORAGE_KEYS.liabilities, [newLiability, ...localLiabilities])

  return newLiability
}

export async function updateLiability(id: string, updates: Partial<Liability>): Promise<Liability | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('liabilities')
        .update({ ...updates, updated_at: now })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error updating liability in Supabase:', error)
      addToSyncQueue({ table: 'liabilities', operation: 'update', data: { id, ...updates }, timestamp: Date.now() })
      // Fall through to localStorage update
    }
  }

  // Update localStorage (only when offline or Supabase failed)
  const localLiabilities = loadFromLocalStorage<Liability>(STORAGE_KEYS.liabilities)
  const updatedLocal = localLiabilities.map(l => l.id === id ? { ...l, ...updates, updated_at: now } : l)
  saveToLocalStorage(STORAGE_KEYS.liabilities, updatedLocal)

  return updatedLocal.find(l => l.id === id) || null
}

export async function deleteLiability(id: string): Promise<boolean> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { error } = await supabase
        .from('liabilities')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('Error deleting liability from Supabase:', error)
      addToSyncQueue({ table: 'liabilities', operation: 'delete', data: { id }, timestamp: Date.now() })
      // Fall through to localStorage delete
    }
  }

  // Remove from localStorage (only when offline or Supabase failed)
  const localLiabilities = loadFromLocalStorage<Liability>(STORAGE_KEYS.liabilities)
  saveToLocalStorage(STORAGE_KEYS.liabilities, localLiabilities.filter(l => l.id !== id))

  return true
}

// ============================================================================
// INVESTMENTS OPERATIONS
// ============================================================================

export async function getInvestments(): Promise<Investment[]> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      saveToLocalStorage(STORAGE_KEYS.investments, data || [])
      return data || []
    } catch (error) {
      console.error('Error fetching investments from Supabase:', error)
      return loadFromLocalStorage<Investment>(STORAGE_KEYS.investments)
    }
  }

  return loadFromLocalStorage<Investment>(STORAGE_KEYS.investments)
}

export async function createInvestment(investment: Omit<Investment, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Investment | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  const newInvestment: Investment = {
    ...investment,
    id: crypto.randomUUID(),
    user_id: userId || 'local',
    created_at: now,
    updated_at: now,
  }

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('investments')
        .insert([{ ...newInvestment, user_id: userId }])
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error creating investment in Supabase:', error)
      addToSyncQueue({ table: 'investments', operation: 'insert', data: newInvestment, timestamp: Date.now() })
      // Fall through to localStorage save
    }
  }

  // Save to localStorage (only when offline or Supabase failed)
  const localInvestments = loadFromLocalStorage<Investment>(STORAGE_KEYS.investments)
  saveToLocalStorage(STORAGE_KEYS.investments, [newInvestment, ...localInvestments])

  return newInvestment
}

export async function updateInvestment(id: string, updates: Partial<Investment>): Promise<Investment | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('investments')
        .update({ ...updates, updated_at: now })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error updating investment in Supabase:', error)
      addToSyncQueue({ table: 'investments', operation: 'update', data: { id, ...updates }, timestamp: Date.now() })
      // Fall through to localStorage update
    }
  }

  // Update localStorage (only when offline or Supabase failed)
  const localInvestments = loadFromLocalStorage<Investment>(STORAGE_KEYS.investments)
  const updatedLocal = localInvestments.map(i => i.id === id ? { ...i, ...updates, updated_at: now } : i)
  saveToLocalStorage(STORAGE_KEYS.investments, updatedLocal)

  return updatedLocal.find(i => i.id === id) || null
}

export async function deleteInvestment(id: string): Promise<boolean> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { error } = await supabase
        .from('investments')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('Error deleting investment from Supabase:', error)
      addToSyncQueue({ table: 'investments', operation: 'delete', data: { id }, timestamp: Date.now() })
      // Fall through to localStorage delete
    }
  }

  // Remove from localStorage (only when offline or Supabase failed)
  const localInvestments = loadFromLocalStorage<Investment>(STORAGE_KEYS.investments)
  saveToLocalStorage(STORAGE_KEYS.investments, localInvestments.filter(i => i.id !== id))

  return true
}

export async function updateInvestmentPrices(updates: Array<{ id: string; current_price: number }>): Promise<void> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  // Update localStorage first for immediate UI update
  const localInvestments = loadFromLocalStorage<Investment>(STORAGE_KEYS.investments)
  const updatedLocal = localInvestments.map(inv => {
    const update = updates.find(u => u.id === inv.id)
    if (update) {
      const newPrice = update.current_price
      const marketValue = inv.shares * newPrice
      const gainLoss = marketValue - inv.cost_basis
      const gainLossPercent = inv.cost_basis > 0 ? (gainLoss / inv.cost_basis) * 100 : 0

      return {
        ...inv,
        current_price: newPrice,
        market_value: marketValue,
        gain_loss: gainLoss,
        gain_loss_percent: gainLossPercent,
        updated_at: now,
      }
    }
    return inv
  })
  saveToLocalStorage(STORAGE_KEYS.investments, updatedLocal)

  // Then update Supabase
  if (userId) {
    try {
      for (const update of updates) {
        const inv = updatedLocal.find(i => i.id === update.id)
        if (inv) {
          await supabase
            .from('investments')
            .update({
              current_price: inv.current_price,
              market_value: inv.market_value,
              gain_loss: inv.gain_loss,
              gain_loss_percent: inv.gain_loss_percent,
              updated_at: now,
            })
            .eq('id', update.id)
            .eq('user_id', userId)
        }
      }
    } catch (error) {
      console.error('Error updating investment prices in Supabase:', error)
    }
  }
}

// ============================================================================
// NET WORTH SNAPSHOTS
// ============================================================================

export async function saveNetWorthSnapshot(snapshot: Omit<NetWorthSnapshot, 'id' | 'user_id' | 'created_at'>): Promise<NetWorthSnapshot | null> {
  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  const newSnapshot: NetWorthSnapshot = {
    ...snapshot,
    id: crypto.randomUUID(),
    user_id: userId || 'local',
    created_at: now,
  }

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('net_worth_snapshots')
        .insert([{ ...newSnapshot, user_id: userId }])
        .select()
        .single()

      if (error) throw error

      const localSnapshots = loadFromLocalStorage<NetWorthSnapshot>(STORAGE_KEYS.netWorthSnapshots)
      saveToLocalStorage(STORAGE_KEYS.netWorthSnapshots, [data, ...localSnapshots])

      return data
    } catch (error) {
      console.error('Error saving net worth snapshot to Supabase:', error)
    }
  }

  const localSnapshots = loadFromLocalStorage<NetWorthSnapshot>(STORAGE_KEYS.netWorthSnapshots)
  saveToLocalStorage(STORAGE_KEYS.netWorthSnapshots, [newSnapshot, ...localSnapshots])

  return newSnapshot
}

export async function getNetWorthHistory(limit: number = 12): Promise<NetWorthSnapshot[]> {
  const userId = await getCurrentUserId()

  if (userId) {
    try {
      const { data, error } = await supabase
        .from('net_worth_snapshots')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(limit)

      if (error) throw error

      saveToLocalStorage(STORAGE_KEYS.netWorthSnapshots, data || [])
      return data || []
    } catch (error) {
      console.error('Error fetching net worth history from Supabase:', error)
      return loadFromLocalStorage<NetWorthSnapshot>(STORAGE_KEYS.netWorthSnapshots).slice(0, limit)
    }
  }

  return loadFromLocalStorage<NetWorthSnapshot>(STORAGE_KEYS.netWorthSnapshots).slice(0, limit)
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

export async function syncOfflineData(): Promise<SyncResult> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, synced: 0, errors: ['Not logged in'] }
  }

  const queue = loadFromLocalStorage<SyncQueueItem>(STORAGE_KEYS.syncQueue)
  if (queue.length === 0) {
    return { success: true, synced: 0, errors: [] }
  }

  const errors: string[] = []
  let synced = 0

  for (const item of queue) {
    try {
      switch (item.operation) {
        case 'insert':
          await supabase.from(item.table).insert([{ ...item.data, user_id: userId }])
          break
        case 'update':
          await supabase.from(item.table).update(item.data).eq('id', item.data.id).eq('user_id', userId)
          break
        case 'delete':
          if (item.table === 'investments') {
            await supabase.from(item.table).delete().eq('id', item.data.id).eq('user_id', userId)
          } else {
            await supabase.from(item.table).update({ is_active: false }).eq('id', item.data.id).eq('user_id', userId)
          }
          break
      }
      synced++
    } catch (error) {
      errors.push(`Failed to sync ${item.operation} on ${item.table}: ${error}`)
    }
  }

  // Clear synced items from queue
  if (synced > 0) {
    saveToLocalStorage(STORAGE_KEYS.syncQueue, [])
  }

  return { success: errors.length === 0, synced, errors }
}

export async function migrateFromLocalStorage(): Promise<SyncResult> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { success: false, synced: 0, errors: ['Not logged in'] }
  }

  const errors: string[] = []
  let synced = 0

  // Migrate assets
  const localAssets = loadFromLocalStorage<Asset>(STORAGE_KEYS.assets)
  for (const asset of localAssets) {
    if (asset.user_id === 'local') {
      try {
        await supabase.from('assets').insert([{ ...asset, user_id: userId }])
        synced++
      } catch (error) {
        errors.push(`Failed to migrate asset ${asset.name}: ${error}`)
      }
    }
  }

  // Migrate liabilities
  const localLiabilities = loadFromLocalStorage<Liability>(STORAGE_KEYS.liabilities)
  for (const liability of localLiabilities) {
    if (liability.user_id === 'local') {
      try {
        await supabase.from('liabilities').insert([{ ...liability, user_id: userId }])
        synced++
      } catch (error) {
        errors.push(`Failed to migrate liability ${liability.name}: ${error}`)
      }
    }
  }

  // Migrate investments
  const localInvestments = loadFromLocalStorage<Investment>(STORAGE_KEYS.investments)
  for (const investment of localInvestments) {
    if (investment.user_id === 'local') {
      try {
        await supabase.from('investments').insert([{ ...investment, user_id: userId }])
        synced++
      } catch (error) {
        errors.push(`Failed to migrate investment ${investment.symbol}: ${error}`)
      }
    }
  }

  return { success: errors.length === 0, synced, errors }
}
