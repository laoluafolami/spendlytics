/**
 * World-Class Intelligent Receipt Parser
 *
 * Advanced receipt parsing with Nigerian-specific patterns.
 * Correctly identifies actual transaction amounts while filtering out:
 * - Phone numbers (Nigerian: 0XXXXXXXXXX, +234XXXXXXXXXX)
 * - Invoice numbers, transaction IDs, session IDs
 * - Reference numbers, account numbers
 * - Dates that look like numbers
 *
 * Uses contextual analysis to find the real transaction amount.
 */

export interface ReceiptParseResult {
  amount: number | null
  merchant: string | null
  date: string | null
  category: string | null
  description: string | null
  confidence: number
  transactionType: 'expense' | 'income' | null
  rawText: string
  allAmounts: ParsedAmount[] // All detected amounts for debugging/manual selection
}

export interface ParsedAmount {
  value: number
  context: string // Surrounding text
  confidence: number
  type: 'total' | 'subtotal' | 'item' | 'fee' | 'unknown'
  line: string
}

// ============================================================================
// FILTERS - What to EXCLUDE
// ============================================================================

/**
 * Nigerian phone number patterns - MUST be excluded
 */
const PHONE_NUMBER_PATTERNS = [
  // Nigerian mobile (0XXXXXXXXXX - 11 digits starting with 0)
  /\b0[789][01]\d{8}\b/,
  // Nigerian mobile with country code (+234XXXXXXXXXX)
  /\+234[789][01]\d{8}\b/,
  // Nigerian mobile with country code (234XXXXXXXXXX - no plus)
  /\b234[789][01]\d{8}\b/,
  // General phone with tel: prefix
  /tel[:\s]*[+]?\d{10,14}/i,
  // Phone with parentheses like (0915) 949-0428
  /\(\d{4}\)\s*\d{3}[-\s]?\d{4}/,
  // International format variations
  /\+\d{1,3}[-\s]?\d{3,4}[-\s]?\d{3,4}[-\s]?\d{3,4}/,
]

/**
 * Transaction/Reference ID patterns - MUST be excluded
 */
const REFERENCE_PATTERNS = [
  // Transaction ID (alphanumeric, often 16+ chars)
  /(?:trans(?:action)?[\s_-]?(?:id|ref)?|txn[\s_-]?(?:id|ref)?|ref(?:erence)?(?:[\s_-]?(?:no|number|id))?)[:\s]*([A-Z0-9]{8,})/i,
  // Session ID
  /session[\s_-]?id[:\s]*([A-Z0-9]{8,})/i,
  // Order ID
  /order[\s_-]?(?:id|no|number)?[:\s]*([A-Z0-9]{6,})/i,
  // Invoice number
  /invoice[\s_-]?(?:no|number)?[:\s]*([A-Z0-9]{4,})/i,
  // Receipt number
  /receipt[\s_-]?(?:no|number)?[:\s]*([A-Z0-9]{4,})/i,
  // Terminal ID
  /terminal[\s_-]?(?:id)?[:\s]*([A-Z0-9]{4,})/i,
  // Approval code
  /approval[\s_-]?(?:code)?[:\s]*([A-Z0-9]{4,})/i,
  // RRN (Retrieval Reference Number)
  /rrn[:\s]*([A-Z0-9]{8,})/i,
  // STAN (System Trace Audit Number)
  /stan[:\s]*([0-9]{6,})/i,
]

/**
 * Account number patterns - MUST be excluded
 */
const ACCOUNT_PATTERNS = [
  // Nigerian bank account (10 digits)
  /(?:acct?(?:ount)?|a\/c)[\s_-]?(?:no|number)?[:\s]*(\d{10})\b/i,
  // Masked account numbers
  /\*{3,}\d{4}/,
  // Account format with X masking
  /[xX]{4,}\d{4}/,
]

// Date-like number patterns are handled directly in context analysis
// to avoid false positives with timestamps vs amounts

// ============================================================================
// AMOUNT CONTEXT - What to INCLUDE (with high confidence)
// ============================================================================

/**
 * Strong amount indicators - these words near a number mean it's likely an amount
 */
const STRONG_AMOUNT_KEYWORDS = [
  // Totals (highest priority)
  { pattern: /(?:grand\s+)?total[:\s]*[₦NGN]?\s*([\d,]+\.?\d*)/i, type: 'total' as const, boost: 50 },
  { pattern: /(?:amount\s+)?(?:due|paid|payable)[:\s]*[₦NGN]?\s*([\d,]+\.?\d*)/i, type: 'total' as const, boost: 45 },
  { pattern: /(?:final|net)\s+(?:amount|total)[:\s]*[₦NGN]?\s*([\d,]+\.?\d*)/i, type: 'total' as const, boost: 48 },

  // Subtotals
  { pattern: /sub[\s-]?total[:\s]*[₦NGN]?\s*([\d,]+\.?\d*)/i, type: 'subtotal' as const, boost: 35 },

  // Transaction amounts
  { pattern: /(?:trans(?:action)?|txn)\s+(?:amount|amt)[:\s]*[₦NGN]?\s*([\d,]+\.?\d*)/i, type: 'total' as const, boost: 45 },
  { pattern: /amount\s+transferred[:\s]*[₦NGN]?\s*([\d,]+\.?\d*)/i, type: 'total' as const, boost: 45 },

  // Currency prefixed (strong indicator)
  { pattern: /[₦]\s*([\d,]+\.?\d*)/g, type: 'unknown' as const, boost: 30 },
  { pattern: /NGN\s*([\d,]+\.?\d*)/gi, type: 'unknown' as const, boost: 30 },

  // Bank debit/credit
  { pattern: /(?:debit(?:ed)?|dr)[:\s]*[₦NGN]?\s*([\d,]+\.?\d*)/i, type: 'total' as const, boost: 40 },
  { pattern: /(?:credit(?:ed)?|cr)[:\s]*[₦NGN]?\s*([\d,]+\.?\d*)/i, type: 'total' as const, boost: 40 },

  // Cost/Price indicators
  { pattern: /(?:cost|price|charge|fee)[:\s]*[₦NGN]?\s*([\d,]+\.?\d*)/i, type: 'item' as const, boost: 25 },
]

/**
 * Weak/negative amount indicators - these contexts suggest NOT an amount
 */
const NEGATIVE_CONTEXT_KEYWORDS = [
  'phone', 'tel', 'telephone', 'mobile', 'cell',
  'account', 'acct', 'a/c',
  'reference', 'ref', 'transaction id', 'txn id', 'order id',
  'session', 'terminal', 'approval', 'rrn', 'stan',
  'invoice no', 'receipt no', 'ticket',
  'quantity', 'qty', 'count', 'units',
  'balance', // Balance after transaction, not the amount
]

// ============================================================================
// MERCHANT EXTRACTION
// ============================================================================

/**
 * Known Nigerian merchants and payment providers
 */
const KNOWN_MERCHANTS: Record<string, { name: string; category: string }> = {
  'opay': { name: 'OPay', category: 'Transfer' },
  'palmpay': { name: 'PalmPay', category: 'Transfer' },
  'moniepoint': { name: 'Moniepoint', category: 'Transfer' },
  'kuda': { name: 'Kuda Bank', category: 'Transfer' },
  'gtbank': { name: 'GTBank', category: 'Bank Charges' },
  'gtb': { name: 'GTBank', category: 'Bank Charges' },
  'guaranty trust': { name: 'GTBank', category: 'Bank Charges' },
  'firstbank': { name: 'First Bank', category: 'Bank Charges' },
  'first bank': { name: 'First Bank', category: 'Bank Charges' },
  'zenith': { name: 'Zenith Bank', category: 'Bank Charges' },
  'uba': { name: 'UBA', category: 'Bank Charges' },
  'access': { name: 'Access Bank', category: 'Bank Charges' },
  'sterling': { name: 'Sterling Bank', category: 'Bank Charges' },
  'fcmb': { name: 'FCMB', category: 'Bank Charges' },
  'fidelity': { name: 'Fidelity Bank', category: 'Bank Charges' },
  'union bank': { name: 'Union Bank', category: 'Bank Charges' },
  'ecobank': { name: 'Ecobank', category: 'Bank Charges' },
  'stanbic': { name: 'Stanbic IBTC', category: 'Bank Charges' },
  'wema': { name: 'Wema Bank', category: 'Bank Charges' },
  'polaris': { name: 'Polaris Bank', category: 'Bank Charges' },

  // Retail
  'shoprite': { name: 'Shoprite', category: 'Groceries' },
  'spar': { name: 'Spar', category: 'Groceries' },
  'foodco': { name: 'Foodco', category: 'Groceries' },
  'justrite': { name: 'Justrite', category: 'Groceries' },
  'hubmart': { name: 'Hubmart', category: 'Groceries' },
  'market square': { name: 'Market Square', category: 'Groceries' },

  // Fuel
  'nnpc': { name: 'NNPC', category: 'Transportation' },
  'total': { name: 'Total', category: 'Transportation' },
  'mobil': { name: 'Mobil', category: 'Transportation' },
  'oando': { name: 'Oando', category: 'Transportation' },
  'conoil': { name: 'Conoil', category: 'Transportation' },

  // Pharmacy
  'pharmacy': { name: 'Pharmacy', category: 'Healthcare' },
  'medplus': { name: 'MedPlus', category: 'Healthcare' },
  'healthplus': { name: 'HealthPlus', category: 'Healthcare' },

  // Restaurants
  'chicken republic': { name: 'Chicken Republic', category: 'Food & Dining' },
  'kilimanjaro': { name: 'Kilimanjaro', category: 'Food & Dining' },
  'tantalizers': { name: 'Tantalizers', category: 'Food & Dining' },
  'sweet sensation': { name: 'Sweet Sensation', category: 'Food & Dining' },
  'mr biggs': { name: 'Mr Biggs', category: 'Food & Dining' },
  'kfc': { name: 'KFC', category: 'Food & Dining' },
  'domino': { name: "Domino's Pizza", category: 'Food & Dining' },
}

// ============================================================================
// MAIN PARSING FUNCTIONS
// ============================================================================

/**
 * Check if a number string looks like a phone number
 */
function isPhoneNumber(numStr: string, context: string): boolean {
  const fullText = context.toLowerCase()

  // Check explicit phone patterns
  for (const pattern of PHONE_NUMBER_PATTERNS) {
    if (pattern.test(numStr) || pattern.test(context)) {
      return true
    }
  }

  // Check if preceded by phone-related keywords
  if (/(?:tel|phone|mobile|cell|call|contact)[:\s]*$/i.test(fullText.split(numStr)[0] || '')) {
    return true
  }

  // Nigerian mobile number heuristics:
  // - 11 digits starting with 0 followed by 7, 8, or 9
  // - No decimal point
  // - No currency symbol nearby
  const cleanNum = numStr.replace(/[,\s]/g, '')
  if (/^0[789][01]\d{8}$/.test(cleanNum)) {
    // It's 11 digits starting with Nigerian mobile prefix
    // Check if there's NO currency symbol nearby (within 20 chars before)
    const beforeNum = context.split(numStr)[0] || ''
    const last20Chars = beforeNum.slice(-20)
    if (!/[₦]|NGN/i.test(last20Chars)) {
      return true // Likely a phone number
    }
  }

  return false
}

/**
 * Check if a number is likely a reference/ID number
 */
function isReferenceNumber(numStr: string, context: string): boolean {
  const fullText = context.toLowerCase()

  // Check explicit reference patterns
  for (const pattern of REFERENCE_PATTERNS) {
    if (pattern.test(context)) {
      return true
    }
  }

  // Check for reference keywords near the number
  const beforeNum = (fullText.split(numStr.toLowerCase())[0] || '').slice(-50)

  for (const keyword of NEGATIVE_CONTEXT_KEYWORDS) {
    if (beforeNum.includes(keyword)) {
      // Check if the keyword is close enough (within last 30 chars)
      const keywordPos = beforeNum.lastIndexOf(keyword)
      if (keywordPos >= beforeNum.length - 30) {
        return true
      }
    }
  }

  return false
}

/**
 * Check if a number is likely an account number
 */
function isAccountNumber(numStr: string, context: string): boolean {
  for (const pattern of ACCOUNT_PATTERNS) {
    if (pattern.test(context)) {
      return true
    }
  }

  // 10-digit number preceded by account-related words
  const cleanNum = numStr.replace(/[,\s]/g, '')
  if (/^\d{10}$/.test(cleanNum)) {
    const beforeNum = (context.toLowerCase().split(numStr.toLowerCase())[0] || '').slice(-30)
    if (/(?:acct?|account|a\/c)/i.test(beforeNum)) {
      return true
    }
  }

  return false
}

/**
 * Extract all potential amounts from text with confidence scoring
 */
function extractAllAmounts(text: string): ParsedAmount[] {
  const amounts: ParsedAmount[] = []
  const lines = text.split('\n')

  // First pass: Look for amounts with strong context keywords
  for (const keyword of STRONG_AMOUNT_KEYWORDS) {
    const matches = text.matchAll(new RegExp(keyword.pattern, 'gi'))
    for (const match of matches) {
      if (match[1]) {
        const value = parseFloat(match[1].replace(/,/g, ''))
        if (!isNaN(value) && value > 0 && value < 100000000) {
          // Get surrounding context
          const matchIndex = match.index || 0
          const contextStart = Math.max(0, matchIndex - 30)
          const contextEnd = Math.min(text.length, matchIndex + match[0].length + 30)
          const context = text.slice(contextStart, contextEnd)

          // Skip if it's actually a phone/reference number
          if (!isPhoneNumber(match[1], context) &&
              !isReferenceNumber(match[1], context) &&
              !isAccountNumber(match[1], context)) {
            amounts.push({
              value,
              context: context.trim(),
              confidence: 50 + keyword.boost,
              type: keyword.type,
              line: match[0]
            })
          }
        }
      }
    }
  }

  // Second pass: Look for standalone currency-prefixed amounts not caught above
  const currencyPattern = /[₦]\s*([\d,]+\.?\d*)|NGN\s*([\d,]+\.?\d*)/gi
  let match
  while ((match = currencyPattern.exec(text)) !== null) {
    const numStr = match[1] || match[2]
    if (numStr) {
      const value = parseFloat(numStr.replace(/,/g, ''))
      if (!isNaN(value) && value > 0 && value < 100000000) {
        const matchIndex = match.index
        const contextStart = Math.max(0, matchIndex - 30)
        const contextEnd = Math.min(text.length, matchIndex + match[0].length + 30)
        const context = text.slice(contextStart, contextEnd)

        // Check if already captured
        const alreadyExists = amounts.some(a => Math.abs(a.value - value) < 0.01)

        if (!alreadyExists &&
            !isPhoneNumber(numStr, context) &&
            !isReferenceNumber(numStr, context) &&
            !isAccountNumber(numStr, context)) {

          // Determine type from context
          let type: ParsedAmount['type'] = 'unknown'
          const lowerContext = context.toLowerCase()
          if (/total/i.test(lowerContext)) type = 'total'
          else if (/sub[\s-]?total/i.test(lowerContext)) type = 'subtotal'
          else if (/fee|charge|vat/i.test(lowerContext)) type = 'fee'

          amounts.push({
            value,
            context: context.trim(),
            confidence: type === 'total' ? 70 : type === 'subtotal' ? 60 : 40,
            type,
            line: match[0]
          })
        }
      }
    }
  }

  // Third pass: Look for amounts on lines by themselves (common in receipts)
  for (const line of lines) {
    const trimmedLine = line.trim()

    // Skip very short or very long lines
    if (trimmedLine.length < 3 || trimmedLine.length > 100) continue

    // Skip lines that are clearly headers/labels
    if (/^(tel|phone|ref|transaction|session|account|receipt|invoice|terminal|date|time)/i.test(trimmedLine)) continue

    // Look for number at end of line (common receipt format: "ITEM NAME    1,500.00")
    const lineEndMatch = trimmedLine.match(/^(.+?)\s+([\d,]+\.?\d*)$/)
    if (lineEndMatch) {
      const description = lineEndMatch[1].trim()
      const numStr = lineEndMatch[2]
      const value = parseFloat(numStr.replace(/,/g, ''))

      if (!isNaN(value) && value >= 10 && value < 100000000) {
        // Check if not already captured
        const alreadyExists = amounts.some(a => Math.abs(a.value - value) < 0.01)

        if (!alreadyExists &&
            !isPhoneNumber(numStr, trimmedLine) &&
            !isReferenceNumber(numStr, trimmedLine) &&
            !isAccountNumber(numStr, trimmedLine)) {

          // Check description for clues
          const lowerDesc = description.toLowerCase()
          let type: ParsedAmount['type'] = 'item'
          let confidence = 35

          if (/total/i.test(lowerDesc)) {
            type = 'total'
            confidence = 65
          } else if (/sub[\s-]?total/i.test(lowerDesc)) {
            type = 'subtotal'
            confidence = 55
          } else if (/fee|charge|vat|tax/i.test(lowerDesc)) {
            type = 'fee'
            confidence = 40
          }

          amounts.push({
            value,
            context: trimmedLine,
            confidence,
            type,
            line: trimmedLine
          })
        }
      }
    }
  }

  // Sort by confidence (highest first), then by type priority
  const typePriority = { total: 0, subtotal: 1, item: 2, fee: 3, unknown: 4 }
  amounts.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return typePriority[a.type] - typePriority[b.type]
  })

  return amounts
}

/**
 * Extract merchant name from receipt
 */
function extractMerchant(text: string): { name: string; category: string } | null {
  const lowerText = text.toLowerCase()

  // Check for known merchants
  for (const [key, value] of Object.entries(KNOWN_MERCHANTS)) {
    if (lowerText.includes(key)) {
      return value
    }
  }

  // Try to extract from first few lines (usually receipt header)
  const lines = text.split('\n').slice(0, 5)
  for (const line of lines) {
    const trimmed = line.trim()
    // Skip lines that look like addresses, dates, or numbers
    if (trimmed.length < 3 || trimmed.length > 50) continue
    if (/^\d+|date|time|receipt|invoice|tel|phone|address/i.test(trimmed)) continue
    if (/^[-=_*#]+$/.test(trimmed)) continue

    // This might be the merchant name
    if (/^[A-Za-z][A-Za-z\s&'.,-]+$/.test(trimmed)) {
      return { name: trimmed, category: 'Other' }
    }
  }

  return null
}

/**
 * Extract date from receipt
 */
function extractDate(text: string): string | null {
  const patterns = [
    // DD/MM/YYYY or DD-MM-YYYY (Nigerian format)
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    // YYYY-MM-DD (ISO)
    /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
    // Written format
    /(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*,?\s*(\d{2,4})/i,
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{2,4})/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      try {
        // Try to parse and normalize
        const dateStr = match[0]

        // Check for DD/MM/YYYY format
        const dmyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
        if (dmyMatch) {
          const [, d, m, y] = dmyMatch
          const year = y.length === 2 ? '20' + y : y
          const month = m.padStart(2, '0')
          const day = d.padStart(2, '0')

          // Validate
          const dayNum = parseInt(day)
          const monthNum = parseInt(month)
          if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
            return `${year}-${month}-${day}`
          }
        }

        // Try standard Date parsing for other formats
        const parsed = new Date(dateStr)
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0]
        }
      } catch {
        continue
      }
    }
  }

  return null
}

/**
 * Detect if transaction is income or expense
 */
function detectTransactionType(text: string): 'expense' | 'income' | null {
  const lowerText = text.toLowerCase()

  // Income indicators
  const incomePatterns = [
    /\bcredit(?:ed)?\b/i,
    /\bcr\b/i,
    /\breceived\b/i,
    /\binflow\b/i,
    /\bdeposit(?:ed)?\b/i,
    /\bpayment\s+received\b/i,
    /\btransfer\s+from\b/i,
    /\brefund(?:ed)?\b/i,
  ]

  // Expense indicators
  const expensePatterns = [
    /\bdebit(?:ed)?\b/i,
    /\bdr\b/i,
    /\bpaid\b/i,
    /\bspent\b/i,
    /\bpurchase\b/i,
    /\bbought\b/i,
    /\btransfer\s+to\b/i,
    /\bwithdraw(?:al|n)?\b/i,
  ]

  for (const pattern of incomePatterns) {
    if (pattern.test(lowerText)) return 'income'
  }

  for (const pattern of expensePatterns) {
    if (pattern.test(lowerText)) return 'expense'
  }

  return null // Unknown - let user decide
}

/**
 * Main receipt parsing function
 */
export function parseReceipt(text: string): ReceiptParseResult {
  if (!text || text.trim().length < 10) {
    return {
      amount: null,
      merchant: null,
      date: null,
      category: null,
      description: null,
      confidence: 0,
      transactionType: null,
      rawText: text,
      allAmounts: []
    }
  }

  // Extract all potential amounts
  const allAmounts = extractAllAmounts(text)

  // Get the best amount (highest confidence, prefer 'total' type)
  const bestAmount = allAmounts.find(a => a.type === 'total') || allAmounts[0] || null

  // Extract merchant
  const merchantInfo = extractMerchant(text)

  // Extract date
  const date = extractDate(text) || new Date().toISOString().split('T')[0]

  // Detect transaction type
  const transactionType = detectTransactionType(text) || 'expense'

  // Build description
  let description = merchantInfo?.name || 'Receipt'
  if (bestAmount?.type === 'total') {
    description += ' Purchase'
  }

  return {
    amount: bestAmount?.value || null,
    merchant: merchantInfo?.name || null,
    date,
    category: merchantInfo?.category || 'Other',
    description,
    confidence: bestAmount?.confidence || 0,
    transactionType,
    rawText: text,
    allAmounts
  }
}

/**
 * Parse receipt with detailed logging (for debugging)
 */
export function parseReceiptVerbose(text: string): {
  result: ReceiptParseResult
  debug: {
    filteredPhoneNumbers: string[]
    filteredReferences: string[]
    filteredAccounts: string[]
    rawNumbers: string[]
  }
} {
  const result = parseReceipt(text)

  // Find all numbers in text for debugging
  const allNumbers = text.match(/[\d,]+\.?\d*/g) || []

  const filteredPhoneNumbers = allNumbers.filter(n => isPhoneNumber(n, text))
  const filteredReferences = allNumbers.filter(n => isReferenceNumber(n, text))
  const filteredAccounts = allNumbers.filter(n => isAccountNumber(n, text))

  return {
    result,
    debug: {
      filteredPhoneNumbers,
      filteredReferences,
      filteredAccounts,
      rawNumbers: allNumbers
    }
  }
}

// Export utilities for use in transactionParser
export {
  isPhoneNumber,
  isReferenceNumber,
  isAccountNumber,
  extractAllAmounts,
  extractMerchant as extractReceiptMerchant,
  extractDate as extractReceiptDate,
  detectTransactionType as detectReceiptTransactionType,
  KNOWN_MERCHANTS
}
