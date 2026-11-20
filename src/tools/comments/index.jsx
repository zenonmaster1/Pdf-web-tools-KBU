import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageSquarePlus,
  ArrowLeft,
  Hand,
  Type,
  Highlighter,
  MousePointer,
  Undo,
  Trash2,
  Download,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Edit3,
  X,
  FileText,
} from 'lucide-react'
import { PDFDocument, degrees, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

import FileDropzone from '../../components/FileDropzone'
import Toast from '../../components/Toast'
import LoadingIndicator from '../../components/LoadingIndicator'
import { downloadFile, formatBytes } from '../../utils/download'
import { MAX_FILE_MB, MAX_PAGES } from '../../utils/constants'
import sarabunRegularUrl from '../../assets/fonts/Sarabun-Regular.ttf?url'

import {
  getVisualPageDimensions,
  getHighlightPdfRect,
  getTextLinePdfCoords,
} from './coordinateUtils'
import {
  HIGHLIGHT_COLORS,
  TEXT_COLORS,
  FONT_SIZES,
  sanitizeUnsupportedChars,
  wrapTextToLines,
  generateUniqueId,
} from './textUtils'

// Configure worker for legacy pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

/**
 * Safely clean up PDF.js document proxy
 */
async function safeCleanupPdf(pdfDoc) {
  if (!pdfDoc) return
  try {
    if (typeof pdfDoc.destroy === 'function') {
      await pdfDoc.destroy()
    } else if (pdfDoc.loadingTask && typeof pdfDoc.loadingTask.destroy === 'function') {
      await pdfDoc.loadingTask.destroy()
    } else if (typeof pdfDoc.cleanup === 'function') {
      pdfDoc.cleanup()
    }
  } catch (err) {
    console.warn('Non-critical error cleaning up PDF:', err)
  }
}

export default function CommentsTool() {
  // File state
  const [fileInfo, setFileInfo] = useState(null)
  const [rawPdfBuffer, setRawPdfBuffer] = useState(null)
  const [pdfDocProxy, setPdfDocProxy] = useState(null)

  // Page navigation state
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [pageJumpInput, setPageJumpInput] = useState('1')
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 })

  // Tool modes: 'pan' | 'text' | 'highlight' | 'select'
  const [mode, setMode] = useState('pan')

  // Tool settings
  const [selectedHighlightColor, setSelectedHighlightColor] = useState('yellow')
  const [selectedTextColor, setSelectedTextColor] = useState('black')
  const [selectedFontSize, setSelectedFontSize] = useState(14)

  // Annotations state: Array of { id, pageNumber, type: 'highlight'|'text', ... }
  const [annotations, setAnnotations] = useState([])
  const [undoStack, setUndoStack] = useState([])
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null)

  // Active interaction draft state
  const [highlightDraft, setHighlightDraft] = useState(null)
  const [isDraggingAnnotation, setIsDraggingAnnotation] = useState(false)

  // Text Entry Modal state
  const [textModal, setTextModal] = useState({
    isOpen: false,
    mode: 'create', // 'create' | 'edit'
    id: null,
    u: 0.1,
    v: 0.1,
    text: '',
    colorKey: 'black',
    fontSize: 14,
  })

  // Clear all confirmation dialog state
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // UI status state
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [toast, setToast] = useState({ type: 'info', message: '' })

  // DOM Refs
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const containerRef = useRef(null)
  const renderTaskRef = useRef(null)
  const isPointerDownRef = useRef(false)
  const pointerStartRef = useRef({ x: 0, y: 0, u: 0, v: 0 })
  const dragItemInitialRef = useRef(null)

  // Push current annotations state onto undo stack
  const pushToUndo = useCallback((currentAnnotations) => {
    setUndoStack((prev) => [...prev.slice(-30), currentAnnotations])
  }, [])

  // Handle undo action
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    const previous = undoStack[undoStack.length - 1]
    setUndoStack((prev) => prev.slice(0, -1))
    setAnnotations(previous)
    setSelectedAnnotationId(null)
    setToast({ type: 'success', message: 'ยกเลิกการกระทำล่าสุดเรียบร้อย' })
  }, [undoStack])

  // Clear all annotations
  const handleClearAll = useCallback(() => {
    if (annotations.length === 0) return
    pushToUndo(annotations)
    setAnnotations([])
    setSelectedAnnotationId(null)
    setShowClearConfirm(false)
    setToast({ type: 'success', message: 'ล้างคอมเมนต์และไฮไลต์ทั้งหมดแล้ว' })
  }, [annotations, pushToUndo])

  // Handle PDF file selection
  const handleFileSelected = async (files) => {
    const file = files[0]
    if (!file) return

    setIsLoading(true)
    setLoadingMessage('กำลังเปิดและตรวจสอบไฟล์ PDF...')

    // Cleanup previous document if any
    if (pdfDocProxy) {
      await safeCleanupPdf(pdfDocProxy)
      setPdfDocProxy(null)
    }

    try {
      const buffer = await file.arrayBuffer()
      // Always pass a sliced copy to pdfjsLib to protect original buffer for pdf-lib
      const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) })
      const doc = await loadingTask.promise

      if (doc.numPages > MAX_PAGES) {
        setToast({
          type: 'error',
          message: `ไฟล์มีจำนวนหน้า (${doc.numPages} หน้า) เกินขีดจำกัดสูงสุด ${MAX_PAGES} หน้า`,
        })
        await safeCleanupPdf(doc)
        setIsLoading(false)
        return
      }

      setFileInfo({
        name: file.name,
        size: file.size,
        numPages: doc.numPages,
      })
      setRawPdfBuffer(buffer)
      setPdfDocProxy(doc)
      setNumPages(doc.numPages)
      setCurrentPage(1)
      setPageJumpInput('1')
      setAnnotations([])
      setUndoStack([])
      setSelectedAnnotationId(null)
      setMode('pan')
    } catch (err) {
      console.error(err?.name, err?.message, err)
      if (
        err?.name === 'PasswordException' ||
        err instanceof pdfjsLib.PasswordException ||
        err?.message?.toLowerCase().includes('password')
      ) {
        setToast({ type: 'error', message: 'ไฟล์นี้มีรหัสผ่าน ยังไม่รองรับ' })
      } else if (
        err?.name === 'InvalidPDFException' ||
        err instanceof pdfjsLib.InvalidPDFException
      ) {
        setToast({ type: 'error', message: 'ไฟล์ไม่ถูกต้องหรือเสียหาย' })
      } else {
        setToast({
          type: 'error',
          message: `ไม่สามารถเปิดไฟล์ PDF ได้: ${err?.message || 'ไฟล์อาจเสียหาย'}`,
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Render current page onto canvas
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDocProxy || !canvasRef.current || !containerRef.current) return

    // Cancel in-flight render task if any
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel()
      } catch {
        // ignore cancellation error
      }
      renderTaskRef.current = null
    }

    try {
      const page = await pdfDocProxy.getPage(currentPage)
      const containerWidth = containerRef.current.clientWidth || window.innerWidth

      // Calculate viewport scale to fit comfortably in viewport
      const unscaledViewport = page.getViewport({ scale: 1.0 })
      const targetWidth = Math.min(containerWidth - 32, 860)
      const scale = Math.max(0.35, targetWidth / unscaledViewport.width)
      const viewport = page.getViewport({ scale })

      // Clamp devicePixelRatio to max 2 for crisp retina without memory exhaustion
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const canvas = canvasRef.current

      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`

      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      setCanvasDimensions({ width: viewport.width, height: viewport.height })

      const renderTask = page.render({
        canvasContext: ctx,
        viewport,
      })
      renderTaskRef.current = renderTask
      await renderTask.promise

      if (typeof page.cleanup === 'function') {
        page.cleanup()
      }
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err)
      }
    }
  }, [pdfDocProxy, currentPage])

  // Trigger render on page change or file loaded
  useEffect(() => {
    if (pdfDocProxy) {
      renderCurrentPage()
    }
  }, [pdfDocProxy, currentPage, renderCurrentPage])

  // Window resize re-render debounced
  useEffect(() => {
    const handleResize = () => {
      if (pdfDocProxy) {
        renderCurrentPage()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [pdfDocProxy, renderCurrentPage])

  // Safe cleanup on unmount
  useEffect(() => {
    return () => {
      if (pdfDocProxy) {
        safeCleanupPdf(pdfDocProxy)
      }
    }
  }, [pdfDocProxy])

  // Convert client pointer event to normalized [0, 1] page coordinates
  const getNormalizedPoint = (e) => {
    if (!overlayRef.current) return { u: 0, v: 0 }
    const rect = overlayRef.current.getBoundingClientRect()
    const u = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const v = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    return { u, v }
  }

  // Pointer Down on Overlay
  const handleOverlayPointerDown = (e) => {
    if (mode === 'pan') return

    const { u, v } = getNormalizedPoint(e)
    isPointerDownRef.current = true
    pointerStartRef.current = { x: e.clientX, y: e.clientY, u, v }

    if (mode === 'highlight') {
      try {
        e.target.setPointerCapture?.(e.pointerId)
      } catch {
        // pointer capture optional
      }
      setHighlightDraft({
        u1: u,
        v1: v,
        u2: u,
        v2: v,
        colorKey: selectedHighlightColor,
      })
    } else if (mode === 'text') {
      // Open text entry modal at tapped position
      setTextModal({
        isOpen: true,
        mode: 'create',
        id: null,
        u,
        v,
        text: '',
        colorKey: selectedTextColor,
        fontSize: selectedFontSize,
      })
    } else if (mode === 'select') {
      // Clicking empty area deselects current annotation
      setSelectedAnnotationId(null)
    }
  }

  // Pointer Move on Overlay
  const handleOverlayPointerMove = (e) => {
    if (!isPointerDownRef.current) return

    const { u, v } = getNormalizedPoint(e)

    if (mode === 'highlight' && highlightDraft) {
      setHighlightDraft((prev) => (prev ? { ...prev, u2: u, v2: v } : null))
    } else if (mode === 'select' && isDraggingAnnotation && selectedAnnotationId) {
      const deltaU = u - pointerStartRef.current.u
      const deltaV = v - pointerStartRef.current.v
      const initial = dragItemInitialRef.current
      if (!initial) return

      setAnnotations((prev) =>
        prev.map((ann) => {
          if (ann.id !== selectedAnnotationId) return ann
          if (ann.type === 'highlight') {
            const width = initial.u2 - initial.u1
            const height = initial.v2 - initial.v1
            const newU1 = Math.max(0, Math.min(1 - width, initial.u1 + deltaU))
            const newV1 = Math.max(0, Math.min(1 - height, initial.v1 + deltaV))
            return {
              ...ann,
              u1: newU1,
              v1: newV1,
              u2: newU1 + width,
              v2: newV1 + height,
            }
          } else if (ann.type === 'text') {
            return {
              ...ann,
              u: Math.max(0, Math.min(0.95, initial.u + deltaU)),
              v: Math.max(0, Math.min(0.95, initial.v + deltaV)),
            }
          }
          return ann
        })
      )
    }
  }

  // Pointer Up on Overlay
  const handleOverlayPointerUp = () => {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false

    if (mode === 'highlight' && highlightDraft) {
      const minU = Math.min(highlightDraft.u1, highlightDraft.u2)
      const maxU = Math.max(highlightDraft.u1, highlightDraft.u2)
      const minV = Math.min(highlightDraft.v1, highlightDraft.v2)
      const maxV = Math.max(highlightDraft.v1, highlightDraft.v2)

      // Only add if dragged more than a minimal threshold
      if (maxU - minU > 0.008 && maxV - minV > 0.005) {
        pushToUndo(annotations)
        const newAnnotation = {
          id: generateUniqueId('hl'),
          pageNumber: currentPage,
          type: 'highlight',
          u1: minU,
          v1: minV,
          u2: maxU,
          v2: maxV,
          colorKey: highlightDraft.colorKey,
        }
        setAnnotations((prev) => [...prev, newAnnotation])
        setSelectedAnnotationId(newAnnotation.id)
      }
      setHighlightDraft(null)
    }

    if (isDraggingAnnotation) {
      setIsDraggingAnnotation(false)
      dragItemInitialRef.current = null
    }
  }

  // Select item pointer down
  const handleItemPointerDown = (e, ann) => {
    if (mode !== 'select') return
    e.stopPropagation()

    setSelectedAnnotationId(ann.id)
    isPointerDownRef.current = true
    setIsDraggingAnnotation(true)
    pushToUndo(annotations)

    const { u, v } = getNormalizedPoint(e)
    pointerStartRef.current = { x: e.clientX, y: e.clientY, u, v }
    dragItemInitialRef.current = { ...ann }
  }

  // Save Text from Modal
  const handleSaveTextModal = () => {
    const trimmed = textModal.text.trim()
    if (!trimmed) {
      setTextModal((prev) => ({ ...prev, isOpen: false }))
      return
    }

    pushToUndo(annotations)

    if (textModal.mode === 'create') {
      const newAnnotation = {
        id: generateUniqueId('txt'),
        pageNumber: currentPage,
        type: 'text',
        u: textModal.u,
        v: textModal.v,
        text: trimmed,
        colorKey: textModal.colorKey,
        fontSize: textModal.fontSize,
      }
      setAnnotations((prev) => [...prev, newAnnotation])
      setSelectedAnnotationId(newAnnotation.id)
    } else if (textModal.mode === 'edit' && textModal.id) {
      setAnnotations((prev) =>
        prev.map((ann) =>
          ann.id === textModal.id
            ? {
                ...ann,
                text: trimmed,
                colorKey: textModal.colorKey,
                fontSize: textModal.fontSize,
              }
            : ann
        )
      )
    }

    setTextModal((prev) => ({ ...prev, isOpen: false }))
  }

  // Delete single annotation
  const handleDeleteAnnotation = (id) => {
    pushToUndo(annotations)
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
    if (selectedAnnotationId === id) setSelectedAnnotationId(null)
    setToast({ type: 'success', message: 'ลบรายการเรียบร้อย' })
  }

  // Open Edit Modal for selected text annotation
  const handleOpenEditTextModal = (ann) => {
    setTextModal({
      isOpen: true,
      mode: 'edit',
      id: ann.id,
      u: ann.u,
      v: ann.v,
      text: ann.text,
      colorKey: ann.colorKey,
      fontSize: ann.fontSize,
    })
  }

  // Save modified PDF with embedded annotations
  const handleSavePdf = async () => {
    if (annotations.length === 0) {
      setToast({
        type: 'error',
        message: 'ยังไม่มีคอมเมนต์หรือไฮไลต์บนเอกสาร กรุณาเพิ่มก่อนบันทึก',
      })
      return
    }

    setIsLoading(true)
    setLoadingMessage('กำลังวาดคอมเมนต์และไฮไลต์ลงบนหน้าเอกสาร...')

    try {
      const pdfDoc = await PDFDocument.load(rawPdfBuffer.slice(0), {
        ignoreEncryption: false,
      })

      pdfDoc.registerFontkit(fontkit)

      // Fetch bundled Sarabun font
      const fontRes = await fetch(sarabunRegularUrl)
      if (!fontRes.ok) throw new Error('ไม่สามารถโหลดฟอนต์ Sarabun ได้')
      const fontBytes = await fontRes.arrayBuffer()
      const customFont = await pdfDoc.embedFont(fontBytes, { subset: true })

      let hasReplacedUnsupportedChar = false
      const pageCount = pdfDoc.getPageCount()

      for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
        const pageNum = pageIdx + 1
        const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNum)
        if (pageAnnotations.length === 0) continue

        const page = pdfDoc.getPage(pageIdx)
        const box = page.getCropBox() || page.getMediaBox()
        const rot = ((page.getRotation().angle % 360) + 360) % 360
        const visualDim = getVisualPageDimensions(box, rot)

        // Draw highlights first
        for (const ann of pageAnnotations.filter((a) => a.type === 'highlight')) {
          const rect = getHighlightPdfRect(box, rot, ann.u1, ann.v1, ann.u2, ann.v2)
          const colorDef = HIGHLIGHT_COLORS[ann.colorKey] || HIGHLIGHT_COLORS.yellow
          const [r, g, b] = colorDef.pdfRgb

          page.drawRectangle({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            color: rgb(r, g, b),
            opacity: 0.45,
          })
        }

        // Draw text annotations
        for (const ann of pageAnnotations.filter((a) => a.type === 'text')) {
          const { cleanText, hasReplaced } = sanitizeUnsupportedChars(ann.text)
          if (hasReplaced) hasReplacedUnsupportedChar = true

          const colorDef = TEXT_COLORS[ann.colorKey] || TEXT_COLORS.black
          const [r, g, b] = colorDef.pdfRgb
          const fontSize = ann.fontSize || 14
          const lineHeight = fontSize * 1.35
          const maxLineWidth = Math.max(100, visualDim.width * (1 - ann.u) - 16)
          const lines = wrapTextToLines(cleanText, customFont, fontSize, maxLineWidth)

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (!line) continue

            const visualBaselinePt =
              ann.v * visualDim.height + fontSize * 0.85 + i * lineHeight
            const { x, y, rotationDegrees } = getTextLinePdfCoords(
              box,
              rot,
              ann.u,
              visualBaselinePt,
              visualDim.height
            )

            page.drawText(line, {
              x,
              y,
              size: fontSize,
              font: customFont,
              color: rgb(r, g, b),
              rotate: degrees(rotationDegrees),
            })
          }
        }
      }

      const savedBytes = await pdfDoc.save()
      const downloadName = (fileInfo?.name || 'document')
        .replace(/\.pdf$/i, '')
        .concat('-commented.pdf')

      downloadFile(savedBytes, downloadName, 'application/pdf')

      setToast({
        type: hasReplacedUnsupportedChar ? 'error' : 'success',
        message: hasReplacedUnsupportedChar
          ? `บันทึกไฟล์ "${downloadName}" สำเร็จ! (พบ Emoji หรือสัญลักษณ์ที่ไม่รองรับ ระบบแทนที่ด้วย ?)`
          : `บันทึกไฟล์ "${downloadName}" เรียบร้อยแล้ว`,
      })
    } catch (err) {
      console.error('Error saving commented PDF:', err)
      setToast({
        type: 'error',
        message: `เกิดข้อผิดพลาดในการบันทึก PDF: ${err?.message || 'ไม่ทราบสาเหตุ'}`,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Page Jump Input handler
  const handleJumpSubmit = (e) => {
    e.preventDefault()
    const page = parseInt(pageJumpInput, 10)
    if (!isNaN(page) && page >= 1 && page <= numPages) {
      setCurrentPage(page)
    } else {
      setPageJumpInput(String(currentPage))
    }
  }

  // Change page with boundary checks
  const goToPage = (newPage) => {
    if (newPage >= 1 && newPage <= numPages) {
      setCurrentPage(newPage)
      setPageJumpInput(String(newPage))
      setSelectedAnnotationId(null)
    }
  }

  // Filter annotations on current page
  const currentPageAnnotations = annotations.filter((a) => a.pageNumber === currentPage)

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 min-h-[44px] px-2 py-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับหน้าแรก</span>
        </Link>

        {fileInfo && (
          <button
            onClick={() => {
              if (
                annotations.length === 0 ||
                window.confirm('ต้องการเปลี่ยนไฟล์ใหม่หรือไม่? คอมเมนต์ที่ยังไม่บันทึกจะหายไป')
              ) {
                setFileInfo(null)
                setRawPdfBuffer(null)
                setPdfDocProxy(null)
                setAnnotations([])
              }
            }}
            className="text-xs text-slate-500 hover:text-red-600 font-medium px-3 py-2 min-h-[44px] rounded-lg transition-colors"
          >
            เปลี่ยนไฟล์ PDF
          </button>
        )}
      </div>

      {/* Title & Warning Notice Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <MessageSquarePlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              ใส่ข้อความและไฮไลต์ (Add comments)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              พิมพ์ข้อความกำกับหรือวาดแถบไฮไลต์ลงบนตำแหน่งที่ต้องการของหน้าเอกสาร
            </p>
          </div>
        </div>

        {/* Notice alert required by specs */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm leading-relaxed">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">ข้อควรทราบ: </span>
            คอมเมนต์จะถูกวาดลงบนหน้าเอกสารถาวร ผู้รับไม่สามารถแก้ไขหรือลบได้ภายหลัง
          </div>
        </div>
      </div>

      {/* Screen 1: Dropzone if no file selected */}
      {!fileInfo && (
        <FileDropzone
          onFilesSelected={handleFileSelected}
          onError={(msg) => setToast({ type: 'error', message: msg })}
          accept="application/pdf"
          multiple={false}
          maxFileMb={MAX_FILE_MB}
          title="แตะหรือลากไฟล์ PDF มาวางที่นี่เพื่อใส่คอมเมนต์"
          subtitle={`รองรับไฟล์ PDF สูงสุด ${MAX_FILE_MB} MB`}
          buttonText="เลือกไฟล์ PDF"
        />
      )}

      {/* Screen 2: PDF Annotation Workspace */}
      {fileInfo && (
        <div className="space-y-4">
          {/* Main Controls Header Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            {/* Row 1: File info summary & Save Button */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="text-xs sm:text-sm">
                  <span className="font-bold text-slate-800">{fileInfo.name}</span>
                  <span className="text-slate-400 mx-2">•</span>
                  <span className="text-slate-500">{formatBytes(fileInfo.size)}</span>
                  <span className="text-slate-400 mx-2">•</span>
                  <span className="text-blue-600 font-medium">{numPages} หน้า</span>
                </div>
              </div>

              <button
                onClick={handleSavePdf}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-98 transition-all font-semibold text-sm min-h-[44px] shadow-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>บันทึก PDF</span>
              </button>
            </div>

            {/* Row 2: 4 Tool Modes (Pan, Text, Highlight, Select) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMode('pan')
                    setSelectedAnnotationId(null)
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-colors ${
                    mode === 'pan'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Hand className="w-4 h-4" />
                  <span>เลื่อนดู</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('text')
                    setSelectedAnnotationId(null)
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-colors ${
                    mode === 'text'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Type className="w-4 h-4" />
                  <span>ข้อความ</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('highlight')
                    setSelectedAnnotationId(null)
                  }}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-colors ${
                    mode === 'highlight'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Highlighter className="w-4 h-4" />
                  <span>ไฮไลต์</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('select')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-colors ${
                    mode === 'select'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MousePointer className="w-4 h-4" />
                  <span>เลือก</span>
                </button>
              </div>

              {/* Undo & Clear Buttons */}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 min-h-[44px]"
                  title="ย้อนกลับการกระทำล่าสุด"
                >
                  <Undo className="w-3.5 h-3.5" />
                  <span>ย้อนกลับ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={annotations.length === 0}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 min-h-[44px]"
                  title="ล้างคอมเมนต์ทั้งหมด"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ล้างทั้งหมด</span>
                </button>
              </div>
            </div>

            {/* Row 3: Mode Options Panel */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              {mode === 'highlight' && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-600">สีไฮไลต์:</span>
                  <div className="flex items-center gap-1.5">
                    {Object.values(HIGHLIGHT_COLORS).map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => setSelectedHighlightColor(col.id)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform ${
                          selectedHighlightColor === col.id
                            ? 'ring-2 ring-offset-2 ring-blue-600 scale-105'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: col.hex, border: `1px solid ${col.border}` }}
                        title={col.name}
                      >
                        {selectedHighlightColor === col.id && (
                          <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === 'text' && (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-600">สีข้อความ:</span>
                    <div className="flex items-center gap-1.5">
                      {Object.values(TEXT_COLORS).map((col) => (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setSelectedTextColor(col.id)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${
                            selectedTextColor === col.id
                              ? 'ring-2 ring-offset-2 ring-blue-600 scale-105'
                              : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: col.hex }}
                          title={col.name}
                        >
                          {selectedTextColor === col.id && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-600">ขนาด:</span>
                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
                      {FONT_SIZES.map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setSelectedFontSize(sz)}
                          className={`px-2.5 py-1 rounded text-xs font-semibold min-h-[36px] ${
                            selectedFontSize === sz
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {mode === 'select' && (
                <div className="text-slate-500">
                  {selectedAnnotationId
                    ? 'แตะที่กล่องเพื่อลากย้ายตำแหน่ง หรือกดปุ่มแก้ไข/ลบ'
                    : 'แตะที่ข้อความหรือไฮไลต์เพื่อเลือก ย้าย หรือลบ'}
                </div>
              )}

              {mode === 'pan' && (
                <div className="text-slate-500">
                  โหมดเลื่อนดู: เลื่อนหน้าจอตามปกติ แตะเลือกเครื่องมือด้านบนเพื่อเริ่มวาด
                </div>
              )}

              <div className="text-slate-400 ml-auto">
                หน้านี้มี {currentPageAnnotations.length} รายการ (ทั้งหมด {annotations.length})
              </div>
            </div>
          </div>

          {/* Page Navigation Header */}
          <div className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 disabled:opacity-40 min-h-[44px] min-w-[44px] font-medium text-xs sm:text-sm"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">หน้าก่อนหน้า</span>
            </button>

            <form onSubmit={handleJumpSubmit} className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="text-slate-600 font-medium">หน้า</span>
              <input
                type="number"
                min={1}
                max={numPages}
                value={pageJumpInput}
                onChange={(e) => setPageJumpInput(e.target.value)}
                onBlur={() => setPageJumpInput(String(currentPage))}
                className="w-14 text-center px-2 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-800 min-h-[44px] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-500">จาก {numPages}</span>
            </form>

            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100 disabled:opacity-40 min-h-[44px] min-w-[44px] font-medium text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">หน้าถัดไป</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Canvas & Overlay Container */}
          <div
            ref={containerRef}
            className="flex justify-center bg-slate-200/70 p-2 sm:p-6 rounded-2xl border border-slate-300 overflow-x-auto min-h-[480px]"
          >
            <div
              className="relative bg-white shadow-xl rounded-sm transition-all select-none"
              style={{
                width: canvasDimensions.width ? `${canvasDimensions.width}px` : 'auto',
                height: canvasDimensions.height ? `${canvasDimensions.height}px` : 'auto',
              }}
            >
              {/* PDF Canvas layer */}
              <canvas ref={canvasRef} className="block w-full h-full" />

              {/* Interactive Annotation Overlay */}
              <div
                ref={overlayRef}
                onPointerDown={handleOverlayPointerDown}
                onPointerMove={handleOverlayPointerMove}
                onPointerUp={handleOverlayPointerUp}
                onPointerCancel={handleOverlayPointerUp}
                style={{
                  touchAction:
                    mode === 'pan' && !isDraggingAnnotation ? 'auto' : 'none',
                }}
                className={`absolute inset-0 z-10 ${
                  mode === 'highlight' || mode === 'text'
                    ? 'cursor-crosshair'
                    : mode === 'select'
                    ? 'cursor-default'
                    : 'cursor-grab'
                }`}
              >
                {/* Render Highlights for Current Page */}
                {currentPageAnnotations
                  .filter((a) => a.type === 'highlight')
                  .map((ann) => {
                    const isSelected = selectedAnnotationId === ann.id && mode === 'select'
                    const col = HIGHLIGHT_COLORS[ann.colorKey] || HIGHLIGHT_COLORS.yellow
                    const left = Math.min(ann.u1, ann.u2) * 100
                    const top = Math.min(ann.v1, ann.v2) * 100
                    const width = Math.abs(ann.u2 - ann.u1) * 100
                    const height = Math.abs(ann.v2 - ann.v1) * 100

                    return (
                      <div
                        key={ann.id}
                        onPointerDown={(e) => handleItemPointerDown(e, ann)}
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          width: `${width}%`,
                          height: `${height}%`,
                          backgroundColor: col.hex,
                        }}
                        className={`absolute opacity-50 transition-all ${
                          isSelected
                            ? 'ring-2 ring-blue-600 ring-offset-1 opacity-70 cursor-move z-20'
                            : mode === 'select'
                            ? 'hover:opacity-75 cursor-pointer'
                            : 'pointer-events-none'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute -top-10 left-0 bg-white/95 rounded-lg shadow-md border border-slate-200 p-1 flex items-center gap-1 z-30">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteAnnotation(ann.id)
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded min-h-[36px] min-w-[36px] flex items-center justify-center"
                              title="ลบไฮไลต์นี้"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}

                {/* Render Active Highlight Draft while dragging */}
                {highlightDraft && (
                  <div
                    style={{
                      left: `${Math.min(highlightDraft.u1, highlightDraft.u2) * 100}%`,
                      top: `${Math.min(highlightDraft.v1, highlightDraft.v2) * 100}%`,
                      width: `${Math.abs(highlightDraft.u2 - highlightDraft.u1) * 100}%`,
                      height: `${Math.abs(highlightDraft.v2 - highlightDraft.v1) * 100}%`,
                      backgroundColor:
                        HIGHLIGHT_COLORS[highlightDraft.colorKey]?.hex || '#fef08a',
                    }}
                    className="absolute opacity-50 border border-blue-400 pointer-events-none z-20"
                  />
                )}

                {/* Render Text Annotations for Current Page */}
                {currentPageAnnotations
                  .filter((a) => a.type === 'text')
                  .map((ann) => {
                    const isSelected = selectedAnnotationId === ann.id && mode === 'select'
                    const col = TEXT_COLORS[ann.colorKey] || TEXT_COLORS.black
                    const displayFontSize = Math.max(
                      11,
                      (ann.fontSize / 595) * canvasDimensions.width
                    )

                    return (
                      <div
                        key={ann.id}
                        onPointerDown={(e) => handleItemPointerDown(e, ann)}
                        onDoubleClick={() => handleOpenEditTextModal(ann)}
                        style={{
                          left: `${ann.u * 100}%`,
                          top: `${ann.v * 100}%`,
                          color: col.hex,
                          fontSize: `${displayFontSize}px`,
                          lineHeight: 1.3,
                        }}
                        className={`absolute max-w-[85%] px-1.5 py-0.5 rounded bg-white/90 shadow-xs border whitespace-pre-wrap break-words select-none z-20 ${
                          isSelected
                            ? 'ring-2 ring-blue-600 border-blue-600 bg-white shadow-md cursor-move'
                            : mode === 'select'
                            ? 'border-slate-300 hover:border-blue-400 cursor-pointer'
                            : 'border-transparent pointer-events-none'
                        }`}
                      >
                        {ann.text}

                        {isSelected && (
                          <div className="absolute -top-11 left-0 bg-white/95 rounded-lg shadow-md border border-slate-200 p-1 flex items-center gap-1 z-30">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenEditTextModal(ann)
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded min-h-[36px] min-w-[36px] flex items-center justify-center text-xs font-semibold gap-1"
                              title="แก้ไขข้อความ"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>แก้ไข</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteAnnotation(ann.id)
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded min-h-[36px] min-w-[36px] flex items-center justify-center"
                              title="ลบข้อความนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          {/* Annotations List Accordion / Summary */}
          {annotations.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center justify-between">
                <span>รายการข้อความและไฮไลต์ ({annotations.length})</span>
                <span className="text-xs text-slate-500 font-normal">
                  แตะที่รายการเพื่อกระโดดไปยังหน้านั้น
                </span>
              </h2>

              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {annotations.map((ann) => (
                  <div
                    key={ann.id}
                    className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 rounded-lg text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => goToPage(ann.pageNumber)}
                      className="flex items-center gap-2.5 text-left flex-1"
                    >
                      <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        หน้า {ann.pageNumber}
                      </span>
                      {ann.type === 'highlight' ? (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor:
                                HIGHLIGHT_COLORS[ann.colorKey]?.hex || '#fef08a',
                            }}
                          />
                          <span>ไฮไลต์ ({HIGHLIGHT_COLORS[ann.colorKey]?.name})</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-800 font-medium truncate max-w-[200px] sm:max-w-md">
                          <Type className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{ann.text}</span>
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteAnnotation(ann.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
                      title="ลบรายการนี้"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Text Entry & Edit Dialog (Mobile Keyboard Friendly) */}
      {textModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                {textModal.mode === 'create' ? 'พิมพ์ข้อความบนเอกสาร' : 'แก้ไขข้อความ'}
              </h2>
              <button
                type="button"
                onClick={() => setTextModal((prev) => ({ ...prev, isOpen: false }))}
                className="p-1 text-slate-400 hover:text-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              autoFocus
              rows={3}
              value={textModal.text}
              onChange={(e) =>
                setTextModal((prev) => ({ ...prev, text: e.target.value }))
              }
              placeholder="พิมพ์ข้อความภาษาไทยหรืออังกฤษ..."
              className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 leading-relaxed resize-none"
            />

            {/* Color & Size Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-600">สี:</span>
                {Object.values(TEXT_COLORS).map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() =>
                      setTextModal((prev) => ({ ...prev, colorKey: col.id }))
                    }
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      textModal.colorKey === col.id
                        ? 'ring-2 ring-offset-2 ring-blue-600 scale-105'
                        : ''
                    }`}
                    style={{ backgroundColor: col.hex }}
                    title={col.name}
                  >
                    {textModal.colorKey === col.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-600">ขนาด:</span>
                {FONT_SIZES.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() =>
                      setTextModal((prev) => ({ ...prev, fontSize: sz }))
                    }
                    className={`px-2 py-1 rounded text-xs font-semibold min-h-[36px] ${
                      textModal.fontSize === sz
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setTextModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px]"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveTextModal}
                disabled={!textModal.text.trim()}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl min-h-[44px] shadow-sm disabled:opacity-50"
              >
                {textModal.mode === 'create' ? 'วางข้อความ' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Clear All */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 p-5 space-y-3">
            <h2 className="text-base font-bold text-slate-900">ยืนยันการล้างทั้งหมด</h2>
            <p className="text-xs sm:text-sm text-slate-600">
              ต้องการลบข้อความและไฮไลต์ทั้งหมดออกจากทุกหน้าหรือไม่? (สามารถกดย้อนกลับ Undo ได้)
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px]"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl min-h-[44px]"
              >
                ล้างทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <LoadingIndicator message={loadingMessage} />
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        type={toast.type}
        message={toast.message}
        onClose={() => setToast({ type: 'info', message: '' })}
      />
    </div>
  )
}
