import { useNavigate } from 'react-router-dom'
import { TrendingUp, Wallet, PieChart, Shield, Zap, Target, ArrowRight, LogIn, UserPlus } from 'lucide-react'

export default function LandingPage() {
  const navigate = useNavigate()

  const features = [
    {
      icon: Wallet,
      title: 'Track Expenses',
      description: 'Effortlessly log and categorize your daily expenses with our intuitive interface.',
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'from-blue-500/10 to-cyan-500/10',
    },
    {
      icon: PieChart,
      title: 'Visual Analytics',
      description: 'Gain insights with beautiful charts and graphs that make understanding your spending easy.',
      color: 'from-purple-500 to-pink-500',
      bgColor: 'from-purple-500/10 to-pink-500/10',
    },
    {
      icon: Target,
      title: 'Set Goals',
      description: 'Create savings goals and budgets to stay on track with your financial objectives.',
      color: 'from-green-500 to-emerald-500',
      bgColor: 'from-green-500/10 to-emerald-500/10',
    },
    {
      icon: TrendingUp,
      title: 'Smart Reports',
      description: 'Generate comprehensive reports to understand your spending patterns over time.',
      color: 'from-orange-500 to-red-500',
      bgColor: 'from-orange-500/10 to-red-500/10',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your financial data is encrypted and protected with industry-standard security.',
      color: 'from-indigo-500 to-blue-500',
      bgColor: 'from-indigo-500/10 to-blue-500/10',
    },
    {
      icon: Zap,
      title: 'Real-time Sync',
      description: 'Access your data from anywhere with automatic cloud synchronization.',
      color: 'from-yellow-500 to-orange-500',
      bgColor: 'from-yellow-500/10 to-orange-500/10',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10">
        <header className="backdrop-blur-md bg-white/30 dark:bg-gray-900/30 border-b border-white/20 dark:border-gray-700/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                Expense Tracker
              </h1>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/login')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-800/80 border border-white/20 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 rounded-xl font-medium transform hover:scale-105 transition-all duration-300 backdrop-blur-sm"
                >
                  <LogIn size={18} />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transform hover:scale-105 transition-all duration-300 shadow-lg"
                >
                  <UserPlus size={18} />
                  <span>Sign Up</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-20">
            <div className="inline-block mb-6 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-full">
              <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                Take Control of Your Finances
              </span>
            </div>

            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent leading-tight">
              Track. Analyze. Save.
            </h2>

            <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed">
              The smart way to manage your expenses and achieve your financial goals.
              Beautiful, powerful, and incredibly easy to use.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => navigate('/signup')}
                className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl font-semibold text-lg transform hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-3xl"
              >
                <span>Get Started Free</span>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-3 px-8 py-4 bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-800/80 border-2 border-white/40 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 rounded-2xl font-semibold text-lg transform hover:scale-105 transition-all duration-300 backdrop-blur-sm"
              >
                <span>Sign In</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div
                  key={index}
                  className="group relative animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} rounded-3xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300`}></div>

                  <div className="relative p-8 rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 hover:border-white/60 dark:hover:border-gray-600/50 transition-all duration-300 h-full">
                    <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.bgColor} mb-6`}>
                      <Icon size={32} className={`bg-gradient-to-br ${feature.color} bg-clip-text text-transparent`} strokeWidth={2} />
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                      {feature.title}
                    </h3>

                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="text-center">
            <div className="inline-block p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 dark:border-blue-500/30 backdrop-blur-xl">
              <h3 className="text-3xl sm:text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                Ready to Transform Your Finances?
              </h3>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl">
                Join thousands of users who are already taking control of their financial future.
              </p>
              <button
                onClick={() => navigate('/signup')}
                className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl font-semibold text-lg transform hover:scale-105 transition-all duration-300 shadow-2xl"
              >
                <span>Start Your Journey</span>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
