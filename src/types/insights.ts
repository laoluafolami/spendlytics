/**
 * Insights Type Definitions
 *
 * Types for goal projections, insights, and recommendations
 */

import { LifeGoal, GoalProgressSnapshot } from './lifeGoals'
import { FinancialSummary } from './finance'

// ============================================================================
// INSIGHT TYPES
// ============================================================================

/**
 * Types of insights that can be generated
 */
export type InsightType =
  | 'projection'       // Future projections based on progress
  | 'recommendation'   // Actionable suggestions
  | 'milestone'        // Milestone approaching or achieved
  | 'drift_alert'      // Goal is drifting off track
  | 'achievement'      // Goal completed or major progress
  | 'trend'            // Trend analysis (improving/declining)

/**
 * Severity levels for insights
 */
export type InsightSeverity = 'info' | 'success' | 'warning' | 'critical'

/**
 * A single insight about a goal
 */
export interface GoalInsight {
  id: string
  goalId: string
  goalTitle: string
  type: InsightType
  severity: InsightSeverity
  title: string
  description: string
  actionable?: {
    label: string
    action: string       // Action identifier for handling
    params?: Record<string, unknown>
  }
  icon?: string          // Lucide icon name
  createdAt: string
}

// ============================================================================
// PROJECTION TYPES
// ============================================================================

/**
 * Projection data for a goal based on historical progress
 */
export interface GoalProjection {
  goalId: string
  goalTitle: string

  // Current state
  currentValue: number
  targetValue: number
  percentComplete: number

  // Progress analysis
  progressRate: number           // Average change per day
  progressRateMonthly: number    // Average change per month
  progressTrend: 'improving' | 'stable' | 'declining'

  // Timeline
  daysRemaining: number | null   // Days until target date
  estimatedCompletionDate: Date | null
  estimatedDaysToComplete: number | null

  // Status
  onTrack: boolean
  projectedValueAtDeadline: number | null
  shortfall: number | null       // If projected < target
  requiredRate: number | null    // Rate needed to hit target

  // Confidence
  dataPoints: number             // Number of snapshots used
  confidence: 'high' | 'medium' | 'low'
}

// ============================================================================
// RECOMMENDATION TYPES
// ============================================================================

/**
 * A recommendation for improving goal progress
 */
export interface GoalRecommendation {
  id: string
  goalId: string
  type: 'increase_contribution' | 'adjust_timeline' | 'review_target' | 'celebrate' | 'general'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
  action?: {
    label: string
    handler: string
  }
}

// ============================================================================
// INSIGHT CONFIGURATION
// ============================================================================

/**
 * Configuration for insight generation thresholds
 */
export interface InsightConfig {
  // Progress thresholds (as percentage of expected progress)
  onTrackThreshold: number        // >= 90% = on track
  slightDriftThreshold: number    // 70-90% = slight drift
  moderateDriftThreshold: number  // 50-70% = moderate drift
  criticalDriftThreshold: number  // < 50% = critical

  // Milestone thresholds
  milestoneApproachingPercent: number  // Alert when within X% of milestone

  // Minimum data points for projections
  minDataPointsForProjection: number

  // Days ahead to look for sell dates/milestones
  upcomingDaysThreshold: number
}

/**
 * Default insight configuration
 */
export const DEFAULT_INSIGHT_CONFIG: InsightConfig = {
  onTrackThreshold: 90,
  slightDriftThreshold: 70,
  moderateDriftThreshold: 50,
  criticalDriftThreshold: 50,
  milestoneApproachingPercent: 10,
  minDataPointsForProjection: 3,
  upcomingDaysThreshold: 30,
}

// ============================================================================
// WHAT-IF ANALYSIS
// ============================================================================

/**
 * What-if scenario for goal planning
 */
export interface WhatIfScenario {
  id: string
  goalId: string
  name: string
  description: string

  // Scenario parameters
  monthlyContribution?: number
  contributionIncrease?: number  // Percentage increase
  targetDateChange?: number      // Days to add/subtract

  // Results
  newCompletionDate: Date | null
  newProgressRate: number
  improvement: number            // Percentage improvement
}

// ============================================================================
// AGGREGATE TYPES
// ============================================================================

/**
 * Summary of all insights across goals
 */
export interface InsightsSummary {
  totalGoals: number
  goalsOnTrack: number
  goalsAtRisk: number
  goalsCritical: number
  goalsCompleted: number

  // Aggregated insights
  insights: GoalInsight[]
  projections: GoalProjection[]

  // Counts by severity
  criticalCount: number
  warningCount: number
  successCount: number
  infoCount: number

  // Last updated
  generatedAt: string
}

/**
 * Input data for generating insights
 */
export interface InsightsInput {
  goals: LifeGoal[]
  progressHistory: Map<string, GoalProgressSnapshot[]>
  financialSummary?: FinancialSummary
  config?: Partial<InsightConfig>
}
