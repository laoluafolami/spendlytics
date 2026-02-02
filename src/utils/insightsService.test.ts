/**
 * Insights Service Tests
 *
 * Tests for goal projection calculations, insight generation,
 * and what-if analysis functionality.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateProjection,
  generateInsights,
  getRecommendations,
  generateInsightsSummary,
  calculateWhatIf,
} from './insightsService'
import { LifeGoal, GoalProgressSnapshot } from '../types/lifeGoals'
import { InsightsInput } from '../types/insights'

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockGoal(overrides: Partial<LifeGoal> = {}): LifeGoal {
  return {
    id: 'goal-1',
    user_id: 'user-1',
    title: 'Test Goal',
    description: 'A test goal',
    category_id: 'cat-1',
    priority: 'medium',
    status: 'in_progress',
    is_active: true,
    target_type: 'numeric',
    target_value: 100,
    target_unit: 'units',
    current_value: 50,
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function createMockSnapshots(
  goalId: string,
  values: number[],
  daysApart: number = 5
): GoalProgressSnapshot[] {
  const now = Date.now()
  return values.map((value, index) => ({
    id: `snapshot-${index}`,
    goal_id: goalId,
    user_id: 'user-1',
    date: new Date(now - (values.length - 1 - index) * daysApart * 24 * 60 * 60 * 1000).toISOString(),
    value,
    notes: undefined,
    created_at: new Date().toISOString(),
  }))
}

// ============================================================================
// PROJECTION TESTS
// ============================================================================

describe('calculateProjection', () => {
  it('should calculate basic projection with no history', () => {
    const goal = createMockGoal()
    const projection = calculateProjection(goal, [])

    expect(projection.goalId).toBe(goal.id)
    expect(projection.currentValue).toBe(50)
    expect(projection.targetValue).toBe(100)
    expect(projection.percentComplete).toBe(50)
    expect(projection.progressRate).toBe(0)
    expect(projection.confidence).toBe('low')
  })

  it('should calculate progress rate from snapshots', () => {
    const goal = createMockGoal({ current_value: 60 })
    const snapshots = createMockSnapshots(goal.id, [40, 50, 60], 10)

    const projection = calculateProjection(goal, snapshots)

    // 20 units over 20 days = 1 unit/day
    expect(projection.progressRate).toBe(1)
    expect(projection.progressRateMonthly).toBe(30)
  })

  it('should estimate completion date based on rate', () => {
    const goal = createMockGoal({
      current_value: 50,
      target_value: 100,
    })
    const snapshots = createMockSnapshots(goal.id, [30, 40, 50], 10)

    const projection = calculateProjection(goal, snapshots)

    // 50 remaining at 1 unit/day = 50 days
    expect(projection.estimatedDaysToComplete).toBe(50)
    expect(projection.estimatedCompletionDate).not.toBeNull()
  })

  it('should detect improving trend', () => {
    const goal = createMockGoal({ current_value: 80 })
    // First half: 10-30 (20 units over 2 intervals)
    // Second half: 50-80 (30 units over 2 intervals) - faster
    const snapshots = createMockSnapshots(goal.id, [10, 20, 30, 50, 65, 80], 5)

    const projection = calculateProjection(goal, snapshots)

    expect(projection.progressTrend).toBe('improving')
  })

  it('should detect declining trend', () => {
    const goal = createMockGoal({ current_value: 55 })
    // First half: 10-40 (30 units)
    // Second half: 45-55 (10 units) - slower
    const snapshots = createMockSnapshots(goal.id, [10, 25, 40, 45, 50, 55], 5)

    const projection = calculateProjection(goal, snapshots)

    expect(projection.progressTrend).toBe('declining')
  })

  it('should calculate on-track status correctly', () => {
    const goal = createMockGoal({
      current_value: 90,
      target_value: 100,
    })
    const snapshots = createMockSnapshots(goal.id, [70, 80, 90], 5)

    const projection = calculateProjection(goal, snapshots)

    expect(projection.onTrack).toBe(true)
    expect(projection.shortfall).toBeNull()
  })

  it('should calculate shortfall when behind', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const goal = createMockGoal({
      current_value: 20,
      target_value: 100,
      start_date: thirtyDaysAgo,
      target_date: thirtyDaysAhead,
    })
    // Very slow progress: only 5 units over 20 days = 0.25/day
    const snapshots = createMockSnapshots(goal.id, [15, 17, 20], 10)

    const projection = calculateProjection(goal, snapshots)

    expect(projection.onTrack).toBe(false)
    expect(projection.shortfall).toBeGreaterThan(0)
    expect(projection.requiredRate).toBeGreaterThan(projection.progressRate)
  })

  it('should handle completed goals', () => {
    const goal = createMockGoal({
      current_value: 100,
      target_value: 100,
    })

    const projection = calculateProjection(goal, [])

    expect(projection.percentComplete).toBe(100)
    expect(projection.onTrack).toBe(true)
    expect(projection.estimatedDaysToComplete).toBe(0)
  })

  it('should set confidence based on data points', () => {
    const goal = createMockGoal()

    // Low confidence: 0 snapshots
    const proj1 = calculateProjection(goal, [])
    expect(proj1.confidence).toBe('low')

    // Medium confidence: 5 snapshots
    const snapshots5 = createMockSnapshots(goal.id, [10, 20, 30, 40, 50], 5)
    const proj2 = calculateProjection(goal, snapshots5)
    expect(proj2.confidence).toBe('medium')

    // High confidence: 10+ snapshots
    const snapshots10 = createMockSnapshots(goal.id, [10, 15, 20, 25, 30, 35, 40, 45, 50, 55], 3)
    const proj3 = calculateProjection(goal, snapshots10)
    expect(proj3.confidence).toBe('high')
  })
})

// ============================================================================
// INSIGHT GENERATION TESTS
// ============================================================================

describe('generateInsights', () => {
  it('should generate insights for active goals', () => {
    const goal = createMockGoal()
    const input: InsightsInput = {
      goals: [goal],
      progressHistory: new Map(),
    }

    const insights = generateInsights(input)

    expect(insights.length).toBeGreaterThan(0)
  })

  it('should skip inactive goals', () => {
    const goal = createMockGoal({ is_active: false })
    const input: InsightsInput = {
      goals: [goal],
      progressHistory: new Map(),
    }

    const insights = generateInsights(input)

    expect(insights.length).toBe(0)
  })

  it('should skip paused goals', () => {
    const goal = createMockGoal({ status: 'paused' })
    const input: InsightsInput = {
      goals: [goal],
      progressHistory: new Map(),
    }

    const insights = generateInsights(input)

    expect(insights.length).toBe(0)
  })

  it('should generate achievement insight for completed goal', () => {
    const goal = createMockGoal({
      current_value: 100,
      target_value: 100,
      status: 'in_progress', // Not marked complete yet
    })
    const input: InsightsInput = {
      goals: [goal],
      progressHistory: new Map(),
    }

    const insights = generateInsights(input)

    const achievement = insights.find(i => i.type === 'achievement')
    expect(achievement).toBeDefined()
    expect(achievement?.title).toContain('Goal Achieved')
  })

  it('should generate milestone insight when approaching milestone', () => {
    const goal = createMockGoal({
      current_value: 72,
      target_value: 100,
    })
    const input: InsightsInput = {
      goals: [goal],
      progressHistory: new Map(),
    }

    const insights = generateInsights(input)

    const milestone = insights.find(i => i.type === 'milestone')
    expect(milestone).toBeDefined()
    expect(milestone?.title).toContain('75%')
  })

  it('should sort insights by severity', () => {
    // Create multiple goals with different states
    const criticalGoal = createMockGoal({
      id: 'critical',
      current_value: 10,
      target_value: 100,
    })
    const onTrackGoal = createMockGoal({
      id: 'ontrack',
      current_value: 95,
      target_value: 100,
    })

    const input: InsightsInput = {
      goals: [onTrackGoal, criticalGoal],
      progressHistory: new Map(),
    }

    const insights = generateInsights(input)

    // Critical insights should come first
    const severityOrder = { critical: 0, warning: 1, success: 2, info: 3 }
    for (let i = 1; i < insights.length; i++) {
      expect(severityOrder[insights[i].severity]).toBeGreaterThanOrEqual(
        severityOrder[insights[i - 1].severity]
      )
    }
  })
})

// ============================================================================
// RECOMMENDATIONS TESTS
// ============================================================================

describe('getRecommendations', () => {
  it('should recommend increasing contribution when behind', () => {
    const goal = createMockGoal({
      current_value: 20,
      target_value: 100,
    })
    const projection = calculateProjection(goal, [])
    // Simulate being behind
    const behindProjection = {
      ...projection,
      onTrack: false,
      shortfall: 30,
      requiredRate: 2,
      progressRateMonthly: 10,
    }

    const recommendations = getRecommendations(goal, behindProjection)

    const increaseRec = recommendations.find(r => r.type === 'increase_contribution')
    expect(increaseRec).toBeDefined()
    expect(increaseRec?.impact).toBe('high')
  })

  it('should suggest timeline adjustment when significantly behind', () => {
    const goal = createMockGoal({
      current_value: 20,
      target_value: 100,
    })
    const projection = {
      ...calculateProjection(goal, []),
      onTrack: false,
      shortfall: 50,
      requiredRate: 3,
      percentComplete: 20,
      daysRemaining: 60,
      progressRate: 0.5,
    }

    const recommendations = getRecommendations(goal, projection)

    const timelineRec = recommendations.find(r => r.type === 'adjust_timeline')
    expect(timelineRec).toBeDefined()
    expect(timelineRec?.impact).toBe('medium')
  })

  it('should celebrate when on track and near completion', () => {
    const goal = createMockGoal({
      current_value: 80,
      target_value: 100,
    })
    const projection = {
      ...calculateProjection(goal, []),
      onTrack: true,
      percentComplete: 80,
    }

    const recommendations = getRecommendations(goal, projection)

    const celebrateRec = recommendations.find(r => r.type === 'celebrate')
    expect(celebrateRec).toBeDefined()
    expect(celebrateRec?.title).toContain('Great')
  })
})

// ============================================================================
// SUMMARY TESTS
// ============================================================================

describe('generateInsightsSummary', () => {
  it('should generate complete summary', () => {
    const goals = [
      createMockGoal({ id: 'goal-1', current_value: 90 }),
      createMockGoal({ id: 'goal-2', current_value: 50 }),
      createMockGoal({ id: 'goal-3', status: 'completed', current_value: 100 }),
    ]

    const input: InsightsInput = {
      goals,
      progressHistory: new Map(),
    }

    const summary = generateInsightsSummary(input)

    expect(summary.totalGoals).toBe(3)
    expect(summary.goalsCompleted).toBe(1)
    expect(summary.projections.length).toBe(3)
    expect(summary.insights.length).toBeGreaterThan(0)
    expect(summary.generatedAt).toBeDefined()
  })

  it('should count goals by status correctly', () => {
    const onTrackGoal = createMockGoal({
      id: 'ontrack',
      current_value: 95,
      target_value: 100,
    })
    const criticalGoal = createMockGoal({
      id: 'critical',
      current_value: 5,
      target_value: 100,
    })

    const input: InsightsInput = {
      goals: [onTrackGoal, criticalGoal],
      progressHistory: new Map(),
    }

    const summary = generateInsightsSummary(input)

    expect(summary.goalsOnTrack + summary.goalsAtRisk + summary.goalsCritical).toBeLessThanOrEqual(
      summary.totalGoals
    )
  })
})

// ============================================================================
// WHAT-IF TESTS
// ============================================================================

describe('calculateWhatIf', () => {
  it('should calculate improvement with increased contribution', () => {
    const goal = createMockGoal({
      current_value: 50,
      target_value: 100,
    })
    const snapshots = createMockSnapshots(goal.id, [30, 40, 50], 10)
    const projection = calculateProjection(goal, snapshots)

    // Increase monthly contribution by 15 (from 30 to 45)
    const whatIf = calculateWhatIf(goal, projection, 15)

    expect(whatIf.daysSaved).toBeGreaterThan(0)
    expect(whatIf.improvementPercent).toBeGreaterThan(0)
    expect(whatIf.newCompletionDate).not.toBeNull()
  })

  it('should handle zero progress rate', () => {
    const goal = createMockGoal()
    const projection = {
      ...calculateProjection(goal, []),
      progressRateMonthly: 0,
    }

    const whatIf = calculateWhatIf(goal, projection, 10)

    expect(whatIf.daysSaved).toBe(0)
    expect(whatIf.improvementPercent).toBe(0)
    expect(whatIf.newCompletionDate).toBeNull()
  })

  it('should handle already completed goals', () => {
    const goal = createMockGoal({
      current_value: 100,
      target_value: 100,
    })
    // Create a projection with some progress rate for the what-if to work with
    const projection = {
      ...calculateProjection(goal, []),
      progressRateMonthly: 10, // Some rate to avoid zero-rate edge case
    }

    const whatIf = calculateWhatIf(goal, projection, 10)

    // For completed goals (remaining <= 0), the function returns immediately with a new Date
    expect(whatIf.daysSaved).toBeGreaterThanOrEqual(0)
    expect(whatIf.newCompletionDate).not.toBeNull()
  })

  it('should calculate new completion date correctly', () => {
    const goal = createMockGoal({
      current_value: 50,
      target_value: 100,
    })
    // 1 unit/day rate
    const projection = {
      ...calculateProjection(goal, []),
      progressRateMonthly: 30, // 1 unit/day
      estimatedDaysToComplete: 50, // 50 units remaining at 1/day
    }

    // Double the rate
    const whatIf = calculateWhatIf(goal, projection, 30) // Now 2 units/day

    // Should complete in ~25 days instead of 50
    expect(whatIf.daysSaved).toBeCloseTo(25, 0)
    expect(whatIf.improvementPercent).toBeCloseTo(50, 0)
  })
})
