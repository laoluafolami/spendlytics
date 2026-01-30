import { useState, useMemo, useEffect, useRef } from 'react'
import { Trash2, Edit2, Inbox, Search, Filter, X, CreditCard, Repeat, Receipt, Save, Bookmark, Calendar, Plus } from 'lucide-react'
import { Expense } from '../types/expense'
import { getAllExpenseCategories } from '../utils/categoryUtils'
import { format } from 'date-fns'
import { useCurrency } from '../contexts/CurrencyContext'
import { useSettings } from '../contexts/SettingsContext'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface ExpenseListProps {
  expenses: Expense[]
  onDelete: (id: string) => void
  onEdit: (expense: Expense) => void
  onAdd?: () => void
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

export default function ExpenseList({ expenses, onDelete, onEdit, onAdd }: ExpenseListProps) {
  const { formatAmount } = useCurrency()
  const { settings } = useSettings()
  const { user } = useAuth()

  // Guard against null settings during initial load
  const safeSettings = settings || {
    feature_advanced_filters: false,
    feature_saved_filters: false,
    feature_payment_methods: false,
    feature_recurring: false,
    feature_tags: false,
    feature_receipts: false,
    feature_date_range_filter: false,
    feature_amount_range_filter: false,
  }

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

  // Mobile detection for bottom sheet filters
  const [isMobile, setIsMobile] = useState(false)
  const filterSheetRef = useRef<HTMLDivElement>(null)

  // Dynamic categories (base + custom from localStorage)
  const [expenseCategories, setExpenseCategories] = useState<string[]>([])

  useEffect(() => {
    setExpenseCategories(getAllExpenseCategories())
  }, [])

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Lock body scroll when mobile filter sheet is open
  useEffect(() => {
    if (showFilters && isMobile) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showFilters, isMobile])

  useEffect(() => {
    if (safeSettings.feature_saved_filters) {
      loadFilterPresets()
    }
  }, [safeSettings.feature_saved_filters])

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
      {/* Header with Add Button (Desktop) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {expenses.length} total expense{expenses.length !== 1 ? 's' : ''}
          </p>
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            <Plus size={18} />
            Add Expense
          </button>
        )}
      </div>

      {safeSettings.feature_advanced_filters && (
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
                  {safeSettings.feature_saved_filters && (
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

            {safeSettings.feature_saved_filters && filterPresets.length > 0 && (
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

            {/* Desktop Filters - Inline */}
            {showFilters && !isMobile && (
              <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                >
                  <option value="">All Categories</option>
                  {expenseCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {safeSettings.feature_payment_methods && (
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    className="px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                  >
                    <option value="">All Payment Methods</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Digital Wallet">Digital Wallet</option>
                  </select>
                )}

                {safeSettings.feature_recurring && (
                  <label className="flex items-center gap-2 px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showRecurringOnly}
                      onChange={(e) => setShowRecurringOnly(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Recurring Only</span>
                  </label>
                )}

                {safeSettings.feature_date_range_filter && (
                  <>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      placeholder="Date from"
                      className="px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm"
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      placeholder="Date to"
                      className="px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm"
                    />
                  </>
                )}

                {safeSettings.feature_amount_range_filter && (
                  <>
                    <input
                      type="number"
                      step="0.01"
                      value={amountFrom}
                      onChange={(e) => setAmountFrom(e.target.value)}
                      placeholder="Amount from"
                      className="px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={amountTo}
                      onChange={(e) => setAmountTo(e.target.value)}
                      placeholder="Amount to"
                      className="px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm"
                    />
                  </>
                )}
              </div>
            )}

            {/* Mobile Filter Bottom Sheet */}
            {showFilters && isMobile && (
              <div
                ref={filterSheetRef}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
                onClick={(e) => {
                  if (e.target === filterSheetRef.current) {
                    setShowFilters(false)
                  }
                }}
              >
                <div className="absolute inset-x-0 bottom-0 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl max-h-[70vh] overflow-y-auto animate-slide-up safe-bottom">
                  <div className="sticky top-0 bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 dark:text-white">Filters</h3>
                    <button
                      onClick={() => setShowFilters(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl active:scale-95 transition-transform"
                    >
                      <X size={20} className="text-gray-500" />
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-base"
                      >
                        <option value="">All Categories</option>
                        {expenseCategories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {safeSettings.feature_payment_methods && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Method</label>
                        <select
                          value={selectedPaymentMethod}
                          onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                          className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-base"
                        >
                          <option value="">All Payment Methods</option>
                          <option value="Cash">Cash</option>
                          <option value="Credit Card">Credit Card</option>
                          <option value="Debit Card">Debit Card</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Digital Wallet">Digital Wallet</option>
                        </select>
                      </div>
                    )}

                    {safeSettings.feature_recurring && (
                      <label className="flex items-center gap-3 px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showRecurringOnly}
                          onChange={(e) => setShowRecurringOnly(e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-base font-medium text-gray-700 dark:text-gray-300">Recurring Only</span>
                      </label>
                    )}

                    {safeSettings.feature_date_range_filter && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">From Date</label>
                          <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-base"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">To Date</label>
                          <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-base"
                          />
                        </div>
                      </div>
                    )}

                    {safeSettings.feature_amount_range_filter && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Min Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            value={amountFrom}
                            onChange={(e) => setAmountFrom(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-base"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            value={amountTo}
                            onChange={(e) => setAmountTo(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-base"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setShowFilters(false)}
                      className="w-full px-4 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium active:scale-[0.98] transition-transform"
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expense List - Mobile Card Layout / Desktop Table */}
      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-10 hidden md:block"></div>
        <div className="relative md:rounded-3xl bg-white/60 dark:bg-gray-800/60 md:backdrop-blur-xl md:border md:border-white/20 md:dark:border-gray-700/50 md:shadow-xl overflow-hidden">
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12 px-6">
              <Inbox className="mx-auto mb-4 text-gray-400 dark:text-gray-600" size={48} />
              <p className="text-gray-600 dark:text-gray-400">No expenses found. {hasActiveFilters ? 'Try adjusting your filters.' : 'Add your first expense!'}</p>
            </div>
          ) : (
            <>
              {/* Mobile Card Layout */}
              <div className="block md:hidden divide-y divide-gray-200/30 dark:divide-gray-700/30">
                {filteredExpenses.map((expense) => (
                  <div key={expense.id} className="p-4 active:bg-gray-100 dark:active:bg-gray-700/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {expense.description || expense.category}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-700 dark:text-blue-300">
                            {expense.category}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Calendar size={12} />
                            {format(new Date(expense.date), 'MMM dd, yyyy')}
                          </span>
                          {safeSettings.feature_recurring && expense.is_recurring && (
                            <Repeat size={12} className="text-blue-500" />
                          )}
                        </div>
                        {safeSettings.feature_payment_methods && expense.payment_method && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <CreditCard size={12} />
                            {expense.payment_method}
                          </div>
                        )}
                        {safeSettings.feature_tags && expense.tags && expense.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {expense.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-lg bg-gradient-to-r from-red-600 to-orange-600 dark:from-red-400 dark:to-orange-400 bg-clip-text text-transparent">
                          {formatAmount(parseFloat(expense.amount.toString()))}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-200/30 dark:border-gray-700/30">
                      {safeSettings.feature_receipts && expense.receipt_url && (
                        <a
                          href={expense.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium mr-auto"
                        >
                          <Receipt size={14} />
                          Receipt
                        </a>
                      )}
                      <button
                        onClick={() => onEdit(expense)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 active:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-sm font-medium transition-all"
                      >
                        <Edit2 size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this expense?')) {
                            onDelete(expense.id)
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 active:bg-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium transition-all"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-600/20 dark:via-purple-600/20 dark:to-pink-600/20 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50">
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
                      {safeSettings.feature_payment_methods && (
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Payment
                        </th>
                      )}
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/30 dark:divide-gray-700/30">
                    {filteredExpenses.map((expense) => (
                      <tr key={expense.id} className="group/row hover:bg-white/40 dark:hover:bg-gray-700/40 transition-all">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-400" />
                            {format(new Date(expense.date), 'MMM dd, yyyy')}
                            {safeSettings.feature_recurring && expense.is_recurring && (
                              <span title="Recurring expense">
                                <Repeat size={14} className="text-blue-500" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                          <div className="space-y-1">
                            <div>{expense.description || '-'}</div>
                            {safeSettings.feature_tags && expense.tags && expense.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {expense.tags.map((tag, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {safeSettings.feature_receipts && expense.receipt_url && (
                              <a
                                href={expense.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                <Receipt size={12} />
                                View Receipt
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500/20 to-purple-500/20 dark:from-blue-600/30 dark:to-purple-600/30 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/50">
                            {expense.category}
                          </span>
                        </td>
                        {safeSettings.feature_payment_methods && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs">
                              <CreditCard size={12} />
                              {expense.payment_method || 'Cash'}
                            </span>
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right">
                          <span className="bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
                            {formatAmount(parseFloat(expense.amount.toString()))}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onEdit(expense)}
                              className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transform hover:scale-110 transition-all"
                              title="Edit expense"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this expense?')) {
                                  onDelete(expense.id)
                                }
                              }}
                              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transform hover:scale-110 transition-all"
                              title="Delete expense"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile FAB - Add Expense */}
      {onAdd && (
        <button
          onClick={onAdd}
          className="md:hidden fixed right-4 bottom-20 z-40 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
          aria-label="Add Expense"
        >
          <Plus size={24} />
        </button>
      )}
    </div>
  )
}
