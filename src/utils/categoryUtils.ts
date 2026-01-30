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
 * Get all expense categories (base + custom + optional existing from DB)
 * @param existingCategories - Categories found in actual expense records (from DB)
 */
export function getAllExpenseCategories(existingCategories: string[] = []): string[] {
  const customCategories = getCustomCategories('expense')
  // Merge all sources and deduplicate
  const allCategories = new Set([
    ...EXPENSE_CATEGORIES,
    ...customCategories,
    ...existingCategories
  ])
  return Array.from(allCategories)
}

/**
 * Get all income categories (base + custom + optional existing from DB)
 * @param existingCategories - Categories found in actual income records (from DB)
 */
export function getAllIncomeCategories(existingCategories: string[] = []): string[] {
  const customCategories = getCustomCategories('income')
  // Merge all sources and deduplicate
  const allCategories = new Set([
    ...INCOME_CATEGORIES,
    ...customCategories,
    ...existingCategories
  ])
  return Array.from(allCategories)
}

/**
 * Get all categories for a given transaction type
 * @param existingCategories - Categories found in actual records (from DB)
 */
export function getAllCategories(type: TransactionType, existingCategories: string[] = []): string[] {
  if (type === 'expense') {
    return getAllExpenseCategories(existingCategories)
  }
  return getAllIncomeCategories(existingCategories)
}

/**
 * Sync categories from DB to localStorage
 * Call this when loading expenses to ensure custom categories include any DB-only categories
 */
export function syncCategoriesFromDB(type: TransactionType, dbCategories: string[]): void {
  const baseCategories = type === 'expense'
    ? EXPENSE_CATEGORIES as readonly string[]
    : INCOME_CATEGORIES as readonly string[]

  // Find categories that are in DB but not in base categories
  const newCustomCategories = dbCategories.filter(
    cat => !baseCategories.includes(cat)
  )

  // Add each new category to localStorage
  newCustomCategories.forEach(cat => {
    addCustomCategory(type, cat)
  })
}
