import { useState, useEffect, useMemo } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts'
import { Expense } from '../types/expense'
import { format, eachMonthOfInterval, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import {
  TrendingUp, TrendingDown, PieChart as PieChartIcon,
  Wallet, Target, ArrowUpCircle, ArrowDownCircle, ChevronRight,
  Zap, CreditCard, PiggyBank, BarChart3, FileText, Sparkles, AlertCircle
} from 'lucide-react'
import { useCurrency } from '../contexts/CurrencyContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

interface Income {
  id: string
  description: string
  amount: number
  category: string
  date: string
}

interface Budget {
  id: string
  category: string
  amount: number
  budget_month: number
  budget_year: number
}

interface SavingsGoal {
  id: string
  name: string
  target_amount: number
  current_amount: number
}

interface FinancialDashboardProps {
  expenses: Expense[]
  onNavigate: (view: string) => void
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

export default function FinancialDashboard({ expenses, onNavigate }: FinancialDashboardProps) {
  const { formatAmount } = useCurrency()
  const { user } = useAuth()
  const [incomes, setIncomes] = useState<Income[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    if (!user) return

    try {
      // Load income
      const { data: incomeData } = await supabase
        .from('app_income')
        .select('*')
        .eq('user_id', user.id)

      // Load budgets
      const { data: budgetData } = await supabase
        .from('app_budgets')
        .select('*')
        .eq('user_id', user.id)

      // Load savings goals
      const { data: savingsData } = await supabase
        .from('app_savings_goals')
        .select('*')
        .eq('user_id', user.id)

      setIncomes(incomeData || [])
      setBudgets(budgetData || [])
      setSavingsGoals(savingsData || [])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate this month's data
  const thisMonthData = useMemo(() => {
    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)

    const thisMonthExpenses = expenses.filter(exp => {
      const date = parseISO(exp.date)
      return date >= monthStart && date <= monthEnd
    })

    const thisMonthIncome = incomes.filter(inc => {
      const date = parseISO(inc.date)
      return date >= monthStart && date <= monthEnd
    })

    const totalExpenses = thisMonthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)
    const totalIncome = thisMonthIncome.reduce((sum, inc) => sum + parseFloat(inc.amount.toString()), 0)
    const netCashFlow = totalIncome - totalExpenses
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0

    return {
      totalExpenses,
      totalIncome,
      netCashFlow,
      savingsRate,
      transactionCount: thisMonthExpenses.length + thisMonthIncome.length
    }
  }, [expenses, incomes])

  // Budget status
  const budgetStatus = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const thisMonthBudgets = budgets.filter(
      b => b.budget_month === currentMonth && b.budget_year === currentYear
    )

    let totalBudget = 0
    let totalSpent = 0
    let overBudgetCount = 0

    thisMonthBudgets.forEach(budget => {
      totalBudget += budget.amount
      const spent = expenses
        .filter(exp => {
          const date = parseISO(exp.date)
          return exp.category === budget.category &&
                 date.getMonth() + 1 === currentMonth &&
                 date.getFullYear() === currentYear
        })
        .reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)

      totalSpent += spent
      if (spent > budget.amount) overBudgetCount++
    })

    return {
      totalBudget,
      totalSpent,
      remaining: totalBudget - totalSpent,
      percentUsed: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      budgetCount: thisMonthBudgets.length,
      overBudgetCount
    }
  }, [budgets, expenses])

  // Savings progress
  const savingsProgress = useMemo(() => {
    const totalTarget = savingsGoals.reduce((sum, g) => sum + g.target_amount, 0)
    const totalSaved = savingsGoals.reduce((sum, g) => sum + g.current_amount, 0)
    const completedCount = savingsGoals.filter(g => g.current_amount >= g.target_amount).length

    return {
      totalTarget,
      totalSaved,
      progressPercent: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0,
      goalsCount: savingsGoals.length,
      completedCount
    }
  }, [savingsGoals])

  // Monthly trend data
  const trendData = useMemo(() => {
    const last6Months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date()
    })

    return last6Months.map(month => {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)

      const monthExpenses = expenses.filter(exp => {
        const date = parseISO(exp.date)
        return date >= monthStart && date <= monthEnd
      }).reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)

      const monthIncome = incomes.filter(inc => {
        const date = parseISO(inc.date)
        return date >= monthStart && date <= monthEnd
      }).reduce((sum, inc) => sum + parseFloat(inc.amount.toString()), 0)

      return {
        month: format(month, 'MMM'),
        Income: monthIncome,
        Expenses: monthExpenses,
        Net: monthIncome - monthExpenses
      }
    })
  }, [expenses, incomes])

  // Category breakdown
  const categoryData = useMemo(() => {
    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)

    const thisMonthExpenses = expenses.filter(exp => {
      const date = parseISO(exp.date)
      return date >= monthStart && date <= monthEnd
    })

    const byCategory = thisMonthExpenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + parseFloat(exp.amount.toString())
      return acc
    }, {} as Record<string, number>)

    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [expenses])

  // Smart insights
  const insights = useMemo(() => {
    const tips: Array<{ type: 'success' | 'warning' | 'danger' | 'info'; message: string; action?: string }> = []

    // Savings rate insight
    if (thisMonthData.savingsRate >= 20) {
      tips.push({ type: 'success', message: `Great savings rate of ${thisMonthData.savingsRate.toFixed(0)}% this month!` })
    } else if (thisMonthData.savingsRate < 10 && thisMonthData.savingsRate >= 0) {
      tips.push({ type: 'warning', message: `Your savings rate is only ${thisMonthData.savingsRate.toFixed(0)}%. Aim for 20%+`, action: 'budgets' })
    } else if (thisMonthData.savingsRate < 0) {
      tips.push({ type: 'danger', message: 'You\'re spending more than you earn this month!', action: 'transactions' })
    }

    // Budget insight
    if (budgetStatus.overBudgetCount > 0) {
      tips.push({ type: 'warning', message: `${budgetStatus.overBudgetCount} budget(s) exceeded. Review spending.`, action: 'budgets' })
    } else if (budgetStatus.budgetCount === 0) {
      tips.push({ type: 'info', message: 'Set up budgets to track your spending limits', action: 'budgets' })
    }

    // Savings goals insight
    if (savingsProgress.goalsCount > 0 && savingsProgress.completedCount > 0) {
      tips.push({ type: 'success', message: `${savingsProgress.completedCount} savings goal(s) completed!`, action: 'savings' })
    }

    return tips.slice(0, 3)
  }, [thisMonthData, budgetStatus, savingsProgress])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Message */}
      {expenses.length === 0 && incomes.length === 0 && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <Sparkles className="text-blue-600 dark:text-blue-400" size={20} />
            <span className="text-gray-700 dark:text-gray-300 font-medium">Add your first transaction to see insights!</span>
          </div>
        </div>
      )}

      {/* Main Financial Summary - Clickable Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income */}
        <div
          onClick={() => onNavigate('income')}
          className="group relative cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-25 transition-opacity"></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ArrowUpCircle className="text-white" size={20} />
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">This Month Income</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatAmount(thisMonthData.totalIncome)}</p>
          </div>
        </div>

        {/* Total Expenses */}
        <div
          onClick={() => onNavigate('expenses')}
          className="group relative cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-rose-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-25 transition-opacity"></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ArrowDownCircle className="text-white" size={20} />
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">This Month Expenses</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatAmount(thisMonthData.totalExpenses)}</p>
          </div>
        </div>

        {/* Net Cash Flow */}
        <div
          onClick={() => onNavigate('transactions')}
          className="group relative cursor-pointer"
        >
          <div className={`absolute inset-0 rounded-2xl blur-xl opacity-10 group-hover:opacity-25 transition-opacity ${
            thisMonthData.netCashFlow >= 0
              ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
              : 'bg-gradient-to-br from-orange-500 to-red-500'
          }`}></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                thisMonthData.netCashFlow >= 0
                  ? 'bg-gradient-to-br from-blue-500 to-cyan-600'
                  : 'bg-gradient-to-br from-orange-500 to-red-600'
              }`}>
                <Wallet className="text-white" size={20} />
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Net Cash Flow</p>
            <p className={`text-xl font-bold ${
              thisMonthData.netCashFlow >= 0
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {thisMonthData.netCashFlow >= 0 ? '+' : ''}{formatAmount(thisMonthData.netCashFlow)}
            </p>
          </div>
        </div>

        {/* Savings Rate */}
        <div
          onClick={() => onNavigate('analytics')}
          className="group relative cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-25 transition-opacity"></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                {thisMonthData.savingsRate >= 0 ? (
                  <TrendingUp className="text-white" size={20} />
                ) : (
                  <TrendingDown className="text-white" size={20} />
                )}
              </div>
              <ChevronRight size={18} className="text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Savings Rate</p>
            <p className={`text-xl font-bold ${
              thisMonthData.savingsRate >= 20
                ? 'text-green-600 dark:text-green-400'
                : thisMonthData.savingsRate >= 0
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {thisMonthData.savingsRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('capture')}
          className="group p-3 rounded-xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 hover:from-rose-500/20 hover:to-pink-500/20 border border-rose-200/50 dark:border-rose-800/50 transition-all"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CreditCard className="text-white" size={16} />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Smart Capture</span>
          </div>
        </button>

        <button
          onClick={() => onNavigate('budgets')}
          className="group p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-200/50 dark:border-amber-800/50 transition-all"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wallet className="text-white" size={16} />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Budgets</span>
          </div>
        </button>

        <button
          onClick={() => onNavigate('savings')}
          className="group p-3 rounded-xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 hover:from-teal-500/20 hover:to-cyan-500/20 border border-teal-200/50 dark:border-teal-800/50 transition-all"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <PiggyBank className="text-white" size={16} />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Savings</span>
          </div>
        </button>

        <button
          onClick={() => onNavigate('reports')}
          className="group p-3 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border border-indigo-200/50 dark:border-indigo-800/50 transition-all"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="text-white" size={16} />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Reports</span>
          </div>
        </button>
      </div>

      {/* Smart Insights */}
      {insights.length > 0 && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10"></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="text-purple-600 dark:text-purple-400" size={18} />
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">Smart Insights</h3>
            </div>
            <div className="space-y-2">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  onClick={() => insight.action && onNavigate(insight.action)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                    insight.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30' :
                    insight.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30' :
                    insight.type === 'danger' ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30' :
                    'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                  }`}
                >
                  <AlertCircle size={16} className={
                    insight.type === 'success' ? 'text-green-600 dark:text-green-400' :
                    insight.type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                    insight.type === 'danger' ? 'text-red-600 dark:text-red-400' :
                    'text-blue-600 dark:text-blue-400'
                  } />
                  <p className={`text-sm flex-1 ${
                    insight.type === 'success' ? 'text-green-700 dark:text-green-300' :
                    insight.type === 'warning' ? 'text-yellow-700 dark:text-yellow-300' :
                    insight.type === 'danger' ? 'text-red-700 dark:text-red-300' :
                    'text-blue-700 dark:text-blue-300'
                  }`}>
                    {insight.message}
                  </p>
                  {insight.action && (
                    <ChevronRight size={16} className="text-gray-400" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Budget Status */}
        <div
          onClick={() => onNavigate('budgets')}
          className="group relative cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <Target className="text-white" size={16} />
                </div>
                <span className="font-semibold text-gray-900 dark:text-white text-sm">Budget Status</span>
              </div>
              <ChevronRight size={16} className="text-gray-400 group-hover:text-amber-500 transition-colors" />
            </div>
            {budgetStatus.budgetCount > 0 ? (
              <>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-gray-500 dark:text-gray-400">
                    {formatAmount(budgetStatus.totalSpent)} / {formatAmount(budgetStatus.totalBudget)}
                  </span>
                  <span className={`font-medium ${
                    budgetStatus.percentUsed > 90 ? 'text-red-600' :
                    budgetStatus.percentUsed > 70 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {budgetStatus.percentUsed.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      budgetStatus.percentUsed > 90 ? 'bg-gradient-to-r from-red-500 to-rose-500' :
                      budgetStatus.percentUsed > 70 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                      'bg-gradient-to-r from-green-500 to-emerald-500'
                    }`}
                    style={{ width: `${Math.min(budgetStatus.percentUsed, 100)}%` }}
                  ></div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No budgets set</p>
            )}
          </div>
        </div>

        {/* Savings Progress */}
        <div
          onClick={() => onNavigate('savings')}
          className="group relative cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
                  <PiggyBank className="text-white" size={16} />
                </div>
                <span className="font-semibold text-gray-900 dark:text-white text-sm">Savings Goals</span>
              </div>
              <ChevronRight size={16} className="text-gray-400 group-hover:text-teal-500 transition-colors" />
            </div>
            {savingsProgress.goalsCount > 0 ? (
              <>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-gray-500 dark:text-gray-400">
                    {formatAmount(savingsProgress.totalSaved)} / {formatAmount(savingsProgress.totalTarget)}
                  </span>
                  <span className="font-medium text-teal-600 dark:text-teal-400">
                    {savingsProgress.progressPercent.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all"
                    style={{ width: `${Math.min(savingsProgress.progressPercent, 100)}%` }}
                  ></div>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No goals set</p>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      {(trendData.some(d => d.Income > 0 || d.Expenses > 0) || categoryData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cash Flow Trend */}
          {trendData.some(d => d.Income > 0 || d.Expenses > 0) && (
            <div
              onClick={() => onNavigate('analytics')}
              className="group relative cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="text-blue-600 dark:text-blue-400" size={20} />
                    Monthly Cash Flow
                  </h3>
                  <ChevronRight size={18} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.2)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatAmount(v)} />
                    <Tooltip
                      formatter={(value: number) => formatAmount(value)}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Area type="monotone" dataKey="Income" stroke="#10B981" fill="url(#incomeGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Expenses" stroke="#EF4444" fill="url(#expenseGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Category Breakdown */}
          {categoryData.length > 0 && (
            <div
              onClick={() => onNavigate('analytics')}
              className="group relative cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <PieChartIcon className="text-purple-600 dark:text-purple-400" size={20} />
                    Spending by Category
                  </h3>
                  <ChevronRight size={18} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {categoryData.slice(0, 4).map((cat, index) => (
                    <div key={cat.name} className="flex items-center gap-1 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                      <span className="text-gray-600 dark:text-gray-400">{cat.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
