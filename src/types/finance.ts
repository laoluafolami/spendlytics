// Unified Transaction type for Income Statement view
export interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  category: string
  subcategory?: string
  description: string
  date: string
  payment_method?: string
  tags?: string[]
  source_table: 'expenses' | 'app_income'
  created_at: string
}

// Asset types for Balance Sheet
export type AssetType =
  | 'cash'
  | 'bank_account'
  | 'investment'
  | 'stocks'
  | 'bonds'
  | 'mutual_funds'
  | 'real_estate'
  | 'vehicle'
  | 'retirement'
  | 'business'
  | 'collectible'
  | 'other'

export interface Asset {
  id: string
  user_id: string
  name: string
  type: AssetType
  category: 'liquid' | 'marketable' | 'long_term' | 'personal'
  value: number
  currency: string
  purchase_date?: string
  purchase_price?: number
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Liability types for Balance Sheet
export type LiabilityType =
  | 'credit_card'
  | 'personal_loan'
  | 'mortgage'
  | 'car_loan'
  | 'student_loan'
  | 'business_loan'
  | 'family_loan'
  | 'other'

export interface Liability {
  id: string
  user_id: string
  name: string
  type: LiabilityType
  principal_amount: number
  current_balance: number
  interest_rate?: number
  minimum_payment?: number
  due_date?: number // day of month
  currency: string
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Investment type for Portfolio tracking
export type InvestmentType =
  | 'stock'
  | 'etf'
  | 'mutual_fund'
  | 'bond'
  | 'crypto'
  | 'reit'
  | 'commodity'
  | 'other'

// Investment/Holdings for Portfolio tracking
export interface Investment {
  id: string
  user_id: string
  symbol: string
  name: string
  type: InvestmentType
  shares: number
  average_cost: number
  current_price: number
  market_value: number
  cost_basis: number
  gain_loss: number
  gain_loss_percent: number
  purchase_date?: string
  dividend_yield?: number
  last_dividend?: number
  sector?: string
  currency?: string
  notes?: string
  is_active?: boolean
  created_at: string
  updated_at: string
}

// Income Allocation Buckets (like in the P&L sheet)
export interface AllocationBucket {
  id?: string
  user_id?: string
  name: string
  percentage: number
  color: string
  description?: string
  target_amount?: number
  current_amount?: number
  is_active?: boolean
  linkedCategories?: string[]
  created_at?: string
}

// Default allocation buckets based on the spreadsheet
export const DEFAULT_ALLOCATION_BUCKETS = [
  { name: 'Necessities', percentage: 50, color: '#3B82F6', description: 'Essential expenses (rent, food, utilities)' },
  { name: 'Long Term Savings', percentage: 15, color: '#10B981', description: 'Emergency fund and future purchases' },
  { name: 'Retirement', percentage: 10, color: '#8B5CF6', description: 'Retirement savings and pension' },
  { name: 'Investments', percentage: 10, color: '#F59E0B', description: 'Financial freedom investments' },
  { name: 'Education', percentage: 8, color: '#EC4899', description: 'Learning and skill development' },
  { name: 'Fun/Play', percentage: 5, color: '#06B6D4', description: 'Entertainment and leisure' },
  { name: 'Giving', percentage: 2, color: '#84CC16', description: 'Charity and gifts' },
] as const

// Asset categories for organization
export const ASSET_CATEGORIES = {
  liquid: {
    label: 'Cash & Liquid Assets',
    types: ['cash', 'bank_account', 'bonds'] as AssetType[],
    icon: 'Banknote',
    color: 'blue'
  },
  marketable: {
    label: 'Marketable Assets',
    types: ['stocks', 'mutual_funds', 'investment', 'real_estate', 'business'] as AssetType[],
    icon: 'TrendingUp',
    color: 'green'
  },
  long_term: {
    label: 'Long-term Assets',
    types: ['retirement'] as AssetType[],
    icon: 'Clock',
    color: 'purple'
  },
  personal: {
    label: 'Personal Assets',
    types: ['vehicle', 'collectible', 'other'] as AssetType[],
    icon: 'Home',
    color: 'orange'
  }
} as const

// Liability categories
export const LIABILITY_CATEGORIES = {
  secured: {
    label: 'Secured Debt',
    types: ['mortgage', 'car_loan'] as LiabilityType[],
    icon: 'Lock',
    color: 'blue'
  },
  unsecured: {
    label: 'Unsecured Debt',
    types: ['credit_card', 'personal_loan', 'student_loan'] as LiabilityType[],
    icon: 'CreditCard',
    color: 'red'
  },
  other: {
    label: 'Other Debt',
    types: ['business_loan', 'family_loan', 'other'] as LiabilityType[],
    icon: 'FileText',
    color: 'gray'
  }
} as const

// Income categories expanded for P&L
export const INCOME_TYPES = {
  earned: {
    label: 'Earned Income',
    categories: ['Salary', 'Freelance', 'Business', 'Bonus', 'Commission'],
    color: 'green'
  },
  portfolio: {
    label: 'Portfolio Income',
    categories: ['Dividends', 'Capital Gains', 'Interest'],
    color: 'blue'
  },
  passive: {
    label: 'Passive Income',
    categories: ['Rental', 'Royalties', 'Other Passive'],
    color: 'purple'
  }
} as const

// Expense categories expanded for P&L
export const EXPENSE_TYPES = {
  fixed: {
    label: 'Fixed Expenses',
    categories: ['Housing', 'Insurance', 'Loan Payments', 'Subscriptions'],
    color: 'blue'
  },
  variable: {
    label: 'Variable Expenses',
    categories: ['Food & Dining', 'Groceries', 'Transportation', 'Shopping', 'Entertainment'],
    color: 'orange'
  },
  discretionary: {
    label: 'Discretionary',
    categories: ['Travel', 'Gifts', 'Education', 'Healthcare'],
    color: 'purple'
  }
} as const

// Net Worth snapshot for historical tracking
export interface NetWorthSnapshot {
  id: string
  user_id: string
  date: string
  total_assets: number
  total_liabilities: number
  net_worth: number
  currency: string
  created_at: string
}

// Financial Summary for Dashboard
export interface FinancialSummary {
  // Income Statement
  totalIncome: number
  totalExpenses: number
  netCashFlow: number
  savingsRate: number

  // Balance Sheet
  totalAssets: number
  totalLiabilities: number
  netWorth: number

  // Portfolio
  portfolioValue: number
  portfolioGain: number
  portfolioGainPercent: number
  dividendIncome: number

  // Trends
  incomeChange: number
  expenseChange: number
  netWorthChange: number
}
