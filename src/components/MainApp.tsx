import { useState, useEffect, useRef } from 'react'
import { Plus, BarChart3, Sun, Moon, TrendingUp, Settings as SettingsIcon, Target, DollarSign, Wallet, FileText, Upload, LogOut, Scan, FileUp, ArrowLeftRight, ArrowDownCircle, PiggyBank, CreditCard, LineChart, Briefcase, PieChart, Menu, X, Home } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Expense, ExpenseFormData } from '../types/expense'
import { useTheme } from '../contexts/ThemeContext'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ExpenseForm from './ExpenseForm'
import ExpenseList from './ExpenseList'
import FinancialDashboard from './FinancialDashboard'
import AllTransactions from './AllTransactions'
import Analytics from './Analytics'
import Settings from './Settings'
import IncomeManager from './IncomeManager'
import BudgetManager from './BudgetManager'
import SavingsGoals from './SavingsGoals'
import Reports from './Reports'
import ImportExport from './ImportExport'
import SmartCapture from './SmartCapture'
import BulkImport from './BulkImport'
import SharePreview from './SharePreview'
import AssetsManager from './AssetsManager'
import LiabilitiesManager from './LiabilitiesManager'
import NetWorth from './NetWorth'
import InvestmentsManager from './InvestmentsManager'
import IncomeAllocation from './IncomeAllocation'
import MigrationStatus from './MigrationStatus'
import BackupRestore from './BackupRestore'
import { SharedData, getSharedData, clearSharedData } from '../utils/shareService'

type View = 'dashboard' | 'transactions' | 'expenses' | 'add' | 'capture' | 'bulk-import' | 'analytics' | 'settings' | 'income' | 'budgets' | 'savings' | 'reports' | 'import' | 'assets' | 'liabilities' | 'net-worth' | 'investments' | 'allocation' | 'backup'

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
  const [searchParams, setSearchParams] = useSearchParams()

  // Touch handling for swipe gesture
  const touchStartX = useRef<number>(0)
  const touchEndX = useRef<number>(0)

  // Share handling state
  const [sharedData, setSharedData] = useState<SharedData | null>(null)
  const [showSharePreview, setShowSharePreview] = useState(false)

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

  // Swipe gesture handling for mobile
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX
    }

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX.current = e.changedTouches[0].clientX
      const swipeDistance = touchEndX.current - touchStartX.current
      const minSwipeDistance = 50

      // Swipe right to open sidebar (only from left edge)
      if (swipeDistance > minSwipeDistance && touchStartX.current < 50) {
        setSidebarOpen(true)
      }
      // Swipe left to close sidebar
      if (swipeDistance < -minSwipeDistance && sidebarOpen) {
        setSidebarOpen(false)
      }
    }

    document.addEventListener('touchstart', handleTouchStart)
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [sidebarOpen])

  useEffect(() => {
    loadExpenses()
  }, [user])

  // Check for view parameter from URL
  useEffect(() => {
    const viewParam = searchParams.get('view')
    if (viewParam && ['backup', 'settings', 'capture', 'add', 'transactions', 'analytics', 'income', 'budgets', 'savings', 'reports', 'import', 'assets', 'liabilities', 'net-worth', 'investments', 'allocation'].includes(viewParam)) {
      setView(viewParam as View)
      // Clear the view param from URL
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('view')
      setSearchParams(newParams)
    }
  }, [searchParams, setSearchParams])

  // Check for shared content when app loads
  useEffect(() => {
    const checkForSharedContent = async () => {
      // Check if we were opened via share
      const isShared = searchParams.get('shared') === 'true'
      const hasShareError = searchParams.get('share_error') === 'true'

      if (hasShareError) {
        console.error('Share error occurred')
        // Clear the error param
        setSearchParams({})
        return
      }

      if (isShared) {
        try {
          const data = await getSharedData()
          if (data && (data.text || data.files.length > 0)) {
            setSharedData(data)
            setShowSharePreview(true)
          }
        } catch (error) {
          console.error('Failed to get shared data:', error)
        }
        // Clear the shared param
        setSearchParams({})
      }
    }

    checkForSharedContent()
  }, [searchParams, setSearchParams])

  // Handle share preview close
  const handleSharePreviewClose = async () => {
    setShowSharePreview(false)
    setSharedData(null)
    await clearSharedData()
  }

  // Handle shared items confirm
  const handleSharedItemsConfirm = async (items: Array<{
    amount: string
    category: string
    description: string
    date: string
    type: 'expense' | 'income'
  }>) => {
    let expenseCount = 0
    let incomeCount = 0

    for (const item of items) {
      if (item.type === 'income') {
        await handleAddIncome({
          amount: item.amount,
          category: item.category,
          description: item.description,
          date: item.date,
        })
        incomeCount++
      } else {
        await handleAddExpense({
          amount: item.amount,
          category: item.category,
          description: item.description,
          date: item.date,
          payment_method: 'Cash',
          tags: [],
          receipt_url: '',
          is_recurring: false,
          recurrence_frequency: '',
          recurrence_end_date: ''
        })
        expenseCount++
      }
    }

    console.log(`Shared items: Added ${expenseCount} expenses and ${incomeCount} income`)

    setShowSharePreview(false)
    setSharedData(null)
    await loadExpenses()

    // Navigate to appropriate view
    if (incomeCount > 0 && expenseCount === 0) {
      setView('income')
    } else {
      setView('transactions')
    }
  }

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
      setView('expenses')
    } catch (error) {
      console.error('Error adding expense:', error)
      alert('Failed to add expense. Please try again.')
    }
  }

  // Add income to the app_income table
  const handleAddIncome = async (data: { amount: string; category: string; description: string; date: string }) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('app_income')
        .insert([{
          user_id: user.id,
          amount: parseFloat(data.amount),
          category: data.category,
          description: data.description,
          date: data.date,
        }])

      if (error) throw error
    } catch (error) {
      console.error('Error adding income:', error)
      throw error
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
      setView('expenses')
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
    setView('expenses')
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Navigation handler for dashboard clicks
  const handleNavigate = (targetView: string) => {
    setView(targetView as View)
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950 transition-colors duration-500 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto"></div>
          <p className="mt-6 text-gray-600 dark:text-gray-400 font-medium">Loading your finances...</p>
        </div>
      </div>
    )
  }

  // Reorganized menu structure - Income Statement / Balance Sheet focused
  const menuItems = [
    { view: 'dashboard' as View, icon: BarChart3, label: 'Dashboard', color: 'text-blue-500', bgGradient: 'from-blue-500/10 to-blue-600/10', section: 'main' },
    { view: 'transactions' as View, icon: ArrowLeftRight, label: 'All Transactions', color: 'text-purple-500', bgGradient: 'from-purple-500/10 to-purple-600/10', section: 'main' },
    { view: 'expenses' as View, icon: ArrowDownCircle, label: 'Expenses', color: 'text-red-500', bgGradient: 'from-red-500/10 to-red-600/10', section: 'main' },
    ...(settings.feature_income ? [{ view: 'income' as View, icon: DollarSign, label: 'Income', color: 'text-green-500', bgGradient: 'from-green-500/10 to-green-600/10', section: 'main' }] : []),
    { view: 'allocation' as View, icon: PieChart, label: 'Income Allocation', color: 'text-cyan-500', bgGradient: 'from-cyan-500/10 to-cyan-600/10', section: 'main' },
    // Balance Sheet / Net Worth section
    { view: 'net-worth' as View, icon: LineChart, label: 'Net Worth', color: 'text-emerald-500', bgGradient: 'from-emerald-500/10 to-emerald-600/10', section: 'balance' },
    { view: 'assets' as View, icon: PiggyBank, label: 'Assets', color: 'text-green-500', bgGradient: 'from-green-500/10 to-green-600/10', section: 'balance' },
    { view: 'liabilities' as View, icon: CreditCard, label: 'Liabilities', color: 'text-red-500', bgGradient: 'from-red-500/10 to-red-600/10', section: 'balance' },
    { view: 'investments' as View, icon: Briefcase, label: 'Investments', color: 'text-blue-500', bgGradient: 'from-blue-500/10 to-blue-600/10', section: 'balance' },
    // Data entry
    { view: 'capture' as View, icon: Scan, label: 'Smart Capture', color: 'text-rose-500', bgGradient: 'from-rose-500/10 to-pink-600/10', section: 'capture' },
    { view: 'bulk-import' as View, icon: FileUp, label: 'Bank Statement', color: 'text-indigo-500', bgGradient: 'from-indigo-500/10 to-purple-600/10', section: 'capture' },
    { view: 'add' as View, icon: Plus, label: 'Manual Entry', color: 'text-violet-500', bgGradient: 'from-violet-500/10 to-violet-600/10', section: 'capture' },
    { view: 'analytics' as View, icon: TrendingUp, label: 'Analytics', color: 'text-orange-500', bgGradient: 'from-orange-500/10 to-orange-600/10', section: 'insights' },
    ...(settings.feature_budgets ? [{ view: 'budgets' as View, icon: Wallet, label: 'Budgets', color: 'text-amber-500', bgGradient: 'from-amber-500/10 to-amber-600/10', section: 'planning' }] : []),
    ...(settings.feature_savings_goals ? [{ view: 'savings' as View, icon: Target, label: 'Savings Goals', color: 'text-teal-500', bgGradient: 'from-teal-500/10 to-teal-600/10', section: 'planning' }] : []),
    ...(settings.feature_reports ? [{ view: 'reports' as View, icon: FileText, label: 'Reports', color: 'text-cyan-500', bgGradient: 'from-cyan-500/10 to-cyan-600/10', section: 'insights' }] : []),
    ...((settings.feature_import_csv || settings.feature_export_excel) ? [{ view: 'import' as View, icon: Upload, label: 'Import/Export', color: 'text-gray-500', bgGradient: 'from-gray-500/10 to-gray-600/10', section: 'tools' }] : []),
    { view: 'settings' as View, icon: SettingsIcon, label: 'Settings', color: 'text-gray-500', bgGradient: 'from-gray-500/10 to-gray-600/10', section: 'tools' },
  ]

  // Group menu items by section
  const sections = {
    main: { label: 'Income Statement', items: menuItems.filter(i => i.section === 'main') },
    balance: { label: 'Balance Sheet', items: menuItems.filter(i => i.section === 'balance') },
    capture: { label: 'Add Data', items: menuItems.filter(i => i.section === 'capture') },
    planning: { label: 'Planning', items: menuItems.filter(i => i.section === 'planning') },
    insights: { label: 'Insights', items: menuItems.filter(i => i.section === 'insights') },
    tools: { label: 'Tools', items: menuItems.filter(i => i.section === 'tools') },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-950 transition-colors duration-500">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Mobile-first Header */}
      <header className="relative z-20 backdrop-blur-md bg-white/30 dark:bg-gray-900/30 border-b border-white/20 dark:border-gray-700/50 safe-top">
        <div className="px-3 sm:px-6 lg:px-8 py-2 sm:py-3">
          <div className="flex justify-between items-center">
            {/* Left: Menu button + Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Hamburger menu for mobile */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-white/30 dark:border-gray-700/50 text-blue-600 dark:text-blue-400 transition-all duration-300 backdrop-blur-sm shadow-lg active:scale-95"
                aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <h1 className="text-base sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                WealthPulse
              </h1>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* User avatar - visible on all screens */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 bg-white/50 dark:bg-gray-800/50 border border-white/20 dark:border-gray-700/50 rounded-xl backdrop-blur-sm">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[100px] lg:max-w-[150px] truncate">
                  {user?.email}
                </span>
              </div>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-800/80 border border-white/20 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 transition-all duration-300 backdrop-blur-sm active:scale-95"
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>

              {/* Sign out - icon only on mobile */}
              <button
                onClick={handleSignOut}
                className="p-2 sm:px-3 sm:py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl font-medium transition-all duration-300 shadow-lg active:scale-95"
                aria-label="Sign out"
              >
                <LogOut size={18} className="sm:hidden" />
                <span className="hidden sm:flex items-center gap-1.5 text-sm">
                  <LogOut size={16} />
                  Sign Out
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 dark:bg-black/50 z-30 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - slides in from left on mobile */}
        <aside
          className={`fixed left-0 top-0 h-full z-40 backdrop-blur-xl bg-white/90 dark:bg-gray-900/95 border-r border-white/30 dark:border-gray-700/50 transition-transform duration-300 ease-out shadow-2xl ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 lg:top-[57px] lg:h-[calc(100vh-57px)] w-72 sm:w-72 lg:w-64`}
        >
          <div className="relative h-full flex flex-col">
            {/* Mobile sidebar header */}
            <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white">Menu</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 active:scale-95 transition-transform"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-3 overflow-y-auto overscroll-contain">
              {Object.entries(sections).map(([key, section]) => (
                section.items.length > 0 && (
                  <div key={key}>
                    <p className="px-3 py-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {section.label}
                    </p>
                    <div className="space-y-1 mt-1">
                      {section.items.map((item) => {
                        const Icon = item.icon
                        const isActive = view === item.view
                        return (
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
                            className={`group w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all duration-200 active:scale-[0.98] ${
                              isActive
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                : `bg-gradient-to-br ${item.bgGradient} hover:bg-white/80 dark:hover:bg-gray-800/80 border border-transparent hover:border-white/40 dark:hover:border-gray-700/50`
                            }`}
                          >
                            <div className={`transition-colors duration-200 ${
                              isActive ? 'text-white' : item.color
                            }`}>
                              <Icon size={22} strokeWidth={2} />
                            </div>
                            <span className={`whitespace-nowrap font-semibold text-sm ${
                              isActive ? 'text-white' : 'text-gray-700 dark:text-gray-300'
                            }`}>
                              {item.label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              ))}
            </nav>
          </div>
        </aside>

        <main
          className="flex-1 relative z-10 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 lg:pb-8 transition-all duration-300 lg:ml-64"
        >
          <div className="max-w-7xl mx-auto mobile-scroll">
            {view === 'dashboard' && (
              <FinancialDashboard
                expenses={expenses}
                onNavigate={handleNavigate}
              />
            )}

            {view === 'transactions' && (
              <AllTransactions onNavigate={handleNavigate} />
            )}

            {view === 'expenses' && (
              <ExpenseList
                expenses={expenses}
                onDelete={handleDeleteExpense}
                onEdit={handleEditExpense}
              />
            )}

            {view === 'capture' && (
              <div className="max-w-2xl mx-auto">
                <SmartCapture
                  onExpenseAdd={async (data) => {
                    await handleAddExpense({
                      ...data,
                      payment_method: 'Cash',
                      tags: [],
                      receipt_url: '',
                      is_recurring: false,
                      recurrence_frequency: '',
                      recurrence_end_date: ''
                    })
                  }}
                />
              </div>
            )}

            {view === 'bulk-import' && (
              <div className="max-w-3xl mx-auto">
                <BulkImport
                  onImport={async (transactions) => {
                    // Import transactions based on type (income vs expense)
                    let expenseCount = 0
                    let incomeCount = 0

                    for (const t of transactions) {
                      if (t.type === 'income') {
                        // Add to income table
                        await handleAddIncome({
                          amount: t.amount,
                          category: t.category,
                          description: t.description,
                          date: t.date,
                        })
                        incomeCount++
                      } else {
                        // Add to expenses table
                        await handleAddExpense({
                          amount: t.amount,
                          category: t.category,
                          description: t.description,
                          date: t.date,
                          payment_method: 'Bank Transfer',
                          tags: [],
                          receipt_url: '',
                          is_recurring: false,
                          recurrence_frequency: '',
                          recurrence_end_date: ''
                        })
                        expenseCount++
                      }
                    }

                    console.log(`Imported ${expenseCount} expenses and ${incomeCount} income transactions`)

                    // Reload expenses to reflect changes
                    await loadExpenses()

                    // Switch to appropriate view
                    if (incomeCount > 0 && expenseCount === 0) {
                      setView('income')
                    } else {
                      setView('transactions')
                    }
                  }}
                />
              </div>
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

            {view === 'assets' && <AssetsManager />}

            {view === 'liabilities' && <LiabilitiesManager />}

            {view === 'net-worth' && <NetWorth onNavigate={handleNavigate} />}

            {view === 'investments' && <InvestmentsManager />}

            {view === 'allocation' && <IncomeAllocation onNavigate={handleNavigate} />}

            {view === 'settings' && <Settings />}

            {view === 'backup' && <BackupRestore onClose={() => setView('settings')} />}
          </div>
        </main>
      </div>

      {/* Share Preview Modal */}
      {showSharePreview && sharedData && (
        <SharePreview
          sharedData={sharedData}
          onConfirm={handleSharedItemsConfirm}
          onClose={handleSharePreviewClose}
        />
      )}

      {/* Data Migration Status Toast */}
      <MigrationStatus />

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200 dark:border-gray-700 safe-bottom">
        <div className="flex items-center justify-around px-2 py-1">
          {/* Dashboard */}
          <button
            onClick={() => handleNavigate('dashboard')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200 min-w-[60px] ${
              view === 'dashboard'
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <Home size={22} strokeWidth={view === 'dashboard' ? 2.5 : 2} />
            <span className="text-[10px] font-medium mt-0.5">Home</span>
          </button>

          {/* Transactions */}
          <button
            onClick={() => handleNavigate('transactions')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200 min-w-[60px] ${
              view === 'transactions'
                ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <ArrowLeftRight size={22} strokeWidth={view === 'transactions' ? 2.5 : 2} />
            <span className="text-[10px] font-medium mt-0.5">Transactions</span>
          </button>

          {/* Add (Center - Prominent) */}
          <button
            onClick={() => {
              setEditingExpense(null)
              handleNavigate('capture')
            }}
            className="flex flex-col items-center justify-center -mt-4"
          >
            <div className={`p-3 rounded-full shadow-lg transition-all duration-200 active:scale-95 ${
              view === 'capture' || view === 'add' || view === 'bulk-import'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600'
                : 'bg-gradient-to-r from-blue-500 to-purple-500'
            }`}>
              <Plus size={26} className="text-white" strokeWidth={2.5} />
            </div>
            <span className={`text-[10px] font-medium mt-1 ${
              view === 'capture' || view === 'add' || view === 'bulk-import'
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}>Add</span>
          </button>

          {/* Analytics */}
          <button
            onClick={() => handleNavigate('analytics')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200 min-w-[60px] ${
              view === 'analytics'
                ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <TrendingUp size={22} strokeWidth={view === 'analytics' ? 2.5 : 2} />
            <span className="text-[10px] font-medium mt-0.5">Analytics</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => handleNavigate('settings')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200 min-w-[60px] ${
              view === 'settings'
                ? 'text-gray-800 dark:text-white bg-gray-100 dark:bg-gray-800'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <SettingsIcon size={22} strokeWidth={view === 'settings' ? 2.5 : 2} />
            <span className="text-[10px] font-medium mt-0.5">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
