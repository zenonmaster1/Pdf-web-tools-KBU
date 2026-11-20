import { useState, useRef, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Share2,
  ArrowLeft,
  Image as ImageIcon,
  FileText,
  Download,
  Copy,
  Check,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileArchive,
  Layers,
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import JSZip from 'jszip'

import FileDropzone from '../../components/FileDropzone'
import Toast from '../../components/Toast'
import LoadingIndicator from '../../components/LoadingIndicator'
import { downloadFile, formatBytes } from '../../utils/download'
import { copyTextToClipboard } from '../../utils/clipboard'
import { MAX_PAGES } from '../../utils/constants'

// Configure worker for legacy build
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// Canvas maximum resolution limit to prevent mobile browser memory exhaustion (16 MP)
const MAX_CANVAS_PIXELS = 16000000

/**
 * Parses and validates user-entered page range string (e.g. "1-3, 5, 8")
 */
function parsePageRange(rangeStr, totalPages, maxAllowedPages = MAX_PAGES) {
  if (!rangeStr?.trim()) {
    return { success: false, pages: [], error: 'กรุณาระบุช่วงหน้าที่ต้องการ เช่น 1-3, 5, 8' }
  }

  const parts = rangeStr.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) {
    return { success: false, pages: [], error: 'กรุณาระบุช่วงหน้าที่ต้องการ เช่น 1-3, 5, 8' }
  }

  const selectedPages = new Set()

  for (const part of parts) {
    if (part.includes('-')) {
      const rangeParts = part.split('-').map((s) => s.trim())
      if (rangeParts.length !== 2) {
        return { success: false, pages: [], error: `รูปแบบช่วงหน้า "${part}" ไม่ถูกต้อง` }
      }
      const start = Number(rangeParts[0])
      const end = Number(rangeParts[1])

      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < 1) {
        return { success: false, pages: [], error: `เลขหน้าใน "${part}" ต้องเป็นจำนวนเต็มบวกตั้งแต่ 1 ขึ้นไป` }
      }
      if (start > end) {
        return { success: false, pages: [], error: `ช่วงหน้า "${part}" ไม่ถูกต้อง (หน้าเริ่มต้นต้องน้อยกว่าหรือเท่ากับหน้าสิ้นสุด)` }
      }
      if (end > totalPages) {
        return { success: false, pages: [], error: `หน้า ${end} เกินจำนวนหน้าทั้งหมดของเอกสาร (เอกสารมี ${totalPages} หน้า)` }
      }
      for (let p = start; p <= end; p++) selectedPages.add(p)
    } else {
      const pageNum = Number(part)
      if (!Number.isInteger(pageNum) || pageNum < 1) {
        return { success: false, pages: [], error: `เลขหน้า "${part}" ต้องเป็นจำนวนเต็มบวกตั้งแต่ 1 ขึ้นไป` }
      }
      if (pageNum > totalPages) {
        return { success: false, pages: [], error: `หน้า ${pageNum} เกินจำนวนหน้าทั้งหมดของเอกสาร (เอกสารมี ${totalPages} หน้า)` }
      }
      selectedPages.add(pageNum)
    }
  }

  const sortedPages = Array.from(selectedPages).sort((a, b) => a - b)
  if (sortedPages.length === 0) return { success: false, pages: [], error: 'ไม่พบหน้าที่เลือก' }
  if (sortedPages.length > maxAllowedPages) {
    return { success: false, pages: [], error: `เลือกหน้าได้สูงสุดไม่เกิน ${maxAllowedPages} หน้า (เลือกมา ${sortedPages.length} หน้า)` }
  }

  return { success: true, pages: sortedPages, error: '' }
}

/**
 * Reconstructs readable text from PDF.js textContent
 */
function reconstructPageText(textContent) {
  if (!textContent?.items?.length) return ''

  const items = textContent.items
    .filter((it) => it && typeof it.str === 'string')
    .map((it) => {
      const h = it.height || Math.abs(it.transform?.[3]) || 12
      const w = it.width !== undefined && it.width !== null ? it.width : it.str.length * (h * 0.5)
      return { str: it.str, x: it.transform ? it.transform[4] : 0, y: it.transform ? it.transform[5] : 0, width: w, height: h }
    })

  if (items.length === 0) return ''
  items.sort((a, b) => b.y - a.y)

  const lines = []
  for (const item of items) {
    let matchedLine = null
    for (const line of lines) {
      const threshold = Math.max(Math.min(line.height, item.height) * 0.5, 3.5)
      if (Math.abs(line.y - item.y) <= threshold) {
        matchedLine = line
        break
      }
    }
    if (matchedLine) matchedLine.items.push(item)
    else lines.push({ y: item.y, height: item.height, items: [item] })
  }

  lines.sort((a, b) => b.y - a.y)

  let pageText = ''
  let prevLine = null

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x)
    let lineStr = ''
    let prevItem = null

    for (const it of line.items) {
      if (!it.str) continue
      if (!prevItem) {
        lineStr += it.str
        prevItem = it
        continue
      }
      const gap = it.x - (prevItem.x + prevItem.width)
      const spaceThreshold = Math.max(prevItem.height * 0.25, 2.5)
      if (gap > spaceThreshold && !/\s$/.test(prevItem.str) && !/^\s/.test(it.str)) {
        lineStr += ' '
      }
      lineStr += it.str
      prevItem = it
    }

    const trimmedLine = lineStr.trimEnd()
    if (!trimmedLine) continue

    if (!prevLine) {
      pageText += trimmedLine
    } else {
      const verticalGap = prevLine.y - line.y
      const standardLineSpacing = prevLine.height || 12
      pageText += (verticalGap > standardLineSpacing * 1.8 ? '\n\n' : '\n') + trimmedLine
    }
    prevLine = line
  }

  return pageText.trim()
}

/**
 * Safely cleans up PDF.js document proxy and loading task instances
 * Calls destroy or cleanup only if they exist as callable functions
 */
async function safeCleanupPdf(pdfDoc, loadingTask) {
  try {
    if (pdfDoc) {
      if (typeof pdfDoc.destroy === 'function') await pdfDoc.destroy()
      else if (pdfDoc.loadingTask && typeof pdfDoc.loadingTask.destroy === 'function') await pdfDoc.loadingTask.destroy()
      else if (typeof pdfDoc.cleanup === 'function') pdfDoc.cleanup()
    }
  } catch (err) {
    console.warn('Non-critical error cleaning up PDF document proxy:', err)
  }

  try {
    if (loadingTask && typeof loadingTask.destroy === 'function') await loadingTask.destroy()
  } catch (err) {
    console.warn('Non-critical error cleaning up PDF loading task:', err)
  }
}

export default function ExportTool() {
  const [activeTab, setActiveTab] = useState('images') // 'images' | 'text'

  // File state
  const [file, setFile] = useState(null)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoadingFile, setIsLoadingFile] = useState(false)

  // Range state
  const [rangeMode, setRangeMode] = useState('all') // 'all' | 'custom'
  const [customRangeStr, setCustomRangeStr] = useState('')

  // Mode 1: Image options
  const [imageFormat, setImageFormat] = useState('png') // 'png' | 'jpeg'
  const [imageQualityScale, setImageQualityScale] = useState(1.5) // 1.5, 2.0, 3.0
  const [isConvertingImages, setIsConvertingImages] = useState(false)
  const [imageProgress, setImageProgress] = useState({ current: 0, total: 0 })
  const [firstPagePreviewUrl, setFirstPagePreviewUrl] = useState(null)
  const [firstPageInfo, setFirstPageInfo] = useState(null)
  const [imageResult, setImageResult] = useState(null)

  // Mode 2: Text options
  const [isExtractingText, setIsExtractingText] = useState(false)
  const [textProgress, setTextProgress] = useState({ current: 0, total: 0 })
  const [extractedText, setExtractedText] = useState('')
  const [isEmptyText, setIsEmptyText] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  // Notifications & Refs
  const [toast, setToast] = useState(null)
  const isCancelledRef = useRef(false)

  useEffect(() => {
    return () => {
      if (firstPagePreviewUrl) URL.revokeObjectURL(firstPagePreviewUrl)
    }
  }, [firstPagePreviewUrl])

  // Active pages calculation & validation
  const activeRangeInfo = useMemo(() => {
    if (!totalPages) return { success: false, pages: [], error: 'ยังไม่ได้เลือกไฟล์ PDF' }
    if (rangeMode === 'all') {
      if (totalPages > MAX_PAGES) {
        return {
          success: false,
          pages: [],
          error: `เอกสารมี ${totalPages} หน้า ซึ่งเกินกว่าขีดจำกัด ${MAX_PAGES} หน้า กรุณาเลือก "ระบุช่วงหน้า"`,
        }
      }
      const allPages = []
      for (let i = 1; i <= totalPages; i++) allPages.push(i)
      return { success: true, pages: allPages, error: '' }
    }
    return parsePageRange(customRangeStr, totalPages, MAX_PAGES)
  }, [totalPages, rangeMode, customRangeStr])

  // Handle PDF file selection
  const handleFileSelected = async (selectedFiles) => {
    const selectedFile = selectedFiles[0]
    if (!selectedFile) return

    setIsLoadingFile(true)

    // Step A: Reset previous state safely
    try {
      handleResetState()
    } catch (cleanupErr) {
      console.warn('Non-critical error resetting state before file open:', cleanupErr)
    }

    let loadingTask = null
    let pdfDoc = null
    let openSuccess = false
    let numPages = 0
    let arrayBuffer = null

    // STEP 1: Open file and extract metadata
    try {
      arrayBuffer = await selectedFile.arrayBuffer()
      loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) })

      loadingTask.onPassword = () => {
        throw new Error('PASSWORD_PROTECTED')
      }

      pdfDoc = await loadingTask.promise
      numPages = pdfDoc.numPages
      openSuccess = true
    } catch (err) {
      if (
        err?.name === 'PasswordException' ||
        err instanceof pdfjsLib.PasswordException ||
        err?.message === 'PASSWORD_PROTECTED' ||
        err?.message?.toLowerCase().includes('password')
      ) {
        setToast({ type: 'error', message: 'ไฟล์นี้มีรหัสผ่าน ยังไม่รองรับ' })
      } else if (
        err?.name === 'InvalidPDFException' ||
        err instanceof pdfjsLib.InvalidPDFException
      ) {
        setToast({ type: 'error', message: 'ไฟล์ไม่ใช่ PDF ที่ถูกต้องหรือเสียหาย' })
      } else {
        console.error(err?.name || 'Error', err?.message || String(err))
        setToast({ type: 'error', message: 'เกิดข้อผิดพลาดภายในระบบ' })
      }
      setFile(null)
      setTotalPages(0)
    } finally {
      setIsLoadingFile(false)
    }

    // STEP 2: Separate step - update document state and safely clean up initial handle
    if (openSuccess) {
      if (numPages > MAX_PAGES) {
        setToast({
          type: 'warning',
          message: `เอกสารมี ${numPages} หน้า (เกิน ${MAX_PAGES} หน้า) กรุณาเลือก "ระบุช่วงหน้า" เพื่อประมวลผล`,
        })
        setRangeMode('custom')
        setCustomRangeStr(`1-${Math.min(numPages, 10)}`)
      } else {
        setRangeMode('all')
        setCustomRangeStr(`1-${numPages}`)
      }

      setFile({
        name: selectedFile.name,
        size: selectedFile.size,
        data: arrayBuffer,
      })
      setTotalPages(numPages)

      // Clean up temporary handle safely (even if cleanup fails, file opening remains successful)
      await safeCleanupPdf(pdfDoc, loadingTask)
    }
  }

  const handleResetState = () => {
    if (firstPagePreviewUrl) {
      URL.revokeObjectURL(firstPagePreviewUrl)
      setFirstPagePreviewUrl(null)
    }
    setFirstPageInfo(null)
    setImageResult(null)
    setExtractedText('')
    setIsEmptyText(false)
  }

  const handleFullReset = () => {
    handleResetState()
    setFile(null)
    setTotalPages(0)
    setRangeMode('all')
    setCustomRangeStr('')
  }

  // ================= MODE 1: EXPORT AS IMAGES =================
  const handleExportImages = async () => {
    if (!file?.data || !activeRangeInfo.success || activeRangeInfo.pages.length === 0) {
      if (activeRangeInfo.error) setToast({ type: 'error', message: activeRangeInfo.error })
      return
    }

    const pagesToExport = activeRangeInfo.pages
    setIsConvertingImages(true)
    setImageProgress({ current: 0, total: pagesToExport.length })
    setImageResult(null)
    isCancelledRef.current = false

    if (firstPagePreviewUrl) {
      URL.revokeObjectURL(firstPagePreviewUrl)
      setFirstPagePreviewUrl(null)
    }
    setFirstPageInfo(null)

    let loadingTask = null
    let pdfDoc = null
    let hadResolutionReduction = false

    try {
      loadingTask = pdfjsLib.getDocument({ data: file.data.slice(0) })
      pdfDoc = await loadingTask.promise

      const renderedImages = []

      for (let i = 0; i < pagesToExport.length; i++) {
        if (isCancelledRef.current) {
          setToast({ type: 'info', message: 'ยกเลิกการแปลงรูปภาพแล้ว' })
          return
        }

        const pageNum = pagesToExport[i]
        setImageProgress({ current: i + 1, total: pagesToExport.length })

        const page = await pdfDoc.getPage(pageNum)
        let viewport = page.getViewport({ scale: imageQualityScale })

        const totalPixels = viewport.width * viewport.height
        if (totalPixels > MAX_CANVAS_PIXELS) {
          const reductionFactor = Math.sqrt(MAX_CANVAS_PIXELS / totalPixels)
          viewport = page.getViewport({ scale: Math.max(0.5, imageQualityScale * reductionFactor * 0.98) })
          hadResolutionReduction = true
        }

        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d')

        if (imageFormat === 'jpeg') {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }

        await page.render({ canvasContext: ctx, viewport }).promise

        const mimeType = imageFormat === 'jpeg' ? 'image/jpeg' : 'image/png'
        const quality = imageFormat === 'jpeg' ? 0.9 : undefined
        const ext = imageFormat === 'jpeg' ? 'jpg' : 'png'

        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob((b) => {
            if (b) resolve(b)
            else reject(new Error(`เกิดข้อผิดพลาดในการสร้างรูปหน้า ${pageNum}`))
          }, mimeType, quality)
        })

        canvas.width = 0
        canvas.height = 0
        page.cleanup()

        const filename = `page-${String(pageNum).padStart(3, '0')}.${ext}`
        renderedImages.push({ pageNum, blob, width: Math.floor(viewport.width), height: Math.floor(viewport.height), filename })

        if (i === 0) {
          const previewUrl = URL.createObjectURL(blob)
          setFirstPagePreviewUrl(previewUrl)
          setFirstPageInfo({ width: Math.floor(viewport.width), height: Math.floor(viewport.height), pageNum, ext })
        }
      }

      if (isCancelledRef.current) {
        setToast({ type: 'info', message: 'ยกเลิกการแปลงรูปภาพแล้ว' })
        return
      }

      if (hadResolutionReduction) {
        setToast({ type: 'warning', message: 'หน้านี้ใหญ่เกินไป ลดความละเอียดอัตโนมัติ เพื่อป้องกันหน่วยความจำเต็ม' })
      }

      const isSingle = renderedImages.length === 1
      if (isSingle) {
        const singleItem = renderedImages[0]
        downloadFile(singleItem.blob, singleItem.filename, singleItem.blob.type)
        setImageResult({ isSingle: true, blob: singleItem.blob, filename: singleItem.filename, count: 1 })
        setToast({ type: 'success', message: `แปลงรูปภาพหน้า ${singleItem.pageNum} สำเร็จ ดาวน์โหลดเป็น ${singleItem.filename}` })
      } else {
        const zip = new JSZip()
        for (const item of renderedImages) zip.file(item.filename, item.blob)
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
        downloadFile(zipBlob, 'pages.zip', 'application/zip')
        setImageResult({ isSingle: false, blob: zipBlob, filename: 'pages.zip', count: renderedImages.length })
        setToast({ type: 'success', message: `แปลงรูปภาพ ${renderedImages.length} หน้าสำเร็จ รวมเป็น pages.zip และดาวน์โหลดแล้ว` })
      }
    } catch (err) {
      console.error('Image export error:', err)
      setToast({ type: 'error', message: `เกิดข้อผิดพลาดในการแปลงรูปภาพ: ${err.message || 'ไม่สามารถดำเนินการได้'}` })
    } finally {
      await safeCleanupPdf(pdfDoc, loadingTask)
      setIsConvertingImages(false)
      setImageProgress({ current: 0, total: 0 })
    }
  }

  // ================= MODE 2: EXPORT AS TEXT =================
  const handleExportText = async () => {
    if (!file?.data || !activeRangeInfo.success || activeRangeInfo.pages.length === 0) {
      if (activeRangeInfo.error) setToast({ type: 'error', message: activeRangeInfo.error })
      return
    }

    const pagesToExport = activeRangeInfo.pages
    setIsExtractingText(true)
    setTextProgress({ current: 0, total: pagesToExport.length })
    setExtractedText('')
    setIsEmptyText(false)
    isCancelledRef.current = false

    let loadingTask = null
    let pdfDoc = null

    try {
      loadingTask = pdfjsLib.getDocument({ data: file.data.slice(0) })
      pdfDoc = await loadingTask.promise

      const pageResults = []

      for (let i = 0; i < pagesToExport.length; i++) {
        if (isCancelledRef.current) {
          setToast({ type: 'info', message: 'ยกเลิกการดึงข้อความแล้ว' })
          return
        }

        const pageNum = pagesToExport[i]
        setTextProgress({ current: i + 1, total: pagesToExport.length })

        const page = await pdfDoc.getPage(pageNum)
        const textContent = await page.getTextContent()
        const reconstructed = reconstructPageText(textContent)
        pageResults.push({ pageNum, text: reconstructed })
        page.cleanup()
      }

      if (isCancelledRef.current) {
        setToast({ type: 'info', message: 'ยกเลิกการดึงข้อความแล้ว' })
        return
      }

      const totalTextLength = pageResults.reduce((acc, p) => acc + p.text.trim().length, 0)

      if (totalTextLength === 0) {
        setIsEmptyText(true)
        setExtractedText('')
        setToast({
          type: 'warning',
          message: 'ไฟล์นี้น่าจะเป็นภาพสแกน ไม่มีข้อความให้ดึง ระบบนี้ยังไม่รองรับ OCR (แนะนำให้ใช้โหมด "เป็นรูปภาพ" แทน)',
        })
        return
      }

      const combinedText = pageResults.map((p) => `--- หน้า ${p.pageNum} ---\n${p.text}`).join('\n\n')
      setExtractedText(combinedText)
      setIsEmptyText(false)
      setToast({ type: 'success', message: `ดึงข้อความจาก ${pageResults.length} หน้าสำเร็จ (${totalTextLength} ตัวอักษร)` })
    } catch (err) {
      console.error('Text extraction error:', err)
      setToast({ type: 'error', message: `เกิดข้อผิดพลาดในการดึงข้อความ: ${err.message || 'ไม่สามารถดำเนินการได้'}` })
    } finally {
      await safeCleanupPdf(pdfDoc, loadingTask)
      setIsExtractingText(false)
      setTextProgress({ current: 0, total: 0 })
    }
  }

  // Copy extracted text
  const handleCopyText = async () => {
    if (!extractedText) return
    const ok = await copyTextToClipboard(extractedText)
    if (ok) {
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2500)
      setToast({ type: 'success', message: 'คัดลอกข้อความลงคลิปบอร์ดเรียบร้อยแล้ว' })
    } else {
      setToast({ type: 'error', message: 'ไม่สามารถคัดลอกได้ กรุณาไฮไลต์เลือกข้อความในกล่องแล้วคัดลอก' })
    }
  }

  // Download extracted text as UTF-8 file with BOM
  const handleDownloadTextFile = () => {
    if (!extractedText || isEmptyText) return
    const blob = new Blob(['\uFEFF', extractedText], { type: 'text/plain;charset=utf-8' })
    const baseName = file?.name?.replace(/\.[^/.]+$/, '') || 'document'
    downloadFile(blob, `${baseName}-text.txt`, 'text/plain;charset=utf-8')
    setToast({ type: 'success', message: `ดาวน์โหลดไฟล์ ${baseName}-text.txt สำเร็จ` })
  }

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 min-h-[44px] px-2 py-1 rounded-lg transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>กลับหน้าแรก</span>
      </Link>

      {/* Header Card */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">ส่งออกรูปภาพและข้อความ (Export)</h1>
            <p className="text-xs sm:text-sm text-slate-500">แปลงหน้า PDF เป็นรูปภาพ (PNG/JPG) หรือดึงข้อความออกมาเป็นไฟล์ .txt</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 mt-5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => { setActiveTab('images'); handleResetState() }}
            className={`min-h-[44px] py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'images' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>เป็นรูปภาพ (Images)</span>
          </button>
          <button
            onClick={() => { setActiveTab('text'); handleResetState() }}
            className={`min-h-[44px] py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'text' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>เป็นข้อความ (Text)</span>
          </button>
        </div>
      </div>

      {/* File Dropzone */}
      {!file && (
        <div>
          {isLoadingFile ? (
            <LoadingIndicator message="กำลังเปิดและอ่านข้อมูลหน้าเอกสาร PDF..." subMessage="ประมวลผลบนเครื่อง 100% ไม่ส่งข้อมูลออกภายนอก" />
          ) : (
            <FileDropzone
              onFilesSelected={handleFileSelected}
              onError={(msg) => setToast({ type: 'error', message: msg })}
              accept="application/pdf"
              multiple={false}
              title="แตะหรือลากไฟล์ PDF มาวางที่นี่เพื่อส่งออก"
              subtitle="รองรับทั้งเอกสารทั่วไปและเอกสารหลายหน้า (สูงสุด 100 หน้า)"
              buttonText="เลือกไฟล์ PDF"
            />
          )}
        </div>
      )}

      {/* Active File Management & Controls */}
      {file && (
        <div className="space-y-6">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate" title={file.name}>{file.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">ขนาด: {formatBytes(file.size)} • จำนวน: {totalPages} หน้า</p>
                </div>
              </div>

              <button
                onClick={handleFullReset}
                disabled={isConvertingImages || isExtractingText}
                className="min-h-[44px] px-3.5 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl font-medium flex items-center justify-center gap-1.5 border border-red-200/60 disabled:opacity-30 transition-colors self-start sm:self-center"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>เปลี่ยนไฟล์ใหม่</span>
              </button>
            </div>

            {/* Page Range Selection */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
              <label className="block text-xs font-bold text-slate-700">เลือกหน้าที่ต้องการส่งออก:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer min-h-[44px] transition-colors ${rangeMode === 'all' ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-medium' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                  <input type="radio" name="pageRangeOption" value="all" checked={rangeMode === 'all'} onChange={() => setRangeMode('all')} disabled={isConvertingImages || isExtractingText} className="w-4 h-4 text-blue-600" />
                  <span className="text-xs sm:text-sm">
                    ทุกหน้า (1 ถึง {totalPages})
                    {totalPages > MAX_PAGES && <span className="text-amber-600 text-xs ml-1 font-normal">(เกิน {MAX_PAGES} หน้า)</span>}
                  </span>
                </label>

                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer min-h-[44px] transition-colors ${rangeMode === 'custom' ? 'border-blue-500 bg-blue-50/50 text-blue-900 font-medium' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                  <input type="radio" name="pageRangeOption" value="custom" checked={rangeMode === 'custom'} onChange={() => setRangeMode('custom')} disabled={isConvertingImages || isExtractingText} className="w-4 h-4 text-blue-600" />
                  <span className="text-xs sm:text-sm">ระบุช่วงหน้า (เช่น 1-3, 5, 8)</span>
                </label>
              </div>

              {rangeMode === 'custom' && (
                <div className="space-y-1.5 pt-1">
                  <input
                    type="text"
                    value={customRangeStr}
                    onChange={(e) => setCustomRangeStr(e.target.value)}
                    placeholder="ตัวอย่าง: 1-3, 5, 8"
                    disabled={isConvertingImages || isExtractingText}
                    className="w-full min-h-[44px] px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  {activeRangeInfo.success ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>เลือกแล้ว {activeRangeInfo.pages.length} หน้า ({activeRangeInfo.pages.length <= 8 ? activeRangeInfo.pages.join(', ') : `${activeRangeInfo.pages.slice(0, 8).join(', ')}...`})</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{activeRangeInfo.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ================= TAB 1: IMAGES EXPORT ================= */}
          {activeTab === 'images' && (
            <div className="space-y-6">
              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  <span>ตั้งค่าการแปลงรูปภาพ</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">รูปแบบไฟล์ภาพ:</label>
                    <select
                      value={imageFormat}
                      onChange={(e) => setImageFormat(e.target.value)}
                      disabled={isConvertingImages}
                      className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="png">PNG (ความคมชัดสูงสุด / ไม่เสียความละเอียด)</option>
                      <option value="jpeg">JPG (ขนาดไฟล์เล็กกว่า / คุณภาพ 90%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">ความละเอียดของภาพ:</label>
                    <select
                      value={imageQualityScale}
                      onChange={(e) => setImageQualityScale(Number(e.target.value))}
                      disabled={isConvertingImages}
                      className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={1.5}>ปกติ (scale 1.5) - แนะนำสำหรับมือถือ</option>
                      <option value={2.0}>สูง (scale 2.0) - สำหรับอ่านตัวอักษรเล็ก</option>
                      <option value={3.0}>สูงมาก (scale 3.0) - คมชัดเป็นพิเศษ</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>หากส่งออก 1 หน้าจะดาวน์โหลดเป็นรูปเดี่ยว หากส่งออกหลายหน้าจะรวมเป็นไฟล์ ZIP (pages.zip)</span>
                </div>

                {!isConvertingImages ? (
                  <button
                    onClick={handleExportImages}
                    disabled={!activeRangeInfo.success || activeRangeInfo.pages.length === 0}
                    className="w-full min-h-[44px] py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-98"
                  >
                    <Download className="w-4 h-4" />
                    <span>เริ่มแปลงเป็นรูปภาพ ({activeRangeInfo.success ? activeRangeInfo.pages.length : 0} หน้า)</span>
                  </button>
                ) : (
                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                      <span>กำลังแปลงหน้า {imageProgress.current} จาก {imageProgress.total}...</span>
                      <span>{imageProgress.total > 0 ? Math.round((imageProgress.current / imageProgress.total) * 100) : 0}%</span>
                    </div>
                    <div className="w-full bg-blue-200 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full transition-all duration-200" style={{ width: `${imageProgress.total > 0 ? (imageProgress.current / imageProgress.total) * 100 : 0}%` }} />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-blue-700">ประมวลผลทีละหน้าเพื่อความเสถียรบนมือถือ</span>
                      <button
                        type="button"
                        onClick={() => { isCancelledRef.current = true }}
                        className="min-h-[44px] px-4 py-1 text-xs font-bold text-red-600 bg-white hover:bg-red-50 border border-red-200 rounded-xl transition-colors"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* First Page Preview */}
              {firstPagePreviewUrl && (
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>ตัวอย่างหน้าแรกของผลลัพธ์ (หน้า {firstPageInfo?.pageNum})</span>
                      </h3>
                      {firstPageInfo && (
                        <p className="text-xs text-slate-500 mt-0.5">ขนาด: {firstPageInfo.width} × {firstPageInfo.height} px • รูปแบบ: {firstPageInfo.ext?.toUpperCase()}</p>
                      )}
                    </div>
                    {imageResult && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                        {imageResult.isSingle ? <><ImageIcon className="w-3.5 h-3.5" /><span>รูปภาพเดี่ยว</span></> : <><FileArchive className="w-3.5 h-3.5" /><span>ZIP ({imageResult.count} หน้า)</span></>}
                      </span>
                    )}
                  </div>

                  <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex justify-center overflow-hidden">
                    <img src={firstPagePreviewUrl} alt={`ตัวอย่างหน้า ${firstPageInfo?.pageNum}`} className="max-h-72 object-contain rounded-lg shadow-2xs border border-slate-200/80 bg-white" />
                  </div>

                  {imageResult && (
                    <button
                      onClick={() => downloadFile(imageResult.blob, imageResult.filename, imageResult.blob.type)}
                      className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>ดาวน์โหลดอีกครั้ง ({imageResult.filename})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2: TEXT EXPORT ================= */}
          {activeTab === 'text' && (
            <div className="space-y-6">
              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>ดึงข้อความจากเอกสาร PDF</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">ดึงข้อความภาษาไทย จัดกลุ่มบรรทัด ไม่ตัดแยกสระวรรณยุกต์ และแบ่งหน้าด้วยเส้นคั่น</p>
                </div>

                {!isExtractingText ? (
                  <button
                    onClick={handleExportText}
                    disabled={!activeRangeInfo.success || activeRangeInfo.pages.length === 0}
                    className="w-full min-h-[44px] py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-98"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดึงข้อความ ({activeRangeInfo.success ? activeRangeInfo.pages.length : 0} หน้า)</span>
                  </button>
                ) : (
                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                      <span>กำลังดึงข้อความหน้า {textProgress.current} จาก {textProgress.total}...</span>
                      <span>{textProgress.total > 0 ? Math.round((textProgress.current / textProgress.total) * 100) : 0}%</span>
                    </div>
                    <div className="w-full bg-blue-200 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full transition-all duration-200" style={{ width: `${textProgress.total > 0 ? (textProgress.current / textProgress.total) * 100 : 0}%` }} />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-blue-700">ดึงตำแหน่งข้อความและจัดเรียงตามลำดับสายตา</span>
                      <button
                        type="button"
                        onClick={() => { isCancelledRef.current = true }}
                        className="min-h-[44px] px-4 py-1 text-xs font-bold text-red-600 bg-white hover:bg-red-50 border border-red-200 rounded-xl transition-colors"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Scanned Warning */}
              {isEmptyText && (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-amber-900">ไม่พบข้อความในหน้าที่เลือก</h4>
                      <p className="text-xs text-amber-800 leading-relaxed">ไฟล์นี้น่าจะเป็นภาพสแกน ไม่มีข้อความให้ดึง ระบบนี้ยังไม่รองรับ OCR แนะนำให้ใช้โหมด &quot;เป็นรูปภาพ&quot; แทน</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setActiveTab('images'); handleResetState() }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-2 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>สลับไปใช้โหมด &quot;เป็นรูปภาพ&quot;</span>
                  </button>
                </div>
              )}

              {/* Extracted Text Box */}
              {extractedText && (
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">ข้อความที่ดึงได้ ({extractedText.length.toLocaleString()} ตัวอักษร)</h3>
                      <p className="text-xs text-slate-500 mt-0.5">บันทึกเป็น UTF-8 พร้อม BOM เพื่อเปิดใน Windows Notepad ได้ถูกต้อง</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyText}
                        className="min-h-[44px] px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        {isCopied ? <><Check className="w-4 h-4 text-emerald-600" /><span className="text-emerald-700">คัดลอกแล้ว</span></> : <><Copy className="w-4 h-4" /><span>คัดลอก</span></>}
                      </button>
                      <button
                        onClick={handleDownloadTextFile}
                        className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>ดาวน์โหลด .txt</span>
                      </button>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto p-4 rounded-xl border border-slate-200 bg-slate-50/80 font-mono text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap select-text">
                    {extractedText}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Toast Notification */}
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </div>
  )
}
