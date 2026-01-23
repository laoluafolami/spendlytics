export interface Expense {
  id: string
  amount: number
  category: string
  description: string
  date: string
  created_at: string
  updated_at: string
  payment_method?: string
  tags?: string[]
  receipt_url?: string
  is_recurring?: boolean
  recurrence_frequency?: string
  recurrence_end_date?: string
  // Integration: Link to liability for debt payments
  linked_liability_id?: string
  linked_liability_name?: string // Denormalized for display
}

export interface ExpenseFormData {
  amount: string
  category: string
  description: string
  date: string
  payment_method?: string
  tags?: string[]
  receipt_url?: string
  is_recurring?: boolean
  recurrence_frequency?: string
  recurrence_end_date?: string
  // Integration: Link to liability for debt payments
  linked_liability_id?: string
  linked_liability_name?: string
}

export interface Budget {
  id: string
  category: string
  amount: number
  budget_month: number
  budget_year: number
  created_at: string
  updated_at: string
}

export interface Income {
  id: string
  description: string
  amount: number
  category: string
  date: string
  created_at: string
  currency?: string
  // Integration: Link to asset for automatic balance updates
  linked_asset_id?: string
  linked_asset_name?: string // Denormalized for display
}

export interface SavingsGoal {
  id: string
  name: string
  target_amount: number
  current_amount: number
  deadline?: string
  created_at: string
  updated_at: string
  // Integration: Link to asset for balance tracking
  linked_asset_id?: string
  linked_asset_name?: string // Denormalized for display
}

export interface FilterPreset {
  id: string
  name: string
  filters: Record<string, any>
  created_at: string
}

export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Groceries',
  'Transportation',
  'Car Repairs',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Education',
  'Travel',
  'Housing',
  'House Repairs',
  'Recharge Card',
  'Gift',
  'Contribution',
  'Debt Payment', // Integration: Triggers liability linking
  'Other'
] as const

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investment',
  'Business',
  'Gift',
  'Other'
] as const

export const PAYMENT_METHODS = [
  'Cash',
  'Credit Card',
  'Debit Card',
  'Bank Transfer',
  'Digital Wallet',
  'Other'
] as const

export const RECURRENCE_FREQUENCIES = [
  'Daily',
  'Weekly',
  'Monthly',
  'Yearly'
] as const

export const COMMON_TAGS = [
  'Work',
  'Personal',
  'Tax-Deductible',
  'Business',
  'Urgent',
  'Planned',
  'Unexpected'
] as const
