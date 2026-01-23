import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Landmark, Building2, Car, PiggyBank, Briefcase, Gem, Edit2, Trash2, X, TrendingUp, Wallet, Home, Banknote } from 'lucide-react'
import { useCurrency, CURRENCIES } from '../contexts/CurrencyContext'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
// Supabase data service for cloud sync
import { getAssets, createAsset, updateAsset, deleteAsset } from '../utils/financeDataService'
import { Asset } from '../types/finance'

const ASSET_TYPES = [
  { value: 'cash', label: 'Cash', icon: Banknote, category: 'liquid' },
  { value: 'bank_account', label: 'Bank Account', icon: Landmark, category: 'liquid' },
  { value: 'stocks', label: 'Stocks', icon: TrendingUp, category: 'marketable' },
  { value: 'mutual_funds', label: 'Mutual Funds', icon: Briefcase, category: 'marketable' },
  { value: 'real_estate', label: 'Real Estate', icon: Building2, category: 'marketable' },
  { value: 'vehicle', label: 'Vehicle', icon: Car, category: 'personal' },
  { value: 'retirement', label: 'Retirement Account', icon: PiggyBank, category: 'long_term' },
  { value: 'business', label: 'Business Interest', icon: Briefcase, category: 'marketable' },
  { value: 'collectible', label: 'Collectibles', icon: Gem, category: 'personal' },
  { value: 'other', label: 'Other', icon: Wallet, category: 'personal' },
] as const

const CATEGORY_INFO = {
  liquid: { label: 'Cash & Liquid Assets', color: '#3B82F6', icon: Banknote },
  marketable: { label: 'Marketable Assets', color: '#10B981', icon: TrendingUp },
  long_term: { label: 'Long-term Assets', color: '#8B5CF6', icon: PiggyBank },
  personal: { label: 'Personal Assets', color: '#F59E0B', icon: Home },
}

export default function AssetsManager() {
  const { formatAmount, currency, convertAmountSync } = useCurrency()
  const [assets, setAssets] = useState<Asset[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'bank_account' as Asset['type'],
    value: '',
    purchase_price: '',
    purchase_date: '',
    notes: '',
    currency: currency.code
  })

  // Helper to convert asset value to display currency
  const getConvertedValue = useCallback((asset: Asset) => {
    if (asset.currency === currency.code) return asset.value
    return convertAmountSync(asset.value, asset.currency, currency.code)
  }, [currency.code, convertAmountSync])

  // Helper to convert purchase price to display currency
  const getConvertedPurchasePrice = useCallback((asset: Asset) => {
    if (!asset.purchase_price) return null
    if (asset.currency === currency.code) return asset.purchase_price
    return convertAmountSync(asset.purchase_price, asset.currency, currency.code)
  }, [currency.code, convertAmountSync])

  // Load assets from Supabase/localStorage
  const loadAssets = useCallback(async () => {
    try {
      const data = await getAssets()
      setAssets(data)
    } catch (error) {
      console.error('Error loading assets:', error)
    }
  }, [])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const typeInfo = ASSET_TYPES.find(t => t.value === formData.type)
    const assetData = {
      name: formData.name,
      type: formData.type as Asset['type'],
      category: (typeInfo?.category || 'personal') as Asset['category'],
      value: parseFloat(formData.value) || 0,
      currency: formData.currency,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : undefined,
      purchase_date: formData.purchase_date || undefined,
      notes: formData.notes || undefined,
      is_active: true,
    }

    try {
      if (editingAsset) {
        await updateAsset(editingAsset.id, assetData)
      } else {
        await createAsset(assetData)
      }
      await loadAssets()
      resetForm()
    } catch (error) {
      console.error('Error saving asset:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return

    try {
      await deleteAsset(id)
      await loadAssets()
    } catch (error) {
      console.error('Error deleting asset:', error)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingAsset(null)
    setFormData({
      name: '',
      type: 'bank_account',
      value: '',
      purchase_price: '',
      purchase_date: '',
      notes: '',
      currency: currency.code
    })
  }

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset)
    setFormData({
      name: asset.name,
      type: asset.type,
      value: asset.value.toString(),
      purchase_price: asset.purchase_price?.toString() || '',
      purchase_date: asset.purchase_date || '',
      notes: asset.notes || '',
      currency: asset.currency || currency.code
    })
    setShowForm(true)
  }

  // Calculate totals by category (converted to display currency)
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {
      liquid: 0,
      marketable: 0,
      long_term: 0,
      personal: 0
    }

    assets.forEach(asset => {
      totals[asset.category] += getConvertedValue(asset)
    })

    return totals
  }, [assets, getConvertedValue])

  const totalAssets = useMemo(() =>
    assets.reduce((sum, a) => sum + getConvertedValue(a), 0)
  , [assets, getConvertedValue])

  const pieData = useMemo(() =>
    Object.entries(categoryTotals)
      .filter(([_, value]) => value > 0)
      .map(([key, value]) => ({
        name: CATEGORY_INFO[key as keyof typeof CATEGORY_INFO].label,
        value,
        color: CATEGORY_INFO[key as keyof typeof CATEGORY_INFO].color
      }))
  , [categoryTotals])

  // Group assets by category
  const groupedAssets = useMemo(() => {
    const groups: Record<string, Asset[]> = {
      liquid: [],
      marketable: [],
      long_term: [],
      personal: []
    }

    assets.forEach(asset => {
      groups[asset.category].push(asset)
    })

    return groups
  }, [assets])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 dark:from-blue-400 dark:via-cyan-400 dark:to-teal-400 bg-clip-text text-transparent">
            Assets
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Track what you own - Balance Sheet Assets</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-xl font-medium transform hover:scale-105 transition-all duration-300 shadow-lg"
        >
          <Plus size={18} />
          Add Asset
        </button>
      </div>

      {/* Total Assets Card */}
      <div className="group relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">Total Assets</p>
              <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                {formatAmount(totalAssets)}
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
              <Landmark className="text-white" size={28} />
            </div>
          </div>
        </div>
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(CATEGORY_INFO).map(([key, info]) => {
          const Icon = info.icon
          return (
            <div key={key} className="group relative">
              <div className="absolute inset-0 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: info.color }}></div>
              <div className="relative p-4 rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${info.color}20` }}>
                    <Icon size={20} style={{ color: info.color }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{info.label}</p>
                    <p className="font-bold text-gray-900 dark:text-white">{formatAmount(categoryTotals[key])}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Chart and Form Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        {pieData.length > 0 && (
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-10"></div>
            <div className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Asset Allocation</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatAmount(value)}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 justify-center mt-4">
                {pieData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-600 dark:text-gray-400">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Add Form */}
        {showForm && (
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl blur-2xl opacity-10"></div>
            <form onSubmit={handleSubmit} className="relative p-6 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 dark:text-white">
                  {editingAsset ? 'Edit Asset' : 'Add Asset'}
                </h3>
                <button type="button" onClick={resetForm} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asset Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                    placeholder="e.g., GTBank Savings Account"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Asset['type'] })}
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                  >
                    {ASSET_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Value</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                    >
                      {CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purchase Price (Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white"
                    placeholder="Additional details..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-xl font-medium transition-all shadow-lg"
                >
                  {editingAsset ? 'Update Asset' : 'Add Asset'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Assets List by Category */}
      {Object.entries(groupedAssets).map(([category, categoryAssets]) => {
        if (categoryAssets.length === 0) return null
        const info = CATEGORY_INFO[category as keyof typeof CATEGORY_INFO]

        return (
          <div key={category} className="group relative">
            <div className="absolute inset-0 rounded-3xl blur-2xl opacity-10" style={{ backgroundColor: info.color }}></div>
            <div className="relative rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-xl overflow-hidden">
              <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50" style={{ backgroundColor: `${info.color}10` }}>
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <info.icon size={20} style={{ color: info.color }} />
                  {info.label}
                  <span className="ml-auto text-sm font-normal text-gray-500">
                    {formatAmount(categoryTotals[category])}
                  </span>
                </h3>
              </div>
              <div className="divide-y divide-gray-200/30 dark:divide-gray-700/30">
                {categoryAssets.map(asset => {
                  const TypeIcon = ASSET_TYPES.find(t => t.value === asset.type)?.icon || Wallet
                  const convertedValue = getConvertedValue(asset)
                  const convertedPurchasePrice = getConvertedPurchasePrice(asset)
                  const gain = convertedPurchasePrice ? convertedValue - convertedPurchasePrice : null
                  const isDifferentCurrency = asset.currency !== currency.code
                  const assetCurrencyInfo = CURRENCIES.find(c => c.code === asset.currency)

                  return (
                    <div key={asset.id} className="p-4 hover:bg-white/40 dark:hover:bg-gray-700/40 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${info.color}20` }}>
                          <TypeIcon size={20} style={{ color: info.color }} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{asset.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {ASSET_TYPES.find(t => t.value === asset.type)?.label}
                            {asset.notes && ` • ${asset.notes}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900 dark:text-white">{formatAmount(convertedValue)}</p>
                          {isDifferentCurrency && (
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              {assetCurrencyInfo?.symbol}{asset.value.toLocaleString()} {asset.currency}
                            </p>
                          )}
                          {gain !== null && (
                            <p className={`text-xs ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {gain >= 0 ? '+' : ''}{formatAmount(gain)} ({((gain / convertedPurchasePrice!) * 100).toFixed(1)}%)
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(asset)}
                            className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(asset.id)}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}

      {/* Empty State */}
      {assets.length === 0 && !showForm && (
        <div className="text-center py-12">
          <Landmark className="mx-auto mb-4 text-gray-400 dark:text-gray-600" size={48} />
          <p className="text-gray-600 dark:text-gray-400 mb-2">No assets tracked yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-500">Add your bank accounts, investments, and property</p>
        </div>
      )}
    </div>
  )
}
