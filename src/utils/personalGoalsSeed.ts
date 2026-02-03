/**
 * Personal Goals Seed Data
 *
 * Based on the Goals.pdf framework - pre-configured goals organized by:
 * - Foundation (Year 1-3): Emergency fund, financial literacy, habits
 * - Growth (Year 4-6): Real estate, investment portfolio, passive income
 * - Expansion (Year 7-10): Net worth targets, real estate portfolio, wealth building
 *
 * One-click import to populate all goals with proper linked metrics and milestones.
 */

import {
  createGoalCategory,
  createLifeGoal,
  createGoalMilestone,
  getGoalCategories,
  getLifeGoals,
} from './lifeGoalsService'
import type { GoalPriority, LinkedMetricType } from '../types/lifeGoals'

// ============================================================================
// SEED CONFIGURATION
// ============================================================================

interface SeedCategory {
  name: string
  description: string
  color: string
  icon: string
  sort_order: number
}

interface SeedMilestone {
  title: string
  target_value?: number
  target_date_offset_months: number // Months from goal start
}

interface SeedGoal {
  category_key: string
  title: string
  description: string
  priority: GoalPriority
  target_type: 'numeric' | 'boolean' | 'milestone'
  target_value?: number
  target_unit?: string
  linked_metric?: LinkedMetricType
  target_years: number // Years from now
  milestones?: SeedMilestone[]
  notes?: string
}

// ============================================================================
// CATEGORIES (Based on Goals.pdf 10-Year Investment Plan)
// ============================================================================

const SEED_CATEGORIES: Record<string, SeedCategory> = {
  foundation: {
    name: 'Foundation (Year 1-3)',
    description: 'Build emergency fund, financial literacy, establish habits',
    color: '#3B82F6', // Blue
    icon: 'Shield',
    sort_order: 1,
  },
  growth: {
    name: 'Growth (Year 4-6)',
    description: 'Real estate, stock portfolio, diversification',
    color: '#10B981', // Emerald
    icon: 'TrendingUp',
    sort_order: 2,
  },
  expansion: {
    name: 'Expansion (Year 7-10)',
    description: 'Major wealth building, multiple properties, financial freedom',
    color: '#8B5CF6', // Purple
    icon: 'Rocket',
    sort_order: 3,
  },
  personal: {
    name: 'Personal Development',
    description: 'Skills, habits, health, and character growth',
    color: '#F59E0B', // Amber
    icon: 'Star',
    sort_order: 4,
  },
  family: {
    name: 'Family & Lifestyle',
    description: 'Family goals, home, vehicles, travel',
    color: '#EC4899', // Pink
    icon: 'Heart',
    sort_order: 5,
  },
}

// ============================================================================
// GOALS (Based on Goals.pdf Personal Goals)
// ============================================================================

const SEED_GOALS: SeedGoal[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // FOUNDATION (Year 1-3)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category_key: 'foundation',
    title: 'Emergency Fund (6 Months)',
    description: 'Build emergency fund equal to 6 months of expenses for financial security',
    priority: 'critical',
    target_type: 'numeric',
    target_value: 6,
    target_unit: 'months',
    linked_metric: 'emergency_fund_months',
    target_years: 1,
    milestones: [
      { title: '1 Month Saved', target_value: 1, target_date_offset_months: 3 },
      { title: '3 Months Saved', target_value: 3, target_date_offset_months: 6 },
      { title: '6 Months Saved', target_value: 6, target_date_offset_months: 12 },
    ],
    notes: 'Foundation of financial security. Save $480/month into high-yield savings.',
  },
  {
    category_key: 'foundation',
    title: 'Become Debt Free',
    description: 'Pay off all consumer debt to achieve financial freedom',
    priority: 'high',
    target_type: 'numeric',
    target_value: 100,
    target_unit: '%',
    linked_metric: 'debt_free_progress',
    target_years: 2,
    milestones: [
      { title: '25% Paid Off', target_value: 25, target_date_offset_months: 6 },
      { title: '50% Paid Off', target_value: 50, target_date_offset_months: 12 },
      { title: '75% Paid Off', target_value: 75, target_date_offset_months: 18 },
      { title: '100% Debt Free', target_value: 100, target_date_offset_months: 24 },
    ],
    notes: 'No debt except that which is paid by others (rental properties).',
  },
  {
    category_key: 'foundation',
    title: 'Financial Literacy Mastery',
    description: 'Read 12 investing books, analyze companies weekly, take courses',
    priority: 'high',
    target_type: 'milestone',
    target_years: 1,
    milestones: [
      { title: 'Read "The Intelligent Investor"', target_date_offset_months: 1 },
      { title: 'Read "One Up On Wall Street"', target_date_offset_months: 2 },
      { title: 'Read "Rich Dad Poor Dad"', target_date_offset_months: 3 },
      { title: 'Analyze 12 companies', target_date_offset_months: 6 },
      { title: 'Complete investing course', target_date_offset_months: 9 },
      { title: 'Develop investment thesis', target_date_offset_months: 12 },
    ],
    notes: 'Be able to analyze any company financials and take a position within 30 mins.',
  },
  {
    category_key: 'foundation',
    title: 'Passive Income $1,000/month',
    description: 'Move from $15/month to $1,000/month passive income',
    priority: 'high',
    target_type: 'numeric',
    target_value: 1000,
    target_unit: '$/month',
    linked_metric: 'passive_income',
    target_years: 2,
    milestones: [
      { title: '$100/month', target_value: 100, target_date_offset_months: 6 },
      { title: '$300/month', target_value: 300, target_date_offset_months: 12 },
      { title: '$600/month', target_value: 600, target_date_offset_months: 18 },
      { title: '$1,000/month', target_value: 1000, target_date_offset_months: 24 },
    ],
    notes: 'Sources: dividends, rental income, P2P lending, business income.',
  },
  {
    category_key: 'foundation',
    title: 'Savings Rate 30%+',
    description: 'Maintain minimum 30% savings rate consistently',
    priority: 'medium',
    target_type: 'numeric',
    target_value: 30,
    target_unit: '%',
    linked_metric: 'savings_rate',
    target_years: 1,
    notes: 'Monthly savings target: $480 (30% of $1,600 income)',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROWTH (Year 4-6)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category_key: 'growth',
    title: 'Passive Income $5,000/month',
    description: 'Scale passive income from $1,000 to $5,000/month',
    priority: 'critical',
    target_type: 'numeric',
    target_value: 5000,
    target_unit: '$/month',
    linked_metric: 'passive_income',
    target_years: 4,
    milestones: [
      { title: '$2,000/month', target_value: 2000, target_date_offset_months: 12 },
      { title: '$3,000/month', target_value: 3000, target_date_offset_months: 24 },
      { title: '$4,000/month', target_value: 4000, target_date_offset_months: 36 },
      { title: '$5,000/month', target_value: 5000, target_date_offset_months: 48 },
    ],
    notes: 'Financially free by age 37 - passive income covers all expenses.',
  },
  {
    category_key: 'growth',
    title: 'Investment Portfolio $100K',
    description: 'Build investment portfolio to $100,000',
    priority: 'high',
    target_type: 'numeric',
    target_value: 100000,
    target_unit: '$',
    linked_metric: 'total_investments',
    target_years: 5,
    milestones: [
      { title: '$25,000 Portfolio', target_value: 25000, target_date_offset_months: 15 },
      { title: '$50,000 Portfolio', target_value: 50000, target_date_offset_months: 30 },
      { title: '$75,000 Portfolio', target_value: 75000, target_date_offset_months: 45 },
      { title: '$100,000 Portfolio', target_value: 100000, target_date_offset_months: 60 },
    ],
    notes: 'Invest $200/month in dividend-paying stocks and ETFs.',
  },
  {
    category_key: 'growth',
    title: 'First Rental Property',
    description: 'Purchase first rental property with positive cash flow',
    priority: 'high',
    target_type: 'boolean',
    target_years: 5,
    milestones: [
      { title: 'Save $30K down payment', target_date_offset_months: 36 },
      { title: 'Get pre-approved for mortgage', target_date_offset_months: 42 },
      { title: 'Identify target market', target_date_offset_months: 48 },
      { title: 'Close on property', target_date_offset_months: 60 },
    ],
    notes: 'Save $500/month for down payment starting Year 4.',
  },
  {
    category_key: 'growth',
    title: '10 Income Streams',
    description: 'Diversify from 2 income streams to 10',
    priority: 'medium',
    target_type: 'numeric',
    target_value: 10,
    target_unit: 'streams',
    target_years: 4,
    milestones: [
      { title: '4 Streams', target_value: 4, target_date_offset_months: 12 },
      { title: '6 Streams', target_value: 6, target_date_offset_months: 24 },
      { title: '8 Streams', target_value: 8, target_date_offset_months: 36 },
      { title: '10 Streams', target_value: 10, target_date_offset_months: 48 },
    ],
    notes: 'Streams: salary, dividends, rental, bonds, P2P, business, royalties, etc.',
  },
  {
    category_key: 'growth',
    title: 'Dividend Income $10K/year',
    description: 'Build portfolio generating $10,000 annual dividends',
    priority: 'medium',
    target_type: 'numeric',
    target_value: 10000,
    target_unit: '$/year',
    linked_metric: 'portfolio_dividend_income',
    target_years: 5,
    milestones: [
      { title: '$1,000/year dividends', target_value: 1000, target_date_offset_months: 15 },
      { title: '$5,000/year dividends', target_value: 5000, target_date_offset_months: 36 },
      { title: '$10,000/year dividends', target_value: 10000, target_date_offset_months: 60 },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION (Year 7-10)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category_key: 'expansion',
    title: 'Net Worth $1 Million',
    description: 'Achieve millionaire status through diversified wealth building',
    priority: 'critical',
    target_type: 'numeric',
    target_value: 1000000,
    target_unit: '$',
    linked_metric: 'net_worth',
    target_years: 10,
    milestones: [
      { title: '$100K Net Worth', target_value: 100000, target_date_offset_months: 36 },
      { title: '$250K Net Worth', target_value: 250000, target_date_offset_months: 60 },
      { title: '$500K Net Worth', target_value: 500000, target_date_offset_months: 84 },
      { title: '$1M Net Worth', target_value: 1000000, target_date_offset_months: 120 },
    ],
    notes: 'FI Number: $500K to not work. Target: $100M ultimate goal (10X everything).',
  },
  {
    category_key: 'expansion',
    title: '$1 Million/Month Income',
    description: 'Ultimate income goal from diversified sources',
    priority: 'high',
    target_type: 'numeric',
    target_value: 1000000,
    target_unit: '$/month',
    linked_metric: 'passive_income',
    target_years: 10,
    milestones: [
      { title: '$10K/month', target_value: 10000, target_date_offset_months: 60 },
      { title: '$50K/month', target_value: 50000, target_date_offset_months: 84 },
      { title: '$100K/month', target_value: 100000, target_date_offset_months: 96 },
      { title: '$500K/month', target_value: 500000, target_date_offset_months: 108 },
    ],
    notes: '$33K/day = $1.4M/month. This is the "10X everything" stretch goal.',
  },
  {
    category_key: 'expansion',
    title: '5,000 Housing Units',
    description: 'Real estate portfolio with 12%+ positive cash flow',
    priority: 'high',
    target_type: 'numeric',
    target_value: 5000,
    target_unit: 'units',
    linked_metric: 'real_estate_units',
    target_years: 10,
    milestones: [
      { title: '1 Property', target_value: 1, target_date_offset_months: 60 },
      { title: '5 Properties', target_value: 5, target_date_offset_months: 84 },
      { title: '20 Properties', target_value: 20, target_date_offset_months: 96 },
      { title: '100 Units', target_value: 100, target_date_offset_months: 108 },
    ],
    notes: 'Real estate portfolio in Nigeria, US, UK with 12%+ yearly positive cashflow.',
  },
  {
    category_key: 'expansion',
    title: 'Investment Fund $500K',
    description: 'Create and manage personal investment fund',
    priority: 'medium',
    target_type: 'numeric',
    target_value: 500000,
    target_unit: '$',
    linked_metric: 'total_investments',
    target_years: 8,
    milestones: [
      { title: 'Fund structure planned', target_date_offset_months: 72 },
      { title: '$100K committed', target_value: 100000, target_date_offset_months: 84 },
      { title: '$250K committed', target_value: 250000, target_date_offset_months: 90 },
      { title: '$500K fund operational', target_value: 500000, target_date_offset_months: 96 },
    ],
    notes: 'Pool resources from family/friends to invest in fast-growth companies.',
  },
  {
    category_key: 'expansion',
    title: '100 Stock Holdings',
    description: 'Diversified portfolio of best-performing companies',
    priority: 'medium',
    target_type: 'numeric',
    target_value: 100,
    target_unit: 'holdings',
    linked_metric: 'portfolio_count',
    target_years: 10,
    milestones: [
      { title: '10 Holdings', target_value: 10, target_date_offset_months: 24 },
      { title: '25 Holdings', target_value: 25, target_date_offset_months: 48 },
      { title: '50 Holdings', target_value: 50, target_date_offset_months: 72 },
      { title: '100 Holdings', target_value: 100, target_date_offset_months: 120 },
    ],
    notes: 'Invest in best performing companies in Africa and around the world.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONAL DEVELOPMENT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category_key: 'personal',
    title: 'Excellent Professional & Human Being',
    description: 'Move from average to excellent in all areas of life',
    priority: 'high',
    target_type: 'milestone',
    target_years: 1,
    milestones: [
      { title: 'Read 4 books/month habit', target_date_offset_months: 3 },
      { title: 'Daily exercise habit', target_date_offset_months: 3 },
      { title: 'Daily spiritual reading', target_date_offset_months: 3 },
      { title: 'Improved communication skills', target_date_offset_months: 6 },
      { title: 'Leadership course completed', target_date_offset_months: 9 },
      { title: 'French language progress', target_date_offset_months: 12 },
    ],
    notes: 'Become: Empathetic, Intuitive, Creative, Passionate, Life-long Learner, Good Listener, Persuasive, Responsible, Kind, Leader, Courageous.',
  },
  {
    category_key: 'personal',
    title: 'Health & Fitness',
    description: 'Perfect health condition - play tennis/squash 2hrs with vigor',
    priority: 'high',
    target_type: 'milestone',
    target_years: 1,
    milestones: [
      { title: 'Daily exercise routine', target_date_offset_months: 1 },
      { title: 'Improved nutrition (Vit C, vegetables)', target_date_offset_months: 3 },
      { title: 'Tennis skills improved', target_date_offset_months: 6 },
      { title: 'Golf skills started', target_date_offset_months: 12 },
    ],
    notes: 'Eat an apple a day, lime-honey, high dose Vit C. Eat vegetables daily.',
  },
  {
    category_key: 'personal',
    title: 'Write Bestselling Book',
    description: '"Man and Change: Discovering the Greatness in You"',
    priority: 'medium',
    target_type: 'boolean',
    target_years: 10,
    milestones: [
      { title: 'Outline completed', target_date_offset_months: 36 },
      { title: 'First draft written', target_date_offset_months: 72 },
      { title: 'Book edited', target_date_offset_months: 96 },
      { title: 'Book published', target_date_offset_months: 120 },
    ],
    notes: 'Part of goal to write 12+ bestselling books.',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FAMILY & LIFESTYLE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category_key: 'family',
    title: 'Build Family Home',
    description: '5-bedroom fully furnished home close to a lake',
    priority: 'high',
    target_type: 'boolean',
    target_years: 5,
    milestones: [
      { title: 'Land acquired', target_date_offset_months: 36 },
      { title: 'Design approved', target_date_offset_months: 42 },
      { title: 'Construction started', target_date_offset_months: 48 },
      { title: 'Home completed', target_date_offset_months: 60 },
    ],
    notes: 'State-of-the-art home for family to grow up in.',
  },
  {
    category_key: 'family',
    title: '2 Brand New Cars',
    description: 'Lexus/Tesla/Benz financed from investment returns',
    priority: 'medium',
    target_type: 'boolean',
    target_years: 4,
    milestones: [
      { title: 'Car fund started', target_date_offset_months: 12 },
      { title: 'First car purchased', target_date_offset_months: 36 },
      { title: 'Second car purchased', target_date_offset_months: 48 },
    ],
    notes: 'Save from compounded returns on investments for reliable mobility.',
  },
  {
    category_key: 'family',
    title: 'Family Travel Fund',
    description: 'Yearly vacations with family - US, UK, Maldives, Europe',
    priority: 'medium',
    target_type: 'milestone',
    target_years: 3,
    milestones: [
      { title: 'USA trip', target_date_offset_months: 12 },
      { title: 'UK trip', target_date_offset_months: 18 },
      { title: 'Maldives vacation', target_date_offset_months: 24 },
      { title: 'Europe trip (Budapest)', target_date_offset_months: 36 },
    ],
    notes: 'Places to visit: Singapore, Canada, Rome, Ghana, Rwanda, Hong Kong, China.',
  },
  {
    category_key: 'family',
    title: "Children's Education Fund",
    description: 'International school - Primary, Secondary, University abroad',
    priority: 'high',
    target_type: 'numeric',
    target_value: 100000,
    target_unit: '$',
    target_years: 10,
    milestones: [
      { title: '$10K saved', target_value: 10000, target_date_offset_months: 24 },
      { title: '$25K saved', target_value: 25000, target_date_offset_months: 48 },
      { title: '$50K saved', target_value: 50000, target_date_offset_months: 72 },
      { title: '$100K saved', target_value: 100000, target_date_offset_months: 120 },
    ],
    notes: 'Practical knowledge with internationally recognized certificates. Languages: English, Yoruba, French, Spanish.',
  },
]

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

/**
 * Import all personal goals from the Goals.pdf framework
 * Creates categories, goals, and milestones in one operation
 */
export async function importPersonalGoals(): Promise<{
  success: boolean
  categoriesCreated: number
  goalsCreated: number
  milestonesCreated: number
  errors: string[]
}> {
  const errors: string[] = []
  let categoriesCreated = 0
  let goalsCreated = 0
  let milestonesCreated = 0

  try {
    // Check for existing data
    const existingCategories = await getGoalCategories()
    const existingGoals = await getLifeGoals()

    // Create category ID mapping
    const categoryIdMap: Record<string, string> = {}

    // Step 1: Create categories (skip if similar name exists)
    for (const [key, seedCat] of Object.entries(SEED_CATEGORIES)) {
      const existingCat = existingCategories.find(
        c => c.name.toLowerCase() === seedCat.name.toLowerCase()
      )

      if (existingCat) {
        categoryIdMap[key] = existingCat.id
        continue
      }

      try {
        const created = await createGoalCategory({
          name: seedCat.name,
          description: seedCat.description,
          color: seedCat.color,
          icon: seedCat.icon,
          sort_order: seedCat.sort_order,
          is_active: true,
        })

        if (created) {
          categoryIdMap[key] = created.id
          categoriesCreated++
        }
      } catch (error) {
        errors.push(`Failed to create category "${seedCat.name}": ${error}`)
      }
    }

    // Step 2: Create goals (skip if similar title exists)
    for (const seedGoal of SEED_GOALS) {
      const categoryId = categoryIdMap[seedGoal.category_key]
      if (!categoryId) {
        errors.push(`No category found for goal "${seedGoal.title}"`)
        continue
      }

      // Check if goal with same title exists
      const existingGoal = existingGoals.find(
        g => g.title.toLowerCase() === seedGoal.title.toLowerCase()
      )

      if (existingGoal) {
        continue // Skip duplicate
      }

      const now = new Date()
      const targetDate = new Date(now)
      targetDate.setFullYear(targetDate.getFullYear() + seedGoal.target_years)

      try {
        const created = await createLifeGoal({
          category_id: categoryId,
          title: seedGoal.title,
          description: seedGoal.description,
          priority: seedGoal.priority,
          status: 'not_started',
          target_type: seedGoal.target_type,
          target_value: seedGoal.target_value,
          target_unit: seedGoal.target_unit,
          current_value: 0,
          linked_metric: seedGoal.linked_metric,
          start_date: now.toISOString().split('T')[0],
          target_date: targetDate.toISOString().split('T')[0],
          notes: seedGoal.notes,
          tags: [],
          is_active: true,
        })

        if (created) {
          goalsCreated++

          // Step 3: Create milestones for this goal
          if (seedGoal.milestones && seedGoal.milestones.length > 0) {
            for (let i = 0; i < seedGoal.milestones.length; i++) {
              const seedMilestone = seedGoal.milestones[i]
              const milestoneDate = new Date(now)
              milestoneDate.setMonth(milestoneDate.getMonth() + seedMilestone.target_date_offset_months)

              try {
                const milestone = await createGoalMilestone({
                  goal_id: created.id,
                  title: seedMilestone.title,
                  target_value: seedMilestone.target_value,
                  target_date: milestoneDate.toISOString().split('T')[0],
                  is_completed: false,
                  sort_order: i + 1,
                })

                if (milestone) {
                  milestonesCreated++
                }
              } catch (error) {
                errors.push(`Failed to create milestone "${seedMilestone.title}": ${error}`)
              }
            }
          }
        }
      } catch (error) {
        errors.push(`Failed to create goal "${seedGoal.title}": ${error}`)
      }
    }

    return {
      success: errors.length === 0,
      categoriesCreated,
      goalsCreated,
      milestonesCreated,
      errors,
    }
  } catch (error) {
    return {
      success: false,
      categoriesCreated,
      goalsCreated,
      milestonesCreated,
      errors: [`Import failed: ${error}`],
    }
  }
}

/**
 * Check if personal goals have already been imported
 */
export async function hasPersonalGoalsImported(): Promise<boolean> {
  try {
    const categories = await getGoalCategories()
    const foundationCategory = categories.find(c =>
      c.name.toLowerCase().includes('foundation') &&
      c.name.toLowerCase().includes('year')
    )
    return !!foundationCategory
  } catch {
    return false
  }
}

/**
 * Get a summary of what will be imported
 */
export function getImportSummary(): {
  categories: number
  goals: number
  totalMilestones: number
  breakdown: Array<{ category: string; goalCount: number }>
} {
  const breakdown: Array<{ category: string; goalCount: number }> = []

  for (const [key, cat] of Object.entries(SEED_CATEGORIES)) {
    const goalCount = SEED_GOALS.filter(g => g.category_key === key).length
    breakdown.push({ category: cat.name, goalCount })
  }

  const totalMilestones = SEED_GOALS.reduce(
    (sum, g) => sum + (g.milestones?.length || 0),
    0
  )

  return {
    categories: Object.keys(SEED_CATEGORIES).length,
    goals: SEED_GOALS.length,
    totalMilestones,
    breakdown,
  }
}
