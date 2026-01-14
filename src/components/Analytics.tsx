import { useMemo, useState } from 'react'
import { Expense } from '../types/expense'
import { useCurrency } from '../contexts/CurrencyContext'
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  isWithinInterval, format, subDays, eachDayOfInterval
} from 'date-fns'
import { Calendar, TrendingUp, TrendingDown, Activity, BarChart3, Clock } from 'lucide-react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

interface AnalyticsProps {
  expenses: Expense[]
}

type TimePeriod = 'day' | 'week' | 'month' | 'year'

export default function Analytics({ expenses }: AnalyticsProps) {
  const { formatAmount } = useCurrency()
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month')

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

    const total = periodExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)
    const count = periodExpenses.length
    const average = count > 0 ? total / count : 0

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

    const previousInterval = {
      start: new Date(interval.start.getTime() - (interval.end.getTime() - interval.start.getTime())),
      end: interval.start
    }

    const previousExpenses = expenses.filter(exp => {
      const expDate = new Date(exp.date)
      return isWithinInterval(expDate, previousInterval)
    })

    const previousTotal = previousExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)
    const percentageChange = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : 0

    let dailyData: Array<{ date: string; amount: number }> = []
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
        return {
          date: format(date, selectedPeriod === 'week' ? 'EEE' : 'MMM dd'),
          amount: parseFloat(dayExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0).toFixed(2))
        }
      })
    }

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

    return {
      total,
      count,
      average,
      topCategories,
      percentageChange,
      dailyData,
      highestExpense,
      lowestExpense
    }
  }, [expenses, selectedPeriod])

  const periods: { value: TimePeriod; label: string; icon: typeof Calendar }[] = [
    { value: 'day', label: 'Today', icon: Clock },
    { value: 'week', label: 'This Week', icon: Calendar },
    { value: 'month', label: 'This Month', icon: BarChart3 },
    { value: 'year', label: 'This Year', icon: Activity },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap gap-3">
        {periods.map((period) => {
          const Icon = period.icon
          return (
            <button
              key={period.value}
              onClick={() => setSelectedPeriod(period.value)}
              className={`group relative px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center gap-2 ${
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
          <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Total Spent</h3>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <TrendingUp className="text-white" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
              {formatAmount(analysis.total)}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${
                analysis.percentageChange >= 0
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              }`}>
                {analysis.percentageChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(analysis.percentageChange).toFixed(1)}%
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400">vs previous period</span>
            </div>
          </div>
        </div>

        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
          <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Transactions</h3>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <Activity className="text-white" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              {analysis.count}
            </p>
            <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
              Expenses recorded
            </p>
          </div>
        </div>

        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
          <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Average</h3>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <BarChart3 className="text-white" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
              {formatAmount(analysis.average)}
            </p>
            <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
              Per transaction
            </p>
          </div>
        </div>

        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
          <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Highest</h3>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <TrendingUp className="text-white" size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 dark:from-orange-400 dark:to-red-400 bg-clip-text text-transparent">
              {analysis.highestExpense ? formatAmount(parseFloat(analysis.highestExpense.amount.toString())) : formatAmount(0)}
            </p>
            <p className="mt-3 text-xs text-gray-600 dark:text-gray-400 truncate">
              {analysis.highestExpense ? analysis.highestExpense.category : 'No expenses'}
            </p>
          </div>
        </div>
      </div>

      {analysis.dailyData.length > 0 && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-8 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <TrendingUp className="text-white" size={20} />
              </div>
              Spending Trend
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analysis.dailyData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.2)" />
                <XAxis
                  dataKey="date"
                  stroke="currentColor"
                  className="text-gray-600 dark:text-gray-400"
                />
                <YAxis
                  stroke="currentColor"
                  className="text-gray-600 dark:text-gray-400"
                />
                <Tooltip
                  formatter={(value) => formatAmount(value as number)}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="url(#colorAmount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-8 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <BarChart3 className="text-white" size={20} />
            </div>
            Top Categories
          </h3>
          {analysis.topCategories.length > 0 ? (
            <div className="space-y-4">
              {analysis.topCategories.map((category, index) => {
                const percentage = (category.total / analysis.total) * 100
                return (
                  <div key={category.name} className="group/item">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                          {index + 1}
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-white">{category.name}</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">({category.count} transactions)</span>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">{formatAmount(category.total)}</span>
                    </div>
                    <div className="relative h-3 bg-gray-200/50 dark:bg-gray-700/50 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500 group-hover/item:from-blue-600 group-hover/item:to-purple-700"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-right mt-1">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{percentage.toFixed(1)}%</span>
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
