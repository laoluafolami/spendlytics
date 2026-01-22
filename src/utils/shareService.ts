/**
 * Share Service
 * Handles incoming shared content from other apps via Web Share Target API
 */

// Unified parser - consolidates smartParser.ts and expenseParser.ts
import { parseMultipleTransactions as parseMultipleExpenses, ParsedTransaction as ParsedExpenseItem } from './transactionParser'
import { extractMultipleExpensesWithGemini, getGeminiApiKey } from './geminiService'
import { performOCR } from './ocrService'

export interface SharedFile {
  name: string
  type: string
  size: number
  data: string // base64
}

export interface SharedData {
  timestamp: number
  title: string
  text: string
  url: string
  files: SharedFile[]
}

export interface ProcessedShare {
  items: ParsedExpenseItem[]
  sourceType: 'text' | 'image' | 'pdf' | 'mixed'
  rawText: string
  confidence: number
  suggestedCategories: string[]
}

// Retrieve shared data from service worker cache
export async function getSharedData(): Promise<SharedData | null> {
  try {
    const response = await fetch('/api/share-data')
    if (!response.ok) return null

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Failed to get shared data:', error)
    return null
  }
}

// Clear shared data after processing
export async function clearSharedData(): Promise<void> {
  try {
    await fetch('/api/share-data', { method: 'DELETE' })
  } catch (error) {
    console.error('Failed to clear shared data:', error)
  }
}

// Check if there's pending shared data
export async function hasPendingShare(): Promise<boolean> {
  const data = await getSharedData()
  return data !== null && (!!data.text || data.files.length > 0)
}

// Convert base64 to File object
function base64ToFile(base64: string, filename: string, mimeType: string): File {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: mimeType })
  return new File([blob], filename, { type: mimeType })
}

// Process shared content and extract expenses
export async function processSharedContent(
  data: SharedData,
  onProgress?: (status: string) => void
): Promise<ProcessedShare> {
  const allItems: ParsedExpenseItem[] = []
  const suggestedCategories: string[] = []
  let rawText = ''
  let sourceType: ProcessedShare['sourceType'] = 'text'

  // Process text content first
  if (data.text) {
    onProgress?.('Analyzing text...')
    rawText = data.text

    const textResult = parseMultipleExpenses(data.text)
    allItems.push(...textResult.items)

    // Collect any unknown categories
    textResult.items.forEach(item => {
      if (item.category === 'Other' && item.description) {
        // Could suggest a category based on description
        const suggestion = suggestCategory(item.description)
        if (suggestion && !suggestedCategories.includes(suggestion)) {
          suggestedCategories.push(suggestion)
        }
      }
    })
  }

  // Process image files
  const imageFiles = data.files.filter(f => f.type.startsWith('image/'))
  if (imageFiles.length > 0) {
    sourceType = data.text ? 'mixed' : 'image'

    for (let i = 0; i < imageFiles.length; i++) {
      const fileData = imageFiles[i]
      onProgress?.(`Processing image ${i + 1} of ${imageFiles.length}...`)

      try {
        const file = base64ToFile(fileData.data, fileData.name, fileData.type)
        const base64WithPrefix = `data:${fileData.type};base64,${fileData.data}`

        // Try AI first if available (extracts MULTIPLE expenses)
        const apiKey = getGeminiApiKey()
        if (apiKey) {
          try {
            onProgress?.(`AI analyzing image ${i + 1} for multiple expenses...`)
            const aiResult = await extractMultipleExpensesWithGemini(base64WithPrefix, apiKey)

            if (aiResult.items.length > 0) {
              // Add all extracted items
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
              allItems.push(...parsedItems)
              rawText += (rawText ? '\n' : '') + (aiResult.rawText || '')
              console.log(`AI extracted ${aiResult.items.length} expenses from image`)
              continue
            }
          } catch (error) {
            console.warn('AI parsing failed, falling back to OCR:', error)
          }
        }

        // Fallback to OCR + smart parser for multiple expenses
        onProgress?.(`OCR processing image ${i + 1}...`)
        const ocrResult = await performOCR(file)

        if (ocrResult.success && ocrResult.text) {
          rawText += (rawText ? '\n' : '') + ocrResult.text

          // Use smart parser which handles multiple expenses
          const parsed = parseMultipleExpenses(ocrResult.text)
          allItems.push(...parsed.items)
          console.log(`OCR + parser extracted ${parsed.items.length} expenses from image`)
        }
      } catch (error) {
        console.error(`Failed to process image ${fileData.name}:`, error)
      }
    }
  }

  // Process PDF files
  const pdfFiles = data.files.filter(f => f.type === 'application/pdf')
  if (pdfFiles.length > 0) {
    sourceType = allItems.length > 0 ? 'mixed' : 'pdf'

    for (let i = 0; i < pdfFiles.length; i++) {
      const fileData = pdfFiles[i]
      onProgress?.(`Processing PDF ${i + 1} of ${pdfFiles.length}...`)

      try {
        const file = base64ToFile(fileData.data, fileData.name, fileData.type)

        // Use OCR service which handles PDFs
        const ocrResult = await performOCR(file)

        if (ocrResult.success && ocrResult.text) {
          rawText += (rawText ? '\n' : '') + ocrResult.text

          const parsed = parseMultipleExpenses(ocrResult.text)
          allItems.push(...parsed.items)
        }
      } catch (error) {
        console.error(`Failed to process PDF ${fileData.name}:`, error)
      }
    }
  }

  // Calculate overall confidence
  const avgConfidence = allItems.length > 0
    ? allItems.reduce((sum, item) => sum + item.confidence, 0) / allItems.length
    : 0

  return {
    items: allItems,
    sourceType,
    rawText,
    confidence: avgConfidence,
    suggestedCategories
  }
}

// Suggest new category based on description
function suggestCategory(description: string): string | null {
  const lowerDesc = description.toLowerCase()

  // Common patterns that might need new categories
  const patterns: Record<string, string> = {
    'adire': 'Clothing/Fashion',
    'fashion': 'Clothing/Fashion',
    'fabric': 'Clothing/Fashion',
    'tailor': 'Clothing/Fashion',
    'bet': 'Betting & Gambling',
    'sport': 'Betting & Gambling',
    'lotto': 'Betting & Gambling',
    'church': 'Tithe/Donation',
    'tithe': 'Tithe/Donation',
    'offering': 'Tithe/Donation',
    'mosque': 'Tithe/Donation',
    'charity': 'Tithe/Donation',
    'gym': 'Fitness/Health',
    'fitness': 'Fitness/Health',
    'spa': 'Self Care',
    'salon': 'Self Care',
    'barber': 'Self Care',
    'haircut': 'Self Care',
    'beauty': 'Self Care',
    'pet': 'Pets',
    'dog': 'Pets',
    'cat': 'Pets',
    'vet': 'Pets',
    'insurance': 'Insurance',
    'policy': 'Insurance',
    'pension': 'Savings/Investment',
    'investment': 'Savings/Investment',
    'stocks': 'Savings/Investment',
    'crypto': 'Savings/Investment',
    'subscription': 'Subscriptions',
    'monthly': 'Subscriptions'
  }

  for (const [keyword, category] of Object.entries(patterns)) {
    if (lowerDesc.includes(keyword)) {
      return category
    }
  }

  return null
}

// Check if category exists in the standard list
export function isCategoryValid(category: string, existingCategories: string[]): boolean {
  return existingCategories.some(c =>
    c.toLowerCase() === category.toLowerCase()
  )
}
