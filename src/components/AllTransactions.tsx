import { useState, useEffect, useMemo } from 'react'
import { ArrowUpCircle, ArrowDownCircle, Search, Filter, Calendar, Download, TrendingUp, TrendingDown, Wallet, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCurrency } from '../contexts/CurrencyContext'
import { useAuth } from '../contexts/AuthContext'
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from 'date-fns'
import { Transaction } from '../types/finance'
import { Expense } from '../types/expense'

interface Income {
  id: string
  description: string
  amount: number
  category: string
  date: string
  created_at?: string
}

type DateRange = 'all' | 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'custom'
type TransactionType = 'all' | 'income' | 'expense'

interface AllTransactionsProps {
  onNavigate?: (view: string) => void
}

export default function AllTransactions({ onNavigate }: AllTransactionsProps) {
  const { formatAmount } = useCurrency()
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('this_month')
  const [transactionType, setTransactionType] = useState<TransactionType>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    if (!user) return

    try {
      setLoading(true)

      // Load expenses
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (expenseError) throw expenseError

      // Load income
      const { data: incomeData, error: incomeError } = await supabase
        .from('app_income')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (incomeError) throw incomeError

      setExpenses(expenseData || [])
      setIncomes(incomeData || [])
    } catch (error) {
      console.error('Error loading transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  // Combine and transform into unified transactions
  const allTransactions: Transaction[] = useMemo(() => {
    const expenseTransactions: Transaction[] = expenses.map(exp => ({
      id: exp.id,
      type: 'expense' as const,
      amount: parseFloat(exp.amount.toString()),
      category: exp.category,
      description: exp.description,
      date: exp.date,
      payment_method: exp.payment_method,
      tags: exp.tags,
      source_table: 'expenses' as const,
      created_at: exp.created_at
    }))

    const incomeTransactions: Transaction[] = incomes.map(inc => ({
      id: inc.id,
      type: 'income' as const,
      amount: parseFloat(inc.amount.toString()),
      category: inc.category,
      description: inc.description,
      date: inc.date,
      source_table: 'app_income' as const,
      created_at: inc.created_at || inc.date
    }))

    return [...expenseTransactions, ...incomeTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [expenses, incomes])

  // Get date range boundaries
  const getDateRange = (): { start: Date; end: Date } | null => {
    const now = new Date()
    switch (dateRange) {
      case 'this_month':
        return { start: startOfMonth(now), end: endOfMonth(now) }
      case 'last_month':
        const lastMonth = subMonths(now, 1)
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
      case 'last_3_months':
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) }
      case 'last_6_months':
        return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) }
      case 'this_year':
        return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) }
      case 'custom':
        if (customStartDate && customEndDate) {
          return { start: parseISO(customStartDate), end: parseISO(customEndDate) }
        }
        return null
      default:
        return null
    }
  }

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = allTransactions

    // Filter by date range
    const range = getDateRange()
    if (range) {
      filtered = filtered.filter(t => {
        const date = parseISO(t.date)
        return isWithinInterval(date, { start: range.start, end: range.end })
      })
    }

    // Filter by transaction type
    if (transactionType !== 'all') {
      filtered = filtered.filter(t => t.type === transactionType)
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory)
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(term) ||
        t.category.toLowerCase().includes(term)
      )
    }

    return filtered
  }, [allTransactions, dateRange, transactionType, selectedCategory, searchTerm, customStartDate, customEndDate])

  // Calculate summaries
  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0)

    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

    const netCashFlow = income - expenses
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netCashFlow,
      savingsRate,
      transactionCount: filteredTransactions.length
    }
  }, [filteredTransactions])

  // Get unique categories
  const allCategories = useMemo(() => {
    const cats = new Set(allTransactions.map(t => t.category))
    return Array.from(cats).sort()
  }, [allTransactions])

  const handleDelete = async (transaction: Transaction) => {
    if (!confirm(`Delete this ${transaction.type}?`)) return

    try {
      const { error } = await supabase
        .from(transaction.source_table)
        .delete()
        .eq('id', transaction.id)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error deleting transaction:', error)
      alert('Failed to delete. Please try again.')
    }
  }

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
            All Transactions
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Income Statement - Track all money in and out</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
              showFilters
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                : 'bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Filter size={18} />
            Filters
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-white/80 dark:hover:bg-gray-700/80 transition-all"
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate?.('income')}
          className="group relative cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <ArrowUpCircle className="text-white" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Income</p>
                <p className="font-bold text-green-600 dark:text-green-400">{formatAmount(summary.totalIncome)}</p>
              </div>
            </div>
          </div>
        </div>

        <div
          onClick={() => onNavigate?.('expenses')}
          className="group relative cursor-pointer"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-rose-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                <ArrowDownCircle className="text-white" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Expenses</p>
                <p className="font-bold text-red-600 dark:text-red-400">{formatAmount(summary.totalExpenses)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="group relative">
          <div className={`absolute inset-0 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity ${
            summary.netCashFlow >= 0
              ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
              : 'bg-gradient-to-br from-orange-500 to-red-500'
          }`}></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                summary.netCashFlow >= 0
                  ? 'bg-gradient-to-br from-blue-500 to-cyan-600'
                  : 'bg-gradient-to-br from-orange-500 to-red-600'
              }`}>
                <Wallet className="text-white" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Net Cash Flow</p>
                <p className={`font-bold ${
                  summary.netCashFlow >= 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {summary.netCashFlow >= 0 ? '+' : ''}{formatAmount(summary.netCashFlow)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                {summary.savingsRate >= 0 ? (
                  <TrendingUp className="text-white" size={20} />
                ) : (
                  <TrendingDown className="text-white" size={20} />
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Savings Rate</p>
                <p className={`font-bold ${
                  summary.savingsRate >= 20
                    ? 'text-green-600 dark:text-green-400'
                    : summary.savingsRate >= 0
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {summary.savingsRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-10"></div>
          <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Filters</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date Range</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRange)}
                  className="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
                >
                  <option value="all">All Time</option>
                  <option value="this_month">This Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="last_3_months">Last 3 Months</option>
                  <option value="last_6_months">Last 6 Months</option>
                  <option value="this_year">This Year</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Transaction Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                  className="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
                >
                  <option value="all">All Transactions</option>
                  <option value="income">Income Only</option>
                  <option value="expense">Expenses Only</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
                >
                  <option value="all">All Categories</option>
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Custom Date Range */}
            {dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-10"></div>
        <div className="relative rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl overflow-hidden">
          <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Showing {filteredTransactions.length} transactions
              </p>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 px-6">
              <Wallet className="mx-auto mb-4 text-gray-400 dark:text-gray-600" size={48} />
              <p className="text-gray-600 dark:text-gray-400">No transactions found</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200/30 dark:divide-gray-700/30">
              {filteredTransactions.map((transaction) => (
                <div
                  key={`${transaction.source_table}-${transaction.id}`}
                  className="group/row hover:bg-white/40 dark:hover:bg-gray-700/40 transition-all p-4"
                >
                  <div className="flex items-center gap-4">
                    {/* Type Indicator */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      transaction.type === 'income'
                        ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20'
                        : 'bg-gradient-to-br from-red-500/20 to-rose-500/20'
                    }`}>
                      {transaction.type === 'income' ? (
                        <ArrowUpCircle size={20} className="text-green-600 dark:text-green-400" />
                      ) : (
                        <ArrowDownCircle size={20} className="text-red-600 dark:text-red-400" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {transaction.description}
                        </p>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          transaction.type === 'income'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        }`}>
                          {transaction.type === 'income' ? 'Income' : 'Expense'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {transaction.category}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Calendar size={12} />
                          {format(new Date(transaction.date), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right">
                      <p className={`font-bold ${
                        transaction.type === 'income'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatAmount(transaction.amount)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDelete(transaction)}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
