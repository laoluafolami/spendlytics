/**
 * Budget Alert Service
 *
 * Provides real-time budget checking before expenses are added
 * to help enforce spending limits.
 */

import { supabase } from '../lib/supabase'
import { Expense } from '../types/expense'

export interface Budget {
  id: string
  category: string
  amount: number
  budget_month: number
  budget_year: number
}

export interface BudgetStatus {
  hasBudget: boolean
  budget: Budget | null
  budgetAmount: number
  spentAmount: number
  remainingAmount: number
  percentUsed: number
  willExceed: boolean
  exceedAmount: number
  status: 'ok' | 'warning' | 'exceeded' | 'will_exceed'
}

/**
 * Get all budgets for the current user
 */
export async function getBudgets(userId: string): Promise<Budget[]> {
  try {
    const { data, error } = await supabase
      .from('app_budgets')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching budgets:', error)
    return []
  }
}

/**
 * Get budget for a specific category and month/year
 */
export async function getCategoryBudget(
  userId: string,
  category: string,
  month: number,
  year: number
): Promise<Budget | null> {
  try {
    const { data, error } = await supabase
      .from('app_budgets')
      .select('*')
      .eq('user_id', userId)
      .eq('category', category)
      .eq('budget_month', month)
      .eq('budget_year', year)
      .single()

    if (error) {
      // No budget found is not an error
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  } catch (error) {
    console.error('Error fetching category budget:', error)
    return null
  }
}

/**
 * Get total spent in a category for a specific month
 */
export async function getCategorySpending(
  userId: string,
  category: string,
  month: number,
  year: number
): Promise<number> {
  try {
    // Calculate date range for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const { data, error } = await supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', userId)
      .eq('category', category)
      .gte('date', startDate)
      .lt('date', endDate)

    if (error) throw error

    return (data || []).reduce((sum, expense) => sum + (expense.amount || 0), 0)
  } catch (error) {
    console.error('Error fetching category spending:', error)
    return 0
  }
}

/**
 * Check budget status for a category before adding an expense
 */
export async function checkBudgetStatus(
  userId: string,
  category: string,
  expenseAmount: number,
  expenseDate: string
): Promise<BudgetStatus> {
  const date = new Date(expenseDate)
  const month = date.getMonth() + 1
  const year = date.getFullYear()

  // Get budget and spending in parallel
  const [budget, spentAmount] = await Promise.all([
    getCategoryBudget(userId, category, month, year),
    getCategorySpending(userId, category, month, year),
  ])

  // No budget set for this category
  if (!budget) {
    return {
      hasBudget: false,
      budget: null,
      budgetAmount: 0,
      spentAmount,
      remainingAmount: 0,
      percentUsed: 0,
      willExceed: false,
      exceedAmount: 0,
      status: 'ok',
    }
  }

  const remainingAmount = budget.amount - spentAmount
  const percentUsed = (spentAmount / budget.amount) * 100
  const newTotal = spentAmount + expenseAmount
  const willExceed = newTotal > budget.amount
  const exceedAmount = willExceed ? newTotal - budget.amount : 0

  // Determine status
  let status: BudgetStatus['status'] = 'ok'
  if (spentAmount >= budget.amount) {
    status = 'exceeded'
  } else if (willExceed) {
    status = 'will_exceed'
  } else if (percentUsed >= 80) {
    status = 'warning'
  }

  return {
    hasBudget: true,
    budget,
    budgetAmount: budget.amount,
    spentAmount,
    remainingAmount: Math.max(0, remainingAmount),
    percentUsed,
    willExceed,
    exceedAmount,
    status,
  }
}

/**
 * Get all budget statuses for the current month (for dashboard/overview)
 */
export async function getAllBudgetStatuses(
  userId: string,
  expenses: Expense[],
  month?: number,
  year?: number
): Promise<Map<string, BudgetStatus>> {
  const targetMonth = month || new Date().getMonth() + 1
  const targetYear = year || new Date().getFullYear()

  const budgets = await getBudgets(userId)
  const statusMap = new Map<string, BudgetStatus>()

  // Filter expenses for the target month
  const monthExpenses = expenses.filter((e) => {
    const date = new Date(e.date)
    return date.getMonth() + 1 === targetMonth && date.getFullYear() === targetYear
  })

  // Calculate spending per category
  const spendingByCategory = new Map<string, number>()
  for (const expense of monthExpenses) {
    const current = spendingByCategory.get(expense.category) || 0
    spendingByCategory.set(expense.category, current + expense.amount)
  }

  // Calculate status for each budget
  for (const budget of budgets) {
    if (budget.budget_month !== targetMonth || budget.budget_year !== targetYear) continue

    const spentAmount = spendingByCategory.get(budget.category) || 0
    const remainingAmount = budget.amount - spentAmount
    const percentUsed = (spentAmount / budget.amount) * 100

    let status: BudgetStatus['status'] = 'ok'
    if (spentAmount >= budget.amount) {
      status = 'exceeded'
    } else if (percentUsed >= 80) {
      status = 'warning'
    }

    statusMap.set(budget.category, {
      hasBudget: true,
      budget,
      budgetAmount: budget.amount,
      spentAmount,
      remainingAmount: Math.max(0, remainingAmount),
      percentUsed,
      willExceed: false,
      exceedAmount: 0,
      status,
    })
  }

  return statusMap
}
