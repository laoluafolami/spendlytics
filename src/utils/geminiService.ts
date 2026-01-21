import { ParsedExpense } from './expenseParser'
import { EXPENSE_CATEGORIES } from '../types/expense'

// Using gemini-pro for text processing (stable and widely available)
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string
      }>
    }
  }>
}

export async function extractExpenseWithGemini(
  imageBase64: string,
  apiKey: string
): Promise<ParsedExpense> {
  const prompt = `Analyze this receipt or transaction image and extract the following information in JSON format:
{
  "amount": <number or null>,
  "merchant": "<string or null>",
  "category": "<one of: ${EXPENSE_CATEGORIES.join(', ')} or null>",
  "date": "<YYYY-MM-DD format or null>",
  "description": "<brief description or null>"
}

Only return the JSON object, no other text. If you cannot determine a value, use null.
For Nigerian Naira amounts (NGN, ₦, N), extract the numeric value.
For dates, convert to YYYY-MM-DD format.
Choose the most appropriate category from the list provided.`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data: GeminiResponse = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      throw new Error('No response from Gemini')
    }

    // Parse JSON from response (handle potential markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse Gemini response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      amount: parsed.amount,
      merchant: parsed.merchant,
      category: EXPENSE_CATEGORIES.includes(parsed.category) ? parsed.category : null,
      date: parsed.date || new Date().toISOString().split('T')[0],
      description: parsed.description || parsed.merchant,
      confidence: 85, // Gemini typically has high accuracy
      rawText: text
    }
  } catch (error) {
    console.error('Gemini extraction error:', error)
    throw error
  }
}

export async function extractExpenseFromTextWithGemini(
  text: string,
  apiKey: string
): Promise<ParsedExpense> {
  const prompt = `Analyze this transaction text (could be a bank SMS, email notification, or receipt text) and extract expense information in JSON format:

Text: "${text}"

Return JSON:
{
  "amount": <number or null>,
  "merchant": "<string or null>",
  "category": "<one of: ${EXPENSE_CATEGORIES.join(', ')} or null>",
  "date": "<YYYY-MM-DD format or null>",
  "description": "<brief description or null>"
}

Only return the JSON object, no other text. If you cannot determine a value, use null.
Handle Nigerian bank formats (GTBank, Access Bank, FirstBank, UBA, Zenith, etc.).
For Nigerian Naira (NGN, ₦, N), extract just the numeric value.`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data: GeminiResponse = await response.json()
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!responseText) {
      throw new Error('No response from Gemini')
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse Gemini response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      amount: parsed.amount,
      merchant: parsed.merchant,
      category: EXPENSE_CATEGORIES.includes(parsed.category) ? parsed.category : null,
      date: parsed.date || new Date().toISOString().split('T')[0],
      description: parsed.description || parsed.merchant,
      confidence: 90,
      rawText: text
    }
  } catch (error) {
    console.error('Gemini text extraction error:', error)
    throw error
  }
}

// Check if Gemini API key is configured
export function getGeminiApiKey(): string | null {
  // Check localStorage first (user-configured)
  const storedKey = localStorage.getItem('gemini_api_key')
  if (storedKey) return storedKey

  // Check environment variable
  const envKey = import.meta.env.VITE_GEMINI_API_KEY
  if (envKey) return envKey

  return null
}

export function setGeminiApiKey(key: string): void {
  localStorage.setItem('gemini_api_key', key)
}

export function clearGeminiApiKey(): void {
  localStorage.removeItem('gemini_api_key')
}

// AI-powered bank statement parsing
export interface AITransaction {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
}

export async function parseBankStatementWithAI(
  text: string,
  apiKey: string,
  onProgress?: (status: string) => void
): Promise<AITransaction[]> {
  // Split text into chunks if too long (Gemini can handle ~30k tokens well)
  const maxChunkSize = 15000 // characters
  const chunks: string[] = []

  if (text.length <= maxChunkSize) {
    chunks.push(text)
  } else {
    // Split by lines to avoid cutting transactions
    const lines = text.split('\n')
    let currentChunk = ''

    for (const line of lines) {
      if (currentChunk.length + line.length > maxChunkSize) {
        if (currentChunk) chunks.push(currentChunk)
        currentChunk = line
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line
      }
    }
    if (currentChunk) chunks.push(currentChunk)
  }

  console.log(`Processing ${chunks.length} chunk(s) with AI...`)

  const allTransactions: AITransaction[] = []

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(`AI analyzing chunk ${i + 1} of ${chunks.length}...`)

    const prompt = `You are a bank statement parser. Analyze this bank statement text and extract ALL transactions.

For each transaction, extract:
- date: in YYYY-MM-DD format
- description: the transaction description/narration
- amount: the numeric amount (no currency symbols)
- type: "expense" for debits/withdrawals, "income" for credits/deposits
- category: classify into one of these categories:
  EXPENSES: Food & Dining, Groceries, Transportation, Bills & Utilities, Airtime & Data, Shopping, Healthcare, Bank Charges, Entertainment, Betting & Gambling, Education, Travel, Transfer Out, Cash Withdrawal, Other
  INCOME: Salary, Freelance, Investment, Business, Transfer In, Refund, Gift, Other Income

Bank Statement Text:
"""
${chunks[i]}
"""

Return ONLY a JSON array of transactions, no other text. Example format:
[
  {"date": "2023-10-01", "description": "POS Purchase at Shoprite", "amount": 5000.00, "type": "expense", "category": "Groceries"},
  {"date": "2023-10-02", "description": "Transfer from John Doe", "amount": 50000.00, "type": "income", "category": "Transfer In"}
]

If a section doesn't contain transactions (e.g., headers, summaries), return an empty array [].
Be thorough - extract EVERY transaction you can identify.`

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8000
          }
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Gemini API error: ${response.status}`, errorText)

        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a minute and try again, or disable AI parsing to use the rule-based parser.')
        }
        if (response.status === 404) {
          throw new Error('AI model not available. Please try again later or disable AI parsing.')
        }
        throw new Error(`Gemini API error: ${response.status}`)
      }

      const data: GeminiResponse = await response.json()
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text

      if (!responseText) {
        console.warn(`Chunk ${i + 1}: No response from Gemini`)
        continue
      }

      // Parse JSON array from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        try {
          const transactions = JSON.parse(jsonMatch[0]) as AITransaction[]
          console.log(`Chunk ${i + 1}: Found ${transactions.length} transactions`)
          allTransactions.push(...transactions)
        } catch (parseError) {
          console.warn(`Chunk ${i + 1}: Failed to parse JSON`, parseError)
        }
      } else {
        console.warn(`Chunk ${i + 1}: No JSON array found in response`)
      }
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error)
      throw error
    }
  }

  console.log(`AI parsing complete: ${allTransactions.length} total transactions found`)
  return allTransactions
}
