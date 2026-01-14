import { useState } from 'react'
import { Upload, Download, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { Expense, EXPENSE_CATEGORIES } from '../types/expense'
import { supabase, sessionId } from '../lib/supabase'
import { format } from 'date-fns'
import { exportExpensesToPDF } from '../utils/exportPDF'
import { useCurrency } from '../contexts/CurrencyContext'

interface ImportExportProps {
  expenses: Expense[]
  onImportComplete: () => void
}

export default function ImportExport({ expenses, onImportComplete }: ImportExportProps) {
  const { currency } = useCurrency()
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<{
    success: boolean
    message: string
    details?: string
  } | null>(null)

  const handleExportCSV = () => {
    const headers = ['Date', 'Category', 'Amount', 'Description', 'Payment Method', 'Tags', 'Recurring']
    const rows = expenses.map(exp => [
      exp.date,
      exp.category,
      exp.amount,
      exp.description || '',
      exp.payment_method || '',
      (exp.tags || []).join(';'),
      exp.is_recurring ? 'Yes' : 'No'
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportExcel = () => {
    const data = expenses.map(exp => ({
      Date: exp.date,
      Category: exp.category,
      Amount: parseFloat(exp.amount.toString()),
      Description: exp.description || '',
      'Payment Method': exp.payment_method || '',
      Tags: (exp.tags || []).join(', '),
      Recurring: exp.is_recurring ? 'Yes' : 'No'
    }))

    const worksheet = [
      Object.keys(data[0] || {}),
      ...data.map(row => Object.values(row))
    ]

    const csv = worksheet.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportStatus(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())

      if (lines.length < 2) {
        setImportStatus({
          success: false,
          message: 'File is empty or invalid'
        })
        setImporting(false)
        return
      }

      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
      const dataLines = lines.slice(1)

      const expenses: any[] = []
      let skipped = 0

      for (const line of dataLines) {
        const values = line.split(',').map(v => v.replace(/"/g, '').trim())

        const dateIndex = headers.findIndex(h => h.includes('date'))
        const categoryIndex = headers.findIndex(h => h.includes('category'))
        const amountIndex = headers.findIndex(h => h.includes('amount'))
        const descriptionIndex = headers.findIndex(h => h.includes('description'))
        const paymentIndex = headers.findIndex(h => h.includes('payment'))

        if (dateIndex === -1 || categoryIndex === -1 || amountIndex === -1) {
          skipped++
          continue
        }

        const amount = parseFloat(values[amountIndex])
        if (isNaN(amount) || amount < 0) {
          skipped++
          continue
        }

        const category = values[categoryIndex]
        const validCategory = (EXPENSE_CATEGORIES.includes(category as any) ? category : 'Other') as typeof EXPENSE_CATEGORIES[number]

        expenses.push({
          date: values[dateIndex],
          category: validCategory,
          amount: amount,
          description: descriptionIndex !== -1 ? values[descriptionIndex] : '',
          payment_method: paymentIndex !== -1 ? values[paymentIndex] : 'Cash',
          session_id: sessionId
        })
      }

      if (expenses.length === 0) {
        setImportStatus({
          success: false,
          message: 'No valid expenses found in file',
          details: `${skipped} rows were skipped due to missing or invalid data`
        })
        setImporting(false)
        return
      }

      const { error } = await supabase
        .from('expenses')
        .insert(expenses)

      if (error) throw error

      setImportStatus({
        success: true,
        message: `Successfully imported ${expenses.length} expenses`,
        details: skipped > 0 ? `${skipped} rows were skipped` : undefined
      })

      onImportComplete()
    } catch (error) {
      console.error('Import error:', error)
      setImportStatus({
        success: false,
        message: 'Failed to import expenses',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
          Import & Export
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your expense data</p>
      </div>

      {importStatus && (
        <div className={`p-4 rounded-xl border ${
          importStatus.success
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
        }`}>
          <div className="flex items-start gap-3">
            {importStatus.success ? (
              <CheckCircle className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" size={20} />
            ) : (
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
            )}
            <div>
              <p className={`font-semibold ${
                importStatus.success
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-red-900 dark:text-red-100'
              }`}>
                {importStatus.message}
              </p>
              {importStatus.details && (
                <p className={`text-sm mt-1 ${
                  importStatus.success
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {importStatus.details}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Upload className="text-white" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Import Expenses</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Upload CSV file</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 font-semibold">Required CSV Format:</p>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Headers: Date, Category, Amount (required)</li>
                  <li>• Optional: Description, Payment Method, Tags</li>
                  <li>• Date format: YYYY-MM-DD</li>
                  <li>• Categories must match preset categories</li>
                </ul>
              </div>

              <label className="block">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportCSV}
                  disabled={importing}
                  className="hidden"
                  id="csv-upload"
                />
                <div className={`flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold cursor-pointer transition-all ${
                  importing
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transform hover:scale-105 shadow-lg'
                }`}>
                  <Upload size={20} />
                  {importing ? 'Importing...' : 'Choose CSV File'}
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-teal-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center">
                <Download className="text-white" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Export Expenses</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Download your data</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-green-50/50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-700/50">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                  <span className="font-bold">{expenses.length}</span> expenses ready to export
                </p>
              </div>

              <button
                onClick={handleExportCSV}
                disabled={expenses.length === 0}
                className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                  expenses.length === 0
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white transform hover:scale-105 shadow-lg'
                }`}
              >
                <FileText size={20} />
                Export as CSV
              </button>

              <button
                onClick={handleExportExcel}
                disabled={expenses.length === 0}
                className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                  expenses.length === 0
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transform hover:scale-105 shadow-lg'
                }`}
              >
                <FileText size={20} />
                Export as Excel
              </button>

              <button
                onClick={() => exportExpensesToPDF(expenses, currency.symbol)}
                disabled={expenses.length === 0}
                className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                  expenses.length === 0
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white transform hover:scale-105 shadow-lg'
                }`}
              >
                <FileText size={20} />
                Export as PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-orange-600 dark:text-orange-400 flex-shrink-0 mt-1" size={20} />
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Important Notes</h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Imported expenses will be added to your existing data</li>
                <li>• Invalid categories will be automatically changed to "Other"</li>
                <li>• Make sure date format is YYYY-MM-DD</li>
                <li>• Negative amounts or invalid numbers will be skipped</li>
                <li>• Exported files include all your expense data</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
