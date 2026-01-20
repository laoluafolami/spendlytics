import { useState, useRef } from 'react'
import { Upload, Check, X, Loader2, AlertCircle, Trash2, Edit2, Save, ArrowUpCircle, ArrowDownCircle, CheckSquare, Square } from 'lucide-react'
import { parseBankStatement, ParsedTransaction, BankStatementResult } from '../utils/bankStatementParser'
import { EXPENSE_CATEGORIES } from '../types/expense'
import { useCurrency } from '../contexts/CurrencyContext'

interface BulkImportProps {
  onImport: (transactions: Array<{
    amount: string
    category: string
    description: string
    date: string
    type: 'expense' | 'income'
  }>) => Promise<void>
}

const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Investment', 'Business', 'Transfer In', 'Refund', 'Gift', 'Other Income']

export default function BulkImport({ onImport }: BulkImportProps) {
  const { formatAmount } = useCurrency()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ status: '', percent: 0 })
  const [result, setResult] = useState<BankStatementResult | null>(null)
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file')
      return
    }

    setIsProcessing(true)
    setError(null)
    setResult(null)
    setTransactions([])

    try {
      const parseResult = await parseBankStatement(file, (status, percent) => {
        setProgress({ status, percent })
      })

      if (parseResult.success) {
        setResult(parseResult)
        setTransactions(parseResult.transactions)
        // Select all by default
        setSelectedIds(new Set(parseResult.transactions.map(t => t.id)))
      } else {
        setError(parseResult.error || 'Failed to parse bank statement')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file')
    } finally {
      setIsProcessing(false)
      e.target.value = ''
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    setSelectedIds(new Set(transactions.map(t => t.id)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const updateTransaction = (id: string, updates: Partial<ParsedTransaction>) => {
    setTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, ...updates } : t)
    )
  }

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id))
    const newSelected = new Set(selectedIds)
    newSelected.delete(id)
    setSelectedIds(newSelected)
  }

  const toggleType = (id: string) => {
    const transaction = transactions.find(t => t.id === id)
    if (transaction) {
      const newType = transaction.type === 'expense' ? 'income' : 'expense'
      const defaultCategory = newType === 'expense' ? 'Other' : 'Other Income'
      updateTransaction(id, { type: newType, category: defaultCategory })
    }
  }

  const handleImport = async () => {
    const selectedTransactions = transactions.filter(t => selectedIds.has(t.id))

    if (selectedTransactions.length === 0) {
      setError('Please select at least one transaction to import')
      return
    }

    setImporting(true)
    setError(null)

    try {
      const toImport = selectedTransactions.map(t => ({
        amount: t.amount.toString(),
        category: t.category,
        description: t.description,
        date: t.date,
        type: t.type
      }))

      await onImport(toImport)

      // Clear state after successful import
      setResult(null)
      setTransactions([])
      setSelectedIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import transactions')
    } finally {
      setImporting(false)
    }
  }

  const expenseCount = transactions.filter(t => t.type === 'expense' && selectedIds.has(t.id)).length
  const incomeCount = transactions.filter(t => t.type === 'income' && selectedIds.has(t.id)).length
  const totalExpenses = transactions
    .filter(t => t.type === 'expense' && selectedIds.has(t.id))
    .reduce((sum, t) => sum + t.amount, 0)
  const totalIncome = transactions
    .filter(t => t.type === 'income' && selectedIds.has(t.id))
    .reduce((sum, t) => sum + t.amount, 0)

  // Upload screen
  if (!result && transactions.length === 0) {
    return (
      <div className="group relative animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent mb-2">
            Import Bank Statement
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Upload your bank statement PDF to automatically import and categorize all transactions
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
            </div>
          )}

          {isProcessing ? (
            <div className="p-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={32} />
                <span className="text-lg text-indigo-700 dark:text-indigo-300 font-medium">
                  {progress.status}
                </span>
              </div>
              <div className="w-full bg-indigo-200 dark:bg-indigo-800 rounded-full h-3">
                <div
                  className="bg-indigo-600 dark:bg-indigo-400 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white py-12 px-4 rounded-xl font-semibold shadow-lg transition-all flex flex-col items-center justify-center gap-4 border-2 border-dashed border-indigo-300 dark:border-indigo-700"
              >
                <Upload size={56} />
                <span className="text-xl">Upload Bank Statement PDF</span>
                <span className="text-sm opacity-80">Supports Nigerian banks: GTBank, Access, FirstBank, UBA, Zenith, and more</span>
              </button>
            </>
          )}

          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">HOW IT WORKS</p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>1. Upload your bank statement PDF</li>
              <li>2. We extract all transactions automatically</li>
              <li>3. AI categorizes each expense/income</li>
              <li>4. Review and edit categories if needed</li>
              <li>5. Import selected transactions with one click</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // Review and import screen
  return (
    <div className="group relative animate-fade-in">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
      <div className="relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
              Review Transactions
            </h2>
            {result?.bankName && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {result.bankName} {result.accountNumber && `• ****${result.accountNumber.slice(-4)}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setResult(null); setTransactions([]); setSelectedIds(new Set()) }}
              className="px-3 py-2 bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Upload New
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-white/50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Found</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{transactions.length}</p>
          </div>
          <div className="p-3 bg-white/50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-xs text-gray-500 dark:text-gray-400">Selected</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedIds.size}</p>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <p className="text-xs text-red-600 dark:text-red-400">Expenses ({expenseCount})</p>
            <p className="text-lg font-bold text-red-700 dark:text-red-300">{formatAmount(totalExpenses)}</p>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <p className="text-xs text-green-600 dark:text-green-400">Income ({incomeCount})</p>
            <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatAmount(totalIncome)}</p>
          </div>
        </div>

        {/* Selection controls */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={selectAll}
            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Deselect All
          </button>
        </div>

        {/* Transactions list */}
        <div className="max-h-96 overflow-y-auto space-y-2 mb-4">
          {transactions.map((t) => (
            <div
              key={t.id}
              className={`p-3 rounded-xl border transition-all ${
                selectedIds.has(t.id)
                  ? 'bg-white/80 dark:bg-gray-700/80 border-green-300 dark:border-green-700'
                  : 'bg-white/40 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleSelect(t.id)}
                  className="mt-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                >
                  {selectedIds.has(t.id) ? <CheckSquare size={20} className="text-green-600 dark:text-green-400" /> : <Square size={20} />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t.date}</span>
                    <button
                      onClick={() => toggleType(t.id)}
                      className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                        t.type === 'expense'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      }`}
                    >
                      {t.type === 'expense' ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
                      {t.type}
                    </button>
                    {t.confidence < 70 && (
                      <span className="text-xs text-yellow-600 dark:text-yellow-400">Low confidence</span>
                    )}
                  </div>

                  {editingId === t.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={t.description}
                        onChange={(e) => updateTransaction(t.id, { description: e.target.value })}
                        className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded"
                      />
                      <div className="flex gap-2">
                        <select
                          value={t.category}
                          onChange={(e) => updateTransaction(t.id, { category: e.target.value })}
                          className="flex-1 px-2 py-1 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded"
                        >
                          <optgroup label="Expense Categories">
                            {EXPENSE_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Income Categories">
                            {INCOME_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </optgroup>
                        </select>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-sm"
                        >
                          <Save size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t.category}</p>
                    </>
                  )}
                </div>

                <div className="text-right">
                  <p className={`font-bold ${t.type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {t.type === 'expense' ? '-' : '+'}{formatAmount(t.amount)}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={() => setEditingId(editingId === t.id ? null : t.id)}
                      className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => deleteTransaction(t.id)}
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

        {/* Import button */}
        <button
          onClick={handleImport}
          disabled={importing || selectedIds.size === 0}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-4 px-4 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {importing ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Check size={20} />
              Import {selectedIds.size} Transaction{selectedIds.size !== 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
