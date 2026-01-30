import { useState, useEffect } from 'react'
import { PAYMENT_METHODS, RECURRENCE_FREQUENCIES, COMMON_TAGS, ExpenseFormData } from '../types/expense'
import { getAllExpenseCategories, addCustomCategory } from '../utils/categoryUtils'
import { Save, X, Plus, CreditCard, ArrowRight } from 'lucide-react'
import { useCurrency } from '../contexts/CurrencyContext'
import { useSettings } from '../contexts/SettingsContext'
import { Liability } from '../types/finance'
import { getActiveDebtLiabilities, processDebtPayment } from '../utils/integrationService'

interface ExpenseFormProps {
  onSubmit: (data: ExpenseFormData) => Promise<void>
  onCancel?: () => void
  initialData?: ExpenseFormData
}

export default function ExpenseForm({ onSubmit, onCancel, initialData }: ExpenseFormProps) {
  const { currency, formatAmount } = useCurrency()
  const { settings } = useSettings()
  const [formData, setFormData] = useState<ExpenseFormData>(
    initialData || {
      amount: '',
      category: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      payment_method: 'Cash',
      tags: [],
      receipt_url: '',
      is_recurring: false,
      recurrence_frequency: '',
      recurrence_end_date: '',
      linked_liability_id: '',
      linked_liability_name: ''
    }
  )
  const [loading, setLoading] = useState(false)
  const [customTag, setCustomTag] = useState('')
  // Dynamic expense categories (base + custom from localStorage)
  const [expenseCategories, setExpenseCategories] = useState<string[]>([])
  // New category input state
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  // Integration: Available liabilities for debt payment linking
  const [availableLiabilities, setAvailableLiabilities] = useState<Liability[]>([])
  const [integrationMessage, setIntegrationMessage] = useState<string | null>(null)

  // Load categories on mount and when initialData changes
  useEffect(() => {
    const allCategories = getAllExpenseCategories()
    // Ensure the current category is included even if it's a custom category not yet in the list
    if (initialData?.category && !allCategories.includes(initialData.category)) {
      setExpenseCategories([...allCategories, initialData.category])
    } else {
      setExpenseCategories(allCategories)
    }
  }, [initialData])

  // Load liabilities when component mounts or when category changes to Debt Payment
  useEffect(() => {
    if (formData.category === 'Debt Payment') {
      loadLiabilities()
    }
  }, [formData.category])

  const loadLiabilities = async () => {
    try {
      const liabilities = await getActiveDebtLiabilities()
      setAvailableLiabilities(liabilities)
    } catch (error) {
      console.error('Error loading liabilities:', error)
    }
  }

  // Handle liability selection
  const handleLiabilitySelect = (liabilityId: string) => {
    const selectedLiability = availableLiabilities.find(l => l.id === liabilityId)
    setFormData({
      ...formData,
      linked_liability_id: liabilityId,
      linked_liability_name: selectedLiability?.name || ''
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(formData)

      // Integration: Process debt payment if linked to liability
      if (formData.linked_liability_id && formData.amount) {
        const amount = parseFloat(formData.amount)
        const result = await processDebtPayment(formData.linked_liability_id, amount)
        if (result.success) {
          setIntegrationMessage(result.message)
          setTimeout(() => setIntegrationMessage(null), 4000)
        }
      }

      setFormData({
        amount: '',
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        payment_method: 'Cash',
        tags: [],
        receipt_url: '',
        is_recurring: false,
        recurrence_frequency: '',
        recurrence_end_date: '',
        linked_liability_id: '',
        linked_liability_name: ''
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleTag = (tag: string) => {
    const tags = formData.tags || []
    if (tags.includes(tag)) {
      setFormData({ ...formData, tags: tags.filter(t => t !== tag) })
    } else {
      setFormData({ ...formData, tags: [...tags, tag] })
    }
  }

  const handleAddCustomTag = () => {
    if (customTag.trim()) {
      const tags = formData.tags || []
      if (!tags.includes(customTag.trim())) {
        setFormData({ ...formData, tags: [...tags, customTag.trim()] })
      }
      setCustomTag('')
    }
  }

  // Handle adding a new category
  const handleAddNewCategory = () => {
    const trimmedName = newCategoryName.trim()
    if (trimmedName && !expenseCategories.includes(trimmedName)) {
      // Save to localStorage for persistence
      addCustomCategory('expense', trimmedName)
      // Update local state
      setExpenseCategories([...expenseCategories, trimmedName])
      // Select the new category
      setFormData({ ...formData, category: trimmedName })
      // Reset input
      setNewCategoryName('')
      setShowNewCategoryInput(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Integration success message */}
      {integrationMessage && (
        <div className="p-4 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
              <CreditCard size={16} className="text-green-600 dark:text-green-400" />
            </div>
            <p className="text-green-700 dark:text-green-300 font-medium">{integrationMessage}</p>
          </div>
        </div>
      )}

      <div className="group relative animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <form onSubmit={handleSubmit} className="relative p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent mb-6 sm:mb-8">
            {initialData ? 'Edit Expense' : 'Add New Expense'}
          </h2>

        <div className="space-y-4 sm:space-y-6">
          <div className="transform transition-all duration-200 hover:scale-[1.02]">
            <label htmlFor="amount" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-gray-500 dark:text-gray-400 text-lg font-medium">{currency.symbol}</span>
              <input
                type="number"
                id="amount"
                step="0.01"
                min="0"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="pl-10 w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="transform transition-all duration-200 hover:scale-[1.02]">
            <label htmlFor="category" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <div className="flex gap-2">
              <select
                id="category"
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="flex-1 px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
              >
                <option value="">Select a category</option>
                {expenseCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewCategoryInput(!showNewCategoryInput)}
                className="px-3 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl transition-all flex items-center justify-center"
                title="Add new category"
              >
                <Plus size={20} />
              </button>
            </div>
            {/* New Category Input */}
            {showNewCategoryInput && (
              <div className="mt-3 flex gap-2 animate-fade-in">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNewCategory())}
                  placeholder="Enter new category name"
                  className="flex-1 px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddNewCategory}
                  disabled={!newCategoryName.trim()}
                  className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-medium transition-all disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewCategoryInput(false)
                    setNewCategoryName('')
                  }}
                  className="px-3 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Integration: Liability selector for Debt Payment category */}
          {formData.category === 'Debt Payment' && (
            <div className="transform transition-all duration-200 hover:scale-[1.02]">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-red-500" />
                  Pay Which Debt?
                </div>
              </label>
              <select
                value={formData.linked_liability_id || ''}
                onChange={(e) => handleLiabilitySelect(e.target.value)}
                className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
              >
                <option value="">Select a debt to pay</option>
                {availableLiabilities.map((liability) => (
                  <option key={liability.id} value={liability.id}>
                    {liability.name} - Balance: {formatAmount(liability.current_balance)}
                  </option>
                ))}
              </select>
              {formData.linked_liability_id && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <ArrowRight size={14} />
                  This payment will reduce {formData.linked_liability_name}'s balance
                </p>
              )}
              {availableLiabilities.length === 0 && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  No active debts found. Add a liability in Liabilities Manager first.
                </p>
              )}
            </div>
          )}

          <div className="transform transition-all duration-200 hover:scale-[1.02]">
            <label htmlFor="date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Date
            </label>
            <input
              type="date"
              id="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
            />
          </div>

          <div className="transform transition-all duration-200 hover:scale-[1.02]">
            <label htmlFor="description" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none"
              placeholder="Add notes about this expense"
            />
          </div>

          {settings.feature_payment_methods && (
            <div className="transform transition-all duration-200 hover:scale-[1.02]">
              <label htmlFor="payment_method" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Payment Method
              </label>
              <select
                id="payment_method"
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          )}

          {settings.feature_tags && (
            <div className="transform transition-all duration-200 hover:scale-[1.02]">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Tags (Optional)
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {COMMON_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      formData.tags?.includes(tag)
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                        : 'bg-white/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTag())}
                  placeholder="Add custom tag"
                  className="flex-1 px-4 py-2 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddCustomTag}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-700 transition-all flex items-center gap-1"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>
              {formData.tags && formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg text-sm flex items-center gap-2"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        className="hover:text-red-200"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {settings.feature_receipts && (
            <div className="transform transition-all duration-200 hover:scale-[1.02]">
              <label htmlFor="receipt_url" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Receipt URL (Optional)
              </label>
              <input
                type="url"
                id="receipt_url"
                value={formData.receipt_url}
                onChange={(e) => setFormData({ ...formData, receipt_url: e.target.value })}
                className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="https://example.com/receipt.jpg"
              />
            </div>
          )}

          {settings.feature_recurring && (
            <>
              <div className="transform transition-all duration-200 hover:scale-[1.02]">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_recurring}
                    onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    This is a recurring expense
                  </span>
                </label>
              </div>

              {formData.is_recurring && (
                <>
                  <div className="transform transition-all duration-200 hover:scale-[1.02]">
                    <label htmlFor="recurrence_frequency" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Frequency
                    </label>
                    <select
                      id="recurrence_frequency"
                      value={formData.recurrence_frequency}
                      onChange={(e) => setFormData({ ...formData, recurrence_frequency: e.target.value })}
                      className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                    >
                      <option value="">Select frequency</option>
                      {RECURRENCE_FREQUENCIES.map((freq) => (
                        <option key={freq} value={freq}>
                          {freq}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="transform transition-all duration-200 hover:scale-[1.02]">
                    <label htmlFor="recurrence_end_date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      id="recurrence_end_date"
                      value={formData.recurrence_end_date}
                      onChange={(e) => setFormData({ ...formData, recurrence_end_date: e.target.value })}
                      className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 group/btn relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3.5 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2 touch-target"
            >
              <Save size={20} />
              <span>{loading ? 'Saving...' : initialData ? 'Update Expense' : 'Add Expense'}</span>
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="sm:flex-none px-6 py-3.5 bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-300 transform hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2 touch-target"
              >
                <X size={20} />
                Cancel
              </button>
            )}
          </div>
        </div>
        </form>
      </div>
    </div>
  )
}
