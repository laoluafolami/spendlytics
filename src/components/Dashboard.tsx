import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Expense } from '../types/expense'
import { format, eachMonthOfInterval, subMonths } from 'date-fns'
import { DollarSign, TrendingUp, Calendar, PieChart as PieChartIcon, Sparkles } from 'lucide-react'
import { useCurrency } from '../contexts/CurrencyContext'

interface DashboardProps {
  expenses: Expense[]
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1']

export default function Dashboard({ expenses }: DashboardProps) {
  const { formatAmount } = useCurrency()

  const stats = useMemo(() => {
    const total = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)
    const thisMonth = expenses.filter(exp => {
      const expDate = new Date(exp.date)
      const now = new Date()
      return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear()
    })
    const monthlyTotal = thisMonth.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)

    const categoryData = expenses.reduce((acc, exp) => {
      const category = exp.category
      if (!acc[category]) {
        acc[category] = 0
      }
      acc[category] += parseFloat(exp.amount.toString())
      return acc
    }, {} as Record<string, number>)

    const categoryChartData = Object.entries(categoryData).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2))
    })).sort((a, b) => b.value - a.value)

    const last6Months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date()
    })

    const monthlyData = last6Months.map(month => {
      const monthExpenses = expenses.filter(exp => {
        const expDate = new Date(exp.date)
        return expDate.getMonth() === month.getMonth() && expDate.getFullYear() === month.getFullYear()
      })
      return {
        month: format(month, 'MMM yyyy'),
        amount: parseFloat(monthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0).toFixed(2))
      }
    })

    return {
      total,
      monthlyTotal,
      count: expenses.length,
      categoryChartData,
      monthlyData
    }
  }, [expenses])

  return (
    <div className="space-y-8 animate-fade-in">
      {expenses.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <Sparkles className="text-blue-600 dark:text-blue-400" size={20} />
            <span className="text-gray-700 dark:text-gray-300 font-medium">Add your first expense to see insights!</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
          <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">Total Expenses</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  {formatAmount(stats.total)}
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center group-hover:rotate-6 transition-transform shadow-lg">
                <DollarSign className="text-white" size={28} />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
          <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">This Month</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
                  {formatAmount(stats.monthlyTotal)}
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700 flex items-center justify-center group-hover:rotate-6 transition-transform shadow-lg">
                <Calendar className="text-white" size={28} />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-pink-600 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
          <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">Total Transactions</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 dark:from-orange-400 dark:to-pink-400 bg-clip-text text-transparent">
                  {stats.count}
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-600 dark:from-orange-600 dark:to-pink-700 flex items-center justify-center group-hover:rotate-6 transition-transform shadow-lg">
                <TrendingUp className="text-white" size={28} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {stats.categoryChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-500 rounded-3xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative p-8 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <PieChartIcon className="text-white" size={20} />
                </div>
                Spending by Category
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.categoryChartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
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
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative p-8 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl hover:shadow-2xl transition-all duration-300">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <TrendingUp className="text-white" size={20} />
                </div>
                Monthly Trend
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.2)" />
                  <XAxis
                    dataKey="month"
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
                  <Bar dataKey="amount" fill="url(#colorGradient)" radius={[8, 8, 0, 0]} />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
