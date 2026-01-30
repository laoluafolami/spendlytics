import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types/expense'

// Custom categories storage keys (must match SmartCapture's keys for compatibility)
const CUSTOM_EXPENSE_CATEGORIES_KEY = 'wealthpulse_custom_expense_categories'
const CUSTOM_INCOME_CATEGORIES_KEY = 'wealthpulse_custom_income_categories'

export type TransactionType = 'expense' | 'income'

/**
 * Get custom categories from localStorage
 */
export function getCustomCategories(type: TransactionType): string[] {
  const key = type === 'expense' ? CUSTOM_EXPENSE_CATEGORIES_KEY : CUSTOM_INCOME_CATEGORIES_KEY
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Add a custom category to localStorage
 */
export function addCustomCategory(type: TransactionType, category: string): void {
  const key = type === 'expense' ? CUSTOM_EXPENSE_CATEGORIES_KEY : CUSTOM_INCOME_CATEGORIES_KEY
  const existing = getCustomCategories(type)
  if (!existing.includes(category)) {
    localStorage.setItem(key, JSON.stringify([...existing, category]))
  }
}

/**
 * Get all expense categories (base + custom)
 */
export function getAllExpenseCategories(): string[] {
  const customCategories = getCustomCategories('expense')
  return [...EXPENSE_CATEGORIES, ...customCategories]
}

/**
 * Get all income categories (base + custom)
 */
export function getAllIncomeCategories(): string[] {
  const customCategories = getCustomCategories('income')
  return [...INCOME_CATEGORIES, ...customCategories]
}

/**
 * Get all categories for a given transaction type
 */
export function getAllCategories(type: TransactionType): string[] {
  if (type === 'expense') {
    return getAllExpenseCategories()
  }
  return getAllIncomeCategories()
}
