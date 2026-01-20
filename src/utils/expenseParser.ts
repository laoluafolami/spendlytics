export interface ParsedExpense {
  amount: number | null
  merchant: string | null
  category: string | null
  date: string | null
  description: string | null
  confidence: number
  rawText: string
}

// Nigerian bank SMS patterns
const NIGERIAN_BANK_PATTERNS = [
  // GTBank
  /(?:Amt|Amount)[:\s]*(?:NGN|N|₦)?\s*([\d,]+\.?\d*)/i,
  // Access Bank
  /(?:NGN|N|₦)\s*([\d,]+\.?\d*)\s*(?:was|has been)\s*(?:debited|credited)/i,
  // First Bank
  /(?:Txn|Transaction)[:\s]*(?:NGN|N|₦)?\s*([\d,]+\.?\d*)/i,
  // UBA
  /(?:DR|CR)[:\s]*(?:NGN|N|₦)?\s*([\d,]+\.?\d*)/i,
  // Zenith Bank
  /(?:NGN|N|₦)\s*([\d,]+\.?\d*)\s*(?:DR|CR)/i,
  // Generic debit/credit
  /(?:debit|credit|transfer|payment|spent|paid)[:\s]*(?:of\s+)?(?:NGN|N|₦|USD|\$|£|€)?\s*([\d,]+\.?\d*)/i,
]

// International amount patterns
const AMOUNT_PATTERNS = [
  // Currency symbol before amount
  /(?:USD|\$|£|€|₦|NGN|GBP|EUR)\s*([\d,]+\.?\d*)/i,
  // Amount with currency after
  /([\d,]+\.?\d*)\s*(?:USD|NGN|GBP|EUR|dollars?|naira|pounds?|euros?)/i,
  // Generic amount patterns
  /(?:amount|total|sum|paid|spent|cost|price)[:\s]*(?:is\s+)?(?:NGN|USD|\$|£|€|₦)?\s*([\d,]+\.?\d*)/i,
  // Receipt total
  /(?:total|subtotal|grand\s*total)[:\s]*(?:NGN|USD|\$|£|€|₦)?\s*([\d,]+\.?\d*)/i,
  // Standalone large numbers (likely amounts)
  /\b([\d,]+\.?\d{2})\b/,
]

// Date patterns
const DATE_PATTERNS = [
  // ISO format
  /(\d{4}[-/]\d{2}[-/]\d{2})/,
  // US format MM/DD/YYYY
  /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
  // Written format
  /(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*,?\s*\d{2,4})/i,
  // Day Month Year
  /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i,
]

// Merchant/vendor patterns
const MERCHANT_PATTERNS = [
  /(?:at|from|to|@)\s+([A-Za-z][A-Za-z0-9\s&'.-]{2,30}?)(?:\s+on|\s+for|\s*$|\s*\n)/i,
  /(?:merchant|vendor|store|shop|restaurant)[:\s]+([A-Za-z][A-Za-z0-9\s&'.-]{2,30})/i,
  /(?:paid|payment)\s+(?:to\s+)?([A-Za-z][A-Za-z0-9\s&'.-]{2,30})/i,
]

// Category keywords mapping
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Food & Dining': ['restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'breakfast', 'food', 'eat', 'dine', 'mcdonald', 'kfc', 'domino', 'pizza', 'burger', 'chicken republic', 'mr biggs', 'tantalizers'],
  'Groceries': ['grocery', 'supermarket', 'shoprite', 'spar', 'market', 'food stuff', 'provision', 'walmart', 'tesco', 'aldi'],
  'Transportation': ['uber', 'bolt', 'taxi', 'cab', 'bus', 'transport', 'fuel', 'petrol', 'gas', 'diesel', 'filling station', 'mobil', 'total', 'oando', 'conoil', 'lyft', 'grab'],
  'Car Repairs': ['mechanic', 'car repair', 'auto', 'garage', 'tire', 'tyre', 'service', 'oil change'],
  'Shopping': ['shop', 'store', 'mall', 'amazon', 'jumia', 'konga', 'alibaba', 'ebay', 'clothing', 'fashion', 'nike', 'adidas'],
  'Entertainment': ['cinema', 'movie', 'netflix', 'spotify', 'game', 'concert', 'show', 'club', 'bar', 'filmhouse', 'genesis'],
  'Bills & Utilities': ['electric', 'water', 'internet', 'wifi', 'dstv', 'gotv', 'cable', 'utility', 'bill', 'nepa', 'phcn', 'ikedc', 'ekedc'],
  'Healthcare': ['hospital', 'pharmacy', 'drug', 'medicine', 'doctor', 'clinic', 'medical', 'health', 'dental'],
  'Education': ['school', 'tuition', 'book', 'course', 'training', 'udemy', 'coursera', 'fee'],
  'Travel': ['hotel', 'flight', 'airline', 'airbnb', 'booking', 'travel', 'trip', 'vacation', 'arik', 'air peace', 'dana'],
  'Housing': ['rent', 'mortgage', 'apartment', 'house', 'accommodation', 'caution'],
  'House Repairs': ['plumber', 'electrician', 'repair', 'maintenance', 'renovation', 'fix'],
  'Recharge Card': ['recharge', 'airtime', 'data', 'mtn', 'glo', 'airtel', '9mobile', 'etisalat'],
  'Gift': ['gift', 'present', 'birthday', 'wedding', 'donation'],
  'Contribution': ['contribution', 'ajo', 'esusu', 'cooperative', 'thrift'],
}

export function parseAmount(text: string): number | null {
  // Try Nigerian bank patterns first
  for (const pattern of NIGERIAN_BANK_PATTERNS) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const amount = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(amount) && amount > 0) {
        return amount
      }
    }
  }

  // Try international patterns
  for (const pattern of AMOUNT_PATTERNS) {
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

export function parseDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern)
    if (match && match[1]) {
      try {
        const parsed = new Date(match[1])
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0]
        }
      } catch {
        continue
      }
    }
  }

  // Default to today if no date found
  return new Date().toISOString().split('T')[0]
}

export function parseMerchant(text: string): string | null {
  for (const pattern of MERCHANT_PATTERNS) {
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

export function inferCategory(text: string): string | null {
  const lowerText = text.toLowerCase()

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return category
      }
    }
  }

  return null
}

export function parseExpenseText(text: string): ParsedExpense {
  const amount = parseAmount(text)
  const merchant = parseMerchant(text)
  const date = parseDate(text)
  const category = inferCategory(text)

  // Calculate confidence based on what we found
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

// Parse voice input like "spent 50 dollars at starbucks yesterday"
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

  // If no amount found, try generic parsing
  if (amount === null) {
    amount = parseAmount(text)
  }

  // Parse relative dates from voice
  let date = new Date().toISOString().split('T')[0]
  if (lowerText.includes('yesterday')) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    date = yesterday.toISOString().split('T')[0]
  } else if (lowerText.includes('last week')) {
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)
    date = lastWeek.toISOString().split('T')[0]
  }

  const merchant = parseMerchant(text)
  const category = inferCategory(text)

  let confidence = 0
  if (amount !== null) confidence += 40
  if (merchant !== null) confidence += 25
  if (category !== null) confidence += 20
  confidence += 15 // Voice input bonus

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

// Quick parse for simple inputs like "uber 12.50" or "lunch 25"
export function parseQuickInput(text: string): ParsedExpense {
  const parts = text.trim().split(/\s+/)

  let amount: number | null = null
  let description = ''

  for (const part of parts) {
    const num = parseFloat(part.replace(/,/g, ''))
    if (!isNaN(num) && num > 0) {
      amount = num
    } else {
      description += (description ? ' ' : '') + part
    }
  }

  const category = inferCategory(description || text)

  let confidence = 0
  if (amount !== null) confidence += 50
  if (description) confidence += 30
  if (category !== null) confidence += 20

  return {
    amount,
    merchant: description || null,
    category,
    date: new Date().toISOString().split('T')[0],
    description: description || null,
    confidence,
    rawText: text
  }
}
