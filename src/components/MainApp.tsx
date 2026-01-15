import { useState, useEffect } from 'react'
import { Plus, BarChart3, List, Sun, Moon, TrendingUp, Settings as SettingsIcon, Target, DollarSign, Wallet, FileText, Upload, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Expense, ExpenseFormData } from '../types/expense'
import { useTheme } from '../contexts/ThemeContext'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import ExpenseForm from './ExpenseForm'
import ExpenseList from './ExpenseList'
import Dashboard from './Dashboard'
import Analytics from './Analytics'
import Settings from './Settings'
import IncomeManager from './IncomeManager'
import BudgetManager from './BudgetManager'
import SavingsGoals from './SavingsGoals'
import Reports from './Reports'
import ImportExport from './ImportExport'

type View = 'dashboard' | 'list' | 'add' | 'analytics' | 'settings' | 'income' | 'budgets' | 'savings' | 'reports' | 'import'

export default function MainApp() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('dashboard')
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { settings } = useSettings()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    loadExpenses()
  }, [user])

  const loadExpenses = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
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
    if (!user) return

    try {
      const { error } = await supabase
        .from('expenses')
        .insert([{
          user_id: user.id,
          amount: parseFloat(formData.amount),
          category: formData.category,
          description: formData.description,
          date: formData.date,
          payment_method: formData.payment_method,
          tags: formData.tags || [],
          receipt_url: formData.receipt_url,
          is_recurring: formData.is_recurring || false,
          recurrence_frequency: formData.recurrence_frequency,
          recurrence_end_date: formData.recurrence_end_date || null,
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
    if (!editingExpense || !user) return

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          amount: parseFloat(formData.amount),
          category: formData.category,
          description: formData.description,
          date: formData.date,
          payment_method: formData.payment_method,
          tags: formData.tags || [],
          receipt_url: formData.receipt_url,
          is_recurring: formData.is_recurring || false,
          recurrence_frequency: formData.recurrence_frequency,
          recurrence_end_date: formData.recurrence_end_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingExpense.id)
        .eq('user_id', user.id)

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
    if (!user) return

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

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

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Error signing out:', error)
    }
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

  const menuItems = [
    { view: 'dashboard' as View, icon: BarChart3, label: 'Dashboard', color: 'text-blue-500', bgGradient: 'from-blue-500/10 to-blue-600/10' },
    { view: 'list' as View, icon: List, label: 'All Expenses', color: 'text-emerald-500', bgGradient: 'from-emerald-500/10 to-emerald-600/10' },
    { view: 'add' as View, icon: Plus, label: 'Add Expense', color: 'text-violet-500', bgGradient: 'from-violet-500/10 to-violet-600/10' },
    { view: 'analytics' as View, icon: TrendingUp, label: 'Analytics', color: 'text-orange-500', bgGradient: 'from-orange-500/10 to-orange-600/10' },
    ...(settings.feature_income ? [{ view: 'income' as View, icon: DollarSign, label: 'Income', color: 'text-green-500', bgGradient: 'from-green-500/10 to-green-600/10' }] : []),
    ...(settings.feature_budgets ? [{ view: 'budgets' as View, icon: Wallet, label: 'Budgets', color: 'text-amber-500', bgGradient: 'from-amber-500/10 to-amber-600/10' }] : []),
    ...(settings.feature_savings_goals ? [{ view: 'savings' as View, icon: Target, label: 'Savings', color: 'text-pink-500', bgGradient: 'from-pink-500/10 to-pink-600/10' }] : []),
    ...(settings.feature_reports ? [{ view: 'reports' as View, icon: FileText, label: 'Reports', color: 'text-cyan-500', bgGradient: 'from-cyan-500/10 to-cyan-600/10' }] : []),
    ...((settings.feature_import_csv || settings.feature_export_excel) ? [{ view: 'import' as View, icon: Upload, label: 'Import/Export', color: 'text-teal-500', bgGradient: 'from-teal-500/10 to-teal-600/10' }] : []),
    { view: 'settings' as View, icon: SettingsIcon, label: 'Settings', color: 'text-gray-500', bgGradient: 'from-gray-500/10 to-gray-600/10' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950 transition-colors duration-500">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-3xl"></div>
      </div>

      <header className="relative z-20 backdrop-blur-md bg-white/30 dark:bg-gray-900/30 border-b border-white/20 dark:border-gray-700/50 safe-top">
        <div className="px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-white/30 dark:border-gray-700/50 text-blue-600 dark:text-blue-400 transform hover:scale-110 transition-all duration-300 backdrop-blur-sm shadow-lg touch-target"
                title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              >
                {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
              </button>
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                Expense Tracker
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-white/50 dark:bg-gray-800/50 border border-white/20 dark:border-gray-700/50 rounded-xl backdrop-blur-sm">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[150px] truncate">
                  {user?.email}
                </span>
              </div>
              <button
                onClick={toggleTheme}
                className="p-2 sm:p-2.5 rounded-xl bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-800/80 border border-white/20 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 transform hover:scale-110 transition-all duration-300 backdrop-blur-sm touch-target"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl font-medium transform hover:scale-105 transition-all duration-300 shadow-lg touch-target"
              >
                <LogOut size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden sm:inline text-sm">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-30 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed left-0 top-[73px] h-[calc(100vh-73px)] z-40 backdrop-blur-md bg-gradient-to-b from-white/40 via-white/30 to-white/20 dark:from-gray-900/40 dark:via-gray-900/30 dark:to-gray-900/20 border-r border-white/30 dark:border-gray-700/50 transition-all duration-300 ease-in-out shadow-2xl ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 w-64 lg:w-64`}
        >
          <div className="relative h-full">
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden absolute top-4 right-4 p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-white/30 dark:border-gray-700/50 text-blue-600 dark:text-blue-400 transform hover:scale-110 transition-all duration-300 backdrop-blur-sm shadow-lg z-20"
              title="Close sidebar"
            >
              <ChevronLeft size={18} />
            </button>

            <nav className="p-4 space-y-2 h-full overflow-y-auto pt-16 lg:pt-4">
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = view === item.view
                const button = (
                  <button
                    key={item.view}
                    onClick={() => {
                      if (item.view === 'add') {
                        setEditingExpense(null)
                      }
                      setView(item.view)
                      if (window.innerWidth < 1024) {
                        setSidebarOpen(false)
                      }
                    }}
                    className={`group w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg transform scale-105'
                        : `bg-gradient-to-br ${item.bgGradient} hover:bg-white/50 dark:hover:bg-gray-800/50 hover:scale-105 border border-transparent hover:border-white/40 dark:hover:border-gray-700/50`
                    }`}
                  >
                    <div className={`transform transition-all duration-300 group-hover:rotate-12 group-hover:scale-110 ${
                      isActive ? 'text-white' : item.color
                    }`}>
                      <Icon size={22} strokeWidth={2.5} />
                    </div>
                    <span className={`whitespace-nowrap font-semibold ${
                      isActive ? 'text-white' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {item.label}
                    </span>
                  </button>
                )

                return button
              })}
            </nav>
          </div>
        </aside>

        <main
          className="flex-1 relative z-10 px-3 sm:px-6 lg:px-8 py-6 sm:py-8 transition-all duration-300 lg:ml-64"
        >
          <div className="max-w-7xl mx-auto mobile-scroll">
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
                    date: editingExpense.date,
                    payment_method: editingExpense.payment_method,
                    tags: editingExpense.tags,
                    receipt_url: editingExpense.receipt_url,
                    is_recurring: editingExpense.is_recurring,
                    recurrence_frequency: editingExpense.recurrence_frequency,
                    recurrence_end_date: editingExpense.recurrence_end_date
                  } : undefined}
                />
              </div>
            )}

            {view === 'analytics' && <Analytics expenses={expenses} />}

            {view === 'income' && <IncomeManager />}

            {view === 'budgets' && <BudgetManager expenses={expenses} />}

            {view === 'savings' && <SavingsGoals />}

            {view === 'reports' && <Reports expenses={expenses} />}

            {view === 'import' && <ImportExport expenses={expenses} onImportComplete={loadExpenses} />}

            {view === 'settings' && <Settings />}
          </div>
        </main>
      </div>
    </div>
  )
}
