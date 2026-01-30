import { useState, useRef, useEffect } from 'react'
import { Camera, Image, Clipboard, Mic, MicOff, Zap, X, Check, Loader2, AlertCircle, ChevronDown, RefreshCw, Sparkles, Settings, Eye, EyeOff, Plus, Trash2, CheckSquare, Square, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { performOCR, preprocessImage, OCRProgress } from '../utils/ocrService'
// Unified parser - consolidates smartParser.ts and expenseParser.ts
import {
  parseMultipleTransactions as parseMultipleExpenses,
  parseQuickTransaction as parseQuickExpense,
  parseExpenseText,
  parseVoiceInput,
  validateCategory,
  ParsedTransaction as ParsedExpenseItem,
  MultiParseResult,
  ParsedExpense
} from '../utils/transactionParser'
// World-class intelligent receipt parser
import { parseReceiptVerbose } from '../utils/receiptParser'
// AI-specific functions still from geminiService
import { extractExpenseWithGemini, extractExpenseFromTextWithGemini, extractMultipleExpensesWithGemini, getGeminiApiKey, setGeminiApiKey, clearGeminiApiKey } from '../utils/geminiService'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types/expense'
import { useCurrency } from '../contexts/CurrencyContext'
import { getCustomCategories, addCustomCategory, TransactionType } from '../utils/categoryUtils'

type InputMode = 'quick' | 'camera' | 'image' | 'paste' | 'voice'

interface SmartCaptureProps {
  onExpenseAdd: (data: {
    amount: string
    category: string
    description: string
    date: string
  }) => Promise<void>
  onIncomeAdd?: (data: {
    amount: string
    category: string
    description: string
    date: string
  }) => Promise<void>
  onBatchAdd?: (items: Array<{
    amount: string
    category: string
    description: string
    date: string
  }>) => Promise<void>
  onCancel?: () => void
}

export default function SmartCapture({ onExpenseAdd, onIncomeAdd, onBatchAdd, onCancel }: SmartCaptureProps) {
  const { currency } = useCurrency()
  const [mode, setMode] = useState<InputMode>('quick')
  const [processing, setProcessing] = useState(false)
  const [ocrProgress, setOcrProgress] = useState<OCRProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [parsedExpense, setParsedExpense] = useState<ParsedExpense | null>(null)
  const [showReview, setShowReview] = useState(false)

  // Transaction type state (expense or income)
  const [transactionType, setTransactionType] = useState<TransactionType>('expense')

  // Custom category states
  const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>([])
  const [customIncomeCategories, setCustomIncomeCategories] = useState<string[]>([])
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  // Multi-expense state
  const [multiResult, setMultiResult] = useState<MultiParseResult | null>(null)
  const [multiItems, setMultiItems] = useState<ParsedExpenseItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [showMultiReview, setShowMultiReview] = useState(false)

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
    // Load custom categories
    setCustomExpenseCategories(getCustomCategories('expense'))
    setCustomIncomeCategories(getCustomCategories('income'))
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

    // Try multi-expense parsing first
    const multiParsed = parseMultipleExpenses(quickInput)

    if (multiParsed.items.length > 1) {
      // Multiple expenses detected
      setMultiResult(multiParsed)
      setMultiItems(multiParsed.items)
      setSelectedItems(new Set(multiParsed.items.map((_, i) => i)))
      setShowMultiReview(true)
    } else if (multiParsed.items.length === 1) {
      // Single expense from multi-parser
      const item = multiParsed.items[0]
      setParsedExpense({
        amount: item.amount,
        merchant: item.merchant || null,
        category: item.category,
        date: item.date,
        description: item.description,
        confidence: item.confidence,
        rawText: item.rawText
      })
      populateFormFromParsed({
        amount: item.amount,
        merchant: item.merchant || null,
        category: item.category,
        date: item.date,
        description: item.description,
        confidence: item.confidence,
        rawText: item.rawText
      })
      setShowReview(true)
    } else {
      // Fallback to simple quick parse
      const quickParsed = parseQuickExpense(quickInput)
      if (quickParsed) {
        setParsedExpense({
          amount: quickParsed.amount,
          merchant: quickParsed.merchant || null,
          category: quickParsed.category,
          date: quickParsed.date,
          description: quickParsed.description,
          confidence: quickParsed.confidence,
          rawText: quickParsed.rawText
        })
        populateFormFromParsed({
          amount: quickParsed.amount,
          merchant: null,
          category: quickParsed.category,
          date: quickParsed.date,
          description: quickParsed.description,
          confidence: quickParsed.confidence,
          rawText: quickParsed.rawText
        })
        setShowReview(true)
      } else {
        setError('Could not parse expense. Try format: "description amount" (e.g., "lunch 5000")')
      }
    }
  }

  const handlePasteSubmit = async () => {
    if (!pasteInput.trim()) return

    setProcessing(true)
    setError(null)

    try {
      // FIRST: Try the intelligent receipt parser to filter phone numbers correctly
      const receiptResult = parseReceiptVerbose(pasteInput)
      console.log('[SmartCapture] Paste - Receipt parser debug:', {
        amount: receiptResult.result.amount,
        confidence: receiptResult.result.confidence,
        merchant: receiptResult.result.merchant,
        filteredPhoneNumbers: receiptResult.debug.filteredPhoneNumbers,
        filteredReferences: receiptResult.debug.filteredReferences,
      })

      // If receipt parser found a confident result, use it
      if (receiptResult.result.amount && receiptResult.result.confidence >= 45) {
        const parsed: ParsedExpense = {
          amount: receiptResult.result.amount,
          merchant: receiptResult.result.merchant,
          category: receiptResult.result.category,
          date: receiptResult.result.date,
          description: receiptResult.result.description || receiptResult.result.merchant || 'Pasted Transaction',
          confidence: receiptResult.result.confidence,
          rawText: pasteInput
        }

        // Set transaction type based on receipt parser detection
        if (receiptResult.result.transactionType) {
          setTransactionType(receiptResult.result.transactionType)
        }

        // Try AI enhancement for low confidence
        if (parsed.confidence < 70 && useAiFallback) {
          const apiKey = getGeminiApiKey()
          if (apiKey) {
            try {
              setOcrProgress({ status: 'Enhancing with AI...', progress: 50 })
              const aiResult = await extractExpenseFromTextWithGemini(pasteInput, apiKey)
              if (aiResult.confidence > parsed.confidence) {
                setParsedExpense(aiResult)
                populateFormFromParsed(aiResult)
                setShowReview(true)
                return
              }
            } catch {
              // Fall through to receipt parser result
            }
          }
        }

        setParsedExpense(parsed)
        populateFormFromParsed(parsed)
        setShowReview(true)
        console.log(`[SmartCapture] Paste - Receipt parser found amount: ${receiptResult.result.amount}`)
        return
      }

      // SECOND: Use multi-expense parser for lists like "Food 60k, Fuel 40k"
      const multiParsed = parseMultipleExpenses(pasteInput)

      if (multiParsed.items.length > 1) {
        // Multiple expenses detected
        setMultiResult(multiParsed)
        setMultiItems(multiParsed.items)
        setSelectedItems(new Set(multiParsed.items.map((_, i) => i)))
        setShowMultiReview(true)
      } else if (multiParsed.items.length === 1) {
        // Single expense
        const item = multiParsed.items[0]

        // Try AI enhancement for single items with low confidence
        if (item.confidence < 70 && useAiFallback) {
          const apiKey = getGeminiApiKey()
          if (apiKey) {
            try {
              setOcrProgress({ status: 'Enhancing with AI...', progress: 50 })
              const aiResult = await extractExpenseFromTextWithGemini(pasteInput, apiKey)
              if (aiResult.confidence > item.confidence) {
                setParsedExpense(aiResult)
                populateFormFromParsed(aiResult)
                setShowReview(true)
                return
              }
            } catch {
              // Fall through to rule-based result
            }
          }
        }

        setParsedExpense({
          amount: item.amount,
          merchant: item.merchant || null,
          category: item.category,
          date: item.date,
          description: item.description,
          confidence: item.confidence,
          rawText: item.rawText
        })
        populateFormFromParsed({
          amount: item.amount,
          merchant: item.merchant || null,
          category: item.category,
          date: item.date,
          description: item.description,
          confidence: item.confidence,
          rawText: item.rawText
        })
        setShowReview(true)
      } else {
        // Fallback to old parser
        const parsed = parseExpenseText(pasteInput)
        if (parsed.amount) {
          setParsedExpense(parsed)
          populateFormFromParsed(parsed)
          setShowReview(true)
        } else {
          setError('Could not extract expense details. Try pasting a bank SMS or receipt text.')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse text')
    } finally {
      setProcessing(false)
      setOcrProgress(null)
    }
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

      // Try AI multi-expense extraction first if available
      const apiKey = getGeminiApiKey()
      if (apiKey && useAiFallback) {
        setOcrProgress({ status: 'AI analyzing for multiple expenses...', progress: 30 })
        try {
          const aiResult = await extractMultipleExpensesWithGemini(base64, apiKey)

          if (aiResult.items.length > 1) {
            // Multiple expenses found - show multi-review
            const parsedItems: ParsedExpenseItem[] = aiResult.items.map(item => ({
              amount: item.amount,
              description: item.description,
              category: item.category || 'Other',
              date: item.date || new Date().toISOString().split('T')[0],
              merchant: item.merchant,
              confidence: item.confidence,
              type: item.type,
              rawText: ''
            }))
            setMultiItems(parsedItems)
            setSelectedItems(new Set(parsedItems.map((_, i) => i)))
            setMultiResult({
              items: parsedItems,
              sourceType: 'receipt',
              rawText: aiResult.rawText,
              confidence: parsedItems.reduce((sum, item) => sum + item.confidence, 0) / parsedItems.length,
              totalAmount: parsedItems.reduce((sum, item) => sum + item.amount, 0)
            })
            setShowMultiReview(true)
            console.log(`AI extracted ${aiResult.items.length} expenses from image`)
            return
          } else if (aiResult.items.length === 1) {
            // Single expense - show single review
            const item = aiResult.items[0]
            const parsed: ParsedExpense = {
              amount: item.amount,
              merchant: item.merchant || null,
              category: item.category,
              date: item.date,
              description: item.description,
              confidence: item.confidence,
              rawText: aiResult.rawText
            }
            setParsedExpense(parsed)
            populateFormFromParsed(parsed)
            setShowReview(true)
            return
          }
          // If no items found, fall through to OCR
        } catch (error) {
          console.warn('AI multi-extraction failed, falling back to OCR:', error)
        }
      }

      // Fallback to OCR + smart parser
      setOcrProgress({ status: 'Running OCR...', progress: 50 })
      const processedFile = await preprocessImage(file)
      const ocrResult = await performOCR(processedFile, setOcrProgress)

      if (!ocrResult.success) {
        throw new Error(ocrResult.error || 'Could not read text from image. Try adding a Gemini API key for better results.')
      }

      setOcrProgress({ status: 'Analyzing receipt...', progress: 80 })

      // Use the world-class intelligent receipt parser FIRST
      // This filters out phone numbers, reference IDs, and correctly identifies amounts
      const receiptResult = parseReceiptVerbose(ocrResult.text)
      console.log('[SmartCapture] Receipt parser debug:', {
        amount: receiptResult.result.amount,
        confidence: receiptResult.result.confidence,
        merchant: receiptResult.result.merchant,
        filteredPhoneNumbers: receiptResult.debug.filteredPhoneNumbers,
        filteredReferences: receiptResult.debug.filteredReferences,
        allAmounts: receiptResult.result.allAmounts.slice(0, 5) // Top 5 for debugging
      })

      // If receipt parser found a high-confidence result, use it
      if (receiptResult.result.amount && receiptResult.result.confidence >= 40) {
        const parsed: ParsedExpense = {
          amount: receiptResult.result.amount,
          merchant: receiptResult.result.merchant,
          category: receiptResult.result.category,
          date: receiptResult.result.date,
          description: receiptResult.result.description || receiptResult.result.merchant || 'Receipt',
          confidence: Math.min(receiptResult.result.confidence, ocrResult.confidence),
          rawText: ocrResult.text
        }

        // Set transaction type based on receipt parser detection
        if (receiptResult.result.transactionType) {
          setTransactionType(receiptResult.result.transactionType)
        }

        setParsedExpense(parsed)
        populateFormFromParsed(parsed)
        setShowReview(true)
        console.log(`[SmartCapture] Receipt parser found amount: ${receiptResult.result.amount}`)
        return
      }

      // Fall back to multi-expense parsing from OCR text
      const multiParsed = parseMultipleExpenses(ocrResult.text)

      if (multiParsed.items.length > 1) {
        // Multiple expenses found
        setMultiItems(multiParsed.items)
        setSelectedItems(new Set(multiParsed.items.map((_, i) => i)))
        setMultiResult(multiParsed)
        setShowMultiReview(true)
        console.log(`OCR extracted ${multiParsed.items.length} expenses from image`)
      } else if (multiParsed.items.length === 1) {
        // Single expense
        const item = multiParsed.items[0]
        const parsed: ParsedExpense = {
          amount: item.amount,
          merchant: item.merchant || null,
          category: item.category,
          date: item.date,
          description: item.description,
          confidence: Math.min(item.confidence, ocrResult.confidence),
          rawText: ocrResult.text
        }
        setParsedExpense(parsed)
        populateFormFromParsed(parsed)
        setShowReview(true)
      } else {
        // Fallback to old parser
        const parsed = parseExpenseText(ocrResult.text)
        parsed.confidence = Math.min(parsed.confidence, ocrResult.confidence)

        if (parsed.amount) {
          setParsedExpense(parsed)
          populateFormFromParsed(parsed)
          setShowReview(true)
        } else {
          throw new Error('Could not extract expense details from image')
        }
      }
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
      if (transactionType === 'income' && onIncomeAdd) {
        await onIncomeAdd({
          amount,
          category,
          description,
          date
        })
      } else {
        await onExpenseAdd({
          amount,
          category,
          description,
          date
        })
      }
      // Reset state
      resetCapture()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to add ${transactionType}`)
    } finally {
      setProcessing(false)
    }
  }

  // Handle adding a new custom category
  const handleAddCustomCategory = () => {
    const trimmedName = newCategoryName.trim()
    if (!trimmedName) return

    addCustomCategory(transactionType, trimmedName)
    if (transactionType === 'expense') {
      setCustomExpenseCategories(prev => [...prev, trimmedName])
    } else {
      setCustomIncomeCategories(prev => [...prev, trimmedName])
    }
    setCategory(trimmedName)
    setShowAddCategory(false)
    setNewCategoryName('')
  }

  // Get all categories for current transaction type
  const getAllCategories = () => {
    if (transactionType === 'expense') {
      return [...EXPENSE_CATEGORIES, ...customExpenseCategories]
    }
    return [...INCOME_CATEGORIES, ...customIncomeCategories]
  }

  const resetCapture = () => {
    setParsedExpense(null)
    setShowReview(false)
    setShowMultiReview(false)
    setMultiResult(null)
    setMultiItems([])
    setSelectedItems(new Set())
    setEditingIndex(null)
    setAmount('')
    setCategory('')
    setDescription('')
    setDate(new Date().toISOString().split('T')[0])
    setQuickInput('')
    setPasteInput('')
    setError(null)
    setLastImageBase64(null)
    setShowAddCategory(false)
    setNewCategoryName('')
    setTransactionType('expense')
  }

  // Multi-expense handling functions
  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedItems(newSelected)
  }

  const selectAllItems = () => {
    setSelectedItems(new Set(multiItems.map((_, i) => i)))
  }

  const deselectAllItems = () => {
    setSelectedItems(new Set())
  }

  const updateMultiItem = (index: number, updates: Partial<ParsedExpenseItem>) => {
    setMultiItems(prev => prev.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    ))
  }

  const deleteMultiItem = (index: number) => {
    setMultiItems(prev => prev.filter((_, i) => i !== index))
    const newSelected = new Set(selectedItems)
    newSelected.delete(index)
    // Adjust indices for items after deleted one
    const adjustedSelected = new Set<number>()
    newSelected.forEach(i => {
      if (i < index) adjustedSelected.add(i)
      else if (i > index) adjustedSelected.add(i - 1)
    })
    setSelectedItems(adjustedSelected)
  }

  const handleConfirmMultiExpenses = async () => {
    const selectedExpenses = multiItems.filter((_, i) => selectedItems.has(i))

    if (selectedExpenses.length === 0) {
      setError('Please select at least one expense to add')
      return
    }

    setProcessing(true)
    try {
      if (onBatchAdd && selectedExpenses.length > 1) {
        // Use batch add if available
        await onBatchAdd(selectedExpenses.map(item => ({
          amount: item.amount.toString(),
          category: validateCategory(item.category, 'expense'),
          description: item.description,
          date: item.date
        })))
      } else {
        // Add one by one
        for (const item of selectedExpenses) {
          await onExpenseAdd({
            amount: item.amount.toString(),
            category: validateCategory(item.category, 'expense'),
            description: item.description,
            date: item.date
          })
        }
      }
      resetCapture()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expenses')
    } finally {
      setProcessing(false)
    }
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

  // Multi-expense review screen
  if (showMultiReview && multiItems.length > 0) {
    const totalAmount = multiItems
      .filter((_, i) => selectedItems.has(i))
      .reduce((sum, item) => sum + item.amount, 0)

    return (
      <div className="group relative animate-fade-in max-h-[90vh] overflow-hidden flex flex-col">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <div className="relative p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl flex flex-col max-h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 dark:from-purple-400 dark:via-pink-400 dark:to-orange-400 bg-clip-text text-transparent">
                {multiItems.length} Expenses Found
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {multiResult?.sourceType === 'whatsapp_list' ? 'WhatsApp List' :
                 multiResult?.sourceType === 'multi_item_receipt' ? 'Receipt Items' :
                 'Multiple Items'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                multiResult && multiResult.confidence >= 70
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}>
                {multiResult?.confidence.toFixed(0)}%
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle size={16} />
              <span className="flex-1 text-xs">{error}</span>
              <button onClick={() => setError(null)}><X size={14} /></button>
            </div>
          )}

          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2 bg-white/50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400">Selected</p>
              <p className="text-base font-bold text-gray-900 dark:text-white">{selectedItems.size} of {multiItems.length}</p>
            </div>
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-xs text-purple-600 dark:text-purple-400">Total</p>
              <p className="text-base font-bold text-purple-700 dark:text-purple-300">{currency.symbol}{totalAmount.toLocaleString()}</p>
            </div>
          </div>

          {/* Selection controls */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={selectAllItems}
              className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
            >
              Select All
            </button>
            <button
              onClick={deselectAllItems}
              className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Deselect All
            </button>
          </div>

          {/* Items list - scrollable */}
          <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-0 max-h-[40vh]">
            {multiItems.map((item, index) => (
              <div
                key={index}
                className={`p-2 rounded-lg border transition-all ${
                  selectedItems.has(index)
                    ? 'bg-white/80 dark:bg-gray-700/80 border-purple-300 dark:border-purple-700'
                    : 'bg-white/40 dark:bg-gray-700/40 border-gray-200 dark:border-gray-600 opacity-60'
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => toggleItemSelection(index)}
                    className="mt-0.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 flex-shrink-0"
                  >
                    {selectedItems.has(index)
                      ? <CheckSquare size={18} className="text-purple-600 dark:text-purple-400" />
                      : <Square size={18} />
                    }
                  </button>

                  <div className="flex-1 min-w-0">
                    {editingIndex === index ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateMultiItem(index, { description: e.target.value })}
                          className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg"
                          placeholder="Description"
                        />
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) => updateMultiItem(index, { amount: parseFloat(e.target.value) || 0 })}
                            className="w-20 px-2 py-1.5 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg"
                            placeholder="Amount"
                          />
                          <select
                            value={item.category}
                            onChange={(e) => updateMultiItem(index, { category: e.target.value })}
                            className="flex-1 min-w-[120px] px-2 py-1.5 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg"
                          >
                            {getAllCategories().map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => setEditingIndex(null)}
                            className="px-2 py-1.5 bg-purple-600 text-white rounded-lg text-sm"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.category}</p>
                      </>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm text-gray-900 dark:text-white">
                      {currency.symbol}{item.amount.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-0.5 mt-0.5 justify-end">
                      <button
                        onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="Edit"
                      >
                        <Plus size={12} className="rotate-45" />
                      </button>
                      <button
                        onClick={() => deleteMultiItem(index)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={resetCapture}
              className="flex-1 px-3 py-2.5 bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 transition-all flex items-center justify-center gap-1.5 text-sm"
            >
              <RefreshCw size={16} />
              <span className="hidden xs:inline">Start Over</span>
              <span className="xs:hidden">Reset</span>
            </button>
            <button
              onClick={handleConfirmMultiExpenses}
              disabled={processing || selectedItems.size === 0}
              className="flex-1 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 hover:from-purple-700 hover:via-pink-700 hover:to-orange-700 text-white py-2.5 px-3 rounded-lg font-medium shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {processing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {processing ? 'Adding...' : `Add ${selectedItems.size}`}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Review/Edit screen
  if (showReview) {
    const gradientColors = transactionType === 'income'
      ? 'from-blue-500 via-cyan-500 to-teal-500'
      : 'from-green-500 via-emerald-500 to-teal-500'
    const titleGradient = transactionType === 'income'
      ? 'from-blue-600 via-cyan-600 to-teal-600 dark:from-blue-400 dark:via-cyan-400 dark:to-teal-400'
      : 'from-green-600 via-emerald-600 to-teal-600 dark:from-green-400 dark:via-emerald-400 dark:to-teal-400'
    const buttonGradient = transactionType === 'income'
      ? 'from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'
      : 'from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
    const focusRing = transactionType === 'income' ? 'focus:ring-blue-500' : 'focus:ring-green-500'

    return (
      <div className="group relative animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientColors} rounded-3xl blur-2xl opacity-10 group-hover:opacity-20 transition-opacity`}></div>
        <div className="relative p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl border border-white/20 dark:border-gray-700/50 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl sm:text-2xl font-bold bg-gradient-to-r ${titleGradient} bg-clip-text text-transparent`}>
              Review {transactionType === 'income' ? 'Income' : 'Expense'}
            </h2>
            <div className="flex items-center gap-2">
              {parsedExpense && parsedExpense.confidence < 70 && (
                <button
                  onClick={handleEnhanceWithAI}
                  disabled={processing}
                  className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-full text-xs font-medium transition-all disabled:opacity-50"
                  title="Enhance with AI"
                >
                  <Sparkles size={12} />
                  <span className="hidden sm:inline">Enhance</span>
                </button>
              )}
              {parsedExpense && (
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
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
            <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle size={16} />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)}><X size={14} /></button>
            </div>
          )}

          <div className="space-y-3">
            {/* Transaction Type Toggle */}
            {onIncomeAdd && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Type
                </label>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                  <button
                    type="button"
                    onClick={() => {
                      setTransactionType('expense')
                      setCategory('')
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-all ${
                      transactionType === 'expense'
                        ? 'bg-red-500 text-white'
                        : 'bg-white/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <ArrowUpCircle size={16} />
                    Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTransactionType('income')
                      setCategory('')
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-all ${
                      transactionType === 'income'
                        ? 'bg-green-500 text-white'
                        : 'bg-white/50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <ArrowDownCircle size={16} />
                    Income
                  </button>
                </div>
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Amount *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400 text-base font-medium">
                  {currency.symbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`pl-8 w-full px-3 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg ${focusRing} focus:ring-2 focus:border-transparent transition-all text-gray-900 dark:text-white text-base font-semibold`}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
            </div>

            {/* Category with Add New option */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Category *
              </label>
              {showAddCategory ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Enter new category name"
                    className={`flex-1 px-3 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg ${focusRing} focus:ring-2 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCustomCategory()
                      } else if (e.key === 'Escape') {
                        setShowAddCategory(false)
                        setNewCategoryName('')
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCategory}
                    disabled={!newCategoryName.trim()}
                    className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCategory(false)
                      setNewCategoryName('')
                    }}
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <select
                    required
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setShowAddCategory(true)
                      } else {
                        setCategory(e.target.value)
                      }
                    }}
                    className={`w-full px-3 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg ${focusRing} focus:ring-2 focus:border-transparent transition-all text-gray-900 dark:text-white appearance-none text-sm`}
                  >
                    <option value="">Select category</option>
                    {getAllCategories().map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__add_new__">+ Add New Category</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={18} />
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`w-full px-3 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg ${focusRing} focus:ring-2 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm`}
                placeholder={`What was this ${transactionType} for?`}
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full px-3 py-2.5 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg ${focusRing} focus:ring-2 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm`}
              />
            </div>

            {/* Original text preview */}
            {parsedExpense?.rawText && (
              <div className="p-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Original text:</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">{parsedExpense.rawText}</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={resetCapture}
              className="flex-1 px-3 py-2.5 bg-white/50 dark:bg-gray-700/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 transition-all flex items-center justify-center gap-1.5 text-sm"
            >
              <RefreshCw size={16} />
              <span className="hidden xs:inline">Try Again</span>
              <span className="xs:hidden">Reset</span>
            </button>
            <button
              onClick={handleConfirmExpense}
              disabled={processing || !amount || !category}
              className={`flex-1 bg-gradient-to-r ${buttonGradient} text-white py-2.5 px-3 rounded-lg font-medium shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm`}
            >
              {processing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              {processing ? 'Saving...' : `Add ${transactionType === 'income' ? 'Income' : 'Expense'}`}
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
                Single: "uber 5000" | Multiple: "Food 60k, Fuel 40k, Airtime 5k"
              </p>
              <input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                className="w-full px-4 py-4 bg-white/50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-lg"
                placeholder="Food 60k, Fuel 40k..."
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
              placeholder="Paste expense list or receipt text here...

Examples:
• Food 60k, Fuel 40k, Airtime 5k
• NGN 5,000.00 was debited from your account...
• OPay/GTBank/Moniepoint receipt text"
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
                <li>• Single: "uber 12.50" or "lunch 5000"</li>
                <li>• Multiple: "Food 60k, Fuel 40k, Airtime 5k"</li>
                <li>• Use "k" for thousands: 60k = ₦60,000</li>
              </>
            )}
            {(mode === 'camera' || mode === 'image') && (
              <>
                <li>• Works with OPay, GTBank, Moniepoint receipts</li>
                <li>• Supermarket receipts extract each item</li>
                <li>• Screenshot bank app notifications</li>
              </>
            )}
            {mode === 'paste' && (
              <>
                <li>• Paste WhatsApp lists: "Food 60k, Fuel 40k"</li>
                <li>• Bank SMS from GTBank, Access, FirstBank, etc.</li>
                <li>• OPay, Moniepoint receipts auto-detected</li>
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
