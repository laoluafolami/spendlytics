/**
 * Price Feed Service
 *
 * Provides real-time and historical price data for:
 * - Stocks (via Yahoo Finance API)
 * - Cryptocurrencies (via CoinGecko API)
 * - ETFs (via Yahoo Finance API)
 *
 * Features:
 * - Automatic price updates
 * - Caching to reduce API calls
 * - Batch price fetching
 * - Support for Nigerian stocks (NGX)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface PriceData {
  symbol: string
  name?: string
  currentPrice: number
  previousClose?: number
  change?: number
  changePercent?: number
  currency: string
  lastUpdated: Date
  source: 'yahoo' | 'coingecko' | 'ngx' | 'manual'
}

export interface CryptoData extends PriceData {
  marketCap?: number
  volume24h?: number
  high24h?: number
  low24h?: number
}

export interface PriceFeedConfig {
  cacheTimeout: number // in milliseconds
  maxRetries: number
  enableAutoRefresh: boolean
  refreshInterval: number // in milliseconds
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: PriceFeedConfig = {
  cacheTimeout: 5 * 60 * 1000, // 5 minutes
  maxRetries: 3,
  enableAutoRefresh: false,
  refreshInterval: 60 * 1000, // 1 minute
}

// Cache for price data
const priceCache: Map<string, { data: PriceData; timestamp: number }> = new Map()

// Popular crypto symbol to CoinGecko ID mapping
const CRYPTO_ID_MAP: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  SOL: 'solana',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  SHIB: 'shiba-inu',
  LTC: 'litecoin',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  XLM: 'stellar',
  ALGO: 'algorand',
  VET: 'vechain',
  ICP: 'internet-computer',
  FIL: 'filecoin',
  AAVE: 'aave',
  EOS: 'eos',
  XTZ: 'tezos',
  THETA: 'theta-token',
  XMR: 'monero',
  NEO: 'neo',
  USDT: 'tether',
  USDC: 'usd-coin',
  BUSD: 'binance-usd',
  DAI: 'dai',
}

// ============================================================================
// YAHOO FINANCE API (Stocks, ETFs)
// ============================================================================

/**
 * Fetch stock price from Yahoo Finance
 * Using the public query API (no key required)
 */
export async function fetchStockPrice(symbol: string): Promise<PriceData | null> {
  // Check cache first
  const cached = getCachedPrice(symbol)
  if (cached) return cached

  try {
    // Use Yahoo Finance v8 API (public, no key needed)
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    )

    if (!response.ok) {
      console.warn(`Yahoo Finance API error for ${symbol}: ${response.status}`)
      return null
    }

    const data = await response.json()
    const result = data?.chart?.result?.[0]

    if (!result) {
      console.warn(`No data found for symbol: ${symbol}`)
      return null
    }

    const meta = result.meta

    const priceData: PriceData = {
      symbol: meta.symbol,
      name: meta.shortName || meta.longName,
      currentPrice: meta.regularMarketPrice || meta.previousClose,
      previousClose: meta.chartPreviousClose || meta.previousClose,
      change: meta.regularMarketPrice - (meta.chartPreviousClose || meta.previousClose),
      changePercent:
        ((meta.regularMarketPrice - (meta.chartPreviousClose || meta.previousClose)) /
          (meta.chartPreviousClose || meta.previousClose)) *
        100,
      currency: meta.currency || 'USD',
      lastUpdated: new Date(),
      source: 'yahoo',
    }

    // Cache the result
    setCachedPrice(symbol, priceData)

    return priceData
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch multiple stock prices in batch
 */
export async function fetchMultipleStockPrices(symbols: string[]): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>()
  const symbolsToFetch: string[] = []

  // Check cache first
  for (const symbol of symbols) {
    const cached = getCachedPrice(symbol)
    if (cached) {
      results.set(symbol, cached)
    } else {
      symbolsToFetch.push(symbol)
    }
  }

  // Fetch remaining symbols
  if (symbolsToFetch.length > 0) {
    // Batch into groups of 10 to avoid rate limiting
    const batches = chunkArray(symbolsToFetch, 10)

    for (const batch of batches) {
      const promises = batch.map((symbol) => fetchStockPrice(symbol))
      const batchResults = await Promise.all(promises)

      batchResults.forEach((result, index) => {
        if (result) {
          results.set(batch[index], result)
        }
      })

      // Small delay between batches to avoid rate limiting
      if (batches.length > 1) {
        await sleep(500)
      }
    }
  }

  return results
}

// ============================================================================
// COINGECKO API (Cryptocurrencies)
// ============================================================================

/**
 * Fetch cryptocurrency price from CoinGecko
 * Free tier: 10-50 calls/minute
 */
export async function fetchCryptoPrice(
  symbol: string,
  vsCurrency: string = 'usd'
): Promise<CryptoData | null> {
  // Check cache first
  const cacheKey = `crypto_${symbol}_${vsCurrency}`
  const cached = getCachedPrice(cacheKey) as CryptoData | null
  if (cached) return cached

  try {
    // Convert symbol to CoinGecko ID
    const coinId = CRYPTO_ID_MAP[symbol.toUpperCase()] || symbol.toLowerCase()

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${vsCurrency}&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.warn(`CoinGecko API error for ${symbol}: ${response.status}`)
      return null
    }

    const data = await response.json()
    const coinData = data[coinId]

    if (!coinData) {
      console.warn(`No crypto data found for: ${symbol}`)
      return null
    }

    const priceData: CryptoData = {
      symbol: symbol.toUpperCase(),
      currentPrice: coinData[vsCurrency],
      changePercent: coinData[`${vsCurrency}_24h_change`],
      change: coinData[vsCurrency] * (coinData[`${vsCurrency}_24h_change`] / 100),
      currency: vsCurrency.toUpperCase(),
      lastUpdated: new Date(),
      source: 'coingecko',
      marketCap: coinData[`${vsCurrency}_market_cap`],
      volume24h: coinData[`${vsCurrency}_24h_vol`],
    }

    // Cache the result
    setCachedPrice(cacheKey, priceData)

    return priceData
  } catch (error) {
    console.error(`Error fetching crypto price for ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch multiple cryptocurrency prices in batch
 */
export async function fetchMultipleCryptoPrices(
  symbols: string[],
  vsCurrency: string = 'usd'
): Promise<Map<string, CryptoData>> {
  const results = new Map<string, CryptoData>()

  // Convert symbols to CoinGecko IDs
  const coinIds = symbols
    .map((s) => CRYPTO_ID_MAP[s.toUpperCase()] || s.toLowerCase())
    .join(',')

  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=${vsCurrency}&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.warn(`CoinGecko batch API error: ${response.status}`)
      return results
    }

    const data = await response.json()

    symbols.forEach((symbol) => {
      const coinId = CRYPTO_ID_MAP[symbol.toUpperCase()] || symbol.toLowerCase()
      const coinData = data[coinId]

      if (coinData) {
        const priceData: CryptoData = {
          symbol: symbol.toUpperCase(),
          currentPrice: coinData[vsCurrency],
          changePercent: coinData[`${vsCurrency}_24h_change`],
          change: coinData[vsCurrency] * (coinData[`${vsCurrency}_24h_change`] / 100),
          currency: vsCurrency.toUpperCase(),
          lastUpdated: new Date(),
          source: 'coingecko',
          marketCap: coinData[`${vsCurrency}_market_cap`],
          volume24h: coinData[`${vsCurrency}_24h_vol`],
        }
        results.set(symbol.toUpperCase(), priceData)

        // Cache individually
        setCachedPrice(`crypto_${symbol}_${vsCurrency}`, priceData)
      }
    })
  } catch (error) {
    console.error('Error fetching batch crypto prices:', error)
  }

  return results
}

// ============================================================================
// UNIVERSAL PRICE FETCHER
// ============================================================================

export type InvestmentType = 'stock' | 'etf' | 'mutual_fund' | 'bond' | 'crypto' | 'reit' | 'commodity' | 'other'

/**
 * Fetch price for any investment type
 */
export async function fetchPrice(
  symbol: string,
  type: InvestmentType,
  currency: string = 'USD'
): Promise<PriceData | null> {
  switch (type) {
    case 'crypto':
      return fetchCryptoPrice(symbol, currency.toLowerCase())

    case 'stock':
    case 'etf':
    case 'reit':
      return fetchStockPrice(symbol)

    case 'mutual_fund':
      // Many mutual funds are on Yahoo Finance
      return fetchStockPrice(symbol)

    case 'commodity':
      // Commodities often have special symbols on Yahoo
      // Gold: GC=F, Silver: SI=F, Oil: CL=F
      return fetchStockPrice(symbol)

    default:
      // Try Yahoo Finance as default
      return fetchStockPrice(symbol)
  }
}

/**
 * Fetch prices for multiple investments of mixed types
 */
export async function fetchMixedPrices(
  investments: Array<{ symbol: string; type: InvestmentType }>
): Promise<Map<string, PriceData>> {
  const results = new Map<string, PriceData>()

  // Separate by type for batch fetching
  const cryptos = investments.filter((i) => i.type === 'crypto')
  const stocks = investments.filter((i) => i.type !== 'crypto')

  // Fetch cryptos in batch
  if (cryptos.length > 0) {
    const cryptoPrices = await fetchMultipleCryptoPrices(cryptos.map((c) => c.symbol))
    cryptoPrices.forEach((price, symbol) => {
      results.set(symbol, price)
    })
  }

  // Fetch stocks in batch
  if (stocks.length > 0) {
    const stockPrices = await fetchMultipleStockPrices(stocks.map((s) => s.symbol))
    stockPrices.forEach((price, symbol) => {
      results.set(symbol, price)
    })
  }

  return results
}

// ============================================================================
// AUTO-REFRESH MANAGER
// ============================================================================

let refreshInterval: ReturnType<typeof setInterval> | null = null
let refreshCallbacks: Array<(prices: Map<string, PriceData>) => void> = []
let watchedSymbols: Array<{ symbol: string; type: InvestmentType }> = []

/**
 * Start auto-refreshing prices
 */
export function startAutoRefresh(
  symbols: Array<{ symbol: string; type: InvestmentType }>,
  onUpdate: (prices: Map<string, PriceData>) => void,
  intervalMs: number = 60000
): void {
  // Stop existing interval
  stopAutoRefresh()

  watchedSymbols = symbols
  refreshCallbacks.push(onUpdate)

  // Initial fetch
  fetchMixedPrices(symbols).then((prices) => {
    refreshCallbacks.forEach((cb) => cb(prices))
  })

  // Set up interval
  refreshInterval = setInterval(async () => {
    try {
      const prices = await fetchMixedPrices(watchedSymbols)
      refreshCallbacks.forEach((cb) => cb(prices))
    } catch (error) {
      console.error('Auto-refresh error:', error)
    }
  }, intervalMs)
}

/**
 * Stop auto-refreshing prices
 */
export function stopAutoRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
  refreshCallbacks = []
  watchedSymbols = []
}

/**
 * Add symbols to watch list
 */
export function addToWatchList(symbols: Array<{ symbol: string; type: InvestmentType }>): void {
  const newSymbols = symbols.filter(
    (s) => !watchedSymbols.some((w) => w.symbol === s.symbol)
  )
  watchedSymbols = [...watchedSymbols, ...newSymbols]
}

/**
 * Remove symbols from watch list
 */
export function removeFromWatchList(symbols: string[]): void {
  watchedSymbols = watchedSymbols.filter((w) => !symbols.includes(w.symbol))
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

function getCachedPrice(key: string): PriceData | null {
  const cached = priceCache.get(key)
  if (!cached) return null

  // Check if cache is still valid
  if (Date.now() - cached.timestamp > DEFAULT_CONFIG.cacheTimeout) {
    priceCache.delete(key)
    return null
  }

  return cached.data
}

function setCachedPrice(key: string, data: PriceData): void {
  priceCache.set(key, { data, timestamp: Date.now() })
}

/**
 * Clear all cached prices
 */
export function clearPriceCache(): void {
  priceCache.clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: priceCache.size,
    keys: Array.from(priceCache.keys()),
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check if a symbol is a known cryptocurrency
 */
export function isCryptocurrency(symbol: string): boolean {
  return symbol.toUpperCase() in CRYPTO_ID_MAP
}

/**
 * Get supported cryptocurrency list
 */
export function getSupportedCryptos(): string[] {
  return Object.keys(CRYPTO_ID_MAP)
}

/**
 * Format price change for display
 */
export function formatPriceChange(
  change: number | undefined,
  changePercent: number | undefined
): { text: string; isPositive: boolean } {
  if (change === undefined || changePercent === undefined) {
    return { text: '-', isPositive: false }
  }

  const isPositive = change >= 0
  const sign = isPositive ? '+' : ''
  const text = `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`

  return { text, isPositive }
}
