import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Plus, Target, Edit2, Trash2, X, TrendingUp, AlertCircle,
  CheckCircle2, Folder, ChevronDown, ChevronUp, Clock,
  Play, Pause, Milestone, Layers, Lightbulb
} from 'lucide-react'
import GoalInsights from './GoalInsights'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import {
  LifeGoal, GoalCategory, GoalMilestone, UserDriftSettings,
  GoalFormData, CategoryFormData,
  CATEGORY_COLORS, CATEGORY_ICONS, PRIORITY_CONFIG, STATUS_CONFIG,
  LINKED_METRIC_LABELS, GOAL_TEMPLATES, DEFAULT_DRIFT_SETTINGS,
  GoalTargetType, GoalPriority, GoalStatus, LinkedMetricType
} from '../types/lifeGoals'
import {
  getLifeGoals, createLifeGoal, updateLifeGoal, deleteLifeGoal,
  getGoalCategories, createGoalCategory, updateGoalCategory, deleteGoalCategory,
  getGoalMilestones,
  getDriftSettings,
  saveGoalProgress,
  syncLinkedGoals, getLinkedMetricValue,
  calculateGoalProgress, daysUntilTarget, isGoalDrifting, formatGoalValue
} from '../utils/lifeGoalsService'
import type { LucideIcon } from 'lucide-react'
import * as LucideIcons from 'lucide-react'

// ============================================================================
// ICON HELPER
// ============================================================================

function getIconComponent(iconName: string): LucideIcon {
  const icons = LucideIcons as unknown as Record<string, LucideIcon>
  return icons[iconName] || Target
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LifeGoals() {
  const { user } = useAuth()

  // Data state
  const [goals, setGoals] = useState<LifeGoal[]>([])
  const [categories, setCategories] = useState<GoalCategory[]>([])
  const [driftSettings, setDriftSettings] = useState<UserDriftSettings | null>(null)
  const [loading, setLoading] = useState(true)

  // UI state
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [editingGoal, setEditingGoal] = useState<LifeGoal | null>(null)
  const [editingCategory, setEditingCategory] = useState<GoalCategory | null>(null)
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set())
  const [milestones, setMilestones] = useState<GoalMilestone[]>([])
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'categories' | 'insights'>('active')

  // Form state
  const [goalForm, setGoalForm] = useState<GoalFormData>({
    title: '',
    description: '',
    category_id: '',
    priority: 'medium',
    target_type: 'numeric',
    target_value: '',
    target_unit: '$',
    current_value: '0',
    linked_metric: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    target_date: '',
    notes: '',
    tags: []
  })

  const [categoryForm, setCategoryForm] = useState<CategoryFormData>({
    name: '',
    description: '',
    color: CATEGORY_COLORS[0],
    icon: 'Target'
  })

  const formRef = useRef<HTMLDivElement>(null)

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData()
  }, [user])

  const loadData = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // First sync linked goals with latest metric values
      await syncLinkedGoals()

      // Then fetch all data
      const [goalsData, categoriesData, settingsData] = await Promise.all([
        getLifeGoals(),
        getGoalCategories(),
        getDriftSettings()
      ])

      setGoals(goalsData)
      setCategories(categoriesData)
      setDriftSettings(settingsData || { ...DEFAULT_DRIFT_SETTINGS, id: '', user_id: '', created_at: '', updated_at: '' })
    } catch (error) {
      console.error('Error loading life goals data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMilestones = async (goalId: string) => {
    try {
      const data = await getGoalMilestones(goalId)
      setMilestones(data)
    } catch (error) {
      console.error('Error loading milestones:', error)
    }
  }

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const activeGoals = useMemo(() =>
    goals.filter(g => g.status !== 'completed' && g.status !== 'paused'),
    [goals]
  )

  const completedGoals = useMemo(() =>
    goals.filter(g => g.status === 'completed'),
    [goals]
  )

  const goalsByCategory = useMemo(() => {
    const grouped: Record<string, LifeGoal[]> = {}
    const targetGoals = activeTab === 'completed' ? completedGoals : activeGoals

    targetGoals.forEach(goal => {
      const catId = goal.category_id || 'uncategorized'
      if (!grouped[catId]) grouped[catId] = []
      grouped[catId].push(goal)
    })

    return grouped
  }, [activeGoals, completedGoals, activeTab])

  const stats = useMemo(() => {
    const total = goals.length
    const completed = goals.filter(g => g.status === 'completed').length
    const onTrack = goals.filter(g => g.status === 'on_track').length
    const behind = goals.filter(g =>
      driftSettings && isGoalDrifting(g, driftSettings) !== 'none'
    ).length

    return { total, completed, onTrack, behind }
  }, [goals, driftSettings])

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const goalData = {
        category_id: goalForm.category_id,
        title: goalForm.title,
        description: goalForm.description || undefined,
        priority: goalForm.priority as GoalPriority,
        status: 'not_started' as GoalStatus,
        target_type: goalForm.target_type as GoalTargetType,
        target_value: goalForm.target_type === 'numeric' ? parseFloat(goalForm.target_value) : undefined,
        target_unit: goalForm.target_unit || undefined,
        current_value: parseFloat(goalForm.current_value) || 0,
        linked_metric: goalForm.linked_metric as LinkedMetricType || undefined,
        start_date: goalForm.start_date || undefined,
        target_date: goalForm.target_date || undefined,
        notes: goalForm.notes || undefined,
        tags: goalForm.tags.length > 0 ? goalForm.tags : undefined,
        is_active: true
      }

      if (editingGoal) {
        await updateLifeGoal(editingGoal.id, goalData)
      } else {
        await createLifeGoal(goalData)
      }

      await loadData()
      resetGoalForm()
    } catch (error) {
      console.error('Error saving goal:', error)
      alert('Failed to save goal. Please try again.')
    }
  }

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return

    try {
      await deleteLifeGoal(id)
      await loadData()
    } catch (error) {
      console.error('Error deleting goal:', error)
      alert('Failed to delete goal.')
    }
  }

  const handleEditGoal = (goal: LifeGoal) => {
    setEditingGoal(goal)
    setGoalForm({
      title: goal.title,
      description: goal.description || '',
      category_id: goal.category_id,
      priority: goal.priority,
      target_type: goal.target_type,
      target_value: goal.target_value?.toString() || '',
      target_unit: goal.target_unit || '$',
      current_value: goal.current_value.toString(),
      linked_metric: goal.linked_metric || '',
      start_date: goal.start_date || '',
      target_date: goal.target_date || '',
      notes: goal.notes || '',
      tags: goal.tags || []
    })
    setShowGoalForm(true)
  }

  const handleUpdateProgress = async (goalId: string, newValue: number) => {
    try {
      const goal = goals.find(g => g.id === goalId)
      if (!goal) return

      // Determine new status
      let newStatus: GoalStatus = goal.status
      const progress = goal.target_value ? (newValue / goal.target_value) * 100 : 0

      if (progress >= 100) {
        newStatus = 'completed'
      } else if (progress > 0) {
        newStatus = 'in_progress'
      }

      await updateLifeGoal(goalId, { current_value: newValue, status: newStatus })

      // Save progress snapshot
      await saveGoalProgress({
        goal_id: goalId,
        value: newValue,
        date: format(new Date(), 'yyyy-MM-dd')
      })

      await loadData()
    } catch (error) {
      console.error('Error updating progress:', error)
    }
  }

  const handleToggleGoalStatus = async (goal: LifeGoal) => {
    const newStatus: GoalStatus = goal.status === 'paused' ? 'in_progress' : 'paused'
    try {
      await updateLifeGoal(goal.id, { status: newStatus })
      await loadData()
    } catch (error) {
      console.error('Error toggling goal status:', error)
    }
  }

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const categoryData = {
        name: categoryForm.name,
        description: categoryForm.description || undefined,
        color: categoryForm.color,
        icon: categoryForm.icon,
        sort_order: categories.length,
        is_active: true
      }

      if (editingCategory) {
        await updateGoalCategory(editingCategory.id, categoryData)
      } else {
        await createGoalCategory(categoryData)
      }

      await loadData()
      resetCategoryForm()
    } catch (error) {
      console.error('Error saving category:', error)
      alert('Failed to save category.')
    }
  }

  const handleDeleteCategory = async (id: string) => {
    const goalsInCategory = goals.filter(g => g.category_id === id)
    if (goalsInCategory.length > 0) {
      alert(`Cannot delete category with ${goalsInCategory.length} goals. Move or delete goals first.`)
      return
    }

    if (!confirm('Are you sure you want to delete this category?')) return

    try {
      await deleteGoalCategory(id)
      await loadData()
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  const handleUseTemplate = (template: typeof GOAL_TEMPLATES[0]) => {
    // Find or create category
    const existingCategory = categories.find(c =>
      c.name.toLowerCase() === template.category_suggestion.toLowerCase()
    )

    setGoalForm({
      title: template.name,
      description: template.description,
      category_id: existingCategory?.id || '',
      priority: 'medium',
      target_type: template.target_type,
      target_value: '',
      target_unit: template.suggested_unit || '$',
      current_value: '0',
      linked_metric: template.linked_metric || '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      target_date: '',
      notes: '',
      tags: []
    })

    setShowTemplates(false)
    setShowGoalForm(true)
  }

  const resetGoalForm = () => {
    setGoalForm({
      title: '',
      description: '',
      category_id: categories[0]?.id || '',
      priority: 'medium',
      target_type: 'numeric',
      target_value: '',
      target_unit: '$',
      current_value: '0',
      linked_metric: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      target_date: '',
      notes: '',
      tags: []
    })
    setEditingGoal(null)
    setShowGoalForm(false)
  }

  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      description: '',
      color: CATEGORY_COLORS[0],
      icon: 'Target'
    })
    setEditingCategory(null)
    setShowCategoryForm(false)
  }

  const toggleGoalExpanded = (goalId: string) => {
    setExpandedGoals(prev => {
      const next = new Set(prev)
      if (next.has(goalId)) {
        next.delete(goalId)
      } else {
        next.add(goalId)
        loadMilestones(goalId)
      }
      return next
    })
  }

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderProgressBar = (goal: LifeGoal) => {
    const progress = calculateGoalProgress(goal)
    const driftLevel = driftSettings ? isGoalDrifting(goal, driftSettings) : 'none'

    let barColor = 'from-blue-500 to-cyan-500'
    if (progress >= 100) barColor = 'from-green-500 to-emerald-500'
    else if (driftLevel === 'critical') barColor = 'from-red-500 to-rose-500'
    else if (driftLevel === 'warning') barColor = 'from-orange-500 to-amber-500'

    return (
      <div className="w-full">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600 dark:text-gray-400">
            {formatGoalValue(goal.current_value, goal.target_unit)}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {progress.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${barColor} transition-all duration-500`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        {goal.target_value && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
            Target: {formatGoalValue(goal.target_value, goal.target_unit)}
          </div>
        )}
      </div>
    )
  }

  const renderGoalCard = (goal: LifeGoal) => {
    const category = categories.find(c => c.id === goal.category_id)
    const IconComponent = category ? getIconComponent(category.icon) : Target
    const isExpanded = expandedGoals.has(goal.id)
    const daysLeft = daysUntilTarget(goal)
    const driftLevel = driftSettings ? isGoalDrifting(goal, driftSettings) : 'none'
    const priorityConfig = PRIORITY_CONFIG[goal.priority]
    const statusConfig = STATUS_CONFIG[goal.status]

    return (
      <div
        key={goal.id}
        className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border border-white/50 dark:border-gray-700/50 shadow-lg overflow-hidden transition-all duration-300"
      >
        {/* Header */}
        <div
          className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          onClick={() => toggleGoalExpanded(goal.id)}
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className="p-2.5 rounded-xl flex-shrink-0"
              style={{ backgroundColor: `${category?.color || '#3B82F6'}20` }}
            >
              <IconComponent
                size={20}
                style={{ color: category?.color || '#3B82F6' }}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {goal.title}
                </h3>
                {driftLevel !== 'none' && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    driftLevel === 'critical'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                  }`}>
                    <AlertCircle size={12} className="inline mr-1" />
                    {driftLevel === 'critical' ? 'Behind' : 'Drifting'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className={`px-2 py-0.5 rounded-full ${priorityConfig.bgColor} ${priorityConfig.color}`}>
                  {priorityConfig.label}
                </span>
                <span className={`px-2 py-0.5 rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
                {daysLeft !== null && daysLeft > 0 && (
                  <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Clock size={12} />
                    {daysLeft} days left
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                {renderProgressBar(goal)}
              </div>
            </div>

            {/* Expand icon */}
            <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
            {/* Description */}
            {goal.description && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {goal.description}
              </p>
            )}

            {/* Quick progress update */}
            {goal.target_type === 'numeric' && goal.status !== 'completed' && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Update Progress
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    defaultValue={goal.current_value}
                    className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value)
                      if (!isNaN(value) && value !== goal.current_value) {
                        handleUpdateProgress(goal.id, value)
                      }
                    }}
                  />
                  <span className="flex items-center px-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                    {goal.target_unit}
                  </span>
                </div>
              </div>
            )}

            {/* Milestones */}
            {milestones.filter(m => m.goal_id === goal.id).length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <Milestone size={14} />
                  Milestones
                </h4>
                <div className="space-y-2">
                  {milestones
                    .filter(m => m.goal_id === goal.id)
                    .map(milestone => (
                      <div
                        key={milestone.id}
                        className={`flex items-center gap-2 text-sm p-2 rounded-lg ${
                          milestone.is_completed
                            ? 'bg-green-50 dark:bg-green-900/20'
                            : 'bg-gray-50 dark:bg-gray-900/50'
                        }`}
                      >
                        <CheckCircle2
                          size={16}
                          className={milestone.is_completed
                            ? 'text-green-500'
                            : 'text-gray-300 dark:text-gray-600'
                          }
                        />
                        <span className={milestone.is_completed
                          ? 'text-green-700 dark:text-green-400 line-through'
                          : 'text-gray-700 dark:text-gray-300'
                        }>
                          {milestone.title}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => handleEditGoal(goal)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                <Edit2 size={14} />
                Edit
              </button>
              <button
                onClick={() => handleToggleGoalStatus(goal)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {goal.status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
                {goal.status === 'paused' ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={() => handleDeleteGoal(goal.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading your goals...</p>
        </div>
      </div>
    )
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="text-blue-500" size={28} />
            Life Goals
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track your progress toward your most important objectives
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Layers size={18} />
            Templates
          </button>
          <button
            onClick={() => setShowGoalForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
          >
            <Plus size={18} />
            New Goal
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Target size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Goals</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle2 size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completed}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <TrendingUp size={20} className="text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.onTrack}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">On Track</p>
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <AlertCircle size={20} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.behind}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Needs Attention</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2 overflow-x-auto">
        {(['active', 'completed', 'insights', 'categories'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === tab
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {tab === 'active' && 'Active Goals'}
            {tab === 'completed' && 'Completed'}
            {tab === 'insights' && (
              <>
                <Lightbulb size={16} />
                Insights
              </>
            )}
            {tab === 'categories' && 'Categories'}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'insights' ? (
        <GoalInsights
          goals={goals}
          onNavigateToGoal={(goalId) => {
            setActiveTab('active')
            setExpandedGoals(new Set([goalId]))
          }}
          onMarkComplete={async (goalId) => {
            try {
              await updateLifeGoal(goalId, { status: 'completed' })
              await loadData()
            } catch (error) {
              console.error('Error marking goal complete:', error)
            }
          }}
        />
      ) : activeTab === 'categories' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowCategoryForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
            >
              <Plus size={18} />
              New Category
            </button>
          </div>

          <div className="grid gap-3">
            {categories.map(category => {
              const IconComponent = getIconComponent(category.icon)
              const goalCount = goals.filter(g => g.category_id === category.id).length

              return (
                <div
                  key={category.id}
                  className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 dark:border-gray-700/50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2.5 rounded-xl"
                      style={{ backgroundColor: `${category.color}20` }}
                    >
                      <IconComponent size={20} style={{ color: category.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{category.description}</p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {goalCount} goal{goalCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingCategory(category)
                        setCategoryForm({
                          name: category.name,
                          description: category.description || '',
                          color: category.color,
                          icon: category.icon
                        })
                        setShowCategoryForm(true)
                      }}
                      className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              )
            })}

            {categories.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Folder size={48} className="mx-auto mb-3 opacity-50" />
                <p>No categories yet</p>
                <p className="text-sm mt-1">Create categories to organize your goals</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(goalsByCategory).map(([categoryId, categoryGoals]) => {
            const category = categories.find(c => c.id === categoryId)
            const IconComponent = category ? getIconComponent(category.icon) : Folder

            return (
              <div key={categoryId}>
                <div className="flex items-center gap-2 mb-3">
                  <IconComponent
                    size={18}
                    style={{ color: category?.color || '#6B7280' }}
                  />
                  <h2 className="font-semibold text-gray-700 dark:text-gray-300">
                    {category?.name || 'Uncategorized'}
                  </h2>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    ({categoryGoals.length})
                  </span>
                </div>

                <div className="grid gap-3">
                  {categoryGoals.map(goal => renderGoalCard(goal))}
                </div>
              </div>
            )
          })}

          {Object.keys(goalsByCategory).length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Target size={48} className="mx-auto mb-3 opacity-50" />
              <p>{activeTab === 'completed' ? 'No completed goals yet' : 'No active goals'}</p>
              <p className="text-sm mt-1">
                {activeTab === 'completed'
                  ? 'Complete some goals to see them here'
                  : 'Create a goal to get started on your journey'
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Goal Form Modal */}
      {showGoalForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            ref={formRef}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingGoal ? 'Edit Goal' : 'Create New Goal'}
              </h2>
              <button
                onClick={resetGoalForm}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGoalSubmit} className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Goal Title *
                </label>
                <input
                  type="text"
                  required
                  value={goalForm.title}
                  onChange={e => setGoalForm({ ...goalForm, title: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Build $1M Investment Portfolio"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={goalForm.category_id}
                  onChange={e => setGoalForm({ ...goalForm, category_id: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a category...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Target Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Goal Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['numeric', 'boolean', 'milestone'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setGoalForm({ ...goalForm, target_type: type })}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        goalForm.target_type === type
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-2 border-blue-500'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-2 border-transparent'
                      }`}
                    >
                      {type === 'numeric' && 'Number'}
                      {type === 'boolean' && 'Yes/No'}
                      {type === 'milestone' && 'Milestones'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Value (for numeric) */}
              {goalForm.target_type === 'numeric' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Target Value *
                    </label>
                    <input
                      type="number"
                      required
                      value={goalForm.target_value}
                      onChange={e => setGoalForm({ ...goalForm, target_value: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      placeholder="1000000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={goalForm.target_unit}
                      onChange={e => setGoalForm({ ...goalForm, target_unit: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                      placeholder="$ or units"
                    />
                  </div>
                </div>
              )}

              {/* Current Value */}
              {goalForm.target_type === 'numeric' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Current Value
                  </label>
                  <input
                    type="number"
                    value={goalForm.current_value}
                    onChange={e => setGoalForm({ ...goalForm, current_value: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'critical'] as const).map(priority => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => setGoalForm({ ...goalForm, priority })}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        goalForm.priority === priority
                          ? `${PRIORITY_CONFIG[priority].bgColor} ${PRIORITY_CONFIG[priority].color} border-2 border-current`
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-2 border-transparent'
                      }`}
                    >
                      {PRIORITY_CONFIG[priority].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Linked Metric */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Auto-track from (optional)
                </label>
                <select
                  value={goalForm.linked_metric}
                  onChange={async (e) => {
                    const metric = e.target.value as LinkedMetricType | ''
                    setGoalForm({ ...goalForm, linked_metric: metric })

                    // Auto-fetch current value when a metric is selected
                    if (metric && metric !== 'custom') {
                      try {
                        const value = await getLinkedMetricValue(metric)
                        setGoalForm(prev => ({ ...prev, linked_metric: metric, current_value: value.toString() }))
                      } catch (error) {
                        console.error('Error fetching metric value:', error)
                      }
                    }
                  }}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Manual tracking only</option>
                  {Object.entries(LINKED_METRIC_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Link to automatically update progress from your tracked data
                </p>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={goalForm.start_date}
                    onChange={e => setGoalForm({ ...goalForm, start_date: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={goalForm.target_date}
                    onChange={e => setGoalForm({ ...goalForm, target_date: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={goalForm.description}
                  onChange={e => setGoalForm({ ...goalForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Why is this goal important to you?"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetGoalForm}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
                >
                  {editingGoal ? 'Save Changes' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </h2>
              <button
                onClick={resetCategoryForm}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Financial Freedom"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={categoryForm.description}
                  onChange={e => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setCategoryForm({ ...categoryForm, color })}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        categoryForm.color === color ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_ICONS.map(iconName => {
                    const IconComp = getIconComponent(iconName)
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setCategoryForm({ ...categoryForm, icon: iconName })}
                        className={`p-2 rounded-lg transition-colors ${
                          categoryForm.icon === iconName
                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <IconComp size={20} />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetCategoryForm}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
                >
                  {editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Goal Templates
              </h2>
              <button
                onClick={() => setShowTemplates(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Choose a template to quickly set up a goal, then customize it to fit your needs.
              </p>

              {GOAL_TEMPLATES.map(template => {
                const IconComp = getIconComponent(template.icon)
                return (
                  <button
                    key={template.id}
                    onClick={() => handleUseTemplate(template)}
                    className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${template.color}20` }}
                      >
                        <IconComp size={20} style={{ color: template.color }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {template.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                          {template.description}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Category: {template.category_suggestion}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowTemplates(false)
                    setShowGoalForm(true)
                  }}
                  className="w-full px-4 py-3 text-center text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                >
                  Or create a custom goal from scratch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
