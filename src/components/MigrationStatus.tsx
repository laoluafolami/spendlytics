/**
 * Migration Status Component
 *
 * Shows a toast/banner when data migration is in progress or completed.
 * Displays errors if migration fails.
 */

import { useState, useEffect } from 'react'
import { Cloud, CloudOff, Loader2, CheckCircle, AlertCircle, X, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function MigrationStatus() {
  const { migrationStatus, triggerMigration } = useAuth()
  const [isVisible, setIsVisible] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  // Show component when migration starts or has results
  useEffect(() => {
    if (migrationStatus.inProgress) {
      setIsVisible(true)
    } else if (migrationStatus.completed && migrationStatus.result) {
      setIsVisible(true)
      // Auto-hide success after 5 seconds
      if (migrationStatus.result.success && migrationStatus.result.synced > 0) {
        const timer = setTimeout(() => setIsVisible(false), 5000)
        return () => clearTimeout(timer)
      }
    } else if (migrationStatus.error) {
      setIsVisible(true)
    }
  }, [migrationStatus])

  // Handle retry
  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await triggerMigration()
    } finally {
      setIsRetrying(false)
    }
  }

  // Don't render if not visible or nothing to show
  if (!isVisible) return null

  // Migration in progress
  if (migrationStatus.inProgress) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-3 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <Loader2 className="w-5 h-5 animate-spin" />
          <div>
            <p className="font-medium">Syncing your data...</p>
            <p className="text-sm text-blue-100">Migrating to cloud storage</p>
          </div>
        </div>
      </div>
    )
  }

  // Migration completed with success
  if (migrationStatus.completed && migrationStatus.result?.success) {
    const { synced } = migrationStatus.result

    // Don't show if nothing was synced
    if (synced === 0) return null

    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-3 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg">
          <CheckCircle className="w-5 h-5" />
          <div className="flex-1">
            <p className="font-medium">Data synced successfully</p>
            <p className="text-sm text-green-100">
              {synced} item{synced !== 1 ? 's' : ''} migrated to cloud
            </p>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-green-500 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  // Migration had errors
  if (migrationStatus.error || (migrationStatus.result && !migrationStatus.result.success)) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-3 bg-amber-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-md">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium">Sync partially completed</p>
            <p className="text-sm text-amber-100 truncate">
              {migrationStatus.error || 'Some items could not be synced'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="p-1.5 hover:bg-amber-500 rounded disabled:opacity-50"
              title="Retry sync"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="p-1.5 hover:bg-amber-500 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

/**
 * Sync Status Indicator (for header/navbar)
 *
 * Shows a small icon indicating sync status
 */
export function SyncStatusIndicator() {
  const { migrationStatus, user } = useAuth()

  if (!user) return null

  if (migrationStatus.inProgress) {
    return (
      <div className="flex items-center gap-1.5 text-blue-500" title="Syncing...">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs hidden sm:inline">Syncing</span>
      </div>
    )
  }

  if (migrationStatus.error) {
    return (
      <div className="flex items-center gap-1.5 text-amber-500" title={migrationStatus.error}>
        <CloudOff className="w-4 h-4" />
        <span className="text-xs hidden sm:inline">Sync issue</span>
      </div>
    )
  }

  if (migrationStatus.completed && migrationStatus.result?.success) {
    return (
      <div className="flex items-center gap-1.5 text-green-500" title="Data synced">
        <Cloud className="w-4 h-4" />
        <span className="text-xs hidden sm:inline">Synced</span>
      </div>
    )
  }

  return null
}
