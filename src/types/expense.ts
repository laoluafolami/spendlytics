export interface Expense {
  id: string
  amount: number
  category: string
  description: string
  date: string
  created_at: string
  updated_at: string
}

export interface ExpenseFormData {
  amount: string
  category: string
  description: string
  date: string
}

export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Education',
  'Travel',
  'Housing',
  'Other'
] as const
