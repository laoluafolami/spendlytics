import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import {
  fetchExchangeRates,
  convertCurrency,
  startRateAutoRefresh,
  stopRateAutoRefresh,
  ExchangeRates,
  SUPPORTED_CURRENCIES,
} from '../utils/exchangeRateService'

export interface Currency {
  code: string
  symbol: string
  name: string
  flag?: string
}

// Extended currency list with more options
export const CURRENCIES: Currency[] = SUPPORTED_CURRENCIES.map(c => ({
  code: c.code,
  symbol: c.symbol,
  name: c.name,
  flag: c.flag,
}))

interface CurrencyContextType {
  // Current display currency
  currency: Currency
  setCurrency: (currency: Currency) => void

  // Formatting
  formatAmount: (amount: number) => string

  // Exchange rates
  exchangeRates: ExchangeRates | null
  isLoadingRates: boolean
  lastRateUpdate: Date | null
  rateError: string | null

  // Conversion
  convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => Promise<number>
  convertAmountSync: (amount: number, fromCurrency: string, toCurrency?: string) => number

  // Rate management
  refreshRates: () => Promise<void>
  autoRefreshEnabled: boolean
  setAutoRefreshEnabled: (enabled: boolean) => void

  // Get rate between currencies
  getRate: (from: string, to?: string) => number | null
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  // Currency state
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem('expense-tracker-currency')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Find in extended list
        const found = CURRENCIES.find(c => c.code === parsed.code)
        return found || CURRENCIES.find(c => c.code === 'NGN') || CURRENCIES[0]
      } catch {
        return CURRENCIES.find(c => c.code === 'NGN') || CURRENCIES[0]
      }
    }
    // Default to NGN
    return CURRENCIES.find(c => c.code === 'NGN') || CURRENCIES[0]
  })

  // Exchange rate state
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null)
  const [isLoadingRates, setIsLoadingRates] = useState(false)
  const [lastRateUpdate, setLastRateUpdate] = useState<Date | null>(null)
  const [rateError, setRateError] = useState<string | null>(null)
  const [autoRefreshEnabled, setAutoRefreshEnabledState] = useState(() => {
    return localStorage.getItem('expense-tracker-auto-refresh-rates') === 'true'
  })

  // Load exchange rates on mount
  useEffect(() => {
    const loadRates = async () => {
      setIsLoadingRates(true)
      try {
        const rates = await fetchExchangeRates(currency.code)
        setExchangeRates(rates)
        setLastRateUpdate(rates.lastUpdated)
        setRateError(null)
      } catch (error) {
        console.error('Failed to load exchange rates:', error)
        setRateError('Failed to load exchange rates')
      } finally {
        setIsLoadingRates(false)
      }
    }

    loadRates()
  }, [currency.code])

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefreshEnabled) {
      startRateAutoRefresh(
        currency.code,
        (rates) => {
          setExchangeRates(rates)
          setLastRateUpdate(rates.lastUpdated)
          setRateError(null)
        },
        4 * 60 * 60 * 1000 // 4 hours
      )

      return () => {
        stopRateAutoRefresh()
      }
    }
  }, [autoRefreshEnabled, currency.code])

  // Save currency preference
  useEffect(() => {
    localStorage.setItem('expense-tracker-currency', JSON.stringify(currency))
  }, [currency])

  const setCurrency = useCallback((newCurrency: Currency) => {
    setCurrencyState(newCurrency)
  }, [])

  const setAutoRefreshEnabled = useCallback((enabled: boolean) => {
    setAutoRefreshEnabledState(enabled)
    localStorage.setItem('expense-tracker-auto-refresh-rates', String(enabled))
    if (!enabled) {
      stopRateAutoRefresh()
    }
  }, [])

  const formatAmount = useCallback((amount: number) => {
    return `${currency.symbol}${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }, [currency.symbol])

  // Async conversion with API
  const convertAmount = useCallback(async (
    amount: number,
    fromCurrency: string,
    toCurrency?: string
  ): Promise<number> => {
    const targetCurrency = toCurrency || currency.code
    if (fromCurrency === targetCurrency) return amount

    try {
      const result = await convertCurrency(amount, fromCurrency, targetCurrency)
      return result.amount
    } catch (error) {
      console.error('Currency conversion error:', error)
      return amount // Return original on error
    }
  }, [currency.code])

  // Sync conversion using cached rates
  const convertAmountSync = useCallback((
    amount: number,
    fromCurrency: string,
    toCurrency?: string
  ): number => {
    const targetCurrency = toCurrency || currency.code
    if (fromCurrency === targetCurrency) return amount

    if (!exchangeRates) return amount

    // If we have rates based on our current currency
    if (exchangeRates.base === fromCurrency) {
      const rate = exchangeRates.rates[targetCurrency]
      if (rate) return amount * rate
    }

    // If we have rates based on target currency
    if (exchangeRates.base === targetCurrency) {
      const rate = exchangeRates.rates[fromCurrency]
      if (rate) return amount / rate
    }

    // Cross-rate calculation
    const fromRate = exchangeRates.rates[fromCurrency]
    const toRate = exchangeRates.rates[targetCurrency]
    if (fromRate && toRate) {
      return amount * (toRate / fromRate)
    }

    return amount // Return original if no rate found
  }, [currency.code, exchangeRates])

  // Manual refresh
  const refreshRates = useCallback(async () => {
    setIsLoadingRates(true)
    setRateError(null)
    try {
      const rates = await fetchExchangeRates(currency.code, true)
      setExchangeRates(rates)
      setLastRateUpdate(rates.lastUpdated)
    } catch (error) {
      console.error('Failed to refresh exchange rates:', error)
      setRateError('Failed to refresh rates')
    } finally {
      setIsLoadingRates(false)
    }
  }, [currency.code])

  // Get rate between currencies
  const getRate = useCallback((from: string, to?: string): number | null => {
    const targetCurrency = to || currency.code
    if (from === targetCurrency) return 1

    if (!exchangeRates) return null

    // Direct rate
    if (exchangeRates.base === from) {
      return exchangeRates.rates[targetCurrency] || null
    }

    // Inverse rate
    if (exchangeRates.base === targetCurrency) {
      const rate = exchangeRates.rates[from]
      return rate ? 1 / rate : null
    }

    // Cross-rate
    const fromRate = exchangeRates.rates[from]
    const toRate = exchangeRates.rates[targetCurrency]
    if (fromRate && toRate) {
      return toRate / fromRate
    }

    return null
  }, [currency.code, exchangeRates])

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        formatAmount,
        exchangeRates,
        isLoadingRates,
        lastRateUpdate,
        rateError,
        convertAmount,
        convertAmountSync,
        refreshRates,
        autoRefreshEnabled,
        setAutoRefreshEnabled,
        getRate,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider')
  }
  return context
}
