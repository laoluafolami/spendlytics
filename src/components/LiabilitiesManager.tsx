import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, CreditCard, Home, Car, GraduationCap, Briefcase, Users, FileText, Edit2, Trash2, X, TrendingDown, AlertTriangle } from 'lucide-react'
import { useCurrency, CURRENCIES } from '../contexts/CurrencyContext'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
// Supabase data service for cloud sync
import { getLiabilities, createLiability, updateLiability, deleteLiability } from '../utils/financeDataService'
import { Liability } from '../types/finance'

const LIABILITY_TYPES = [
  { value: 'credit_card', label: 'Credit Card', icon: CreditCard, color: '#EF4444' },
  { value: 'mortgage', label: 'Mortgage', icon: Home, color: '#3B82F6' },
  { value: 'car_loan', label: 'Car Loan', icon: Car, color: '#8B5CF6' },
  { value: 'student_loan', label: 'Student Loan', icon: GraduationCap, color: '#10B981' },
  { value: 'personal_loan', label: 'Personal Loan', icon: FileText, color: '#F59E0B' },
  { value: 'business_loan', label: 'Business Loan', icon: Briefcase, color: '#06B6D4' },
  { value: 'family_loan', label: 'Family/Friends Loan', icon: Users, color: '#EC4899' },
  { value: 'other', label: 'Other Debt', icon: FileText, color: '#6B7280' },
] as const

export default function LiabilitiesManager() {
  const { formatAmount, currency, convertAmountSync } = useCurrency()
  const [liabilities, setLiabilities] = useState<Liability[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'credit_card' as Liability['type'],
    principal_amount: '',
    current_balance: '',
    interest_rate: '',
    minimum_payment: '',
    due_date: '',
    notes: '',
    currency: currency.code
  })

  // Helper to convert liability value to display currency
  const getConvertedBalance = useCallback((liability: Liability) => {
    if (liability.currency === currency.code) return liability.current_balance
    return convertAmountSync(liability.current_balance, liability.currency, currency.code)
  }, [currency.code, convertAmountSync])

  const getConvertedPrincipal = useCallback((liability: Liability) => {
    if (liability.currency === currency.code) return liability.principal_amount
    return convertAmountSync(liability.principal_amount, liability.currency, currency.code)
  }, [currency.code, convertAmountSync])

  const getConvertedPayment = useCallback((liability: Liability) => {
    if (!liability.minimum_payment) return null
    if (liability.currency === currency.code) return liability.minimum_payment
    return convertAmountSync(liability.minimum_payment, liability.currency, currency.code)
  }, [currency.code, convertAmountSync])

  // Load liabilities from Supabase/localStorage
  const loadLiabilities = useCallback(async () => {
    try {
      const data = await getLiabilities()
      setLiabilities(data)
    } catch (error) {
      console.error('Error loading liabilities:', error)
    }
  }, [])

  useEffect(() => {
    loadLiabilities()
  }, [loadLiabilities])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const liabilityData = {
      name: formData.name,
      type: formData.type as Liability['type'],
      principal_amount: parseFloat(formData.principal_amount) || 0,
      current_balance: parseFloat(formData.current_balance) || 0,
      interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) : undefined,
      minimum_payment: formData.minimum_payment ? parseFloat(formData.minimum_payment) : undefined,
      due_date: formData.due_date ? parseInt(formData.due_date) : undefined,
      currency: formData.currency,
      notes: formData.notes || undefined,
      is_active: true,
    }

    try {
      if (editingLiability) {
        await updateLiability(editingLiability.id, liabilityData)
      } else {
        await createLiability(liabilityData)
      }
      await loadLiabilities()
      resetForm()
    } catch (error) {
      console.error('Error saving liability:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this liability?')) return

    try {
      await deleteLiability(id)
      await loadLiabilities()
    } catch (error) {
      console.error('Error deleting liability:', error)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingLiability(null)
    setFormData({
      name: '',
      type: 'credit_card',
      principal_amount: '',
      current_balance: '',
      interest_rate: '',
      minimum_payment: '',
      due_date: '',
      notes: '',
      currency: currency.code
    })
  }

  const handleEdit = (liability: Liability) => {
    setEditingLiability(liability)
    setFormData({
      name: liability.name,
      type: liability.type,
      principal_amount: liability.principal_amount.toString(),
      current_balance: liability.current_balance.toString(),
      interest_rate: liability.interest_rate?.toString() || '',
      minimum_payment: liability.minimum_payment?.toString() || '',
      due_date: liability.due_date?.toString() || '',
      notes: liability.notes || '',
      currency: liability.currency || currency.code
    })
    setShowForm(true)
  }

  // Calculate totals with currency conversion
  const totalLiabilities = useMemo(() =>
    liabilities.reduce((sum, l) => sum + getConvertedBalance(l), 0)
  , [liabilities, getConvertedBalance])

  const totalMonthlyPayment = useMemo(() =>
    liabilities.reduce((sum, l) => sum + (getConvertedPayment(l) || 0), 0)
  , [liabilities, getConvertedPayment])

  const highInterestDebt = useMemo(() =>
    liabilities.filter(l => l.interest_rate && l.interest_rate > 15)
  , [liabilities])

  const pieData = useMemo(() => {
    const byType: Record<string, number> = {}
    liabilities.forEach(l => {
      byType[l.type] = (byType[l.type] || 0) + getConvertedBalance(l)
    })

    return Object.entries(byType).map(([type, value]) => {
      const typeInfo = LIABILITY_TYPES.find(t => t.value === type)
      return {
        name: typeInfo?.label || type,
        value,
        color: typeInfo?.color || '#6B7280'
      }
    })
  }, [liabilities, getConvertedBalance])

  // Calculate debt paid off (with conversion)
  const debtPaidOff = useMemo(() => {
    const totalPrincipal = liabilities.reduce((sum, l) => sum + getConvertedPrincipal(l), 0)
    const paid = totalPrincipal - totalLiabilities
    const percent = totalPrincipal > 0 ? (paid / totalPrincipal) * 100 : 0
    return { paid, percent }
  }, [liabilities, totalLiabilities, getConvertedPrincipal])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 dark:from-red-400 dark:via-rose-400 dark:to-pink-400 bg-clip-text text-transparent">
            Liabilities
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Track what you owe - Balance Sheet Liabilities</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl font-medium transform hover:scale-105 transition-all duration-300 shadow-lg"
        >
          <Plus size={18} />
          Add Liability
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-rose-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                <TrendingDown className="text-white" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Debt</p>
                <p className="font-bold text-red-600 dark:text-red-400">{formatAmount(totalLiabilities)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                <CreditCard className="text-white" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Monthly Payments</p>
                <p className="font-bold text-orange-600 dark:text-orange-400">{formatAmount(totalMonthlyPayment)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <TrendingDown className="text-white rotate-180" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Debt Paid Off</p>
                <p className="font-bold text-green-600 dark:text-green-400">{debtPaidOff.percent.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <FileText className="text-white" size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Active Debts</p>
                <p className="font-bold text-purple-600 dark:text-purple-400">{liabilities.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* High Interest Warning */}
      {highInterestDebt.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-red-700 dark:text-red-300">High Interest Debt Alert</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {highInterestDebt.length} debt(s) with interest rate above 15%. Consider paying these off first.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Chart and Form Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        {pieData.length > 0 && (
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-pink-500 rounded-3xl blur-2xl opacity-10"></div>
            <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Debt Breakdown</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
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
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 justify-center mt-4">
                {pieData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-600 dark:text-gray-400">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Add Form */}
        {showForm && (
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-rose-500 rounded-3xl blur-2xl opacity-10"></div>
            <form onSubmit={handleSubmit} className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white">
                  {editingLiability ? 'Edit Liability' : 'Add Liability'}
                </h3>
                <button type="button" onClick={resetForm} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                    placeholder="e.g., Access Bank Credit Card"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Liability['type'] })}
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                  >
                    {LIABILITY_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Original Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.principal_amount}
                      onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Balance</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.current_balance}
                      onChange={(e) => setFormData({ ...formData, current_balance: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Interest Rate %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.interest_rate}
                      onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                      placeholder="0.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monthly Payment</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.minimum_payment}
                      onChange={(e) => setFormData({ ...formData, minimum_payment: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl font-medium transition-all shadow-lg"
                >
                  {editingLiability ? 'Update Liability' : 'Add Liability'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Liabilities List */}
      {liabilities.length > 0 && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-rose-500 rounded-3xl blur-2xl opacity-10"></div>
          <div className="relative rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-red-500/5 to-rose-500/5">
              <h3 className="font-bold text-gray-900 dark:text-white">All Liabilities</h3>
            </div>
            <div className="divide-y divide-gray-200/30 dark:divide-gray-700/30">
              {liabilities.map(liability => {
                const typeInfo = LIABILITY_TYPES.find(t => t.value === liability.type)
                const TypeIcon = typeInfo?.icon || FileText
                const convertedBalance = getConvertedBalance(liability)
                const convertedPrincipal = getConvertedPrincipal(liability)
                const convertedPayment = getConvertedPayment(liability)
                const paidPercent = ((convertedPrincipal - convertedBalance) / convertedPrincipal) * 100
                const isDifferentCurrency = liability.currency !== currency.code
                const liabilityCurrencyInfo = CURRENCIES.find(c => c.code === liability.currency)

                return (
                  <div key={liability.id} className="p-4 hover:bg-white/40 dark:hover:bg-gray-700/40 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${typeInfo?.color}20` }}>
                        <TypeIcon size={20} style={{ color: typeInfo?.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 dark:text-white">{liability.name}</p>
                          {liability.interest_rate && liability.interest_rate > 15 && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                              {liability.interest_rate}% APR
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[100px]">
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                              style={{ width: `${Math.min(paidPercent, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{paidPercent.toFixed(0)}% paid</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600 dark:text-red-400">{formatAmount(convertedBalance)}</p>
                        {isDifferentCurrency && (
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            {liabilityCurrencyInfo?.symbol}{liability.current_balance.toLocaleString()} {liability.currency}
                          </p>
                        )}
                        {convertedPayment && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatAmount(convertedPayment)}/mo
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(liability)}
                          className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(liability.id)}
                          className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {liabilities.length === 0 && !showForm && (
        <div className="text-center py-12">
          <CreditCard className="mx-auto mb-4 text-gray-400 dark:text-gray-600" size={48} />
          <p className="text-gray-600 dark:text-gray-400 mb-2">No liabilities tracked</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">Add your loans, credit cards, and debts</p>
        </div>
      )}
    </div>
  )
}
