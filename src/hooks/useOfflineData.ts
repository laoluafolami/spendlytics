/**
 * Offline-First Data Hooks
 * React hooks for offline-aware data access
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, sessionId } from '../lib/supabase';
import {
  getAllExpenses,
  getAllIncome,
  saveExpenseLocally,
  saveIncomeLocally,
  deleteExpenseLocally,
  deleteIncomeLocally,
  cacheExpenses,
  cacheIncome,
  hasLocalData as checkHasLocalData,
  getUnsyncedCount,
  type OfflineExpense,
  type OfflineIncome
} from '../lib/offlineDB';
import {
  subscribeSyncStatus,
  forceSyncNow,
  type SyncStatus
} from '../lib/syncService';

// ===== SYNC STATUS HOOK =====

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    error: null
  });

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus(setStatus);
    return unsubscribe;
  }, []);

  const sync = useCallback(async () => {
    return forceSyncNow();
  }, []);

  return { ...status, sync };
}

// ===== EXPENSES HOOK =====

export interface UseExpensesOptions {
  autoFetch?: boolean;
  limit?: number;
}

export interface UseExpensesReturn {
  expenses: OfflineExpense[];
  isLoading: boolean;
  isOnline: boolean;
  error: string | null;
  hasLocalChanges: boolean;
  addExpense: (expense: Omit<OfflineExpense, 'id' | 'created_at' | 'updated_at' | 'session_id' | '_synced'>) => Promise<OfflineExpense>;
  updateExpense: (id: string, updates: Partial<OfflineExpense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useExpenses(options: UseExpensesOptions = {}): UseExpensesReturn {
  const { autoFetch = true, limit = 500 } = options;

  const [expenses, setExpenses] = useState<OfflineExpense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const fetchedRef = useRef(false);

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load data
  const loadExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Always load from local first (instant)
      const localExpenses = await getAllExpenses(sessionId);
      setExpenses(localExpenses);

      // Check for local changes
      const unsynced = await getUnsyncedCount();
      setHasLocalChanges(unsynced.expenses > 0);

      // If online and not fetched yet, fetch from remote
      if (navigator.onLine && !fetchedRef.current) {
        try {
          const { data: remoteExpenses, error: fetchError } = await supabase
            .from('app_expenses')
            .select('*')
            .eq('session_id', sessionId)
            .order('date', { ascending: false })
            .limit(limit);

          if (fetchError) {
            console.error('[useExpenses] Remote fetch error:', fetchError);
          } else if (remoteExpenses) {
            // Cache remote data
            await cacheExpenses(remoteExpenses as OfflineExpense[]);
            // Reload merged data
            const mergedExpenses = await getAllExpenses(sessionId);
            setExpenses(mergedExpenses);
            fetchedRef.current = true;
          }
        } catch (err) {
          console.error('[useExpenses] Failed to fetch remote:', err);
          // Continue with local data
        }
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load expenses';
      setError(message);
      console.error('[useExpenses] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      loadExpenses();
    }
  }, [autoFetch, loadExpenses]);

  // Refetch when coming online
  useEffect(() => {
    if (isOnline && !fetchedRef.current) {
      loadExpenses();
    }
  }, [isOnline, loadExpenses]);

  // Add expense
  const addExpense = useCallback(async (
    expenseData: Omit<OfflineExpense, 'id' | 'created_at' | 'updated_at' | 'session_id' | '_synced'>
  ): Promise<OfflineExpense> => {
    const now = new Date().toISOString();
    const newExpense: Omit<OfflineExpense, '_synced'> = {
      ...expenseData,
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      session_id: sessionId,
      created_at: now,
      updated_at: now
    };

    // Save locally first (works offline)
    const savedExpense = await saveExpenseLocally(newExpense);

    // Update UI immediately
    setExpenses(prev => [savedExpense, ...prev]);
    setHasLocalChanges(true);

    // If online, trigger sync (non-blocking)
    if (navigator.onLine) {
      forceSyncNow().catch(console.error);
    }

    return savedExpense;
  }, []);

  // Update expense
  const updateExpense = useCallback(async (id: string, updates: Partial<OfflineExpense>) => {
    const existing = expenses.find(e => e.id === id);
    if (!existing) return;

    const updated: OfflineExpense = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
      _synced: false
    };

    await saveExpenseLocally(updated, true);
    setExpenses(prev => prev.map(e => e.id === id ? updated : e));
    setHasLocalChanges(true);

    if (navigator.onLine) {
      forceSyncNow().catch(console.error);
    }
  }, [expenses]);

  // Delete expense
  const deleteExpense = useCallback(async (id: string) => {
    await deleteExpenseLocally(id);
    setExpenses(prev => prev.filter(e => e.id !== id));

    if (navigator.onLine) {
      forceSyncNow().catch(console.error);
    }
  }, []);

  // Refresh
  const refresh = useCallback(async () => {
    fetchedRef.current = false;
    await loadExpenses();
  }, [loadExpenses]);

  return {
    expenses,
    isLoading,
    isOnline,
    error,
    hasLocalChanges,
    addExpense,
    updateExpense,
    deleteExpense,
    refresh
  };
}

// ===== INCOME HOOK =====

export interface UseIncomeOptions {
  autoFetch?: boolean;
  limit?: number;
}

export interface UseIncomeReturn {
  income: OfflineIncome[];
  isLoading: boolean;
  isOnline: boolean;
  error: string | null;
  hasLocalChanges: boolean;
  addIncome: (income: Omit<OfflineIncome, 'id' | 'created_at' | 'updated_at' | 'session_id' | '_synced'>) => Promise<OfflineIncome>;
  updateIncome: (id: string, updates: Partial<OfflineIncome>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useIncome(options: UseIncomeOptions = {}): UseIncomeReturn {
  const { autoFetch = true, limit = 500 } = options;

  const [income, setIncome] = useState<OfflineIncome[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const fetchedRef = useRef(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadIncome = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load from local first
      const localIncome = await getAllIncome(sessionId);
      setIncome(localIncome);

      const unsynced = await getUnsyncedCount();
      setHasLocalChanges(unsynced.income > 0);

      // Fetch from remote if online
      if (navigator.onLine && !fetchedRef.current) {
        try {
          const { data: remoteIncome, error: fetchError } = await supabase
            .from('app_income')
            .select('*')
            .eq('session_id', sessionId)
            .order('date', { ascending: false })
            .limit(limit);

          if (fetchError) {
            console.error('[useIncome] Remote fetch error:', fetchError);
          } else if (remoteIncome) {
            await cacheIncome(remoteIncome as OfflineIncome[]);
            const mergedIncome = await getAllIncome(sessionId);
            setIncome(mergedIncome);
            fetchedRef.current = true;
          }
        } catch (err) {
          console.error('[useIncome] Failed to fetch remote:', err);
        }
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load income';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    if (autoFetch) {
      loadIncome();
    }
  }, [autoFetch, loadIncome]);

  useEffect(() => {
    if (isOnline && !fetchedRef.current) {
      loadIncome();
    }
  }, [isOnline, loadIncome]);

  const addIncome = useCallback(async (
    incomeData: Omit<OfflineIncome, 'id' | 'created_at' | 'updated_at' | 'session_id' | '_synced'>
  ): Promise<OfflineIncome> => {
    const now = new Date().toISOString();
    const newIncome: Omit<OfflineIncome, '_synced'> = {
      ...incomeData,
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      session_id: sessionId,
      created_at: now,
      updated_at: now
    };

    const savedIncome = await saveIncomeLocally(newIncome);
    setIncome(prev => [savedIncome, ...prev]);
    setHasLocalChanges(true);

    if (navigator.onLine) {
      forceSyncNow().catch(console.error);
    }

    return savedIncome;
  }, []);

  const updateIncome = useCallback(async (id: string, updates: Partial<OfflineIncome>) => {
    const existing = income.find(i => i.id === id);
    if (!existing) return;

    const updated: OfflineIncome = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
      _synced: false
    };

    await saveIncomeLocally(updated, true);
    setIncome(prev => prev.map(i => i.id === id ? updated : i));
    setHasLocalChanges(true);

    if (navigator.onLine) {
      forceSyncNow().catch(console.error);
    }
  }, [income]);

  const deleteIncome = useCallback(async (id: string) => {
    await deleteIncomeLocally(id);
    setIncome(prev => prev.filter(i => i.id !== id));

    if (navigator.onLine) {
      forceSyncNow().catch(console.error);
    }
  }, []);

  const refresh = useCallback(async () => {
    fetchedRef.current = false;
    await loadIncome();
  }, [loadIncome]);

  return {
    income,
    isLoading,
    isOnline,
    error,
    hasLocalChanges,
    addIncome,
    updateIncome,
    deleteIncome,
    refresh
  };
}

// ===== OFFLINE STATUS HOOK =====

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasLocalData, setHasLocalData] = useState(false);
  const [pendingChanges, setPendingChanges] = useState({ expenses: 0, income: 0, total: 0 });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check local data
    checkHasLocalData().then(setHasLocalData);

    // Check pending changes
    getUnsyncedCount().then(setPendingChanges);

    // Subscribe to sync status for pending count updates
    const unsubscribe = subscribeSyncStatus(() => {
      getUnsyncedCount().then(setPendingChanges);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  return {
    isOnline,
    hasLocalData,
    pendingChanges,
    canWorkOffline: hasLocalData
  };
}

export default {
  useExpenses,
  useIncome,
  useSyncStatus,
  useOfflineStatus
};
