/**
 * Exchange Rate Service
 *
 * Provides real-time currency exchange rates using free APIs:
 * - ExchangeRate-API (free tier: 1500 requests/month)
 * - Open Exchange Rates (fallback)
 * - Frankfurter (EUR-based, free)
 *
 * Features:
 * - Automatic rate updates
 * - Caching to reduce API calls
 * - Support for NGN and major currencies
 * - Offline fallback rates
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ExchangeRate {
  from: string
  to: string
  rate: number
  lastUpdated: Date
  source: 'exchangerate-api' | 'frankfurter' | 'fallback'
}

export interface ExchangeRates {
  base: string
  rates: Record<string, number>
  lastUpdated: Date
  source: string
}

export interface CurrencyInfo {
  code: string
  name: string
  symbol: string
  flag?: string
}

// ============================================================================
// SUPPORTED CURRENCIES
// ============================================================================

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬' },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', flag: '🇬🇭' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', flag: '🇪🇬' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', flag: '🇸🇦' },
]

// Fallback rates (approximate, for offline use)
// Based on NGN as base currency
const FALLBACK_RATES: Record<string, number> = {
  NGN: 1,
  USD: 0.00063, // 1 NGN = 0.00063 USD (1 USD ≈ 1580 NGN)
  EUR: 0.00058, // 1 NGN = 0.00058 EUR
  GBP: 0.00050, // 1 NGN = 0.00050 GBP
  CAD: 0.00086, // 1 NGN = 0.00086 CAD
  AUD: 0.00097, // 1 NGN = 0.00097 AUD
  JPY: 0.095,   // 1 NGN = 0.095 JPY
  CNY: 0.0046,  // 1 NGN = 0.0046 CNY
  INR: 0.053,   // 1 NGN = 0.053 INR
  ZAR: 0.012,   // 1 NGN = 0.012 ZAR
  GHS: 0.0095,  // 1 NGN = 0.0095 GHS
  KES: 0.097,   // 1 NGN = 0.097 KES
  EGP: 0.031,   // 1 NGN = 0.031 EGP
  AED: 0.0023,  // 1 NGN = 0.0023 AED
  SAR: 0.0024,  // 1 NGN = 0.0024 SAR
}

// ============================================================================
// CACHE
// ============================================================================

interface CachedRates {
  rates: ExchangeRates
  timestamp: number
}

const CACHE_KEY = 'spendlytics_exchange_rates'
const CACHE_DURATION = 4 * 60 * 60 * 1000 // 4 hours

let cachedRates: CachedRates | null = null

function loadCachedRates(): CachedRates | null {
  if (cachedRates) return cachedRates

  try {
    const stored = localStorage.getItem(CACHE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      cachedRates = {
        ...parsed,
        rates: {
          ...parsed.rates,
          lastUpdated: new Date(parsed.rates.lastUpdated),
        },
      }
      return cachedRates
    }
  } catch (error) {
    console.warn('Error loading cached exchange rates:', error)
  }
  return null
}

function saveCachedRates(rates: ExchangeRates): void {
  cachedRates = { rates, timestamp: Date.now() }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cachedRates))
  } catch (error) {
    console.warn('Error saving exchange rates to cache:', error)
  }
}

function isCacheValid(): boolean {
  const cache = loadCachedRates()
  if (!cache) return false
  return Date.now() - cache.timestamp < CACHE_DURATION
}

// ============================================================================
// API FETCHERS
// ============================================================================

/**
 * Fetch rates from ExchangeRate-API (free tier)
 * https://www.exchangerate-api.com/
 */
async function fetchFromExchangeRateAPI(baseCurrency: string): Promise<ExchangeRates | null> {
  try {
    // Free tier doesn't require API key
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${baseCurrency}`
    )

    if (!response.ok) {
      console.warn(`ExchangeRate-API error: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (data.result !== 'success') {
      console.warn('ExchangeRate-API returned error:', data)
      return null
    }

    return {
      base: data.base_code,
      rates: data.rates,
      lastUpdated: new Date(data.time_last_update_utc),
      source: 'exchangerate-api',
    }
  } catch (error) {
    console.error('Error fetching from ExchangeRate-API:', error)
    return null
  }
}

/**
 * Fetch rates from Frankfurter API (EUR-based, free)
 * https://www.frankfurter.app/
 */
async function fetchFromFrankfurter(baseCurrency: string): Promise<ExchangeRates | null> {
  try {
    const response = await fetch(
      `https://api.frankfurter.app/latest?from=${baseCurrency}`
    )

    if (!response.ok) {
      console.warn(`Frankfurter API error: ${response.status}`)
      return null
    }

    const data = await response.json()

    // Add the base currency with rate 1
    const rates = { ...data.rates, [baseCurrency]: 1 }

    return {
      base: data.base,
      rates,
      lastUpdated: new Date(data.date),
      source: 'frankfurter',
    }
  } catch (error) {
    console.error('Error fetching from Frankfurter:', error)
    return null
  }
}

/**
 * Get fallback rates (offline mode)
 */
function getFallbackRates(baseCurrency: string): ExchangeRates {
  const baseRate = FALLBACK_RATES[baseCurrency] || 1

  // Convert all rates relative to the base currency
  const rates: Record<string, number> = {}
  for (const [currency, ngnRate] of Object.entries(FALLBACK_RATES)) {
    rates[currency] = ngnRate / baseRate
  }

  return {
    base: baseCurrency,
    rates,
    lastUpdated: new Date(),
    source: 'fallback',
  }
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Fetch exchange rates for a base currency
 */
export async function fetchExchangeRates(
  baseCurrency: string = 'NGN',
  forceRefresh: boolean = false
): Promise<ExchangeRates> {
  // Check cache first
  if (!forceRefresh && isCacheValid()) {
    const cached = loadCachedRates()
    if (cached && cached.rates.base === baseCurrency) {
      return cached.rates
    }
  }

  // Try ExchangeRate-API first
  let rates = await fetchFromExchangeRateAPI(baseCurrency)

  // Fallback to Frankfurter (note: doesn't support NGN directly)
  if (!rates && baseCurrency !== 'NGN') {
    rates = await fetchFromFrankfurter(baseCurrency)
  }

  // Use fallback rates if all APIs fail
  if (!rates) {
    console.warn('Using fallback exchange rates (offline mode)')
    rates = getFallbackRates(baseCurrency)
  }

  // Cache the results
  saveCachedRates(rates)

  return rates
}

/**
 * Convert amount between currencies
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<{ amount: number; rate: number }> {
  if (fromCurrency === toCurrency) {
    return { amount, rate: 1 }
  }

  const rates = await fetchExchangeRates(fromCurrency)
  const rate = rates.rates[toCurrency]

  if (!rate) {
    // Try reverse conversion
    const reverseRates = await fetchExchangeRates(toCurrency)
    const reverseRate = reverseRates.rates[fromCurrency]

    if (reverseRate) {
      const calculatedRate = 1 / reverseRate
      return { amount: amount * calculatedRate, rate: calculatedRate }
    }

    throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`)
  }

  return { amount: amount * rate, rate }
}

/**
 * Get exchange rate between two currencies
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<ExchangeRate> {
  const rates = await fetchExchangeRates(fromCurrency)
  const rate = rates.rates[toCurrency]

  if (!rate) {
    throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`)
  }

  return {
    from: fromCurrency,
    to: toCurrency,
    rate,
    lastUpdated: rates.lastUpdated,
    source: rates.source as ExchangeRate['source'],
  }
}

/**
 * Get multiple exchange rates from a base currency
 */
export async function getMultipleRates(
  baseCurrency: string,
  targetCurrencies: string[]
): Promise<Map<string, ExchangeRate>> {
  const rates = await fetchExchangeRates(baseCurrency)
  const result = new Map<string, ExchangeRate>()

  for (const target of targetCurrencies) {
    if (rates.rates[target]) {
      result.set(target, {
        from: baseCurrency,
        to: target,
        rate: rates.rates[target],
        lastUpdated: rates.lastUpdated,
        source: rates.source as ExchangeRate['source'],
      })
    }
  }

  return result
}

// ============================================================================
// AUTO-REFRESH
// ============================================================================

let refreshInterval: ReturnType<typeof setInterval> | null = null
let refreshCallbacks: Array<(rates: ExchangeRates) => void> = []

/**
 * Start auto-refreshing exchange rates
 */
export function startRateAutoRefresh(
  baseCurrency: string,
  onUpdate: (rates: ExchangeRates) => void,
  intervalMs: number = 4 * 60 * 60 * 1000 // 4 hours default
): void {
  stopRateAutoRefresh()

  refreshCallbacks.push(onUpdate)

  // Initial fetch
  fetchExchangeRates(baseCurrency).then((rates) => {
    refreshCallbacks.forEach((cb) => cb(rates))
  })

  // Set up interval
  refreshInterval = setInterval(async () => {
    try {
      const rates = await fetchExchangeRates(baseCurrency, true)
      refreshCallbacks.forEach((cb) => cb(rates))
    } catch (error) {
      console.error('Auto-refresh exchange rates error:', error)
    }
  }, intervalMs)
}

/**
 * Stop auto-refreshing exchange rates
 */
export function stopRateAutoRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
  refreshCallbacks = []
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format currency amount
 */
export function formatCurrencyAmount(
  amount: number,
  currencyCode: string,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount)
}

/**
 * Get currency info
 */
export function getCurrencyInfo(code: string): CurrencyInfo | undefined {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)
}

/**
 * Check if currency is supported
 */
export function isCurrencySupported(code: string): boolean {
  return SUPPORTED_CURRENCIES.some((c) => c.code === code)
}

/**
 * Get last cached update time
 */
export function getLastRateUpdate(): Date | null {
  const cache = loadCachedRates()
  return cache?.rates.lastUpdated || null
}

/**
 * Clear rate cache
 */
export function clearRateCache(): void {
  cachedRates = null
  localStorage.removeItem(CACHE_KEY)
}
