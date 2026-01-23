import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart as PieChartIcon,
  Search,
  X,
  Briefcase,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Investment } from '../types/finance'
// Price feed service for auto-updating stock/crypto prices
import {
  fetchMixedPrices,
  startAutoRefresh,
  stopAutoRefresh,
  PriceData,
  InvestmentType,
} from '../utils/priceFeedService'
// Supabase data service for cloud sync
import {
  getInvestments,
  createInvestment,
  updateInvestment,
  deleteInvestment,
} from '../utils/financeDataService'
import { useCurrency } from '../contexts/CurrencyContext'

const formatPercent = (value: number) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

const INVESTMENT_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

const INVESTMENT_TYPES = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'bond', label: 'Bond' },
  { value: 'crypto', label: 'Cryptocurrency' },
  { value: 'reit', label: 'REIT' },
  { value: 'commodity', label: 'Commodity' },
  { value: 'other', label: 'Other' },
]

const SECTORS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Industrials',
  'Energy',
  'Utilities',
  'Real Estate',
  'Basic Materials',
  'Communication Services',
  'Other',
]

interface InvestmentFormData {
  symbol: string
  name: string
  type: Investment['type']
  sector: string
  shares: number
  average_cost: number
  current_price: number
  dividend_yield?: number
  last_dividend?: number
  notes?: string
  currency: string
}

const initialFormData: InvestmentFormData = {
  symbol: '',
  name: '',
  type: 'stock',
  sector: 'Technology',
  shares: 0,
  average_cost: 0,
  current_price: 0,
  dividend_yield: undefined,
  last_dividend: undefined,
  notes: '',
  currency: 'NGN', // Will be overridden by current currency in component
}

const InvestmentsManager: React.FC = () => {
  const { formatAmount, currency } = useCurrency()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<InvestmentFormData>({ ...initialFormData, currency: currency.code })
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'value' | 'gain' | 'name'>('value')

  // Price feed state
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false)
  const [priceErrors, setPriceErrors] = useState<string[]>([])

  // Load investments from Supabase/localStorage
  const loadInvestments = useCallback(async () => {
    try {
      const data = await getInvestments()
      setInvestments(data)
    } catch (error) {
      console.error('Error loading investments:', error)
    }
  }, [])

  useEffect(() => {
    loadInvestments()
    // Load auto-refresh preference
    const autoRefresh = localStorage.getItem('spendlytics_auto_refresh_prices')
    setAutoRefreshEnabled(autoRefresh === 'true')
  }, [loadInvestments])

  // Auto-refresh prices effect
  useEffect(() => {
    if (autoRefreshEnabled && investments.length > 0) {
      const symbols = investments.map((inv) => ({
        symbol: inv.symbol,
        type: inv.type as InvestmentType,
      }))

      startAutoRefresh(symbols, handlePriceUpdate, 60000) // 1 minute intervals

      return () => {
        stopAutoRefresh()
      }
    }
  }, [autoRefreshEnabled, investments.length])

  // Handle price updates from auto-refresh
  const handlePriceUpdate = useCallback((prices: Map<string, PriceData>) => {
    setInvestments((prevInvestments) => {
      const updated = prevInvestments.map((inv) => {
        const priceData = prices.get(inv.symbol)
        if (priceData) {
          const newPrice = priceData.currentPrice
          const marketValue = inv.shares * newPrice
          const gainLoss = marketValue - inv.cost_basis
          const gainLossPercent = inv.cost_basis > 0 ? (gainLoss / inv.cost_basis) * 100 : 0

          return {
            ...inv,
            current_price: newPrice,
            market_value: marketValue,
            gain_loss: gainLoss,
            gain_loss_percent: gainLossPercent,
            updated_at: new Date().toISOString(),
          }
        }
        return inv
      })

      // Save to localStorage
      localStorage.setItem('spendlytics_investments', JSON.stringify(updated))
      return updated
    })
    setLastPriceUpdate(new Date())
  }, [])

  // Manual refresh prices
  const refreshPrices = async () => {
    if (investments.length === 0) return

    setIsRefreshing(true)
    setPriceErrors([])

    try {
      const symbols = investments.map((inv) => ({
        symbol: inv.symbol,
        type: inv.type as InvestmentType,
      }))

      const prices = await fetchMixedPrices(symbols)
      handlePriceUpdate(prices)

      // Check for any symbols that didn't get prices
      const missingSymbols = investments
        .filter((inv) => !prices.has(inv.symbol))
        .map((inv) => inv.symbol)

      if (missingSymbols.length > 0) {
        setPriceErrors([`Could not fetch prices for: ${missingSymbols.join(', ')}`])
      }
    } catch (error) {
      console.error('Error refreshing prices:', error)
      setPriceErrors(['Failed to refresh prices. Please try again.'])
    } finally {
      setIsRefreshing(false)
    }
  }

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    const newValue = !autoRefreshEnabled
    setAutoRefreshEnabled(newValue)
    localStorage.setItem('spendlytics_auto_refresh_prices', String(newValue))

    if (!newValue) {
      stopAutoRefresh()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsRefreshing(true)

    const marketValue = formData.shares * formData.current_price
    const costBasis = formData.shares * formData.average_cost
    const gainLoss = marketValue - costBasis
    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0

    const investmentData = {
      symbol: formData.symbol.toUpperCase(),
      name: formData.name,
      type: formData.type,
      sector: formData.sector,
      shares: formData.shares,
      average_cost: formData.average_cost,
      current_price: formData.current_price,
      market_value: marketValue,
      cost_basis: costBasis,
      gain_loss: gainLoss,
      gain_loss_percent: gainLossPercent,
      dividend_yield: formData.dividend_yield,
      last_dividend: formData.last_dividend,
      notes: formData.notes,
    }

    try {
      if (editingId) {
        await updateInvestment(editingId, investmentData)
      } else {
        await createInvestment(investmentData)
      }
      await loadInvestments()
      resetForm()
    } catch (error) {
      console.error('Error saving investment:', error)
      setPriceErrors(['Failed to save investment'])
    } finally {
      setIsRefreshing(false)
    }
  }

  const resetForm = () => {
    setShowModal(false)
    setEditingId(null)
    setFormData(initialFormData)
  }

  const handleEdit = (investment: Investment) => {
    setEditingId(investment.id)
    setFormData({
      symbol: investment.symbol,
      name: investment.name,
      type: investment.type,
      sector: investment.sector || 'Other',
      shares: investment.shares,
      average_cost: investment.average_cost,
      current_price: investment.current_price,
      dividend_yield: investment.dividend_yield,
      last_dividend: investment.last_dividend,
      notes: investment.notes,
      currency: investment.currency || currency.code,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this investment?')) return

    setIsRefreshing(true)
    try {
      await deleteInvestment(id)
      await loadInvestments()
    } catch (error) {
      console.error('Error deleting investment:', error)
      setPriceErrors(['Failed to delete investment'])
    } finally {
      setIsRefreshing(false)
    }
  }

  const updatePrice = async (id: string, newPrice: number) => {
    const investment = investments.find(inv => inv.id === id)
    if (!investment) return

    const marketValue = investment.shares * newPrice
    const gainLoss = marketValue - investment.cost_basis
    const gainLossPercent = investment.cost_basis > 0 ? (gainLoss / investment.cost_basis) * 100 : 0

    // Update local state immediately for responsiveness
    setInvestments(prevInvestments =>
      prevInvestments.map(inv =>
        inv.id === id
          ? {
              ...inv,
              current_price: newPrice,
              market_value: marketValue,
              gain_loss: gainLoss,
              gain_loss_percent: gainLossPercent,
              updated_at: new Date().toISOString(),
            }
          : inv
      )
    )

    // Sync to Supabase in background
    try {
      await updateInvestment(id, {
        current_price: newPrice,
        market_value: marketValue,
        gain_loss: gainLoss,
        gain_loss_percent: gainLossPercent,
      })
    } catch (error) {
      console.error('Error updating price in Supabase:', error)
    }
  }

  // Calculations
  const calculations = useMemo(() => {
    const totalMarketValue = investments.reduce((sum, inv) => sum + inv.market_value, 0)
    const totalCostBasis = investments.reduce((sum, inv) => sum + inv.cost_basis, 0)
    const totalGainLoss = totalMarketValue - totalCostBasis
    const totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0

    const totalDividends = investments.reduce((sum, inv) => {
      if (inv.dividend_yield && inv.market_value) {
        return sum + (inv.market_value * (inv.dividend_yield / 100))
      }
      return sum
    }, 0)

    // By sector
    const bySector = investments.reduce((acc, inv) => {
      const sector = inv.sector || 'Other'
      if (!acc[sector]) acc[sector] = 0
      acc[sector] += inv.market_value
      return acc
    }, {} as Record<string, number>)

    // By type
    const byType = investments.reduce((acc, inv) => {
      if (!acc[inv.type]) acc[inv.type] = 0
      acc[inv.type] += inv.market_value
      return acc
    }, {} as Record<string, number>)

    return {
      totalMarketValue,
      totalCostBasis,
      totalGainLoss,
      totalGainLossPercent,
      totalDividends,
      bySector,
      byType,
    }
  }, [investments])

  // Filtered and sorted investments
  const filteredInvestments = useMemo(() => {
    let result = [...investments]

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        inv =>
          inv.symbol.toLowerCase().includes(query) ||
          inv.name.toLowerCase().includes(query)
      )
    }

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter(inv => inv.type === filterType)
    }

    // Sort
    switch (sortBy) {
      case 'value':
        result.sort((a, b) => b.market_value - a.market_value)
        break
      case 'gain':
        result.sort((a, b) => b.gain_loss_percent - a.gain_loss_percent)
        break
      case 'name':
        result.sort((a, b) => a.symbol.localeCompare(b.symbol))
        break
    }

    return result
  }, [investments, searchQuery, filterType, sortBy])

  // Chart data
  const sectorPieData = useMemo(() => {
    return Object.entries(calculations.bySector)
      .map(([sector, value], index) => ({
        name: sector,
        value,
        color: INVESTMENT_COLORS[index % INVESTMENT_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
  }, [calculations.bySector])

  const typePieData = useMemo(() => {
    return Object.entries(calculations.byType)
      .map(([type, value], index) => ({
        name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value,
        color: INVESTMENT_COLORS[index % INVESTMENT_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
  }, [calculations.byType])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Investment Portfolio</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track your stocks, ETFs, and other investments</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          <button
            onClick={toggleAutoRefresh}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              autoRefreshEnabled
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
            title={autoRefreshEnabled ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
          >
            {autoRefreshEnabled ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span className="hidden sm:inline text-sm">Live</span>
          </button>

          {/* Manual refresh */}
          <button
            onClick={refreshPrices}
            disabled={isRefreshing || investments.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh prices"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline text-sm">Refresh</span>
          </button>

          {/* Add investment */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Investment</span>
          </button>
        </div>
      </div>

      {/* Price update status */}
      {(lastPriceUpdate || priceErrors.length > 0) && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {lastPriceUpdate && (
            <span className="text-gray-500 dark:text-gray-400">
              Prices updated: {lastPriceUpdate.toLocaleTimeString()}
            </span>
          )}
          {priceErrors.map((error, i) => (
            <span key={i} className="text-amber-600 dark:text-amber-400">
              {error}
            </span>
          ))}
        </div>
      )}

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-gray-800 dark:text-white">
          <div className="flex items-center gap-2 text-blue-200 mb-2">
            <Briefcase className="w-4 h-4" />
            <span className="text-sm">Portfolio Value</span>
          </div>
          <p className="text-2xl font-bold">{formatAmount(calculations.totalMarketValue)}</p>
          <p className="text-blue-200 text-sm mt-1">
            Cost basis: {formatAmount(calculations.totalCostBasis)}
          </p>
        </div>

        <div className={`bg-gradient-to-br ${
          calculations.totalGainLoss >= 0 ? 'from-green-600 to-green-700' : 'from-red-600 to-red-700'
        } rounded-xl p-4 text-gray-800 dark:text-white`}>
          <div className="flex items-center gap-2 text-gray-800 dark:text-white/80 mb-2">
            {calculations.totalGainLoss >= 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span className="text-sm">Total Gain/Loss</span>
          </div>
          <p className="text-2xl font-bold">{formatAmount(calculations.totalGainLoss)}</p>
          <p className="text-gray-800 dark:text-white/80 text-sm mt-1">
            {formatPercent(calculations.totalGainLossPercent)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4 text-gray-800 dark:text-white">
          <div className="flex items-center gap-2 text-purple-200 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Annual Dividends</span>
          </div>
          <p className="text-2xl font-bold">{formatAmount(calculations.totalDividends)}</p>
          <p className="text-purple-200 text-sm mt-1">
            Yield: {calculations.totalMarketValue > 0
              ? ((calculations.totalDividends / calculations.totalMarketValue) * 100).toFixed(2)
              : 0}%
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-xl p-4 text-gray-800 dark:text-white">
          <div className="flex items-center gap-2 text-amber-200 mb-2">
            <PieChartIcon className="w-4 h-4" />
            <span className="text-sm">Holdings</span>
          </div>
          <p className="text-2xl font-bold">{investments.length}</p>
          <p className="text-amber-200 text-sm mt-1">
            {Object.keys(calculations.bySector).length} sectors
          </p>
        </div>
      </div>

      {/* Allocation Charts */}
      {investments.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sector Allocation */}
          <div className="bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-200 dark:border-gray-700/50 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Sector Allocation</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="w-36 h-36 sm:w-48 sm:h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {sectorPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatAmount(value)}
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2 max-h-48 overflow-y-auto">
                {sectorPieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-600 dark:text-gray-300 text-sm">{item.name}</span>
                    </div>
                    <span className="text-gray-800 dark:text-white font-medium text-sm">
                      {((item.value / calculations.totalMarketValue) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Type Allocation */}
          <div className="bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-200 dark:border-gray-700/50 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Asset Type Allocation</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="w-36 h-36 sm:w-48 sm:h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {typePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatAmount(value)}
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {typePieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-600 dark:text-gray-300 text-sm">{item.name}</span>
                    </div>
                    <span className="text-gray-800 dark:text-white font-medium text-sm">
                      {((item.value / calculations.totalMarketValue) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
          <input
            type="text"
            placeholder="Search by symbol or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Types</option>
          {INVESTMENT_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'value' | 'gain' | 'name')}
          className="px-4 py-2 bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
        >
          <option value="value">Sort by Value</option>
          <option value="gain">Sort by Gain %</option>
          <option value="name">Sort by Symbol</option>
        </select>
      </div>

      {/* Holdings Table */}
      <div className="bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl border border-white/20 dark:border-gray-200 dark:border-gray-700/50 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-200 dark:bg-gray-700/50">
              <tr>
                <th className="text-left text-gray-500 dark:text-gray-400 font-medium px-4 py-3">Symbol</th>
                <th className="text-left text-gray-500 dark:text-gray-400 font-medium px-4 py-3">Shares</th>
                <th className="text-right text-gray-500 dark:text-gray-400 font-medium px-4 py-3">Avg Cost</th>
                <th className="text-right text-gray-500 dark:text-gray-400 font-medium px-4 py-3">Current Price</th>
                <th className="text-right text-gray-500 dark:text-gray-400 font-medium px-4 py-3">Market Value</th>
                <th className="text-right text-gray-500 dark:text-gray-400 font-medium px-4 py-3">Gain/Loss</th>
                <th className="text-right text-gray-500 dark:text-gray-400 font-medium px-4 py-3">Yield</th>
                <th className="text-center text-gray-500 dark:text-gray-400 font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvestments.map((investment) => (
                <tr key={investment.id} className="border-t border-gray-800 hover:bg-white/50 dark:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-gray-800 dark:text-white font-medium">{investment.symbol}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm truncate max-w-[150px]">{investment.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-800 dark:text-white">{investment.shares.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                    {formatAmount(investment.average_cost)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      value={investment.current_price}
                      onChange={(e) => updatePrice(investment.id, parseFloat(e.target.value) || 0)}
                      className="w-24 px-2 py-1 bg-gray-200 dark:bg-gray-700 border border-gray-600 rounded text-gray-800 dark:text-white text-right focus:outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800 dark:text-white font-medium">
                    {formatAmount(investment.market_value)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div>
                      <p className={investment.gain_loss >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatAmount(investment.gain_loss)}
                      </p>
                      <p className={`text-sm ${investment.gain_loss >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                        {formatPercent(investment.gain_loss_percent)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-purple-400">
                    {investment.dividend_yield ? `${investment.dividend_yield}%` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEdit(investment)}
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(investment.id)}
                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvestments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {investments.length === 0 ? (
                      <div>
                        <Briefcase className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No investments yet</p>
                        <button
                          onClick={() => setShowModal(true)}
                          className="text-blue-400 hover:text-blue-300 mt-2"
                        >
                          Add your first investment
                        </button>
                      </div>
                    ) : (
                      <p>No investments match your search</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Performers */}
      {investments.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Gainers */}
          <div className="bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-200 dark:border-gray-700/50 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Top Gainers
            </h3>
            <div className="space-y-3">
              {[...investments]
                .filter(inv => inv.gain_loss_percent > 0)
                .sort((a, b) => b.gain_loss_percent - a.gain_loss_percent)
                .slice(0, 5)
                .map((investment) => (
                  <div key={investment.id} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-200 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <p className="text-gray-800 dark:text-white font-medium">{investment.symbol}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">{investment.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 font-semibold">
                        {formatPercent(investment.gain_loss_percent)}
                      </p>
                      <p className="text-green-400/70 text-sm">{formatAmount(investment.gain_loss)}</p>
                    </div>
                  </div>
                ))}
              {investments.filter(inv => inv.gain_loss_percent > 0).length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No gainers yet</p>
              )}
            </div>
          </div>

          {/* Top Losers */}
          <div className="bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-200 dark:border-gray-700/50 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-400" />
              Top Losers
            </h3>
            <div className="space-y-3">
              {[...investments]
                .filter(inv => inv.gain_loss_percent < 0)
                .sort((a, b) => a.gain_loss_percent - b.gain_loss_percent)
                .slice(0, 5)
                .map((investment) => (
                  <div key={investment.id} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-200 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <p className="text-gray-800 dark:text-white font-medium">{investment.symbol}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">{investment.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-red-400 font-semibold">
                        {formatPercent(investment.gain_loss_percent)}
                      </p>
                      <p className="text-red-400/70 text-sm">{formatAmount(investment.gain_loss)}</p>
                    </div>
                  </div>
                ))}
              {investments.filter(inv => inv.gain_loss_percent < 0).length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No losers - great job!</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                {editingId ? 'Edit Investment' : 'Add Investment'}
              </h2>
              <button
                onClick={resetForm}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-white hover:bg-gray-200 dark:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Symbol *</label>
                  <input
                    type="text"
                    required
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    placeholder="e.g., AAPL"
                    className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Type *</label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Investment['type'] })}
                    className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
                  >
                    {INVESTMENT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Apple Inc."
                  className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Sector</label>
                <select
                  value={formData.sector}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                  className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  {SECTORS.map(sector => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Shares *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.001"
                    value={formData.shares || ''}
                    onChange={(e) => setFormData({ ...formData, shares: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Avg Cost *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.average_cost || ''}
                    onChange={(e) => setFormData({ ...formData, average_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Current Price *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.current_price || ''}
                    onChange={(e) => setFormData({ ...formData, current_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Dividend Yield %</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.dividend_yield || ''}
                    onChange={(e) => setFormData({ ...formData, dividend_yield: parseFloat(e.target.value) || undefined })}
                    placeholder="e.g., 2.5"
                    className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Last Dividend</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.last_dividend || ''}
                    onChange={(e) => setFormData({ ...formData, last_dividend: parseFloat(e.target.value) || undefined })}
                    placeholder="Per share"
                    className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Preview */}
              {formData.shares > 0 && formData.current_price > 0 && (
                <div className="p-3 bg-gray-100 dark:bg-gray-200 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">Preview</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Market Value:</span>
                      <span className="text-gray-800 dark:text-white ml-2">
                        {formatAmount(formData.shares * formData.current_price)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Cost Basis:</span>
                      <span className="text-gray-800 dark:text-white ml-2">
                        {formatAmount(formData.shares * formData.average_cost)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Gain/Loss:</span>
                      <span className={`ml-2 ${
                        formData.current_price >= formData.average_cost ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatAmount(formData.shares * (formData.current_price - formData.average_cost))}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Return:</span>
                      <span className={`ml-2 ${
                        formData.current_price >= formData.average_cost ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formData.average_cost > 0
                          ? formatPercent(((formData.current_price - formData.average_cost) / formData.average_cost) * 100)
                          : '0%'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 dark:text-white rounded-lg transition-colors"
                >
                  {editingId ? 'Update' : 'Add'} Investment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default InvestmentsManager
