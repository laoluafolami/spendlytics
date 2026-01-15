import { useState, useEffect, useMemo } from 'react'
import { Plus, Target, Edit2, Trash2, X, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCurrency } from '../contexts/CurrencyContext'
import { Expense, EXPENSE_CATEGORIES } from '../types/expense'
import { useAuth } from '../contexts/AuthContext'

interface Budget {
  id: string
  category: string
  amount: number
  budget_month: number
  budget_year: number
  created_at?: string
}

interface BudgetManagerProps {
  expenses: Expense[]
}

export default function BudgetManager({ expenses }: BudgetManagerProps) {
  const { formatAmount } = useCurrency()
  const { user } = useAuth()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    budget_month: new Date().getMonth() + 1,
    budget_year: new Date().getFullYear()
  })

  useEffect(() => {
    loadBudgets()
  }, [])

  const loadBudgets = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('app_budgets')
        .select('*')
        .eq('user_id', user.id)
        .order('category', { ascending: true })

      if (error) throw error
      setBudgets(data || [])
    } catch (error) {
      console.error('Error loading budgets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const budgetData = {
        user_id: user.id,
        category: formData.category,
        amount: parseFloat(formData.amount),
        budget_month: formData.budget_month,
        budget_year: formData.budget_year
      }

      if (editingBudget) {
        const { error } = await supabase
          .from('app_budgets')
          .update(budgetData)
          .eq('id', editingBudget.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('app_budgets')
          .insert([budgetData])

        if (error) throw error
      }

      await loadBudgets()
      resetForm()
    } catch (error) {
      console.error('Error saving budget:', error)
      alert('Failed to save budget. Please try again.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) return

    try {
      const { error } = await supabase
        .from('app_budgets')
        .delete()
        .eq('id', id)

      if (error) throw error
      await loadBudgets()
    } catch (error) {
      console.error('Error deleting budget:', error)
      alert('Failed to delete budget. Please try again.')
    }
  }

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget)
    setFormData({
      category: budget.category,
      amount: budget.amount.toString(),
      budget_month: budget.budget_month,
      budget_year: budget.budget_year
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      category: '',
      amount: '',
      budget_month: new Date().getMonth() + 1,
      budget_year: new Date().getFullYear()
    })
    setEditingBudget(null)
    setShowForm(false)
  }

  const budgetStatus = useMemo(() => {
    return budgets.map(budget => {
      const spent = expenses
        .filter(exp => {
          const expDate = new Date(exp.date)
          return exp.category === budget.category &&
                 expDate.getMonth() + 1 === budget.budget_month &&
                 expDate.getFullYear() === budget.budget_year
        })
        .reduce((sum, exp) => sum + parseFloat(exp.amount.toString()), 0)

      const percentage = (spent / budget.amount) * 100
      const remaining = budget.amount - spent

      return {
        ...budget,
        spent,
        remaining,
        percentage: Math.min(percentage, 100),
        isOverBudget: spent > budget.amount
      }
    })
  }, [budgets, expenses])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
            Budget Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Set and track category budgets</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transform hover:scale-105 transition-all duration-300 shadow-lg"
        >
          <Plus size={18} />
          Add Budget
        </button>
      </div>

      {showForm && (
        <div className="group relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
          <form onSubmit={handleSubmit} className="relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingBudget ? 'Edit Budget' : 'Add New Budget'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                >
                  <option value="">Select category</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Budget Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Month
                </label>
                <select
                  value={formData.budget_month}
                  onChange={(e) => setFormData({ ...formData, budget_month: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Year
                </label>
                <input
                  type="number"
                  required
                  value={formData.budget_year}
                  onChange={(e) => setFormData({ ...formData, budget_year: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                type="submit"
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg touch-target"
              >
                {editingBudget ? 'Update Budget' : 'Add Budget'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="sm:flex-none px-4 py-3 bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl font-medium text-gray-700 dark:text-gray-300 transition-all touch-target"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {budgetStatus.length === 0 ? (
          <div className="lg:col-span-2 group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-10"></div>
            <div className="relative text-center py-12 px-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <Target className="mx-auto mb-4 text-gray-400 dark:text-gray-600" size={48} />
              <p className="text-gray-600 dark:text-gray-400">No budgets yet. Create your first budget!</p>
            </div>
          </div>
        ) : (
          budgetStatus.map(budget => (
            <div key={budget.id} className="group relative">
              <div className={`absolute inset-0 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity ${
                budget.isOverBudget
                  ? 'bg-gradient-to-br from-red-500 to-orange-500'
                  : 'bg-gradient-to-br from-blue-500 to-purple-500'
              }`}></div>
              <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                      {budget.category}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(budget.budget_year, budget.budget_month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(budget)}
                      className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(budget.id)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Spent</span>
                    <span className={`font-bold ${
                      budget.isOverBudget
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {formatAmount(budget.spent)}
                    </span>
                  </div>

                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        budget.isOverBudget
                          ? 'bg-gradient-to-r from-red-500 to-orange-500'
                          : budget.percentage > 80
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                          : 'bg-gradient-to-r from-blue-500 to-purple-600'
                      }`}
                      style={{ width: `${budget.percentage}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Budget</p>
                      <p className="font-bold text-gray-900 dark:text-white">{formatAmount(budget.amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {budget.isOverBudget ? 'Over by' : 'Remaining'}
                      </p>
                      <p className={`font-bold ${
                        budget.isOverBudget
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}>
                        {formatAmount(Math.abs(budget.remaining))}
                      </p>
                    </div>
                  </div>

                  {budget.isOverBudget && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <AlertTriangle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0" />
                      <p className="text-xs text-red-700 dark:text-red-300">
                        You've exceeded your budget for this category
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
