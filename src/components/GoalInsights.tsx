/**
 * Goal Insights Component
 *
 * Displays projections, insights, and recommendations for life goals
 * Uses the insightsService to generate intelligent analysis
 */

import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Trophy,
  Flag,
  Rocket,
  Clock,
  Target,
  Lightbulb,
  BarChart3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Calculator,
  ArrowRight,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { format, addDays } from 'date-fns'
import type { LucideIcon } from 'lucide-react'

import { LifeGoal, GoalProgressSnapshot } from '../types/lifeGoals'
import {
  GoalInsight,
  InsightsSummary,
  InsightsInput,
} from '../types/insights'
import {
  generateInsightsSummary,
  calculateWhatIf,
} from '../utils/insightsService'
import { getGoalProgressHistory } from '../utils/lifeGoalsService'
import { formatGoalValue } from '../utils/lifeGoalsService'

// ============================================================================
// ICON MAPPING
// ============================================================================

const INSIGHT_ICONS: Record<string, LucideIcon> = {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Trophy,
  Flag,
  Rocket,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
}

function getInsightIcon(iconName?: string): LucideIcon {
  return iconName && INSIGHT_ICONS[iconName] ? INSIGHT_ICONS[iconName] : AlertCircle
}

// ============================================================================
// TYPES
// ============================================================================

interface GoalInsightsProps {
  goals: LifeGoal[]
  onNavigateToGoal?: (goalId: string) => void
  onMarkComplete?: (goalId: string) => void
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GoalInsights({
  goals,
  onNavigateToGoal,
  onMarkComplete,
}: GoalInsightsProps) {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<InsightsSummary | null>(null)
  const [progressHistory, setProgressHistory] = useState<Map<string, GoalProgressSnapshot[]>>(
    new Map()
  )
  const [expandedProjection, setExpandedProjection] = useState<string | null>(null)
  const [whatIfGoalId, setWhatIfGoalId] = useState<string | null>(null)
  const [whatIfContribution, setWhatIfContribution] = useState<number>(100)

  // Load progress history for all goals
  useEffect(() => {
    async function loadProgressHistory() {
      setLoading(true)
      try {
        const historyMap = new Map<string, GoalProgressSnapshot[]>()

        await Promise.all(
          goals.map(async (goal) => {
            try {
              const history = await getGoalProgressHistory(goal.id, 60)
              historyMap.set(goal.id, history)
            } catch (error) {
              console.error(`Error loading history for goal ${goal.id}:`, error)
              historyMap.set(goal.id, [])
            }
          })
        )

        setProgressHistory(historyMap)

        // Generate insights
        const input: InsightsInput = {
          goals: goals.filter((g) => g.is_active),
          progressHistory: historyMap,
        }
        const insightsSummary = generateInsightsSummary(input)
        setSummary(insightsSummary)
      } catch (error) {
        console.error('Error generating insights:', error)
      } finally {
        setLoading(false)
      }
    }

    if (goals.length > 0) {
      loadProgressHistory()
    } else {
      setLoading(false)
    }
  }, [goals])

  // Compute what-if results
  const whatIfResults = useMemo(() => {
    if (!whatIfGoalId || !summary) return null

    const goal = goals.find((g) => g.id === whatIfGoalId)
    const projection = summary.projections.find((p) => p.goalId === whatIfGoalId)

    if (!goal || !projection) return null

    return calculateWhatIf(goal, projection, whatIfContribution)
  }, [whatIfGoalId, whatIfContribution, summary, goals])

  // Severity styling
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-100 dark:bg-red-900/30',
          border: 'border-red-200 dark:border-red-800',
          text: 'text-red-700 dark:text-red-400',
          icon: 'text-red-500',
        }
      case 'warning':
        return {
          bg: 'bg-orange-100 dark:bg-orange-900/30',
          border: 'border-orange-200 dark:border-orange-800',
          text: 'text-orange-700 dark:text-orange-400',
          icon: 'text-orange-500',
        }
      case 'success':
        return {
          bg: 'bg-green-100 dark:bg-green-900/30',
          border: 'border-green-200 dark:border-green-800',
          text: 'text-green-700 dark:text-green-400',
          icon: 'text-green-500',
        }
      default:
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-700 dark:text-blue-400',
          icon: 'text-blue-500',
        }
    }
  }

  // Handle insight actions
  const handleInsightAction = (insight: GoalInsight) => {
    if (!insight.actionable) return

    switch (insight.actionable.action) {
      case 'navigate_to_goal':
        onNavigateToGoal?.(insight.goalId)
        break
      case 'mark_goal_complete':
        onMarkComplete?.(insight.goalId)
        break
    }
  }

  // ============================================================================
  // RENDER LOADING
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Analyzing your goals...</p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER EMPTY STATE
  // ============================================================================

  if (!summary || summary.totalGoals === 0) {
    return (
      <div className="text-center py-12">
        <Lightbulb className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Insights Available
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          Create some goals and track your progress to see intelligent insights and projections.
        </p>
      </div>
    )
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.goalsOnTrack}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">On Track</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.goalsAtRisk}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">At Risk</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.goalsCritical}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Critical</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Trophy className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.goalsCompleted}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Insights List */}
      {summary.insights.length > 0 && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Insights</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
              {summary.insights.length} insights
            </span>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {summary.insights.slice(0, 10).map((insight) => {
              const styles = getSeverityStyles(insight.severity)
              const IconComponent = getInsightIcon(insight.icon)

              return (
                <div
                  key={insight.id}
                  className={`p-4 ${styles.bg} ${styles.border} border-l-4`}
                >
                  <div className="flex items-start gap-3">
                    <IconComponent className={`w-5 h-5 mt-0.5 ${styles.icon}`} />
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium ${styles.text}`}>{insight.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                        {insight.description}
                      </p>
                      {insight.actionable && (
                        <button
                          onClick={() => handleInsightAction(insight)}
                          className={`mt-2 text-sm font-medium ${styles.text} hover:underline flex items-center gap-1`}
                        >
                          {insight.actionable.label}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Projections */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Projections</h3>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {summary.projections.map((projection) => {
            const goal = goals.find((g) => g.id === projection.goalId)
            if (!goal) return null

            const isExpanded = expandedProjection === projection.goalId
            const history = progressHistory.get(projection.goalId) || []

            // Prepare chart data
            const chartData = history
              .slice()
              .reverse()
              .map((snapshot) => ({
                date: format(new Date(snapshot.date), 'MMM d'),
                value: snapshot.value,
              }))

            // Add projected points
            if (projection.progressRate > 0 && chartData.length > 0) {
              const lastValue = goal.current_value
              const today = new Date()
              for (let i = 1; i <= 3; i++) {
                const futureDate = addDays(today, i * 30)
                const projectedValue = lastValue + projection.progressRate * i * 30
                chartData.push({
                  date: format(futureDate, 'MMM d'),
                  value: Math.min(projectedValue, goal.target_value || projectedValue),
                })
              }
            }

            return (
              <div key={projection.goalId}>
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  onClick={() =>
                    setExpandedProjection(isExpanded ? null : projection.goalId)
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {projection.goalTitle}
                      </h4>
                      <div className="flex items-center gap-3 mt-1 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          {projection.percentComplete.toFixed(0)}% complete
                        </span>
                        {projection.onTrack ? (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            On Track
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                            <AlertCircle className="w-4 h-4" />
                            Behind
                          </span>
                        )}
                        {projection.progressTrend === 'improving' && (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <TrendingUp className="w-4 h-4" />
                            Accelerating
                          </span>
                        )}
                        {projection.progressTrend === 'declining' && (
                          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                            <TrendingDown className="w-4 h-4" />
                            Slowing
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {projection.estimatedCompletionDate && (
                        <div className="text-right hidden sm:block">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Est. Completion
                          </p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {format(projection.estimatedCompletionDate, 'MMM d, yyyy')}
                          </p>
                        </div>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700/50">
                    {/* Progress Chart */}
                    {chartData.length > 1 && (
                      <div className="mt-4 h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#374151"
                              opacity={0.2}
                            />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 12 }}
                              stroke="#9CA3AF"
                            />
                            <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1F2937',
                                border: 'none',
                                borderRadius: '8px',
                              }}
                              formatter={(value: number) =>
                                formatGoalValue(value, goal.target_unit)
                              }
                            />
                            {goal.target_value && (
                              <ReferenceLine
                                y={goal.target_value}
                                stroke="#10B981"
                                strokeDasharray="5 5"
                                label={{
                                  value: 'Target',
                                  position: 'insideTopRight',
                                  fill: '#10B981',
                                  fontSize: 12,
                                }}
                              />
                            )}
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="#3B82F6"
                              strokeWidth={2}
                              dot={{ fill: '#3B82F6', strokeWidth: 0, r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Projection Details */}
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Current Value
                        </p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatGoalValue(projection.currentValue, goal.target_unit)}
                        </p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Target Value
                        </p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatGoalValue(projection.targetValue, goal.target_unit)}
                        </p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Monthly Rate
                        </p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {projection.progressRateMonthly > 0 ? '+' : ''}
                          {formatGoalValue(projection.progressRateMonthly, goal.target_unit)}
                        </p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Days Remaining
                        </p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {projection.daysRemaining !== null
                            ? projection.daysRemaining
                            : 'No deadline'}
                        </p>
                      </div>
                    </div>

                    {/* Shortfall Warning */}
                    {projection.shortfall && projection.shortfall > 0 && (
                      <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-orange-700 dark:text-orange-400">
                              Projected Shortfall
                            </p>
                            <p className="text-sm text-orange-600 dark:text-orange-300">
                              At the current rate, you'll be{' '}
                              {formatGoalValue(projection.shortfall, goal.target_unit)} short of
                              your target by the deadline. Consider increasing your monthly
                              contribution to{' '}
                              {formatGoalValue(
                                (projection.requiredRate || 0) * 30,
                                goal.target_unit
                              )}
                              /month.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* What-If Calculator */}
                    <div className="mt-4">
                      <button
                        onClick={() =>
                          setWhatIfGoalId(
                            whatIfGoalId === projection.goalId ? null : projection.goalId
                          )
                        }
                        className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <Calculator className="w-4 h-4" />
                        What-If Calculator
                        {whatIfGoalId === projection.goalId ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {whatIfGoalId === projection.goalId && (
                        <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                            If I increase my monthly contribution by:
                          </p>
                          <div className="flex items-center gap-3 mb-3">
                            <input
                              type="number"
                              value={whatIfContribution}
                              onChange={(e) =>
                                setWhatIfContribution(parseFloat(e.target.value) || 0)
                              }
                              className="w-32 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                            />
                            <span className="text-gray-600 dark:text-gray-400">
                              {goal.target_unit}/month
                            </span>
                          </div>

                          {whatIfResults && (
                            <div className="space-y-2">
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                <strong>New completion date:</strong>{' '}
                                {whatIfResults.newCompletionDate
                                  ? format(whatIfResults.newCompletionDate, 'MMM d, yyyy')
                                  : 'N/A'}
                              </p>
                              {whatIfResults.daysSaved > 0 && (
                                <p className="text-sm text-green-600 dark:text-green-400">
                                  You would reach your goal{' '}
                                  <strong>{whatIfResults.daysSaved} days</strong> earlier!
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
