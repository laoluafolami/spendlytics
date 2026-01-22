import { ParsedExpense } from './expenseParser'
import { EXPENSE_CATEGORIES } from '../types/expense'

// Using gemini-2.0-flash (works but may hit rate limits on free tier)
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

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

// Extract MULTIPLE expenses from an image (e.g., WhatsApp expense lists, receipts with multiple items)
export interface MultiExpenseItem {
  amount: number
  description: string
  category: string
  date: string
  type: 'expense' | 'income'
  merchant?: string
  confidence: number
}

export async function extractMultipleExpensesWithGemini(
  imageBase64: string,
  apiKey: string
): Promise<{ items: MultiExpenseItem[], rawText: string }> {
  const prompt = `You are an expert Nigerian financial receipt parser. Analyze this image and extract expense/transaction information with EXTREME ACCURACY.

**CRITICAL - IDENTIFYING THE AMOUNT:**
The AMOUNT is the MOST IMPORTANT field. DO NOT confuse it with:
- Dates (like "17" from "Jan 17th") - NEVER extract dates as amounts
- Transaction IDs (long numbers like "2601170201...")
- Session IDs or Reference numbers
- Phone numbers (like "813****523")
- Account numbers

The AMOUNT will typically:
- Have a CURRENCY SYMBOL: ₦, NGN, N, or "Naira"
- Be in a PROMINENT position (large text, colored, centered)
- Have DECIMAL places for bank transactions (e.g., ₦585.00, ₦1,500.00)
- Be labeled as "Amount", "Total", "Value", or just displayed prominently

**NIGERIAN PAYMENT APP RECEIPTS (OPay, Moniepoint, PalmPay, Kuda, etc.):**
- The AMOUNT is usually the LARGEST TEXT on the receipt
- Often displayed in GREEN or BOLD
- Format: "₦585.00" or "NGN 1,500.00"
- Look for the Naira symbol (₦) - the number RIGHT AFTER IT is the amount
- The amount appears BEFORE "Successful" or transaction status
- IGNORE: Transaction No., Session ID, dates in the amount field

**OPay Receipt Structure (IMPORTANT):**
- Logo at top
- AMOUNT in large green text with ₦ symbol (THIS IS WHAT YOU EXTRACT)
- "Successful" status below amount
- Date/time below status
- Recipient Details, Sender Details
- Remark (use this as description if available)
- Transaction No., Session ID (IGNORE these numbers)

**BANK SMS/NOTIFICATIONS:**
- Amount follows "NGN", "₦", or after "debited/credited"
- Look for patterns like "₦5,000.00 has been debited"

**SUPERMARKET RECEIPTS (Foodco, Shoprite, SPAR):**
- Multiple line items with prices
- Extract EACH item separately
- Prices usually at the end of each line

**AMOUNT VALIDATION:**
- Nigerian transactions are typically ₦100 to ₦10,000,000
- Single/double digit amounts (like 17, 26) are ALMOST NEVER correct
- If you see a small number, it's probably a DATE or QUANTITY, not the amount
- Amounts usually have .00 decimal for bank transactions

**OUTPUT FORMAT - Return ONLY this JSON:**
{
  "items": [
    {"amount": 585, "description": "Coke and water for Damilare", "category": "Food & Dining", "date": "2026-01-17", "type": "expense", "merchant": "IBADAN RECREATION CLUB"}
  ],
  "rawText": "full text you can read from the image"
}

**CATEGORY MAPPING:**
- Food, drinks, restaurants, clubs → "Food & Dining"
- Groceries, supermarket items → "Groceries"
- Fuel, petrol, diesel, transport → "Transportation"
- Airtime, data, recharge → "Airtime & Data"
- Electricity, water, bills → "Bills & Utilities"
- Transfers to individuals → "Transfer"
- Shopping, retail → "Shopping"

**FINAL CHECK BEFORE RESPONDING:**
1. Is the amount a reasonable Nigerian transaction amount (not a date or ID)?
2. Does the amount have the ₦ or NGN prefix in the original image?
3. Is it the PROMINENT/LARGE number on the receipt, not a small detail?

If unsure, the amount on payment app receipts is ALWAYS the large colored number near the top with ₦ symbol.`

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
                // Detect mime type from base64 data URL
                mime_type: imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg',
                data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.05, // Lower temperature for more accurate extraction
          maxOutputTokens: 8000 // More tokens for long receipts with many items
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Gemini API error: ${response.status}`, errorText)

      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait and try again.')
      }
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

    // Validate and normalize items
    const items: MultiExpenseItem[] = (parsed.items || []).map((item: Record<string, unknown>) => {
      const categoryStr = String(item.category || 'Other')
      const validCategory = EXPENSE_CATEGORIES.includes(categoryStr as typeof EXPENSE_CATEGORIES[number])
        ? categoryStr
        : 'Other'

      let amount = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount)) || 0

      // VALIDATION: Flag suspiciously low amounts (likely date/ID confusion)
      // Most Nigerian transactions are at least ₦50
      let confidence = 85
      if (amount > 0 && amount < 50) {
        console.warn(`Suspicious low amount detected: ${amount}. This might be a date or ID, not an amount.`)
        confidence = 20 // Very low confidence for suspicious amounts
      } else if (amount >= 50 && amount < 100) {
        confidence = 70 // Slightly lower confidence for very small amounts
      }

      return {
        amount,
        description: String(item.description || 'Unknown expense'),
        category: validCategory,
        date: String(item.date || new Date().toISOString().split('T')[0]),
        type: item.type === 'income' ? 'income' as const : 'expense' as const,
        merchant: item.merchant ? String(item.merchant) : undefined,
        confidence
      }
    }).filter((item: MultiExpenseItem) => item.amount >= 50) // Filter out likely-incorrect tiny amounts

    return {
      items,
      rawText: parsed.rawText || text
    }
  } catch (error) {
    console.error('Gemini multi-extraction error:', error)
    throw error
  }
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

    const prompt = `You are an expert bank statement parser for Nigerian banks. Analyze this bank statement text and extract ALL transactions.

**CRITICAL - IDENTIFYING TRANSACTION TYPE (income vs expense):**
This is VERY IMPORTANT. You MUST correctly identify whether each transaction is INCOME or EXPENSE:

INCOME (type: "income") - Money coming INTO the account:
- Look for: "CR", "CREDIT", "CRE", "C" in type/indicator columns
- Keywords: "salary", "payment received", "transfer from", "deposit", "refund", "reversal", "inflow", "credit alert"
- In Nigerian banks: "NIP CR", "NIBSS Inward", "Inward Transfer", "Salary Payment"
- If the amount appears in a "Credit" or "CR" column, it's INCOME
- If description says "From [name]" or "Transfer from", it's INCOME

EXPENSE (type: "expense") - Money going OUT of the account:
- Look for: "DR", "DEBIT", "DEB", "D" in type/indicator columns
- Keywords: "purchase", "payment", "POS", "ATM", "withdrawal", "transfer to", "debit", "charge", "fee"
- In Nigerian banks: "NIP DR", "NIBSS Outward", "POS Purchase", "Web Purchase", "ATM Withdrawal"
- If the amount appears in a "Debit" or "DR" column, it's EXPENSE
- If description says "To [name]" or "Transfer to", it's EXPENSE

**COMMON NIGERIAN BANK STATEMENT FORMATS:**
- Statements often have separate "Debit" and "Credit" columns - use this to determine type
- Some show "DR"/"CR" next to amounts or in a separate column
- Transaction descriptions often contain clues: "POS" = expense, "Salary" = income
- "Transfer" alone needs context: "Transfer from" = income, "Transfer to" = expense

For each transaction, extract:
- date: in YYYY-MM-DD format
- description: the transaction description/narration
- amount: the numeric amount (positive number, no currency symbols)
- type: "income" OR "expense" (based on rules above)
- category: classify into appropriate category

EXPENSE CATEGORIES: Food & Dining, Groceries, Transportation, Bills & Utilities, Airtime & Data, Shopping, Healthcare, Bank Charges, Entertainment, Betting & Gambling, Education, Travel, Transfer Out, Cash Withdrawal, Other

INCOME CATEGORIES: Salary, Freelance, Investment, Business, Transfer In, Refund, Gift, Other Income

Bank Statement Text:
"""
${chunks[i]}
"""

Return ONLY a JSON array of transactions, no other text. Example format:
[
  {"date": "2023-10-01", "description": "POS Purchase at Shoprite", "amount": 5000.00, "type": "expense", "category": "Groceries"},
  {"date": "2023-10-02", "description": "Transfer from John Doe", "amount": 50000.00, "type": "income", "category": "Transfer In"},
  {"date": "2023-10-03", "description": "Salary Payment - ABC Company", "amount": 250000.00, "type": "income", "category": "Salary"},
  {"date": "2023-10-04", "description": "ATM Withdrawal", "amount": 20000.00, "type": "expense", "category": "Cash Withdrawal"}
]

If a section doesn't contain transactions (e.g., headers, summaries), return an empty array [].
Be thorough - extract EVERY transaction and correctly identify if it's income or expense!`

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
