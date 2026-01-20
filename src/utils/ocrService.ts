import Tesseract from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'

// Set worker source for PDF.js - use unpkg which works better with Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

export interface OCRResult {
  text: string
  confidence: number
  success: boolean
  error?: string
}

export interface OCRProgress {
  status: string
  progress: number
}

let worker: Tesseract.Worker | null = null

async function getWorker(): Promise<Tesseract.Worker> {
  if (!worker) {
    worker = await Tesseract.createWorker('eng', 1, {
      logger: () => {} // Suppress default logging
    })
  }
  return worker
}

// Check if file is a PDF
export function isPDF(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

// Convert PDF page to image
async function pdfPageToImage(page: pdfjsLib.PDFPageProxy, scale: number = 2): Promise<string> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!

  canvas.height = viewport.height
  canvas.width = viewport.width

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
    canvas: canvas
  }

  await page.render(renderContext as any).promise

  return canvas.toDataURL('image/png')
}

// Extract text from PDF using PDF.js text layer (faster than OCR)
async function extractTextFromPDF(
  file: File,
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  try {
    onProgress?.({ status: 'Loading PDF...', progress: 10 })

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    const numPages = pdf.numPages
    let fullText = ''

    for (let i = 1; i <= numPages; i++) {
      onProgress?.({ status: `Reading page ${i} of ${numPages}...`, progress: 10 + (80 * i / numPages) })

      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()

      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')

      fullText += pageText + '\n'
    }

    onProgress?.({ status: 'Complete', progress: 100 })

    const trimmedText = fullText.trim()

    // If we got text from the PDF text layer, return it
    if (trimmedText.length > 50) {
      return {
        text: trimmedText,
        confidence: 95, // PDF text extraction is highly accurate
        success: true
      }
    }

    // If PDF has little text, it might be scanned - fall back to OCR
    return await extractTextFromPDFWithOCR(file, onProgress)

  } catch (error) {
    console.error('PDF text extraction error:', error)
    // Fall back to OCR
    return await extractTextFromPDFWithOCR(file, onProgress)
  }
}

// Extract text from scanned PDF using OCR
async function extractTextFromPDFWithOCR(
  file: File,
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  try {
    onProgress?.({ status: 'PDF appears scanned, using OCR...', progress: 10 })

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    const numPages = Math.min(pdf.numPages, 5) // Limit to first 5 pages for performance
    let fullText = ''
    let totalConfidence = 0

    const tesseractWorker = await getWorker()

    for (let i = 1; i <= numPages; i++) {
      onProgress?.({ status: `OCR on page ${i} of ${numPages}...`, progress: 10 + (80 * i / numPages) })

      const page = await pdf.getPage(i)
      const imageData = await pdfPageToImage(page, 2)

      const result = await tesseractWorker.recognize(imageData)
      fullText += result.data.text + '\n'
      totalConfidence += result.data.confidence
    }

    onProgress?.({ status: 'Complete', progress: 100 })

    return {
      text: fullText.trim(),
      confidence: totalConfidence / numPages,
      success: fullText.trim().length > 0
    }

  } catch (error) {
    console.error('PDF OCR error:', error)
    return {
      text: '',
      confidence: 0,
      success: false,
      error: error instanceof Error ? error.message : 'PDF OCR failed'
    }
  }
}

export async function performOCR(
  imageSource: File | string,
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  try {
    // Check if it's a PDF file
    if (imageSource instanceof File && isPDF(imageSource)) {
      return await extractTextFromPDF(imageSource, onProgress)
    }

    onProgress?.({ status: 'Initializing OCR...', progress: 0 })

    const tesseractWorker = await getWorker()

    onProgress?.({ status: 'Processing image...', progress: 30 })

    let imageData: string | File = imageSource

    // If it's a File, convert to base64
    if (imageSource instanceof File) {
      imageData = await fileToBase64(imageSource)
    }

    onProgress?.({ status: 'Extracting text...', progress: 50 })

    const result = await tesseractWorker.recognize(imageData)

    onProgress?.({ status: 'Complete', progress: 100 })

    const text = result.data.text.trim()
    const confidence = result.data.confidence

    return {
      text,
      confidence,
      success: text.length > 0
    }
  } catch (error) {
    console.error('OCR Error:', error)
    return {
      text: '',
      confidence: 0,
      success: false,
      error: error instanceof Error ? error.message : 'OCR failed'
    }
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

// Preprocess image for better OCR results
export async function preprocessImage(file: File): Promise<File> {
  // Don't preprocess PDFs
  if (isPDF(file)) {
    return file
  }

  return new Promise((resolve) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    img.onload = () => {
      // Scale up small images
      const scale = Math.max(1, 1500 / Math.max(img.width, img.height))
      canvas.width = img.width * scale
      canvas.height = img.height * scale

      // Draw with slight contrast enhancement
      ctx.filter = 'contrast(1.2) brightness(1.1)'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], file.name, { type: 'image/png' }))
        } else {
          resolve(file)
        }
      }, 'image/png')
    }

    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

// Cleanup worker when done
export async function terminateOCR(): Promise<void> {
  if (worker) {
    await worker.terminate()
    worker = null
  }
}
