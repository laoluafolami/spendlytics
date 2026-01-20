import { ParsedExpense } from './expenseParser'
import { EXPENSE_CATEGORIES } from '../types/expense'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

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
