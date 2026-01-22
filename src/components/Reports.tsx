import { useMemo, useState, useEffect } from 'react'
import { FileText, TrendingUp, TrendingDown, AlertCircle, Download, Calendar, Lightbulb, BarChart3, PieChart, ArrowRight, Sparkles, Clock, DollarSign, Target, ChevronDown, ChevronUp } from 'lucide-react'
import { Expense } from '../types/expense'
import { useCurrency } from '../contexts/CurrencyContext'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO, differenceInDays, getDay, subDays } from 'date-fns'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPie, Pie, Cell, Legend, Area, AreaChart } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface ReportsProps {
  expenses: Expense[]
}

interface Income {
  id: string
  amount: number
  category: string
  description: string
  date: string
}

const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1', '#EF4444', '#14B8A6']

export default function Reports({ expenses }: ReportsProps) {
  const { formatAmount } = useCurrency()
  const { user } = useAuth()

  // Date range state
  const [dateRangeType, setDateRangeType] = useState<'month' | 'custom' | 'quarter' | 'year'>('month')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  // Income data for net calculations
  const [incomes, setIncomes] = useState<Income[]>([])

  // Expanded sections
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null)

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

  // Calculate actual date range based on selection
  const dateRange = useMemo(() => {
    if (dateRangeType === 'month') {
      return {
        start: startOfMonth(new Date(selectedYear, selectedMonth)),
        end: endOfMonth(new Date(selectedYear, selectedMonth))
      }
    } else if (dateRangeType === 'quarter') {
      const quarterStart = Math.floor(selectedMonth / 3) * 3
      return {
        start: startOfMonth(new Date(selectedYear, quarterStart)),
        end: endOfMonth(new Date(selectedYear, quarterStart + 2))
      }
    } else if (dateRangeType === 'year') {
      return {
        start: new Date(selectedYear, 0, 1),
        end: new Date(selectedYear, 11, 31)
      }
    } else {
      return {
        start: parseISO(startDate),
        end: parseISO(endDate)
      }
    }
  }, [dateRangeType, selectedMonth, selectedYear, startDate, endDate])

  // Filter expenses by date range
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp =>
      isWithinInterval(new Date(exp.date), { start: dateRange.start, end: dateRange.end })
    )
  }, [expenses, dateRange])

  // Filter income by date range
  const filteredIncome = useMemo(() => {
    return incomes.filter(inc =>
      isWithinInterval(new Date(inc.date), { start: dateRange.start, end: dateRange.end })
    )
  }, [incomes, dateRange])

  // Monthly report calculations
  const report = useMemo(() => {
    const byCategory = filteredExpenses.reduce((acc, exp) => {
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

    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)
    const totalIncome = filteredIncome.reduce((sum, inc) => sum + inc.amount, 0)

    return {
      totalExpenses,
      totalIncome,
      netCashFlow: totalIncome - totalExpenses,
      count: filteredExpenses.length,
      categoryData,
      byCategory
    }
  }, [filteredExpenses, filteredIncome])

  // Previous period comparison
  const previousPeriodComparison = useMemo(() => {
    const daysDiff = differenceInDays(dateRange.end, dateRange.start) + 1
    const prevStart = subDays(dateRange.start, daysDiff)
    const prevEnd = subDays(dateRange.end, daysDiff)

    const prevExpenses = expenses.filter(exp =>
      isWithinInterval(new Date(exp.date), { start: prevStart, end: prevEnd })
    )

    const prevTotal = prevExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)
    const currentTotal = report.totalExpenses

    const change = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0

    return {
      previousTotal: prevTotal,
      currentTotal,
      change,
      isIncrease: change > 0
    }
  }, [expenses, dateRange, report.totalExpenses])

  // Spending trends over time
  const spendingTrends = useMemo(() => {
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(new Date(), 5 - i)
      return {
        month: format(date, 'MMM yyyy'),
        shortMonth: format(date, 'MMM'),
        date
      }
    })

    return last6Months.map(({ month, shortMonth, date }) => {
      const monthStart = startOfMonth(date)
      const monthEnd = endOfMonth(date)

      const monthExpenses = expenses.filter(exp =>
        isWithinInterval(new Date(exp.date), { start: monthStart, end: monthEnd })
      )

      const monthIncome = incomes.filter(inc =>
        isWithinInterval(new Date(inc.date), { start: monthStart, end: monthEnd })
      )

      const expenseTotal = monthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)
      const incomeTotal = monthIncome.reduce((sum, inc) => sum + inc.amount, 0)

      return {
        month,
        shortMonth,
        expenses: expenseTotal,
        income: incomeTotal,
        net: incomeTotal - expenseTotal,
        count: monthExpenses.length
      }
    })
  }, [expenses, incomes])

  // Spending by day of week
  const spendingByDayOfWeek = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayTotals = days.map((day, index) => {
      const dayExpenses = filteredExpenses.filter(exp => getDay(new Date(exp.date)) === index)
      return {
        day,
        shortDay: day.slice(0, 3),
        total: dayExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0),
        count: dayExpenses.length
      }
    })
    return dayTotals
  }, [filteredExpenses])

  // Top spending days
  const topSpendingDays = useMemo(() => {
    const dayMap = new Map<string, { date: string; total: number; expenses: Expense[] }>()

    filteredExpenses.forEach(exp => {
      const dateKey = exp.date
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, { date: dateKey, total: 0, expenses: [] })
      }
      const day = dayMap.get(dateKey)!
      day.total += parseFloat(exp.amount.toString())
      day.expenses.push(exp)
    })

    return Array.from(dayMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [filteredExpenses])

  // Intelligent insights
  const insights = useMemo(() => {
    const insightsList: Array<{
      id: string
      type: 'warning' | 'success' | 'info' | 'tip'
      title: string
      message: string
      detail?: string
    }> = []

    // Spending trend insight
    if (spendingTrends.length >= 2) {
      const lastMonth = spendingTrends[spendingTrends.length - 1]
      const prevMonth = spendingTrends[spendingTrends.length - 2]

      if (lastMonth.expenses > prevMonth.expenses * 1.2) {
        insightsList.push({
          id: 'spending-increase',
          type: 'warning',
          title: 'Spending Increased',
          message: `Your spending increased by ${((lastMonth.expenses - prevMonth.expenses) / prevMonth.expenses * 100).toFixed(0)}% compared to last month.`,
          detail: `Last month: ${formatAmount(prevMonth.expenses)} → This month: ${formatAmount(lastMonth.expenses)}`
        })
      } else if (lastMonth.expenses < prevMonth.expenses * 0.8) {
        insightsList.push({
          id: 'spending-decrease',
          type: 'success',
          title: 'Great Savings!',
          message: `You reduced spending by ${((prevMonth.expenses - lastMonth.expenses) / prevMonth.expenses * 100).toFixed(0)}% compared to last month.`,
          detail: `Last month: ${formatAmount(prevMonth.expenses)} → This month: ${formatAmount(lastMonth.expenses)}`
        })
      }
    }

    // Category concentration warning
    if (report.categoryData.length > 0 && report.totalExpenses > 0) {
      const topCategory = report.categoryData[0]
      const percentage = (topCategory.amount / report.totalExpenses) * 100

      if (percentage > 50) {
        insightsList.push({
          id: 'category-concentration',
          type: 'info',
          title: 'High Category Concentration',
          message: `${topCategory.category} accounts for ${percentage.toFixed(0)}% of your spending.`,
          detail: `Consider diversifying or reviewing if this aligns with your budget goals.`
        })
      }
    }

    // Day of week pattern
    const maxDaySpending = Math.max(...spendingByDayOfWeek.map(d => d.total))
    const maxDay = spendingByDayOfWeek.find(d => d.total === maxDaySpending)
    if (maxDay && maxDay.total > 0) {
      insightsList.push({
        id: 'day-pattern',
        type: 'tip',
        title: 'Spending Pattern',
        message: `You tend to spend the most on ${maxDay.day}s.`,
        detail: `Total: ${formatAmount(maxDay.total)} across ${maxDay.count} transactions`
      })
    }

    // Cash flow insight
    if (report.netCashFlow < 0) {
      insightsList.push({
        id: 'negative-cashflow',
        type: 'warning',
        title: 'Negative Cash Flow',
        message: `You're spending more than you're earning this period.`,
        detail: `Income: ${formatAmount(report.totalIncome)} | Expenses: ${formatAmount(report.totalExpenses)} | Net: ${formatAmount(report.netCashFlow)}`
      })
    } else if (report.totalIncome > 0 && report.netCashFlow > 0) {
      const savingsRate = (report.netCashFlow / report.totalIncome) * 100
      insightsList.push({
        id: 'savings-rate',
        type: 'success',
        title: `${savingsRate.toFixed(0)}% Savings Rate`,
        message: `You're saving ${formatAmount(report.netCashFlow)} this period.`,
        detail: savingsRate >= 20 ? 'Excellent! Financial experts recommend saving at least 20%.' : 'Tip: Try to increase your savings rate to 20% or more.'
      })
    }

    // Forecast
    const avgMonthlySpend = spendingTrends.reduce((sum, m) => sum + m.expenses, 0) / spendingTrends.length
    if (avgMonthlySpend > 0) {
      insightsList.push({
        id: 'forecast',
        type: 'info',
        title: 'Projected Annual Spending',
        message: `Based on your average, you'll spend about ${formatAmount(avgMonthlySpend * 12)} this year.`,
        detail: `Monthly average: ${formatAmount(avgMonthlySpend)}`
      })
    }

    return insightsList
  }, [spendingTrends, report, spendingByDayOfWeek, formatAmount])

  // Unusual spending detection
  const unusualSpending = useMemo(() => {
    if (expenses.length < 10) return []

    const avgExpense = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0) / expenses.length
    const threshold = avgExpense * 2

    return filteredExpenses
      .filter(exp => parseFloat(exp.amount.toString()) > threshold)
      .sort((a, b) => parseFloat(b.amount.toString()) - parseFloat(a.amount.toString()))
      .slice(0, 10)
  }, [expenses, filteredExpenses])

  // Pie chart data for categories
  const pieChartData = useMemo(() => {
    return report.categoryData.slice(0, 8).map((cat, index) => ({
      name: cat.category,
      value: cat.amount,
      color: COLORS[index % COLORS.length]
    }))
  }, [report.categoryData])

  const handleExportReport = () => {
    const csvHeaders = [
      'Period',
      'Category',
      'Amount',
      'Transaction Count',
      'Average per Transaction',
      'Percentage of Total'
    ]

    const totalAmount = report.totalExpenses
    const periodLabel = `${format(dateRange.start, 'MMM dd, yyyy')} - ${format(dateRange.end, 'MMM dd, yyyy')}`

    const csvRows = [
      csvHeaders.join(','),
      `"${periodLabel} - Summary","Total Expenses","${report.totalExpenses.toFixed(2)}","${report.count}","${report.count > 0 ? (report.totalExpenses / report.count).toFixed(2) : '0'}","100%"`,
      `"${periodLabel}","Total Income","${report.totalIncome.toFixed(2)}","","",""`,
      `"${periodLabel}","Net Cash Flow","${report.netCashFlow.toFixed(2)}","","",""`,
      '',
      'Category Breakdown:',
      csvHeaders.join(','),
      ...report.categoryData.map(cat => {
        const percentage = totalAmount > 0 ? ((cat.amount / totalAmount) * 100).toFixed(1) : '0'
        return [
          `"${periodLabel}"`,
          `"${cat.category}"`,
          cat.amount.toFixed(2),
          cat.count,
          cat.average.toFixed(2),
          `"${percentage}%"`
        ].join(',')
      }),
      '',
      'Individual Transactions:',
      'Date,Category,Description,Amount,Payment Method'
    ]

    filteredExpenses
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach(exp => {
        csvRows.push([
          `"${format(new Date(exp.date), 'yyyy-MM-dd')}"`,
          `"${exp.category}"`,
          `"${(exp.description || '').replace(/"/g, '""')}"`,
          exp.amount.toString(),
          `"${exp.payment_method || 'Cash'}"`
        ].join(','))
      })

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expense-report-${format(dateRange.start, 'yyyy-MM-dd')}-to-${format(dateRange.end, 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertCircle className="text-orange-500" size={20} />
      case 'success': return <TrendingUp className="text-green-500" size={20} />
      case 'tip': return <Lightbulb className="text-blue-500" size={20} />
      default: return <Sparkles className="text-purple-500" size={20} />
    }
  }

  const getInsightBg = (type: string) => {
    switch (type) {
      case 'warning': return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
      case 'success': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'tip': return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      default: return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
            Reports & Insights
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Intelligent analysis of your spending patterns</p>
        </div>
        <button
          onClick={handleExportReport}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transform hover:scale-105 transition-all shadow-lg"
        >
          <Download size={18} />
          Export Report
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-blue-600 dark:text-blue-400" />
              <select
                value={dateRangeType}
                onChange={(e) => setDateRangeType(e.target.value as any)}
                className="px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
              >
                <option value="month">Monthly</option>
                <option value="quarter">Quarterly</option>
                <option value="year">Yearly</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {dateRangeType === 'month' && (
              <div className="flex items-center gap-2">
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
            )}

            {(dateRangeType === 'quarter' || dateRangeType === 'year') && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            )}

            {dateRangeType === 'quarter' && (
              <select
                value={Math.floor(selectedMonth / 3)}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value) * 3)}
                className="px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
              >
                <option value={0}>Q1 (Jan-Mar)</option>
                <option value={1}>Q2 (Apr-Jun)</option>
                <option value={2}>Q3 (Jul-Sep)</option>
                <option value={3}>Q4 (Oct-Dec)</option>
              </select>
            )}

            {dateRangeType === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                />
                <ArrowRight size={18} className="text-gray-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                />
              </div>
            )}
          </div>

          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Showing data from <span className="font-semibold">{format(dateRange.start, 'MMM dd, yyyy')}</span> to <span className="font-semibold">{format(dateRange.end, 'MMM dd, yyyy')}</span>
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="text-red-500" size={18} />
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatAmount(report.totalExpenses)}</p>
          <p className={`text-xs mt-1 ${previousPeriodComparison.isIncrease ? 'text-red-500' : 'text-green-500'}`}>
            {previousPeriodComparison.change !== 0 && (
              <>
                {previousPeriodComparison.isIncrease ? '↑' : '↓'} {Math.abs(previousPeriodComparison.change).toFixed(1)}% vs prev period
              </>
            )}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-green-500" size={18} />
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Income</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatAmount(report.totalIncome)}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className={report.netCashFlow >= 0 ? 'text-green-500' : 'text-red-500'} size={18} />
            <p className="text-sm text-gray-600 dark:text-gray-400">Net Cash Flow</p>
          </div>
          <p className={`text-2xl font-bold ${report.netCashFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatAmount(report.netCashFlow)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="text-purple-500" size={18} />
            <p className="text-sm text-gray-600 dark:text-gray-400">Transactions</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.count}</p>
          <p className="text-xs text-gray-500 mt-1">
            Avg: {formatAmount(report.count > 0 ? report.totalExpenses / report.count : 0)}
          </p>
        </div>
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Sparkles className="text-purple-500" size={20} />
              Intelligent Insights
            </h3>
            <div className="space-y-3">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${getInsightBg(insight.type)}`}
                  onClick={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getInsightIcon(insight.type)}
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">{insight.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{insight.message}</p>
                        {expandedInsight === insight.id && insight.detail && (
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            {insight.detail}
                          </p>
                        )}
                      </div>
                    </div>
                    {insight.detail && (
                      expandedInsight === insight.id ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Pie Chart */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <PieChart size={18} />
              Spending by Category
            </h3>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatAmount(value)} />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-600 dark:text-gray-400 text-center py-8">No data for this period</p>
            )}
          </div>
        </div>

        {/* Spending by Day of Week */}
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-teal-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Clock size={18} />
              Spending by Day of Week
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={spendingByDayOfWeek}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="shortDay" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <Tooltip formatter={(value: number) => formatAmount(value)} />
                <Bar dataKey="total" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Income vs Expenses Trend */}
      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <TrendingUp size={18} />
            Income vs Expenses (Last 6 Months)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={spendingTrends}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="shortMonth" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip formatter={(value: number) => formatAmount(value)} />
              <Legend />
              <Area type="monotone" dataKey="income" name="Income" stroke="#10B981" fill="#10B981" fillOpacity={0.3} />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Spending Days */}
      {topSpendingDays.length > 0 && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Target size={18} />
              Top Spending Days
            </h3>
            <div className="space-y-3">
              {topSpendingDays.map((day, index) => (
                <div key={day.date} className="flex items-center justify-between p-3 rounded-xl bg-white/40 dark:bg-gray-700/40">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0 ? 'bg-red-500' : index === 1 ? 'bg-orange-500' : 'bg-yellow-500'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {format(new Date(day.date), 'EEEE, MMM dd, yyyy')}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{day.expenses.length} transactions</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{formatAmount(day.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <FileText size={18} />
            Category Breakdown
          </h3>
          {report.categoryData.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">No expenses for this period</p>
          ) : (
            <div className="space-y-3">
              {report.categoryData.map((cat, index) => {
                const percentage = report.totalExpenses > 0 ? (cat.amount / report.totalExpenses) * 100 : 0
                return (
                  <div key={index} className="p-4 rounded-xl bg-white/40 dark:bg-gray-700/40 border border-white/30 dark:border-gray-600/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900 dark:text-white">{cat.category}</span>
                      <span className="font-bold text-gray-900 dark:text-white">{formatAmount(cat.amount)}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>{cat.count} transactions • {percentage.toFixed(1)}%</span>
                      <span>Avg: {formatAmount(cat.average)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Unusual Spending */}
      {unusualSpending.length > 0 && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
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
