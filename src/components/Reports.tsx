import { useMemo, useState } from 'react'
import { FileText, TrendingUp, AlertCircle, Download, Calendar } from 'lucide-react'
import { Expense } from '../types/expense'
import { useCurrency } from '../contexts/CurrencyContext'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

interface ReportsProps {
  expenses: Expense[]
}

export default function Reports({ expenses }: ReportsProps) {
  const { formatAmount } = useCurrency()
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const monthlyReport = useMemo(() => {
    const monthStart = startOfMonth(new Date(selectedYear, selectedMonth))
    const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth))

    const monthExpenses = expenses.filter(exp =>
      isWithinInterval(new Date(exp.date), { start: monthStart, end: monthEnd })
    )

    const byCategory = monthExpenses.reduce((acc, exp) => {
      const cat = exp.category
      if (!acc[cat]) {
        acc[cat] = { total: 0, count: 0, expenses: [] }
      }
      acc[cat].total += parseFloat(exp.amount.toString())
      acc[cat].count += 1
      acc[cat].expenses.push(exp)
      return acc
    }, {} as Record<string, { total: number; count: number; expenses: Expense[] }>)

    const categoryData = Object.entries(byCategory).map(([name, data]) => ({
      category: name,
      amount: data.total,
      count: data.count,
      average: data.total / data.count
    })).sort((a, b) => b.amount - a.amount)

    return {
      total: monthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0),
      count: monthExpenses.length,
      categoryData,
      byCategory
    }
  }, [expenses, selectedMonth, selectedYear])

  const spendingTrends = useMemo(() => {
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i)
      return {
        month: format(date, 'MMM yyyy'),
        date
      }
    })

    return last6Months.map(({ month, date }) => {
      const monthStart = startOfMonth(date)
      const monthEnd = endOfMonth(date)

      const monthExpenses = expenses.filter(exp =>
        isWithinInterval(new Date(exp.date), { start: monthStart, end: monthEnd })
      )

      return {
        month,
        amount: monthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0),
        count: monthExpenses.length,
        average: monthExpenses.length > 0 ? monthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0) / monthExpenses.length : 0
      }
    })
  }, [expenses])

  const unusualSpending = useMemo(() => {
    if (expenses.length < 10) return []

    const avgExpense = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0) / expenses.length
    const threshold = avgExpense * 2

    return expenses
      .filter(exp => parseFloat(exp.amount.toString()) > threshold)
      .sort((a, b) => parseFloat(b.amount.toString()) - parseFloat(a.amount.toString()))
      .slice(0, 10)
  }, [expenses])


  const handleExportReport = () => {
    const reportData = {
      period: `${format(new Date(selectedYear, selectedMonth), 'MMMM yyyy')}`,
      summary: {
        totalExpenses: monthlyReport.total,
        numberOfTransactions: monthlyReport.count,
        averageTransaction: monthlyReport.count > 0 ? monthlyReport.total / monthlyReport.count : 0
      },
      byCategory: monthlyReport.categoryData
    }

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expense-report-${format(new Date(selectedYear, selectedMonth), 'yyyy-MM')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
            Reports & Insights
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Detailed analysis of your spending</p>
        </div>
      </div>

      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-blue-600 dark:text-blue-400" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
                      {format(new Date(2000, i), 'MMMM')}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transform hover:scale-105 transition-all shadow-lg"
            >
              <Download size={18} />
              Export
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-white/40 dark:bg-gray-700/40 border border-white/30 dark:border-gray-600/30">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Spent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatAmount(monthlyReport.total)}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/40 dark:bg-gray-700/40 border border-white/30 dark:border-gray-600/30">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Transactions</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{monthlyReport.count}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/40 dark:bg-gray-700/40 border border-white/30 dark:border-gray-600/30">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Transaction</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatAmount(monthlyReport.count > 0 ? monthlyReport.total / monthlyReport.count : 0)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText size={18} />
              Spending by Category
            </h3>
            {monthlyReport.categoryData.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-center py-8">No expenses for this period</p>
            ) : (
              <div className="space-y-2">
                {monthlyReport.categoryData.map((cat, index) => (
                  <div key={index} className="p-4 rounded-xl bg-white/40 dark:bg-gray-700/40 border border-white/30 dark:border-gray-600/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900 dark:text-white">{cat.category}</span>
                      <span className="font-bold text-gray-900 dark:text-white">{formatAmount(cat.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>{cat.count} transactions</span>
                      <span>Avg: {formatAmount(cat.average)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
            <TrendingUp size={18} />
            Spending Trends (Last 6 Months)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={spendingTrends}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '12px'
                }}
              />
              <Line type="monotone" dataKey="amount" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {unusualSpending.length > 0 && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <AlertCircle size={18} />
              Unusual Spending Detected
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Transactions significantly above your average expense
            </p>
            <div className="space-y-2">
              {unusualSpending.map((exp) => (
                <div key={exp.id} className="p-4 rounded-xl bg-orange-50/50 dark:bg-orange-900/20 border border-orange-200/50 dark:border-orange-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{exp.category}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{exp.description || 'No description'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {format(new Date(exp.date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                      {formatAmount(parseFloat(exp.amount.toString()))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
