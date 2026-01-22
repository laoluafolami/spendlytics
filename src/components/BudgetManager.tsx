import { useState, useEffect, useMemo } from 'react'
import { Plus, Target, Edit2, Trash2, X, AlertTriangle, TrendingUp, TrendingDown, Zap, PieChart, Calendar, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCurrency } from '../contexts/CurrencyContext'
import { Expense, EXPENSE_CATEGORIES } from '../types/expense'
import { useAuth } from '../contexts/AuthContext'
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'

interface Budget {
  id: string
  category: string
  amount: number
  budget_month: number
  budget_year: number
  created_at?: string
}

interface BudgetManagerProps {
  expenses: Expense[]
}

// Color palette for charts
const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16']

export default function BudgetManager({ expenses }: BudgetManagerProps) {
  const { formatAmount } = useCurrency()
  const { user } = useAuth()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    budget_month: new Date().getMonth() + 1,
    budget_year: new Date().getFullYear()
  })

  useEffect(() => {
    loadBudgets()
  }, [])

  const loadBudgets = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('app_budgets')
        .select('*')
        .eq('user_id', user.id)
        .order('category', { ascending: true })

      if (error) throw error
      setBudgets(data || [])
    } catch (error) {
      console.error('Error loading budgets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const budgetData = {
        user_id: user.id,
        category: formData.category,
        amount: parseFloat(formData.amount),
        budget_month: formData.budget_month,
        budget_year: formData.budget_year
      }

      if (editingBudget) {
        const { error } = await supabase
          .from('app_budgets')
          .update(budgetData)
          .eq('id', editingBudget.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('app_budgets')
          .insert([budgetData])

        if (error) throw error
      }

      await loadBudgets()
      resetForm()
    } catch (error) {
      console.error('Error saving budget:', error)
      alert('Failed to save budget. Please try again.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) return

    try {
      const { error } = await supabase
        .from('app_budgets')
        .delete()
        .eq('id', id)

      if (error) throw error
      await loadBudgets()
    } catch (error) {
      console.error('Error deleting budget:', error)
      alert('Failed to delete budget. Please try again.')
    }
  }

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget)
    setFormData({
      category: budget.category,
      amount: budget.amount.toString(),
      budget_month: budget.budget_month,
      budget_year: budget.budget_year
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      category: '',
      amount: '',
      budget_month: new Date().getMonth() + 1,
      budget_year: new Date().getFullYear()
    })
    setEditingBudget(null)
    setShowForm(false)
  }

  // Filter budgets for selected month/year
  const filteredBudgets = useMemo(() => {
    return budgets.filter(
      b => b.budget_month === selectedMonth && b.budget_year === selectedYear
    )
  }, [budgets, selectedMonth, selectedYear])

  // Calculate budget status with enhanced metrics
  const budgetStatus = useMemo(() => {
    const today = new Date()
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
    const currentDay = today.getMonth() + 1 === selectedMonth && today.getFullYear() === selectedYear
      ? today.getDate()
      : daysInMonth
    const daysRemaining = daysInMonth - currentDay

    return filteredBudgets.map(budget => {
      const spent = expenses
        .filter(exp => {
          const expDate = new Date(exp.date)
          return exp.category === budget.category &&
                 expDate.getMonth() + 1 === budget.budget_month &&
                 expDate.getFullYear() === budget.budget_year
        })
        .reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)

      const percentage = (spent / budget.amount) * 100
      const remaining = budget.amount - spent
      const dailyBudget = budget.amount / daysInMonth
      const expectedSpent = dailyBudget * currentDay
      const dailySpendingRate = spent / currentDay
      const projectedTotal = dailySpendingRate * daysInMonth
      const isOnTrack = spent <= expectedSpent
      const willExceed = projectedTotal > budget.amount

      return {
        ...budget,
        spent,
        remaining,
        percentage: Math.min(percentage, 100),
        actualPercentage: percentage,
        isOverBudget: spent > budget.amount,
        dailyBudget,
        expectedSpent,
        dailySpendingRate,
        projectedTotal,
        isOnTrack,
        willExceed,
        daysRemaining,
        requiredDailyRate: daysRemaining > 0 ? remaining / daysRemaining : 0
      }
    })
  }, [filteredBudgets, expenses, selectedMonth, selectedYear])

  // Summary statistics
  const summary = useMemo(() => {
    const totalBudget = budgetStatus.reduce((sum, b) => sum + b.amount, 0)
    const totalSpent = budgetStatus.reduce((sum, b) => sum + b.spent, 0)
    const totalRemaining = totalBudget - totalSpent
    const overBudgetCount = budgetStatus.filter(b => b.isOverBudget).length
    const atRiskCount = budgetStatus.filter(b => !b.isOverBudget && b.willExceed).length
    const onTrackCount = budgetStatus.filter(b => b.isOnTrack && !b.willExceed).length

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      overallPercentage: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      overBudgetCount,
      atRiskCount,
      onTrackCount
    }
  }, [budgetStatus])

  // Smart insights
  const insights = useMemo(() => {
    const tips: Array<{ type: 'success' | 'warning' | 'danger' | 'info'; message: string }> = []

    if (budgetStatus.length === 0) {
      tips.push({ type: 'info', message: 'Create budgets for your spending categories to start tracking' })
      return tips
    }

    // Overall health
    if (summary.overallPercentage > 90) {
      tips.push({ type: 'danger', message: `You've used ${summary.overallPercentage.toFixed(0)}% of your total budget. Consider reducing spending.` })
    } else if (summary.overallPercentage < 50) {
      tips.push({ type: 'success', message: `Great control! You've only used ${summary.overallPercentage.toFixed(0)}% of your budget.` })
    }

    // Category-specific insights
    const overBudget = budgetStatus.filter(b => b.isOverBudget)
    if (overBudget.length > 0) {
      const categories = overBudget.map(b => b.category).join(', ')
      tips.push({ type: 'danger', message: `Budget exceeded in: ${categories}` })
    }

    const atRisk = budgetStatus.filter(b => !b.isOverBudget && b.willExceed)
    if (atRisk.length > 0) {
      atRisk.forEach(b => {
        tips.push({
          type: 'warning',
          message: `${b.category}: Projected to exceed by ${formatAmount(b.projectedTotal - b.amount)} at current pace`
        })
      })
    }

    const wellManaged = budgetStatus.filter(b => b.percentage < 70 && b.isOnTrack)
    if (wellManaged.length > 0) {
      tips.push({
        type: 'success',
        message: `${wellManaged.length} budget(s) are well under control`
      })
    }

    // Suggestions for unbudgeted categories
    const budgetedCategories = budgetStatus.map(b => b.category)
    const unbudgetedSpending = expenses
      .filter(exp => {
        const expDate = new Date(exp.date)
        return expDate.getMonth() + 1 === selectedMonth &&
               expDate.getFullYear() === selectedYear &&
               !budgetedCategories.includes(exp.category)
      })
      .reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + parseFloat(exp.amount.toString())
        return acc
      }, {} as Record<string, number>)

    const significantUnbudgeted = Object.entries(unbudgetedSpending)
      .filter(([, amount]) => amount > 1000)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    if (significantUnbudgeted.length > 0) {
      tips.push({
        type: 'info',
        message: `Consider adding budgets for: ${significantUnbudgeted.map(([cat]) => cat).join(', ')}`
      })
    }

    return tips
  }, [budgetStatus, summary, expenses, selectedMonth, selectedYear, formatAmount])

  // Chart data
  const pieChartData = budgetStatus.map((b, index) => ({
    name: b.category,
    value: b.spent,
    budget: b.amount,
    color: COLORS[index % COLORS.length]
  }))

  const barChartData = budgetStatus.map(b => ({
    category: b.category.length > 10 ? b.category.substring(0, 10) + '...' : b.category,
    Budget: b.amount,
    Spent: b.spent,
    Remaining: Math.max(0, b.remaining)
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
            Budget Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Set and track category budgets</p>
        </div>
        <div className="flex gap-3">
          {/* Month/Year Selector */}
          <div className="flex gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>
                  {new Date(2000, month - 1).toLocaleString('default', { month: 'short' })}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transform hover:scale-105 transition-all duration-300 shadow-lg"
          >
            <Plus size={18} />
            Add Budget
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {budgetStatus.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Target className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Budget</p>
                  <p className="font-bold text-gray-900 dark:text-white">{formatAmount(summary.totalBudget)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <TrendingUp className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Spent</p>
                  <p className="font-bold text-gray-900 dark:text-white">{formatAmount(summary.totalSpent)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <TrendingDown className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
                  <p className={`font-bold ${summary.totalRemaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatAmount(Math.abs(summary.totalRemaining))}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                  <PieChart className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Used</p>
                  <p className="font-bold text-gray-900 dark:text-white">{summary.overallPercentage.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budget Health Indicators */}
      {budgetStatus.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl blur-xl opacity-10"></div>
            <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
                <CheckCircle2 className="text-green-600 dark:text-green-400" size={24} />
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.onTrackCount}</p>
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
              <p className="text-xs text-gray-500 dark:text-gray-400">At Risk</p>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl blur-xl opacity-10"></div>
            <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-2">
                <AlertTriangle className="text-red-600 dark:text-red-400" size={24} />
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.overBudgetCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Over Budget</p>
            </div>
          </div>
        </div>
      )}

      {/* Smart Insights */}
      {insights.length > 0 && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10"></div>
          <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="text-purple-600 dark:text-purple-400" size={20} />
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
                  {insight.type === 'success' && <CheckCircle2 size={18} className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />}
                  {insight.type === 'warning' && <AlertCircle size={18} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />}
                  {insight.type === 'danger' && <AlertTriangle size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />}
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
      {budgetStatus.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart - Spending Distribution */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-10"></div>
            <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Spending Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatAmount(value)}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Bar Chart - Budget vs Spent */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10"></div>
            <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Budget vs Spent</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} layout="vertical">
                    <XAxis type="number" tickFormatter={(value) => formatAmount(value)} />
                    <YAxis type="category" dataKey="category" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value: number) => formatAmount(value)}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="Budget" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="Spent" fill="#EC4899" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <form onSubmit={handleSubmit} className="relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingBudget ? 'Edit Budget' : 'Add New Budget'}
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
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                >
                  <option value="">Select category</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Budget Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Month
                </label>
                <select
                  value={formData.budget_month}
                  onChange={(e) => setFormData({ ...formData, budget_month: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Year
                </label>
                <input
                  type="number"
                  required
                  value={formData.budget_year}
                  onChange={(e) => setFormData({ ...formData, budget_year: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg touch-target"
              >
                {editingBudget ? 'Update Budget' : 'Add Budget'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="sm:flex-none px-4 py-3 bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl font-medium text-gray-700 dark:text-gray-300 transition-all touch-target"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Budget Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {budgetStatus.length === 0 ? (
          <div className="lg:col-span-2 group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-10"></div>
            <div className="relative text-center py-12 px-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <Target className="mx-auto mb-4 text-gray-400 dark:text-gray-600" size={48} />
              <p className="text-gray-600 dark:text-gray-400 mb-2">No budgets for {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">Create budgets to start tracking your spending</p>
            </div>
          </div>
        ) : (
          budgetStatus.map(budget => (
            <div key={budget.id} className="group relative">
              <div className={`absolute inset-0 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity ${
                budget.isOverBudget
                  ? 'bg-gradient-to-br from-red-500 to-orange-500'
                  : budget.willExceed
                  ? 'bg-gradient-to-br from-yellow-500 to-orange-500'
                  : 'bg-gradient-to-br from-blue-500 to-purple-500'
              }`}></div>
              <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                      {budget.category}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(budget.budget_year, budget.budget_month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(budget)}
                      className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Spent</span>
                    <span className={`font-bold ${
                      budget.isOverBudget
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {formatAmount(budget.spent)}
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        budget.isOverBudget
                          ? 'bg-gradient-to-r from-red-500 to-orange-500'
                          : budget.actualPercentage > 80
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                          : 'bg-gradient-to-r from-blue-500 to-purple-600'
                      }`}
                      style={{ width: `${budget.percentage}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Budget</p>
                      <p className="font-bold text-gray-900 dark:text-white">{formatAmount(budget.amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {budget.isOverBudget ? 'Over by' : 'Remaining'}
                      </p>
                      <p className={`font-bold ${
                        budget.isOverBudget
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {formatAmount(Math.abs(budget.remaining))}
                      </p>
                    </div>
                  </div>

                  {/* Spending velocity and projection */}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Daily Rate</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {formatAmount(budget.dailySpendingRate)}/day
                      </span>
                    </div>
                    {budget.daysRemaining > 0 && !budget.isOverBudget && (
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-gray-500 dark:text-gray-400">Required Rate</span>
                        <span className={`font-medium ${
                          budget.requiredDailyRate > budget.dailySpendingRate
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-yellow-600 dark:text-yellow-400'
                        }`}>
                          {formatAmount(budget.requiredDailyRate)}/day
                        </span>
                      </div>
                    )}
                    {!budget.isOverBudget && budget.willExceed && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                        <Calendar size={12} />
                        <span>Projected: {formatAmount(budget.projectedTotal)} by month end</span>
                      </div>
                    )}
                  </div>

                  {budget.isOverBudget && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <AlertTriangle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0" />
                      <p className="text-xs text-red-700 dark:text-red-300">
                        Budget exceeded by {((budget.actualPercentage - 100)).toFixed(0)}%
                      </p>
                    </div>
                  )}

                  {!budget.isOverBudget && budget.willExceed && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                      <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                      <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        At current pace, you'll exceed budget by {formatAmount(budget.projectedTotal - budget.amount)}
                      </p>
                    </div>
                  )}

                  {budget.isOnTrack && !budget.willExceed && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                      <p className="text-xs text-green-700 dark:text-green-300">
                        On track! {budget.daysRemaining} days remaining
                      </p>
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
