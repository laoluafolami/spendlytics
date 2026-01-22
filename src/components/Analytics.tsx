import { useMemo, useState, useEffect } from 'react'
import { Expense } from '../types/expense'
import { useCurrency } from '../contexts/CurrencyContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  isWithinInterval, format, subDays, eachDayOfInterval,
  differenceInDays, getDay
} from 'date-fns'
import { Calendar, TrendingUp, TrendingDown, Activity, BarChart3, Clock, Wallet, PiggyBank, Zap, Lightbulb, CreditCard, Target, AlertTriangle, CheckCircle } from 'lucide-react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts'

interface AnalyticsProps {
  expenses: Expense[]
}

interface Income {
  id: string
  amount: number
  category: string
  description: string
  date: string
}

type TimePeriod = 'day' | 'week' | 'month' | 'year'

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1', '#EF4444', '#14B8A6']

export default function Analytics({ expenses }: AnalyticsProps) {
  const { formatAmount } = useCurrency()
  const { user } = useAuth()
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month')
  const [incomes, setIncomes] = useState<Income[]>([])

  // Load income data
  useEffect(() => {
    const loadIncome = async () => {
      if (!user) return
      const { data } = await supabase
        .from('app_income')
        .select('*')
        .eq('user_id', user.id)
      if (data) setIncomes(data)
    }
    loadIncome()
  }, [user])

  const analysis = useMemo(() => {
    const now = new Date()

    const getInterval = (period: TimePeriod) => {
      switch (period) {
        case 'day':
          return { start: startOfDay(now), end: endOfDay(now) }
        case 'week':
          return { start: startOfWeek(now), end: endOfWeek(now) }
        case 'month':
          return { start: startOfMonth(now), end: endOfMonth(now) }
        case 'year':
          return { start: startOfYear(now), end: endOfYear(now) }
      }
    }

    const interval = getInterval(selectedPeriod)
    const periodExpenses = expenses.filter(exp => {
      const expDate = new Date(exp.date)
      return isWithinInterval(expDate, interval)
    })

    const periodIncome = incomes.filter(inc => {
      const incDate = new Date(inc.date)
      return isWithinInterval(incDate, interval)
    })

    const totalExpenses = periodExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)
    const totalIncome = periodIncome.reduce((sum, inc) => sum + inc.amount, 0)
    const netCashFlow = totalIncome - totalExpenses
    const count = periodExpenses.length
    const average = count > 0 ? totalExpenses / count : 0

    // Category breakdown
    const categoryBreakdown = periodExpenses.reduce((acc, exp) => {
      const category = exp.category
      if (!acc[category]) {
        acc[category] = { total: 0, count: 0 }
      }
      acc[category].total += parseFloat(exp.amount.toString())
      acc[category].count += 1
      return acc
    }, {} as Record<string, { total: number; count: number }>)

    const topCategories = Object.entries(categoryBreakdown)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    // Payment method breakdown
    const paymentMethods = periodExpenses.reduce((acc, exp) => {
      const method = exp.payment_method || 'Cash'
      if (!acc[method]) {
        acc[method] = { total: 0, count: 0 }
      }
      acc[method].total += parseFloat(exp.amount.toString())
      acc[method].count += 1
      return acc
    }, {} as Record<string, { total: number; count: number }>)

    const paymentMethodData = Object.entries(paymentMethods)
      .map(([name, data]) => ({ name, value: data.total, count: data.count }))
      .sort((a, b) => b.value - a.value)

    // Previous period comparison
    const previousInterval = {
      start: new Date(interval.start.getTime() - (interval.end.getTime() - interval.start.getTime())),
      end: interval.start
    }

    const previousExpenses = expenses.filter(exp => {
      const expDate = new Date(exp.date)
      return isWithinInterval(expDate, previousInterval)
    })

    const previousTotal = previousExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)
    const percentageChange = previousTotal > 0 ? ((totalExpenses - previousTotal) / previousTotal) * 100 : 0

    // Daily/trend data
    let dailyData: Array<{ date: string; expenses: number; income: number }> = []
    if (selectedPeriod === 'week' || selectedPeriod === 'month') {
      const days = selectedPeriod === 'week' ? 7 : 30
      const dateRange = eachDayOfInterval({
        start: subDays(now, days - 1),
        end: now
      })

      dailyData = dateRange.map(date => {
        const dayExpenses = expenses.filter(exp => {
          const expDate = new Date(exp.date)
          return format(expDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        })
        const dayIncome = incomes.filter(inc => {
          const incDate = new Date(inc.date)
          return format(incDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        })
        return {
          date: format(date, selectedPeriod === 'week' ? 'EEE' : 'MMM dd'),
          expenses: parseFloat(dayExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0).toFixed(2)),
          income: parseFloat(dayIncome.reduce((sum, inc) => sum + inc.amount, 0).toFixed(2))
        }
      })
    }

    // Spending by day of week
    const dayOfWeekData = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
      const dayExpenses = periodExpenses.filter(exp => getDay(new Date(exp.date)) === index)
      return {
        day,
        amount: dayExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)
      }
    })

    // Highest and lowest expenses
    const highestExpense = periodExpenses.length > 0
      ? periodExpenses.reduce((max, exp) =>
          parseFloat(exp.amount.toString()) > parseFloat(max.amount.toString()) ? exp : max
        )
      : null

    const lowestExpense = periodExpenses.length > 0
      ? periodExpenses.reduce((min, exp) =>
          parseFloat(exp.amount.toString()) < parseFloat(min.amount.toString()) ? exp : min
        )
      : null

    // Spending velocity (daily average)
    const daysInPeriod = differenceInDays(interval.end, interval.start) + 1
    const dailyAverage = totalExpenses / daysInPeriod

    // Savings rate
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0

    return {
      totalExpenses,
      totalIncome,
      netCashFlow,
      count,
      average,
      topCategories,
      paymentMethodData,
      percentageChange,
      dailyData,
      dayOfWeekData,
      highestExpense,
      lowestExpense,
      dailyAverage,
      savingsRate,
      daysInPeriod
    }
  }, [expenses, incomes, selectedPeriod])

  // Generate intelligent insights
  const insights = useMemo(() => {
    const tips: Array<{ type: 'success' | 'warning' | 'info'; message: string }> = []

    // Savings rate insight
    if (analysis.totalIncome > 0) {
      if (analysis.savingsRate >= 20) {
        tips.push({ type: 'success', message: `Excellent! You're saving ${analysis.savingsRate.toFixed(0)}% of your income.` })
      } else if (analysis.savingsRate > 0) {
        tips.push({ type: 'info', message: `You're saving ${analysis.savingsRate.toFixed(0)}% of income. Aim for 20%+ for financial security.` })
      } else {
        tips.push({ type: 'warning', message: `You're spending more than you earn. Consider reducing non-essential expenses.` })
      }
    }

    // Spending trend
    if (analysis.percentageChange > 20) {
      tips.push({ type: 'warning', message: `Spending up ${analysis.percentageChange.toFixed(0)}% from last period. Review recent expenses.` })
    } else if (analysis.percentageChange < -10) {
      tips.push({ type: 'success', message: `Great job! Spending down ${Math.abs(analysis.percentageChange).toFixed(0)}% from last period.` })
    }

    // Top category insight
    if (analysis.topCategories.length > 0) {
      const topCat = analysis.topCategories[0]
      const topPercentage = (topCat.total / analysis.totalExpenses) * 100
      if (topPercentage > 40) {
        tips.push({ type: 'info', message: `${topCat.name} dominates at ${topPercentage.toFixed(0)}% of spending. Consider if this aligns with your priorities.` })
      }
    }

    // Daily average insight
    if (analysis.dailyAverage > 0) {
      tips.push({ type: 'info', message: `You're spending an average of ${formatAmount(analysis.dailyAverage)} per day.` })
    }

    return tips
  }, [analysis, formatAmount])

  const periods: { value: TimePeriod; label: string; icon: typeof Calendar }[] = [
    { value: 'day', label: 'Today', icon: Clock },
    { value: 'week', label: 'This Week', icon: Calendar },
    { value: 'month', label: 'This Month', icon: BarChart3 },
    { value: 'year', label: 'This Year', icon: Activity },
  ]

  const pieChartData = analysis.topCategories.map((cat, index) => ({
    name: cat.name,
    value: cat.total,
    color: COLORS[index % COLORS.length]
  }))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Period Selector */}
      <div className="flex flex-wrap gap-3">
        {periods.map((period) => {
          const Icon = period.icon
          return (
            <button
              key={period.value}
              onClick={() => setSelectedPeriod(period.value)}
              className={`group relative px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 text-sm sm:text-base ${
                selectedPeriod === period.value
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-800/80'
              }`}
            >
              <Icon size={18} />
              {period.label}
            </button>
          )
        })}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
          <div className="relative p-4 sm:p-6 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400">Expenses</h3>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center">
                <TrendingDown className="text-white" size={18} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">
              {formatAmount(analysis.totalExpenses)}
            </p>
            <div className="mt-2 flex items-center gap-1">
              <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg ${
                analysis.percentageChange >= 0
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              }`}>
                {analysis.percentageChange >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(analysis.percentageChange).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>

        {/* Total Income */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
          <div className="relative p-4 sm:p-6 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400">Income</h3>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <TrendingUp className="text-white" size={18} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
              {formatAmount(analysis.totalIncome)}
            </p>
            <p className="mt-2 text-xs text-gray-500">{selectedPeriod === 'day' ? 'Today' : `This ${selectedPeriod}`}</p>
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className="group relative">
          <div className={`absolute inset-0 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity ${
            analysis.netCashFlow >= 0 ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gradient-to-br from-orange-500 to-red-600'
          }`}></div>
          <div className="relative p-4 sm:p-6 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400">Net Flow</h3>
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${
                analysis.netCashFlow >= 0 ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gradient-to-br from-orange-500 to-red-600'
              }`}>
                <Wallet className="text-white" size={18} />
              </div>
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${
              analysis.netCashFlow >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {formatAmount(analysis.netCashFlow)}
            </p>
            <p className="mt-2 text-xs text-gray-500">{analysis.netCashFlow >= 0 ? 'Surplus' : 'Deficit'}</p>
          </div>
        </div>

        {/* Savings Rate */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
          <div className="relative p-4 sm:p-6 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400">Savings Rate</h3>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <PiggyBank className="text-white" size={18} />
              </div>
            </div>
            <p className={`text-xl sm:text-2xl font-bold ${
              analysis.savingsRate >= 20 ? 'text-green-600 dark:text-green-400' : analysis.savingsRate > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {analysis.savingsRate.toFixed(0)}%
            </p>
            <p className="mt-2 text-xs text-gray-500">{analysis.savingsRate >= 20 ? 'Excellent!' : analysis.savingsRate > 0 ? 'Good start' : 'Needs attention'}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white/40 dark:bg-gray-800/40 backdrop-blur border border-white/20 dark:border-gray-700/50">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={16} className="text-purple-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Transactions</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{analysis.count}</p>
        </div>
        <div className="p-4 rounded-xl bg-white/40 dark:bg-gray-800/40 backdrop-blur border border-white/20 dark:border-gray-700/50">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={16} className="text-yellow-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Daily Avg</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatAmount(analysis.dailyAverage)}</p>
        </div>
        <div className="p-4 rounded-xl bg-white/40 dark:bg-gray-800/40 backdrop-blur border border-white/20 dark:border-gray-700/50">
          <div className="flex items-center gap-2 mb-1">
            <Target size={16} className="text-blue-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Avg Transaction</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatAmount(analysis.average)}</p>
        </div>
        <div className="p-4 rounded-xl bg-white/40 dark:bg-gray-800/40 backdrop-blur border border-white/20 dark:border-gray-700/50">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-red-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Highest</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {analysis.highestExpense ? formatAmount(parseFloat(analysis.highestExpense.amount.toString())) : formatAmount(0)}
          </p>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200/50 dark:border-blue-800/50">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Lightbulb className="text-yellow-500" size={20} />
            Smart Insights
          </h3>
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start gap-3">
                {insight.type === 'success' && <CheckCircle className="text-green-500 mt-0.5 flex-shrink-0" size={18} />}
                {insight.type === 'warning' && <AlertTriangle className="text-orange-500 mt-0.5 flex-shrink-0" size={18} />}
                {insight.type === 'info' && <Lightbulb className="text-blue-500 mt-0.5 flex-shrink-0" size={18} />}
                <p className="text-sm text-gray-700 dark:text-gray-300">{insight.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses Trend */}
        {analysis.dailyData.length > 0 && (
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative p-4 sm:p-6 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-500" />
                Income vs Expenses
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={analysis.dailyData}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                  <YAxis stroke="#6B7280" fontSize={12} />
                  <Tooltip formatter={(value: number) => formatAmount(value)} />
                  <Legend />
                  <Area type="monotone" dataKey="income" name="Income" stroke="#10B981" fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" fill="url(#colorExpenses)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Category Pie Chart */}
        {pieChartData.length > 0 && (
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative p-4 sm:p-6 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 size={18} className="text-purple-500" />
                Spending by Category
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatAmount(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Spending by Day of Week */}
      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-4 sm:p-6 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-green-500" />
            Spending Pattern by Day
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analysis.dayOfWeekData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="day" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip formatter={(value: number) => formatAmount(value)} />
              <Bar dataKey="amount" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payment Methods */}
      {analysis.paymentMethodData.length > 0 && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 sm:p-6 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-orange-500" />
              Payment Methods
            </h3>
            <div className="space-y-3">
              {analysis.paymentMethodData.map((method, index) => {
                const percentage = analysis.totalExpenses > 0 ? (method.value / analysis.totalExpenses) * 100 : 0
                return (
                  <div key={method.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{method.name}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{formatAmount(method.value)}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: COLORS[index % COLORS.length]
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{method.count} transactions • {percentage.toFixed(1)}%</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Top Categories */}
      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-4 sm:p-6 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-purple-500" />
            Top Categories
          </h3>
          {analysis.topCategories.length > 0 ? (
            <div className="space-y-4">
              {analysis.topCategories.map((category, index) => {
                const percentage = (category.total / analysis.totalExpenses) * 100
                return (
                  <div key={category.name}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                          {index + 1}
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-white">{category.name}</span>
                        <span className="text-xs text-gray-500">({category.count})</span>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">{formatAmount(category.total)}</span>
                    </div>
                    <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: COLORS[index % COLORS.length]
                        }}
                      ></div>
                    </div>
                    <div className="text-right mt-1">
                      <span className="text-xs font-semibold" style={{ color: COLORS[index % COLORS.length] }}>{percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-gray-600 dark:text-gray-400 py-8">
              No expenses in this period
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
