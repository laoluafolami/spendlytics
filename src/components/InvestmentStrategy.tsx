/**
 * Investment Strategy Component
 *
 * UI for managing investment strategies like Magic Formula, Dividend Growth, etc.
 * Tracks holdings, sell dates, and performance.
 */

import { useState, useEffect } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Target,
  Clock,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Link2,
  Briefcase,
} from 'lucide-react'
import { differenceInDays } from 'date-fns'

import { useAuth } from '../contexts/AuthContext'
import { useCurrency } from '../contexts/CurrencyContext'
import { Investment } from '../types/finance'
import {
  InvestmentStrategy,
  StrategyHolding,
  StrategyFormData,
  STRATEGY_TYPE_CONFIG,
  REBALANCE_FREQUENCY_LABELS,
  HOLDING_STATUS_CONFIG,
  StrategyType,
  RebalanceFrequency,
} from '../types/investmentStrategy'
import {
  getStrategies,
  createStrategy,
  updateStrategy,
  deleteStrategy,
  getStrategyHoldings,
  addHoldingToStrategy,
  updateStrategyHolding,
  deleteStrategyHolding,
  getStrategyPerformance,
  getHoldingsNearingSellDate,
} from '../utils/investmentStrategyService'
import { getInvestments } from '../utils/financeDataService'
import { getLifeGoals } from '../utils/lifeGoalsService'
import { LifeGoal } from '../types/lifeGoals'

// ============================================================================
// INITIAL FORM DATA
// ============================================================================

const initialStrategyForm: StrategyFormData = {
  name: '',
  description: '',
  type: 'magic_formula',
  minHoldings: '',
  maxHoldings: '',
  targetHoldings: '',
  holdingPeriodMonths: '',
  rebalanceFrequency: '',
  maxPositionPercent: '',
  linkedGoalId: '',
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function InvestmentStrategyManager() {
  const { user } = useAuth()
  const { formatAmount } = useCurrency()

  // Data state
  const [strategies, setStrategies] = useState<InvestmentStrategy[]>([])
  const [holdings, setHoldings] = useState<Map<string, StrategyHolding[]>>(new Map())
  const [investments, setInvestments] = useState<Investment[]>([])
  const [goals, setGoals] = useState<LifeGoal[]>([])
  const [loading, setLoading] = useState(true)

  // Performance state
  const [performanceData, setPerformanceData] = useState<
    Map<string, Awaited<ReturnType<typeof getStrategyPerformance>>>
  >(new Map())
  const [holdingsNearingSell, setHoldingsNearingSell] = useState<
    Array<StrategyHolding & { investment?: Investment; daysUntilSell: number }>
  >([])

  // UI state
  const [showStrategyForm, setShowStrategyForm] = useState(false)
  const [editingStrategy, setEditingStrategy] = useState<InvestmentStrategy | null>(null)
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null)
  const [showAddHolding, setShowAddHolding] = useState<string | null>(null)
  const [selectedInvestmentId, setSelectedInvestmentId] = useState<string>('')

  // Form state
  const [strategyForm, setStrategyForm] = useState<StrategyFormData>(initialStrategyForm)

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const [strategiesData, investmentsData, goalsData, nearingSell] = await Promise.all([
        getStrategies(),
        getInvestments(),
        getLifeGoals(),
        getHoldingsNearingSellDate(undefined, 30),
      ])

      setStrategies(strategiesData)
      setInvestments(investmentsData)
      setGoals(goalsData)
      setHoldingsNearingSell(nearingSell)

      // Load holdings and performance for each strategy
      const holdingsMap = new Map<string, StrategyHolding[]>()
      const perfMap = new Map<string, Awaited<ReturnType<typeof getStrategyPerformance>>>()

      await Promise.all(
        strategiesData.map(async (strategy) => {
          const [strategyHoldings, perf] = await Promise.all([
            getStrategyHoldings(strategy.id),
            getStrategyPerformance(strategy.id),
          ])
          holdingsMap.set(strategy.id, strategyHoldings)
          perfMap.set(strategy.id, perf)
        })
      )

      setHoldings(holdingsMap)
      setPerformanceData(perfMap)
    } catch (error) {
      console.error('Error loading strategy data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleStrategySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      // Get default params from strategy type
      const defaultParams = STRATEGY_TYPE_CONFIG[strategyForm.type as StrategyType].defaultParams

      const strategyData = {
        name: strategyForm.name,
        description: strategyForm.description || undefined,
        type: strategyForm.type as StrategyType,
        parameters: {
          ...defaultParams,
          minHoldings: strategyForm.minHoldings
            ? parseInt(strategyForm.minHoldings)
            : defaultParams.minHoldings,
          maxHoldings: strategyForm.maxHoldings
            ? parseInt(strategyForm.maxHoldings)
            : defaultParams.maxHoldings,
          targetHoldings: strategyForm.targetHoldings
            ? parseInt(strategyForm.targetHoldings)
            : defaultParams.targetHoldings,
          holdingPeriodMonths: strategyForm.holdingPeriodMonths
            ? parseInt(strategyForm.holdingPeriodMonths)
            : defaultParams.holdingPeriodMonths,
          rebalanceFrequency: (strategyForm.rebalanceFrequency as RebalanceFrequency) ||
            defaultParams.rebalanceFrequency,
          maxPositionPercent: strategyForm.maxPositionPercent
            ? parseFloat(strategyForm.maxPositionPercent)
            : defaultParams.maxPositionPercent,
        },
        linkedGoalId: strategyForm.linkedGoalId || undefined,
        isActive: true,
      }

      if (editingStrategy) {
        await updateStrategy(editingStrategy.id, strategyData)
      } else {
        await createStrategy(strategyData)
      }

      await loadData()
      resetStrategyForm()
    } catch (error) {
      console.error('Error saving strategy:', error)
      alert('Failed to save strategy. Please try again.')
    }
  }

  const handleDeleteStrategy = async (id: string) => {
    if (!confirm('Are you sure you want to delete this strategy? All associated holdings will be unlinked.')) {
      return
    }

    try {
      await deleteStrategy(id)
      await loadData()
    } catch (error) {
      console.error('Error deleting strategy:', error)
      alert('Failed to delete strategy.')
    }
  }

  const handleEditStrategy = (strategy: InvestmentStrategy) => {
    setEditingStrategy(strategy)
    setStrategyForm({
      name: strategy.name,
      description: strategy.description || '',
      type: strategy.type,
      minHoldings: strategy.parameters.minHoldings?.toString() || '',
      maxHoldings: strategy.parameters.maxHoldings?.toString() || '',
      targetHoldings: strategy.parameters.targetHoldings?.toString() || '',
      holdingPeriodMonths: strategy.parameters.holdingPeriodMonths?.toString() || '',
      rebalanceFrequency: strategy.parameters.rebalanceFrequency || '',
      maxPositionPercent: strategy.parameters.maxPositionPercent?.toString() || '',
      linkedGoalId: strategy.linkedGoalId || '',
    })
    setShowStrategyForm(true)
  }

  const handleAddHolding = async (strategyId: string) => {
    if (!selectedInvestmentId) {
      alert('Please select an investment')
      return
    }

    const strategy = strategies.find((s) => s.id === strategyId)
    const investment = investments.find((i) => i.id === selectedInvestmentId)
    if (!strategy || !investment) return

    // Calculate target sell date
    const buyDate = investment.purchase_date || new Date().toISOString().split('T')[0]
    let targetSellDate: string | undefined

    if (strategy.parameters.holdingPeriodMonths) {
      const buyDateObj = new Date(buyDate)
      buyDateObj.setMonth(buyDateObj.getMonth() + strategy.parameters.holdingPeriodMonths)
      targetSellDate = buyDateObj.toISOString().split('T')[0]
    }

    try {
      await addHoldingToStrategy({
        strategyId,
        investmentId: selectedInvestmentId,
        buyDate,
        targetSellDate,
        status: 'active',
        buyValue: investment.cost_basis,
        currentValue: investment.market_value,
        gainLoss: investment.gain_loss,
      })

      await loadData()
      setShowAddHolding(null)
      setSelectedInvestmentId('')
    } catch (error) {
      console.error('Error adding holding:', error)
      alert('Failed to add holding.')
    }
  }

  const handleRemoveHolding = async (holdingId: string) => {
    if (!confirm('Remove this holding from the strategy?')) return

    try {
      await deleteStrategyHolding(holdingId)
      await loadData()
    } catch (error) {
      console.error('Error removing holding:', error)
    }
  }

  const handleMarkSold = async (holding: StrategyHolding) => {
    const reason = prompt('Reason for selling (optional):')

    try {
      await updateStrategyHolding(holding.id, {
        status: 'sold',
        actualSellDate: new Date().toISOString().split('T')[0],
        sellReason: reason || undefined,
      })
      await loadData()
    } catch (error) {
      console.error('Error marking holding as sold:', error)
    }
  }

  const resetStrategyForm = () => {
    setStrategyForm(initialStrategyForm)
    setEditingStrategy(null)
    setShowStrategyForm(false)
  }

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getInvestmentById = (id: string) => investments.find((i) => i.id === id)

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading strategies...</p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="text-purple-500" size={28} />
            Investment Strategies
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track your investment strategies and holding periods
          </p>
        </div>

        <button
          onClick={() => setShowStrategyForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
        >
          <Plus size={18} />
          New Strategy
        </button>
      </div>

      {/* Holdings Nearing Sell Date Alert */}
      {holdingsNearingSell.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 mb-2">
            <Clock className="w-5 h-5" />
            <h3 className="font-semibold">Holdings Approaching Sell Date</h3>
          </div>
          <div className="space-y-2">
            {holdingsNearingSell.slice(0, 5).map((holding) => (
              <div
                key={holding.id}
                className="flex items-center justify-between p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {holding.investment?.symbol || 'Unknown'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {holding.investment?.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      holding.daysUntilSell <= 7
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}
                  >
                    {holding.daysUntilSell} days
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategies List */}
      {strategies.length === 0 ? (
        <div className="text-center py-12 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50">
          <Target className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Strategies Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-4">
            Create an investment strategy to track holdings, sell dates, and performance.
          </p>
          <button
            onClick={() => setShowStrategyForm(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Create Your First Strategy
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {strategies.map((strategy) => {
            const isExpanded = expandedStrategy === strategy.id
            const strategyHoldings = holdings.get(strategy.id) || []
            const performance = performanceData.get(strategy.id)
            const typeConfig = STRATEGY_TYPE_CONFIG[strategy.type]
            const linkedGoal = goals.find((g) => g.id === strategy.linkedGoalId)

            return (
              <div
                key={strategy.id}
                className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 overflow-hidden"
              >
                {/* Strategy Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  onClick={() => setExpandedStrategy(isExpanded ? null : strategy.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className="p-2.5 rounded-xl"
                        style={{ backgroundColor: `${typeConfig.color}20` }}
                      >
                        <Target size={20} style={{ color: typeConfig.color }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {strategy.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {typeConfig.label}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {strategy.parameters.holdingPeriodMonths && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              {strategy.parameters.holdingPeriodMonths}mo hold
                            </span>
                          )}
                          {strategy.parameters.targetHoldings && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                              {strategy.parameters.targetHoldings} holdings
                            </span>
                          )}
                          {linkedGoal && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
                              <Link2 size={10} />
                              {linkedGoal.title}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {performance && (
                        <div className="text-right hidden sm:block">
                          <p
                            className={`text-lg font-bold ${
                              performance.totalGain >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {performance.totalGain >= 0 ? '+' : ''}
                            {formatAmount(performance.totalGain)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {performance.activeCount} active / {performance.holdingsCount} total
                          </p>
                        </div>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700/50">
                    {/* Performance Summary */}
                    {performance && (
                      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 dark:bg-gray-900/30">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Total Value</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {formatAmount(performance.totalValue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Total Cost</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {formatAmount(performance.totalCost)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Win/Loss</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            <span className="text-green-600 dark:text-green-400">
                              {performance.winnersCount}
                            </span>{' '}
                            /{' '}
                            <span className="text-red-600 dark:text-red-400">
                              {performance.losersCount}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Hold</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {performance.avgHoldingPeriodDays} days
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Holdings List */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <Briefcase size={16} />
                          Holdings
                        </h4>
                        <button
                          onClick={() => setShowAddHolding(strategy.id)}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <Plus size={14} />
                          Add Holding
                        </button>
                      </div>

                      {strategyHoldings.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                          No holdings yet. Add investments to this strategy.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {strategyHoldings.map((holding) => {
                            const investment = getInvestmentById(holding.investmentId)
                            if (!investment) return null

                            const statusConfig = HOLDING_STATUS_CONFIG[holding.status]
                            const daysHeld = differenceInDays(
                              new Date(),
                              new Date(holding.buyDate)
                            )
                            let daysUntilSell: number | null = null
                            if (holding.targetSellDate) {
                              daysUntilSell = differenceInDays(
                                new Date(holding.targetSellDate),
                                new Date()
                              )
                            }

                            return (
                              <div
                                key={holding.id}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                      {investment.symbol}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {investment.name}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4">
                                  <div className="text-right text-sm">
                                    <p
                                      className={
                                        investment.gain_loss >= 0
                                          ? 'text-green-600 dark:text-green-400'
                                          : 'text-red-600 dark:text-red-400'
                                      }
                                    >
                                      {investment.gain_loss >= 0 ? '+' : ''}
                                      {formatAmount(investment.gain_loss)}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {daysHeld}d held
                                    </p>
                                  </div>

                                  {daysUntilSell !== null && holding.status === 'active' && (
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-medium ${
                                        daysUntilSell <= 0
                                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                          : daysUntilSell <= 30
                                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                      }`}
                                    >
                                      {daysUntilSell <= 0 ? 'Ready' : `${daysUntilSell}d`}
                                    </span>
                                  )}

                                  <span
                                    className={`px-2 py-1 rounded text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                                  >
                                    {statusConfig.label}
                                  </span>

                                  {holding.status === 'active' && (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => handleMarkSold(holding)}
                                        className="p-1 text-gray-400 hover:text-green-500"
                                        title="Mark as Sold"
                                      >
                                        <CheckCircle size={16} />
                                      </button>
                                      <button
                                        onClick={() => handleRemoveHolding(holding.id)}
                                        className="p-1 text-gray-400 hover:text-red-500"
                                        title="Remove from Strategy"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Strategy Actions */}
                    <div className="px-4 pb-4 flex gap-2">
                      <button
                        onClick={() => handleEditStrategy(strategy)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50"
                      >
                        <Edit2 size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteStrategy(strategy.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Strategy Form Modal */}
      {showStrategyForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingStrategy ? 'Edit Strategy' : 'Create Strategy'}
              </h2>
              <button
                onClick={resetStrategyForm}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleStrategySubmit} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Strategy Name *
                </label>
                <input
                  type="text"
                  required
                  value={strategyForm.name}
                  onChange={(e) => setStrategyForm({ ...strategyForm, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Magic Formula 2024"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Strategy Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(STRATEGY_TYPE_CONFIG).map(([type, config]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setStrategyForm({
                          ...strategyForm,
                          type: type as StrategyType,
                          holdingPeriodMonths:
                            config.defaultParams.holdingPeriodMonths?.toString() || '',
                          targetHoldings: config.defaultParams.targetHoldings?.toString() || '',
                          rebalanceFrequency: config.defaultParams.rebalanceFrequency || '',
                        })
                      }}
                      className={`p-3 rounded-lg text-left transition-colors ${
                        strategyForm.type === type
                          ? 'ring-2 ring-purple-500'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                      style={{
                        backgroundColor:
                          strategyForm.type === type ? `${config.color}15` : undefined,
                      }}
                    >
                      <p className="font-medium text-sm" style={{ color: config.color }}>
                        {config.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {config.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Parameters */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target Holdings
                  </label>
                  <input
                    type="number"
                    value={strategyForm.targetHoldings}
                    onChange={(e) =>
                      setStrategyForm({ ...strategyForm, targetHoldings: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
                    placeholder="e.g., 25"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Holding Period (months)
                  </label>
                  <input
                    type="number"
                    value={strategyForm.holdingPeriodMonths}
                    onChange={(e) =>
                      setStrategyForm({ ...strategyForm, holdingPeriodMonths: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
                    placeholder="e.g., 12"
                  />
                </div>
              </div>

              {/* Rebalance Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rebalance Frequency
                </label>
                <select
                  value={strategyForm.rebalanceFrequency}
                  onChange={(e) =>
                    setStrategyForm({
                      ...strategyForm,
                      rebalanceFrequency: e.target.value as RebalanceFrequency | '',
                    })
                  }
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                >
                  <option value="">No scheduled rebalance</option>
                  {Object.entries(REBALANCE_FREQUENCY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Link to Goal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Link to Life Goal (optional)
                </label>
                <select
                  value={strategyForm.linkedGoalId}
                  onChange={(e) =>
                    setStrategyForm({ ...strategyForm, linkedGoalId: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                >
                  <option value="">No linked goal</option>
                  {goals
                    .filter((g) => g.is_active && g.status !== 'completed')
                    .map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={strategyForm.description}
                  onChange={(e) =>
                    setStrategyForm({ ...strategyForm, description: e.target.value })
                  }
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl resize-none"
                  placeholder="Notes about your strategy..."
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetStrategyForm}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 shadow-lg"
                >
                  {editingStrategy ? 'Save Changes' : 'Create Strategy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Holding Modal */}
      {showAddHolding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Holding to Strategy
              </h2>
              <button
                onClick={() => {
                  setShowAddHolding(null)
                  setSelectedInvestmentId('')
                }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Investment
                </label>
                <select
                  value={selectedInvestmentId}
                  onChange={(e) => setSelectedInvestmentId(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl"
                >
                  <option value="">Select an investment...</option>
                  {investments.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.symbol} - {inv.name} ({formatAmount(inv.market_value)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddHolding(null)
                    setSelectedInvestmentId('')
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAddHolding(showAddHolding)}
                  className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700"
                >
                  Add Holding
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
