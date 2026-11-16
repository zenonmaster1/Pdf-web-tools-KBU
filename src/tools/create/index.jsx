import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FilePlus,
  ArrowLeft,
  Image as ImageIcon,
  Type,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

import FileDropzone from '../../components/FileDropzone'
import Toast from '../../components/Toast'
import LoadingIndicator from '../../components/LoadingIndicator'
import { downloadFile, formatBytes } from '../../utils/download'
import { MAX_IMAGES } from '../../utils/constants'

// Import local fonts via Vite URL (Zero external network requests)
import sarabunRegularUrl from '../../assets/fonts/Sarabun-Regular.ttf?url'
import sarabunBoldUrl from '../../assets/fonts/Sarabun-Bold.ttf?url'

// Unique ID generator without crypto.randomUUID
const createUniqueId = (prefix = 'item') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

/**
 * Normalizes and converts an image to JPEG/PNG bytes via Canvas
 * Respects EXIF orientation, downsizes long edge to max 2500px, and closes bitmap
 */
async function processImageToBytes(file, maxDimension = 2500) {
  let bitmap = null
  let isBitmap = false

  try {
    // 1. Try createImageBitmap with EXIF from-image orientation
    if (typeof createImageBitmap === 'function') {
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
        isBitmap = true
      } catch {
        try {
          bitmap = await createImageBitmap(file)
          isBitmap = true
        } catch {
          bitmap = null
        }
      }
    }

    // Fallback if createImageBitmap is not supported
    if (!bitmap) {
      bitmap = await new Promise((resolve, reject) => {
        const img = new Image()
        const objUrl = URL.createObjectURL(file)
        img.onload = () => {
          URL.revokeObjectURL(objUrl)
          resolve(img)
        }
        img.onerror = () => {
          URL.revokeObjectURL(objUrl)
          reject(new Error(`ไม่สามารถเปิดไฟล์รูป "${file.name}" ได้`))
        }
        img.src = objUrl
      })
    }

    const origWidth = bitmap.width || bitmap.naturalWidth
    const origHeight = bitmap.height || bitmap.naturalHeight

    // 2. Downscale if long edge exceeds maxDimension (2500px)
    let targetWidth = origWidth
    let targetHeight = origHeight

    if (origWidth > maxDimension || origHeight > maxDimension) {
      if (origWidth >= origHeight) {
        targetWidth = maxDimension
        targetHeight = Math.round((origHeight * maxDimension) / origWidth)
      } else {
        targetHeight = maxDimension
        targetWidth = Math.round((origWidth * maxDimension) / origHeight)
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')

    const isPng = file.type === 'image/png'

    if (!isPng) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, targetWidth, targetHeight)
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)

    const mimeType = isPng ? 'image/png' : 'image/jpeg'
    const quality = isPng ? undefined : 0.9

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b)
        else reject(new Error('เกิดข้อผิดพลาดในการแปลง Canvas'))
      }, mimeType, quality)
    })

    const arrayBuf = await blob.arrayBuffer()

    return {
      bytes: new Uint8Array(arrayBuf),
      width: targetWidth,
      height: targetHeight,
      isPng,
    }
  } finally {
    // 3. Reclaim memory immediately on mobile
    if (isBitmap && bitmap && typeof bitmap.close === 'function') {
      bitmap.close()
    }
  }
}

/**
 * Fallback tokenizer for Thai text when Intl.Segmenter is unavailable
 * Groups base consonants with their combining vowels and tone marks
 */
function fallbackTokenize(text) {
  const thaiClusterRegex = /[\u0E01-\u0E2E][\u0E30-\u0E3A\u0E47-\u0E4E]*|[^\u0E01-\u0E2E]/g
  const tokens = []
  const parts = text.split(/(\s+)/)

  for (const part of parts) {
    if (!part) continue
    if (/\s+/.test(part)) {
      tokens.push(part)
    } else {
      const clusters = part.match(thaiClusterRegex) || [part]
      tokens.push(...clusters)
    }
  }
  return tokens
}

export default function CreateTool() {
  const [activeTab, setActiveTab] = useState('images') // 'images' | 'text'

  // Mode 1: From Images state
  const [images, setImages] = useState([])
  const [pageSize, setPageSize] = useState('a4-portrait') // 'a4-portrait' | 'a4-landscape' | 'fit'
  const [margin, setMargin] = useState(20) // 0, 20, 40
  const [isProcessingImages, setIsProcessingImages] = useState(false)
  const [imageProgress, setImageProgress] = useState({ current: 0, total: 0 })

  // Mode 2: From Text state
  const [textContent, setTextContent] = useState('')
  const [fontSize, setFontSize] = useState(14)
  const [isBold, setIsBold] = useState(false)
  const [textMargin, setTextMargin] = useState(50) // 30, 50, 70
  const [isProcessingText, setIsProcessingText] = useState(false)

  // Feedback notifications
  const [toast, setToast] = useState(null)

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl)
      })
    }
  }, [images])

  // --- Mode 1: Image handlers ---

  const handleImagesSelected = (selectedFiles) => {
    const validNewItems = []
    let hasHeic = false
    let hasInvalid = false

    for (const file of selectedFiles) {
      const lowerName = file.name.toLowerCase()

      // Detect HEIC files
      if (
        lowerName.endsWith('.heic') ||
        lowerName.endsWith('.heif') ||
        file.type === 'image/heic' ||
        file.type === 'image/heif'
      ) {
        hasHeic = true
        continue
      }

      // Check supported formats (JPG, PNG, WebP)
      const isSupported =
        lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg') ||
        lowerName.endsWith('.png') ||
        lowerName.endsWith('.webp') ||
        file.type === 'image/jpeg' ||
        file.type === 'image/png' ||
        file.type === 'image/webp'

      if (!isSupported) {
        hasInvalid = true
        continue
      }

      // Check maximum image count limit
      if (images.length + validNewItems.length >= MAX_IMAGES) {
        setToast({
          type: 'warning',
          message: `เลือกรูปภาพได้สูงสุด ${MAX_IMAGES} รูปเท่านั้น (ข้ามรูปที่เกิน)`,
        })
        break
      }

      validNewItems.push({
        id: createUniqueId('img'),
        file,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
      })
    }

    if (hasHeic) {
      setToast({
        type: 'error',
        message: 'ไม่รองรับไฟล์ HEIC กรุณาแปลงเป็น JPG ก่อนใช้งาน',
      })
    } else if (hasInvalid) {
      setToast({
        type: 'error',
        message: 'พบไฟล์ที่ไม่ใช่รูปภาพที่รองรับ (รับเฉพาะ JPG, PNG, WebP)',
      })
    }

    if (validNewItems.length > 0) {
      setImages((prev) => [...prev, ...validNewItems])
    }
  }

  const moveImageUp = (index) => {
    if (index === 0) return
    setImages((prev) => {
      const next = [...prev]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const moveImageDown = (index) => {
    if (index === images.length - 1) return
    setImages((prev) => {
      const next = [...prev]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const removeImage = (index) => {
    setImages((prev) => {
      const removed = prev[index]
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const clearAllImages = () => {
    images.forEach((img) => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl)
    })
    setImages([])
  }

  // Create PDF from images
  const handleCreatePdfFromImages = async () => {
    if (images.length === 0) return

    setIsProcessingImages(true)
    setImageProgress({ current: 0, total: images.length })

    // Standard A4 dimensions in PDF points
    const A4_WIDTH = 595.28
    const A4_HEIGHT = 841.89

    try {
      const pdfDoc = await PDFDocument.create()

      for (let i = 0; i < images.length; i++) {
        setImageProgress({ current: i + 1, total: images.length })
        const item = images[i]

        // Process image sequentially to save mobile memory
        const { bytes, width, height, isPng } = await processImageToBytes(item.file, 2500)

        const embeddedImage = isPng
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes)

        let targetPageW = A4_WIDTH
        let targetPageH = A4_HEIGHT

        if (pageSize === 'a4-landscape') {
          targetPageW = A4_HEIGHT
          targetPageH = A4_WIDTH
        } else if (pageSize === 'fit') {
          targetPageW = width + margin * 2
          targetPageH = height + margin * 2
        }

        const page = pdfDoc.addPage([targetPageW, targetPageH])

        if (pageSize === 'fit') {
          page.drawImage(embeddedImage, {
            x: margin,
            y: margin,
            width,
            height,
          })
        } else {
          // Fit image proportionally within page margins & center
          const availW = targetPageW - margin * 2
          const availH = targetPageH - margin * 2

          const scale = Math.min(availW / width, availH / height)
          const drawW = width * scale
          const drawH = height * scale

          const posX = margin + (availW - drawW) / 2
          const posY = margin + (availH - drawH) / 2

          page.drawImage(embeddedImage, {
            x: posX,
            y: posY,
            width: drawW,
            height: drawH,
          })
        }
      }

      const pdfBytes = await pdfDoc.save()
      downloadFile(pdfBytes, 'images.pdf', 'application/pdf')

      setToast({
        type: 'success',
        message: `สร้าง PDF จาก ${images.length} รูปภาพสำเร็จเรียบร้อย!`,
      })
    } catch (err) {
      console.error('Image to PDF error:', err)
      setToast({
        type: 'error',
        message: `เกิดข้อผิดพลาดในการสร้าง PDF: ${err.message || 'ไม่สามารถประมวลผลได้'}`,
      })
    } finally {
      setIsProcessingImages(false)
      setImageProgress({ current: 0, total: 0 })
    }
  }

  // --- Mode 2: Text handlers ---

  const handleCreatePdfFromText = async () => {
    const rawText = textContent.trim()
    if (!rawText) return

    setIsProcessingText(true)

    const A4_WIDTH = 595.28
    const A4_HEIGHT = 841.89
    const contentWidth = A4_WIDTH - textMargin * 2
    const lineHeight = fontSize * 1.5

    try {
      const pdfDoc = await PDFDocument.create()
      pdfDoc.registerFontkit(fontkit)

      // Fetch font from local Vite project asset
      const fontUrl = isBold ? sarabunBoldUrl : sarabunRegularUrl
      const fontRes = await fetch(fontUrl)
      if (!fontRes.ok) {
        throw new Error('ไม่สามารถโหลดฟอนต์ Sarabun ในเครื่องได้')
      }
      const fontBytes = await fontRes.arrayBuffer()

      // Embed font with subset: true for small file size
      const customFont = await pdfDoc.embedFont(fontBytes, { subset: true })

      let currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
      let cursorY = A4_HEIGHT - textMargin
      let hasReplacedUnsupportedChar = false

      // Sanitize unsupported emojis / rare glyphs to '?'
      const emojiRegex = /[\p{Extended_Pictographic}\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u

      const paragraphs = rawText.split('\n')

      for (const paragraph of paragraphs) {
        if (!paragraph.trim()) {
          // Empty newline
          cursorY -= lineHeight
          if (cursorY - lineHeight < textMargin) {
            currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
            cursorY = A4_HEIGHT - textMargin
          }
          continue
        }

        // Sanitize paragraph text
        let cleanParagraph = ''
        for (const char of paragraph) {
          if (emojiRegex.test(char)) {
            cleanParagraph += '?'
            hasReplacedUnsupportedChar = true
          } else {
            cleanParagraph += char
          }
        }

        // Word segmenting for Thai
        let tokens = []
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
          try {
            const segmenter = new Intl.Segmenter('th', { granularity: 'word' })
            tokens = Array.from(segmenter.segment(cleanParagraph)).map((s) => s.segment)
          } catch {
            tokens = fallbackTokenize(cleanParagraph)
          }
        } else {
          tokens = fallbackTokenize(cleanParagraph)
        }

        let currentLine = ''

        for (const token of tokens) {
          const candidateLine = currentLine + token
          let lineWidth = 0

          try {
            lineWidth = customFont.widthOfTextAtSize(candidateLine, fontSize)
          } catch {
            lineWidth = candidateLine.length * (fontSize * 0.6)
          }

          if (lineWidth > contentWidth && currentLine.length > 0) {
            // Check if page needs auto break
            if (cursorY - lineHeight < textMargin) {
              currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
              cursorY = A4_HEIGHT - textMargin
            }

            try {
              currentPage.drawText(currentLine, {
                x: textMargin,
                y: cursorY - fontSize,
                font: customFont,
                size: fontSize,
                color: rgb(0.12, 0.12, 0.12),
              })
            } catch {
              // Fallback if draw text throws on special character
              currentPage.drawText('?', {
                x: textMargin,
                y: cursorY - fontSize,
                font: customFont,
                size: fontSize,
              })
            }

            cursorY -= lineHeight
            currentLine = token.trimStart()
          } else {
            currentLine = candidateLine
          }
        }

        if (currentLine) {
          if (cursorY - lineHeight < textMargin) {
            currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
            cursorY = A4_HEIGHT - textMargin
          }

          try {
            currentPage.drawText(currentLine, {
              x: textMargin,
              y: cursorY - fontSize,
              font: customFont,
              size: fontSize,
              color: rgb(0.12, 0.12, 0.12),
            })
          } catch {
            currentPage.drawText('?', {
              x: textMargin,
              y: cursorY - fontSize,
              font: customFont,
              size: fontSize,
            })
          }
          cursorY -= lineHeight
        }
      }

      const pdfBytes = await pdfDoc.save()
      downloadFile(pdfBytes, 'text.pdf', 'application/pdf')

      const totalCreatedPages = pdfDoc.getPageCount()
      setToast({
        type: hasReplacedUnsupportedChar ? 'warning' : 'success',
        message: hasReplacedUnsupportedChar
          ? `สร้าง PDF (${totalCreatedPages} หน้า) สำเร็จ! (พบ Emoji/สัญลักษณ์ที่แทนที่ด้วย ?)`
          : `สร้าง PDF จากข้อความสำเร็จ (${totalCreatedPages} หน้า)`,
      })
    } catch (err) {
      console.error('Text to PDF error:', err)
      setToast({
        type: 'error',
        message: `เกิดข้อผิดพลาดในการสร้าง PDF จากข้อความ: ${err.message || 'ไม่สามารถประมวลผลได้'}`,
      })
    } finally {
      setIsProcessingText(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Back to Home Button */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 min-h-[44px] px-2 py-1 rounded-lg transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>กลับหน้าแรก</span>
      </Link>

      {/* Header Card */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FilePlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              สร้างเอกสาร PDF (Create)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              สร้างไฟล์ PDF ใหม่ได้ทันที ทั้งจากรูปภาพ (สแกน/สลิป/รูปถ่าย) หรือจากการพิมพ์ข้อความ
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 mt-5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab('images')}
            className={`min-h-[44px] py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'images'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>จากรูปภาพ ({images.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('text')}
            className={`min-h-[44px] py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'text'
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>จากข้อความ</span>
          </button>
        </div>
      </div>

      {/* ================= MODE 1: FROM IMAGES ================= */}
      {activeTab === 'images' && (
        <div className="space-y-6">
          {/* Dropzone */}
          <FileDropzone
            onFilesSelected={handleImagesSelected}
            onError={(msg) => setToast({ type: 'error', message: msg })}
            accept="image/jpeg,image/png,image/webp"
            multiple={true}
            title="แตะหรือลากรูปภาพมาวางที่นี่"
            subtitle={`รองรับ JPG, PNG, WebP (สูงสุด ${MAX_IMAGES} รูป)`}
            buttonText="เลือกรูปภาพ"
          />

          {/* Progress Indicator during image conversion */}
          {isProcessingImages && (
            <LoadingIndicator
              message={`กำลังประมวลผลรูปภาพที่ ${imageProgress.current} จาก ${imageProgress.total}...`}
              subMessage="ปรับทิศทางภาพ ย่อขนาดให้อยู่ในขอบเขต 2500px และฝังลง PDF"
            />
          )}

          {/* Selected Images List */}
          {images.length > 0 && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div>
                  <span className="font-bold text-sm text-slate-800">
                    รูปภาพทั้งหมด ({images.length}/{MAX_IMAGES} รูป)
                  </span>
                  <span className="text-xs text-slate-500 ml-2">
                    ({formatBytes(images.reduce((a, b) => a + b.size, 0))})
                  </span>
                </div>

                <button
                  onClick={clearAllImages}
                  className="min-h-[44px] px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl font-medium flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ล้างทั้งหมด</span>
                </button>
              </div>

              {/* Responsive Image Items List */}
              <div className="space-y-2.5">
                {images.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/70 gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Order Index */}
                      <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>

                      {/* Thumbnail Preview */}
                      <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0 border border-slate-200">
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Name & Size */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate" title={item.name}>
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatBytes(item.size)}
                        </p>
                      </div>
                    </div>

                    {/* Touch-Friendly Action Buttons (min 44px) */}
                    <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                      <button
                        onClick={() => moveImageUp(idx)}
                        disabled={idx === 0}
                        title="เลื่อนขึ้น"
                        aria-label="เลื่อนขึ้น"
                        className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white border border-slate-200/80 disabled:opacity-25 flex items-center justify-center transition-colors"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => moveImageDown(idx)}
                        disabled={idx === images.length - 1}
                        title="เลื่อนลง"
                        aria-label="เลื่อนลง"
                        className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white border border-slate-200/80 disabled:opacity-25 flex items-center justify-center transition-colors"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => removeImage(idx)}
                        title="ลบรูปนี้"
                        aria-label="ลบรูปนี้"
                        className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 border border-slate-200/80 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Options: Page size & Margins */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ขนาดหน้ากระดาษ:
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="a4-portrait">ขนาด A4 แนวตั้ง (Portrait)</option>
                    <option value="a4-landscape">ขนาด A4 แนวนอน (Landscape)</option>
                    <option value="fit">ตามขนาดรูป (Fit to Image)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ขอบกระดาษ (Margins):
                  </label>
                  <select
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={0}>ไม่มีขอบ (0 pt)</option>
                    <option value={20}>ขอบเล็ก (20 pt)</option>
                    <option value={40}>ขอบกลาง (40 pt)</option>
                  </select>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={handleCreatePdfFromImages}
                  disabled={images.length === 0 || isProcessingImages}
                  className="w-full min-h-[44px] py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  <span>สร้าง PDF ({images.length} หน้า) ดาวน์โหลดเป็น images.pdf</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MODE 2: FROM TEXT ================= */}
      {activeTab === 'text' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-5">
          {/* Text Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                ข้อความเอกสาร (รองรับภาษาไทย พร้อมตัดคำอัตโนมัติ):
              </label>
              <span className="text-[11px] text-slate-400">
                {textContent.length} ตัวอักษร
              </span>
            </div>

            <textarea
              rows={10}
              placeholder="พิมพ์หรือวางข้อความที่นี่... รองรับภาษาไทย สระ วรรณยุกต์ และจะตัดคำขึ้นหน้าใหม่อัตโนมัติ"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="w-full p-3.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white leading-relaxed font-sans"
            />
          </div>

          {/* Options: Font size, Style, Margins */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            {/* Font Size */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ขนาดตัวอักษร:
              </label>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={12}>12 pt (เล็ก)</option>
                <option value={14}>14 pt (ปกติ)</option>
                <option value={16}>16 pt (ปานกลาง)</option>
                <option value={18}>18 pt (ใหญ่)</option>
              </select>
            </div>

            {/* Font Style */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ลักษณะตัวอักษร:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsBold(false)}
                  className={`min-h-[44px] rounded-xl border text-xs sm:text-sm font-normal flex items-center justify-center transition-colors ${
                    !isBold
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  ปกติ (Regular)
                </button>
                <button
                  type="button"
                  onClick={() => setIsBold(true)}
                  className={`min-h-[44px] rounded-xl border text-xs sm:text-sm flex items-center justify-center transition-colors ${
                    isBold
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                      : 'border-slate-200 text-slate-600 font-bold hover:bg-slate-50'
                  }`}
                >
                  ตัวหนา (Bold)
                </button>
              </div>
            </div>

            {/* Margins */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ขอบกระดาษ (Margins):
              </label>
              <select
                value={textMargin}
                onChange={(e) => setTextMargin(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={30}>ขอบแคบ (30 pt)</option>
                <option value={50}>ขอบปกติ (50 pt)</option>
                <option value={70}>ขอบกว้าง (70 pt)</option>
              </select>
            </div>
          </div>

          {/* Thai Font & Offline Guarantee Notice */}
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              ใช้ฟอนต์สารบรรณ (Sarabun) ภายในเครื่อง ตัดคำไทยอัตโนมัติ และแบ่งหน้าอัตโนมัติ
            </span>
          </div>

          {/* Action Button */}
          <button
            onClick={handleCreatePdfFromText}
            disabled={!textContent.trim() || isProcessingText}
            className="w-full min-h-[44px] py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-98"
          >
            {isProcessingText ? (
              <span>กำลังสร้าง PDF จากข้อความ...</span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>สร้าง PDF ดาวน์โหลดเป็น text.pdf</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        message={toast?.message}
        type={toast?.type}
        onClose={() => setToast(null)}
      />
    </div>
  )
}
