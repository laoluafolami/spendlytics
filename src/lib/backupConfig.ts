/**
 * Backup Configuration
 *
 * IMPORTANT: When you add new Supabase tables or localStorage keys,
 * add them here to ensure they're included in backups.
 *
 * This is the SINGLE SOURCE OF TRUTH for all data that needs to be backed up.
 */

/**
 * All Supabase tables that should be backed up
 *
 * When adding a new table:
 * 1. Add a new entry to SUPABASE_TABLES
 * 2. Set the correct sessionField (usually 'session_id' or 'user_id')
 * 3. Set orderBy if you want sorted results
 */
export const SUPABASE_TABLES = {
  // Core financial data - uses 'expenses' table with user_id (main app tables)
  expenses: {
    table: 'expenses',
    sessionField: 'user_id',
    orderBy: { field: 'date', ascending: false },
    description: 'All expense transactions'
  },
  income: {
    table: 'app_income',
    sessionField: 'user_id',
    orderBy: { field: 'date', ascending: false },
    description: 'All income entries'
  },
  budgets: {
    table: 'budgets',
    sessionField: 'user_id',
    orderBy: null,
    description: 'Budget allocations by category'
  },
  savingsGoals: {
    table: 'savings_goals',
    sessionField: 'user_id',
    orderBy: null,
    description: 'Savings goals and progress'
  },

  // Net worth tracking - uses user_id for authenticated users
  assets: {
    table: 'assets',
    sessionField: 'user_id',
    orderBy: { field: 'created_at', ascending: false },
    description: 'Financial assets'
  },
  liabilities: {
    table: 'liabilities',
    sessionField: 'user_id',
    orderBy: { field: 'created_at', ascending: false },
    description: 'Debts and loans'
  },
  investments: {
    table: 'investments',
    sessionField: 'user_id',
    orderBy: { field: 'created_at', ascending: false },
    description: 'Investment holdings'
  },
  netWorthSnapshots: {
    table: 'net_worth_snapshots',
    sessionField: 'user_id',
    orderBy: { field: 'date', ascending: false },
    description: 'Historical net worth records'
  },

  // App configuration
  filterPresets: {
    table: 'filter_presets',
    sessionField: 'user_id',
    orderBy: null,
    description: 'Saved filter configurations'
  },
  settings: {
    table: 'user_settings',
    sessionField: 'user_id',
    orderBy: null,
    description: 'User feature settings'
  },

  // Categories (if you add custom categories table)
  // customCategories: {
  //   table: 'app_custom_categories',
  //   sessionField: 'session_id',
  //   orderBy: { field: 'name', ascending: true },
  //   description: 'User-defined categories'
  // },

  // Recurring transactions (if you add this feature)
  // recurringTransactions: {
  //   table: 'app_recurring_transactions',
  //   sessionField: 'session_id',
  //   orderBy: { field: 'next_date', ascending: true },
  //   description: 'Recurring transaction templates'
  // },

  // Add new tables here following the same pattern:
  // newFeature: {
  //   table: 'app_new_feature',
  //   sessionField: 'session_id',
  //   orderBy: null,
  //   description: 'Description of what this stores'
  // },

} as const;

/**
 * All localStorage keys that should be backed up
 *
 * When adding a new localStorage key in your app:
 * 1. Add it to the appropriate category below
 * 2. Add a description for documentation
 */
export const LOCALSTORAGE_KEYS = {
  // Session & Identity
  session: {
    keys: ['expense_tracker_session_id'],
    description: 'User session identifiers'
  },

  // UI Preferences
  theme: {
    keys: ['expense-tracker-theme'],
    description: 'Theme preference (light/dark)'
  },

  // Currency & Localization
  currency: {
    keys: [
      'expense-tracker-currency',
      'expense-tracker-auto-refresh-rates',
      'spendlytics_exchange_rates'
    ],
    description: 'Currency settings and exchange rate cache'
  },

  // API Keys & Integrations
  apiKeys: {
    keys: ['gemini_api_key'],
    description: 'External service API keys',
    sensitive: true // Mark as sensitive for potential encryption
  },

  // Income Allocation
  allocation: {
    keys: [
      'spendlytics_allocation_buckets',
      'spendlytics_monthly_income',
      'spendlytics_use_actual_income',
      'spendlytics_time_period',
      'spendlytics_category_mapping'
    ],
    description: 'Income allocation settings'
  },

  // Investment Settings
  investments: {
    keys: ['spendlytics_auto_refresh_prices'],
    description: 'Investment tracking preferences'
  },

  // Custom Categories
  customCategories: {
    keys: [
      'wealthpulse_custom_expense_categories',
      'wealthpulse_custom_income_categories'
    ],
    description: 'User-defined custom categories for expenses and income'
  },

  // Local Data Cache (for offline support)
  localCache: {
    keys: [
      'spendlytics_assets',
      'spendlytics_liabilities',
      'spendlytics_investments',
      'spendlytics_net_worth_snapshots',
      'spendlytics_networth_history'
    ],
    description: 'Cached data for offline access'
  },

  // Migration tracking
  migration: {
    keys: [], // Dynamic keys like 'spendlytics_data_migrated_{userId}'
    pattern: /^spendlytics_data_migrated_/,
    description: 'Data migration status'
  },

  // PWA Installation (optional - usually not needed for restore)
  pwa: {
    keys: [
      'pwa-install-last-dismissed',
      'pwa-install-dismiss-count',
      'pwa-installed',
      'pwa-install-never-show'
    ],
    description: 'PWA installation prompts',
    optional: true // Not critical for data restore
  },

  // Add new localStorage keys here:
  // newFeature: {
  //   keys: ['spendlytics_new_feature_setting'],
  //   description: 'Description of what this stores'
  // },

} as const;

/**
 * IndexedDB stores configuration
 * Usually you don't need to modify this unless you add new IndexedDB stores
 */
export const INDEXEDDB_STORES = {
  expenses: {
    store: 'expenses',
    description: 'Offline expenses cache'
  },
  income: {
    store: 'income',
    description: 'Offline income cache'
  },
  categories: {
    store: 'categories',
    description: 'Category definitions'
  },
  syncQueue: {
    store: 'sync-queue',
    description: 'Pending sync operations'
  },
  metadata: {
    store: 'metadata',
    description: 'Sync metadata and timestamps'
  }
} as const;

/**
 * Get all localStorage keys to backup (including pattern-matched keys)
 */
export function getAllLocalStorageKeys(): string[] {
  const keys: string[] = [];

  for (const category of Object.values(LOCALSTORAGE_KEYS)) {
    // Add explicit keys
    if (category.keys) {
      keys.push(...category.keys);
    }

    // Add pattern-matched keys
    if ('pattern' in category && category.pattern) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && category.pattern.test(key)) {
          keys.push(key);
        }
      }
    }
  }

  return [...new Set(keys)]; // Remove duplicates
}

/**
 * Get table names for display purposes
 */
export function getTableDisplayNames(): Record<string, string> {
  const names: Record<string, string> = {};
  for (const [key, config] of Object.entries(SUPABASE_TABLES)) {
    names[key] = config.description;
  }
  return names;
}

/**
 * Validate that all configured tables exist
 * (useful for debugging)
 */
export async function validateBackupConfig(): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // This is a simple validation - in production you might want to
  // actually query the tables to ensure they exist

  for (const [key, config] of Object.entries(SUPABASE_TABLES)) {
    if (!config.table) {
      errors.push(`Missing table name for: ${key}`);
    }
    if (!config.sessionField) {
      errors.push(`Missing sessionField for: ${key}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  SUPABASE_TABLES,
  LOCALSTORAGE_KEYS,
  INDEXEDDB_STORES,
  getAllLocalStorageKeys,
  getTableDisplayNames,
  validateBackupConfig
};
