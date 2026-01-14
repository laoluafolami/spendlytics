import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface Currency {
  code: string
  symbol: string
  name: string
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
]

interface CurrencyContextType {
  currency: Currency
  setCurrency: (currency: Currency) => void
  formatAmount: (amount: number) => string
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem('expense-tracker-currency')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return CURRENCIES[0]
      }
    }
    return CURRENCIES[0]
  })

  useEffect(() => {
    localStorage.setItem('expense-tracker-currency', JSON.stringify(currency))
  }, [currency])

  const setCurrency = (newCurrency: Currency) => {
    setCurrencyState(newCurrency)
  }

  const formatAmount = (amount: number) => {
    return `${currency.symbol}${amount.toFixed(2)}`
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatAmount }}>
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
