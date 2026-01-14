import { useState, useEffect } from 'react'
import { Download, Plus, BarChart3, List, Sun, Moon, TrendingUp, Settings as SettingsIcon } from 'lucide-react'
import { supabase } from './lib/supabase'
import { Expense, ExpenseFormData } from './types/expense'
import { useTheme } from './contexts/ThemeContext'
import IntroPage from './components/IntroPage'
import ExpenseForm from './components/ExpenseForm'
import ExpenseList from './components/ExpenseList'
import Dashboard from './components/Dashboard'
import Analytics from './components/Analytics'
import Settings from './components/Settings'
import { exportExpensesToPDF } from './utils/exportPDF'

type View = 'intro' | 'dashboard' | 'list' | 'add' | 'analytics' | 'settings'

function App() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('intro')
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    loadExpenses()
  }, [])

  const loadExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error
      setExpenses(data || [])
    } catch (error) {
      console.error('Error loading expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddExpense = async (formData: ExpenseFormData) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .insert([{
          amount: parseFloat(formData.amount),
          category: formData.category,
          description: formData.description,
          date: formData.date
        }])

      if (error) throw error
      await loadExpenses()
      setView('list')
    } catch (error) {
      console.error('Error adding expense:', error)
      alert('Failed to add expense. Please try again.')
    }
  }

  const handleUpdateExpense = async (formData: ExpenseFormData) => {
    if (!editingExpense) return

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          amount: parseFloat(formData.amount),
          category: formData.category,
          description: formData.description,
          date: formData.date,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingExpense.id)

      if (error) throw error
      await loadExpenses()
      setEditingExpense(null)
      setView('list')
    } catch (error) {
      console.error('Error updating expense:', error)
      alert('Failed to update expense. Please try again.')
    }
  }

  const handleDeleteExpense = async (id: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

      if (error) throw error
      await loadExpenses()
    } catch (error) {
      console.error('Error deleting expense:', error)
      alert('Failed to delete expense. Please try again.')
    }
  }

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense)
    setView('add')
  }

  const handleCancelEdit = () => {
    setEditingExpense(null)
    setView('list')
  }

  const handleExportPDF = () => {
    if (expenses.length === 0) {
      alert('No expenses to export')
      return
    }
    exportExpensesToPDF(expenses)
  }

  const handleGetStarted = () => {
    setView('dashboard')
  }

  if (view === 'intro') {
    return <IntroPage onGetStarted={handleGetStarted} />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950 transition-colors duration-500 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto"></div>
          <p className="mt-6 text-gray-600 dark:text-gray-400 font-medium">Loading expenses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950 transition-colors duration-500">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-3xl"></div>
      </div>

      <header className="relative z-10 backdrop-blur-md bg-white/30 dark:bg-gray-900/30 border-b border-white/20 dark:border-gray-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              Expense Tracker
            </h1>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-800/80 border border-white/20 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 transform hover:scale-110 transition-all duration-300 backdrop-blur-sm"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-medium transform hover:scale-105 transition-all duration-300 shadow-lg"
              >
                <Download size={18} />
                Export PDF
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="relative z-10 backdrop-blur-md bg-white/30 dark:bg-gray-900/30 border-b border-white/20 dark:border-gray-700/50 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setView('dashboard')}
              className={`flex items-center gap-2 px-4 py-4 border-b-2 font-semibold transition-all duration-300 ${
                view === 'dashboard'
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <BarChart3 size={18} />
              Dashboard
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-2 px-4 py-4 border-b-2 font-semibold transition-all duration-300 ${
                view === 'list'
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <List size={18} />
              All Expenses
            </button>
            <button
              onClick={() => {
                setEditingExpense(null)
                setView('add')
              }}
              className={`flex items-center gap-2 px-4 py-4 border-b-2 font-semibold transition-all duration-300 ${
                view === 'add'
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Plus size={18} />
              Add Expense
            </button>
            <button
              onClick={() => setView('analytics')}
              className={`flex items-center gap-2 px-4 py-4 border-b-2 font-semibold transition-all duration-300 ${
                view === 'analytics'
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <TrendingUp size={18} />
              Analytics
            </button>
            <button
              onClick={() => setView('settings')}
              className={`flex items-center gap-2 px-4 py-4 border-b-2 font-semibold transition-all duration-300 ${
                view === 'settings'
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <SettingsIcon size={18} />
              Settings
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'dashboard' && <Dashboard expenses={expenses} />}

        {view === 'list' && (
          <ExpenseList
            expenses={expenses}
            onDelete={handleDeleteExpense}
            onEdit={handleEditExpense}
          />
        )}

        {view === 'add' && (
          <div className="max-w-2xl mx-auto">
            <ExpenseForm
              onSubmit={editingExpense ? handleUpdateExpense : handleAddExpense}
              onCancel={editingExpense ? handleCancelEdit : undefined}
              initialData={editingExpense ? {
                amount: editingExpense.amount.toString(),
                category: editingExpense.category,
                description: editingExpense.description,
                date: editingExpense.date
              } : undefined}
            />
          </div>
        )}

        {view === 'analytics' && <Analytics expenses={expenses} />}

        {view === 'settings' && <Settings />}
      </main>
    </div>
  )
}

export default App
