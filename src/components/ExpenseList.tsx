import { useState, useMemo, useEffect } from 'react'
import { Trash2, Edit2, Inbox, Search, Filter, X, CreditCard, Repeat, Receipt, Save, Bookmark } from 'lucide-react'
import { Expense, EXPENSE_CATEGORIES } from '../types/expense'
import { format } from 'date-fns'
import { useCurrency } from '../contexts/CurrencyContext'
import { useSettings } from '../contexts/SettingsContext'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface ExpenseListProps {
  expenses: Expense[]
  onDelete: (id: string) => void
  onEdit: (expense: Expense) => void
}

interface FilterPreset {
  id: string
  name: string
  filters: {
    searchTerm?: string
    selectedCategory?: string
    selectedPaymentMethod?: string
    showRecurringOnly?: boolean
    dateFrom?: string
    dateTo?: string
    amountFrom?: string
    amountTo?: string
  }
}

export default function ExpenseList({ expenses, onDelete, onEdit }: ExpenseListProps) {
  const { formatAmount } = useCurrency()
  const { settings } = useSettings()
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  const [showRecurringOnly, setShowRecurringOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [amountFrom, setAmountFrom] = useState('')
  const [amountTo, setAmountTo] = useState('')
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([])
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [presetName, setPresetName] = useState('')

  useEffect(() => {
    if (settings.feature_saved_filters) {
      loadFilterPresets()
    }
  }, [settings.feature_saved_filters])

  const loadFilterPresets = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('app_filter_presets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setFilterPresets(data || [])
    } catch (error) {
      console.error('Error loading filter presets:', error)
    }
  }

  const saveFilterPreset = async () => {
    if (!presetName.trim() || !user) return

    try {
      const filters = {
        searchTerm,
        selectedCategory,
        selectedPaymentMethod,
        showRecurringOnly,
        dateFrom,
        dateTo,
        amountFrom,
        amountTo
      }

      const { error } = await supabase
        .from('app_filter_presets')
        .insert([{
          user_id: user.id,
          name: presetName,
          filters
        }])

      if (error) throw error

      await loadFilterPresets()
      setPresetName('')
      setShowSavePreset(false)
    } catch (error) {
      console.error('Error saving filter preset:', error)
      alert('Failed to save filter preset')
    }
  }

  const applyFilterPreset = (preset: FilterPreset) => {
    const filters = preset.filters
    setSearchTerm(filters.searchTerm || '')
    setSelectedCategory(filters.selectedCategory || '')
    setSelectedPaymentMethod(filters.selectedPaymentMethod || '')
    setShowRecurringOnly(filters.showRecurringOnly || false)
    setDateFrom(filters.dateFrom || '')
    setDateTo(filters.dateTo || '')
    setAmountFrom(filters.amountFrom || '')
    setAmountTo(filters.amountTo || '')
    setShowFilters(true)
  }

  const deleteFilterPreset = async (id: string) => {
    try {
      const { error } = await supabase
        .from('app_filter_presets')
        .delete()
        .eq('id', id)

      if (error) throw error
      await loadFilterPresets()
    } catch (error) {
      console.error('Error deleting filter preset:', error)
    }
  }

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const matchesSearch = searchTerm === '' ||
        expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.category.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesCategory = selectedCategory === '' || expense.category === selectedCategory

      const matchesPaymentMethod = selectedPaymentMethod === '' ||
        expense.payment_method === selectedPaymentMethod

      const matchesRecurring = !showRecurringOnly || expense.is_recurring === true

      const matchesDateFrom = dateFrom === '' || new Date(expense.date) >= new Date(dateFrom)
      const matchesDateTo = dateTo === '' || new Date(expense.date) <= new Date(dateTo)

      const expenseAmount = parseFloat(expense.amount.toString())
      const matchesAmountFrom = amountFrom === '' || expenseAmount >= parseFloat(amountFrom)
      const matchesAmountTo = amountTo === '' || expenseAmount <= parseFloat(amountTo)

      return matchesSearch && matchesCategory && matchesPaymentMethod && matchesRecurring &&
             matchesDateFrom && matchesDateTo && matchesAmountFrom && matchesAmountTo
    })
  }, [expenses, searchTerm, selectedCategory, selectedPaymentMethod, showRecurringOnly, dateFrom, dateTo, amountFrom, amountTo])

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCategory('')
    setSelectedPaymentMethod('')
    setShowRecurringOnly(false)
    setDateFrom('')
    setDateTo('')
    setAmountFrom('')
    setAmountTo('')
  }

  const hasActiveFilters = searchTerm || selectedCategory || selectedPaymentMethod || showRecurringOnly ||
                           dateFrom || dateTo || amountFrom || amountTo

  if (expenses.length === 0) {
    return (
      <div className="relative animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-10"></div>
        <div className="relative p-16 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Inbox className="text-white" size={40} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">No expenses yet</h3>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Add your first expense to get started tracking your spending!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {settings.feature_advanced_filters && (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl blur-xl opacity-10"></div>
          <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search expenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all ${
                  showFilters
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                    : 'bg-white/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                }`}
              >
                <Filter size={18} />
                Filters
              </button>
              {hasActiveFilters && (
                <>
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl font-medium flex items-center gap-2 transition-all"
                  >
                    <X size={18} />
                    Clear
                  </button>
                  {settings.feature_saved_filters && (
                    <button
                      onClick={() => setShowSavePreset(!showSavePreset)}
                      className="px-4 py-2.5 bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400 rounded-xl font-medium flex items-center gap-2 transition-all"
                    >
                      <Save size={18} />
                      Save
                    </button>
                  )}
                </>
              )}
            </div>

            {showSavePreset && (
              <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Filter preset name"
                    className="flex-1 px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm"
                  />
                  <button
                    onClick={saveFilterPreset}
                    className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-medium transition-all"
                  >
                    Save Preset
                  </button>
                  <button
                    onClick={() => setShowSavePreset(false)}
                    className="px-4 py-2 bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl font-medium text-gray-700 dark:text-gray-300 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {settings.feature_saved_filters && filterPresets.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <Bookmark size={16} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Saved Filters</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filterPresets.map((preset) => (
                    <div key={preset.id} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50">
                      <button
                        onClick={() => applyFilterPreset(preset)}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {preset.name}
                      </button>
                      <button
                        onClick={() => deleteFilterPreset(preset.id)}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                >
                  <option value="">All Categories</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {settings.feature_payment_methods && (
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    className="px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                  >
                    <option value="">All Payment Methods</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Digital Wallet">Digital Wallet</option>
                  </select>
                )}

                {settings.feature_recurring && (
                  <label className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showRecurringOnly}
                      onChange={(e) => setShowRecurringOnly(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Recurring Only</span>
                  </label>
                )}

                {settings.feature_date_range_filter && (
                  <>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      placeholder="Date from"
                      className="px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm"
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      placeholder="Date to"
                      className="px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm"
                    />
                  </>
                )}

                {settings.feature_amount_range_filter && (
                  <>
                    <input
                      type="number"
                      step="0.01"
                      value={amountFrom}
                      onChange={(e) => setAmountFrom(e.target.value)}
                      placeholder="Amount from"
                      className="px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={amountTo}
                      onChange={(e) => setAmountTo(e.target.value)}
                      placeholder="Amount to"
                      className="px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm"
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10"></div>
        <div className="relative rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full table-fixed">
              <thead className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-600/20 dark:via-purple-600/20 dark:to-pink-600/20 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50">
                <tr>
                  <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-24 sm:w-32">
                    Date
                  </th>
                  <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-24 sm:w-32">
                    Category
                  </th>
                  <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-auto">
                    Description
                  </th>
                  {settings.feature_payment_methods && (
                    <th className="px-3 sm:px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20 sm:w-28">
                      Payment
                    </th>
                  )}
                  <th className="px-3 sm:px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20 sm:w-28">
                    Amount
                  </th>
                  <th className="px-3 sm:px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider w-16 sm:w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/30 dark:divide-gray-700/30">
                {filteredExpenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="group hover:bg-white/40 dark:hover:bg-gray-700/40 transition-all duration-200"
                >
                  <td className="px-3 sm:px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span className="text-xs sm:text-sm whitespace-nowrap">
                        {format(new Date(expense.date), 'MMM dd, yyyy')}
                      </span>
                      {settings.feature_recurring && expense.is_recurring && (
                        <span title="Recurring expense" className="self-start sm:self-auto">
                          <Repeat size={14} className="text-blue-500" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4">
                    <span className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500/20 to-purple-500/20 dark:from-blue-600/30 dark:to-purple-600/30 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/50 backdrop-blur-sm break-words">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                    <div className="space-y-1 word-wrap break-words overflow-wrap-anywhere">
                      <div className="break-words hyphens-auto" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        {expense.description || '-'}
                      </div>
                      {settings.feature_tags && expense.tags && expense.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {expense.tags.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 break-words"
                              style={{ wordBreak: 'break-word' }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {settings.feature_receipts && expense.receipt_url && (
                        <a
                          href={expense.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline break-words"
                        >
                          <Receipt size={12} className="flex-shrink-0" />
                          <span className="break-all">View Receipt</span>
                        </a>
                      )}
                    </div>
                  </td>
                  {settings.feature_payment_methods && (
                    <td className="px-3 sm:px-6 py-4 text-sm">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs break-words">
                        <CreditCard size={12} className="flex-shrink-0" />
                        <span className="break-words" style={{ wordBreak: 'break-word' }}>{expense.payment_method || 'Cash'}</span>
                      </span>
                    </td>
                  )}
                  <td className="px-3 sm:px-6 py-4 text-sm font-bold text-right">
                    <span className="bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent whitespace-nowrap">
                      {formatAmount(parseFloat(expense.amount.toString()))}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-1 sm:gap-2">
                      <button
                        onClick={() => onEdit(expense)}
                        className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transform hover:scale-110 transition-all duration-200"
                        title="Edit expense"
                      >
                        <Edit2 size={14} className="sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this expense?')) {
                            onDelete(expense.id)
                          }
                        }}
                        className="p-1.5 sm:p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 dark:bg-red-600/20 dark:hover:bg-red-600/30 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transform hover:scale-110 transition-all duration-200"
                        title="Delete expense"
                      >
                        <Trash2 size={14} className="sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  )
}
