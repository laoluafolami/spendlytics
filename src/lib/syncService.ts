/**
 * Sync Service
 * Handles bidirectional sync between IndexedDB and Supabase
 */

import { supabase, sessionId } from './supabase';
import {
  getSyncQueue,
  removeFromSyncQueue,
  updateSyncRetry,
  markExpenseSynced,
  markIncomeSynced,
  cacheExpenses,
  cacheIncome,
  getUnsyncedCount,
  getPendingSyncCount,
  setMetadata,
  getMetadata,
  type SyncQueueItem,
  type OfflineExpense,
  type OfflineIncome
} from './offlineDB';

// Sync configuration
const SYNC_CONFIG = {
  maxRetries: 5,
  retryDelay: 1000, // Base delay in ms (exponential backoff)
  batchSize: 50,
  syncInterval: 30000 // 30 seconds
};

// Sync state
let isSyncing = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;
const syncListeners: Set<(status: SyncStatus) => void> = new Set();

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  error: string | null;
}

let currentStatus: SyncStatus = {
  isOnline: navigator.onLine,
  isSyncing: false,
  pendingCount: 0,
  lastSyncTime: null,
  error: null
};

/**
 * Subscribe to sync status changes
 */
export function subscribeSyncStatus(callback: (status: SyncStatus) => void): () => void {
  syncListeners.add(callback);
  callback(currentStatus); // Immediate callback with current status
  return () => syncListeners.delete(callback);
}

/**
 * Update and broadcast sync status
 */
async function updateStatus(updates: Partial<SyncStatus>): Promise<void> {
  const pendingCount = await getPendingSyncCount();
  currentStatus = {
    ...currentStatus,
    ...updates,
    pendingCount,
    isOnline: navigator.onLine
  };
  syncListeners.forEach(cb => cb(currentStatus));
}

/**
 * Initialize sync service
 */
export async function initSyncService(): Promise<void> {
  console.log('[Sync] Initializing sync service...');

  // Load last sync time
  const lastSync = await getMetadata<number>('lastFullSync');
  await updateStatus({ lastSyncTime: lastSync || null });

  // Set up online/offline listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Start periodic sync if online
  if (navigator.onLine) {
    startPeriodicSync();
    // Initial sync
    await performFullSync();
  }

  // Register for background sync if supported
  registerBackgroundSync();

  console.log('[Sync] Sync service initialized');
}

/**
 * Handle coming online
 */
async function handleOnline(): Promise<void> {
  console.log('[Sync] Back online');
  await updateStatus({ isOnline: true, error: null });
  startPeriodicSync();

  // Trigger immediate sync
  await performFullSync();

  // Notify service worker
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'ONLINE' });
  }
}

/**
 * Handle going offline
 */
async function handleOffline(): Promise<void> {
  console.log('[Sync] Gone offline');
  await updateStatus({ isOnline: false });
  stopPeriodicSync();
}

/**
 * Start periodic sync
 */
function startPeriodicSync(): void {
  if (syncInterval) return;

  syncInterval = setInterval(async () => {
    if (navigator.onLine && !isSyncing) {
      await performFullSync();
    }
  }, SYNC_CONFIG.syncInterval);

  console.log('[Sync] Periodic sync started');
}

/**
 * Stop periodic sync
 */
function stopPeriodicSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[Sync] Periodic sync stopped');
  }
}

/**
 * Register for background sync
 */
async function registerBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> }
      }).sync.register('sync-transactions');
      console.log('[Sync] Background sync registered');
    }
  } catch (error) {
    console.warn('[Sync] Background sync registration failed:', error);
  }
}

/**
 * Perform a full sync (push local changes, pull remote data)
 */
export async function performFullSync(): Promise<boolean> {
  if (isSyncing || !navigator.onLine) {
    return false;
  }

  isSyncing = true;
  await updateStatus({ isSyncing: true, error: null });

  try {
    console.log('[Sync] Starting full sync...');

    // 1. Push local changes first
    await processSyncQueue();

    // 2. Pull remote data
    await pullRemoteData();

    // Update last sync time
    const now = Date.now();
    await setMetadata('lastFullSync', now);
    await updateStatus({
      isSyncing: false,
      lastSyncTime: now,
      error: null
    });

    console.log('[Sync] Full sync completed');
    return true;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Sync failed';
    console.error('[Sync] Full sync failed:', error);
    await updateStatus({ isSyncing: false, error: errorMessage });
    return false;

  } finally {
    isSyncing = false;
  }
}

/**
 * Process the sync queue (push local changes)
 */
async function processSyncQueue(): Promise<void> {
  const queue = await getSyncQueue();

  if (queue.length === 0) {
    console.log('[Sync] No pending items in queue');
    return;
  }

  console.log('[Sync] Processing', queue.length, 'queued items...');

  for (const item of queue) {
    if (item.retryCount >= SYNC_CONFIG.maxRetries) {
      console.warn('[Sync] Max retries reached, skipping:', item.id);
      continue;
    }

    try {
      await processSyncItem(item);
      await removeFromSyncQueue(item.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Sync] Failed to process item:', item.id, error);
      await updateSyncRetry(item.id, errorMessage);

      // Exponential backoff
      const delay = SYNC_CONFIG.retryDelay * Math.pow(2, item.retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Process a single sync queue item
 */
async function processSyncItem(item: SyncQueueItem): Promise<void> {
  console.log('[Sync] Processing:', item.operation, item.store, item.data);

  switch (item.store) {
    case 'expenses':
      await syncExpenseItem(item);
      break;
    case 'income':
      await syncIncomeItem(item);
      break;
    default:
      console.warn('[Sync] Unknown store:', item.store);
  }
}

/**
 * Sync an expense item
 */
async function syncExpenseItem(item: SyncQueueItem): Promise<void> {
  const data = item.data as Partial<OfflineExpense>;

  switch (item.operation) {
    case 'create': {
      // Remove local-only fields before sending
      const { _synced, _localOnly, _deleted, ...expenseData } = data as OfflineExpense;

      const { data: result, error } = await supabase
        .from('app_expenses')
        .insert(expenseData)
        .select()
        .single();

      if (error) throw error;

      if (result) {
        await markExpenseSynced(data.id!, result.id);
      }
      break;
    }

    case 'update': {
      const { _synced, _localOnly, _deleted, ...expenseData } = data as OfflineExpense;

      const { error } = await supabase
        .from('app_expenses')
        .update(expenseData)
        .eq('id', data.id);

      if (error) throw error;
      await markExpenseSynced(data.id!);
      break;
    }

    case 'delete': {
      const { error } = await supabase
        .from('app_expenses')
        .delete()
        .eq('id', data.id);

      if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" errors
      break;
    }
  }
}

/**
 * Sync an income item
 */
async function syncIncomeItem(item: SyncQueueItem): Promise<void> {
  const data = item.data as Partial<OfflineIncome>;

  switch (item.operation) {
    case 'create': {
      const { _synced, _localOnly, _deleted, ...incomeData } = data as OfflineIncome;

      const { data: result, error } = await supabase
        .from('app_income')
        .insert(incomeData)
        .select()
        .single();

      if (error) throw error;

      if (result) {
        await markIncomeSynced(data.id!, result.id);
      }
      break;
    }

    case 'update': {
      const { _synced, _localOnly, _deleted, ...incomeData } = data as OfflineIncome;

      const { error } = await supabase
        .from('app_income')
        .update(incomeData)
        .eq('id', data.id);

      if (error) throw error;
      await markIncomeSynced(data.id!);
      break;
    }

    case 'delete': {
      const { error } = await supabase
        .from('app_income')
        .delete()
        .eq('id', data.id);

      if (error && error.code !== 'PGRST116') throw error;
      break;
    }
  }
}

/**
 * Pull remote data and cache locally
 */
async function pullRemoteData(): Promise<void> {
  console.log('[Sync] Pulling remote data...');

  // Get last sync times
  const lastExpenseSync = await getMetadata<number>('lastExpenseSync');
  const lastIncomeSync = await getMetadata<number>('lastIncomeSync');

  // Fetch expenses
  try {
    let query = supabase
      .from('app_expenses')
      .select('*')
      .eq('session_id', sessionId)
      .order('date', { ascending: false })
      .limit(500);

    // Only fetch updated records if we have synced before
    if (lastExpenseSync) {
      query = query.gte('updated_at', new Date(lastExpenseSync).toISOString());
    }

    const { data: expenses, error } = await query;

    if (error) {
      console.error('[Sync] Error fetching expenses:', error);
    } else if (expenses && expenses.length > 0) {
      await cacheExpenses(expenses as OfflineExpense[]);
    }
  } catch (error) {
    console.error('[Sync] Failed to pull expenses:', error);
  }

  // Fetch income
  try {
    let query = supabase
      .from('app_income')
      .select('*')
      .eq('session_id', sessionId)
      .order('date', { ascending: false })
      .limit(500);

    if (lastIncomeSync) {
      query = query.gte('updated_at', new Date(lastIncomeSync).toISOString());
    }

    const { data: income, error } = await query;

    if (error) {
      console.error('[Sync] Error fetching income:', error);
    } else if (income && income.length > 0) {
      await cacheIncome(income as OfflineIncome[]);
    }
  } catch (error) {
    console.error('[Sync] Failed to pull income:', error);
  }
}

/**
 * Force sync now (manual trigger)
 */
export async function forceSyncNow(): Promise<boolean> {
  if (!navigator.onLine) {
    console.warn('[Sync] Cannot sync while offline');
    return false;
  }
  return performFullSync();
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return { ...currentStatus };
}

/**
 * Get pending changes summary
 */
export async function getPendingChanges(): Promise<{
  expenses: number;
  income: number;
  total: number;
}> {
  return getUnsyncedCount();
}

/**
 * Check if there are pending local changes
 */
export async function hasPendingChanges(): Promise<boolean> {
  const count = await getPendingSyncCount();
  return count > 0;
}

// Clean up on module unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    stopPeriodicSync();
  });
}

export default {
  initSyncService,
  performFullSync,
  forceSyncNow,
  getSyncStatus,
  subscribeSyncStatus,
  getPendingChanges,
  hasPendingChanges
};
