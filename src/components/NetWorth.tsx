import React, { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  PiggyBank,
  Building2,
  Briefcase,
  ArrowRight,
  Calendar,
  Target,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'
import { Asset, Liability } from '../types/finance'

interface NetWorthProps {
  onNavigate?: (view: string) => void
}

interface NetWorthSnapshot {
  date: string
  assets: number
  liabilities: number
  netWorth: number
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const ASSET_COLORS: Record<string, string> = {
  liquid: '#10B981',
  marketable: '#3B82F6',
  long_term: '#8B5CF6',
  personal: '#F59E0B',
}

const LIABILITY_COLORS: Record<string, string> = {
  credit_card: '#EF4444',
  mortgage: '#F97316',
  car_loan: '#F59E0B',
  student_loan: '#84CC16',
  personal_loan: '#06B6D4',
  business_loan: '#8B5CF6',
  family_loan: '#EC4899',
}

const CATEGORY_LABELS: Record<string, string> = {
  liquid: 'Liquid Assets',
  marketable: 'Marketable Securities',
  long_term: 'Long-term Assets',
  personal: 'Personal Assets',
}

const NetWorth: React.FC<NetWorthProps> = ({ onNavigate }) => {
  const [assets, setAssets] = useState<Asset[]>([])
  const [liabilities, setLiabilities] = useState<Liability[]>([])
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthSnapshot[]>([])
  const [timeframe, setTimeframe] = useState<'6m' | '1y' | 'all'>('1y')

  useEffect(() => {
    // Load assets from localStorage
    const savedAssets = localStorage.getItem('spendlytics_assets')
    if (savedAssets) {
      setAssets(JSON.parse(savedAssets))
    }

    // Load liabilities from localStorage
    const savedLiabilities = localStorage.getItem('spendlytics_liabilities')
    if (savedLiabilities) {
      setLiabilities(JSON.parse(savedLiabilities))
    }

    // Load or generate net worth history
    const savedHistory = localStorage.getItem('spendlytics_networth_history')
    if (savedHistory) {
      setNetWorthHistory(JSON.parse(savedHistory))
    }
  }, [])

  // Calculate totals
  const calculations = useMemo(() => {
    const totalAssets = assets.reduce((sum, asset) => sum + asset.value, 0)
    const totalLiabilities = liabilities.reduce((sum, liability) => sum + liability.current_balance, 0)
    const netWorth = totalAssets - totalLiabilities

    // Group assets by category
    const assetsByCategory = assets.reduce((acc, asset) => {
      const category = asset.category
      if (!acc[category]) acc[category] = 0
      acc[category] += asset.value
      return acc
    }, {} as Record<string, number>)

    // Group liabilities by type
    const liabilitiesByType = liabilities.reduce((acc, liability) => {
      const type = liability.type
      if (!acc[type]) acc[type] = 0
      acc[type] += liability.current_balance
      return acc
    }, {} as Record<string, number>)

    // Calculate debt-to-asset ratio
    const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0

    // Calculate liquidity ratio
    const liquidAssets = assets
      .filter(a => a.category === 'liquid')
      .reduce((sum, a) => sum + a.value, 0)
    const liquidityRatio = totalLiabilities > 0 ? liquidAssets / totalLiabilities : 0

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      assetsByCategory,
      liabilitiesByType,
      debtToAssetRatio,
      liquidityRatio,
    }
  }, [assets, liabilities])

  // Prepare chart data
  const assetPieData = useMemo(() => {
    return Object.entries(calculations.assetsByCategory).map(([category, value]) => ({
      name: CATEGORY_LABELS[category] || category,
      value,
      color: ASSET_COLORS[category] || '#6B7280',
    }))
  }, [calculations.assetsByCategory])

  const liabilityPieData = useMemo(() => {
    return Object.entries(calculations.liabilitiesByType).map(([type, value]) => ({
      name: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value,
      color: LIABILITY_COLORS[type] || '#6B7280',
    }))
  }, [calculations.liabilitiesByType])

  const comparisonData = useMemo(() => {
    return [
      { name: 'Assets', value: calculations.totalAssets, fill: '#10B981' },
      { name: 'Liabilities', value: calculations.totalLiabilities, fill: '#EF4444' },
    ]
  }, [calculations])

  // Save snapshot
  const saveSnapshot = () => {
    const today = new Date().toISOString().split('T')[0]
    const existingIndex = netWorthHistory.findIndex(s => s.date === today)

    const newSnapshot: NetWorthSnapshot = {
      date: today,
      assets: calculations.totalAssets,
      liabilities: calculations.totalLiabilities,
      netWorth: calculations.netWorth,
    }

    let updatedHistory: NetWorthSnapshot[]
    if (existingIndex >= 0) {
      updatedHistory = [...netWorthHistory]
      updatedHistory[existingIndex] = newSnapshot
    } else {
      updatedHistory = [...netWorthHistory, newSnapshot].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )
    }

    setNetWorthHistory(updatedHistory)
    localStorage.setItem('spendlytics_networth_history', JSON.stringify(updatedHistory))
  }

  // Filter history by timeframe
  const filteredHistory = useMemo(() => {
    const now = new Date()
    let startDate: Date

    switch (timeframe) {
      case '6m':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1)
        break
      case '1y':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1)
        break
      default:
        return netWorthHistory
    }

    return netWorthHistory.filter(s => new Date(s.date) >= startDate)
  }, [netWorthHistory, timeframe])

  // Get financial health score
  const getHealthScore = () => {
    let score = 50 // Base score

    // Positive net worth is good
    if (calculations.netWorth > 0) score += 20

    // Low debt-to-asset ratio is good
    if (calculations.debtToAssetRatio < 30) score += 15
    else if (calculations.debtToAssetRatio < 50) score += 10
    else if (calculations.debtToAssetRatio > 80) score -= 10

    // Good liquidity ratio
    if (calculations.liquidityRatio > 0.5) score += 15
    else if (calculations.liquidityRatio > 0.2) score += 10

    return Math.min(100, Math.max(0, score))
  }

  const healthScore = getHealthScore()
  const healthColor = healthScore >= 70 ? 'text-green-400' : healthScore >= 50 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Balance Sheet</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Your complete financial picture</p>
        </div>
        <button
          onClick={saveSnapshot}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 dark:text-white rounded-lg transition-colors"
        >
          <Calendar className="w-4 h-4" />
          Save Snapshot
        </button>
      </div>

      {/* Net Worth Summary */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl p-6 text-gray-800 dark:text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-blue-100 text-sm">Total Net Worth</p>
            <h2 className={`text-4xl font-bold ${calculations.netWorth >= 0 ? 'text-gray-800 dark:text-white' : 'text-red-200'}`}>
              {formatCurrency(calculations.netWorth)}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-blue-100 text-sm">Financial Health Score</p>
            <div className="flex items-center gap-2 justify-end">
              <span className={`text-3xl font-bold ${healthColor}`}>{healthScore}</span>
              <span className="text-blue-200">/100</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
          <div
            className="cursor-pointer hover:bg-white/10 rounded-lg p-2 transition-colors"
            onClick={() => onNavigate?.('assets')}
          >
            <div className="flex items-center gap-2 text-green-200">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Total Assets</span>
            </div>
            <p className="text-xl font-semibold mt-1">{formatCurrency(calculations.totalAssets)}</p>
          </div>
          <div
            className="cursor-pointer hover:bg-white/10 rounded-lg p-2 transition-colors"
            onClick={() => onNavigate?.('liabilities')}
          >
            <div className="flex items-center gap-2 text-red-200">
              <TrendingDown className="w-4 h-4" />
              <span className="text-sm">Total Liabilities</span>
            </div>
            <p className="text-xl font-semibold mt-1">{formatCurrency(calculations.totalLiabilities)}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-blue-200">
              <Target className="w-4 h-4" />
              <span className="text-sm">Debt-to-Asset</span>
            </div>
            <p className="text-xl font-semibold mt-1">{calculations.debtToAssetRatio.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div
          className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-4 border border-white/20 dark:border-gray-700/50 shadow-lg hover:border-green-500/50 transition-colors cursor-pointer"
          onClick={() => onNavigate?.('assets')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Wallet className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Liquid Assets</p>
              <p className="text-gray-800 dark:text-white font-semibold">
                {formatCurrency(calculations.assetsByCategory['liquid'] || 0)}
              </p>
            </div>
          </div>
        </div>

        <div
          className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-4 border border-white/20 dark:border-gray-700/50 shadow-lg hover:border-blue-500/50 transition-colors cursor-pointer"
          onClick={() => onNavigate?.('assets')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Briefcase className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Investments</p>
              <p className="text-gray-800 dark:text-white font-semibold">
                {formatCurrency(calculations.assetsByCategory['marketable'] || 0)}
              </p>
            </div>
          </div>
        </div>

        <div
          className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-4 border border-white/20 dark:border-gray-700/50 shadow-lg hover:border-purple-500/50 transition-colors cursor-pointer"
          onClick={() => onNavigate?.('assets')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Building2 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Long-term Assets</p>
              <p className="text-gray-800 dark:text-white font-semibold">
                {formatCurrency(calculations.assetsByCategory['long_term'] || 0)}
              </p>
            </div>
          </div>
        </div>

        <div
          className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-4 border border-white/20 dark:border-gray-700/50 shadow-lg hover:border-red-500/50 transition-colors cursor-pointer"
          onClick={() => onNavigate?.('liabilities')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <CreditCard className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Total Debt</p>
              <p className="text-gray-800 dark:text-white font-semibold">
                {formatCurrency(calculations.totalLiabilities)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets vs Liabilities Comparison */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-700/50 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Assets vs Liabilities</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" tickFormatter={(value) => `₦${(value / 1000000).toFixed(1)}M`} stroke="#9CA3AF" />
                <YAxis type="category" dataKey="name" stroke="#9CA3AF" />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#F3F4F6' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Net Worth Trend */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-700/50 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Net Worth Trend</h3>
            <div className="flex gap-2">
              {(['6m', '1y', 'all'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    timeframe === tf
                      ? 'bg-blue-600 text-gray-800 dark:text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {tf === 'all' ? 'All' : tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            {filteredHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredHistory}>
                  <defs>
                    <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    stroke="#9CA3AF"
                    tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                  />
                  <YAxis
                    stroke="#9CA3AF"
                    tickFormatter={(value) => `₦${(value / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#F3F4F6' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="netWorth"
                    stroke="#3B82F6"
                    fill="url(#netWorthGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No history yet</p>
                  <p className="text-sm">Click "Save Snapshot" to start tracking</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Asset & Liability Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Breakdown */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-700/50 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Asset Breakdown</h3>
            <button
              onClick={() => onNavigate?.('assets')}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
            >
              Manage <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {assetPieData.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assetPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {assetPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {assetPieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-600 dark:text-gray-300 text-sm">{item.name}</span>
                    </div>
                    <span className="text-gray-800 dark:text-white font-medium">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <PiggyBank className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No assets recorded</p>
                <button
                  onClick={() => onNavigate?.('assets')}
                  className="text-blue-400 hover:text-blue-300 text-sm mt-2"
                >
                  Add your first asset
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Liability Breakdown */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-700/50 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Liability Breakdown</h3>
            <button
              onClick={() => onNavigate?.('liabilities')}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
            >
              Manage <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {liabilityPieData.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={liabilityPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {liabilityPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {liabilityPieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-600 dark:text-gray-300 text-sm">{item.name}</span>
                    </div>
                    <span className="text-gray-800 dark:text-white font-medium">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No liabilities recorded</p>
                <p className="text-sm mt-1 text-green-400">Great job staying debt-free!</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Assets & Liabilities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Assets */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-700/50 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Top Assets</h3>
          <div className="space-y-3">
            {assets
              .sort((a, b) => b.value - a.value)
              .slice(0, 5)
              .map((asset) => (
                <div key={asset.id} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-200 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-8 rounded-full"
                      style={{ backgroundColor: ASSET_COLORS[asset.category] }}
                    />
                    <div>
                      <p className="text-gray-800 dark:text-white font-medium">{asset.name}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        {asset.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                    </div>
                  </div>
                  <p className="text-green-400 font-semibold">{formatCurrency(asset.value)}</p>
                </div>
              ))}
            {assets.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No assets to display</p>
            )}
          </div>
        </div>

        {/* Top Liabilities */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-700/50 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Top Liabilities</h3>
          <div className="space-y-3">
            {liabilities
              .sort((a, b) => b.current_balance - a.current_balance)
              .slice(0, 5)
              .map((liability) => (
                <div key={liability.id} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-200 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-8 rounded-full"
                      style={{ backgroundColor: LIABILITY_COLORS[liability.type] }}
                    />
                    <div>
                      <p className="text-gray-800 dark:text-white font-medium">{liability.name}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        {liability.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        {liability.interest_rate && ` · ${liability.interest_rate}% APR`}
                      </p>
                    </div>
                  </div>
                  <p className="text-red-400 font-semibold">{formatCurrency(liability.current_balance)}</p>
                </div>
              ))}
            {liabilities.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">No liabilities to display</p>
            )}
          </div>
        </div>
      </div>

      {/* Financial Ratios */}
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-700/50 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Financial Health Indicators</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 dark:text-gray-400">Debt-to-Asset Ratio</span>
              <span className={`font-semibold ${
                calculations.debtToAssetRatio < 30 ? 'text-green-400' :
                calculations.debtToAssetRatio < 50 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {calculations.debtToAssetRatio.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  calculations.debtToAssetRatio < 30 ? 'bg-green-500' :
                  calculations.debtToAssetRatio < 50 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, calculations.debtToAssetRatio)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Target: Below 30%</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 dark:text-gray-400">Liquidity Ratio</span>
              <span className={`font-semibold ${
                calculations.liquidityRatio > 0.5 ? 'text-green-400' :
                calculations.liquidityRatio > 0.2 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {calculations.liquidityRatio.toFixed(2)}x
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  calculations.liquidityRatio > 0.5 ? 'bg-green-500' :
                  calculations.liquidityRatio > 0.2 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, calculations.liquidityRatio * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Target: Above 0.5x</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 dark:text-gray-400">Net Worth Status</span>
              <span className={`font-semibold ${calculations.netWorth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {calculations.netWorth >= 0 ? 'Positive' : 'Negative'}
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${calculations.netWorth >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: '100%' }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {calculations.netWorth >= 0 ? 'Assets exceed liabilities' : 'Liabilities exceed assets'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NetWorth
