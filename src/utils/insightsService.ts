/**
 * Insights Service
 *
 * Generates projections, insights, and recommendations for life goals
 * based on historical progress data and current financial state.
 */

import {
  GoalInsight,
  GoalProjection,
  GoalRecommendation,
  InsightsSummary,
  InsightsInput,
  InsightConfig,
  DEFAULT_INSIGHT_CONFIG,
  InsightSeverity,
} from '../types/insights'
import { LifeGoal, GoalProgressSnapshot } from '../types/lifeGoals'
import { FinancialSummary } from '../types/finance'
import { calculateGoalProgress, daysUntilTarget } from './lifeGoalsService'

// ============================================================================
// PROJECTION CALCULATIONS
// ============================================================================

/**
 * Calculate projection for a single goal based on progress history
 */
export function calculateProjection(
  goal: LifeGoal,
  snapshots: GoalProgressSnapshot[]
): GoalProjection {
  const currentValue = goal.current_value
  const targetValue = goal.target_value || 100
  const percentComplete = calculateGoalProgress(goal)
  const daysRemaining = daysUntilTarget(goal)

  // Sort snapshots by date (oldest first for rate calculation)
  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // Calculate progress rate (change per day)
  let progressRate = 0
  let progressTrend: 'improving' | 'stable' | 'declining' = 'stable'

  if (sortedSnapshots.length >= 2) {
    const firstSnapshot = sortedSnapshots[0]
    const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1]
    const daysDiff = Math.max(
      1,
      (new Date(lastSnapshot.date).getTime() - new Date(firstSnapshot.date).getTime()) /
        (1000 * 60 * 60 * 24)
    )
    const valueDiff = lastSnapshot.value - firstSnapshot.value
    progressRate = valueDiff / daysDiff

    // Analyze trend (compare recent progress to earlier progress)
    if (sortedSnapshots.length >= 4) {
      const midpoint = Math.floor(sortedSnapshots.length / 2)
      const firstHalf = sortedSnapshots.slice(0, midpoint)
      const secondHalf = sortedSnapshots.slice(midpoint)

      const firstHalfRate = calculateRateForSnapshots(firstHalf)
      const secondHalfRate = calculateRateForSnapshots(secondHalf)

      if (secondHalfRate > firstHalfRate * 1.1) {
        progressTrend = 'improving'
      } else if (secondHalfRate < firstHalfRate * 0.9) {
        progressTrend = 'declining'
      }
    }
  }

  const progressRateMonthly = progressRate * 30

  // Calculate estimated completion
  let estimatedCompletionDate: Date | null = null
  let estimatedDaysToComplete: number | null = null

  if (progressRate > 0 && currentValue < targetValue) {
    const remaining = targetValue - currentValue
    estimatedDaysToComplete = Math.ceil(remaining / progressRate)
    estimatedCompletionDate = new Date()
    estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + estimatedDaysToComplete)
  } else if (currentValue >= targetValue) {
    estimatedDaysToComplete = 0
    estimatedCompletionDate = new Date()
  }

  // Calculate projected value at deadline
  let projectedValueAtDeadline: number | null = null
  let shortfall: number | null = null
  let requiredRate: number | null = null
  let onTrack = false

  if (daysRemaining !== null && daysRemaining > 0) {
    projectedValueAtDeadline = currentValue + progressRate * daysRemaining

    if (projectedValueAtDeadline >= targetValue) {
      onTrack = true
    } else {
      shortfall = targetValue - projectedValueAtDeadline
      requiredRate = (targetValue - currentValue) / daysRemaining
    }
  } else if (percentComplete >= 100) {
    onTrack = true
  }

  // Determine confidence based on data points
  const dataPoints = sortedSnapshots.length
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (dataPoints >= 10) confidence = 'high'
  else if (dataPoints >= 5) confidence = 'medium'

  return {
    goalId: goal.id,
    goalTitle: goal.title,
    currentValue,
    targetValue,
    percentComplete,
    progressRate,
    progressRateMonthly,
    progressTrend,
    daysRemaining,
    estimatedCompletionDate,
    estimatedDaysToComplete,
    onTrack,
    projectedValueAtDeadline,
    shortfall,
    requiredRate,
    dataPoints,
    confidence,
  }
}

function calculateRateForSnapshots(snapshots: GoalProgressSnapshot[]): number {
  if (snapshots.length < 2) return 0

  const first = snapshots[0]
  const last = snapshots[snapshots.length - 1]
  const daysDiff = Math.max(
    1,
    (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24)
  )
  return (last.value - first.value) / daysDiff
}

// ============================================================================
// INSIGHT GENERATION
// ============================================================================

/**
 * Generate all insights for a set of goals
 */
export function generateInsights(
  input: InsightsInput
): GoalInsight[] {
  const config = { ...DEFAULT_INSIGHT_CONFIG, ...input.config }
  const insights: GoalInsight[] = []

  for (const goal of input.goals) {
    if (!goal.is_active || goal.status === 'paused') continue

    const snapshots = input.progressHistory.get(goal.id) || []
    const projection = calculateProjection(goal, snapshots)

    // Generate insights based on goal state
    insights.push(...generateDriftInsights(goal, projection, config))
    insights.push(...generateMilestoneInsights(goal, projection))
    insights.push(...generateAchievementInsights(goal, projection))
    insights.push(...generateTrendInsights(goal, projection))
  }

  // Sort by severity (critical first) then by date
  return insights.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, success: 2, info: 3 }
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
    if (severityDiff !== 0) return severityDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

function generateDriftInsights(
  goal: LifeGoal,
  projection: GoalProjection,
  config: InsightConfig
): GoalInsight[] {
  const insights: GoalInsight[] = []

  // Only check drift for goals with deadlines
  if (projection.daysRemaining === null || projection.daysRemaining <= 0) return insights
  if (goal.status === 'completed') return insights

  // Calculate expected progress
  const totalDuration = goal.start_date && goal.target_date
    ? (new Date(goal.target_date).getTime() - new Date(goal.start_date).getTime()) /
      (1000 * 60 * 60 * 24)
    : null

  if (!totalDuration || totalDuration <= 0) return insights

  const elapsed = totalDuration - projection.daysRemaining
  const expectedProgress = (elapsed / totalDuration) * 100
  const actualProgress = projection.percentComplete
  const progressRatio = actualProgress / Math.max(expectedProgress, 1)

  // Determine severity
  let severity: InsightSeverity = 'info'
  let title = ''
  let description = ''

  if (progressRatio >= config.onTrackThreshold / 100) {
    severity = 'success'
    title = 'On Track'
    description = `"${goal.title}" is progressing well. You're ${actualProgress.toFixed(1)}% complete with ${projection.daysRemaining} days remaining.`
  } else if (progressRatio >= config.slightDriftThreshold / 100) {
    severity = 'info'
    title = 'Slight Drift'
    description = `"${goal.title}" is slightly behind schedule. Expected ${expectedProgress.toFixed(1)}% progress, currently at ${actualProgress.toFixed(1)}%.`
  } else if (progressRatio >= config.moderateDriftThreshold / 100) {
    severity = 'warning'
    title = 'Moderate Drift'
    description = `"${goal.title}" needs attention. You're at ${actualProgress.toFixed(1)}% but should be at ${expectedProgress.toFixed(1)}%.`
  } else {
    severity = 'critical'
    title = 'Critical Drift'
    description = `"${goal.title}" is significantly behind. Current progress: ${actualProgress.toFixed(1)}%, expected: ${expectedProgress.toFixed(1)}%. Consider adjusting your approach or timeline.`
  }

  insights.push({
    id: `drift-${goal.id}-${Date.now()}`,
    goalId: goal.id,
    goalTitle: goal.title,
    type: 'drift_alert',
    severity,
    title,
    description,
    icon: severity === 'critical' ? 'AlertTriangle' : severity === 'warning' ? 'AlertCircle' : 'CheckCircle',
    createdAt: new Date().toISOString(),
    actionable: severity === 'critical' || severity === 'warning' ? {
      label: 'Review Goal',
      action: 'navigate_to_goal',
      params: { goalId: goal.id }
    } : undefined,
  })

  return insights
}

function generateMilestoneInsights(
  goal: LifeGoal,
  projection: GoalProjection
): GoalInsight[] {
  const insights: GoalInsight[] = []

  // Check if approaching a milestone (within 10% of next milestone)
  const milestonePoints = [25, 50, 75, 90, 100]
  const currentProgress = projection.percentComplete

  for (const milestone of milestonePoints) {
    const distanceToMilestone = milestone - currentProgress
    if (distanceToMilestone > 0 && distanceToMilestone <= 10) {
      insights.push({
        id: `milestone-approaching-${goal.id}-${milestone}`,
        goalId: goal.id,
        goalTitle: goal.title,
        type: 'milestone',
        severity: 'info',
        title: `Approaching ${milestone}% Milestone`,
        description: `"${goal.title}" is ${distanceToMilestone.toFixed(1)}% away from the ${milestone}% milestone!`,
        icon: 'Flag',
        createdAt: new Date().toISOString(),
      })
      break // Only show the next upcoming milestone
    }
  }

  return insights
}

function generateAchievementInsights(
  goal: LifeGoal,
  projection: GoalProjection
): GoalInsight[] {
  const insights: GoalInsight[] = []

  // Check for completion
  if (projection.percentComplete >= 100 && goal.status !== 'completed') {
    insights.push({
      id: `achievement-complete-${goal.id}`,
      goalId: goal.id,
      goalTitle: goal.title,
      type: 'achievement',
      severity: 'success',
      title: 'Goal Achieved!',
      description: `Congratulations! "${goal.title}" has reached its target. Consider marking it as complete.`,
      icon: 'Trophy',
      createdAt: new Date().toISOString(),
      actionable: {
        label: 'Mark Complete',
        action: 'mark_goal_complete',
        params: { goalId: goal.id }
      }
    })
  }

  // Check for ahead of schedule
  if (projection.onTrack && projection.estimatedCompletionDate && goal.target_date) {
    const targetDate = new Date(goal.target_date)
    const daysAhead = Math.floor(
      (targetDate.getTime() - projection.estimatedCompletionDate.getTime()) /
        (1000 * 60 * 60 * 24)
    )

    if (daysAhead >= 30) {
      insights.push({
        id: `achievement-ahead-${goal.id}`,
        goalId: goal.id,
        goalTitle: goal.title,
        type: 'achievement',
        severity: 'success',
        title: 'Ahead of Schedule',
        description: `"${goal.title}" is projected to complete ${daysAhead} days early. Great progress!`,
        icon: 'Rocket',
        createdAt: new Date().toISOString(),
      })
    }
  }

  return insights
}

function generateTrendInsights(
  goal: LifeGoal,
  projection: GoalProjection
): GoalInsight[] {
  const insights: GoalInsight[] = []

  if (projection.dataPoints < 5) return insights // Need enough data for trend

  if (projection.progressTrend === 'improving') {
    insights.push({
      id: `trend-improving-${goal.id}`,
      goalId: goal.id,
      goalTitle: goal.title,
      type: 'trend',
      severity: 'success',
      title: 'Progress Accelerating',
      description: `"${goal.title}" progress is accelerating. Your recent rate is higher than before.`,
      icon: 'TrendingUp',
      createdAt: new Date().toISOString(),
    })
  } else if (projection.progressTrend === 'declining') {
    insights.push({
      id: `trend-declining-${goal.id}`,
      goalId: goal.id,
      goalTitle: goal.title,
      type: 'trend',
      severity: 'warning',
      title: 'Progress Slowing',
      description: `"${goal.title}" progress has slowed down recently. Consider what might be causing this.`,
      icon: 'TrendingDown',
      createdAt: new Date().toISOString(),
    })
  }

  return insights
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

/**
 * Generate recommendations for a goal
 */
export function getRecommendations(
  goal: LifeGoal,
  projection: GoalProjection,
  financialData?: FinancialSummary
): GoalRecommendation[] {
  const recommendations: GoalRecommendation[] = []

  // If goal is behind, suggest increasing contribution
  if (!projection.onTrack && projection.shortfall && projection.requiredRate) {
    const monthlyIncrease = projection.requiredRate * 30 - projection.progressRateMonthly

    recommendations.push({
      id: `rec-increase-${goal.id}`,
      goalId: goal.id,
      type: 'increase_contribution',
      title: 'Increase Monthly Contribution',
      description: `To get back on track, increase your monthly progress by ${monthlyIncrease.toFixed(2)} ${goal.target_unit || 'units'}.`,
      impact: 'high',
      effort: 'medium',
    })

    // Suggest timeline adjustment if significantly behind
    if (projection.percentComplete < 50 && projection.daysRemaining && projection.daysRemaining < 90) {
      recommendations.push({
        id: `rec-timeline-${goal.id}`,
        goalId: goal.id,
        type: 'adjust_timeline',
        title: 'Consider Extending Timeline',
        description: `With current progress, consider extending the deadline by ${Math.ceil((projection.shortfall || 0) / projection.progressRate)} days.`,
        impact: 'medium',
        effort: 'low',
      })
    }
  }

  // If goal has high savings rate requirement and user has low savings rate
  if (financialData && goal.linked_metric === 'savings_rate') {
    if (financialData.savingsRate < (goal.target_value || 0)) {
      const gap = (goal.target_value || 0) - financialData.savingsRate
      recommendations.push({
        id: `rec-savings-${goal.id}`,
        goalId: goal.id,
        type: 'general',
        title: 'Review Expenses',
        description: `Your current savings rate is ${financialData.savingsRate.toFixed(1)}%. Reducing expenses by ${gap.toFixed(1)}% would help reach your target.`,
        impact: 'high',
        effort: 'medium',
      })
    }
  }

  // Celebrate if on track
  if (projection.onTrack && projection.percentComplete > 75) {
    recommendations.push({
      id: `rec-celebrate-${goal.id}`,
      goalId: goal.id,
      type: 'celebrate',
      title: 'You\'re Doing Great!',
      description: `"${goal.title}" is ${projection.percentComplete.toFixed(1)}% complete and on track. Keep up the excellent work!`,
      impact: 'low',
      effort: 'low',
    })
  }

  return recommendations
}

// ============================================================================
// SUMMARY GENERATION
// ============================================================================

/**
 * Generate a complete insights summary for all goals
 */
export function generateInsightsSummary(input: InsightsInput): InsightsSummary {
  const insights = generateInsights(input)
  const projections: GoalProjection[] = []

  // Generate projections for all active goals
  for (const goal of input.goals) {
    if (!goal.is_active) continue
    const snapshots = input.progressHistory.get(goal.id) || []
    projections.push(calculateProjection(goal, snapshots))
  }

  // Count goals by status
  const goalsOnTrack = projections.filter(p => p.onTrack).length
  const goalsAtRisk = insights.filter(i => i.type === 'drift_alert' && i.severity === 'warning').length
  const goalsCritical = insights.filter(i => i.type === 'drift_alert' && i.severity === 'critical').length
  const goalsCompleted = input.goals.filter(g => g.status === 'completed').length

  // Count by severity
  const criticalCount = insights.filter(i => i.severity === 'critical').length
  const warningCount = insights.filter(i => i.severity === 'warning').length
  const successCount = insights.filter(i => i.severity === 'success').length
  const infoCount = insights.filter(i => i.severity === 'info').length

  return {
    totalGoals: input.goals.filter(g => g.is_active).length,
    goalsOnTrack,
    goalsAtRisk,
    goalsCritical,
    goalsCompleted,
    insights,
    projections,
    criticalCount,
    warningCount,
    successCount,
    infoCount,
    generatedAt: new Date().toISOString(),
  }
}

// ============================================================================
// WHAT-IF ANALYSIS
// ============================================================================

/**
 * Calculate what-if scenario for adjusted contribution
 */
export function calculateWhatIf(
  goal: LifeGoal,
  projection: GoalProjection,
  monthlyContributionIncrease: number
): {
  newCompletionDate: Date | null
  daysSaved: number
  improvementPercent: number
} {
  if (projection.progressRateMonthly <= 0) {
    return {
      newCompletionDate: null,
      daysSaved: 0,
      improvementPercent: 0,
    }
  }

  const newMonthlyRate = projection.progressRateMonthly + monthlyContributionIncrease
  const newDailyRate = newMonthlyRate / 30
  const remaining = (goal.target_value || 100) - goal.current_value

  if (remaining <= 0 || newDailyRate <= 0) {
    return {
      newCompletionDate: new Date(),
      daysSaved: projection.estimatedDaysToComplete || 0,
      improvementPercent: 100,
    }
  }

  const newDaysToComplete = Math.ceil(remaining / newDailyRate)
  const newCompletionDate = new Date()
  newCompletionDate.setDate(newCompletionDate.getDate() + newDaysToComplete)

  const daysSaved = (projection.estimatedDaysToComplete || 0) - newDaysToComplete
  const improvementPercent = projection.estimatedDaysToComplete
    ? (daysSaved / projection.estimatedDaysToComplete) * 100
    : 0

  return {
    newCompletionDate,
    daysSaved,
    improvementPercent: Math.max(0, improvementPercent),
  }
}
