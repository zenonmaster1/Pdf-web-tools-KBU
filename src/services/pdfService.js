// PDF processing service using pdf-lib, pdfjs-dist (legacy build for older mobile browsers), and @pdfsmaller/pdf-encrypt
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { encryptPDF } from '@pdfsmaller/pdf-encrypt'
import { normalizeImageForPdf } from '../utils/fileUtils'

// Configure pdfjs worker locally (Zero external CDN, 100% offline client-side)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// Cache for local Thai font bytes
let cachedFontBytes = null

/**
 * Fetch and cache local Thai font (Sarabun) from public folder
 * @returns {Promise<ArrayBuffer|null>}
 */
async function getThaiFontBytes() {
  if (cachedFontBytes) return cachedFontBytes
  try {
    const res = await fetch('/fonts/Sarabun-Regular.ttf')
    if (res.ok) {
      cachedFontBytes = await res.arrayBuffer()
      return cachedFontBytes
    }
  } catch (err) {
    console.warn('Could not load local Sarabun font, fallback to standard font:', err)
  }
  return null
}

/**
 * Register fontkit and embed Thai or standard font
 * @param {PDFDocument} doc 
 * @returns {Promise<any>}
 */
async function embedBestFont(doc) {
  const fontBytes = await getThaiFontBytes()
  if (fontBytes) {
    try {
      doc.registerFontkit(fontkit)
      return await doc.embedFont(fontBytes)
    } catch (e) {
      console.warn('Fontkit embedding failed, using standard font:', e)
    }
  }
  return await doc.embedFont(StandardFonts.Helvetica)
}

/**
 * 1. COMBINE: Merge multiple PDF array buffers into a single PDF
 * @param {Array<{ buffer: ArrayBuffer, name: string }>} pdfList 
 * @returns {Promise<Uint8Array>}
 */
export async function mergePdfBuffers(pdfList) {
  const mergedDoc = await PDFDocument.create()

  for (const item of pdfList) {
    const doc = await PDFDocument.load(item.buffer, { ignoreEncryption: true })
    const pageIndices = doc.getPageIndices()
    const copiedPages = await mergedDoc.copyPages(doc, pageIndices)
    copiedPages.forEach((page) => mergedDoc.addPage(page))
  }

  return await mergedDoc.save()
}

/**
 * Render single page of PDF as Data URL image for preview/thumbnails
 * @param {ArrayBuffer} arrayBuffer 
 * @param {number} pageNumber 1-based page number
 * @param {number} scale scale factor (default 0.35 for fast thumbnail)
 * @returns {Promise<{ dataUrl: string, width: number, height: number }>}
 */
export async function renderPageThumbnail(arrayBuffer, pageNumber, scale = 0.35) {
  // Use clone of arrayBuffer to prevent detached buffer issues in web workers
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.8),
    width: viewport.width,
    height: viewport.height,
  }
}

/**
 * 2. ORGANIZE: Load PDF metadata and generate thumbnail previews for each page
 * @param {ArrayBuffer} arrayBuffer 
 * @param {Function} onProgress 
 * @returns {Promise<Array<{ index: number, originalIndex: number, rotation: number, dataUrl: string }>>}
 */
export async function loadPdfPagesForOrganize(arrayBuffer, onProgress) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise
  const numPages = pdf.numPages
  const pages = []

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 0.35 })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise

    pages.push({
      id: `page-${i}-${Date.now()}`,
      originalIndex: i - 1, // 0-based
      pageNumber: i,
      rotation: 0,
      dataUrl: canvas.toDataURL('image/jpeg', 0.8),
    })

    if (onProgress) {
      onProgress(Math.round((i / numPages) * 100))
    }
  }

  return pages
}

/**
 * 2. ORGANIZE: Save modified pages (reordered, rotated, or removed)
 * @param {ArrayBuffer} originalBuffer 
 * @param {Array<{ originalIndex: number, rotation: number }>} pageConfigs 
 * @returns {Promise<Uint8Array>}
 */
export async function saveOrganizedPdf(originalBuffer, pageConfigs) {
  const srcDoc = await PDFDocument.load(originalBuffer, { ignoreEncryption: true })
  const newDoc = await PDFDocument.create()

  for (const config of pageConfigs) {
    const [copiedPage] = await newDoc.copyPages(srcDoc, [config.originalIndex])
    const currentAngle = copiedPage.getRotation().angle || 0
    copiedPage.setRotation(degrees((currentAngle + config.rotation) % 360))
    newDoc.addPage(copiedPage)
  }

  return await newDoc.save()
}

/**
 * 3. CREATE (Images): Create a PDF from a list of image files
 * @param {Array<File>} imageFiles 
 * @param {{ pageSize: 'a4'|'fit', orientation: 'portrait'|'landscape'|'auto', margin: number }} options 
 * @returns {Promise<Uint8Array>}
 */
export async function createPdfFromImages(imageFiles, options = {}) {
  const { pageSize = 'a4', orientation = 'auto', margin = 20 } = options
  const doc = await PDFDocument.create()

  // Standard A4 dimensions in points (72 points/inch)
  const A4_WIDTH = 595.28
  const A4_HEIGHT = 841.89

  for (const file of imageFiles) {
    const normalized = await normalizeImageForPdf(file)
    const embeddedImage = normalized.isPng
      ? await doc.embedPng(normalized.bytes)
      : await doc.embedJpg(normalized.bytes)

    const imgWidth = normalized.width
    const imgHeight = normalized.height

    let pageW = A4_WIDTH
    let pageH = A4_HEIGHT

    if (pageSize === 'fit') {
      // Page fits image dimensions exactly
      pageW = imgWidth + margin * 2
      pageH = imgHeight + margin * 2
    } else {
      // Determine orientation
      if (orientation === 'landscape' || (orientation === 'auto' && imgWidth > imgHeight)) {
        pageW = A4_HEIGHT
        pageH = A4_WIDTH
      } else {
        pageW = A4_WIDTH
        pageH = A4_HEIGHT
      }
    }

    const page = doc.addPage([pageW, pageH])

    // Calculate maximum image box within margins
    const maxW = pageW - margin * 2
    const maxH = pageH - margin * 2

    // Maintain aspect ratio
    const scale = Math.min(maxW / imgWidth, maxH / imgHeight, 1.0)
    const drawW = imgWidth * scale
    const drawH = imgHeight * scale

    // Center image on page
    const posX = margin + (maxW - drawW) / 2
    const posY = margin + (maxH - drawH) / 2

    page.drawImage(embeddedImage, {
      x: posX,
      y: posY,
      width: drawW,
      height: drawH,
    })
  }

  return await doc.save()
}

/**
 * 3. CREATE (Text): Create a formatted PDF document from text
 * @param {string} title 
 * @param {string} content 
 * @param {{ fontSize: number, lineSpacing: number }} options 
 * @returns {Promise<Uint8Array>}
 */
export async function createPdfFromText(title, content, options = {}) {
  const { fontSize = 14, lineSpacing = 1.4 } = options
  const doc = await PDFDocument.create()
  const font = await embedBestFont(doc)

  const PAGE_WIDTH = 595.28
  const PAGE_HEIGHT = 841.89
  const MARGIN = 50
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
  const lineHeight = fontSize * lineSpacing

  let currentPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let cursorY = PAGE_HEIGHT - MARGIN

  // Draw title if present
  if (title && title.trim()) {
    const titleSize = fontSize + 6
    currentPage.drawText(title.trim(), {
      x: MARGIN,
      y: cursorY - titleSize,
      size: titleSize,
      font,
      color: rgb(0.1, 0.1, 0.2),
    })
    cursorY -= (titleSize * 1.5 + 10)
  }

  // Simple paragraph & line splitting
  const paragraphs = content.split('\n')
  for (const para of paragraphs) {
    if (para.trim() === '') {
      cursorY -= lineHeight
      continue
    }

    // Word wrap text to fit within page width
    const words = para.split(' ')
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const textWidth = font.widthOfTextAtSize(testLine, fontSize)

      if (textWidth > CONTENT_WIDTH && currentLine) {
        if (cursorY - lineHeight < MARGIN) {
          currentPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
          cursorY = PAGE_HEIGHT - MARGIN
        }

        currentPage.drawText(currentLine, {
          x: MARGIN,
          y: cursorY - fontSize,
          size: fontSize,
          font,
          color: rgb(0.15, 0.15, 0.15),
        })
        cursorY -= lineHeight
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      if (cursorY - lineHeight < MARGIN) {
        currentPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
        cursorY = PAGE_HEIGHT - MARGIN
      }

      currentPage.drawText(currentLine, {
        x: MARGIN,
        y: cursorY - fontSize,
        size: fontSize,
        font,
        color: rgb(0.15, 0.15, 0.15),
      })
      cursorY -= lineHeight
    }
  }

  return await doc.save()
}

/**
 * 4. EXPORT (Images): Render each page to image format (PNG/JPEG)
 * @param {ArrayBuffer} arrayBuffer 
 * @param {number} pageNumber 1-based page number
 * @param {'png'|'jpeg'} format 
 * @param {number} scale 
 * @returns {Promise<{ dataUrl: string, blob: Blob, width: number, height: number }>}
 */
export async function exportPageToImage(arrayBuffer, pageNumber, format = 'png', scale = 2.0) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')

  // White background for transparent pages
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise

  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const quality = format === 'jpeg' ? 0.92 : undefined

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve({
        dataUrl: canvas.toDataURL(mime, quality),
        blob,
        width: viewport.width,
        height: viewport.height,
      })
    }, mime, quality)
  })
}

/**
 * 4. EXPORT (Text): Extract text content from all pages
 * @param {ArrayBuffer} arrayBuffer 
 * @param {Function} onProgress 
 * @returns {Promise<string>}
 */
export async function exportPdfToText(arrayBuffer, onProgress) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise
  const numPages = pdf.numPages
  const outputParts = []

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()

    let lastY = null
    let pageText = ''

    for (const item of textContent.items) {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        pageText += '\n'
      } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
        pageText += ' '
      }
      pageText += item.str
      lastY = item.transform[5]
    }

    outputParts.push(`===== หน้าที่ ${i} จาก ${numPages} =====\n\n${pageText.trim()}\n`)

    if (onProgress) {
      onProgress(Math.round((i / numPages) * 100))
    }
  }

  return outputParts.join('\n\n')
}

/**
 * 5. ADD COMMENTS: Overlay text notes/stamps onto PDF pages
 * @param {ArrayBuffer} arrayBuffer 
 * @param {Array<{
 *   pageIndex: number,
 *   text: string,
 *   xPercent: number,
 *   yPercent: number,
 *   fontSize: number,
 *   colorHex: string,
 *   bgStyle: 'none'|'yellow'|'white'|'light-red'
 * }>} comments 
 * @returns {Promise<Uint8Array>}
 */
export async function addCommentsToPdf(arrayBuffer, comments) {
  const doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
  const font = await embedBestFont(doc)

  // Color map helper
  const parseColor = (hex) => {
    const clean = hex.replace('#', '')
    const r = parseInt(clean.substring(0, 2), 16) / 255
    const g = parseInt(clean.substring(2, 4), 16) / 255
    const b = parseInt(clean.substring(4, 6), 16) / 255
    return rgb(r, g, b)
  }

  for (const c of comments) {
    if (c.pageIndex >= doc.getPageCount()) continue
    const page = doc.getPage(c.pageIndex)
    const { width, height } = page.getSize()

    const fontSize = c.fontSize || 14
    const text = c.text || ''
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    const textHeight = fontSize

    // Convert percentage to PDF points (0,0 is bottom-left in PDF)
    const posX = Math.max(10, Math.min(width - textWidth - 10, (c.xPercent / 100) * width))
    // yPercent is from top (0% at top, 100% at bottom)
    const posY = Math.max(10, Math.min(height - textHeight - 10, height - (c.yPercent / 100) * height - textHeight))

    const pad = 6
    // Optional background highlight box
    if (c.bgStyle && c.bgStyle !== 'none') {
      let bgRgb = rgb(1, 0.96, 0.6) // yellow highlight
      if (c.bgStyle === 'white') bgRgb = rgb(1, 1, 1)
      if (c.bgStyle === 'light-red') bgRgb = rgb(1, 0.88, 0.88)

      page.drawRectangle({
        x: posX - pad,
        y: posY - pad / 2,
        width: textWidth + pad * 2,
        height: textHeight + pad * 1.5,
        color: bgRgb,
        opacity: 0.9,
      })
    }

    // Draw comment text
    page.drawText(text, {
      x: posX,
      y: posY,
      size: fontSize,
      font,
      color: parseColor(c.colorHex || '#1e293b'),
    })
  }

  return await doc.save()
}

/**
 * 6. PROTECT: Encrypt PDF with password using AES-256 Web Crypto
 * @param {ArrayBuffer} arrayBuffer 
 * @param {string} userPassword 
 * @param {string} [ownerPassword] 
 * @returns {Promise<Uint8Array>}
 */
export async function protectPdfWithPassword(arrayBuffer, userPassword, ownerPassword = '') {
  if (!userPassword || userPassword.length === 0) {
    throw new Error('กรุณาระบุรหัสผ่านสำหรับเปิดไฟล์')
  }

  const pdfBytes = new Uint8Array(arrayBuffer)
  const options = {
    algorithm: 'AES-256',
    ownerPassword: ownerPassword || userPassword,
    permissions: {
      printing: 'high',
      modifying: false,
      copying: false,
      annotating: false,
    },
  }

  return await encryptPDF(pdfBytes, userPassword, options)
}
