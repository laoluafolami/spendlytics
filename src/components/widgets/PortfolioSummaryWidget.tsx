/**
 * Portfolio Summary Widget
 *
 * Compact widget for displaying portfolio value, gain/loss, and dividends
 * Designed for dashboard integration
 */

import { useState, useEffect } from 'react'
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  ChevronRight,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { Investment } from '../../types/finance'
import { getInvestments } from '../../utils/financeDataService'
import { useCurrency } from '../../contexts/CurrencyContext'

interface PortfolioSummaryWidgetProps {
  onViewAllClick?: () => void
}

// Helper to calculate days until sell
function calculateDaysUntilSell(
  purchaseDate?: string,
  holdingPeriodMonths?: number
): number | null {
  if (!purchaseDate || !holdingPeriodMonths) return null
  const purchase = new Date(purchaseDate)
  const targetSell = new Date(purchase)
  targetSell.setMonth(targetSell.getMonth() + holdingPeriodMonths)
  const today = new Date()
  const diffTime = targetSell.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export default function PortfolioSummaryWidget({
  onViewAllClick,
}: PortfolioSummaryWidgetProps) {
  const { formatAmount } = useCurrency()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getInvestments()
        setInvestments(data)
      } catch (error) {
        console.error('Error loading investments for widget:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Calculate metrics
  const totalValue = investments.reduce((sum, inv) => sum + inv.market_value, 0)
  const totalCost = investments.reduce((sum, inv) => sum + inv.cost_basis, 0)
  const totalGain = totalValue - totalCost
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0

  // Calculate dividends
  const totalDividends = investments.reduce((sum, inv) => {
    if (inv.dividend_per_share) {
      return sum + inv.dividend_per_share * inv.shares
    } else if (inv.dividend_yield && inv.market_value) {
      return sum + inv.market_value * (inv.dividend_yield / 100)
    }
    return sum
  }, 0)

  // YOC
  const yieldOnCost = totalCost > 0 ? (totalDividends / totalCost) * 100 : 0

  // Win/Loss
  const winners = investments.filter((inv) => inv.gain_loss > 0).length
  const losers = investments.filter((inv) => inv.gain_loss < 0).length

  // Holdings nearing sell date
  const holdingsNearingSell = investments.filter((inv) => {
    const daysUntil = calculateDaysUntilSell(inv.purchase_date, inv.holding_period_months)
    return daysUntil !== null && daysUntil > 0 && daysUntil <= 30
  })

  if (loading) {
    return (
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (investments.length === 0) {
    return (
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-500" />
            Portfolio
          </h3>
        </div>
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No investments yet</p>
          <button
            onClick={onViewAllClick}
            className="text-blue-500 hover:underline text-sm mt-1"
          >
            Add your first investment
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-blue-500" />
          Portfolio
        </h3>
        <button
          onClick={onViewAllClick}
          className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
        >
          View All
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Portfolio Value */}
          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-1">
              <Briefcase className="w-4 h-4" />
              <span className="text-xs font-medium">Value</span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {formatAmount(totalValue)}
            </p>
          </div>

          {/* Gain/Loss */}
          <div
            className={`bg-gradient-to-br ${
              totalGain >= 0
                ? 'from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20'
                : 'from-red-500/10 to-rose-500/10 dark:from-red-500/20 dark:to-rose-500/20'
            } rounded-lg p-3`}
          >
            <div
              className={`flex items-center gap-1.5 ${
                totalGain >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              } mb-1`}
            >
              {totalGain >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="text-xs font-medium">Gain/Loss</span>
            </div>
            <p
              className={`text-lg font-bold ${
                totalGain >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {totalGain >= 0 ? '+' : ''}
              {formatAmount(totalGain)}
            </p>
            <p
              className={`text-xs ${
                totalGain >= 0 ? 'text-green-500/70 dark:text-green-400/70' : 'text-red-500/70 dark:text-red-400/70'
              }`}
            >
              {totalGainPercent >= 0 ? '+' : ''}
              {totalGainPercent.toFixed(2)}%
            </p>
          </div>

          {/* Annual Dividends */}
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Dividends/yr</span>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {formatAmount(totalDividends)}
            </p>
            <p className="text-xs text-purple-500/70 dark:text-purple-400/70">
              YOC: {yieldOnCost.toFixed(2)}%
            </p>
          </div>

          {/* Win/Loss */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 mb-1">
              <span className="text-xs font-medium">Win/Loss</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {winners}
                </span>
              </div>
              <span className="text-gray-400">/</span>
              <div className="flex items-center gap-1">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-lg font-bold text-red-600 dark:text-red-400">{losers}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Holdings Nearing Sell Date */}
        {holdingsNearingSell.length > 0 && (
          <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Approaching Sell Date</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {holdingsNearingSell.slice(0, 3).map((inv) => {
                const daysUntil = calculateDaysUntilSell(
                  inv.purchase_date,
                  inv.holding_period_months
                )
                return (
                  <span
                    key={inv.id}
                    className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 rounded text-xs font-medium text-orange-700 dark:text-orange-300"
                  >
                    {inv.symbol}: {daysUntil}d
                  </span>
                )
              })}
              {holdingsNearingSell.length > 3 && (
                <span className="px-2 py-1 text-xs text-orange-600 dark:text-orange-400">
                  +{holdingsNearingSell.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
