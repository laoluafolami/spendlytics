/**
 * Backup & Restore Component
 * Comprehensive UI for data backup and restoration
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
  Settings
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
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getBackupSummary>> | null>(null);
  const [backupRecommended, setBackupRecommended] = useState(false);

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
    try {
      const data = await getBackupSummary();
      setSummary(data);
      const recommended = await isBackupRecommended();
      setBackupRecommended(recommended);
    } catch (err) {
      console.error('Failed to load backup summary:', err);
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
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Backup & Restore</h2>
                <p className="text-sm text-white/80">Keep your data safe forever</p>
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
              {/* Backup Recommendation Alert */}
              {backupRecommended && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Backup Recommended
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      {summary?.lastBackup
                        ? `Your last backup was on ${summary.lastBackup}. Consider backing up again.`
                        : "You haven't created a backup yet. Protect your data now!"}
                    </p>
                  </div>
                </div>
              )}

              {/* Data Summary */}
              {summary && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Your Data Summary
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-blue-500" />
                      <span className="text-gray-600 dark:text-gray-300">
                        {summary.expenses} expenses
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-gray-600 dark:text-gray-300">
                        {summary.income} income
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <PiggyBank className="w-4 h-4 text-purple-500" />
                      <span className="text-gray-600 dark:text-gray-300">
                        {summary.savingsGoals} goals
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-amber-500" />
                      <span className="text-gray-600 dark:text-gray-300">
                        {summary.assets} assets
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid sm:grid-cols-2 gap-4">
                <button
                  onClick={() => setStep('backup')}
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all"
                >
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Download className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Create Backup</p>
                    <p className="text-sm text-white/80">Download your data file</p>
                  </div>
                </button>

                <button
                  onClick={() => setStep('restore')}
                  className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all"
                >
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold">Restore Backup</p>
                    <p className="text-sm text-white/80">Upload a backup file</p>
                  </div>
                </button>
              </div>

              {/* Info Cards */}
              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <HardDrive className="w-5 h-5 text-blue-500 mb-2" />
                  <p className="font-medium text-gray-900 dark:text-white">Local Storage</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Backup saved to your device
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                  <Cloud className="w-5 h-5 text-purple-500 mb-2" />
                  <p className="font-medium text-gray-900 dark:text-white">Cloud Sync</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Data synced to Supabase
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                  <ShieldCheck className="w-5 h-5 text-green-500 mb-2" />
                  <p className="font-medium text-gray-900 dark:text-white">Encryption</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Optional password protection
                  </p>
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Create Backup
                </h3>

                {/* What's included */}
                <div className="space-y-3 mb-6">
                  <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={backupOptions.includeSupabase}
                      onChange={(e) => setBackupOptions({ ...backupOptions, includeSupabase: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-500"
                    />
                    <Cloud className="w-5 h-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">Cloud Data</p>
                      <p className="text-sm text-gray-500">Expenses, income, budgets, assets, investments</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={backupOptions.includeLocalStorage}
                      onChange={(e) => setBackupOptions({ ...backupOptions, includeLocalStorage: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-500"
                    />
                    <Settings className="w-5 h-5 text-purple-500" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">Preferences</p>
                      <p className="text-sm text-gray-500">Theme, currency, settings, API keys</p>
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
                      className="w-4 h-4 rounded text-blue-500"
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
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Backup Button */}
                <button
                  onClick={handleBackup}
                  disabled={isLoading || (backupOptions.encrypt && !backupOptions.encryptionKey)}
                  className="mt-6 w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Creating Backup...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Download Backup
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
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <FileJson className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedFile ? selectedFile.name : 'Click to select backup file'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Supports .json backup files
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
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Backup Verified
                  </h3>
                </div>

                {/* Backup Info */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Created</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {new Date(parsedBackup.meta.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Version</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {parsedBackup.meta.version}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Data to Restore */}
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Data in backup:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {parsedBackup.meta.dataCount.expenses > 0 && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <Check className="w-4 h-4 text-green-500" />
                        {parsedBackup.meta.dataCount.expenses} expenses
                      </div>
                    )}
                    {parsedBackup.meta.dataCount.income > 0 && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <Check className="w-4 h-4 text-green-500" />
                        {parsedBackup.meta.dataCount.income} income
                      </div>
                    )}
                    {parsedBackup.meta.dataCount.budgets > 0 && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <Check className="w-4 h-4 text-green-500" />
                        {parsedBackup.meta.dataCount.budgets} budgets
                      </div>
                    )}
                    {parsedBackup.meta.dataCount.savingsGoals > 0 && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <Check className="w-4 h-4 text-green-500" />
                        {parsedBackup.meta.dataCount.savingsGoals} savings goals
                      </div>
                    )}
                    {parsedBackup.meta.dataCount.assets > 0 && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <Check className="w-4 h-4 text-green-500" />
                        {parsedBackup.meta.dataCount.assets} assets
                      </div>
                    )}
                    {parsedBackup.meta.dataCount.liabilities > 0 && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <Check className="w-4 h-4 text-green-500" />
                        {parsedBackup.meta.dataCount.liabilities} liabilities
                      </div>
                    )}
                    {parsedBackup.meta.dataCount.investments > 0 && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <Check className="w-4 h-4 text-green-500" />
                        {parsedBackup.meta.dataCount.investments} investments
                      </div>
                    )}
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
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-xl text-sm flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>This will replace your current data with the backup. Your existing data will be overwritten.</span>
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
                  className="mt-6 w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Restore Backup
                </button>
              </div>
            </div>
          )}

          {/* Restoring Step */}
          {step === 'restoring' && (
            <div className="py-8 text-center">
              <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Restoring Your Data
              </h3>
              <p className="text-gray-500 mb-6">{progress.status}</p>
              <div className="w-full max-w-xs mx-auto h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-500" />
              </div>

              {restoreResult ? (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {restoreResult.success ? 'Restore Complete!' : 'Restore Completed with Errors'}
                  </h3>

                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-left max-w-sm mx-auto mt-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Restored:</p>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span>{restoreResult.restored.expenses} expenses</span>
                      <span>{restoreResult.restored.income} income</span>
                      <span>{restoreResult.restored.budgets} budgets</span>
                      <span>{restoreResult.restored.savingsGoals} goals</span>
                      <span>{restoreResult.restored.assets} assets</span>
                      <span>{restoreResult.restored.liabilities} liabilities</span>
                      <span>{restoreResult.restored.investments} investments</span>
                    </div>
                  </div>

                  {restoreResult.errors.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm text-left max-w-sm mx-auto">
                      <p className="font-medium mb-1">Errors:</p>
                      <ul className="list-disc list-inside">
                        {restoreResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-sm text-gray-500 mt-4">
                    Reloading app in a moment...
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Backup Created Successfully!
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Your backup file has been downloaded. Keep it safe!
                  </p>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-left max-w-sm mx-auto">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Pro Tips:
                    </p>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• Store backups in cloud storage (Google Drive, iCloud)</li>
                      <li>• Email a copy to yourself</li>
                      <li>• Create backups regularly</li>
                      <li>• Keep multiple backup versions</li>
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
                className="mt-6 px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
