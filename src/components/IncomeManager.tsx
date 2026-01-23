import { useState, useEffect } from 'react'
import { Plus, TrendingUp, Edit2, Trash2, Calendar, DollarSign, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCurrency, CURRENCIES } from '../contexts/CurrencyContext'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'

interface Income {
  id: string
  description: string
  amount: number
  category: string
  date: string
  currency?: string
  created_at?: string
}

const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investment', 'Dividends', 'Bonus', 'Rental', 'Gift', 'Other']

export default function IncomeManager() {
  const { formatAmount, currency, convertAmountSync } = useCurrency()
  const { user } = useAuth()
  const [incomes, setIncomes] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Salary',
    date: new Date().toISOString().split('T')[0],
    currency: currency.code
  })

  // Helper to convert income to display currency
  const getConvertedAmount = (income: Income) => {
    const incomeCurrency = income.currency || currency.code
    if (incomeCurrency === currency.code) return income.amount
    return convertAmountSync(income.amount, incomeCurrency, currency.code)
  }

  useEffect(() => {
    loadIncomes()
  }, [])

  const loadIncomes = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('app_income')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (error) throw error
      setIncomes(data || [])
    } catch (error) {
      console.error('Error loading incomes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const amount = parseFloat(formData.amount)

      const incomeData = {
        user_id: user.id,
        description: formData.description,
        amount: amount,
        category: formData.category,
        date: formData.date,
        currency: formData.currency
      }

      if (editingIncome) {
        const { error } = await supabase
          .from('app_income')
          .update(incomeData)
          .eq('id', editingIncome.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('app_income')
          .insert([incomeData])

        if (error) throw error
      }

      await loadIncomes()
      resetForm()
    } catch (error) {
      console.error('Error saving income:', error)
      alert('Failed to save income. Please try again.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this income?')) return

    try {
      const { error } = await supabase
        .from('app_income')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadIncomes()
    } catch (error) {
      console.error('Error deleting income:', error)
      alert('Failed to delete income. Please try again.')
    }
  }

  const handleEdit = (income: Income) => {
    setEditingIncome(income)
    setFormData({
      description: income.description,
      amount: income.amount.toString(),
      category: income.category,
      date: income.date,
      currency: income.currency || currency.code
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      category: 'Salary',
      date: new Date().toISOString().split('T')[0],
      currency: currency.code
    })
    setEditingIncome(null)
    setShowForm(false)
  }

  // Total income converted to display currency
  const totalIncome = incomes.reduce((sum, inc) => sum + getConvertedAmount(inc), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 dark:from-green-400 dark:via-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
            Income Tracking
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Track your income sources</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-medium transform hover:scale-105 transition-all duration-300 shadow-lg"
        >
          <Plus size={18} />
          Add Income
        </button>
      </div>

      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">Total Income</p>
              <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
                {formatAmount(totalIncome)}
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <TrendingUp className="text-white" size={28} />
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <form onSubmit={handleSubmit} className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingIncome ? 'Edit Income' : 'Add New Income'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                  placeholder="e.g., Monthly salary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                >
                  {INCOME_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat.toLowerCase()}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-medium transition-all shadow-lg"
              >
                {editingIncome ? 'Update Income' : 'Add Income'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-3 bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl font-medium text-gray-700 dark:text-gray-300 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-3xl blur-2xl opacity-10"></div>
        <div className="relative rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl overflow-hidden">
          {incomes.length === 0 ? (
            <div className="text-center py-12 px-6">
              <DollarSign className="mx-auto mb-4 text-gray-400 dark:text-gray-600" size={48} />
              <p className="text-gray-600 dark:text-gray-400">No income entries yet. Add your first income!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/30 dark:divide-gray-700/30">
                  {incomes.map((income) => {
                    const incomeCurrency = income.currency || currency.code
                    const isDifferentCurrency = incomeCurrency !== currency.code
                    const convertedAmount = getConvertedAmount(income)
                    const incomeCurrencyInfo = CURRENCIES.find(c => c.code === incomeCurrency)

                    return (
                      <tr key={income.id} className="group/row hover:bg-white/40 dark:hover:bg-gray-700/40 transition-all">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-400" />
                            {format(new Date(income.date), 'MMM dd, yyyy')}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                          {income.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-700 dark:text-green-300 border border-green-200/50 dark:border-green-700/50">
                            {income.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right">
                          <span className="bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
                            {formatAmount(convertedAmount)}
                          </span>
                          {isDifferentCurrency && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-normal">
                              {incomeCurrencyInfo?.symbol}{income.amount.toLocaleString()} {incomeCurrency}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(income)}
                              className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transform hover:scale-110 transition-all"
                              title="Edit income"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(income.id)}
                              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transform hover:scale-110 transition-all"
                              title="Delete income"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
