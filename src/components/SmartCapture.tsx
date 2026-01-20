import { useState, useRef, useEffect } from 'react'
import { Camera, Image, Clipboard, Mic, MicOff, Zap, X, Check, Loader2, AlertCircle, ChevronDown, RefreshCw, Sparkles, Settings, Eye, EyeOff } from 'lucide-react'
import { performOCR, preprocessImage, OCRProgress } from '../utils/ocrService'
import { parseExpenseText, parseVoiceInput, parseQuickInput, ParsedExpense } from '../utils/expenseParser'
import { extractExpenseWithGemini, extractExpenseFromTextWithGemini, getGeminiApiKey, setGeminiApiKey, clearGeminiApiKey } from '../utils/geminiService'
import { EXPENSE_CATEGORIES } from '../types/expense'
import { useCurrency } from '../contexts/CurrencyContext'

type InputMode = 'quick' | 'camera' | 'image' | 'paste' | 'voice'

interface SmartCaptureProps {
  onExpenseAdd: (data: {
    amount: string
    category: string
    description: string
    date: string
  }) => Promise<void>
  onCancel?: () => void
}

export default function SmartCapture({ onExpenseAdd, onCancel }: SmartCaptureProps) {
  const { currency } = useCurrency()
  const [mode, setMode] = useState<InputMode>('quick')
  const [processing, setProcessing] = useState(false)
  const [ocrProgress, setOcrProgress] = useState<OCRProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [parsedExpense, setParsedExpense] = useState<ParsedExpense | null>(null)
  const [showReview, setShowReview] = useState(false)

  // Form state for review/edit
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  // Input refs and state
  const [quickInput, setQuickInput] = useState('')
  const [pasteInput, setPasteInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Gemini AI state
  const [showSettings, setShowSettings] = useState(false)
  const [geminiKey, setGeminiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [useAiFallback, setUseAiFallback] = useState(true)
  const [lastImageBase64, setLastImageBase64] = useState<string | null>(null)

  useEffect(() => {
    // Load saved Gemini API key
    const savedKey = getGeminiApiKey()
    if (savedKey) {
      setGeminiKey(savedKey)
    }
  }, [])

  useEffect(() => {
    // Check for speech recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    setVoiceSupported(!!SpeechRecognition)

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = 'en-US'

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        handleVoiceResult(transcript)
      }

      recognitionRef.current.onerror = (event) => {
        setError(`Voice error: ${event.error}`)
        setIsRecording(false)
      }

      recognitionRef.current.onend = () => {
        setIsRecording(false)
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const handleVoiceResult = (transcript: string) => {
    const parsed = parseVoiceInput(transcript)
    setParsedExpense(parsed)
    populateFormFromParsed(parsed)
    setShowReview(true)
  }

  const populateFormFromParsed = (parsed: ParsedExpense) => {
    setAmount(parsed.amount?.toString() || '')
    setCategory(parsed.category || '')
    setDescription(parsed.description || parsed.merchant || '')
    setDate(parsed.date || new Date().toISOString().split('T')[0])
  }

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickInput.trim()) return

    const parsed = parseQuickInput(quickInput)
    setParsedExpense(parsed)
    populateFormFromParsed(parsed)
    setShowReview(true)
  }

  const handlePasteSubmit = () => {
    if (!pasteInput.trim()) return

    const parsed = parseExpenseText(pasteInput)
    setParsedExpense(parsed)
    populateFormFromParsed(parsed)
    setShowReview(true)
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
    })
  }

  const handleImageSelect = async (file: File) => {
    setProcessing(true)
    setError(null)
    setOcrProgress({ status: 'Preparing image...', progress: 0 })

    try {
      // Store base64 for potential AI enhancement later
      const base64 = await fileToBase64(file)
      setLastImageBase64(base64)

      // Preprocess image for better OCR
      const processedFile = await preprocessImage(file)

      // Perform OCR with Tesseract first
      const ocrResult = await performOCR(processedFile, setOcrProgress)

      let parsed: ParsedExpense

      if (!ocrResult.success || ocrResult.confidence < 50) {
        // If Tesseract fails or has low confidence, try Gemini
        const apiKey = getGeminiApiKey()
        if (apiKey && useAiFallback) {
          setOcrProgress({ status: 'Enhancing with AI...', progress: 80 })
          try {
            parsed = await extractExpenseWithGemini(base64, apiKey)
          } catch {
            // Fall back to Tesseract result if Gemini fails
            if (ocrResult.success) {
              parsed = parseExpenseText(ocrResult.text)
              parsed.confidence = Math.min(parsed.confidence, ocrResult.confidence)
            } else {
              throw new Error(ocrResult.error || 'Could not read text from image')
            }
          }
        } else if (!ocrResult.success) {
          throw new Error(ocrResult.error || 'Could not read text from image. Try adding a Gemini API key for better results.')
        } else {
          parsed = parseExpenseText(ocrResult.text)
          parsed.confidence = Math.min(parsed.confidence, ocrResult.confidence)
        }
      } else {
        // Parse the extracted text
        parsed = parseExpenseText(ocrResult.text)
        parsed.confidence = Math.min(parsed.confidence, ocrResult.confidence)

        // If confidence is still low, try Gemini enhancement
        const apiKey = getGeminiApiKey()
        if (parsed.confidence < 60 && apiKey && useAiFallback) {
          setOcrProgress({ status: 'Enhancing with AI...', progress: 90 })
          try {
            const aiParsed = await extractExpenseWithGemini(base64, apiKey)
            if (aiParsed.confidence > parsed.confidence) {
              parsed = aiParsed
            }
          } catch {
            // Keep Tesseract result if Gemini fails
          }
        }
      }

      setParsedExpense(parsed)
      populateFormFromParsed(parsed)
      setShowReview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process image')
    } finally {
      setProcessing(false)
      setOcrProgress(null)
    }
  }

  const handleEnhanceWithAI = async () => {
    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      setShowSettings(true)
      return
    }

    setProcessing(true)
    setError(null)

    try {
      let enhanced: ParsedExpense

      if (lastImageBase64) {
        enhanced = await extractExpenseWithGemini(lastImageBase64, apiKey)
      } else if (parsedExpense?.rawText) {
        enhanced = await extractExpenseFromTextWithGemini(parsedExpense.rawText, apiKey)
      } else {
        throw new Error('No data to enhance')
      }

      setParsedExpense(enhanced)
      populateFormFromParsed(enhanced)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI enhancement failed')
    } finally {
      setProcessing(false)
    }
  }

  const handleSaveApiKey = () => {
    if (geminiKey.trim()) {
      setGeminiApiKey(geminiKey.trim())
    } else {
      clearGeminiApiKey()
    }
    setShowSettings(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageSelect(file)
    }
    e.target.value = '' // Reset for re-selection
  }

  const startVoiceRecording = () => {
    if (recognitionRef.current && !isRecording) {
      setIsRecording(true)
      setError(null)
      recognitionRef.current.start()
    }
  }

  const stopVoiceRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleConfirmExpense = async () => {
    if (!amount || !category) {
      setError('Please provide amount and category')
      return
    }

    setProcessing(true)
    try {
      await onExpenseAdd({
        amount,
        category,
        description,
        date
      })
      // Reset state
      resetCapture()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expense')
    } finally {
      setProcessing(false)
    }
  }

  const resetCapture = () => {
    setParsedExpense(null)
    setShowReview(false)
    setAmount('')
    setCategory('')
    setDescription('')
    setDate(new Date().toISOString().split('T')[0])
    setQuickInput('')
    setPasteInput('')
    setError(null)
  }

  const inputModes = [
    { id: 'quick' as InputMode, icon: Zap, label: 'Quick', color: 'from-yellow-500 to-orange-500' },
    { id: 'camera' as InputMode, icon: Camera, label: 'Camera', color: 'from-blue-500 to-cyan-500' },
    { id: 'image' as InputMode, icon: Image, label: 'Upload', color: 'from-green-500 to-emerald-500' },
    { id: 'paste' as InputMode, icon: Clipboard, label: 'Paste', color: 'from-purple-500 to-pink-500' },
    { id: 'voice' as InputMode, icon: Mic, label: 'Voice', color: 'from-red-500 to-rose-500' },
  ]

  // Settings modal
  if (showSettings) {
    return (
      <div className="group relative animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
              AI Settings
            </h2>
            <button
              onClick={() => setShowSettings(false)}
              className="p-2 rounded-xl bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 text-gray-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Google Gemini API Key (Optional)
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Add a Gemini API key for enhanced accuracy on complex receipts. Get one free at{' '}
                <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  Google AI Studio
                </a>
              </p>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                  placeholder="AIza..."
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useAiFallback}
                onChange={(e) => setUseAiFallback(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Automatically use AI when OCR confidence is low
              </span>
            </label>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                <strong>Privacy:</strong> Your API key is stored locally in your browser and images are sent directly to Google's API. We don't store or process your data.
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowSettings(false)}
              className="flex-1 px-4 py-3 bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveApiKey}
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-3 px-4 rounded-xl font-semibold shadow-lg"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Review/Edit screen
  if (showReview) {
    return (
      <div className="group relative animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 dark:from-green-400 dark:via-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
              Review Expense
            </h2>
            <div className="flex items-center gap-2">
              {parsedExpense && parsedExpense.confidence < 70 && (
                <button
                  onClick={handleEnhanceWithAI}
                  disabled={processing}
                  className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-full text-sm font-medium transition-all disabled:opacity-50"
                  title="Enhance with AI"
                >
                  <Sparkles size={14} />
                  <span className="hidden sm:inline">Enhance</span>
                </button>
              )}
              {parsedExpense && (
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  parsedExpense.confidence >= 70
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : parsedExpense.confidence >= 40
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {parsedExpense.confidence}%
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Amount *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-gray-500 dark:text-gray-400 text-lg font-medium">
                  {currency.symbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-10 w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-lg font-semibold"
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Category *
              </label>
              <div className="relative">
                <select
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900 dark:text-white appearance-none"
                >
                  <option value="">Select category</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-3.5 text-gray-400 pointer-events-none" size={20} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
                placeholder="What was this expense for?"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-900 dark:text-white"
              />
            </div>

            {parsedExpense?.rawText && (
              <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-xl">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Original text:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">{parsedExpense.rawText}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={resetCapture}
              className="flex-1 px-4 py-3 bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-xl font-semibold text-gray-700 dark:text-gray-300 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} />
              Try Again
            </button>
            <button
              onClick={handleConfirmExpense}
              disabled={processing || !amount || !category}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-3 px-4 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Check size={18} />
              )}
              {processing ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main capture UI
  return (
    <div className="group relative animate-fade-in">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
      <div className="relative p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
            Smart Capture
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-xl bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 transition-all"
              title="AI Settings"
            >
              <Settings size={20} />
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-2 rounded-xl bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 transition-all"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-2 px-2">
          {inputModes.map((m) => {
            const Icon = m.icon
            const isActive = mode === m.id
            const isDisabled = m.id === 'voice' && !voiceSupported

            return (
              <button
                key={m.id}
                onClick={() => !isDisabled && setMode(m.id)}
                disabled={isDisabled}
                className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-xl font-medium transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${m.color} text-white shadow-lg`
                    : isDisabled
                    ? 'bg-gray-100 dark:bg-gray-700/30 text-gray-400 cursor-not-allowed'
                    : 'bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Icon size={20} />
                <span className="text-xs">{m.label}</span>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Processing overlay */}
        {processing && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={20} />
              <span className="text-blue-700 dark:text-blue-300 font-medium">
                {ocrProgress?.status || 'Processing...'}
              </span>
            </div>
            {ocrProgress && (
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div
                  className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${ocrProgress.progress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Quick input mode */}
        {mode === 'quick' && (
          <form onSubmit={handleQuickSubmit} className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Type something like "uber 12.50" or "lunch 25 starbucks"
              </p>
              <input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                className="w-full px-4 py-4 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-lg"
                placeholder="groceries 150..."
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!quickInput.trim()}
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white py-3 px-4 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap size={18} />
              Quick Add
            </button>
          </form>
        )}

        {/* Camera mode */}
        {mode === 'camera' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Take a photo of your receipt or transaction screen
            </p>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={processing}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white py-8 px-4 rounded-xl font-semibold shadow-lg transition-all flex flex-col items-center justify-center gap-3 disabled:opacity-50"
            >
              <Camera size={48} />
              <span>Open Camera</span>
            </button>
          </div>
        )}

        {/* Image upload mode */}
        {mode === 'image' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload a screenshot, receipt photo, or bank statement PDF
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white py-8 px-4 rounded-xl font-semibold shadow-lg transition-all flex flex-col items-center justify-center gap-3 disabled:opacity-50 border-2 border-dashed border-green-300 dark:border-green-700"
            >
              <Image size={48} />
              <span>Choose Image or PDF</span>
              <span className="text-sm opacity-80">Receipts, bank statements, screenshots</span>
            </button>
          </div>
        )}

        {/* Paste mode */}
        {mode === 'paste' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Paste your bank SMS, email notification, or any transaction text
            </p>
            <textarea
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              className="w-full px-4 py-3 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900 dark:text-white resize-none"
              rows={6}
              placeholder="Paste your transaction message here...

Example:
NGN 5,000.00 was debited from your account for POS purchase at SHOPRITE..."
              autoFocus
            />
            <button
              onClick={handlePasteSubmit}
              disabled={!pasteInput.trim()}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-3 px-4 rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Clipboard size={18} />
              Extract Expense
            </button>
          </div>
        )}

        {/* Voice mode */}
        {mode === 'voice' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Say something like "Spent 50 dollars at Starbucks for coffee yesterday"
            </p>
            <button
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
              disabled={!voiceSupported}
              className={`w-full py-8 px-4 rounded-xl font-semibold shadow-lg transition-all flex flex-col items-center justify-center gap-3 ${
                isRecording
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white animate-pulse'
                  : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white'
              }`}
            >
              {isRecording ? (
                <>
                  <MicOff size={48} />
                  <span>Tap to Stop</span>
                  <span className="text-sm opacity-80">Listening...</span>
                </>
              ) : (
                <>
                  <Mic size={48} />
                  <span>Tap to Speak</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Tips section */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">TIPS</p>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            {mode === 'quick' && (
              <>
                <li>• Start with merchant/description, end with amount</li>
                <li>• "uber 12.50" → Uber, Transportation, ₦12.50</li>
                <li>• "shoprite groceries 15000" → Shoprite, Groceries, ₦15,000</li>
              </>
            )}
            {(mode === 'camera' || mode === 'image') && (
              <>
                <li>• Ensure good lighting and clear text</li>
                <li>• Works with receipts, bank notifications, payment confirmations</li>
                <li>• Crop to the relevant part for better accuracy</li>
              </>
            )}
            {mode === 'paste' && (
              <>
                <li>• Works with Nigerian bank SMS (GTBank, Access, FirstBank, etc.)</li>
                <li>• Also works with email notifications and payment confirmations</li>
                <li>• The more text you paste, the better the extraction</li>
              </>
            )}
            {mode === 'voice' && (
              <>
                <li>• Speak clearly and mention the amount</li>
                <li>• Include merchant name and category hints</li>
                <li>• Say "yesterday" or "last week" for past dates</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

// Type declarations for Speech Recognition API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor
    webkitSpeechRecognition: SpeechRecognitionConstructor
  }
}
