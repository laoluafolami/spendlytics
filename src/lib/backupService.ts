/**
 * Comprehensive Backup & Restore Service
 * Ensures data is never lost - even if app is deleted
 *
 * IMPORTANT: When adding new data sources, update backupConfig.ts
 * The backup will automatically include any new tables/keys added there.
 */

import { supabase, sessionId } from './supabase';
import { getAll, STORES, getMetadata, setMetadata } from './offlineDB';
import {
  SUPABASE_TABLES,
  getAllLocalStorageKeys
} from './backupConfig';

// Backup format version for compatibility
const BACKUP_VERSION = '2.1.0'; // Updated version for config-driven backup
const BACKUP_MAGIC = 'WEALTHPULSE_BACKUP';

// Backup data structure
export interface BackupData {
  // Metadata
  meta: {
    magic: string;
    version: string;
    createdAt: string;
    appName: string;
    sessionId: string;
    userId?: string;
    checksum: string;
    dataCount: {
      expenses: number;
      income: number;
      budgets: number;
      savingsGoals: number;
      assets: number;
      liabilities: number;
      investments: number;
      netWorthSnapshots: number;
      filterPresets: number;
      settings: number;
    };
  };

  // Supabase data
  supabase: {
    expenses: unknown[];
    income: unknown[];
    budgets: unknown[];
    savingsGoals: unknown[];
    assets: unknown[];
    liabilities: unknown[];
    investments: unknown[];
    netWorthSnapshots: unknown[];
    filterPresets: unknown[];
    settings: unknown[];
  };

  // IndexedDB data (offline data)
  indexedDB: {
    expenses: unknown[];
    income: unknown[];
    categories: unknown[];
    syncQueue: unknown[];
    metadata: unknown[];
  };

  // localStorage data
  localStorage: Record<string, string | null>;
}

export interface BackupOptions {
  includeSupabase?: boolean;
  includeIndexedDB?: boolean;
  includeLocalStorage?: boolean;
  encrypt?: boolean;
  encryptionKey?: string;
}

export interface RestoreOptions {
  restoreSupabase?: boolean;
  restoreIndexedDB?: boolean;
  restoreLocalStorage?: boolean;
  mergeData?: boolean; // If true, merge with existing; if false, replace
  decryptionKey?: string;
}

export interface BackupResult {
  success: boolean;
  backup?: BackupData;
  error?: string;
  filename?: string;
  size?: number;
}

export interface RestoreResult {
  success: boolean;
  restored: {
    expenses: number;
    income: number;
    budgets: number;
    savingsGoals: number;
    assets: number;
    liabilities: number;
    investments: number;
    settings: number;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Generate a checksum for data integrity verification
 */
function generateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Simple encryption using XOR cipher (for basic protection)
 * For production, consider using Web Crypto API
 */
function encryptData(data: string, key: string): string {
  if (!key) return data;

  let encrypted = '';
  for (let i = 0; i < data.length; i++) {
    encrypted += String.fromCharCode(
      data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return btoa(encrypted); // Base64 encode
}

/**
 * Decrypt data
 */
function decryptData(encryptedData: string, key: string): string {
  if (!key) return encryptedData;

  try {
    const data = atob(encryptedData); // Base64 decode
    let decrypted = '';
    for (let i = 0; i < data.length; i++) {
      decrypted += String.fromCharCode(
        data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return decrypted;
  } catch {
    throw new Error('Decryption failed. Invalid key or corrupted data.');
  }
}

/**
 * Fetch all data from Supabase using config
 * Automatically includes any tables defined in backupConfig.ts
 */
async function fetchSupabaseData(): Promise<BackupData['supabase']> {
  const result: BackupData['supabase'] = {
    expenses: [],
    income: [],
    budgets: [],
    savingsGoals: [],
    assets: [],
    liabilities: [],
    investments: [],
    netWorthSnapshots: [],
    filterPresets: [],
    settings: []
  };

  try {
    // Dynamically fetch all tables from config
    for (const [key, config] of Object.entries(SUPABASE_TABLES)) {
      try {
        let query = supabase
          .from(config.table)
          .select('*')
          .eq(config.sessionField, sessionId);

        // Apply ordering if specified
        if (config.orderBy) {
          query = query.order(config.orderBy.field, { ascending: config.orderBy.ascending });
        }

        const { data, error } = await query;

        if (error) {
          console.warn(`[Backup] Error fetching ${key}:`, error.message);
        } else if (data) {
          // Map config key to result key
          (result as Record<string, unknown[]>)[key] = data;
        }
      } catch (tableError) {
        console.warn(`[Backup] Failed to fetch ${key}:`, tableError);
      }
    }
  } catch (error) {
    console.error('[Backup] Error fetching Supabase data:', error);
  }

  return result;
}

/**
 * Fetch all data from IndexedDB
 */
async function fetchIndexedDBData(): Promise<BackupData['indexedDB']> {
  const result: BackupData['indexedDB'] = {
    expenses: [],
    income: [],
    categories: [],
    syncQueue: [],
    metadata: []
  };

  try {
    result.expenses = await getAll(STORES.expenses);
    result.income = await getAll(STORES.income);
    result.categories = await getAll(STORES.categories);
    result.syncQueue = await getAll(STORES.syncQueue);

    // Get metadata items
    const metadataKeys = ['lastExpenseSync', 'lastIncomeSync', 'lastFullSync', 'lastBackup'];
    for (const key of metadataKeys) {
      const value = await getMetadata(key);
      if (value !== undefined) {
        result.metadata.push({ key, value });
      }
    }
  } catch (error) {
    console.error('[Backup] Error fetching IndexedDB data:', error);
  }

  return result;
}

/**
 * Fetch all data from localStorage using config
 * Automatically includes any keys defined in backupConfig.ts
 */
function fetchLocalStorageData(): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  const keys = getAllLocalStorageKeys();

  for (const key of keys) {
    result[key] = localStorage.getItem(key);
  }

  return result;
}

/**
 * Create a full backup of all app data
 */
export async function createBackup(
  options: BackupOptions = {},
  onProgress?: (status: string, percent: number) => void
): Promise<BackupResult> {
  const {
    includeSupabase = true,
    includeIndexedDB = true,
    includeLocalStorage = true,
    encrypt = false,
    encryptionKey
  } = options;

  try {
    onProgress?.('Starting backup...', 0);

    // Initialize backup structure
    const backup: BackupData = {
      meta: {
        magic: BACKUP_MAGIC,
        version: BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        appName: 'WealthPulse',
        sessionId: sessionId,
        userId: undefined,
        checksum: '',
        dataCount: {
          expenses: 0,
          income: 0,
          budgets: 0,
          savingsGoals: 0,
          assets: 0,
          liabilities: 0,
          investments: 0,
          netWorthSnapshots: 0,
          filterPresets: 0,
          settings: 0
        }
      },
      supabase: {
        expenses: [],
        income: [],
        budgets: [],
        savingsGoals: [],
        assets: [],
        liabilities: [],
        investments: [],
        netWorthSnapshots: [],
        filterPresets: [],
        settings: []
      },
      indexedDB: {
        expenses: [],
        income: [],
        categories: [],
        syncQueue: [],
        metadata: []
      },
      localStorage: {}
    };

    // Fetch Supabase data
    if (includeSupabase) {
      onProgress?.('Backing up cloud data...', 20);
      backup.supabase = await fetchSupabaseData();
      backup.meta.dataCount.expenses = backup.supabase.expenses.length;
      backup.meta.dataCount.income = backup.supabase.income.length;
      backup.meta.dataCount.budgets = backup.supabase.budgets.length;
      backup.meta.dataCount.savingsGoals = backup.supabase.savingsGoals.length;
      backup.meta.dataCount.assets = backup.supabase.assets.length;
      backup.meta.dataCount.liabilities = backup.supabase.liabilities.length;
      backup.meta.dataCount.investments = backup.supabase.investments.length;
      backup.meta.dataCount.netWorthSnapshots = backup.supabase.netWorthSnapshots.length;
      backup.meta.dataCount.filterPresets = backup.supabase.filterPresets.length;
      backup.meta.dataCount.settings = backup.supabase.settings.length;
    }

    // Fetch IndexedDB data
    if (includeIndexedDB) {
      onProgress?.('Backing up local data...', 50);
      backup.indexedDB = await fetchIndexedDBData();
    }

    // Fetch localStorage data
    if (includeLocalStorage) {
      onProgress?.('Backing up preferences...', 70);
      backup.localStorage = fetchLocalStorageData();
    }

    // Generate checksum (without the checksum field itself)
    onProgress?.('Generating checksum...', 85);
    const dataForChecksum = JSON.stringify({
      supabase: backup.supabase,
      indexedDB: backup.indexedDB,
      localStorage: backup.localStorage
    });
    backup.meta.checksum = generateChecksum(dataForChecksum);

    // Convert to JSON
    let backupString = JSON.stringify(backup, null, 2);

    // Encrypt if requested
    if (encrypt && encryptionKey) {
      onProgress?.('Encrypting backup...', 95);
      backupString = encryptData(backupString, encryptionKey);
    }

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const filename = `wealthpulse-backup-${date}${encrypt ? '.encrypted' : ''}.json`;

    // Record backup time
    await setMetadata('lastBackup', Date.now());

    onProgress?.('Backup complete!', 100);

    return {
      success: true,
      backup,
      filename,
      size: new Blob([backupString]).size
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Backup] Error creating backup:', error);
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Download backup as a file
 */
export async function downloadBackup(
  options: BackupOptions = {},
  onProgress?: (status: string, percent: number) => void
): Promise<{ success: boolean; error?: string }> {
  const result = await createBackup(options, onProgress);

  if (!result.success || !result.backup) {
    return { success: false, error: result.error };
  }

  try {
    // Convert to string
    let backupString = JSON.stringify(result.backup, null, 2);

    // Encrypt if requested
    if (options.encrypt && options.encryptionKey) {
      backupString = encryptData(backupString, options.encryptionKey);
    }

    // Create download
    const blob = new Blob([backupString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename || 'wealthpulse-backup.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Download failed';
    return { success: false, error: errorMessage };
  }
}

/**
 * Parse and validate a backup file
 */
export async function parseBackupFile(
  file: File,
  decryptionKey?: string
): Promise<{ valid: boolean; backup?: BackupData; error?: string }> {
  try {
    let content = await file.text();

    // Try to decrypt if it looks encrypted (starts with base64-like content)
    if (decryptionKey && !content.startsWith('{')) {
      try {
        content = decryptData(content, decryptionKey);
      } catch {
        return { valid: false, error: 'Decryption failed. Check your password.' };
      }
    }

    // Parse JSON
    let backup: BackupData;
    try {
      backup = JSON.parse(content);
    } catch {
      return { valid: false, error: 'Invalid backup file format.' };
    }

    // Validate magic number
    if (backup.meta?.magic !== BACKUP_MAGIC) {
      return { valid: false, error: 'Not a valid WealthPulse backup file.' };
    }

    // Validate version
    if (!backup.meta?.version) {
      return { valid: false, error: 'Backup version information missing.' };
    }

    // Verify checksum
    const dataForChecksum = JSON.stringify({
      supabase: backup.supabase,
      indexedDB: backup.indexedDB,
      localStorage: backup.localStorage
    });
    const calculatedChecksum = generateChecksum(dataForChecksum);
    if (calculatedChecksum !== backup.meta.checksum) {
      return { valid: false, error: 'Backup integrity check failed. File may be corrupted.' };
    }

    return { valid: true, backup };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, error: errorMessage };
  }
}

/**
 * Restore data from a backup
 */
export async function restoreFromBackup(
  backup: BackupData,
  options: RestoreOptions = {},
  onProgress?: (status: string, percent: number) => void
): Promise<RestoreResult> {
  const {
    restoreSupabase = true,
    restoreLocalStorage = true,
    mergeData = false
  } = options;

  const result: RestoreResult = {
    success: true,
    restored: {
      expenses: 0,
      income: 0,
      budgets: 0,
      savingsGoals: 0,
      assets: 0,
      liabilities: 0,
      investments: 0,
      settings: 0
    },
    errors: [],
    warnings: []
  };

  try {
    // Restore localStorage first (for session ID)
    if (restoreLocalStorage && backup.localStorage) {
      onProgress?.('Restoring preferences...', 10);

      for (const [key, value] of Object.entries(backup.localStorage)) {
        if (value !== null) {
          try {
            localStorage.setItem(key, value);
          } catch (error) {
            result.warnings.push(`Failed to restore localStorage key: ${key}`);
          }
        }
      }
    }

    // Restore Supabase data
    if (restoreSupabase && backup.supabase) {
      onProgress?.('Restoring cloud data...', 30);

      // Use the session ID from backup or current session
      const targetSessionId = backup.meta.sessionId || sessionId;

      // Restore expenses
      if (backup.supabase.expenses?.length > 0) {
        onProgress?.('Restoring expenses...', 35);

        if (!mergeData) {
          // Delete existing expenses first
          await supabase.from('app_expenses').delete().eq('session_id', targetSessionId);
        }

        // Insert expenses in batches
        const expenseBatches = chunkArray(backup.supabase.expenses as Record<string, unknown>[], 100);
        for (const batch of expenseBatches) {
          const preparedBatch = batch.map((e) => ({
            ...e,
            session_id: targetSessionId,
            id: mergeData ? e.id : undefined // Let DB generate new IDs if replacing
          }));

          const { error } = await supabase.from('app_expenses').upsert(preparedBatch);
          if (error) {
            result.errors.push(`Expenses: ${error.message}`);
          } else {
            result.restored.expenses += batch.length;
          }
        }
      }

      // Restore income
      if (backup.supabase.income?.length > 0) {
        onProgress?.('Restoring income...', 45);

        if (!mergeData) {
          await supabase.from('app_income').delete().eq('session_id', targetSessionId);
        }

        const incomeBatches = chunkArray(backup.supabase.income as Record<string, unknown>[], 100);
        for (const batch of incomeBatches) {
          const preparedBatch = batch.map((i) => ({
            ...i,
            session_id: targetSessionId,
            id: mergeData ? i.id : undefined
          }));

          const { error } = await supabase.from('app_income').upsert(preparedBatch);
          if (error) {
            result.errors.push(`Income: ${error.message}`);
          } else {
            result.restored.income += batch.length;
          }
        }
      }

      // Restore budgets
      if (backup.supabase.budgets?.length > 0) {
        onProgress?.('Restoring budgets...', 55);

        if (!mergeData) {
          await supabase.from('app_budgets').delete().eq('session_id', targetSessionId);
        }

        for (const budget of backup.supabase.budgets) {
          const { error } = await supabase.from('app_budgets').upsert({
            ...(budget as Record<string, unknown>),
            session_id: targetSessionId
          });
          if (error) {
            result.errors.push(`Budgets: ${error.message}`);
          } else {
            result.restored.budgets++;
          }
        }
      }

      // Restore savings goals
      if (backup.supabase.savingsGoals?.length > 0) {
        onProgress?.('Restoring savings goals...', 60);

        if (!mergeData) {
          await supabase.from('app_savings_goals').delete().eq('session_id', targetSessionId);
        }

        for (const goal of backup.supabase.savingsGoals) {
          const { error } = await supabase.from('app_savings_goals').upsert({
            ...(goal as Record<string, unknown>),
            session_id: targetSessionId
          });
          if (error) {
            result.errors.push(`Savings goals: ${error.message}`);
          } else {
            result.restored.savingsGoals++;
          }
        }
      }

      // Restore assets
      if (backup.supabase.assets?.length > 0) {
        onProgress?.('Restoring assets...', 70);

        if (!mergeData) {
          await supabase.from('assets').delete().eq('session_id', targetSessionId);
        }

        for (const asset of backup.supabase.assets) {
          const { error } = await supabase.from('assets').upsert({
            ...(asset as Record<string, unknown>),
            session_id: targetSessionId
          });
          if (error) {
            result.errors.push(`Assets: ${error.message}`);
          } else {
            result.restored.assets++;
          }
        }
      }

      // Restore liabilities
      if (backup.supabase.liabilities?.length > 0) {
        onProgress?.('Restoring liabilities...', 75);

        if (!mergeData) {
          await supabase.from('liabilities').delete().eq('session_id', targetSessionId);
        }

        for (const liability of backup.supabase.liabilities) {
          const { error } = await supabase.from('liabilities').upsert({
            ...(liability as Record<string, unknown>),
            session_id: targetSessionId
          });
          if (error) {
            result.errors.push(`Liabilities: ${error.message}`);
          } else {
            result.restored.liabilities++;
          }
        }
      }

      // Restore investments
      if (backup.supabase.investments?.length > 0) {
        onProgress?.('Restoring investments...', 80);

        if (!mergeData) {
          await supabase.from('investments').delete().eq('session_id', targetSessionId);
        }

        for (const investment of backup.supabase.investments) {
          const { error } = await supabase.from('investments').upsert({
            ...(investment as Record<string, unknown>),
            session_id: targetSessionId
          });
          if (error) {
            result.errors.push(`Investments: ${error.message}`);
          } else {
            result.restored.investments++;
          }
        }
      }

      // Restore settings
      if (backup.supabase.settings?.length > 0) {
        onProgress?.('Restoring settings...', 90);

        for (const setting of backup.supabase.settings) {
          const { error } = await supabase.from('app_settings').upsert({
            ...(setting as Record<string, unknown>),
            session_id: targetSessionId
          });
          if (error) {
            result.errors.push(`Settings: ${error.message}`);
          } else {
            result.restored.settings++;
          }
        }
      }
    }

    onProgress?.('Restore complete!', 100);

    // Check for any errors
    if (result.errors.length > 0) {
      result.success = false;
    }

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.success = false;
    result.errors.push(errorMessage);
    return result;
  }
}

/**
 * Helper function to chunk array for batch processing
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Get backup history from metadata
 */
export async function getLastBackupTime(): Promise<number | null> {
  const lastBackup = await getMetadata<number>('lastBackup');
  return lastBackup || null;
}

/**
 * Check if backup is recommended (e.g., more than 7 days since last backup)
 */
export async function isBackupRecommended(): Promise<boolean> {
  const lastBackup = await getLastBackupTime();
  if (!lastBackup) return true;

  const daysSinceBackup = (Date.now() - lastBackup) / (1000 * 60 * 60 * 24);
  return daysSinceBackup > 7;
}

/**
 * Get a summary of data that would be backed up
 */
export async function getBackupSummary(): Promise<{
  expenses: number;
  income: number;
  budgets: number;
  savingsGoals: number;
  assets: number;
  liabilities: number;
  investments: number;
  lastBackup: string | null;
}> {
  const supabaseData = await fetchSupabaseData();
  const lastBackup = await getLastBackupTime();

  return {
    expenses: supabaseData.expenses.length,
    income: supabaseData.income.length,
    budgets: supabaseData.budgets.length,
    savingsGoals: supabaseData.savingsGoals.length,
    assets: supabaseData.assets.length,
    liabilities: supabaseData.liabilities.length,
    investments: supabaseData.investments.length,
    lastBackup: lastBackup ? new Date(lastBackup).toLocaleDateString() : null
  };
}

export default {
  createBackup,
  downloadBackup,
  parseBackupFile,
  restoreFromBackup,
  getLastBackupTime,
  isBackupRecommended,
  getBackupSummary
};
