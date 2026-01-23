/**
 * Offline Status Indicator
 * Shows connection status and pending sync information
 */

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { useSyncStatus } from '../hooks/useOfflineData';

interface OfflineIndicatorProps {
  variant?: 'banner' | 'badge' | 'toast';
  showWhenOnline?: boolean;
  className?: string;
}

export default function OfflineIndicator({
  variant = 'banner',
  showWhenOnline = false,
  className = ''
}: OfflineIndicatorProps) {
  const { isOnline, isSyncing, pendingCount, error, sync } = useSyncStatus();
  const [showToast, setShowToast] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Show toast when coming back online
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline && isOnline) {
      setShowToast(true);
      const timer = setTimeout(() => {
        setShowToast(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // Don't show anything if online and no pending changes (unless showWhenOnline)
  if (isOnline && pendingCount === 0 && !showWhenOnline && !showToast && variant !== 'badge') {
    return null;
  }

  // Badge variant - compact indicator
  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        {!isOnline ? (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">
            <WifiOff className="w-3 h-3" />
            Offline
          </span>
        ) : pendingCount > 0 ? (
          <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Cloud className="w-3 h-3" />
            )}
            {pendingCount} pending
          </span>
        ) : (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
            <Check className="w-3 h-3" />
            Synced
          </span>
        )}
      </div>
    );
  }

  // Toast variant - temporary notification
  if (variant === 'toast' && showToast) {
    return (
      <div className={`fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 animate-slide-up ${className}`}>
        <div className="bg-green-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <Wifi className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-sm">Back online!</p>
            <p className="text-xs opacity-90">Syncing your changes...</p>
          </div>
        </div>
      </div>
    );
  }

  // Banner variant - full width bar
  if (variant === 'banner') {
    // Offline banner
    if (!isOnline) {
      return (
        <div className={`bg-amber-500 text-white px-4 py-2 ${className}`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">You're offline</span>
              <span className="text-xs opacity-90 hidden sm:inline">
                - Changes will sync when you're back online
              </span>
            </div>
            {pendingCount > 0 && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </div>
        </div>
      );
    }

    // Syncing banner
    if (isSyncing) {
      return (
        <div className={`bg-blue-500 text-white px-4 py-2 ${className}`}>
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Syncing your data...</span>
          </div>
        </div>
      );
    }

    // Error banner
    if (error) {
      return (
        <div className={`bg-red-500 text-white px-4 py-2 ${className}`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">Sync failed</span>
              <span className="text-xs opacity-90 hidden sm:inline">- {error}</span>
            </div>
            <button
              onClick={() => sync()}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    // Pending changes banner
    if (pendingCount > 0) {
      return (
        <div className={`bg-blue-500 text-white px-4 py-2 ${className}`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{pendingCount} changes waiting to sync</span>
            </div>
            <button
              onClick={() => sync()}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Sync now
            </button>
          </div>
        </div>
      );
    }
  }

  return null;
}

// Compact inline status for headers
export function SyncStatusBadge({ className = '' }: { className?: string }) {
  const { isOnline, isSyncing, pendingCount } = useSyncStatus();

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {!isOnline ? (
        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" title="Offline" />
      ) : isSyncing ? (
        <span title="Syncing...">
          <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" />
        </span>
      ) : pendingCount > 0 ? (
        <div className="w-2 h-2 bg-blue-500 rounded-full" title={`${pendingCount} pending`} />
      ) : null}
    </div>
  );
}

// Full-screen offline overlay (optional, for critical features)
export function OfflineOverlay({
  show,
  message = "This feature requires an internet connection",
  onRetry
}: {
  show: boolean;
  message?: string;
  onRetry?: () => void;
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-xl">
        <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
          <CloudOff className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          You're Offline
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          {message}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
