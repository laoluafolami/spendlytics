import * as pdfjsLib from 'pdfjs-dist'

// Set worker source for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

export interface ParsedTransaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
  confidence: number
  rawText: string
}

export interface BankStatementResult {
  transactions: ParsedTransaction[]
  bankName: string | null
  accountNumber: string | null
  period: string | null
  success: boolean
  error?: string
  rawText?: string // For debugging
}

// Category keywords for auto-categorization
const EXPENSE_CATEGORIES: Record<string, string[]> = {
  'Food & Dining': [
    'restaurant', 'cafe', 'coffee', 'mcdonald', 'kfc', 'domino', 'pizza', 'burger',
    'chicken republic', 'mr biggs', 'tantalizers', 'kilimanjaro', 'sweet sensation',
    'food', 'eatery', 'dine', 'lunch', 'dinner', 'breakfast', 'suya', 'shawarma',
    'starbucks', 'subway', 'wendys', 'popeyes', 'nandos', 'bukka', 'amala'
  ],
  'Groceries': [
    'shoprite', 'spar', 'market', 'grocery', 'supermarket', 'provision', 'foodstuff',
    'walmart', 'tesco', 'aldi', 'costco', 'justrite', 'hubmart', 'next cash', 'foodco'
  ],
  'Transportation': [
    'uber', 'bolt', 'taxi', 'cab', 'bus', 'transport', 'brt', 'cowry',
    'fuel', 'petrol', 'gas', 'diesel', 'filling', 'mobil', 'total', 'oando', 'conoil',
    'lyft', 'grab', 'gokada', 'opay ride', 'max ng', 'toll', 'lcc', 'parking', 'nnpc'
  ],
  'Bills & Utilities': [
    'electric', 'power', 'water', 'internet', 'wifi', 'dstv', 'gotv', 'cable', 'utility',
    'nepa', 'phcn', 'ikedc', 'ekedc', 'aedc', 'spectranet', 'smile', 'ntel',
    'netflix', 'spotify', 'amazon prime', 'showmax', 'startimes'
  ],
  'Airtime & Data': [
    'airtime', 'recharge', 'data', 'vtu', 'topup', 'mtn', 'glo', 'airtel', '9mobile', 'etisalat'
  ],
  'Shopping': [
    'shop', 'store', 'mall', 'amazon', 'jumia', 'konga', 'alibaba', 'ebay',
    'clothing', 'fashion', 'nike', 'adidas', 'zara', 'h&m', 'primark',
    'slot', 'pointek', 'computer village', 'ikeja city mall', 'palms'
  ],
  'Healthcare': [
    'hospital', 'pharmacy', 'drug', 'medicine', 'doctor', 'clinic', 'medical', 'health',
    'dental', 'lab', 'diagnostic', 'medplus', 'healthplus', 'reddington'
  ],
  'Bank Charges': [
    'charge', 'fee', 'commission', 'vat', 'stamp duty', 'sms alert', 'maintenance',
    'card maintenance', 'atm', 'transfer fee', 'bank charge', 'e-levy', 'cot',
    'sms notification', 'account maintenance', 'electronic'
  ],
  'Entertainment': [
    'cinema', 'movie', 'game', 'concert', 'show', 'club', 'bar', 'lounge',
    'filmhouse', 'genesis', 'silverbird', 'ozone', 'playstation', 'xbox', 'steam'
  ],
  'Betting & Gambling': [
    'bet', 'betting', 'sporty', 'bet9ja', 'betking', 'nairabet', '1xbet', 'betway', 'merrybet'
  ],
  'Education': [
    'school', 'tuition', 'book', 'course', 'training', 'udemy', 'coursera', 'fee',
    'university', 'college', 'academy', 'institute', 'exam', 'waec', 'jamb'
  ],
  'Travel': [
    'hotel', 'flight', 'airline', 'airbnb', 'booking', 'travel', 'trip', 'vacation',
    'arik', 'air peace', 'dana', 'ibom', 'azman', 'united', 'emirates'
  ]
}

const INCOME_KEYWORDS = [
  'salary', 'wage', 'payroll', 'credit', 'deposit', 'transfer from', 'trf frm',
  'inflow', 'received', 'refund', 'reversal', 'cashback', 'dividend', 'interest',
  'commission earned', 'payment received', 'cr'
]

function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

function categorizeTransaction(description: string, type: 'income' | 'expense'): { category: string; confidence: number } {
  const lowerDesc = description.toLowerCase()

  if (type === 'income') {
    if (lowerDesc.includes('salary') || lowerDesc.includes('payroll')) {
      return { category: 'Salary', confidence: 90 }
    }
    if (lowerDesc.includes('refund') || lowerDesc.includes('reversal')) {
      return { category: 'Refund', confidence: 85 }
    }
    if (lowerDesc.includes('interest') || lowerDesc.includes('dividend')) {
      return { category: 'Investment', confidence: 85 }
    }
    return { category: 'Transfer In', confidence: 60 }
  }

  // Check expense categories
  for (const [category, keywords] of Object.entries(EXPENSE_CATEGORIES)) {
    for (const keyword of keywords) {
      if (lowerDesc.includes(keyword.toLowerCase())) {
        return { category, confidence: 85 }
      }
    }
  }

  // Default based on common patterns
  if (lowerDesc.includes('pos') || lowerDesc.includes('purchase')) {
    return { category: 'Shopping', confidence: 60 }
  }
  if (lowerDesc.includes('transfer') || lowerDesc.includes('trf') || lowerDesc.includes('nip')) {
    return { category: 'Transfer Out', confidence: 60 }
  }
  if (lowerDesc.includes('withdraw') || lowerDesc.includes('atm')) {
    return { category: 'Cash Withdrawal', confidence: 70 }
  }

  return { category: 'Other', confidence: 40 }
}

function isIncomeTransaction(text: string): boolean {
  const lowerText = text.toLowerCase()

  // Check for credit indicators
  if (lowerText.includes(' cr') || lowerText.includes('credit') || lowerText.includes('deposit')) {
    return true
  }

  // Check for income keywords
  for (const keyword of INCOME_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      return true
    }
  }

  return false
}

function parseNigerianDate(dateStr: string): string | null {
  const months: Record<string, number> = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'sept': 8, 'september': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11
  }

  // Try various date formats
  let day: number | undefined, month: number | undefined, year: number | undefined

  // Format: DD-MM-YY or DD/MM/YY or DD-MM-YYYY or DD/MM/YYYY
  let match = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/)
  if (match) {
    day = parseInt(match[1])
    month = parseInt(match[2]) - 1
    year = parseInt(match[3])
  }

  // Format: DD-MMM-YY or DD-MMM-YYYY or DD/MMM/YY (e.g., 22-Mar-22, 01-Oct-2023)
  if (!day) {
    match = dateStr.match(/^(\d{1,2})[-\/]([A-Za-z]{3,9})[-\/](\d{2,4})$/i)
    if (match) {
      day = parseInt(match[1])
      month = months[match[2].toLowerCase()]
      year = parseInt(match[3])
    }
  }

  // Format: YYYY-MM-DD (ISO format)
  if (!day) {
    match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (match) {
      year = parseInt(match[1])
      month = parseInt(match[2]) - 1
      day = parseInt(match[3])
    }
  }

  // Format: DD MMM YYYY or DD MMM, YYYY (e.g., 22 Mar 2022, 1 October 2023)
  if (!day) {
    match = dateStr.match(/^(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})$/i)
    if (match) {
      day = parseInt(match[1])
      month = months[match[2].toLowerCase()]
      year = parseInt(match[3])
    }
  }

  // Format: MMM DD, YYYY or Month DD, YYYY (e.g., Mar 22, 2022, October 1, 2023)
  if (!day) {
    match = dateStr.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/i)
    if (match) {
      month = months[match[1].toLowerCase()]
      day = parseInt(match[2])
      year = parseInt(match[3])
    }
  }

  // Format: DDMmmYYYY or DDMmmYY (no separator, e.g., 29Nov2023, 14Oct23)
  // Check this BEFORE numeric-only formats to prioritize dates with month names
  if (!day) {
    match = dateStr.match(/^(\d{1,2})([A-Za-z]{3,9})(\d{2,4})$/i)
    if (match) {
      day = parseInt(match[1])
      month = months[match[2].toLowerCase()]
      year = parseInt(match[3])
    }
  }

  // Format: DDMMYY or DDMMYYYY (compact numeric, e.g., 011023 for Oct 1, 2023)
  // Only use this as last resort since it can match reference numbers
  if (!day) {
    match = dateStr.match(/^(\d{2})(\d{2})(\d{2,4})$/)
    if (match) {
      const d = parseInt(match[1])
      const m = parseInt(match[2]) - 1
      const y = parseInt(match[3])
      // Extra validation to avoid matching reference numbers
      if (d >= 1 && d <= 31 && m >= 0 && m <= 11) {
        day = d
        month = m
        year = y
      }
    }
  }

  // Handle 2-digit years
  if (year !== undefined && year < 100) {
    year += year < 50 ? 2000 : 1900
  }

  // Validate and return
  if (day !== undefined && month !== undefined && year !== undefined &&
      !isNaN(day) && !isNaN(month) && !isNaN(year) &&
      day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 1900 && year <= 2100) {
    try {
      const date = new Date(year, month, day)
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]
      }
    } catch {
      return null
    }
  }

  return null
}

function extractAmounts(text: string): number[] {
  const amounts: number[] = []

  // Match amounts with various formats
  // Nigerian format: 1,234.56 or 1234.56 or NGN 1,234.56
  const patterns = [
    /(?:NGN|₦|N)?\s*([\d,]+\.\d{2})/g,
    /([\d,]+\.\d{2})\s*(?:DR|CR|Cr|Dr)?/g
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const amountStr = match[1].replace(/,/g, '')
      const amount = parseFloat(amountStr)
      if (!isNaN(amount) && amount > 0 && amount < 1000000000) {
        amounts.push(amount)
      }
    }
  }

  // Remove duplicates
  return [...new Set(amounts)]
}

export async function parseBankStatement(
  file: File,
  onProgress?: (status: string, progress: number) => void
): Promise<BankStatementResult> {
  try {
    console.log('=== Starting Bank Statement Parse ===')
    console.log('File:', file.name, 'Size:', file.size, 'Type:', file.type)

    onProgress?.('Loading PDF...', 10)

    const arrayBuffer = await file.arrayBuffer()
    console.log('ArrayBuffer size:', arrayBuffer.byteLength)

    console.log('Loading PDF with pdfjs-dist...')
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    console.log('PDF loaded successfully, pages:', pdf.numPages)

    const numPages = pdf.numPages
    const allTextItems: Array<{ text: string; x: number; y: number; page: number; width: number }> = []

    // Extract text with position information
    for (let i = 1; i <= numPages; i++) {
      onProgress?.(`Reading page ${i} of ${numPages}...`, 10 + (30 * i / numPages))

      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()

      for (const item of textContent.items) {
        const textItem = item as any
        if (textItem.str && textItem.str.trim()) {
          allTextItems.push({
            text: textItem.str,
            x: Math.round(textItem.transform[4]),
            y: Math.round(textItem.transform[5]),
            page: i,
            width: textItem.width || 0
          })
        }
      }
    }

    onProgress?.('Parsing transactions...', 50)

    // Sort by page, then by Y (descending - top to bottom), then by X (left to right)
    allTextItems.sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page
      if (Math.abs(a.y - b.y) > 5) return b.y - a.y // Different rows
      return a.x - b.x // Same row, sort by X
    })

    // Group text items into rows (items with similar Y coordinates)
    const rows: Array<Array<{ text: string; x: number; y: number; page: number }>> = []
    let currentRow: Array<{ text: string; x: number; y: number; page: number }> = []
    let currentY = -1
    let currentPage = -1

    for (const item of allTextItems) {
      if (currentPage !== item.page || (currentY !== -1 && Math.abs(currentY - item.y) > 5)) {
        // New row
        if (currentRow.length > 0) {
          rows.push(currentRow)
        }
        currentRow = [item]
        currentY = item.y
        currentPage = item.page
      } else {
        // Same row
        currentRow.push(item)
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow)
    }

    // Convert rows to structured lines, preserving column structure with tabs
    const lines: string[] = rows.map(row => {
      // Sort items by X position
      row.sort((a, b) => a.x - b.x)
      // Join with tab separator for column structure
      return row.map(item => item.text).join('\t')
    })

    // Debug: Log rows to understand structure
    console.log('=== Bank Statement Parser Debug ===')
    console.log('Total rows extracted:', rows.length)
    console.log('First 15 rows (header area):')
    lines.slice(0, 15).forEach((line, i) => console.log(`Row ${i + 1}: ${line}`))
    console.log('--- Transaction rows (15-30):')
    lines.slice(15, 30).forEach((line, i) => console.log(`Row ${i + 16}: ${line}`))

    // Test date parsing on first few potential transaction rows
    console.log('--- Date parsing tests:')
    lines.slice(10, 20).forEach((line, i) => {
      const cols = line.split('\t')
      cols.forEach((col, j) => {
        const parsed = parseNigerianDate(col.trim())
        if (parsed) {
          console.log(`  Row ${i + 11}, Col ${j + 1}: "${col.trim()}" -> ${parsed}`)
        }
      })
    })

    onProgress?.('Identifying transactions...', 70)

    // Parse transactions from lines
    const transactions: ParsedTransaction[] = []

    // Debug counters
    let rowsWithDate = 0
    let rowsWithAmount = 0
    let rowsWithBoth = 0

    // Try to detect table columns from rows
    // Nigerian bank statements typically have: Date | Description | Debit | Credit | Balance
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const columns = line.split('\t').map(c => c.trim()).filter(c => c)

      // Try to find a date in any column
      let date: string | null = null
      let dateIndex = -1
      for (let j = 0; j < columns.length; j++) {
        const parsedDate = parseNigerianDate(columns[j])
        if (parsedDate) {
          date = parsedDate
          dateIndex = j
          break
        }
      }

      // Log first few rows that have no date for debugging
      if (!date && i >= 10 && i <= 20) {
        console.log(`  Row ${i + 1} - No date found. Columns:`, columns.slice(0, 5))
      }

      if (!date) continue
      rowsWithDate++

      // Get all amounts from this row
      const rowText = columns.join(' ')
      const amounts = extractAmounts(rowText)
      if (amounts.length === 0) {
        if (rowsWithDate <= 5) {
          console.log(`  Row ${i + 1} - Has date ${date} but no amounts. Row: "${line.slice(0, 80)}"`)
        }
        continue
      }
      rowsWithAmount++
      rowsWithBoth++

      // Try to identify description column (usually after date, before amounts)
      let description = ''
      const amountStrings = amounts.map(a => a.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','))

      for (let j = 0; j < columns.length; j++) {
        if (j === dateIndex) continue
        const col = columns[j]
        // Skip if column is just an amount
        const isAmountColumn = amountStrings.some(amt => col.includes(amt.replace(',', '')))
        if (isAmountColumn) continue
        // Skip pure DR/CR markers
        if (/^(DR|CR|Dr|Cr)$/i.test(col)) continue
        // Collect description parts
        if (!description && col.length > 2) {
          description = col
        }
      }

      // If description is still empty, try to concatenate non-amount columns
      if (!description || description.length < 3) {
        description = columns
          .filter((col, idx) => {
            if (idx === dateIndex) return false
            if (/^[\d,]+\.\d{2}$/.test(col.replace(/,/g, ''))) return false
            if (/^(DR|CR|Dr|Cr)$/i.test(col)) return false
            return col.length > 1
          })
          .join(' ')
          .replace(/(?:NGN|₦|N)?\s*[\d,]+\.\d{2}/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      }

      if (description.length < 3) {
        description = 'Transaction'
      }

      // Determine if income or expense
      // Check for CR/credit indicators in the row
      const isIncome = isIncomeTransaction(rowText)
      const type = isIncome ? 'income' : 'expense'

      // For table formats, amounts often have debit and credit columns
      // Usually the last amount is balance, so prefer first meaningful amount
      let amount = amounts[0]

      // If there are multiple amounts, try to identify debit vs credit
      // Typically: smaller amounts are debit/credit, larger is balance
      if (amounts.length >= 2) {
        // Sort amounts, use the smallest non-trivial amount (likely transaction, not balance)
        const sortedAmounts = [...amounts].sort((a, b) => a - b)
        amount = sortedAmounts.find(a => a > 1) || amounts[0]
      }

      // Skip likely header rows or footer totals
      const lowerDesc = description.toLowerCase()
      if (lowerDesc.includes('total') ||
          lowerDesc.includes('opening balance') ||
          lowerDesc.includes('closing balance') ||
          lowerDesc.includes('period:') ||
          lowerDesc.includes('trans date') ||
          lowerDesc.includes('value date') ||
          lowerDesc.includes('account no') ||
          lowerDesc.includes('print date') ||
          lowerDesc.includes('branch name')) {
        console.log(`  Skipping header/footer row: "${description.slice(0, 50)}"`)
        continue
      }

      // Categorize
      const { category, confidence } = categorizeTransaction(description, type)

      console.log(`Parsed transaction: ${date} | ${description} | ${amount} | ${type} | ${category}`)

      transactions.push({
        id: generateId(),
        date,
        description: description.slice(0, 100),
        amount,
        type,
        category,
        confidence,
        rawText: line.replace(/\t/g, ' | ')
      })
    }

    onProgress?.('Finalizing...', 90)

    // Detect bank name
    const fullText = lines.join(' ').toLowerCase()
    let bankName: string | null = null
    const bankPatterns = [
      { pattern: /gtbank|guaranty\s*trust|gtb/i, name: 'GTBank' },
      { pattern: /access\s*bank/i, name: 'Access Bank' },
      { pattern: /first\s*bank|fbn/i, name: 'First Bank' },
      { pattern: /uba|united\s*bank\s*for\s*africa/i, name: 'UBA' },
      { pattern: /zenith/i, name: 'Zenith Bank' },
      { pattern: /stanbic/i, name: 'Stanbic IBTC' },
      { pattern: /fidelity/i, name: 'Fidelity Bank' },
      { pattern: /fcmb/i, name: 'FCMB' },
      { pattern: /union\s*bank/i, name: 'Union Bank' },
      { pattern: /sterling/i, name: 'Sterling Bank' },
      { pattern: /ecobank/i, name: 'Ecobank' },
      { pattern: /keystone/i, name: 'Keystone Bank' },
      { pattern: /polaris/i, name: 'Polaris Bank' },
      { pattern: /wema/i, name: 'Wema Bank' },
      { pattern: /heritage/i, name: 'Heritage Bank' },
      { pattern: /providus/i, name: 'Providus Bank' },
      { pattern: /opay/i, name: 'OPay' },
      { pattern: /palmpay/i, name: 'PalmPay' },
      { pattern: /kuda/i, name: 'Kuda Bank' },
      { pattern: /moniepoint/i, name: 'Moniepoint' }
    ]

    for (const { pattern, name } of bankPatterns) {
      if (pattern.test(fullText)) {
        bankName = name
        break
      }
    }

    // Extract account number
    const accountMatch = fullText.match(/account\s*(?:no|number|#)?[:\s]*(\d{10})/i)
    const accountNumber = accountMatch ? accountMatch[1] : null

    onProgress?.('Complete', 100)

    // Remove obvious duplicates
    const uniqueTransactions = transactions.filter((t, index, self) =>
      index === self.findIndex(other =>
        other.date === t.date &&
        Math.abs(other.amount - t.amount) < 0.01 &&
        other.description.substring(0, 20) === t.description.substring(0, 20)
      )
    )

    // Sort by date
    uniqueTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    console.log(`=== Parser Summary ===`)
    console.log(`Total rows: ${lines.length}`)
    console.log(`Rows with valid date: ${rowsWithDate}`)
    console.log(`Rows with date AND amount: ${rowsWithBoth}`)
    console.log(`Final transactions after filtering: ${uniqueTransactions.length}`)

    return {
      transactions: uniqueTransactions,
      bankName,
      accountNumber,
      period: null,
      success: uniqueTransactions.length > 0,
      rawText: `Found ${uniqueTransactions.length} transactions from ${rows.length} rows\n\nFirst 30 rows:\n${lines.slice(0, 30).join('\n')}`
    }

  } catch (error) {
    console.error('=== Bank Statement Parse Error ===')
    console.error('Error type:', error?.constructor?.name)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Full error:', error)

    let errorMessage = 'Failed to parse bank statement'
    if (error instanceof Error) {
      errorMessage = error.message
      // Common PDF.js errors
      if (error.message.includes('Invalid PDF')) {
        errorMessage = 'Invalid PDF file. Please ensure this is a valid PDF document.'
      } else if (error.message.includes('worker')) {
        errorMessage = 'PDF worker failed to load. Please refresh the page and try again.'
      } else if (error.message.includes('password')) {
        errorMessage = 'This PDF is password protected. Please provide an unprotected PDF.'
      }
    }

    return {
      transactions: [],
      bankName: null,
      accountNumber: null,
      period: null,
      success: false,
      error: errorMessage
    }
  }
}
