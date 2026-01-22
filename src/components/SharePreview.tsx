import { useState, useEffect } from 'react'
import {
  X, Check, Loader2, AlertCircle, ChevronDown, Trash2,
  CheckSquare, Square, Share2, Image, FileText, Plus,
  Sparkles, RefreshCw
} from 'lucide-react'
import {
  SharedData,
  processSharedContent,
  clearSharedData
} from '../utils/shareService'
import { ParsedExpenseItem, validateCategory } from '../utils/smartParser'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types/expense'
import { useCurrency } from '../contexts/CurrencyContext'

interface SharePreviewProps {
  sharedData: SharedData
  onConfirm: (items: Array<{
    amount: string
    category: string
    description: string
    date: string
    type: 'expense' | 'income'
  }>) => Promise<void>
  onAddCategory?: (category: string) => Promise<void>
  onClose: () => void
  existingCategories?: string[]
}

export default function SharePreview({
  sharedData,
  onConfirm,
  onAddCategory,
  onClose,
  existingCategories = [...EXPENSE_CATEGORIES]
}: SharePreviewProps) {
  const { currency } = useCurrency()

  const [processing, setProcessing] = useState(true)
  const [processStatus, setProcessStatus] = useState('Analyzing shared content...')
  const [error, setError] = useState<string | null>(null)

  const [items, setItems] = useState<ParsedExpenseItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const [suggestedCategories, setSuggestedCategories] = useState<string[]>([])
  const [showCategorySuggestion, setShowCategorySuggestion] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)

  const [importing, setImporting] = useState(false)

  // Process shared content on mount
  useEffect(() => {
    processContent()
  }, [sharedData])

  const processContent = async () => {
    setProcessing(true)
    setError(null)

    try {
      const result = await processSharedContent(sharedData, setProcessStatus)

      setItems(result.items)
      setSelectedItems(new Set(result.items.map((_, i) => i)))
      setSuggestedCategories(result.suggestedCategories)

      // Show category suggestion if there are unknown categories
      if (result.suggestedCategories.length > 0) {
        setShowCategorySuggestion(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process shared content')
    } finally {
      setProcessing(false)
    }
  }

  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedItems(newSelected)
  }

  const selectAll = () => {
    setSelectedItems(new Set(items.map((_, i) => i)))
  }

  const deselectAll = () => {
    setSelectedItems(new Set())
  }

  const updateItem = (index: number, updates: Partial<ParsedExpenseItem>) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    ))
  }

  const deleteItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
    const newSelected = new Set(selectedItems)
    newSelected.delete(index)
    const adjustedSelected = new Set<number>()
    newSelected.forEach(i => {
      if (i < index) adjustedSelected.add(i)
      else if (i > index) adjustedSelected.add(i - 1)
    })
    setSelectedItems(adjustedSelected)
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !onAddCategory) return

    setAddingCategory(true)
    try {
      await onAddCategory(newCategoryName.trim())
      // Add to local list
      existingCategories.push(newCategoryName.trim())
      setNewCategoryName('')
      setShowCategorySuggestion(false)
    } catch (err) {
      setError('Failed to add category')
    } finally {
      setAddingCategory(false)
    }
  }

  const handleConfirm = async () => {
    const selectedExpenses = items.filter((_, i) => selectedItems.has(i))

    if (selectedExpenses.length === 0) {
      setError('Please select at least one item')
      return
    }

    setImporting(true)
    setError(null)

    try {
      await onConfirm(selectedExpenses.map(item => ({
        amount: item.amount.toString(),
        category: validateCategory(item.category, item.type),
        description: item.description,
        date: item.date,
        type: item.type
      })))

      // Clear shared data from service worker
      await clearSharedData()

      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expenses')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = async () => {
    await clearSharedData()
    onClose()
  }

  const totalAmount = items
    .filter((_, i) => selectedItems.has(i))
    .filter(item => item.type === 'expense')
    .reduce((sum, item) => sum + item.amount, 0)

  const incomeAmount = items
    .filter((_, i) => selectedItems.has(i))
    .filter(item => item.type === 'income')
    .reduce((sum, item) => sum + item.amount, 0)

  // Source type badge
  const getSourceBadge = () => {
    const fileCount = sharedData.files.length
    const hasImages = sharedData.files.some(f => f.type.startsWith('image/'))
    const hasPdfs = sharedData.files.some(f => f.type === 'application/pdf')
    const hasText = !!sharedData.text

    if (hasImages && hasText) return { icon: Image, label: 'Image + Text' }
    if (hasImages) return { icon: Image, label: `${fileCount} Image${fileCount > 1 ? 's' : ''}` }
    if (hasPdfs) return { icon: FileText, label: `${fileCount} PDF${fileCount > 1 ? 's' : ''}` }
    if (hasText) return { icon: FileText, label: 'Text' }
    return { icon: Share2, label: 'Shared' }
  }

  const sourceBadge = getSourceBadge()
  const SourceIcon = sourceBadge.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Share2 className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Shared Content</h2>
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <SourceIcon size={14} />
                  <span>{sourceBadge.label}</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-4">
          {/* Processing state */}
          {processing && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="animate-spin text-purple-600 mb-4" size={48} />
              <p className="text-gray-600 dark:text-gray-400 text-center">{processStatus}</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle size={18} />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)}><X size={16} /></button>
            </div>
          )}

          {/* No items found */}
          {!processing && items.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Could not extract any expenses from the shared content.
              </p>
              <button
                onClick={processContent}
                className="flex items-center gap-2 mx-auto px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-xl hover:bg-purple-200 dark:hover:bg-purple-900/50"
              >
                <RefreshCw size={18} />
                Try Again
              </button>
            </div>
          )}

          {/* Category suggestion */}
          {showCategorySuggestion && suggestedCategories.length > 0 && onAddCategory && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
              <div className="flex items-start gap-3">
                <Sparkles className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                    New category detected
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                    Some items might belong to: <strong>{suggestedCategories[0]}</strong>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategoryName || suggestedCategories[0]}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-yellow-300 dark:border-yellow-700 rounded-lg"
                      placeholder="Category name"
                    />
                    <button
                      onClick={handleAddCategory}
                      disabled={addingCategory}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                    >
                      {addingCategory ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    </button>
                    <button
                      onClick={() => setShowCategorySuggestion(false)}
                      className="px-3 py-2 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Items list */}
          {!processing && items.length > 0 && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-xl text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Found</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{items.length}</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
                  <p className="text-xs text-red-600 dark:text-red-400">Expenses</p>
                  <p className="text-lg font-bold text-red-700 dark:text-red-300">{currency.symbol}{totalAmount.toLocaleString()}</p>
                </div>
                {incomeAmount > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                    <p className="text-xs text-green-600 dark:text-green-400">Income</p>
                    <p className="text-lg font-bold text-green-700 dark:text-green-300">{currency.symbol}{incomeAmount.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Selection controls */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={selectAll}
                  className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Deselect All
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                  {selectedItems.size} selected
                </span>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-xl border transition-all ${
                      selectedItems.has(index)
                        ? 'bg-white dark:bg-gray-700 border-purple-300 dark:border-purple-700 shadow-sm'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleItemSelection(index)}
                        className="mt-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                      >
                        {selectedItems.has(index)
                          ? <CheckSquare size={20} className="text-purple-600 dark:text-purple-400" />
                          : <Square size={20} />
                        }
                      </button>

                      <div className="flex-1 min-w-0">
                        {editingIndex === index ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(index, { description: e.target.value })}
                              className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded"
                            />
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={item.amount}
                                onChange={(e) => updateItem(index, { amount: parseFloat(e.target.value) || 0 })}
                                className="w-20 px-2 py-1 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded"
                              />
                              <select
                                value={item.category}
                                onChange={(e) => updateItem(index, { category: e.target.value })}
                                className="flex-1 px-2 py-1 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded"
                              >
                                <optgroup label="Expenses">
                                  {EXPENSE_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </optgroup>
                                <optgroup label="Income">
                                  {INCOME_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </optgroup>
                              </select>
                              <button
                                onClick={() => setEditingIndex(null)}
                                className="px-2 py-1 bg-purple-600 text-white rounded"
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                item.type === 'income'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              }`}>
                                {item.type}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{item.date}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate mt-1">
                              {item.description}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{item.category}</p>
                          </>
                        )}
                      </div>

                      <div className="text-right">
                        <p className={`font-bold ${
                          item.type === 'income'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {item.type === 'income' ? '+' : ''}{currency.symbol}{item.amount.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <button
                            onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            <ChevronDown size={14} className={editingIndex === index ? 'rotate-180' : ''} />
                          </button>
                          <button
                            onClick={() => deleteItem(index)}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!processing && items.length > 0 && (
          <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl font-medium text-gray-700 dark:text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={importing || selectedItems.size === 0}
                className="flex-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 text-white py-3 px-4 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Check size={18} />
                )}
                {importing ? 'Adding...' : `Add ${selectedItems.size} Item${selectedItems.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
