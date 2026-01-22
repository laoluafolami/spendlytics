/**
 * Unified Transaction Parser
 *
 * Consolidates all parsing logic from:
 * - smartParser.ts (rule-based multi-expense)
 * - expenseParser.ts (basic text parsing)
 * - geminiService.ts (AI parsing - integration)
 *
 * Single source of truth for:
 * - Amount parsing (Nigerian + international formats)
 * - Date parsing (all formats)
 * - Category inference (comprehensive keyword mapping)
 * - Bank-specific receipt parsing
 * - Multi-expense detection and parsing
 */

import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types/expense'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ParsedTransaction {
  amount: number
  description: string
  category: string
  date: string
  merchant?: string
  confidence: number
  type: 'expense' | 'income'
  rawText: string
  paymentMethod?: string
}

export interface MultiParseResult {
  items: ParsedTransaction[]
  totalAmount: number
  sourceType: 'whatsapp_list' | 'receipt' | 'bank_sms' | 'bank_statement' | 'multi_item_receipt' | 'single' | 'unknown'
  confidence: number
  rawText: string
}

export interface ParseOptions {
  preferAI?: boolean
  apiKey?: string | null
  imageBase64?: string | null
  onProgress?: (status: string) => void
}

// ============================================================================
// CATEGORY MAPPING - SINGLE SOURCE OF TRUTH
// ============================================================================

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Food & Dining': [
    // Restaurants & Eateries
    'restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'breakfast', 'food', 'eat', 'dine',
    'mcdonald', 'kfc', 'domino', 'pizza', 'burger', 'chicken republic', 'mr biggs',
    'tantalizers', 'kilimanjaro', 'sweet sensation', 'bukka', 'eatery',
    // Nigerian foods
    'suya', 'shawarma', 'chicken', 'rice', 'amala', 'pounded yam', 'jollof',
    // Drinks & Snacks
    'coke', 'water', 'drink', 'snack', 'juice', 'soda', 'fanta', 'sprite', 'beer', 'wine'
  ],
  'Groceries': [
    'grocery', 'groceries', 'supermarket', 'shoprite', 'spar', 'market',
    'foodco', 'justrite', 'hubmart', 'next cash', 'provision', 'foodstuff',
    'walmart', 'tesco', 'aldi', 'costco',
    // Common grocery items
    'bread', 'apple', 'fruit', 'vegetable', 'sardine', 'fish', 'meat', 'egg',
    'rice', 'beans', 'garri', 'yam', 'tomato', 'pepper', 'onion', 'oil', 'milk'
  ],
  'Transportation': [
    'uber', 'bolt', 'taxi', 'cab', 'bus', 'brt', 'transport', 'fare', 'ride', 'trip',
    'gokada', 'opay ride', 'lyft', 'grab',
    // Fuel
    'fuel', 'petrol', 'gas', 'diesel', 'filling', 'nnpc', 'mobil', 'total', 'oando', 'conoil',
    // Other transport
    'toll', 'parking', 'metro', 'train', 'flight ticket'
  ],
  'Bills & Utilities': [
    'light', 'electric', 'power', 'nepa', 'phcn', 'ikedc', 'ekedc', 'aedc',
    'water bill', 'internet', 'wifi', 'broadband',
    'dstv', 'gotv', 'cable', 'netflix', 'spotify', 'amazon prime', 'showmax', 'startimes',
    'utility', 'waste', 'sewage'
  ],
  'Airtime & Data': [
    'airtime', 'recharge', 'data', 'mtn', 'glo', 'airtel', '9mobile', 'etisalat',
    'vtu', 'topup', 'mobile data', 'data bundle'
  ],
  'Shopping': [
    'shop', 'shopping', 'store', 'mall', 'amazon', 'jumia', 'konga', 'alibaba', 'ebay',
    'clothing', 'fashion', 'clothes', 'shoes', 'bag', 'watch',
    'nike', 'adidas', 'zara', 'h&m',
    'slot', 'pointek', 'phone', 'laptop', 'computer', 'electronics', 'gadget'
  ],
  'Healthcare': [
    'hospital', 'clinic', 'pharmacy', 'drug', 'medicine', 'doctor', 'medical',
    'health', 'dental', 'dentist', 'lab', 'test', 'medplus', 'healthplus',
    'prescription', 'therapy', 'treatment'
  ],
  'Bank Charges': [
    'charge', 'fee', 'commission', 'vat', 'stamp duty', 'sms alert',
    'maintenance', 'atm', 'transfer fee', 'bank charge', 'account maintenance'
  ],
  'Entertainment': [
    'cinema', 'movie', 'film', 'game', 'gaming', 'concert', 'show', 'ticket',
    'club', 'bar', 'lounge', 'filmhouse', 'genesis', 'silverbird',
    'betting', 'bet9ja', 'sportybet', 'nairabet'
  ],
  'Education': [
    'school', 'tuition', 'book', 'course', 'training', 'exam', 'waec', 'jamb',
    'university', 'college', 'lesson', 'tutorial', 'udemy', 'coursera', 'fee'
  ],
  'Travel': [
    'hotel', 'flight', 'airline', 'airbnb', 'booking', 'travel', 'trip', 'vacation',
    'arik', 'air peace', 'dana', 'ibom air', 'emirates', 'british airways'
  ],
  'Gift': [
    'gift', 'present', 'birthday', 'wedding', 'celebration', 'party', 'donation'
  ],
  'House Repairs': [
    'plumb', 'plumber', 'plumbing', 'electrician', 'repair', 'fix',
    'maintenance', 'carpenter', 'paint', 'renovation', 'artisan'
  ],
  'Housing': [
    'rent', 'apartment', 'house', 'accommodation', 'caution fee', 'mortgage', 'lease'
  ],
  'Car Repairs': [
    'mechanic', 'car repair', 'auto', 'garage', 'tire', 'tyre', 'panel beater',
    'car wash', 'service', 'oil change', 'spare parts'
  ],
  'Contribution': [
    'contribution', 'ajo', 'esusu', 'cooperative', 'thrift', 'donation', 'tithe', 'offering'
  ],
  'Recharge Card': [
    'recharge card', 'scratch card'
  ]
}

// Income category keywords
const INCOME_KEYWORDS: Record<string, string[]> = {
  'Salary': ['salary', 'wage', 'payroll', 'monthly pay', 'payment'],
  'Freelance': ['freelance', 'contract', 'gig', 'project payment', 'consulting'],
  'Investment': ['dividend', 'interest', 'investment return', 'capital gain', 'roi'],
  'Business': ['business', 'sales', 'revenue', 'profit', 'income'],
  'Gift': ['gift', 'received', 'cash gift', 'birthday money'],
  'Transfer In': ['transfer', 'inflow', 'credit', 'received from']
}

// ============================================================================
// AMOUNT PARSING - HANDLES ALL FORMATS
// ============================================================================

/**
 * Parse amount from text - handles Nigerian notation (60k, 1.5m) and standard formats
 */
export function parseAmount(text: string): number | null {
  if (!text) return null

  // Remove currency symbols and clean up
  let cleaned = text.replace(/[₦NGN$£€\s]/gi, '').trim()

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

  // Handle "b" notation (1b = 1,000,000,000)
  const bMatch = cleaned.match(/^([\d,.]+)\s*b$/i)
  if (bMatch) {
    const num = parseFloat(bMatch[1].replace(/,/g, ''))
    return isNaN(num) ? null : num * 1000000000
  }

  // Standard number with commas
  cleaned = cleaned.replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) || num <= 0 ? null : num
}

/**
 * Extract amount from longer text (bank SMS, receipts)
 */
export function extractAmount(text: string): number | null {
  // Nigerian bank patterns (prioritize these)
  const nigerianPatterns = [
    /(?:NGN|₦|N)\s*([\d,]+\.?\d*)/i,
    /(?:Amt|Amount)[:\s]*(?:NGN|N|₦)?\s*([\d,]+\.?\d*)/i,
    /(?:NGN|N|₦)\s*([\d,]+\.?\d*)\s*(?:was|has been)/i,
    /(?:debit|credit|dr|cr)[:\s]*(?:NGN|N|₦)?\s*([\d,]+\.?\d*)/i,
    /(?:Txn|Transaction)[:\s]*(?:NGN|N|₦)?\s*([\d,]+\.?\d*)/i,
  ]

  for (const pattern of nigerianPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const amount = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(amount) && amount > 0) {
        return amount
      }
    }
  }

  // International patterns
  const intlPatterns = [
    /(?:USD|\$|£|€)\s*([\d,]+\.?\d*)/i,
    /([\d,]+\.?\d*)\s*(?:USD|dollars?|naira|pounds?|euros?)/i,
    /(?:amount|total|sum|paid|spent|cost|price)[:\s]*(?:is\s+)?(?:NGN|USD|\$|£|€|₦)?\s*([\d,]+\.?\d*)/i,
    /(?:total|subtotal|grand\s*total)[:\s]*(?:NGN|USD|\$|£|€|₦)?\s*([\d,]+\.?\d*)/i,
  ]

  for (const pattern of intlPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const amount = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(amount) && amount > 0 && amount < 100000000) {
        return amount
      }
    }
  }

  return null
}

// ============================================================================
// DATE PARSING - HANDLES ALL FORMATS
// ============================================================================

/**
 * Parse date from text - handles multiple formats
 */
export function parseDate(text: string): string {
  const today = new Date().toISOString().split('T')[0]

  // Relative dates
  const lowerText = text.toLowerCase()
  if (lowerText.includes('yesterday')) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().split('T')[0]
  }
  if (lowerText.includes('last week')) {
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)
    return lastWeek.toISOString().split('T')[0]
  }

  // Date patterns
  const patterns = [
    // ISO format (YYYY-MM-DD)
    /(\d{4}[-/]\d{2}[-/]\d{2})/,
    // DD/MM/YYYY or MM/DD/YYYY
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    // Written format (Jan 15, 2024 or 15th January 2024)
    /(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*,?\s*\d{2,4})/i,
    /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
    // Month Day, Year
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{2,4})/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      try {
        // Try to parse as DD/MM/YYYY (common in Nigeria)
        const dmyMatch = match[1].match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
        if (dmyMatch) {
          const [, d, m, y] = dmyMatch
          const year = y.length === 2 ? '20' + y : y
          const month = m.padStart(2, '0')
          const day = d.padStart(2, '0')

          // Validate reasonable date
          const dateNum = parseInt(day)
          const monthNum = parseInt(month)
          if (dateNum >= 1 && dateNum <= 31 && monthNum >= 1 && monthNum <= 12) {
            return `${year}-${month}-${day}`
          }
        }

        // Try standard Date parsing
        const parsed = new Date(match[1])
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0]
        }
      } catch {
        continue
      }
    }
  }

  return today
}

// ============================================================================
// CATEGORY INFERENCE - SINGLE SOURCE OF TRUTH
// ============================================================================

/**
 * Infer category from text description
 */
export function inferCategory(text: string, type: 'expense' | 'income' = 'expense'): string {
  const lowerText = text.toLowerCase()

  if (type === 'income') {
    for (const [category, keywords] of Object.entries(INCOME_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          return category
        }
      }
    }
    return 'Other'
  }

  // Expense categories
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return category
      }
    }
  }

  return 'Other'
}

/**
 * Validate category against allowed categories
 */
export function validateCategory(category: string, type: 'expense' | 'income'): string {
  const validCategories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

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

// ============================================================================
// TRANSACTION TYPE DETECTION
// ============================================================================

/**
 * Detect if transaction is income or expense
 */
export function detectTransactionType(text: string): 'expense' | 'income' {
  const lowerText = text.toLowerCase()

  // Income indicators
  const incomePatterns = [
    /credit/i, /\bcr\b/i, /received/i, /inflow/i, /deposit/i,
    /salary/i, /payment received/i, /transfer from/i
  ]

  for (const pattern of incomePatterns) {
    if (pattern.test(lowerText)) {
      return 'income'
    }
  }

  // Expense is default
  return 'expense'
}

// ============================================================================
// MERCHANT EXTRACTION
// ============================================================================

/**
 * Extract merchant name from text
 */
export function extractMerchant(text: string): string | null {
  const patterns = [
    /(?:at|from|to|@)\s+([A-Za-z][A-Za-z0-9\s&'.-]{2,30}?)(?:\s+on|\s+for|\s*$|\s*\n)/i,
    /(?:merchant|vendor|store|shop|restaurant)[:\s]+([A-Za-z][A-Za-z0-9\s&'.-]{2,30})/i,
    /(?:paid|payment)\s+(?:to\s+)?([A-Za-z][A-Za-z0-9\s&'.-]{2,30})/i,
    /(?:terminal|pos)[:\s]+([A-Za-z][A-Za-z0-9\s&'.-]+?)(?:\s*\n|$)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const merchant = match[1].trim()
      if (merchant.length >= 2 && merchant.length <= 50) {
        return merchant
      }
    }
  }

  return null
}

// ============================================================================
// BANK-SPECIFIC PARSERS
// ============================================================================

/**
 * Parse OPay receipt format
 */
function parseOPayReceipt(text: string): ParsedTransaction | null {
  const lowerText = text.toLowerCase()
  if (!lowerText.includes('opay') && !lowerText.includes("o'pay")) {
    return null
  }

  const amount = extractAmount(text)
  if (!amount) return null

  const merchant = extractMerchant(text) || 'OPay Payment'
  const date = parseDate(text)

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

/**
 * Parse Moniepoint receipt format
 */
function parseMoniepointReceipt(text: string): ParsedTransaction | null {
  const lowerText = text.toLowerCase()
  if (!lowerText.includes('moniepoint')) {
    return null
  }

  const amount = extractAmount(text)
  if (!amount) return null

  const merchant = extractMerchant(text) || 'Moniepoint POS'
  const date = parseDate(text)

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

/**
 * Parse GTBank receipt/SMS format
 */
function parseGTBankReceipt(text: string): ParsedTransaction | null {
  const lowerText = text.toLowerCase()
  if (!lowerText.includes('gtbank') && !lowerText.includes('guaranty trust') && !lowerText.includes('gtb')) {
    return null
  }

  const amount = extractAmount(text)
  if (!amount) return null

  const type = detectTransactionType(text)
  const date = parseDate(text)

  // Extract description/narration
  const descMatch = text.match(/(?:narration|description|remark|for)[:\s]+(.+?)(?:\n|$)/i)
  const description = descMatch ? descMatch[1].trim() : 'GTBank Transaction'

  return {
    amount,
    description,
    category: type === 'income' ? 'Transfer In' : inferCategory(description),
    date,
    confidence: 85,
    type,
    rawText: text
  }
}

/**
 * Parse generic bank SMS notification
 */
function parseBankSMS(text: string): ParsedTransaction | null {
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

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      amount = parseFloat(match[1].replace(/,/g, ''))
      break
    }
  }

  if (!amount) return null

  const type = detectTransactionType(text)
  const date = parseDate(text)

  // Extract description
  const descPatterns = [
    /(?:desc|narration|remark|ref)[:\s]+(.+?)(?:\n|$)/i,
    /(?:at|to|from)\s+([A-Za-z][A-Za-z0-9\s&'.-]+?)(?:\s+on|\s*\n|$)/i,
  ]

  let description = type === 'income' ? 'Bank Credit' : 'Bank Debit'
  for (const pattern of descPatterns) {
    const match = text.match(pattern)
    if (match) {
      description = match[1].trim()
      break
    }
  }

  return {
    amount,
    description,
    category: type === 'income' ? 'Transfer In' : inferCategory(description),
    date,
    confidence: 80,
    type,
    rawText: text
  }
}

// ============================================================================
// MULTI-ITEM PARSERS
// ============================================================================

/**
 * Parse WhatsApp-style expense lists
 * Examples: "Food 60k, Fuel 40k" or "Food - 60k\nFuel - 30k"
 */
function parseWhatsAppList(text: string): ParsedTransaction[] {
  const items: ParsedTransaction[] = []
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

        const amount = parseAmount(amountStr)
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

/**
 * Parse supermarket multi-item receipt (Foodco, Shoprite, Spar, etc.)
 */
function parseSupermarketReceipt(text: string): ParsedTransaction[] {
  const items: ParsedTransaction[] = []
  const lowerText = text.toLowerCase()

  // Check if it's a supermarket receipt
  const isSupermarket = lowerText.includes('foodco') || lowerText.includes('shoprite') ||
                        lowerText.includes('spar') || lowerText.includes('justrite') ||
                        lowerText.includes('hubmart') || lowerText.includes('receipt') ||
                        (lowerText.includes('item') && lowerText.includes('qty'))

  if (!isSupermarket) return items

  const date = parseDate(text)

  // Extract merchant name
  let merchant = 'Supermarket'
  if (lowerText.includes('foodco')) merchant = 'Foodco'
  else if (lowerText.includes('shoprite')) merchant = 'Shoprite'
  else if (lowerText.includes('spar')) merchant = 'Spar'
  else if (lowerText.includes('justrite')) merchant = 'Justrite'
  else if (lowerText.includes('hubmart')) merchant = 'Hubmart'

  const lines = text.split(/\n/)

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (trimmedLine.length < 3) continue

    // Skip header/footer lines
    if (/^(total|subtotal|sub-total|grand|change|cash|card|vat|discount|item|description|qty|quantity|receipt|invoice|tel|phone|address|thank|welcome|date|time|terminal|pos|ref|transaction)\b/i.test(trimmedLine)) continue
    if (/^[-=_*#]+$/.test(trimmedLine)) continue

    // Multiple patterns for different receipt formats
    const patterns = [
      // "ITEM NAME    1,500.00"
      /^([A-Za-z][A-Za-z0-9\s&'.\/-]+?)\s{2,}([\d,]+\.?\d*)$/,
      // "ITEM NAME ... 1,500.00"
      /^([A-Za-z][A-Za-z0-9\s&'.\/-]+?)\.{2,}\s*([\d,]+\.?\d*)$/,
      // "ITEM NAME 1 @ 500.00 = 500.00"
      /^([A-Za-z][A-Za-z0-9\s&'.\/-]+?)\s+\d+\s*[@x]\s*[\d,.]+\s*=?\s*([\d,]+\.?\d*)$/i,
      // "ITEM NAME    QTY  PRICE"
      /^([A-Za-z][A-Za-z0-9\s&'.\/-]+?)\s+\d+\s+([\d,]+\.?\d*)$/,
      // Simple "ITEM NAME 1500"
      /^([A-Za-z][A-Za-z0-9\s&'.\/-]+?)\s+([\d,]+\.?\d*)$/,
    ]

    for (const pattern of patterns) {
      const match = trimmedLine.match(pattern)
      if (match) {
        let itemName: string
        let amountStr: string

        if (/^[\d,]+\.?\d*$/.test(match[1])) {
          amountStr = match[1]
          itemName = match[2]
        } else {
          itemName = match[1]
          amountStr = match[2]
        }

        const amount = parseAmount(amountStr)
        itemName = itemName.trim().replace(/\s+/g, ' ')

        // Validate
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
          break
        }
      }
    }
  }

  // If no items found but we have a total, create single item
  if (items.length === 0) {
    const totalMatch = text.match(/(?:total|grand total|amount)[:\s]*([\d,]+\.?\d*)/i)
    if (totalMatch) {
      const amount = parseAmount(totalMatch[1])
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

// ============================================================================
// SOURCE TYPE DETECTION
// ============================================================================

/**
 * Detect the type of input text
 */
function detectSourceType(text: string): MultiParseResult['sourceType'] {
  const lowerText = text.toLowerCase()

  // Check for specific receipt formats
  if (lowerText.includes('opay') || lowerText.includes("o'pay")) return 'receipt'
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

// ============================================================================
// MAIN PARSING FUNCTIONS
// ============================================================================

/**
 * Parse multiple expenses from text (main entry point)
 */
export function parseMultipleTransactions(text: string): MultiParseResult {
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
  let items: ParsedTransaction[] = []

  switch (sourceType) {
    case 'whatsapp_list':
      items = parseWhatsAppList(trimmedText)
      break

    case 'multi_item_receipt':
      items = parseSupermarketReceipt(trimmedText)
      break

    case 'receipt': {
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
      const allResults: ParsedTransaction[] = []

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

      const supermarketItems = parseSupermarketReceipt(trimmedText)
      allResults.push(...supermarketItems)

      // Use highest confidence results
      if (allResults.length > 0) {
        items = allResults.sort((a, b) => b.confidence - a.confidence)
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

/**
 * Parse single transaction (quick parse for simple inputs like "uber 50")
 */
export function parseQuickTransaction(text: string): ParsedTransaction | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const parts = trimmed.split(/\s+/)
  let amount: number | null = null
  let description = ''

  for (const part of parts) {
    const parsed = parseAmount(part)
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

/**
 * Parse with AI enhancement (fallback to rule-based if AI fails)
 */
export async function parseWithAI(
  text: string,
  options: ParseOptions = {}
): Promise<MultiParseResult> {
  const { apiKey, imageBase64, onProgress } = options

  // First try rule-based parsing
  onProgress?.('Analyzing text...')
  const ruleBasedResult = parseMultipleTransactions(text)

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

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

// These maintain compatibility with existing code that imports from old parsers

export type ParsedExpenseItem = ParsedTransaction

export { parseMultipleTransactions as parseMultipleExpenses }
export { parseQuickTransaction as parseQuickExpense }
export { parseWithAI as parseWithAIFallback }

// Legacy interface for expenseParser.ts compatibility
export interface ParsedExpense {
  amount: number | null
  merchant: string | null
  category: string | null
  date: string | null
  description: string | null
  confidence: number
  rawText: string
}

export function parseExpenseText(text: string): ParsedExpense {
  const amount = extractAmount(text)
  const merchant = extractMerchant(text)
  const date = parseDate(text)
  const category = amount ? inferCategory(text) : null

  let confidence = 0
  if (amount !== null) confidence += 40
  if (merchant !== null) confidence += 25
  if (date !== null) confidence += 15
  if (category !== null) confidence += 20

  return {
    amount,
    merchant,
    category,
    date,
    description: merchant || text.slice(0, 100),
    confidence,
    rawText: text
  }
}

export function parseVoiceInput(text: string): ParsedExpense {
  const lowerText = text.toLowerCase()

  // Enhanced amount extraction for voice
  let amount: number | null = null
  const voiceAmountPatterns = [
    /(\d+(?:\.\d{2})?)\s*(?:dollars?|naira|pounds?|euros?|bucks?)/i,
    /(?:spent|paid|cost)\s*(\d+(?:\.\d{2})?)/i,
    /(\d+(?:\.\d{2})?)\s*(?:at|for|on)/i,
  ]

  for (const pattern of voiceAmountPatterns) {
    const match = lowerText.match(pattern)
    if (match && match[1]) {
      amount = parseFloat(match[1])
      break
    }
  }

  if (amount === null) {
    amount = extractAmount(text)
  }

  const date = parseDate(text)
  const merchant = extractMerchant(text)
  const category = inferCategory(text)

  let confidence = 15 // Voice input bonus
  if (amount !== null) confidence += 40
  if (merchant !== null) confidence += 25
  if (category !== 'Other') confidence += 20

  return {
    amount,
    merchant,
    category,
    date,
    description: merchant || text.slice(0, 100),
    confidence,
    rawText: text
  }
}
