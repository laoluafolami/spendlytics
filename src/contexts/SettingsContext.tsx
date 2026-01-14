import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase, sessionId } from '../lib/supabase'

export interface AppSettings {
  id?: string
  feature_budgets: boolean
  feature_income: boolean
  feature_payment_methods: boolean
  feature_tags: boolean
  feature_receipts: boolean
  feature_recurring: boolean
  feature_advanced_filters: boolean
  feature_budget_alerts: boolean
  feature_savings_goals: boolean
  feature_reports: boolean
  feature_spending_trends: boolean
  feature_notifications: boolean
  feature_unusual_spending: boolean
  feature_tax_reports: boolean
  feature_date_range_filter: boolean
  feature_amount_range_filter: boolean
  feature_saved_filters: boolean
  feature_import_csv: boolean
  feature_auto_categorize: boolean
  feature_export_excel: boolean
  feature_auto_backup: boolean
  feature_bill_reminders: boolean
  feature_custom_categories: boolean
  feature_multi_currency: boolean
  feature_exchange_rates: boolean
}

interface SettingsContextType {
  settings: AppSettings
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>
  loading: boolean
}

const defaultSettings: AppSettings = {
  feature_budgets: true,
  feature_income: true,
  feature_payment_methods: true,
  feature_tags: true,
  feature_receipts: false,
  feature_recurring: true,
  feature_advanced_filters: true,
  feature_budget_alerts: true,
  feature_savings_goals: true,
  feature_reports: true,
  feature_spending_trends: true,
  feature_notifications: false,
  feature_unusual_spending: true,
  feature_tax_reports: false,
  feature_date_range_filter: true,
  feature_amount_range_filter: true,
  feature_saved_filters: true,
  feature_import_csv: false,
  feature_auto_categorize: false,
  feature_export_excel: true,
  feature_auto_backup: false,
  feature_bill_reminders: true,
  feature_custom_categories: false,
  feature_multi_currency: false,
  feature_exchange_rates: false,
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setSettings(data)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings }

      if (settings.id) {
        const updatePayload = { ...newSettings }

        const { data, error } = await supabase
          .from('app_settings')
          .update(updatePayload)
          .eq('id', settings.id)
          .select()
          .single()

        if (error) throw error

        if (data) {
          setSettings(data)
        }
      } else {
        const insertPayload = { ...updatedSettings, session_id: sessionId }

        const { data, error } = await supabase
          .from('app_settings')
          .insert([insertPayload])
          .select()
          .single()

        if (error) throw error

        if (data) {
          setSettings(data)
        }
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      throw error
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
