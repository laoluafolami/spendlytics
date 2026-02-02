import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, DollarSign, Check, Target, TrendingUp, CreditCard, Tag, Receipt, Repeat, Filter, Bell, BarChart2, FileText, Upload, Download, Sparkles, Coins, Trash2, AlertTriangle, Loader2, Cloud, CloudOff, RefreshCw, CheckCircle, Shield, HardDrive, Smartphone, ArrowDownCircle } from 'lucide-react'
import { isBackupRecommended, getLastBackupTime } from '../lib/backupService'
import { useCurrency, CURRENCIES } from '../contexts/CurrencyContext'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const { currency, setCurrency, refreshRates, isLoadingRates, lastRateUpdate, autoRefreshEnabled, setAutoRefreshEnabled } = useCurrency()
  const { settings, updateSettings, loading } = useSettings()
  const { user, migrationStatus, triggerMigration } = useAuth()

  // Data management state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteType, setDeleteType] = useState<'expenses' | 'income' | 'all' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)

  // Cloud sync state
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null)

  // Backup state
  const [backupNeeded, setBackupNeeded] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null)

  // App update state
  const [checkingForUpdates, setCheckingForUpdates] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'available' | 'up-to-date' | 'error'>('idle')
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)
  const APP_VERSION = '5.19' // Should match sw.js CACHE_VERSION

  // Check backup status on mount
  useEffect(() => {
    const checkBackupStatus = async () => {
      const needed = await isBackupRecommended()
      setBackupNeeded(needed)
      const lastBackupTime = await getLastBackupTime()
      if (lastBackupTime) {
        setLastBackup(new Date(lastBackupTime).toLocaleDateString())
      }
    }
    checkBackupStatus()
  }, [])

  // Handle manual sync
  const handleManualSync = async () => {
    setIsSyncing(true)
    setSyncSuccess(null)
    try {
      const result = await triggerMigration()
      if (result.success) {
        setSyncSuccess(result.synced > 0
          ? `Synced ${result.synced} item(s) to cloud`
          : 'All data is already synced')
      } else if (result.errors.length > 0) {
        setSyncSuccess(`Sync completed with errors: ${result.errors[0]}`)
      }
      setTimeout(() => setSyncSuccess(null), 5000)
    } catch (error) {
      console.error('Sync error:', error)
      setSyncSuccess('Sync failed. Please try again.')
      setTimeout(() => setSyncSuccess(null), 5000)
    } finally {
      setIsSyncing(false)
    }
  }

  // Check for app updates
  const handleCheckForUpdates = async () => {
    setCheckingForUpdates(true)
    setUpdateStatus('idle')
    setUpdateMessage('Checking for updates...')

    try {
      if (!('serviceWorker' in navigator)) {
        setUpdateStatus('error')
        setUpdateMessage('Service workers not supported in this browser')
        return
      }

      // Clear any cooldown that might block updates
      localStorage.removeItem('sw_refresh_cooldown')

      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) {
        setUpdateStatus('error')
        setUpdateMessage('No service worker registered. Try "Force Refresh" below.')
        return
      }

      // Force check for updates
      await registration.update()

      // Wait for update check to complete
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Check if there's a waiting worker (new version available)
      if (registration.waiting) {
        setUpdateStatus('available')
        setUpdateMessage('New version available! Tap "Install Update" to update now.')
      } else if (registration.installing) {
        setUpdateStatus('available')
        setUpdateMessage('Update downloading... Please wait.')
        // Listen for install completion
        registration.installing.addEventListener('statechange', function handler(this: ServiceWorker) {
          if (this.state === 'installed') {
            setUpdateMessage('Update ready! Tap "Install Update" to apply.')
            this.removeEventListener('statechange', handler)
          }
        })
      } else {
        setUpdateStatus('up-to-date')
        setUpdateMessage(`You're on the latest version (v${APP_VERSION})`)
      }
    } catch (error) {
      console.error('Update check error:', error)
      setUpdateStatus('error')
      setUpdateMessage('Failed to check. Try "Force Refresh" below.')
    } finally {
      setCheckingForUpdates(false)
    }
  }

  // Nuclear force refresh - guaranteed to get latest version
  const handleForceRefresh = async () => {
    setCheckingForUpdates(true)
    setUpdateMessage('Force refreshing...')

    try {
      // 1. Clear cooldown
      localStorage.removeItem('sw_refresh_cooldown')

      // 2. Unregister all service workers
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const registration of registrations) {
        await registration.unregister()
      }

      // 3. Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
      }

      // 4. Set flag for welcome screen
      sessionStorage.setItem('sw_just_updated', 'true')

      // 5. Force reload with cache bypass
      const url = new URL(window.location.href)
      url.searchParams.set('_refresh', Date.now().toString())
      window.location.replace(url.toString())
    } catch (error) {
      console.error('Force refresh error:', error)
      // Fallback: hard reload
      window.location.reload()
    }
  }

  // Force install the update
  const handleInstallUpdate = async () => {
    setCheckingForUpdates(true)
    setUpdateMessage('Installing update...')

    try {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration?.waiting) {
        // Tell the waiting service worker to skip waiting and activate
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }

      // Clear all caches and reload
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
      }

      // Set flag for post-update welcome screen
      sessionStorage.setItem('sw_just_updated', 'true')

      // Force reload with cache bypass
      const url = new URL(window.location.href)
      url.searchParams.set('_refresh', Date.now().toString())
      window.location.replace(url.toString())
    } catch (error) {
      console.error('Install update error:', error)
      setUpdateStatus('error')
      setUpdateMessage('Failed to install update. Try refreshing the page.')
      setCheckingForUpdates(false)
    }
  }

  const handleDeleteData = async (type: 'expenses' | 'income' | 'all') => {
    if (!user) return

    setDeleting(true)
    try {
      if (type === 'expenses' || type === 'all') {
        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('user_id', user.id)
        if (error) throw error
      }

      if (type === 'income' || type === 'all') {
        const { error } = await supabase
          .from('app_income')
          .delete()
          .eq('user_id', user.id)
        if (error) throw error
      }

      setDeleteSuccess(
        type === 'all'
          ? 'All data deleted successfully'
          : type === 'expenses'
            ? 'All expenses deleted successfully'
            : 'All income deleted successfully'
      )
      setTimeout(() => setDeleteSuccess(null), 3000)
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete data. Please try again.')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
      setDeleteType(null)
    }
  }

  const handleToggle = async (key: keyof typeof settings) => {
    try {
      await updateSettings({ [key]: !settings[key] })
    } catch (error) {
      console.error('Settings update error:', error)
      alert(`Failed to update settings: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const ToggleSwitch = ({
    enabled,
    onChange
  }: {
    enabled: boolean
    onChange: () => void
  }) => (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-gradient-to-r from-blue-500 to-purple-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )

  const FeatureItem = ({
    icon: Icon,
    title,
    description,
    enabled,
    onChange
  }: {
    icon: any
    title: string
    description: string
    enabled: boolean
    onChange: () => void
  }) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/40 dark:bg-gray-700/40 border border-white/30 dark:border-gray-600/30 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-all">
      <div className="flex items-start gap-3 flex-1">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mt-0.5">
          <Icon className="text-blue-600 dark:text-blue-400" size={18} />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 dark:text-white">{title}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      <ToggleSwitch enabled={enabled} onChange={onChange} />
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-8 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <SettingsIcon className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                Settings
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Customize your expense tracker</p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Currency</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Select your preferred currency for displaying amounts</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {CURRENCIES.map((curr) => (
                  <button
                    key={curr.code}
                    onClick={() => setCurrency(curr)}
                    className={`group/currency relative p-4 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 ${
                      currency.code === curr.code
                        ? 'border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-700 bg-white/30 dark:bg-gray-800/30 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg transition-all ${
                          currency.code === curr.code
                            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {curr.symbol}
                        </div>
                        <div className="text-left">
                          <div className={`font-bold ${
                            currency.code === curr.code
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {curr.code}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">{curr.name}</div>
                        </div>
                      </div>
                      {currency.code === curr.code && (
                        <div className="w-6 h-6 rounded-full bg-blue-500 dark:bg-blue-400 flex items-center justify-center animate-fade-in">
                          <Check className="text-white" size={14} />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <Target className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Budget & Goals</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Track budgets and achieve savings goals</p>

              <div className="space-y-3">
                <FeatureItem
                  icon={Target}
                  title="Budget Limits"
                  description="Set monthly budget limits per category"
                  enabled={settings.feature_budgets}
                  onChange={() => handleToggle('feature_budgets')}
                />
                <FeatureItem
                  icon={BarChart2}
                  title="Budget Progress Tracking"
                  description="Track budget vs actual spending with progress bars"
                  enabled={settings.feature_budget_alerts}
                  onChange={() => handleToggle('feature_budget_alerts')}
                />
                <FeatureItem
                  icon={Target}
                  title="Savings Goals"
                  description="Set and track savings goals with deadlines"
                  enabled={settings.feature_savings_goals}
                  onChange={() => handleToggle('feature_savings_goals')}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Enhanced Tracking</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Track more details about your finances</p>

              <div className="space-y-3">
                <FeatureItem
                  icon={Repeat}
                  title="Recurring Expenses"
                  description="Track recurring expenses like rent and subscriptions"
                  enabled={settings.feature_recurring}
                  onChange={() => handleToggle('feature_recurring')}
                />
                <FeatureItem
                  icon={TrendingUp}
                  title="Income Tracking"
                  description="Track income to see net cash flow"
                  enabled={settings.feature_income}
                  onChange={() => handleToggle('feature_income')}
                />
                <FeatureItem
                  icon={CreditCard}
                  title="Payment Methods"
                  description="Track payment method for each expense"
                  enabled={settings.feature_payment_methods}
                  onChange={() => handleToggle('feature_payment_methods')}
                />
                <FeatureItem
                  icon={Tag}
                  title="Tags"
                  description="Organize expenses with custom tags"
                  enabled={settings.feature_tags}
                  onChange={() => handleToggle('feature_tags')}
                />
                <FeatureItem
                  icon={Receipt}
                  title="Receipt Uploads"
                  description="Attach receipt images to expenses"
                  enabled={settings.feature_receipts}
                  onChange={() => handleToggle('feature_receipts')}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Filtering & Search</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Advanced filtering and search options</p>

              <div className="space-y-3">
                <FeatureItem
                  icon={Filter}
                  title="Advanced Filters"
                  description="Search and filter expenses by multiple criteria"
                  enabled={settings.feature_advanced_filters}
                  onChange={() => handleToggle('feature_advanced_filters')}
                />
                <FeatureItem
                  icon={Filter}
                  title="Date Range Filters"
                  description="Filter expenses by custom date ranges"
                  enabled={settings.feature_date_range_filter}
                  onChange={() => handleToggle('feature_date_range_filter')}
                />
                <FeatureItem
                  icon={Filter}
                  title="Amount Range Filters"
                  description="Filter expenses by amount ranges"
                  enabled={settings.feature_amount_range_filter}
                  onChange={() => handleToggle('feature_amount_range_filter')}
                />
                <FeatureItem
                  icon={Filter}
                  title="Saved Filter Presets"
                  description="Save and reuse custom filter combinations"
                  enabled={settings.feature_saved_filters}
                  onChange={() => handleToggle('feature_saved_filters')}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Reports & Insights</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Advanced analytics and spending insights</p>

              <div className="space-y-3">
                <FeatureItem
                  icon={FileText}
                  title="Detailed Reports"
                  description="Generate comprehensive expense reports"
                  enabled={settings.feature_reports}
                  onChange={() => handleToggle('feature_reports')}
                />
                <FeatureItem
                  icon={TrendingUp}
                  title="Spending Trends"
                  description="Compare spending across time periods with predictions"
                  enabled={settings.feature_spending_trends}
                  onChange={() => handleToggle('feature_spending_trends')}
                />
                <FeatureItem
                  icon={Bell}
                  title="Expense Summaries"
                  description="Weekly/monthly expense summaries via notifications"
                  enabled={settings.feature_notifications}
                  onChange={() => handleToggle('feature_notifications')}
                />
                <FeatureItem
                  icon={Sparkles}
                  title="Unusual Spending Detection"
                  description="Identify unusual spending patterns automatically"
                  enabled={settings.feature_unusual_spending}
                  onChange={() => handleToggle('feature_unusual_spending')}
                />
                <FeatureItem
                  icon={FileText}
                  title="Tax Reports"
                  description="Tax-ready reports for business expenses"
                  enabled={settings.feature_tax_reports}
                  onChange={() => handleToggle('feature_tax_reports')}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Import & Export</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Import and export expense data</p>

              <div className="space-y-3">
                <FeatureItem
                  icon={Upload}
                  title="CSV Import"
                  description="Import expenses from CSV files or bank statements"
                  enabled={settings.feature_import_csv}
                  onChange={() => handleToggle('feature_import_csv')}
                />
                <FeatureItem
                  icon={Sparkles}
                  title="Auto-Categorization"
                  description="Automatically categorize imported transactions"
                  enabled={settings.feature_auto_categorize}
                  onChange={() => handleToggle('feature_auto_categorize')}
                />
                <FeatureItem
                  icon={Download}
                  title="Excel/CSV Export"
                  description="Export expenses to Excel or CSV format"
                  enabled={settings.feature_export_excel}
                  onChange={() => handleToggle('feature_export_excel')}
                />
                <FeatureItem
                  icon={Download}
                  title="Auto Backup"
                  description="Scheduled automatic backup of expense data"
                  enabled={settings.feature_auto_backup}
                  onChange={() => handleToggle('feature_auto_backup')}
                />
              </div>
            </div>

            {/* Backup & Restore Section */}
            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="text-green-600 dark:text-green-400" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Backup & Restore</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Never lose your data - create backups and restore anytime
              </p>

              {/* Backup Alert */}
              {backupNeeded && (
                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        Backup Recommended
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        {lastBackup
                          ? `Your last backup was on ${lastBackup}. Create a new backup to protect your data.`
                          : "You haven't created a backup yet. Protect your financial data now!"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Backup Info */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                      <HardDrive className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {lastBackup ? 'Last Backup' : 'No Backup Yet'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {lastBackup || 'Create your first backup to protect your data'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Backup Button */}
              <a
                href="/app?view=backup"
                className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all"
              >
                <Shield className="w-5 h-5" />
                Open Backup & Restore
              </a>

              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                Download backups to your device or restore from a previous backup
              </p>
            </div>

            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Smart Features</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Intelligent automation and advanced capabilities</p>

              <div className="space-y-3">
                <FeatureItem
                  icon={Bell}
                  title="Bill Reminders"
                  description="Get reminders for recurring bills and expenses"
                  enabled={settings.feature_bill_reminders}
                  onChange={() => handleToggle('feature_bill_reminders')}
                />
                <FeatureItem
                  icon={Tag}
                  title="Custom Categories"
                  description="Create custom expense categories beyond presets"
                  enabled={settings.feature_custom_categories}
                  onChange={() => handleToggle('feature_custom_categories')}
                />
                <FeatureItem
                  icon={Coins}
                  title="Multi-Currency Support"
                  description="Track expenses in multiple currencies (for travelers)"
                  enabled={settings.feature_multi_currency}
                  onChange={() => handleToggle('feature_multi_currency')}
                />
                <FeatureItem
                  icon={TrendingUp}
                  title="Exchange Rate Conversion"
                  description="Automatic exchange rate conversion with historical rates"
                  enabled={settings.feature_exchange_rates}
                  onChange={() => handleToggle('feature_exchange_rates')}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 dark:bg-blue-600/30 flex items-center justify-center mt-0.5">
                    <SettingsIcon className="text-blue-600 dark:text-blue-400" size={16} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Feature Toggles</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Enable or disable features based on your needs. Changes take effect immediately.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Cloud Sync & Exchange Rates Section */}
            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <Cloud className="text-blue-500" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Cloud Sync & Rates</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Manage data synchronization and exchange rates</p>

              {syncSuccess && (
                <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle size={18} />
                  <span>{syncSuccess}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Cloud Sync */}
                <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/20 dark:border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {migrationStatus.inProgress || isSyncing ? (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      ) : migrationStatus.error ? (
                        <CloudOff className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Cloud className="w-5 h-5 text-green-500" />
                      )}
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">Data Sync</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {migrationStatus.inProgress || isSyncing
                            ? 'Syncing data to cloud...'
                            : migrationStatus.completed && migrationStatus.result?.success
                              ? 'All data synced to cloud'
                              : 'Sync your local data to the cloud'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleManualSync}
                      disabled={migrationStatus.inProgress || isSyncing}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white rounded-lg transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 ${(migrationStatus.inProgress || isSyncing) ? 'animate-spin' : ''}`} />
                      Sync Now
                    </button>
                  </div>
                </div>

                {/* Exchange Rates */}
                <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/20 dark:border-gray-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Coins className="w-5 h-5 text-amber-500" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">Exchange Rates</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {lastRateUpdate
                            ? `Last updated: ${lastRateUpdate.toLocaleString()}`
                            : 'Auto-update currency exchange rates'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => refreshRates()}
                      disabled={isLoadingRates}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingRates ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Auto-refresh rates</span>
                    <button
                      onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        autoRefreshEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          autoRefreshEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* App Updates Section */}
            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone className="text-purple-600 dark:text-purple-400" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">App Updates</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Check for and install app updates</p>

              {/* Update Status Message */}
              {updateMessage && (
                <div className={`mb-4 p-3 rounded-xl flex items-center gap-2 ${
                  updateStatus === 'available'
                    ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                    : updateStatus === 'up-to-date'
                      ? 'bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                      : 'bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                }`}>
                  {updateStatus === 'available' ? (
                    <ArrowDownCircle size={18} />
                  ) : updateStatus === 'up-to-date' ? (
                    <CheckCircle size={18} />
                  ) : (
                    <AlertTriangle size={18} />
                  )}
                  <span className="flex-1">{updateMessage}</span>
                </div>
              )}

              <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/20 dark:border-gray-700/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">WealthPulse</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Current version: v{APP_VERSION}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCheckForUpdates}
                    disabled={checkingForUpdates}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-400 text-white rounded-xl font-semibold transition-colors"
                  >
                    {checkingForUpdates ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Check for Updates
                      </>
                    )}
                  </button>

                  {updateStatus === 'available' && (
                    <button
                      onClick={handleInstallUpdate}
                      disabled={checkingForUpdates}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg"
                    >
                      <ArrowDownCircle className="w-4 h-4" />
                      Install Update
                    </button>
                  )}
                </div>

                {/* Force Refresh - Always works */}
                <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                  <button
                    onClick={handleForceRefresh}
                    disabled={checkingForUpdates}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white rounded-xl font-semibold transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Force Refresh (Guaranteed Update)
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                    Clears all caches and reloads the app with the latest version
                  </p>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                  Updates include new features, bug fixes, and improvements
                </p>
              </div>
            </div>

            {/* Data Management Section */}
            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <Trash2 className="text-red-500" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Data Management</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Manage your expense and income data</p>

              {deleteSuccess && (
                <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Check size={18} />
                  <span>{deleteSuccess}</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-white/40 dark:bg-gray-700/40 border border-white/30 dark:border-gray-600/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center mt-0.5">
                        <Trash2 className="text-red-500" size={18} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">Delete All Expenses</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Remove all expense records from your account</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setDeleteType('expenses'); setShowDeleteConfirm(true); }}
                      className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/40 dark:bg-gray-700/40 border border-white/30 dark:border-gray-600/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center mt-0.5">
                        <Trash2 className="text-orange-500" size={18} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">Delete All Income</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Remove all income records from your account</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setDeleteType('income'); setShowDeleteConfirm(true); }}
                      className="px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-red-50/50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-600/20 flex items-center justify-center mt-0.5">
                        <AlertTriangle className="text-red-600" size={18} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-red-700 dark:text-red-400">Delete All Data</h4>
                        <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-0.5">Remove ALL expenses and income records permanently</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setDeleteType('all'); setShowDeleteConfirm(true); }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                    >
                      Delete All
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="text-red-600 dark:text-red-400" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Confirm Deletion</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-gray-700 dark:text-gray-300 mb-6">
              {deleteType === 'all'
                ? 'Are you sure you want to delete ALL your expenses and income records? This will permanently remove all your financial data.'
                : deleteType === 'expenses'
                  ? 'Are you sure you want to delete all your expense records? This will permanently remove all tracked expenses.'
                  : 'Are you sure you want to delete all your income records? This will permanently remove all tracked income.'}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteType(null); }}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteData(deleteType)}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
