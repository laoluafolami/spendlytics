import { useState, useEffect, useRef } from 'react'
import {
  X, Check, Loader2, AlertCircle, ChevronDown, Trash2,
  CheckSquare, Square, Share2, Image, FileText, Plus,
  Sparkles, RefreshCw, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react'
import {
  SharedData,
  processSharedContent,
  clearSharedData
} from '../utils/shareService'
import { ParsedTransaction as ParsedExpenseItem, validateCategory } from '../utils/transactionParser'
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
  const contentRef = useRef<HTMLDivElement>(null)

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

  // Detect if mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item

      // If type is changing, also update category to a valid one for the new type
      if (updates.type && updates.type !== item.type) {
        const newType = updates.type
        const validCategories = newType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
        const currentCategoryValid = (validCategories as readonly string[]).includes(item.category)

        return {
          ...item,
          ...updates,
          category: currentCategoryValid ? item.category : validCategories[0]
        }
      }

      return { ...item, ...updates }
    }))
  }

  const toggleItemType = (index: number) => {
    const item = items[index]
    const newType = item.type === 'income' ? 'expense' : 'income'
    updateItem(index, { type: newType })
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
      existingCategories.push(newCategoryName.trim())
      setNewCategoryName('')
      setShowCategorySuggestion(false)
    } catch {
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

  // Mobile bottom sheet layout
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm animate-fade-in">
        {/* Overlay tap to close */}
        <div className="flex-1 min-h-[10vh]" onClick={handleClose} />

        {/* Bottom sheet container */}
        <div className="relative bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl animate-slide-up overflow-hidden max-h-[90vh] flex flex-col safe-bottom">
          {/* Pull indicator */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <Share2 className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Shared Receipt</h2>
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-sm">
                    <SourceIcon size={14} />
                    <span>{sourceBadge.label}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl touch-target"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div ref={contentRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            {/* Processing state */}
            {processing && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-purple-200 dark:border-purple-800"></div>
                  <Loader2 className="absolute inset-0 m-auto animate-spin text-purple-600 dark:text-purple-400" size={32} />
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-center mt-4 text-sm">{processStatus}</p>
                <div className="w-48 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                <div className="flex-1 min-w-0">
                  <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 p-1">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* No items found */}
            {!processing && items.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <AlertCircle className="text-gray-400" size={32} />
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                  Couldn't extract expenses from this content.
                </p>
                <button
                  onClick={processContent}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-xl text-sm font-medium active:scale-95 transition-transform"
                >
                  <RefreshCw size={16} />
                  Try Again
                </button>
              </div>
            )}

            {/* Items found */}
            {!processing && items.length > 0 && (
              <>
                {/* Quick summary cards */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowDownCircle size={16} className="text-red-500" />
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium">Expenses</span>
                    </div>
                    <p className="text-lg font-bold text-red-700 dark:text-red-300">
                      {currency.symbol}{totalAmount.toLocaleString()}
                    </p>
                  </div>
                  {incomeAmount > 0 ? (
                    <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowUpCircle size={16} className="text-green-500" />
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">Income</span>
                      </div>
                      <p className="text-lg font-bold text-green-700 dark:text-green-300">
                        {currency.symbol}{incomeAmount.toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-700/30 dark:to-slate-700/30 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckSquare size={16} className="text-gray-500" />
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Selected</span>
                      </div>
                      <p className="text-lg font-bold text-gray-700 dark:text-gray-300">
                        {selectedItems.size} of {items.length}
                      </p>
                    </div>
                  )}
                </div>

                {/* Category suggestion */}
                {showCategorySuggestion && suggestedCategories.length > 0 && onAddCategory && (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                    <div className="flex items-start gap-2">
                      <Sparkles className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                          New category: <span className="font-bold">{suggestedCategories[0]}</span>
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setNewCategoryName(suggestedCategories[0])
                              handleAddCategory()
                            }}
                            disabled={addingCategory}
                            className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {addingCategory ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            Add
                          </button>
                          <button
                            onClick={() => setShowCategorySuggestion(false)}
                            className="px-3 py-2 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-sm rounded-lg"
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Selection controls */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={selectAll}
                    className="text-xs px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg font-medium active:scale-95"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAll}
                    className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium active:scale-95"
                  >
                    Clear
                  </button>
                </div>

                {/* Items list */}
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => !editingIndex && toggleItemSelection(index)}
                      className={`p-3 rounded-xl border-2 transition-all active:scale-[0.98] ${
                        selectedItems.has(index)
                          ? 'bg-white dark:bg-gray-700/50 border-purple-400 dark:border-purple-600 shadow-sm'
                          : 'bg-gray-50 dark:bg-gray-800/50 border-transparent opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-lg transition-colors ${
                          selectedItems.has(index)
                            ? 'bg-purple-100 dark:bg-purple-900/50'
                            : 'bg-gray-100 dark:bg-gray-700'
                        }`}>
                          {selectedItems.has(index)
                            ? <CheckSquare size={18} className="text-purple-600 dark:text-purple-400" />
                            : <Square size={18} className="text-gray-400" />
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          {editingIndex === index ? (
                            <div className="space-y-2" onClick={e => e.stopPropagation()}>
                              {/* Type Toggle */}
                              <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-500">
                                <button
                                  type="button"
                                  onClick={() => updateItem(index, { type: 'expense' })}
                                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-all ${
                                    item.type === 'expense'
                                      ? 'bg-red-500 text-white'
                                      : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <ArrowDownCircle size={14} />
                                  Expense
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateItem(index, { type: 'income' })}
                                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-all ${
                                    item.type === 'income'
                                      ? 'bg-green-500 text-white'
                                      : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <ArrowUpCircle size={14} />
                                  Income
                                </button>
                              </div>
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => updateItem(index, { description: e.target.value })}
                                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg"
                                placeholder="Description"
                              />
                              <div className="flex gap-2">
                                <div className="relative flex-shrink-0">
                                  <span className="absolute left-2 top-2 text-gray-400 text-sm">{currency.symbol}</span>
                                  <input
                                    type="number"
                                    value={item.amount}
                                    onChange={(e) => updateItem(index, { amount: parseFloat(e.target.value) || 0 })}
                                    className="w-24 pl-6 pr-2 py-2 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg"
                                    placeholder="0"
                                  />
                                </div>
                                <select
                                  value={item.category}
                                  onChange={(e) => updateItem(index, { category: e.target.value })}
                                  className="flex-1 px-2 py-2 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg min-w-0"
                                >
                                  {item.type === 'expense' ? (
                                    EXPENSE_CATEGORIES.map(cat => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))
                                  ) : (
                                    INCOME_CATEGORIES.map(cat => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))
                                  )}
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingIndex(null)}
                                  className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-1"
                                >
                                  <Check size={14} />
                                  Done
                                </button>
                                <button
                                  onClick={() => deleteItem(index)}
                                  className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Prominent Type Toggle */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleItemType(index)
                                }}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-all active:scale-95 mb-2 ${
                                  item.type === 'income'
                                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
                                    : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
                                }`}
                              >
                                {item.type === 'income' ? (
                                  <ArrowUpCircle size={16} />
                                ) : (
                                  <ArrowDownCircle size={16} />
                                )}
                                <span>{item.type === 'income' ? 'Income' : 'Expense'}</span>
                                <span className="text-xs opacity-60 ml-1">(tap to change)</span>
                              </button>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs text-gray-400">{item.date}</span>
                              </div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                                {item.description || 'No description'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{item.category}</p>
                            </>
                          )}
                        </div>

                        {editingIndex !== index && (
                          <div className="text-right flex-shrink-0">
                            <p className={`text-base font-bold ${
                              item.type === 'income'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-gray-900 dark:text-white'
                            }`}>
                              {item.type === 'income' ? '+' : ''}{currency.symbol}{item.amount.toLocaleString()}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingIndex(index)
                              }}
                              className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-1"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer Actions */}
          {!processing && items.length > 0 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <button
                onClick={handleConfirm}
                disabled={importing || selectedItems.size === 0}
                className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 text-white py-4 px-6 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {importing ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Check size={20} />
                )}
                {importing ? 'Adding...' : `Add ${selectedItems.size} Item${selectedItems.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Desktop/Tablet layout (centered modal)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
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
                            {/* Type Toggle */}
                            <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-500">
                              <button
                                type="button"
                                onClick={() => updateItem(index, { type: 'expense' })}
                                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium transition-all ${
                                  item.type === 'expense'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <ArrowDownCircle size={12} />
                                Expense
                              </button>
                              <button
                                type="button"
                                onClick={() => updateItem(index, { type: 'income' })}
                                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium transition-all ${
                                  item.type === 'income'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <ArrowUpCircle size={12} />
                                Income
                              </button>
                            </div>
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
                                {item.type === 'expense' ? (
                                  EXPENSE_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))
                                ) : (
                                  INCOME_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))
                                )}
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
                            {/* Prominent Type Toggle */}
                            <button
                              onClick={() => toggleItemType(index)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-all mb-2 ${
                                item.type === 'income'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-900/50'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-900/50'
                              }`}
                              title="Click to toggle income/expense"
                            >
                              {item.type === 'income' ? (
                                <ArrowUpCircle size={16} />
                              ) : (
                                <ArrowDownCircle size={16} />
                              )}
                              <span>{item.type === 'income' ? 'Income' : 'Expense'}</span>
                              <span className="text-xs opacity-60">(click to change)</span>
                            </button>
                            <div className="flex items-center gap-2">
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
