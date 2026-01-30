/**
 * Backup & Restore Component
 * Comprehensive UI for data backup and restoration
 * Shows ALL app data with clear counts and intuitive insights
 */

import { useState, useEffect, useRef } from 'react';
import {
  Download,
  Upload,
  Shield,
  ShieldCheck,
  AlertTriangle,
  Check,
  X,
  RefreshCw,
  HardDrive,
  Cloud,
  FileJson,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  Database,
  Wallet,
  TrendingUp,
  PiggyBank,
  Building2,
  Settings,
  CreditCard,
  LineChart,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import {
  downloadBackup,
  parseBackupFile,
  restoreFromBackup,
  getBackupSummary,
  isBackupRecommended,
  type BackupData,
  type BackupOptions,
  type RestoreOptions,
  type RestoreResult
} from '../lib/backupService';

interface BackupRestoreProps {
  onClose?: () => void;
  standalone?: boolean;
}

type Step = 'main' | 'backup' | 'restore' | 'preview' | 'restoring' | 'complete';

interface ExtendedSummary {
  expenses: number;
  income: number;
  budgets: number;
  savingsGoals: number;
  assets: number;
  liabilities: number;
  investments: number;
  lastBackup: string | null;
  totalItems: number;
  netWorthSnapshots?: number;
  filterPresets?: number;
  settings?: number;
}

export default function BackupRestore({ onClose, standalone = false }: BackupRestoreProps) {
  const [step, setStep] = useState<Step>('main');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ status: '', percent: 0 });
  const [error, setError] = useState<string | null>(null);

  // Backup state
  const [backupOptions, setBackupOptions] = useState<BackupOptions>({
    includeSupabase: true,
    includeIndexedDB: true,
    includeLocalStorage: true,
    encrypt: false,
    encryptionKey: ''
  });
  const [summary, setSummary] = useState<ExtendedSummary | null>(null);
  const [backupRecommended, setBackupRecommended] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Restore state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<BackupData | null>(null);
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    restoreSupabase: true,
    restoreIndexedDB: true,
    restoreLocalStorage: true,
    mergeData: false,
    decryptionKey: ''
  });
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load summary on mount
  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const data = await getBackupSummary();
      const totalItems = data.expenses + data.income + data.budgets +
                        data.savingsGoals + data.assets + data.liabilities +
                        data.investments;
      setSummary({ ...data, totalItems });
      const recommended = await isBackupRecommended();
      setBackupRecommended(recommended);
    } catch (err) {
      console.error('Failed to load backup summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleBackup = async () => {
    setIsLoading(true);
    setError(null);
    setProgress({ status: 'Starting backup...', percent: 0 });

    try {
      const result = await downloadBackup(backupOptions, (status, percent) => {
        setProgress({ status, percent });
      });

      if (result.success) {
        setStep('complete');
        loadSummary(); // Refresh summary
      } else {
        setError(result.error || 'Backup failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);
    setIsLoading(true);

    try {
      const result = await parseBackupFile(file, restoreOptions.decryptionKey);

      if (result.valid && result.backup) {
        setParsedBackup(result.backup);
        setStep('preview');
      } else {
        setError(result.error || 'Invalid backup file');
        setParsedBackup(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read backup file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!parsedBackup) return;

    setIsLoading(true);
    setError(null);
    setStep('restoring');
    setProgress({ status: 'Starting restore...', percent: 0 });

    try {
      const result = await restoreFromBackup(parsedBackup, restoreOptions, (status, percent) => {
        setProgress({ status, percent });
      });

      setRestoreResult(result);
      setStep('complete');

      // Reload the page after successful restore to reflect changes
      if (result.success) {
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
      setStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  // Data category config for rendering
  const dataCategories = [
    { key: 'expenses', label: 'Expenses', icon: Wallet, color: 'from-red-500 to-rose-500', bgColor: 'bg-red-500/10', textColor: 'text-red-600 dark:text-red-400' },
    { key: 'income', label: 'Income', icon: TrendingUp, color: 'from-green-500 to-emerald-500', bgColor: 'bg-green-500/10', textColor: 'text-green-600 dark:text-green-400' },
    { key: 'budgets', label: 'Budgets', icon: Target, color: 'from-blue-500 to-cyan-500', bgColor: 'bg-blue-500/10', textColor: 'text-blue-600 dark:text-blue-400' },
    { key: 'savingsGoals', label: 'Savings Goals', icon: PiggyBank, color: 'from-purple-500 to-violet-500', bgColor: 'bg-purple-500/10', textColor: 'text-purple-600 dark:text-purple-400' },
    { key: 'assets', label: 'Assets', icon: Building2, color: 'from-amber-500 to-orange-500', bgColor: 'bg-amber-500/10', textColor: 'text-amber-600 dark:text-amber-400' },
    { key: 'liabilities', label: 'Liabilities', icon: CreditCard, color: 'from-pink-500 to-rose-500', bgColor: 'bg-pink-500/10', textColor: 'text-pink-600 dark:text-pink-400' },
    { key: 'investments', label: 'Investments', icon: LineChart, color: 'from-cyan-500 to-teal-500', bgColor: 'bg-cyan-500/10', textColor: 'text-cyan-600 dark:text-cyan-400' },
  ];

  const containerClass = standalone
    ? 'min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 sm:p-6'
    : '';

  const cardClass = standalone
    ? 'max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden'
    : 'bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden';

  return (
    <div className={containerClass}>
      <div className={cardClass}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Backup & Restore</h2>
                <p className="text-sm text-white/80">Protect all your financial data</p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Main Menu */}
          {step === 'main' && (
            <div className="space-y-6">
              {/* Status Banner */}
              {backupRecommended ? (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800 rounded-xl flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-amber-800 dark:text-amber-200">
                        Backup Recommended
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        {summary?.lastBackup
                          ? `Last backup: ${summary.lastBackup}. It's been a while!`
                          : "You haven't created a backup yet. Protect your data now!"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : summary?.lastBackup && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-800 dark:text-green-200">
                        Data Protected
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Last backup: {summary.lastBackup}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Total Data Count - Hero Card */}
              {loadingSummary ? (
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
                  <div className="flex items-center justify-center gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span>Loading your data...</span>
                  </div>
                </div>
              ) : summary && (
                <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl p-6 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        <span className="font-medium">Total Data to Backup</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm bg-white/20 px-3 py-1 rounded-full">
                        <Clock className="w-4 h-4" />
                        <span>{summary.lastBackup || 'Never backed up'}</span>
                      </div>
                    </div>

                    <div className="text-center py-4">
                      <div className="text-6xl font-bold mb-2">{summary.totalItems}</div>
                      <div className="text-white/80">Total Records</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Categories Grid */}
              {summary && (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    Data Breakdown
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {dataCategories.map(({ key, label, icon: Icon, bgColor, textColor }) => {
                      const count = summary[key as keyof ExtendedSummary] as number || 0;
                      return (
                        <div
                          key={key}
                          className={`${bgColor} rounded-xl p-4 transition-all hover:scale-[1.02]`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={`w-5 h-5 ${textColor}`} />
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">
                              {label}
                            </span>
                          </div>
                          <div className={`text-2xl font-bold ${textColor}`}>
                            {count}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {count === 0 ? 'No data' : count === 1 ? '1 record' : `${count} records`}
                          </div>
                        </div>
                      );
                    })}

                    {/* Settings/Preferences Card */}
                    <div className="bg-gray-500/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          Settings
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                        <Check className="w-6 h-6" />
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        All preferences
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setStep('backup')}
                  className="group flex items-center gap-4 p-5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl hover:from-blue-600 hover:to-blue-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Download className="w-7 h-7" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg">Create Backup</p>
                    <p className="text-sm text-white/80">Download all {summary?.totalItems || 0} records</p>
                  </div>
                </button>

                <button
                  onClick={() => setStep('restore')}
                  className="group flex items-center gap-4 p-5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-2xl hover:from-purple-600 hover:to-purple-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-lg">Restore Backup</p>
                    <p className="text-sm text-white/80">Upload a backup file</p>
                  </div>
                </button>
              </div>

              {/* What Gets Backed Up */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-2xl p-5">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                  Everything Gets Backed Up
                </h3>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>All expenses & income records</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Budgets & savings goals</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Assets, liabilities & net worth</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Investment portfolio</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Custom categories & tags</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>All app settings & preferences</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Filter presets</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>Allocation buckets & mappings</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Backup Step */}
          {step === 'backup' && (
            <div className="space-y-6">
              <button
                onClick={() => setStep('main')}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
              >
                ← Back
              </button>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Create Complete Backup
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  Download all {summary?.totalItems || 0} records in a single file
                </p>

                {/* Data Summary */}
                {summary && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Database className="w-5 h-5 text-blue-500" />
                      <span className="font-medium text-blue-800 dark:text-blue-200">
                        Data to backup:
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 text-sm">
                      {dataCategories.map(({ key, label, icon: Icon, textColor }) => {
                        const count = summary[key as keyof ExtendedSummary] as number || 0;
                        if (count === 0) return null;
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${textColor}`} />
                            <span className="text-gray-700 dark:text-gray-300">
                              <strong>{count}</strong> {label.toLowerCase()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* What's included */}
                <div className="space-y-3 mb-6">
                  <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={backupOptions.includeSupabase}
                      onChange={(e) => setBackupOptions({ ...backupOptions, includeSupabase: e.target.checked })}
                      className="w-5 h-5 rounded text-blue-500"
                    />
                    <Cloud className="w-6 h-6 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">Cloud Data</p>
                      <p className="text-sm text-gray-500">Expenses, income, budgets, assets, liabilities, investments, goals</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={backupOptions.includeLocalStorage}
                      onChange={(e) => setBackupOptions({ ...backupOptions, includeLocalStorage: e.target.checked })}
                      className="w-5 h-5 rounded text-blue-500"
                    />
                    <Settings className="w-6 h-6 text-purple-500" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">Preferences & Settings</p>
                      <p className="text-sm text-gray-500">Theme, currency, categories, allocation buckets, API keys</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={backupOptions.includeIndexedDB}
                      onChange={(e) => setBackupOptions({ ...backupOptions, includeIndexedDB: e.target.checked })}
                      className="w-5 h-5 rounded text-blue-500"
                    />
                    <HardDrive className="w-6 h-6 text-green-500" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">Offline Data</p>
                      <p className="text-sm text-gray-500">Cached data for offline access</p>
                    </div>
                  </label>
                </div>

                {/* Encryption Option */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="flex items-center gap-3 mb-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={backupOptions.encrypt}
                      onChange={(e) => setBackupOptions({ ...backupOptions, encrypt: e.target.checked })}
                      className="w-5 h-5 rounded text-blue-500"
                    />
                    <Lock className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      Password protect backup
                    </span>
                  </label>

                  {backupOptions.encrypt && (
                    <input
                      type="password"
                      placeholder="Enter encryption password"
                      value={backupOptions.encryptionKey || ''}
                      onChange={(e) => setBackupOptions({ ...backupOptions, encryptionKey: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                {/* Progress */}
                {isLoading && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-300">{progress.status}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{progress.percent}%</span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 rounded-full"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Backup Button */}
                <button
                  onClick={handleBackup}
                  disabled={isLoading || (backupOptions.encrypt && !backupOptions.encryptionKey)}
                  className="mt-6 w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 hover:from-blue-600 hover:to-purple-700 transition-all active:scale-[0.98]"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Creating Backup...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Download Backup ({summary?.totalItems || 0} records)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Restore Step */}
          {step === 'restore' && (
            <div className="space-y-6">
              <button
                onClick={() => setStep('main')}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
              >
                ← Back
              </button>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Restore from Backup
                </h3>

                {/* File Upload Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <FileJson className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="font-semibold text-gray-900 dark:text-white text-lg">
                    {selectedFile ? selectedFile.name : 'Click to select backup file'}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Supports .json backup files from WealthPulse
                  </p>
                </div>

                {/* Decryption Key */}
                <div className="mt-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Unlock className="w-4 h-4" />
                    Backup Password (if encrypted)
                  </label>
                  <input
                    type="password"
                    placeholder="Enter password if backup was encrypted"
                    value={restoreOptions.decryptionKey || ''}
                    onChange={(e) => setRestoreOptions({ ...restoreOptions, decryptionKey: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {isLoading && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-gray-600 dark:text-gray-300">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Reading backup file...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && parsedBackup && (
            <div className="space-y-6">
              <button
                onClick={() => { setStep('restore'); setParsedBackup(null); }}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
              >
                ← Back
              </button>

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-6 h-6 text-green-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Backup Verified Successfully
                  </h3>
                </div>

                {/* Backup Info */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Created</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {new Date(parsedBackup.meta.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Version</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {parsedBackup.meta.version}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Data to Restore - Grid */}
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Data found in backup:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {dataCategories.map(({ key, label, icon: Icon, bgColor, textColor }) => {
                      const count = parsedBackup.meta.dataCount[key as keyof typeof parsedBackup.meta.dataCount] || 0;
                      if (count === 0) return null;
                      return (
                        <div key={key} className={`${bgColor} rounded-xl p-3`}>
                          <div className="flex items-center gap-2">
                            <Icon className={`w-5 h-5 ${textColor}`} />
                            <div>
                              <div className={`text-lg font-bold ${textColor}`}>{count}</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400">{label}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Advanced Options */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Advanced Options
                </button>

                {showAdvanced && (
                  <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restoreOptions.mergeData}
                        onChange={(e) => setRestoreOptions({ ...restoreOptions, mergeData: e.target.checked })}
                        className="w-4 h-4 rounded text-blue-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">Merge with existing data</p>
                        <p className="text-xs text-gray-500">Keep current data and add backup data</p>
                      </div>
                    </label>
                  </div>
                )}

                {/* Warning */}
                {!restoreOptions.mergeData && (
                  <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        This will replace your current data
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Your existing data will be overwritten with the backup data.
                      </p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm">
                    {error}
                  </div>
                )}

                {/* Restore Button */}
                <button
                  onClick={handleRestore}
                  disabled={isLoading}
                  className="mt-6 w-full py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 hover:from-purple-600 hover:to-purple-700 transition-all active:scale-[0.98]"
                >
                  <Upload className="w-5 h-5" />
                  Restore All Data
                </button>
              </div>
            </div>
          )}

          {/* Restoring Step */}
          {step === 'restoring' && (
            <div className="py-12 text-center">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Restoring Your Data
              </h3>
              <p className="text-gray-500 mb-8">{progress.status}</p>
              <div className="w-full max-w-md mx-auto h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 rounded-full"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-gray-500">{progress.percent}% complete</p>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="py-8 text-center">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-green-500" />
              </div>

              {restoreResult ? (
                <>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {restoreResult.success ? 'Restore Complete!' : 'Restore Completed with Issues'}
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 text-left max-w-sm mx-auto mt-6">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Successfully Restored:
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {Object.entries(restoreResult.restored).map(([key, value]) => {
                        if (value === 0) return null;
                        const category = dataCategories.find(c => c.key === key);
                        const Icon = category?.icon || Database;
                        return (
                          <div key={key} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Icon className={`w-4 h-4 ${category?.textColor || 'text-gray-500'}`} />
                            <span><strong>{value}</strong> {key}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {restoreResult.errors.length > 0 && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl text-left max-w-sm mx-auto">
                      <p className="font-medium text-red-700 dark:text-red-300 mb-2">Errors:</p>
                      <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
                        {restoreResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-sm text-gray-500 mt-6">
                    Reloading app to apply changes...
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Backup Created Successfully!
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Your backup file has been downloaded. Keep it safe!
                  </p>

                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-5 text-left max-w-sm mx-auto">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3">
                      Storage Tips:
                    </p>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        Store in cloud (Google Drive, iCloud)
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        Email a copy to yourself
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        Create weekly backups
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        Keep multiple versions
                      </li>
                    </ul>
                  </div>
                </>
              )}

              <button
                onClick={() => {
                  setStep('main');
                  setRestoreResult(null);
                  setParsedBackup(null);
                  setSelectedFile(null);
                  setError(null);
                }}
                className="mt-6 px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-purple-700 transition-all active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
