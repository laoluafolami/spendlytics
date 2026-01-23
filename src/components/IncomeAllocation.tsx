import React, { useState, useEffect, useMemo } from 'react'
import {
  Edit2,
  Plus,
  Trash2,
  X,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Percent,
  Calendar,
  Link,
  RefreshCw,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'
import { AllocationBucket, DEFAULT_ALLOCATION_BUCKETS } from '../types/finance'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface IncomeAllocationProps {
  onNavigate?: (view: string) => void
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const BUCKET_COLORS = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

// Time period options
type TimePeriod = 'this_week' | 'this_month' | 'last_3_months' | 'this_year' | 'custom'

const TIME_PERIOD_LABELS: Record<TimePeriod, string> = {
  this_week: 'This Week',
  this_month: 'This Month',
  last_3_months: 'Last 3 Months',
  this_year: 'This Year',
  custom: 'Custom Range',
}

// Default category to bucket mapping
const DEFAULT_CATEGORY_TO_BUCKET: Record<string, string> = {
  // Necessities
  'food & dining': 'Necessities',
  'food': 'Necessities',
  'groceries': 'Necessities',
  'transport': 'Necessities',
  'transportation': 'Necessities',
  'utilities': 'Necessities',
  'bills': 'Necessities',
  'bills & utilities': 'Necessities',
  'rent': 'Necessities',
  'housing': 'Necessities',
  'healthcare': 'Necessities',
  'medical': 'Necessities',
  'insurance': 'Necessities',
  'airtime & data': 'Necessities',

  // Wants
  'entertainment': 'Wants',
  'dining': 'Wants',
  'restaurants': 'Wants',
  'shopping': 'Wants',
  'clothing': 'Wants',
  'personal care': 'Wants',
  'subscriptions': 'Wants',
  'hobbies': 'Wants',
  'travel': 'Wants',
  'vacation': 'Wants',
  'betting & gambling': 'Wants',

  // Savings/Investment
  'savings': 'Long Term Savings',
  'investment': 'Long Term Savings',
  'investments': 'Long Term Savings',

  // Education
  'education': 'Education',
  'learning': 'Education',
  'courses': 'Education',
  'books': 'Education',

  // Giving
  'charity': 'Giving',
  'donations': 'Giving',
  'tithe': 'Giving',
  'gifts': 'Giving',
  'gift': 'Giving',
  'contribution': 'Giving',

  // Bank charges - often unavoidable
  'bank charges': 'Necessities',
  'transfer out': 'Other',
  'cash withdrawal': 'Other',
  'other': 'Other',
}

interface BucketFormData {
  name: string
  percentage: number
  color: string
  linkedCategories: string[]
}

interface DataSummary {
  expenses: Record<string, number>
  investments: number
  savingsContributions: number
  income: number
}

const IncomeAllocation: React.FC<IncomeAllocationProps> = ({ onNavigate }) => {
  const { user } = useAuth()
  const [buckets, setBuckets] = useState<AllocationBucket[]>([])
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [actualIncome, setActualIncome] = useState(0)
  const [dataSummary, setDataSummary] = useState<DataSummary>({
    expenses: {},
    investments: 0,
    savingsContributions: 0,
    income: 0,
  })
  const [showBucketModal, setShowBucketModal] = useState(false)
  const [editingBucket, setEditingBucket] = useState<AllocationBucket | null>(null)
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [showMappingModal, setShowMappingModal] = useState(false)
  const [useActualIncome, setUseActualIncome] = useState(true)
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('this_month')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>(DEFAULT_CATEGORY_TO_BUCKET)
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState<BucketFormData>({
    name: '',
    percentage: 0,
    color: BUCKET_COLORS[0],
    linkedCategories: [],
  })

  // Calculate date range based on selected time period
  const getDateRange = (): { start: Date; end: Date } => {
    const now = new Date()
    let start: Date
    let end: Date = new Date(now)
    end.setHours(23, 59, 59, 999)

    switch (timePeriod) {
      case 'this_week':
        start = new Date(now)
        start.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
        start.setHours(0, 0, 0, 0)
        break
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        start.setHours(0, 0, 0, 0)
        break
      case 'last_3_months':
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
        start.setHours(0, 0, 0, 0)
        break
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1)
        start.setHours(0, 0, 0, 0)
        break
      case 'custom':
        start = customStartDate ? new Date(customStartDate) : new Date(now.getFullYear(), now.getMonth(), 1)
        end = customEndDate ? new Date(customEndDate) : new Date(now)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        start.setHours(0, 0, 0, 0)
    }

    return { start, end }
  }

  // Load all data
  const loadAllData = async () => {
    if (!user) return
    setLoading(true)

    const { start, end } = getDateRange()
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]

    try {
      // Load expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, category')
        .eq('user_id', user.id)
        .gte('date', startStr)
        .lte('date', endStr)

      const expensesByCategory: Record<string, number> = {}
      const categories = new Set<string>()

      if (expenses) {
        expenses.forEach(expense => {
          const category = expense.category?.toLowerCase() || 'other'
          expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.amount
          categories.add(category)
        })
      }

      // Load income
      const { data: incomes } = await supabase
        .from('app_income')
        .select('amount')
        .eq('user_id', user.id)
        .gte('date', startStr)
        .lte('date', endStr)

      const totalIncome = incomes?.reduce((sum, inc) => sum + (inc.amount || 0), 0) || 0

      // Load investments (purchases made in period)
      const { data: investments } = await supabase
        .from('investments')
        .select('cost_basis, created_at')
        .eq('user_id', user.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      const totalInvestments = investments?.reduce((sum, inv) => sum + (inv.cost_basis || 0), 0) || 0

      // Load savings goal contributions
      const { data: savingsGoals } = await supabase
        .from('savings_goals')
        .select('current_amount, created_at, updated_at')
        .eq('user_id', user.id)

      // For savings, we'll estimate based on current amounts
      // In a real app, you'd have a contributions table
      const totalSavings = savingsGoals?.reduce((sum, goal) => sum + (goal.current_amount || 0), 0) || 0

      setDataSummary({
        expenses: expensesByCategory,
        investments: totalInvestments,
        savingsContributions: totalSavings,
        income: totalIncome,
      })

      setActualIncome(totalIncome)
      setAvailableCategories(Array.from(categories).sort())
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Load buckets from localStorage
    const savedBuckets = localStorage.getItem('spendlytics_allocation_buckets')
    if (savedBuckets) {
      setBuckets(JSON.parse(savedBuckets))
    } else {
      const defaults = DEFAULT_ALLOCATION_BUCKETS.map((b, i) => ({
        ...b,
        id: crypto.randomUUID(),
        color: BUCKET_COLORS[i % BUCKET_COLORS.length],
      }))
      setBuckets(defaults)
      localStorage.setItem('spendlytics_allocation_buckets', JSON.stringify(defaults))
    }

    // Load manual income setting
    const savedIncome = localStorage.getItem('spendlytics_monthly_income')
    if (savedIncome) {
      setMonthlyIncome(JSON.parse(savedIncome))
    }

    // Load income mode preference
    const savedUseActual = localStorage.getItem('spendlytics_use_actual_income')
    if (savedUseActual !== null) {
      setUseActualIncome(JSON.parse(savedUseActual))
    }

    // Load time period preference
    const savedTimePeriod = localStorage.getItem('spendlytics_time_period')
    if (savedTimePeriod) {
      setTimePeriod(JSON.parse(savedTimePeriod))
    }

    // Load custom category mapping
    const savedMapping = localStorage.getItem('spendlytics_category_mapping')
    if (savedMapping) {
      setCategoryMapping({ ...DEFAULT_CATEGORY_TO_BUCKET, ...JSON.parse(savedMapping) })
    }
  }, [])

  // Reload data when time period changes
  useEffect(() => {
    loadAllData()
  }, [user, timePeriod, customStartDate, customEndDate])

  const effectiveIncome = useActualIncome ? actualIncome : monthlyIncome

  const saveBuckets = (newBuckets: AllocationBucket[]) => {
    setBuckets(newBuckets)
    localStorage.setItem('spendlytics_allocation_buckets', JSON.stringify(newBuckets))
  }

  const saveIncome = (income: number) => {
    setMonthlyIncome(income)
    localStorage.setItem('spendlytics_monthly_income', JSON.stringify(income))
  }

  const saveTimePeriod = (period: TimePeriod) => {
    setTimePeriod(period)
    localStorage.setItem('spendlytics_time_period', JSON.stringify(period))
  }

  const saveCategoryMapping = (mapping: Record<string, string>) => {
    setCategoryMapping(mapping)
    localStorage.setItem('spendlytics_category_mapping', JSON.stringify(mapping))
  }

  const handleBucketSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const bucketData: AllocationBucket = {
      id: editingBucket?.id || crypto.randomUUID(),
      name: formData.name,
      percentage: formData.percentage,
      color: formData.color,
      linkedCategories: formData.linkedCategories,
    }

    if (editingBucket) {
      saveBuckets(buckets.map(b => b.id === editingBucket.id ? bucketData : b))
    } else {
      saveBuckets([...buckets, bucketData])
    }

    resetBucketForm()
  }

  const resetBucketForm = () => {
    setShowBucketModal(false)
    setEditingBucket(null)
    setFormData({
      name: '',
      percentage: 0,
      color: BUCKET_COLORS[buckets.length % BUCKET_COLORS.length],
      linkedCategories: [],
    })
  }

  const handleEditBucket = (bucket: AllocationBucket) => {
    setEditingBucket(bucket)
    setFormData({
      name: bucket.name,
      percentage: bucket.percentage,
      color: bucket.color,
      linkedCategories: bucket.linkedCategories || [],
    })
    setShowBucketModal(true)
  }

  const handleDeleteBucket = (id: string) => {
    if (confirm('Are you sure you want to delete this allocation bucket?')) {
      saveBuckets(buckets.filter(b => b.id !== id))
    }
  }

  // Calculate allocations with all data sources
  const calculations = useMemo(() => {
    const totalPercentage = buckets.reduce((sum, b) => sum + b.percentage, 0)

    // Calculate actual spending per bucket
    const bucketSpending = buckets.map(bucket => {
      const targetAmount = (bucket.percentage / 100) * effectiveIncome

      // Sum expenses that match this bucket
      let actualSpent = 0
      Object.entries(dataSummary.expenses).forEach(([category, amount]) => {
        const mappedBucket = categoryMapping[category.toLowerCase()] || 'Other'
        // Check if this category maps to this bucket OR is in linked categories
        if (mappedBucket === bucket.name || bucket.linkedCategories?.includes(category.toLowerCase())) {
          actualSpent += amount
        }
      })

      // Add investments to "Long Term Savings" or "Investments" bucket
      if (bucket.name.toLowerCase().includes('saving') || bucket.name.toLowerCase().includes('invest')) {
        actualSpent += dataSummary.investments
      }

      const remaining = targetAmount - actualSpent
      const percentUsed = targetAmount > 0 ? (actualSpent / targetAmount) * 100 : 0
      const status: 'under' | 'on-track' | 'over' =
        percentUsed > 100 ? 'over' : percentUsed > 85 ? 'on-track' : 'under'

      return {
        ...bucket,
        targetAmount,
        actualSpent,
        remaining,
        percentUsed,
        status,
      }
    })

    // Calculate unallocated expenses
    let unallocatedExpenses = 0
    Object.entries(dataSummary.expenses).forEach(([category, amount]) => {
      const mappedBucket = categoryMapping[category.toLowerCase()]
      const isLinked = buckets.some(b => b.linkedCategories?.includes(category.toLowerCase()))
      const bucketExists = buckets.some(b => b.name === mappedBucket)

      if (!mappedBucket && !isLinked) {
        unallocatedExpenses += amount
      } else if (mappedBucket && !bucketExists && !isLinked) {
        unallocatedExpenses += amount
      }
    })

    const totalSpent = Object.values(dataSummary.expenses).reduce((sum, amount) => sum + amount, 0)
    const savingsRate = effectiveIncome > 0 ? ((effectiveIncome - totalSpent) / effectiveIncome) * 100 : 0

    return {
      totalPercentage,
      bucketSpending,
      unallocatedExpenses,
      totalSpent,
      savingsRate,
      unallocatedPercentage: 100 - totalPercentage,
    }
  }, [buckets, effectiveIncome, dataSummary, categoryMapping])

  // Pie chart data
  const pieData = useMemo(() => {
    const data = buckets.map(bucket => ({
      name: bucket.name,
      value: bucket.percentage,
      color: bucket.color,
    }))

    if (calculations.unallocatedPercentage > 0) {
      data.push({
        name: 'Unallocated',
        value: calculations.unallocatedPercentage,
        color: '#6B7280',
      })
    }

    return data
  }, [buckets, calculations.unallocatedPercentage])

  // Comparison bar chart data
  const comparisonData = useMemo(() => {
    return calculations.bucketSpending.map(bucket => ({
      name: bucket.name,
      Target: bucket.targetAmount,
      Actual: bucket.actualSpent,
    }))
  }, [calculations.bucketSpending])

  // Get period label for display
  const getPeriodLabel = () => {
    const { start, end } = getDateRange()
    const formatDate = (d: Date) => d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })
    return `${formatDate(start)} - ${formatDate(end)}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Income Allocation</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Track how you distribute your income across buckets</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowMappingModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg transition-colors text-sm"
          >
            <Link className="w-4 h-4" />
            Category Mapping
          </button>
          <button
            onClick={() => setShowIncomeModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg transition-colors text-sm"
          >
            <DollarSign className="w-4 h-4" />
            Set Income
          </button>
          <button
            onClick={() => setShowBucketModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Bucket
          </button>
        </div>
      </div>

      {/* Time Period Selector */}
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-4 border border-white/20 dark:border-gray-700/50 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            <span className="font-medium text-gray-800 dark:text-white">Time Period:</span>
            <span className="text-gray-500 dark:text-gray-400 text-sm">{getPeriodLabel()}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TIME_PERIOD_LABELS) as TimePeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => saveTimePeriod(period)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  timePeriod === period
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {TIME_PERIOD_LABELS[period]}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range inputs */}
        {timePeriod === 'custom' && (
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-blue-200">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">Income</span>
            </div>
            <button
              onClick={() => {
                const newValue = !useActualIncome
                setUseActualIncome(newValue)
                localStorage.setItem('spendlytics_use_actual_income', JSON.stringify(newValue))
              }}
              className={`text-xs px-2 py-1 rounded-full ${
                useActualIncome ? 'bg-green-500/30 text-green-200' : 'bg-gray-500/30 text-gray-200'
              }`}
            >
              {useActualIncome ? 'Auto' : 'Manual'}
            </button>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(effectiveIncome)}</p>
          <p className="text-blue-200 text-xs mt-1">{TIME_PERIOD_LABELS[timePeriod]}</p>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 text-red-200 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Total Spent</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(calculations.totalSpent)}</p>
          <p className="text-red-200 text-xs mt-1">
            {effectiveIncome > 0 ? `${((calculations.totalSpent / effectiveIncome) * 100).toFixed(1)}% of income` : '-'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 text-green-200 mb-2">
            <Target className="w-4 h-4" />
            <span className="text-sm">Remaining</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(effectiveIncome - calculations.totalSpent)}</p>
          <p className="text-green-200 text-xs mt-1">Savings: {calculations.savingsRate.toFixed(1)}%</p>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 text-purple-200 mb-2">
            <Percent className="w-4 h-4" />
            <span className="text-sm">Allocated</span>
          </div>
          <p className="text-2xl font-bold">{calculations.totalPercentage}%</p>
          <p className={`text-xs mt-1 ${calculations.totalPercentage === 100 ? 'text-green-300' : 'text-yellow-300'}`}>
            {calculations.totalPercentage === 100 ? 'Fully allocated' : `${100 - calculations.totalPercentage}% unallocated`}
          </p>
        </div>

        <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 text-cyan-200 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Investments</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(dataSummary.investments)}</p>
          <button
            onClick={() => onNavigate?.('investments')}
            className="text-cyan-200 text-xs mt-1 hover:text-white"
          >
            View details →
          </button>
        </div>
      </div>

      {/* Warnings */}
      {effectiveIncome === 0 && (
        <div className="p-4 rounded-lg flex items-start gap-3 bg-blue-500/20">
          <AlertCircle className="w-5 h-5 mt-0.5 text-blue-400" />
          <div>
            <p className="text-blue-300">No income recorded for {TIME_PERIOD_LABELS[timePeriod].toLowerCase()}</p>
            <p className="text-gray-400 text-sm mt-1">
              <button onClick={() => onNavigate?.('income')} className="text-blue-400 hover:underline">
                Add income
              </button> or switch to manual mode to set a target amount.
            </p>
          </div>
        </div>
      )}

      {calculations.totalPercentage !== 100 && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          calculations.totalPercentage > 100 ? 'bg-red-500/20' : 'bg-yellow-500/20'
        }`}>
          <AlertCircle className={`w-5 h-5 mt-0.5 ${
            calculations.totalPercentage > 100 ? 'text-red-400' : 'text-yellow-400'
          }`} />
          <div>
            <p className={calculations.totalPercentage > 100 ? 'text-red-300' : 'text-yellow-300'}>
              {calculations.totalPercentage > 100
                ? `Your allocations exceed 100% by ${calculations.totalPercentage - 100}%`
                : `You have ${100 - calculations.totalPercentage}% of income unallocated`}
            </p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocation Pie Chart */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-4 sm:p-6 border border-white/20 dark:border-gray-700/50 shadow-lg">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-4">Allocation Distribution</h3>
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="w-36 h-36 sm:w-48 sm:h-48 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:flex-1 space-y-2 max-h-48 overflow-y-auto">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm truncate">{item.name}</span>
                  </div>
                  <span className="text-gray-800 dark:text-white font-medium text-sm">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Target vs Actual */}
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-4 sm:p-6 border border-white/20 dark:border-gray-700/50 shadow-lg">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-4">Target vs Actual Spending</h3>
          <div className="h-48 sm:h-64">
            {comparisonData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} layout="vertical" margin={{ left: -20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} stroke="#9CA3AF" fontSize={10} />
                  <YAxis type="category" dataKey="name" stroke="#9CA3AF" width={70} fontSize={10} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="Target" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Actual" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                <p className="text-sm">Add buckets to see comparison</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bucket Cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Allocation Buckets</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {calculations.bucketSpending.map((bucket) => (
            <div
              key={bucket.id}
              className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-4 border border-white/20 dark:border-gray-700/50 shadow-lg"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: bucket.color }} />
                  <div>
                    <h4 className="text-gray-800 dark:text-white font-medium">{bucket.name}</h4>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">{bucket.percentage}% of income</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditBucket(bucket)}
                    className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteBucket(bucket.id!)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Target</span>
                  <span className="text-gray-800 dark:text-white">{formatCurrency(bucket.targetAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Spent</span>
                  <span className={bucket.status === 'over' ? 'text-red-400' : 'text-green-400'}>
                    {formatCurrency(bucket.actualSpent)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Remaining</span>
                  <span className={bucket.remaining >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {formatCurrency(bucket.remaining)}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400">{bucket.percentUsed.toFixed(0)}% used</span>
                  {bucket.status === 'over' && (
                    <span className="text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Over budget
                    </span>
                  )}
                  {bucket.status === 'on-track' && (
                    <span className="text-yellow-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Almost there
                    </span>
                  )}
                  {bucket.status === 'under' && (
                    <span className="text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> On track
                    </span>
                  )}
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      bucket.status === 'over' ? 'bg-red-500' :
                      bucket.status === 'on-track' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, bucket.percentUsed)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add Bucket Card */}
          <button
            onClick={() => setShowBucketModal(true)}
            className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-4 border border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 transition-colors flex flex-col items-center justify-center min-h-[180px] text-gray-500 dark:text-gray-400 hover:text-blue-400"
          >
            <Plus className="w-8 h-8 mb-2" />
            <span>Add New Bucket</span>
          </button>
        </div>
      </div>

      {/* Data Sources Info */}
      <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-700/50 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Data Sources</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <p className="text-blue-400 font-medium">Income</p>
            <p className="text-gray-600 dark:text-gray-400">From Income menu records</p>
            <button onClick={() => onNavigate?.('income')} className="text-blue-400 text-xs hover:underline mt-1">
              Manage income →
            </button>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg">
            <p className="text-red-400 font-medium">Expenses</p>
            <p className="text-gray-600 dark:text-gray-400">{Object.keys(dataSummary.expenses).length} categories tracked</p>
            <button onClick={() => onNavigate?.('expenses')} className="text-red-400 text-xs hover:underline mt-1">
              View expenses →
            </button>
          </div>
          <div className="p-3 bg-cyan-500/10 rounded-lg">
            <p className="text-cyan-400 font-medium">Investments</p>
            <p className="text-gray-600 dark:text-gray-400">{formatCurrency(dataSummary.investments)} invested</p>
            <button onClick={() => onNavigate?.('investments')} className="text-cyan-400 text-xs hover:underline mt-1">
              Manage investments →
            </button>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg">
            <p className="text-green-400 font-medium">Savings Goals</p>
            <p className="text-gray-600 dark:text-gray-400">{formatCurrency(dataSummary.savingsContributions)} saved</p>
            <button onClick={() => onNavigate?.('savings')} className="text-green-400 text-xs hover:underline mt-1">
              View goals →
            </button>
          </div>
        </div>
      </div>

      {/* Set Income Modal */}
      {showIncomeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Set Monthly Income</h2>
              <button onClick={() => setShowIncomeModal(false)} className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Target Monthly Income (₦)
                </label>
                <input
                  type="number"
                  value={monthlyIncome || ''}
                  onChange={(e) => setMonthlyIncome(parseFloat(e.target.value) || 0)}
                  placeholder="Enter your target monthly income"
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This is used when "Manual" mode is selected. Your actual income from records is {formatCurrency(actualIncome)}.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowIncomeModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    saveIncome(monthlyIncome)
                    setShowIncomeModal(false)
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Category Mapping</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Assign your expense categories to allocation buckets</p>
              </div>
              <button onClick={() => setShowMappingModal(false)} className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {availableCategories.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No expense categories found. Add some expenses first.
                </p>
              ) : (
                availableCategories.map((category) => (
                  <div key={category} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <span className="text-gray-800 dark:text-white capitalize">{category}</span>
                    <select
                      value={categoryMapping[category.toLowerCase()] || 'Other'}
                      onChange={(e) => {
                        const newMapping = { ...categoryMapping, [category.toLowerCase()]: e.target.value }
                        saveCategoryMapping(newMapping)
                      }}
                      className="px-3 py-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-gray-800 dark:text-white text-sm"
                    >
                      {buckets.map((bucket) => (
                        <option key={bucket.id} value={bucket.name}>{bucket.name}</option>
                      ))}
                      <option value="Other">Other (Unallocated)</option>
                    </select>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setCategoryMapping(DEFAULT_CATEGORY_TO_BUCKET)
                  localStorage.removeItem('spendlytics_category_mapping')
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
              >
                Reset to Defaults
              </button>
              <button
                onClick={() => setShowMappingModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Bucket Modal */}
      {showBucketModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                {editingBucket ? 'Edit Bucket' : 'Add Bucket'}
              </h2>
              <button onClick={resetBucketForm} className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBucketSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Bucket Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Necessities, Savings"
                  className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Percentage of Income *</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={formData.percentage || ''}
                    onChange={(e) => setFormData({ ...formData, percentage: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g., 50"
                    className="w-full px-3 py-2 pr-8 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
                {effectiveIncome > 0 && formData.percentage > 0 && (
                  <p className="text-gray-500 text-sm mt-1">
                    = {formatCurrency((formData.percentage / 100) * effectiveIncome)} for {TIME_PERIOD_LABELS[timePeriod].toLowerCase()}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {BUCKET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        formData.color === color ? 'ring-2 ring-blue-500 ring-offset-2 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetBucketForm}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg">
                  {editingBucket ? 'Update' : 'Add'} Bucket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default IncomeAllocation
