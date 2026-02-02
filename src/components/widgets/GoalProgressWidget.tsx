/**
 * Goal Progress Widget
 *
 * Compact widget for displaying top priority goals with progress
 * Designed for dashboard integration
 */

import { useState, useEffect } from 'react'
import { Target, AlertCircle, ChevronRight, TrendingUp } from 'lucide-react'
import { LifeGoal, UserDriftSettings, DEFAULT_DRIFT_SETTINGS } from '../../types/lifeGoals'
import {
  getLifeGoals,
  getDriftSettings,
  calculateGoalProgress,
  isGoalDrifting,
  formatGoalValue,
} from '../../utils/lifeGoalsService'

interface GoalProgressWidgetProps {
  onViewAllClick?: () => void
  maxGoals?: number
}

export default function GoalProgressWidget({
  onViewAllClick,
  maxGoals = 3,
}: GoalProgressWidgetProps) {
  const [goals, setGoals] = useState<LifeGoal[]>([])
  const [driftSettings, setDriftSettings] = useState<UserDriftSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [goalsData, settingsData] = await Promise.all([
          getLifeGoals(),
          getDriftSettings(),
        ])

        // Filter active goals and sort by priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        const activeGoals = goalsData
          .filter((g) => g.is_active && g.status !== 'completed' && g.status !== 'paused')
          .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
          .slice(0, maxGoals)

        setGoals(activeGoals)
        setDriftSettings(
          settingsData || {
            ...DEFAULT_DRIFT_SETTINGS,
            id: '',
            user_id: '',
            created_at: '',
            updated_at: '',
          }
        )
      } catch (error) {
        console.error('Error loading goals for widget:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [maxGoals])

  if (loading) {
    return (
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (goals.length === 0) {
    return (
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            Life Goals
          </h3>
        </div>
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <Target className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No active goals</p>
          <button
            onClick={onViewAllClick}
            className="text-blue-500 hover:underline text-sm mt-1"
          >
            Create your first goal
          </button>
        </div>
      </div>
    )
  }

  // Calculate stats
  const driftCount = goals.filter(
    (g) => driftSettings && isGoalDrifting(g, driftSettings) !== 'none'
  ).length

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl border border-white/50 dark:border-gray-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-blue-500" />
          Life Goals
          {driftCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              {driftCount} at risk
            </span>
          )}
        </h3>
        <button
          onClick={onViewAllClick}
          className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
        >
          View All
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Goals List */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
        {goals.map((goal) => {
          const progress = calculateGoalProgress(goal)
          const driftLevel = driftSettings ? isGoalDrifting(goal, driftSettings) : 'none'

          let progressColor = 'from-blue-500 to-cyan-500'
          if (progress >= 100) progressColor = 'from-green-500 to-emerald-500'
          else if (driftLevel === 'critical') progressColor = 'from-red-500 to-rose-500'
          else if (driftLevel === 'warning') progressColor = 'from-orange-500 to-amber-500'

          return (
            <div key={goal.id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  {driftLevel === 'critical' && (
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  {driftLevel === 'warning' && (
                    <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  )}
                  {driftLevel === 'none' && progress >= 75 && (
                    <TrendingUp className="w-4 h-4 text-green-500 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {goal.title}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-shrink-0 ml-2">
                  {progress.toFixed(0)}%
                </span>
              </div>

              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${progressColor} transition-all duration-500`}
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>{formatGoalValue(goal.current_value, goal.target_unit)}</span>
                <span>{formatGoalValue(goal.target_value || 0, goal.target_unit)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
