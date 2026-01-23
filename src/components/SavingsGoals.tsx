import { useState, useEffect, useMemo } from 'react'
import { Plus, Target, Edit2, Trash2, X, TrendingUp, Calendar, Zap, PiggyBank, Clock, Award, AlertCircle, CheckCircle2, Info, Sparkles, ArrowUpRight, Calculator, Landmark, Link, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCurrency } from '../contexts/CurrencyContext'
import { format, differenceInDays, differenceInMonths, addMonths, addDays } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { Asset } from '../types/finance'
import { getSavingsAssets, syncSavingsGoalFromAsset } from '../utils/integrationService'

interface SavingsGoal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  deadline: string | null
  created_at?: string
  // Integration fields
  linked_asset_id?: string
  linked_asset_name?: string
}

// Color palette
const COLORS = ['#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B']

export default function SavingsGoals() {
  const { formatAmount } = useCurrency()
  const { user } = useAuth()
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null)
  const [showCalculator, setShowCalculator] = useState(false)
  const [calculatorData, setCalculatorData] = useState({
    targetAmount: '',
    deadline: '',
    currentSavings: '0'
  })
  const [formData, setFormData] = useState({
    name: '',
    target_amount: '',
    current_amount: '0',
    deadline: '',
    linked_asset_id: '',
    linked_asset_name: ''
  })
  // Integration: Available assets for linking
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([])

  useEffect(() => {
    loadGoals()
    loadAvailableAssets()
  }, [])

  // Load available savings assets
  const loadAvailableAssets = async () => {
    try {
      const assets = await getSavingsAssets()
      setAvailableAssets(assets)
    } catch (error) {
      console.error('Error loading assets:', error)
    }
  }

  // Handle asset selection
  const handleAssetSelect = (assetId: string) => {
    const selectedAsset = availableAssets.find(a => a.id === assetId)
    setFormData({
      ...formData,
      linked_asset_id: assetId,
      linked_asset_name: selectedAsset?.name || ''
    })
  }

  const loadGoals = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('app_savings_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Integration: Sync linked goals with their asset balances
      const goalsWithSyncedBalances = await Promise.all(
        (data || []).map(async (goal) => {
          if (goal.linked_asset_id) {
            const syncResult = await syncSavingsGoalFromAsset(goal.id, goal.linked_asset_id)
            if (syncResult) {
              return {
                ...goal,
                current_amount: syncResult.balance,
                linked_asset_name: syncResult.assetName
              }
            }
          }
          return goal
        })
      )

      setGoals(goalsWithSyncedBalances)
    } catch (error) {
      console.error('Error loading savings goals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const goalData = {
        user_id: user.id,
        name: formData.name,
        target_amount: parseFloat(formData.target_amount),
        current_amount: parseFloat(formData.current_amount),
        deadline: formData.deadline || null,
        linked_asset_id: formData.linked_asset_id || null,
        linked_asset_name: formData.linked_asset_name || null
      }

      if (editingGoal) {
        const { error } = await supabase
          .from('app_savings_goals')
          .update(goalData)
          .eq('id', editingGoal.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('app_savings_goals')
          .insert([goalData])

        if (error) throw error
      }

      await loadGoals()
      resetForm()
    } catch (error) {
      console.error('Error saving goal:', error)
      alert('Failed to save savings goal. Please try again.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this savings goal?')) return

    try {
      const { error } = await supabase
        .from('app_savings_goals')
        .delete()
        .eq('id', id)

      if (error) throw error
      await loadGoals()
    } catch (error) {
      console.error('Error deleting goal:', error)
      alert('Failed to delete savings goal. Please try again.')
    }
  }

  const handleEdit = (goal: SavingsGoal) => {
    setEditingGoal(goal)
    setFormData({
      name: goal.name,
      target_amount: goal.target_amount.toString(),
      current_amount: goal.current_amount.toString(),
      deadline: goal.deadline || '',
      linked_asset_id: goal.linked_asset_id || '',
      linked_asset_name: goal.linked_asset_name || ''
    })
    setShowForm(true)
  }

  const handleUpdateProgress = async (id: string, amount: number) => {
    try {
      const { error } = await supabase
        .from('app_savings_goals')
        .update({ current_amount: amount })
        .eq('id', id)

      if (error) throw error
      await loadGoals()
    } catch (error) {
      console.error('Error updating progress:', error)
      alert('Failed to update progress. Please try again.')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      target_amount: '',
      current_amount: '0',
      deadline: '',
      linked_asset_id: '',
      linked_asset_name: ''
    })
    setEditingGoal(null)
    setShowForm(false)
  }

  // Enhanced goal calculations
  const enrichedGoals = useMemo(() => {
    const now = new Date()

    return goals.map((goal, index) => {
      const progress = (goal.current_amount / goal.target_amount) * 100
      const remaining = goal.target_amount - goal.current_amount
      const isCompleted = goal.current_amount >= goal.target_amount

      // Time calculations
      const daysLeft = goal.deadline ? differenceInDays(new Date(goal.deadline), now) : null
      const monthsLeft = goal.deadline ? differenceInMonths(new Date(goal.deadline), now) : null
      const daysSinceCreated = goal.created_at ? differenceInDays(now, new Date(goal.created_at)) : 0

      // Savings velocity (how much saved per day since creation)
      const savingsVelocity = daysSinceCreated > 0 ? goal.current_amount / daysSinceCreated : 0

      // Projections
      const daysToComplete = savingsVelocity > 0 ? remaining / savingsVelocity : Infinity
      const projectedCompletionDate = savingsVelocity > 0 ? addDays(now, Math.ceil(daysToComplete)) : null

      // Required daily/monthly savings to meet deadline
      const requiredDailySavings = daysLeft && daysLeft > 0 ? remaining / daysLeft : 0
      const requiredMonthlySavings = monthsLeft && monthsLeft > 0 ? remaining / monthsLeft : 0

      // Is on track to meet deadline?
      const onTrackForDeadline = goal.deadline
        ? (projectedCompletionDate ? projectedCompletionDate <= new Date(goal.deadline) : false)
        : true

      // Status
      let status: 'completed' | 'on-track' | 'at-risk' | 'behind' | 'no-deadline'
      if (isCompleted) {
        status = 'completed'
      } else if (!goal.deadline) {
        status = progress > 0 ? 'no-deadline' : 'no-deadline'
      } else if (daysLeft && daysLeft < 0) {
        status = 'behind'
      } else if (onTrackForDeadline) {
        status = 'on-track'
      } else if (daysLeft && daysLeft < 30) {
        status = 'at-risk'
      } else {
        status = 'at-risk'
      }

      return {
        ...goal,
        progress,
        remaining,
        isCompleted,
        daysLeft,
        monthsLeft,
        daysSinceCreated,
        savingsVelocity,
        daysToComplete,
        projectedCompletionDate,
        requiredDailySavings,
        requiredMonthlySavings,
        onTrackForDeadline,
        status,
        color: COLORS[index % COLORS.length]
      }
    })
  }, [goals])

  // Summary statistics
  const summary = useMemo(() => {
    const totalTarget = enrichedGoals.reduce((sum, goal) => sum + goal.target_amount, 0)
    const totalSaved = enrichedGoals.reduce((sum, goal) => sum + goal.current_amount, 0)
    const totalRemaining = totalTarget - totalSaved
    const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0

    const completedCount = enrichedGoals.filter(g => g.isCompleted).length
    const onTrackCount = enrichedGoals.filter(g => g.status === 'on-track').length
    const atRiskCount = enrichedGoals.filter(g => g.status === 'at-risk' || g.status === 'behind').length

    // Average savings velocity
    const avgVelocity = enrichedGoals.length > 0
      ? enrichedGoals.reduce((sum, g) => sum + g.savingsVelocity, 0) / enrichedGoals.length
      : 0

    return {
      totalTarget,
      totalSaved,
      totalRemaining,
      overallProgress,
      completedCount,
      onTrackCount,
      atRiskCount,
      avgVelocity,
      goalsCount: enrichedGoals.length
    }
  }, [enrichedGoals])

  // Smart insights
  const insights = useMemo(() => {
    const tips: Array<{ type: 'success' | 'warning' | 'danger' | 'info'; message: string }> = []

    if (enrichedGoals.length === 0) {
      tips.push({ type: 'info', message: 'Create your first savings goal to start tracking your progress!' })
      return tips
    }

    // Completed goals celebration
    if (summary.completedCount > 0) {
      tips.push({ type: 'success', message: `Congratulations! You've completed ${summary.completedCount} savings goal(s)!` })
    }

    // Overall progress
    if (summary.overallProgress >= 75) {
      tips.push({ type: 'success', message: `Amazing progress! You're ${summary.overallProgress.toFixed(0)}% towards your total savings goals.` })
    } else if (summary.overallProgress >= 50) {
      tips.push({ type: 'info', message: `You're halfway there! ${summary.overallProgress.toFixed(0)}% of your savings goals completed.` })
    }

    // At-risk warnings
    const atRiskGoals = enrichedGoals.filter(g => g.status === 'at-risk')
    if (atRiskGoals.length > 0) {
      atRiskGoals.forEach(g => {
        tips.push({
          type: 'warning',
          message: `"${g.name}" needs ${formatAmount(g.requiredDailySavings)}/day to meet deadline`
        })
      })
    }

    // Behind schedule
    const behindGoals = enrichedGoals.filter(g => g.status === 'behind')
    if (behindGoals.length > 0) {
      tips.push({
        type: 'danger',
        message: `${behindGoals.length} goal(s) have passed their deadline. Consider adjusting targets or deadlines.`
      })
    }

    // Savings velocity insight
    if (summary.avgVelocity > 0) {
      tips.push({
        type: 'info',
        message: `Your average daily savings rate is ${formatAmount(summary.avgVelocity)}`
      })
    }

    // Encouragement for goals close to completion
    const almostDone = enrichedGoals.filter(g => !g.isCompleted && g.progress >= 80)
    if (almostDone.length > 0) {
      tips.push({
        type: 'success',
        message: `"${almostDone[0].name}" is ${almostDone[0].progress.toFixed(0)}% complete - almost there!`
      })
    }

    return tips.slice(0, 4) // Limit to 4 insights
  }, [enrichedGoals, summary, formatAmount])

  // Progress chart data (for projection visualization)
  const projectionChartData = useMemo(() => {
    if (enrichedGoals.length === 0) return []

    // Create 6-month projection for the first non-completed goal
    const activeGoal = enrichedGoals.find(g => !g.isCompleted)
    if (!activeGoal) return []

    const data = []
    const today = new Date()
    const monthlyRate = activeGoal.savingsVelocity * 30

    for (let i = 0; i <= 6; i++) {
      const date = addMonths(today, i)
      const projected = Math.min(
        activeGoal.current_amount + (monthlyRate * i),
        activeGoal.target_amount
      )
      data.push({
        month: format(date, 'MMM'),
        Saved: i === 0 ? activeGoal.current_amount : projected,
        Target: activeGoal.target_amount
      })
    }

    return data
  }, [enrichedGoals])

  // Calculate required savings
  const calculateRequired = useMemo(() => {
    if (!calculatorData.targetAmount || !calculatorData.deadline) return null

    const target = parseFloat(calculatorData.targetAmount)
    const current = parseFloat(calculatorData.currentSavings) || 0
    const remaining = target - current
    const deadline = new Date(calculatorData.deadline)
    const daysLeft = differenceInDays(deadline, new Date())
    const monthsLeft = differenceInMonths(deadline, new Date())

    if (daysLeft <= 0) return null

    return {
      daily: remaining / daysLeft,
      weekly: (remaining / daysLeft) * 7,
      monthly: monthsLeft > 0 ? remaining / monthsLeft : remaining
    }
  }, [calculatorData])

  // Goals comparison bar chart
  const goalsBarData = enrichedGoals.map(g => ({
    name: g.name.length > 12 ? g.name.substring(0, 12) + '...' : g.name,
    Progress: g.progress,
    color: g.color
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-12 h-12 border-4 border-teal-200 dark:border-teal-800 border-t-teal-600 dark:border-t-teal-400 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 dark:from-teal-400 dark:via-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
            Savings Goals
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Track your savings targets with smart projections</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCalculator(!showCalculator)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 hover:bg-white/80 dark:hover:bg-gray-700/80 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-all"
          >
            <Calculator size={18} />
            Calculator
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-xl font-medium transform hover:scale-105 transition-all duration-300 shadow-lg"
          >
            <Plus size={18} />
            Add Goal
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {enrichedGoals.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                  <Target className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Target</p>
                  <p className="font-bold text-gray-900 dark:text-white">{formatAmount(summary.totalTarget)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <PiggyBank className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Saved</p>
                  <p className="font-bold text-green-600 dark:text-green-400">{formatAmount(summary.totalSaved)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <TrendingUp className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Progress</p>
                  <p className="font-bold text-gray-900 dark:text-white">{summary.overallProgress.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <Clock className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
                  <p className="font-bold text-gray-900 dark:text-white">{formatAmount(summary.totalRemaining)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Indicators */}
      {enrichedGoals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl blur-xl opacity-10"></div>
            <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
                <Award className="text-green-600 dark:text-green-400" size={24} />
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.completedCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl blur-xl opacity-10"></div>
            <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                <CheckCircle2 className="text-blue-600 dark:text-blue-400" size={24} />
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.onTrackCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">On Track</p>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl blur-xl opacity-10"></div>
            <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mb-2">
                <AlertCircle className="text-yellow-600 dark:text-yellow-400" size={24} />
              </div>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{summary.atRiskCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Needs Attention</p>
            </div>
          </div>
        </div>
      )}

      {/* Smart Insights */}
      {insights.length > 0 && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-3xl blur-2xl opacity-10"></div>
          <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="text-cyan-600 dark:text-cyan-400" size={20} />
              <h3 className="font-bold text-gray-900 dark:text-white">Smart Insights</h3>
            </div>
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-xl ${
                    insight.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' :
                    insight.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' :
                    insight.type === 'danger' ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
                    'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                  }`}
                >
                  {insight.type === 'success' && <Sparkles size={18} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />}
                  {insight.type === 'warning' && <AlertCircle size={18} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />}
                  {insight.type === 'danger' && <AlertCircle size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />}
                  {insight.type === 'info' && <Info size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />}
                  <p className={`text-sm ${
                    insight.type === 'success' ? 'text-green-700 dark:text-green-300' :
                    insight.type === 'warning' ? 'text-yellow-700 dark:text-yellow-300' :
                    insight.type === 'danger' ? 'text-red-700 dark:text-red-300' :
                    'text-blue-700 dark:text-blue-300'
                  }`}>
                    {insight.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {enrichedGoals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Projection Chart */}
          {projectionChartData.length > 0 && (
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-3xl blur-2xl opacity-10"></div>
              <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">6-Month Projection</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projectionChartData}>
                      <defs>
                        <linearGradient id="colorSaved" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(value) => formatAmount(value)} tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(value: number) => formatAmount(value)}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="Target"
                        stroke="#9CA3AF"
                        strokeDasharray="5 5"
                        fill="none"
                      />
                      <Area
                        type="monotone"
                        dataKey="Saved"
                        stroke="#10B981"
                        fill="url(#colorSaved)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Goals Progress Comparison */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10"></div>
            <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Goals Progress</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={goalsBarData} layout="vertical">
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => `${value.toFixed(1)}%`}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Bar dataKey="Progress" radius={[0, 8, 8, 0]}>
                      {goalsBarData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={enrichedGoals[index]?.color || COLORS[0]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Savings Calculator */}
      {showCalculator && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-10"></div>
          <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calculator className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="font-bold text-gray-900 dark:text-white">Savings Calculator</h3>
              </div>
              <button
                onClick={() => setShowCalculator(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Amount</label>
                <input
                  type="number"
                  value={calculatorData.targetAmount}
                  onChange={(e) => setCalculatorData({ ...calculatorData, targetAmount: e.target.value })}
                  className="w-full px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Savings</label>
                <input
                  type="number"
                  value={calculatorData.currentSavings}
                  onChange={(e) => setCalculatorData({ ...calculatorData, currentSavings: e.target.value })}
                  className="w-full px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Date</label>
                <input
                  type="date"
                  value={calculatorData.deadline}
                  onChange={(e) => setCalculatorData({ ...calculatorData, deadline: e.target.value })}
                  className="w-full px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {calculateRequired && (
              <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 sm:p-4 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 rounded-xl border border-teal-200 dark:border-teal-800">
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Daily</p>
                  <p className="text-sm sm:text-base font-bold text-teal-600 dark:text-teal-400">{formatAmount(calculateRequired.daily)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Weekly</p>
                  <p className="text-sm sm:text-base font-bold text-teal-600 dark:text-teal-400">{formatAmount(calculateRequired.weekly)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Monthly</p>
                  <p className="text-sm sm:text-base font-bold text-teal-600 dark:text-teal-400">{formatAmount(calculateRequired.monthly)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <form onSubmit={handleSubmit} className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingGoal ? 'Edit Savings Goal' : 'Add New Savings Goal'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Goal Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                  placeholder="e.g., Emergency Fund, Vacation, New Car"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Target Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Current Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.current_amount}
                  onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Deadline (Optional)
                </label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                />
              </div>

              {/* Integration: Link to Savings Account */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <div className="flex items-center gap-2">
                    <Landmark size={16} className="text-blue-500" />
                    Link to Savings Account (Optional)
                  </div>
                </label>
                <select
                  value={formData.linked_asset_id}
                  onChange={(e) => handleAssetSelect(e.target.value)}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                >
                  <option value="">Don't link to account</option>
                  {availableAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} ({formatAmount(asset.value)})
                    </option>
                  ))}
                </select>
                {formData.linked_asset_id && (
                  <p className="mt-2 text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Link size={14} />
                    Goal progress will track {formData.linked_asset_name}'s balance
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white rounded-xl font-medium transition-all shadow-lg"
              >
                {editingGoal ? 'Update Goal' : 'Add Goal'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-3 bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl font-medium text-gray-700 dark:text-gray-300 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Goal Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {enrichedGoals.length === 0 ? (
          <div className="lg:col-span-2 group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-3xl blur-2xl opacity-10"></div>
            <div className="relative text-center py-12 px-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <Target className="mx-auto mb-4 text-gray-400 dark:text-gray-600" size={48} />
              <p className="text-gray-600 dark:text-gray-400 mb-2">No savings goals yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">Create your first goal to start tracking your savings</p>
            </div>
          </div>
        ) : (
          enrichedGoals.map(goal => (
            <div key={goal.id} className="group relative">
              <div className={`absolute inset-0 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity ${
                goal.isCompleted
                  ? 'bg-gradient-to-br from-green-500 to-emerald-500'
                  : goal.status === 'at-risk' || goal.status === 'behind'
                  ? 'bg-gradient-to-br from-yellow-500 to-orange-500'
                  : 'bg-gradient-to-br from-teal-500 to-cyan-500'
              }`}></div>
              <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {goal.name}
                      </h3>
                      {goal.isCompleted && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                          Completed
                        </span>
                      )}
                    </div>
                    {goal.linked_asset_id && (
                      <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1">
                        <Link size={12} />
                        <Landmark size={12} />
                        <span>{goal.linked_asset_name || 'Linked Account'}</span>
                      </div>
                    )}
                    {goal.deadline && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar size={14} />
                        <span>
                          {goal.daysLeft && goal.daysLeft > 0
                            ? `${goal.daysLeft} days left`
                            : goal.daysLeft && goal.daysLeft < 0
                            ? 'Deadline passed'
                            : format(new Date(goal.deadline), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(goal)}
                      className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Saved</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {formatAmount(goal.current_amount)}
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        goal.isCompleted
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gradient-to-r from-teal-500 to-cyan-600'
                      }`}
                      style={{ width: `${Math.min(goal.progress, 100)}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Target</p>
                      <p className="font-bold text-gray-900 dark:text-white">{formatAmount(goal.target_amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {goal.isCompleted ? 'Goal Reached!' : 'Remaining'}
                      </p>
                      <p className={`font-bold ${
                        goal.isCompleted
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {goal.isCompleted ? '🎉' : formatAmount(goal.remaining)}
                      </p>
                    </div>
                  </div>

                  {/* Projections and Insights */}
                  {!goal.isCompleted && (
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                      {goal.savingsVelocity > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Savings rate</span>
                          <span className="font-medium text-teal-600 dark:text-teal-400">
                            {formatAmount(goal.savingsVelocity * 30)}/month
                          </span>
                        </div>
                      )}

                      {goal.projectedCompletionDate && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Est. completion</span>
                          <span className={`font-medium ${
                            goal.onTrackForDeadline
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-yellow-600 dark:text-yellow-400'
                          }`}>
                            {format(goal.projectedCompletionDate, 'MMM dd, yyyy')}
                          </span>
                        </div>
                      )}

                      {goal.deadline && goal.daysLeft && goal.daysLeft > 0 && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Required daily</span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {formatAmount(goal.requiredDailySavings)}/day
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status Messages */}
                  {!goal.isCompleted && goal.status === 'on-track' && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                      <p className="text-xs text-green-700 dark:text-green-300">
                        On track to reach your goal!
                      </p>
                    </div>
                  )}

                  {!goal.isCompleted && (goal.status === 'at-risk' || goal.status === 'behind') && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                      <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        {goal.status === 'behind'
                          ? 'Deadline passed - consider updating your goal'
                          : `Increase savings to ${formatAmount(goal.requiredDailySavings)}/day to meet deadline`}
                      </p>
                    </div>
                  )}

                  {!goal.isCompleted && (
                    <div className="flex gap-2 mt-4">
                      {goal.linked_asset_id ? (
                        // Linked goal: Show sync indicator and refresh button
                        <button
                          onClick={() => loadGoals()}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium transition-all"
                        >
                          <RefreshCw size={14} />
                          Sync from Account
                        </button>
                      ) : (
                        // Non-linked goal: Show add funds button
                        <button
                          onClick={() => {
                            const amount = prompt('Add to savings amount:', '0')
                            if (amount && !isNaN(parseFloat(amount))) {
                              handleUpdateProgress(goal.id, goal.current_amount + parseFloat(amount))
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 rounded-lg text-sm font-medium transition-all"
                        >
                          <ArrowUpRight size={14} />
                          Add Funds
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
