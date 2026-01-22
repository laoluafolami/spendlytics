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
  ArrowRight,
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

// Map expense categories to allocation buckets
const CATEGORY_TO_BUCKET: Record<string, string> = {
  // Necessities
  'food': 'Necessities',
  'groceries': 'Necessities',
  'transport': 'Necessities',
  'transportation': 'Necessities',
  'utilities': 'Necessities',
  'bills': 'Necessities',
  'rent': 'Necessities',
  'housing': 'Necessities',
  'healthcare': 'Necessities',
  'medical': 'Necessities',
  'insurance': 'Necessities',

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
}

interface BucketFormData {
  name: string
  percentage: number
  color: string
  linkedCategories: string[]
}

const IncomeAllocation: React.FC<IncomeAllocationProps> = ({ onNavigate }) => {
  const [buckets, setBuckets] = useState<AllocationBucket[]>([])
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [actualMonthlyIncome, setActualMonthlyIncome] = useState(0) // From app_income table
  const [monthlyExpenses, setMonthlyExpenses] = useState<Record<string, number>>({})
  const [showBucketModal, setShowBucketModal] = useState(false)
  const [editingBucket, setEditingBucket] = useState<AllocationBucket | null>(null)
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [useActualIncome, setUseActualIncome] = useState(true) // Toggle between actual and manual
  const [formData, setFormData] = useState<BucketFormData>({
    name: '',
    percentage: 0,
    color: BUCKET_COLORS[0],
    linkedCategories: [],
  })

  useEffect(() => {
    // Load buckets from localStorage
    const savedBuckets = localStorage.getItem('spendlytics_allocation_buckets')
    if (savedBuckets) {
      setBuckets(JSON.parse(savedBuckets))
    } else {
      // Initialize with defaults
      const defaults = DEFAULT_ALLOCATION_BUCKETS.map((b, i) => ({
        ...b,
        id: crypto.randomUUID(),
        color: BUCKET_COLORS[i % BUCKET_COLORS.length],
      }))
      setBuckets(defaults)
      localStorage.setItem('spendlytics_allocation_buckets', JSON.stringify(defaults))
    }

    // Load manual monthly income setting
    const savedIncome = localStorage.getItem('spendlytics_monthly_income')
    if (savedIncome) {
      setMonthlyIncome(JSON.parse(savedIncome))
    }

    // Load use actual income preference
    const savedUseActual = localStorage.getItem('spendlytics_use_actual_income')
    if (savedUseActual !== null) {
      setUseActualIncome(JSON.parse(savedUseActual))
    }

    // Load current month expenses and actual income
    loadMonthlyExpenses()
    loadActualMonthlyIncome()
  }, [])

  const loadMonthlyExpenses = async () => {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const endOfMonth = new Date(startOfMonth)
    endOfMonth.setMonth(endOfMonth.getMonth() + 1)
    endOfMonth.setDate(0)
    endOfMonth.setHours(23, 59, 59, 999)

    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, category')
      .gte('date', startOfMonth.toISOString().split('T')[0])
      .lte('date', endOfMonth.toISOString().split('T')[0])

    if (expenses) {
      const byCategory = expenses.reduce((acc, expense) => {
        const category = expense.category?.toLowerCase() || 'other'
        acc[category] = (acc[category] || 0) + expense.amount
        return acc
      }, {} as Record<string, number>)
      setMonthlyExpenses(byCategory)
    }
  }

  const loadActualMonthlyIncome = async () => {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const endOfMonth = new Date(startOfMonth)
    endOfMonth.setMonth(endOfMonth.getMonth() + 1)
    endOfMonth.setDate(0)
    endOfMonth.setHours(23, 59, 59, 999)

    const { data: incomes, error } = await supabase
      .from('app_income')
      .select('amount')
      .gte('date', startOfMonth.toISOString().split('T')[0])
      .lte('date', endOfMonth.toISOString().split('T')[0])

    if (!error && incomes) {
      const totalIncome = incomes.reduce((sum, income) => sum + (income.amount || 0), 0)
      setActualMonthlyIncome(totalIncome)
    }
  }

  // Get the effective monthly income (actual or manual)
  const effectiveMonthlyIncome = useActualIncome ? actualMonthlyIncome : monthlyIncome

  const saveBuckets = (newBuckets: AllocationBucket[]) => {
    setBuckets(newBuckets)
    localStorage.setItem('spendlytics_allocation_buckets', JSON.stringify(newBuckets))
  }

  const saveIncome = (income: number) => {
    setMonthlyIncome(income)
    localStorage.setItem('spendlytics_monthly_income', JSON.stringify(income))
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

  // Calculate allocations
  const calculations = useMemo(() => {
    const totalPercentage = buckets.reduce((sum, b) => sum + b.percentage, 0)

    // Calculate actual spending per bucket
    const bucketSpending = buckets.map(bucket => {
      const targetAmount = (bucket.percentage / 100) * effectiveMonthlyIncome

      // Sum expenses that match this bucket's linked categories
      let actualSpent = 0
      Object.entries(monthlyExpenses).forEach(([category, amount]) => {
        const mappedBucket = CATEGORY_TO_BUCKET[category] || 'Wants'
        if (mappedBucket === bucket.name || bucket.linkedCategories?.includes(category)) {
          actualSpent += amount
        }
      })

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

    // Unallocated expenses
    let unallocatedExpenses = 0
    Object.entries(monthlyExpenses).forEach(([category, amount]) => {
      const mappedBucket = CATEGORY_TO_BUCKET[category]
      const isLinked = buckets.some(b => b.linkedCategories?.includes(category))
      const bucketExists = buckets.some(b => b.name === mappedBucket)

      if (!mappedBucket && !isLinked) {
        unallocatedExpenses += amount
      } else if (mappedBucket && !bucketExists && !isLinked) {
        unallocatedExpenses += amount
      }
    })

    const totalSpent = Object.values(monthlyExpenses).reduce((sum, amount) => sum + amount, 0)
    const savingsRate = effectiveMonthlyIncome > 0 ? ((effectiveMonthlyIncome - totalSpent) / effectiveMonthlyIncome) * 100 : 0

    return {
      totalPercentage,
      bucketSpending,
      unallocatedExpenses,
      totalSpent,
      savingsRate,
      unallocatedPercentage: 100 - totalPercentage,
    }
  }, [buckets, effectiveMonthlyIncome, monthlyExpenses])

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Income Allocation</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Define how you want to distribute your income</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowIncomeModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            Set Income
          </button>
          <button
            onClick={() => setShowBucketModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 dark:text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Bucket
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-blue-200">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">Monthly Income</span>
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
              title={useActualIncome ? 'Using actual income from records' : 'Using manually set income'}
            >
              {useActualIncome ? 'Auto' : 'Manual'}
            </button>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(effectiveMonthlyIncome)}</p>
          {useActualIncome ? (
            <button
              onClick={() => onNavigate?.('income')}
              className="text-blue-200 text-sm mt-1 hover:text-white"
            >
              From {new Date().toLocaleString('default', { month: 'short' })} income records →
            </button>
          ) : (
            <button
              onClick={() => setShowIncomeModal(true)}
              className="text-blue-200 text-sm mt-1 hover:text-white"
            >
              Click to update
            </button>
          )}
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 text-red-200 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Total Spent</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(calculations.totalSpent)}</p>
          <p className="text-red-200 text-sm mt-1">
            {effectiveMonthlyIncome > 0
              ? `${((calculations.totalSpent / effectiveMonthlyIncome) * 100).toFixed(1)}% of income`
              : 'Add income to see %'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 text-green-200 mb-2">
            <Target className="w-4 h-4" />
            <span className="text-sm">Remaining</span>
          </div>
          <p className="text-2xl font-bold">
            {formatCurrency(effectiveMonthlyIncome - calculations.totalSpent)}
          </p>
          <p className="text-green-200 text-sm mt-1">
            Savings rate: {calculations.savingsRate.toFixed(1)}%
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-4 text-white">
          <div className="flex items-center gap-2 text-purple-200 mb-2">
            <Percent className="w-4 h-4" />
            <span className="text-sm">Allocated</span>
          </div>
          <p className="text-2xl font-bold">{calculations.totalPercentage}%</p>
          <p className={`text-sm mt-1 ${
            calculations.totalPercentage === 100 ? 'text-green-300' : 'text-yellow-300'
          }`}>
            {calculations.totalPercentage === 100
              ? 'Fully allocated'
              : `${100 - calculations.totalPercentage}% unallocated`}
          </p>
        </div>
      </div>

      {/* No Income Warning */}
      {effectiveMonthlyIncome === 0 && (
        <div className="p-4 rounded-lg flex items-start gap-3 bg-blue-500/20">
          <AlertCircle className="w-5 h-5 mt-0.5 text-blue-400" />
          <div>
            <p className="text-blue-300">
              No income recorded for {new Date().toLocaleString('default', { month: 'long' })}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {useActualIncome ? (
                <>Add income in the <button onClick={() => onNavigate?.('income')} className="text-blue-400 hover:underline">Income menu</button> or switch to manual mode to set a fixed amount.</>
              ) : (
                <>Click "Set Income" to enter your monthly income, or switch to Auto mode to use your recorded income.</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Allocation Warning */}
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
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Adjust your bucket percentages to total exactly 100%
            </p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocation Pie Chart */}
        <div className="bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-200 dark:border-gray-700/50 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Allocation Distribution</h3>
          <div className="flex items-center gap-6">
            <div className="w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => `${value}%`}
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2 max-h-48 overflow-y-auto">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-gray-600 dark:text-gray-300 text-sm">{item.name}</span>
                  </div>
                  <span className="text-gray-800 dark:text-white font-medium">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Target vs Actual Comparison */}
        <div className="bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-200 dark:border-gray-700/50 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Target vs Actual Spending</h3>
          <div className="h-64">
            {comparisonData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`}
                    stroke="#9CA3AF"
                  />
                  <YAxis type="category" dataKey="name" stroke="#9CA3AF" width={100} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="Target" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Actual" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                <p>Add buckets to see comparison</p>
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
              className="bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-4 border border-white/20 dark:border-gray-200 dark:border-gray-700/50 shadow-lg hover:border-gray-200 dark:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: bucket.color }}
                  />
                  <div>
                    <h4 className="text-gray-800 dark:text-white font-medium">{bucket.name}</h4>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">{bucket.percentage}% of income</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditBucket(bucket)}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteBucket(bucket.id!)}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
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
            className="bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-4 border border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors flex flex-col items-center justify-center min-h-[180px] text-gray-500 dark:text-gray-400 hover:text-blue-400"
          >
            <Plus className="w-8 h-8 mb-2" />
            <span>Add New Bucket</span>
          </button>
        </div>
      </div>

      {/* Unallocated Expenses Warning */}
      {calculations.unallocatedExpenses > 0 && (
        <div className="bg-yellow-500/20 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
            <div>
              <p className="text-yellow-300">
                {formatCurrency(calculations.unallocatedExpenses)} in expenses couldn't be mapped to any bucket
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Some expense categories aren't linked to your allocation buckets. Consider creating new buckets or updating category mappings.
              </p>
              <button
                onClick={() => onNavigate?.('expenses')}
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm mt-2"
              >
                View expenses <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 border border-white/20 dark:border-gray-200 dark:border-gray-700/50 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Popular Allocation Strategies</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-100 dark:bg-gray-200 dark:bg-gray-700/50 rounded-lg">
            <h4 className="text-gray-800 dark:text-white font-medium mb-2">50/30/20 Rule</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              50% Needs, 30% Wants, 20% Savings. A simple, balanced approach for most people.
            </p>
          </div>
          <div className="p-4 bg-gray-100 dark:bg-gray-200 dark:bg-gray-700/50 rounded-lg">
            <h4 className="text-gray-800 dark:text-white font-medium mb-2">70/20/10 Rule</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              70% Living expenses, 20% Savings, 10% Debt/Giving. Good for aggressive debt payoff.
            </p>
          </div>
          <div className="p-4 bg-gray-100 dark:bg-gray-200 dark:bg-gray-700/50 rounded-lg">
            <h4 className="text-gray-800 dark:text-white font-medium mb-2">Zero-Based Budget</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Every naira has a job. Allocate 100% of income to specific categories with no leftover.
            </p>
          </div>
        </div>
      </div>

      {/* Set Income Modal */}
      {showIncomeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Set Monthly Income</h2>
              <button
                onClick={() => setShowIncomeModal(false)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-white hover:bg-gray-200 dark:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Monthly Income (₦)
                </label>
                <input
                  type="number"
                  value={monthlyIncome || ''}
                  onChange={(e) => setMonthlyIncome(parseFloat(e.target.value) || 0)}
                  placeholder="Enter your monthly income"
                  className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowIncomeModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    saveIncome(monthlyIncome)
                    setShowIncomeModal(false)
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 dark:text-white rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Bucket Modal */}
      {showBucketModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white/60 dark:bg-white/50 dark:bg-gray-800/60 backdrop-blur-xl rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                {editingBucket ? 'Edit Bucket' : 'Add Bucket'}
              </h2>
              <button
                onClick={resetBucketForm}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:text-white hover:bg-gray-200 dark:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBucketSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Bucket Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Necessities, Savings"
                  className="w-full px-3 py-2 bg-white/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Percentage of Income *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={formData.percentage || ''}
                    onChange={(e) => setFormData({ ...formData, percentage: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g., 50"
                    className="w-full px-3 py-2 pr-8 bg-white/50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">%</span>
                </div>
                {effectiveMonthlyIncome > 0 && formData.percentage > 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    = {formatCurrency((formData.percentage / 100) * effectiveMonthlyIncome)} per month
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {BUCKET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        formData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1a2e] scale-110' : ''
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
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 dark:text-white rounded-lg transition-colors"
                >
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
