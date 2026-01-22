import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { migrateFromLocalStorage, syncOfflineData, SyncResult } from '../utils/financeDataService'

// Migration status tracking
export interface MigrationStatus {
  inProgress: boolean
  completed: boolean
  result: SyncResult | null
  error: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
  // Migration status
  migrationStatus: MigrationStatus
  triggerMigration: () => Promise<SyncResult>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Storage key for migration tracking
const MIGRATION_KEY = 'spendlytics_data_migrated'
const MIGRATION_VERSION = '1' // Increment this to force re-migration

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>({
    inProgress: false,
    completed: false,
    result: null,
    error: null,
  })

  // Check if migration is needed
  const needsMigration = useCallback((userId: string): boolean => {
    const migrated = localStorage.getItem(`${MIGRATION_KEY}_${userId}`)
    return migrated !== MIGRATION_VERSION
  }, [])

  // Mark migration as complete
  const markMigrationComplete = useCallback((userId: string) => {
    localStorage.setItem(`${MIGRATION_KEY}_${userId}`, MIGRATION_VERSION)
  }, [])

  // Perform data migration
  const performMigration = useCallback(async (userId: string): Promise<SyncResult> => {
    setMigrationStatus(prev => ({ ...prev, inProgress: true, error: null }))

    try {
      // First, sync any offline data that was queued
      const syncResult = await syncOfflineData()
      console.log('Offline sync result:', syncResult)

      // Then migrate any remaining localStorage data
      const migrationResult = await migrateFromLocalStorage()
      console.log('Migration result:', migrationResult)

      // Combine results
      const combinedResult: SyncResult = {
        success: syncResult.success && migrationResult.success,
        synced: syncResult.synced + migrationResult.synced,
        errors: [...syncResult.errors, ...migrationResult.errors],
      }

      // Mark as complete if successful
      if (combinedResult.success || combinedResult.synced > 0) {
        markMigrationComplete(userId)
      }

      setMigrationStatus({
        inProgress: false,
        completed: true,
        result: combinedResult,
        error: combinedResult.errors.length > 0 ? combinedResult.errors.join(', ') : null,
      })

      return combinedResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Migration failed'
      console.error('Migration error:', error)

      setMigrationStatus({
        inProgress: false,
        completed: false,
        result: null,
        error: errorMessage,
      })

      return { success: false, synced: 0, errors: [errorMessage] }
    }
  }, [markMigrationComplete])

  // Manual migration trigger
  const triggerMigration = useCallback(async (): Promise<SyncResult> => {
    if (!user) {
      return { success: false, synced: 0, errors: ['Not logged in'] }
    }
    return performMigration(user.id)
  }, [user, performMigration])

  // Auto-migrate on login
  useEffect(() => {
    if (user && !loading && needsMigration(user.id)) {
      console.log('Auto-triggering data migration for user:', user.id)
      performMigration(user.id)
    }
  }, [user, loading, needsMigration, performMigration])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      })()
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error:', error)
      throw error
    }
    setSession(null)
    setUser(null)
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    migrationStatus,
    triggerMigration,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
