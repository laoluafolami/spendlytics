import { Trash2, Edit2, Inbox } from 'lucide-react'
import { Expense } from '../types/expense'
import { format } from 'date-fns'
import { useCurrency } from '../contexts/CurrencyContext'

interface ExpenseListProps {
  expenses: Expense[]
  onDelete: (id: string) => void
  onEdit: (expense: Expense) => void
}

export default function ExpenseList({ expenses, onDelete, onEdit }: ExpenseListProps) {
  const { formatAmount } = useCurrency()
  if (expenses.length === 0) {
    return (
      <div className="relative animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-10"></div>
        <div className="relative p-16 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Inbox className="text-white" size={40} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">No expenses yet</h3>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Add your first expense to get started tracking your spending!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative animate-fade-in">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10"></div>
      <div className="relative rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-600/20 dark:via-purple-600/20 dark:to-pink-600/20 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/30 dark:divide-gray-700/30">
              {expenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="group hover:bg-white/40 dark:hover:bg-gray-700/40 transition-all duration-200"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {format(new Date(expense.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-500/20 to-purple-500/20 dark:from-blue-600/30 dark:to-purple-600/30 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-700/50 backdrop-blur-sm">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
                    {expense.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right">
                    <span className="bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
                      {formatAmount(parseFloat(expense.amount.toString()))}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(expense)}
                        className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transform hover:scale-110 transition-all duration-200"
                        title="Edit expense"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this expense?')) {
                            onDelete(expense.id)
                          }
                        }}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 dark:bg-red-600/20 dark:hover:bg-red-600/30 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transform hover:scale-110 transition-all duration-200"
                        title="Delete expense"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
