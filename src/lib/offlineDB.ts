/**
 * Offline Database Service
 * IndexedDB wrapper for local data storage with offline support
 */

const DB_NAME = 'wealthpulse-offline';
const DB_VERSION = 1;

// Store names
export const STORES = {
  expenses: 'expenses',
  income: 'income',
  categories: 'categories',
  syncQueue: 'sync-queue',
  metadata: 'metadata'
} as const;

// Sync operation types
export type SyncOperation = 'create' | 'update' | 'delete';

export interface SyncQueueItem {
  id: string;
  store: keyof typeof STORES;
  operation: SyncOperation;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  error?: string;
}

export interface OfflineExpense {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  merchant?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  session_id: string;
  user_id?: string;
  _synced: boolean;
  _localOnly?: boolean;
  _deleted?: boolean;
}

export interface OfflineIncome {
  id: string;
  amount: number;
  source: string;
  description?: string;
  date: string;
  category?: string;
  is_recurring: boolean;
  recurrence_period?: string;
  created_at: string;
  updated_at: string;
  session_id: string;
  user_id?: string;
  _synced: boolean;
  _localOnly?: boolean;
  _deleted?: boolean;
}

export interface OfflineCategory {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  type: 'expense' | 'income';
  _synced: boolean;
}

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize and get the database instance
 */
export async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineDB] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[OfflineDB] Database opened successfully');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log('[OfflineDB] Upgrading database schema...');

      // Expenses store
      if (!db.objectStoreNames.contains(STORES.expenses)) {
        const expenseStore = db.createObjectStore(STORES.expenses, { keyPath: 'id' });
        expenseStore.createIndex('date', 'date', { unique: false });
        expenseStore.createIndex('category', 'category', { unique: false });
        expenseStore.createIndex('session_id', 'session_id', { unique: false });
        expenseStore.createIndex('_synced', '_synced', { unique: false });
      }

      // Income store
      if (!db.objectStoreNames.contains(STORES.income)) {
        const incomeStore = db.createObjectStore(STORES.income, { keyPath: 'id' });
        incomeStore.createIndex('date', 'date', { unique: false });
        incomeStore.createIndex('source', 'source', { unique: false });
        incomeStore.createIndex('session_id', 'session_id', { unique: false });
        incomeStore.createIndex('_synced', '_synced', { unique: false });
      }

      // Categories store
      if (!db.objectStoreNames.contains(STORES.categories)) {
        const categoryStore = db.createObjectStore(STORES.categories, { keyPath: 'id' });
        categoryStore.createIndex('type', 'type', { unique: false });
        categoryStore.createIndex('name', 'name', { unique: false });
      }

      // Sync queue store
      if (!db.objectStoreNames.contains(STORES.syncQueue)) {
        const syncStore = db.createObjectStore(STORES.syncQueue, { keyPath: 'id' });
        syncStore.createIndex('store', 'store', { unique: false });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Metadata store (for last sync times, etc.)
      if (!db.objectStoreNames.contains(STORES.metadata)) {
        db.createObjectStore(STORES.metadata, { keyPath: 'key' });
      }

      console.log('[OfflineDB] Database schema upgraded');
    };
  });

  return dbPromise;
}

/**
 * Generic store operations
 */
async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  const db = await getDB();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

/**
 * Add or update an item in a store
 */
export async function put<T extends { id: string }>(storeName: string, item: T): Promise<T> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(item);
    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get an item by ID
 */
export async function get<T>(storeName: string, id: string): Promise<T | undefined> {
  const store = await getStore(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all items from a store
 */
export async function getAll<T>(storeName: string): Promise<T[]> {
  const store = await getStore(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get items by index value
 */
export async function getByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const store = await getStore(storeName, 'readonly');
  const index = store.index(indexName);
  return new Promise((resolve, reject) => {
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete an item by ID
 */
export async function remove(storeName: string, id: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all items from a store
 */
export async function clear(storeName: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Count items in a store
 */
export async function count(storeName: string): Promise<number> {
  const store = await getStore(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ===== SYNC QUEUE OPERATIONS =====

/**
 * Add an operation to the sync queue
 */
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<SyncQueueItem> {
  const queueItem: SyncQueueItem = {
    ...item,
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    retryCount: 0
  };
  await put(STORES.syncQueue, queueItem);
  console.log('[OfflineDB] Added to sync queue:', queueItem.operation, item.store);
  return queueItem;
}

/**
 * Get all pending sync operations
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const items = await getAll<SyncQueueItem>(STORES.syncQueue);
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Remove a processed item from the sync queue
 */
export async function removeFromSyncQueue(id: string): Promise<void> {
  await remove(STORES.syncQueue, id);
  console.log('[OfflineDB] Removed from sync queue:', id);
}

/**
 * Update retry count for a failed sync item
 */
export async function updateSyncRetry(id: string, error: string): Promise<void> {
  const item = await get<SyncQueueItem>(STORES.syncQueue, id);
  if (item) {
    item.retryCount++;
    item.error = error;
    await put(STORES.syncQueue, item);
  }
}

/**
 * Get count of pending sync operations
 */
export async function getPendingSyncCount(): Promise<number> {
  return count(STORES.syncQueue);
}

// ===== METADATA OPERATIONS =====

interface MetadataItem {
  key: string;
  value: unknown;
  updatedAt: number;
}

/**
 * Set a metadata value
 */
export async function setMetadata(key: string, value: unknown): Promise<void> {
  const store = await getStore(STORES.metadata, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put({
      key,
      value,
      updatedAt: Date.now()
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a metadata value
 */
export async function getMetadata<T>(key: string): Promise<T | undefined> {
  const store = await getStore(STORES.metadata, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => {
      const item = request.result as MetadataItem | undefined;
      resolve(item?.value as T | undefined);
    };
    request.onerror = () => reject(request.error);
  });
}

// ===== EXPENSE OPERATIONS =====

/**
 * Save expense locally (with optional sync queue)
 */
export async function saveExpenseLocally(
  expense: Omit<OfflineExpense, '_synced'>,
  addToQueue = true
): Promise<OfflineExpense> {
  const localExpense: OfflineExpense = {
    ...expense,
    _synced: false,
    _localOnly: true
  };

  await put(STORES.expenses, localExpense);

  if (addToQueue) {
    await addToSyncQueue({
      store: 'expenses',
      operation: 'create',
      data: expense as unknown as Record<string, unknown>
    });
  }

  return localExpense;
}

/**
 * Get all expenses (including unsynced)
 */
export async function getAllExpenses(sessionId?: string): Promise<OfflineExpense[]> {
  let expenses = await getAll<OfflineExpense>(STORES.expenses);

  // Filter out deleted items
  expenses = expenses.filter(e => !e._deleted);

  // Filter by session if provided
  if (sessionId) {
    expenses = expenses.filter(e => e.session_id === sessionId);
  }

  // Sort by date descending
  return expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Mark expense as synced
 */
export async function markExpenseSynced(id: string, remoteId?: string): Promise<void> {
  const expense = await get<OfflineExpense>(STORES.expenses, id);
  if (expense) {
    expense._synced = true;
    expense._localOnly = false;
    if (remoteId && remoteId !== id) {
      // Update with remote ID if different
      await remove(STORES.expenses, id);
      expense.id = remoteId;
    }
    await put(STORES.expenses, expense);
  }
}

/**
 * Soft delete expense locally
 */
export async function deleteExpenseLocally(id: string, addToQueue = true): Promise<void> {
  const expense = await get<OfflineExpense>(STORES.expenses, id);
  if (expense) {
    if (expense._localOnly) {
      // If never synced, just delete locally
      await remove(STORES.expenses, id);
    } else {
      // Mark as deleted for sync
      expense._deleted = true;
      await put(STORES.expenses, expense);

      if (addToQueue) {
        await addToSyncQueue({
          store: 'expenses',
          operation: 'delete',
          data: { id }
        });
      }
    }
  }
}

// ===== INCOME OPERATIONS =====

/**
 * Save income locally (with optional sync queue)
 */
export async function saveIncomeLocally(
  income: Omit<OfflineIncome, '_synced'>,
  addToQueue = true
): Promise<OfflineIncome> {
  const localIncome: OfflineIncome = {
    ...income,
    _synced: false,
    _localOnly: true
  };

  await put(STORES.income, localIncome);

  if (addToQueue) {
    await addToSyncQueue({
      store: 'income',
      operation: 'create',
      data: income as unknown as Record<string, unknown>
    });
  }

  return localIncome;
}

/**
 * Get all income (including unsynced)
 */
export async function getAllIncome(sessionId?: string): Promise<OfflineIncome[]> {
  let incomeList = await getAll<OfflineIncome>(STORES.income);

  // Filter out deleted items
  incomeList = incomeList.filter(i => !i._deleted);

  // Filter by session if provided
  if (sessionId) {
    incomeList = incomeList.filter(i => i.session_id === sessionId);
  }

  // Sort by date descending
  return incomeList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Mark income as synced
 */
export async function markIncomeSynced(id: string, remoteId?: string): Promise<void> {
  const income = await get<OfflineIncome>(STORES.income, id);
  if (income) {
    income._synced = true;
    income._localOnly = false;
    if (remoteId && remoteId !== id) {
      await remove(STORES.income, id);
      income.id = remoteId;
    }
    await put(STORES.income, income);
  }
}

/**
 * Soft delete income locally
 */
export async function deleteIncomeLocally(id: string, addToQueue = true): Promise<void> {
  const income = await get<OfflineIncome>(STORES.income, id);
  if (income) {
    if (income._localOnly) {
      await remove(STORES.income, id);
    } else {
      income._deleted = true;
      await put(STORES.income, income);

      if (addToQueue) {
        await addToSyncQueue({
          store: 'income',
          operation: 'delete',
          data: { id }
        });
      }
    }
  }
}

// ===== BULK OPERATIONS =====

/**
 * Cache remote data locally (for offline viewing)
 */
export async function cacheExpenses(expenses: OfflineExpense[]): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction(STORES.expenses, 'readwrite');
  const store = transaction.objectStore(STORES.expenses);

  for (const expense of expenses) {
    // Don't overwrite local unsynced changes
    const existing = await new Promise<OfflineExpense | undefined>((resolve) => {
      const request = store.get(expense.id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });

    if (!existing || existing._synced) {
      store.put({ ...expense, _synced: true, _localOnly: false });
    }
  }

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  await setMetadata('lastExpenseSync', Date.now());
  console.log('[OfflineDB] Cached', expenses.length, 'expenses');
}

/**
 * Cache remote income data locally
 */
export async function cacheIncome(incomeList: OfflineIncome[]): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction(STORES.income, 'readwrite');
  const store = transaction.objectStore(STORES.income);

  for (const income of incomeList) {
    const existing = await new Promise<OfflineIncome | undefined>((resolve) => {
      const request = store.get(income.id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });

    if (!existing || existing._synced) {
      store.put({ ...income, _synced: true, _localOnly: false });
    }
  }

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  await setMetadata('lastIncomeSync', Date.now());
  console.log('[OfflineDB] Cached', incomeList.length, 'income records');
}

/**
 * Get unsynced items count
 */
export async function getUnsyncedCount(): Promise<{ expenses: number; income: number; total: number }> {
  // Get all items and filter by _synced === false (can't use index for booleans)
  const allExpenses = await getAll<OfflineExpense>(STORES.expenses);
  const allIncome = await getAll<OfflineIncome>(STORES.income);

  const expenseCount = allExpenses.filter(e => !e._synced && !e._deleted).length;
  const incomeCount = allIncome.filter(i => !i._synced && !i._deleted).length;

  return {
    expenses: expenseCount,
    income: incomeCount,
    total: expenseCount + incomeCount
  };
}

/**
 * Check if database has any cached data
 */
export async function hasLocalData(): Promise<boolean> {
  const expenseCount = await count(STORES.expenses);
  const incomeCount = await count(STORES.income);
  return expenseCount > 0 || incomeCount > 0;
}

// Initialize database on module load
getDB().catch(console.error);

export default {
  getDB,
  put,
  get,
  getAll,
  getByIndex,
  remove,
  clear,
  count,
  STORES
};
