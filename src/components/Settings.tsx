import { Settings as SettingsIcon, DollarSign, Check, Target, TrendingUp, CreditCard, Tag, Receipt, Repeat, Filter } from 'lucide-react'
import { useCurrency, CURRENCIES } from '../contexts/CurrencyContext'
import { useSettings } from '../contexts/SettingsContext'

export default function Settings() {
  const { currency, setCurrency } = useCurrency()
  const { settings, updateSettings, loading } = useSettings()

  const handleToggle = async (key: keyof typeof settings) => {
    try {
      await updateSettings({ [key]: !settings[key] })
    } catch (error) {
      alert('Failed to update settings')
    }
  }

  const ToggleSwitch = ({
    enabled,
    onChange
  }: {
    enabled: boolean
    onChange: () => void
  }) => (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-gradient-to-r from-blue-500 to-purple-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )

  const FeatureItem = ({
    icon: Icon,
    title,
    description,
    enabled,
    onChange
  }: {
    icon: any
    title: string
    description: string
    enabled: boolean
    onChange: () => void
  }) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/40 dark:bg-gray-700/40 border border-white/30 dark:border-gray-600/30 hover:bg-white/60 dark:hover:bg-gray-700/60 transition-all">
      <div className="flex items-start gap-3 flex-1">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mt-0.5">
          <Icon className="text-blue-600 dark:text-blue-400" size={18} />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 dark:text-white">{title}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      <ToggleSwitch enabled={enabled} onChange={onChange} />
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-8 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <SettingsIcon className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                Settings
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Customize your expense tracker</p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Currency</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Select your preferred currency for displaying amounts</p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {CURRENCIES.map((curr) => (
                  <button
                    key={curr.code}
                    onClick={() => setCurrency(curr)}
                    className={`group/currency relative p-4 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 ${
                      currency.code === curr.code
                        ? 'border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-700 bg-white/30 dark:bg-gray-800/30 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg transition-all ${
                          currency.code === curr.code
                            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {curr.symbol}
                        </div>
                        <div className="text-left">
                          <div className={`font-bold ${
                            currency.code === curr.code
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {curr.code}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">{curr.name}</div>
                        </div>
                      </div>
                      {currency.code === curr.code && (
                        <div className="w-6 h-6 rounded-full bg-blue-500 dark:bg-blue-400 flex items-center justify-center animate-fade-in">
                          <Check className="text-white" size={14} />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <Target className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Budget & Goals</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Enable budget tracking and savings goals</p>

              <div className="space-y-3">
                <FeatureItem
                  icon={Target}
                  title="Budget Limits"
                  description="Set monthly budget limits per category"
                  enabled={settings.feature_budgets}
                  onChange={() => handleToggle('feature_budgets')}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Enhanced Tracking</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Track more details about your finances</p>

              <div className="space-y-3">
                <FeatureItem
                  icon={Repeat}
                  title="Recurring Expenses"
                  description="Track recurring expenses like rent and subscriptions"
                  enabled={settings.feature_recurring}
                  onChange={() => handleToggle('feature_recurring')}
                />
                <FeatureItem
                  icon={TrendingUp}
                  title="Income Tracking"
                  description="Track income to see net cash flow"
                  enabled={settings.feature_income}
                  onChange={() => handleToggle('feature_income')}
                />
                <FeatureItem
                  icon={CreditCard}
                  title="Payment Methods"
                  description="Track payment method for each expense"
                  enabled={settings.feature_payment_methods}
                  onChange={() => handleToggle('feature_payment_methods')}
                />
                <FeatureItem
                  icon={Tag}
                  title="Tags"
                  description="Organize expenses with custom tags"
                  enabled={settings.feature_tags}
                  onChange={() => handleToggle('feature_tags')}
                />
                <FeatureItem
                  icon={Receipt}
                  title="Receipt Uploads"
                  description="Attach receipt images to expenses"
                  enabled={settings.feature_receipts}
                  onChange={() => handleToggle('feature_receipts')}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="text-blue-600 dark:text-blue-400" size={20} />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Filtering & Search</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Advanced filtering and search options</p>

              <div className="space-y-3">
                <FeatureItem
                  icon={Filter}
                  title="Advanced Filters"
                  description="Search and filter expenses by multiple criteria"
                  enabled={settings.feature_advanced_filters}
                  onChange={() => handleToggle('feature_advanced_filters')}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 dark:bg-blue-600/30 flex items-center justify-center mt-0.5">
                    <SettingsIcon className="text-blue-600 dark:text-blue-400" size={16} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Feature Toggles</h4>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Enable or disable features based on your needs. Changes take effect immediately.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
