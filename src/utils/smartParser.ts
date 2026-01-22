/**
 * Smart Expense Parser
 * Handles multiple expense formats including:
 * - WhatsApp expense lists (e.g., "Food 60k, Fuel 40k")
 * - Nigerian receipt formats (OPay, GTBank, Moniepoint, Foodco)
 * - Multi-item receipts (supermarket receipts with line items)
 * - Bank SMS notifications
 */

import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types/expense'

export interface ParsedExpenseItem {
  amount: number
  description: string
  category: string
  date: string
  merchant?: string
  confidence: number
  type: 'expense' | 'income'
  rawText: string
}

export interface MultiParseResult {
  items: ParsedExpenseItem[]
  totalAmount: number
  sourceType: 'whatsapp_list' | 'receipt' | 'bank_sms' | 'bank_statement' | 'multi_item_receipt' | 'single' | 'unknown'
  confidence: number
  rawText: string
}

// Nigerian amount parsing - handles "60k", "60,000", "NGN 60,000", "₦60k"
function parseNigerianAmount(text: string): number | null {
  // Remove currency symbols and clean up
  let cleaned = text.replace(/[₦NGN\s]/gi, '').trim()

  // Handle "k" notation (60k = 60,000)
  const kMatch = cleaned.match(/^([\d,.]+)\s*k$/i)
  if (kMatch) {
    const num = parseFloat(kMatch[1].replace(/,/g, ''))
    return isNaN(num) ? null : num * 1000
  }

  // Handle "m" notation (1.5m = 1,500,000)
  const mMatch = cleaned.match(/^([\d,.]+)\s*m$/i)
  if (mMatch) {
    const num = parseFloat(mMatch[1].replace(/,/g, ''))
    return isNaN(num) ? null : num * 1000000
  }

  // Standard number with commas
  cleaned = cleaned.replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) || num <= 0 ? null : num
}

// Category inference from description
function inferCategory(text: string): string {
  const lowerText = text.toLowerCase()

  const categoryMap: Record<string, string[]> = {
    'Food & Dining': [
      'food', 'lunch', 'dinner', 'breakfast', 'restaurant', 'cafe', 'coffee',
      'suya', 'shawarma', 'chicken', 'rice', 'amala', 'pounded yam', 'jollof',
      'mcdonald', 'kfc', 'domino', 'pizza', 'burger', 'chicken republic',
      'mr biggs', 'tantalizers', 'kilimanjaro', 'sweet sensation', 'bukka',
      'eatery', 'coke', 'water', 'drink', 'snack', 'juice', 'soda', 'fanta', 'sprite'
    ],
    'Groceries': [
      'grocery', 'groceries', 'supermarket', 'shoprite', 'spar', 'market',
      'foodco', 'justrite', 'hubmart', 'next cash', 'provision', 'foodstuff',
      'bread', 'apple', 'fruit', 'vegetable', 'sardine', 'fish', 'meat', 'egg',
      'rice', 'beans', 'garri', 'yam', 'tomato', 'pepper', 'onion', 'oil'
    ],
    'Transportation': [
      'uber', 'bolt', 'taxi', 'cab', 'bus', 'brt', 'transport', 'fuel',
      'petrol', 'gas', 'diesel', 'filling', 'nnpc', 'mobil', 'total', 'oando',
      'conoil', 'toll', 'parking', 'fare', 'ride', 'trip', 'gokada', 'opay ride'
    ],
    'Bills & Utilities': [
      'light', 'electric', 'power', 'nepa', 'phcn', 'ikedc', 'ekedc', 'aedc',
      'water bill', 'internet', 'wifi', 'dstv', 'gotv', 'cable', 'netflix',
      'spotify', 'amazon prime', 'showmax', 'startimes', 'utility'
    ],
    'Airtime & Data': [
      'airtime', 'recharge', 'data', 'mtn', 'glo', 'airtel', '9mobile',
      'etisalat', 'vtu', 'topup'
    ],
    'Shopping': [
      'shop', 'shopping', 'store', 'mall', 'clothing', 'fashion', 'clothes',
      'shoes', 'bag', 'watch', 'jumia', 'konga', 'amazon', 'nike', 'adidas',
      'zara', 'slot', 'pointek', 'phone', 'laptop', 'computer'
    ],
    'Healthcare': [
      'hospital', 'clinic', 'pharmacy', 'drug', 'medicine', 'doctor',
      'medical', 'health', 'dental', 'lab', 'test', 'medplus', 'healthplus'
    ],
    'Bank Charges': [
      'charge', 'fee', 'commission', 'vat', 'stamp duty', 'sms alert',
      'maintenance', 'atm', 'transfer fee', 'bank charge'
    ],
    'Entertainment': [
      'cinema', 'movie', 'film', 'game', 'gaming', 'concert', 'show',
      'club', 'bar', 'lounge', 'filmhouse', 'genesis', 'silverbird', 'betting'
    ],
    'Education': [
      'school', 'tuition', 'book', 'course', 'training', 'exam', 'waec',
      'jamb', 'university', 'college', 'lesson', 'tutorial'
    ],
    'Travel': [
      'hotel', 'flight', 'airline', 'airbnb', 'booking', 'travel', 'trip',
      'vacation', 'arik', 'air peace', 'dana', 'ibom air'
    ],
    'Gift': [
      'gift', 'present', 'birthday', 'wedding', 'celebration', 'party'
    ],
    'House Repairs': [
      'plumb', 'plumber', 'plumbing', 'electrician', 'repair', 'fix',
      'maintenance', 'carpenter', 'paint', 'renovation'
    ],
    'Housing': [
      'rent', 'apartment', 'house', 'accommodation', 'caution fee'
    ],
    'Car Repairs': [
      'mechanic', 'car repair', 'auto', 'garage', 'tire', 'tyre', 'panel beater'
    ],
    'Contribution': [
      'contribution', 'ajo', 'esusu', 'cooperative', 'thrift', 'donation'
    ]
  }

  for (const [category, keywords] of Object.entries(categoryMap)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return category
      }
    }
  }

  return 'Other'
}

// Parse WhatsApp-style expense lists
// Examples: "Food 60k, Mum's adire 60k, Fuel 40k"
// Or: "Food - 60k\nFuel - 30k\nAirtime - 5k"
function parseWhatsAppList(text: string): ParsedExpenseItem[] {
  const items: ParsedExpenseItem[] = []
  const today = new Date().toISOString().split('T')[0]

  // Split by common delimiters
  const lines = text
    .split(/[,\n;]+/)
    .map(l => l.trim())
    .filter(l => l.length > 0)

  for (const line of lines) {
    // Try pattern: "description amount" or "description - amount" or "amount description"
    const patterns = [
      // "Food 60k" or "Food 60,000"
      /^(.+?)\s+([\d,.]+k?m?)$/i,
      // "Food - 60k" or "Food: 60k"
      /^(.+?)\s*[-:]\s*([\d,.]+k?m?)$/i,
      // "60k Food" or "₦60,000 Food"
      /^[₦NGN]?\s*([\d,.]+k?m?)\s+(.+)$/i,
      // "NGN 60,000 for Food"
      /^(?:NGN|₦)?\s*([\d,.]+k?m?)\s+(?:for\s+)?(.+)$/i,
    ]

    for (const pattern of patterns) {
      const match = line.match(pattern)
      if (match) {
        let description: string
        let amountStr: string

        // Check which capture group has the amount
        if (/^[\d,.]+k?m?$/i.test(match[1])) {
          amountStr = match[1]
          description = match[2]
        } else {
          description = match[1]
          amountStr = match[2]
        }

        const amount = parseNigerianAmount(amountStr)
        if (amount && amount > 0) {
          items.push({
            amount,
            description: description.trim(),
            category: inferCategory(description),
            date: today,
            confidence: 75,
            type: 'expense',
            rawText: line
          })
          break
        }
      }
    }
  }

  return items
}

// Parse OPay receipt format
function parseOPayReceipt(text: string): ParsedExpenseItem | null {
  const lowerText = text.toLowerCase()
  if (!lowerText.includes('opay') && !lowerText.includes('o\'pay')) {
    return null
  }

  // Extract amount - OPay format: "₦585.00" or "NGN 585.00"
  const amountMatch = text.match(/[₦NGN]\s*([\d,]+\.?\d*)/i)
  if (!amountMatch) return null

  const amount = parseNigerianAmount(amountMatch[1])
  if (!amount) return null

  // Extract merchant name
  const merchantPatterns = [
    /(?:to|merchant|paid to)[:\s]+([A-Za-z][A-Za-z0-9\s&'.-]+?)(?:\s*\n|$)/i,
    /([A-Z][A-Z\s]+(?:CLUB|STORE|SHOP|RESTAURANT|CAFE|MARKET))/i,
  ]

  let merchant = 'OPay Payment'
  for (const pattern of merchantPatterns) {
    const match = text.match(pattern)
    if (match) {
      merchant = match[1].trim()
      break
    }
  }

  // Extract date
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})|(\d{4})[\/\-](\d{2})[\/\-](\d{2})|(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})/i)
  let date = new Date().toISOString().split('T')[0]
  if (dateMatch) {
    try {
      const parsed = new Date(dateMatch[0])
      if (!isNaN(parsed.getTime())) {
        date = parsed.toISOString().split('T')[0]
      }
    } catch {}
  }

  // Extract description/remarks
  const descMatch = text.match(/(?:remark|description|for)[:\s]+(.+?)(?:\n|$)/i)
  const description = descMatch ? descMatch[1].trim() : merchant

  return {
    amount,
    description,
    category: inferCategory(description + ' ' + merchant),
    date,
    merchant,
    confidence: 85,
    type: 'expense',
    rawText: text
  }
}

// Parse Moniepoint receipt format
function parseMoniepointReceipt(text: string): ParsedExpenseItem | null {
  const lowerText = text.toLowerCase()
  if (!lowerText.includes('moniepoint')) {
    return null
  }

  // Extract amount
  const amountMatch = text.match(/[₦NGN]\s*([\d,]+\.?\d*)/i)
  if (!amountMatch) return null

  const amount = parseNigerianAmount(amountMatch[1])
  if (!amount) return null

  // Extract merchant/terminal
  const merchantMatch = text.match(/(?:terminal|merchant|at)[:\s]+([A-Za-z][A-Za-z0-9\s&'.-]+?)(?:\s*\n|$)/i)
  const merchant = merchantMatch ? merchantMatch[1].trim() : 'Moniepoint POS'

  // Extract date
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i)
  let date = new Date().toISOString().split('T')[0]
  if (dateMatch) {
    try {
      const [, d, m, y] = dateMatch
      const year = y.length === 2 ? '20' + y : y
      date = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    } catch {}
  }

  return {
    amount,
    description: merchant,
    category: inferCategory(merchant),
    date,
    merchant,
    confidence: 85,
    type: 'expense',
    rawText: text
  }
}

// Parse GTBank receipt/SMS format
function parseGTBankReceipt(text: string): ParsedExpenseItem | null {
  const lowerText = text.toLowerCase()
  if (!lowerText.includes('gtbank') && !lowerText.includes('guaranty trust') && !lowerText.includes('gtb')) {
    return null
  }

  // Extract amount
  const amountMatch = text.match(/(?:NGN|₦|N)\s*([\d,]+\.?\d*)/i) ||
                      text.match(/(?:amount|amt)[:\s]*([\d,]+\.?\d*)/i)
  if (!amountMatch) return null

  const amount = parseNigerianAmount(amountMatch[1])
  if (!amount) return null

  // Determine if debit or credit
  const isCredit = lowerText.includes('credit') || lowerText.includes('received') ||
                   lowerText.includes('inflow') || lowerText.includes(' cr')

  // Extract description/narration
  const descMatch = text.match(/(?:narration|description|remark|for)[:\s]+(.+?)(?:\n|$)/i)
  const description = descMatch ? descMatch[1].trim() : 'GTBank Transaction'

  // Extract date
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i)
  let date = new Date().toISOString().split('T')[0]
  if (dateMatch) {
    try {
      const [, d, m, y] = dateMatch
      const year = y.length === 2 ? '20' + y : y
      date = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    } catch {}
  }

  return {
    amount,
    description,
    category: isCredit ? 'Transfer In' : inferCategory(description),
    date,
    confidence: 85,
    type: isCredit ? 'income' : 'expense',
    rawText: text
  }
}

// Parse Foodco/supermarket multi-item receipt
function parseFoodcoReceipt(text: string): ParsedExpenseItem[] {
  const items: ParsedExpenseItem[] = []
  const lowerText = text.toLowerCase()

  // Check if it's a supermarket receipt
  const isSupermarket = lowerText.includes('foodco') || lowerText.includes('shoprite') ||
                        lowerText.includes('spar') || lowerText.includes('justrite') ||
                        lowerText.includes('hubmart') || lowerText.includes('receipt') ||
                        lowerText.includes('item') || lowerText.includes('qty')

  if (!isSupermarket) return items

  const today = new Date().toISOString().split('T')[0]

  // Try to extract date from receipt
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i)
  let date = today
  if (dateMatch) {
    try {
      const [, d, m, y] = dateMatch
      const year = y.length === 2 ? '20' + y : y
      date = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    } catch {}
  }

  // Extract merchant name
  let merchant = 'Supermarket'
  if (lowerText.includes('foodco')) merchant = 'Foodco'
  else if (lowerText.includes('shoprite')) merchant = 'Shoprite'
  else if (lowerText.includes('spar')) merchant = 'Spar'
  else if (lowerText.includes('justrite')) merchant = 'Justrite'
  else if (lowerText.includes('hubmart')) merchant = 'Hubmart'

  // Extract line items - various receipt formats
  const lines = text.split(/\n/)

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (trimmedLine.length < 3) continue

    // Skip header/footer lines
    if (/^(total|subtotal|sub-total|grand|change|cash|card|vat|discount|item|description|qty|quantity|receipt|invoice|tel|phone|address|thank|welcome|date|time|terminal|pos|ref|transaction)\b/i.test(trimmedLine)) continue
    if (/^[-=_*#]+$/.test(trimmedLine)) continue // Skip separator lines

    // Multiple patterns for different receipt formats:
    const patterns = [
      // "ITEM NAME    1,500.00" or "ITEM NAME 1500.00"
      /^([A-Za-z][A-Za-z0-9\s&'.\/-]+?)\s{2,}([\d,]+\.?\d*)$/,
      // "ITEM NAME ... 1,500.00" (dots as separator)
      /^([A-Za-z][A-Za-z0-9\s&'.\/-]+?)\.{2,}\s*([\d,]+\.?\d*)$/,
      // "ITEM NAME 1 @ 500.00 = 500.00" (quantity format - use total)
      /^([A-Za-z][A-Za-z0-9\s&'.\/-]+?)\s+\d+\s*[@x]\s*[\d,.]+\s*=?\s*([\d,]+\.?\d*)$/i,
      // "ITEM NAME    QTY  PRICE" where PRICE is the last number
      /^([A-Za-z][A-Za-z0-9\s&'.\/-]+?)\s+\d+\s+([\d,]+\.?\d*)$/,
      // "500.00 ITEM NAME" (price first)
      /^([\d,]+\.?\d*)\s+([A-Za-z][A-Za-z0-9\s&'.\/-]+)$/,
      // Simple "ITEM NAME 1500" or "ITEM 1,500"
      /^([A-Za-z][A-Za-z0-9\s&'.\/-]+?)\s+([\d,]+\.?\d*)$/,
      // "ITEM NAME (500g) 1500" - with size/weight
      /^([A-Za-z][A-Za-z0-9\s&'.\/-]+\([^)]+\))\s*([\d,]+\.?\d*)$/,
    ]

    for (const pattern of patterns) {
      const match = trimmedLine.match(pattern)
      if (match) {
        let itemName: string
        let amountStr: string

        // Check if first group is the amount (price first format)
        if (/^[\d,]+\.?\d*$/.test(match[1])) {
          amountStr = match[1]
          itemName = match[2]
        } else {
          itemName = match[1]
          amountStr = match[2]
        }

        const amount = parseNigerianAmount(amountStr)
        itemName = itemName.trim().replace(/\s+/g, ' ') // Normalize whitespace

        // Validate: reasonable amount (> 10 naira, < 10 million) and valid name
        if (amount && amount >= 10 && amount < 10000000 && itemName.length > 1 && /[a-zA-Z]{2,}/.test(itemName)) {
          items.push({
            amount,
            description: itemName,
            category: inferCategory(itemName) || 'Groceries',
            date,
            merchant,
            confidence: 75,
            type: 'expense',
            rawText: trimmedLine
          })
          break // Move to next line once matched
        }
      }
    }
  }

  // If no items found but we have a total, create single item
  if (items.length === 0) {
    const totalMatch = text.match(/(?:total|grand total|amount)[:\s]*([\d,]+\.?\d*)/i)
    if (totalMatch) {
      const amount = parseNigerianAmount(totalMatch[1])
      if (amount) {
        items.push({
          amount,
          description: `${merchant} Purchase`,
          category: 'Groceries',
          date,
          merchant,
          confidence: 70,
          type: 'expense',
          rawText: text
        })
      }
    }
  }

  return items
}

// Parse generic bank SMS notification
function parseBankSMS(text: string): ParsedExpenseItem | null {
  // Common Nigerian bank SMS patterns
  const patterns = [
    // Debit patterns
    /(?:NGN|₦|N)\s*([\d,]+\.?\d*)\s*(?:has been|was)\s*(?:debited|withdrawn)/i,
    /(?:debit|dr)[:\s]*(?:NGN|₦|N)?\s*([\d,]+\.?\d*)/i,
    /(?:spent|paid|transfer(?:red)?)[:\s]*(?:NGN|₦|N)?\s*([\d,]+\.?\d*)/i,
    // Credit patterns
    /(?:NGN|₦|N)\s*([\d,]+\.?\d*)\s*(?:has been|was)\s*credited/i,
    /(?:credit|cr)[:\s]*(?:NGN|₦|N)?\s*([\d,]+\.?\d*)/i,
    /(?:received|inflow)[:\s]*(?:NGN|₦|N)?\s*([\d,]+\.?\d*)/i,
  ]

  let amount: number | null = null
  let isCredit = false

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      amount = parseNigerianAmount(match[1])
      isCredit = /credit|cr|received|inflow/i.test(match[0])
      break
    }
  }

  if (!amount) return null

  // Extract description
  const descPatterns = [
    /(?:desc|narration|remark|ref)[:\s]+(.+?)(?:\n|$)/i,
    /(?:at|to|from)\s+([A-Za-z][A-Za-z0-9\s&'.-]+?)(?:\s+on|\s*\n|$)/i,
  ]

  let description = isCredit ? 'Bank Credit' : 'Bank Debit'
  for (const pattern of descPatterns) {
    const match = text.match(pattern)
    if (match) {
      description = match[1].trim()
      break
    }
  }

  // Extract date
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i)
  let date = new Date().toISOString().split('T')[0]
  if (dateMatch) {
    try {
      const [, d, m, y] = dateMatch
      const year = y.length === 2 ? '20' + y : y
      date = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    } catch {}
  }

  return {
    amount,
    description,
    category: isCredit ? 'Transfer In' : inferCategory(description),
    date,
    confidence: 80,
    type: isCredit ? 'income' : 'expense',
    rawText: text
  }
}

// Detect the type of input and parse accordingly
function detectSourceType(text: string): MultiParseResult['sourceType'] {
  const lowerText = text.toLowerCase()

  // Check for specific receipt formats
  if (lowerText.includes('opay') || lowerText.includes('o\'pay')) return 'receipt'
  if (lowerText.includes('moniepoint')) return 'receipt'
  if (lowerText.includes('gtbank') || lowerText.includes('guaranty trust')) return 'receipt'

  // Check for supermarket receipt
  if (lowerText.includes('foodco') || lowerText.includes('shoprite') ||
      lowerText.includes('spar') || (lowerText.includes('receipt') && lowerText.includes('total'))) {
    return 'multi_item_receipt'
  }

  // Check for bank SMS
  if (/(?:debited|credited|transfer|withdraw)/i.test(text) &&
      /(?:NGN|₦|acct|account)/i.test(text)) {
    return 'bank_sms'
  }

  // Check for WhatsApp-style list (multiple items with amounts)
  const listIndicators = text.split(/[,\n;]+/).filter(l => {
    const trimmed = l.trim()
    return trimmed.length > 0 && /[\d,.]+k?m?/i.test(trimmed)
  })
  if (listIndicators.length >= 2) {
    return 'whatsapp_list'
  }

  return 'single'
}

// Main parsing function - handles all input types
export function parseMultipleExpenses(text: string): MultiParseResult {
  const trimmedText = text.trim()
  if (!trimmedText) {
    return {
      items: [],
      totalAmount: 0,
      sourceType: 'unknown',
      confidence: 0,
      rawText: text
    }
  }

  const sourceType = detectSourceType(trimmedText)
  let items: ParsedExpenseItem[] = []

  switch (sourceType) {
    case 'whatsapp_list':
      items = parseWhatsAppList(trimmedText)
      break

    case 'multi_item_receipt':
      items = parseFoodcoReceipt(trimmedText)
      break

    case 'receipt': {
      // Try each receipt parser
      const opayResult = parseOPayReceipt(trimmedText)
      if (opayResult) {
        items = [opayResult]
        break
      }

      const moniepointResult = parseMoniepointReceipt(trimmedText)
      if (moniepointResult) {
        items = [moniepointResult]
        break
      }

      const gtbResult = parseGTBankReceipt(trimmedText)
      if (gtbResult) {
        items = [gtbResult]
        break
      }
      break
    }

    case 'bank_sms': {
      const smsResult = parseBankSMS(trimmedText)
      if (smsResult) {
        items = [smsResult]
      }
      break
    }

    case 'single':
    default: {
      // Try all parsers and use the best result
      const allResults: ParsedExpenseItem[] = []

      const opay = parseOPayReceipt(trimmedText)
      if (opay) allResults.push(opay)

      const moniepoint = parseMoniepointReceipt(trimmedText)
      if (moniepoint) allResults.push(moniepoint)

      const gtb = parseGTBankReceipt(trimmedText)
      if (gtb) allResults.push(gtb)

      const sms = parseBankSMS(trimmedText)
      if (sms) allResults.push(sms)

      const whatsappItems = parseWhatsAppList(trimmedText)
      allResults.push(...whatsappItems)

      const foodcoItems = parseFoodcoReceipt(trimmedText)
      allResults.push(...foodcoItems)

      // Use highest confidence results
      if (allResults.length > 0) {
        items = allResults.sort((a, b) => b.confidence - a.confidence)
        // If we have multiple high-confidence items, keep them all
        if (items.length > 1 && items[1].confidence >= 70) {
          items = items.filter(i => i.confidence >= 70)
        } else {
          items = [items[0]]
        }
      }
      break
    }
  }

  // Calculate totals
  const totalAmount = items.reduce((sum, item) => {
    return sum + (item.type === 'expense' ? item.amount : 0)
  }, 0)

  const avgConfidence = items.length > 0
    ? items.reduce((sum, item) => sum + item.confidence, 0) / items.length
    : 0

  return {
    items,
    totalAmount,
    sourceType: items.length > 0 ? sourceType : 'unknown',
    confidence: avgConfidence,
    rawText: text
  }
}

// Parse with AI enhancement (fallback to rule-based if AI fails)
export async function parseWithAIFallback(
  text: string,
  imageBase64: string | null,
  apiKey: string | null,
  onProgress?: (status: string) => void
): Promise<MultiParseResult> {
  // First try rule-based parsing
  onProgress?.('Analyzing text...')
  const ruleBasedResult = parseMultipleExpenses(text)

  // If rule-based has high confidence, use it
  if (ruleBasedResult.confidence >= 75 && ruleBasedResult.items.length > 0) {
    return ruleBasedResult
  }

  // If no API key or no image, return rule-based result
  if (!apiKey || !imageBase64) {
    return ruleBasedResult
  }

  // Try AI enhancement
  try {
    onProgress?.('Enhancing with AI...')

    const { extractExpenseWithGemini } = await import('./geminiService')
    const aiResult = await extractExpenseWithGemini(imageBase64, apiKey)

    if (aiResult.amount && aiResult.confidence > ruleBasedResult.confidence) {
      const today = new Date().toISOString().split('T')[0]
      return {
        items: [{
          amount: aiResult.amount,
          description: aiResult.description || aiResult.merchant || 'AI Extracted',
          category: aiResult.category || inferCategory(aiResult.description || ''),
          date: aiResult.date || today,
          merchant: aiResult.merchant || undefined,
          confidence: aiResult.confidence,
          type: 'expense',
          rawText: aiResult.rawText || text
        }],
        totalAmount: aiResult.amount,
        sourceType: 'single',
        confidence: aiResult.confidence,
        rawText: text
      }
    }
  } catch (error) {
    console.warn('AI parsing failed, using rule-based result:', error)
  }

  return ruleBasedResult
}

// Quick parse for simple inputs like "uber 12.50" or "lunch 25"
export function parseQuickExpense(text: string): ParsedExpenseItem | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const parts = trimmed.split(/\s+/)
  let amount: number | null = null
  let description = ''

  for (const part of parts) {
    const parsed = parseNigerianAmount(part)
    if (parsed !== null) {
      amount = parsed
    } else {
      description += (description ? ' ' : '') + part
    }
  }

  if (amount === null) return null

  return {
    amount,
    description: description || 'Quick expense',
    category: inferCategory(description),
    date: new Date().toISOString().split('T')[0],
    confidence: 70,
    type: 'expense',
    rawText: text
  }
}

// Validate category against allowed categories
export function validateCategory(category: string, type: 'expense' | 'income'): string {
  const validCategories = type === 'expense'
    ? EXPENSE_CATEGORIES
    : INCOME_CATEGORIES

  if (validCategories.includes(category as any)) {
    return category
  }

  // Try to find closest match
  const lowerCategory = category.toLowerCase()
  for (const validCat of validCategories) {
    if (validCat.toLowerCase().includes(lowerCategory) ||
        lowerCategory.includes(validCat.toLowerCase())) {
      return validCat
    }
  }

  return type === 'expense' ? 'Other' : 'Other'
}
