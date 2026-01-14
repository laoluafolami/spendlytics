import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export interface AppSettings {
  id?: string
  feature_budgets: boolean
  feature_income: boolean
  feature_payment_methods: boolean
  feature_tags: boolean
  feature_receipts: boolean
  feature_recurring: boolean
  feature_advanced_filters: boolean
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
        const { error } = await supabase
          .from('app_settings')
          .update(updatedSettings)
          .eq('id', settings.id)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('app_settings')
          .insert([updatedSettings])
          .select()
          .single()

        if (error) throw error
        if (data) {
          updatedSettings.id = data.id
        }
      }

      setSettings(updatedSettings)
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
