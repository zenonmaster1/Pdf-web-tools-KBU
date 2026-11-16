import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutGrid,
  ArrowLeft,
  RotateCw,
  RotateCcw,
  ArrowLeft as MoveLeftIcon,
  ArrowRight as MoveRightIcon,
  Trash2,
  Undo2,
  Download,
  RotateCcw as ResetIcon,
  RefreshCw,
  Loader2,
  GripVertical,
} from 'lucide-react'
import { PDFDocument, degrees } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

import FileDropzone from '../../components/FileDropzone'
import Toast from '../../components/Toast'
import LoadingIndicator from '../../components/LoadingIndicator'
import { downloadFile, formatBytes } from '../../utils/download'
import { MAX_PAGES } from '../../utils/constants'

// Ensure worker is configured for legacy build
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

/**
 * Sub-component for individual page thumbnail card with IntersectionObserver lazy loading
 */
function PageThumbnailCard({
  item,
  index,
  totalCount,
  onRotate,
  onDeleteToggle,
  onMove,
  enqueueThumbnailRender,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}) {
  const containerRef = useRef(null)
  const [thumbnailUrl, setThumbnailUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Use IntersectionObserver to lazy load thumbnail only when near viewport
  useEffect(() => {
    let isMounted = true
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting) {
          enqueueThumbnailRender(item.originalPageNumber, (url) => {
            if (isMounted) {
              setThumbnailUrl(url)
              setIsLoading(false)
            }
          })
          observer.disconnect()
        }
      },
      { rootMargin: '250px' }
    )

    observer.observe(el)

    return () => {
      isMounted = false
      observer.disconnect()
    }
  }, [item.originalPageNumber, enqueueThumbnailRender])

  return (
    <div
      ref={containerRef}
      draggable={!item.isDeleted}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop(e, index)}
      className={`bg-white rounded-2xl border p-3 flex flex-col justify-between transition-all select-none shadow-2xs ${
        item.isDeleted
          ? 'opacity-45 grayscale bg-slate-100 border-dashed border-red-300'
          : dragOverIndex === index
          ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
          : 'border-slate-200 hover:border-blue-300'
      }`}
    >
      {/* Top Card Badge: Page number & Status */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="hidden sm:inline-block text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing"
            title="ลากเพื่อสลับลำดับ"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-md ${
              item.isDeleted
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-50 text-blue-700'
            }`}
          >
            {item.isDeleted ? 'ถูกลบ' : `หน้า ${index + 1}`}
          </span>
        </div>

        {item.rotation > 0 && !item.isDeleted && (
          <span className="text-[10px] text-amber-600 font-semibold px-1.5 py-0.5 bg-amber-50 rounded">
            +{item.rotation}°
          </span>
        )}
      </div>

      {/* Thumbnail Canvas / Image Area (~160px width) */}
      <div className="relative aspect-[1/1.414] bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center p-1 border border-slate-100/80">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-[10px]">กำลังวาด...</span>
          </div>
        ) : thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`หน้า ${index + 1}`}
            className="max-h-full max-w-full object-contain transition-transform duration-200"
            style={{ transform: `rotate(${item.rotation}deg)` }}
          />
        ) : (
          <span className="text-xs text-slate-400">ไม่พบรูป</span>
        )}

        {item.isDeleted && (
          <div className="absolute inset-0 bg-red-900/10 backdrop-blur-[1px] flex items-center justify-center">
            <span className="text-xs font-bold text-red-700 px-2 py-1 bg-white/90 rounded-md shadow-2xs">
              หน้านี้จะไม่ถูกบันทึก
            </span>
          </div>
        )}
      </div>

      {/* Touch-Friendly Action Controls (At least 44px touch targets) */}
      <div className="mt-3 pt-2 border-t border-slate-100 space-y-1.5">
        {/* Row 1: Rotate & Delete/Restore */}
        <div className="flex items-center justify-between gap-1">
          <button
            onClick={() => onRotate(index, -90)}
            disabled={item.isDeleted}
            title="หมุนซ้าย 90°"
            aria-label="หมุนซ้าย 90 องศา"
            className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-20 flex items-center justify-center transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => onRotate(index, 90)}
            disabled={item.isDeleted}
            title="หมุนขวา 90°"
            aria-label="หมุนขวา 90 องศา"
            className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-20 flex items-center justify-center transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => onDeleteToggle(index)}
            title={item.isDeleted ? 'กู้คืนหน้านี้' : 'ลบหน้านี้'}
            aria-label={item.isDeleted ? 'กู้คืนหน้านี้' : 'ลบหน้านี้'}
            className={`min-h-[44px] min-w-[44px] p-2 rounded-xl flex items-center justify-center transition-colors ${
              item.isDeleted
                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                : 'text-red-600 hover:text-red-700 hover:bg-red-50'
            }`}
          >
            {item.isDeleted ? <Undo2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Row 2: Move Left / Move Right */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            title="เลื่อนไปซ้าย (หน้าก่อนหน้า)"
            aria-label="เลื่อนไปซ้าย"
            className="flex-1 min-h-[44px] px-2 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-20 flex items-center justify-center gap-1 text-xs font-medium"
          >
            <MoveLeftIcon className="w-3.5 h-3.5" />
            <span>ซ้าย</span>
          </button>

          <button
            onClick={() => onMove(index, 1)}
            disabled={index === totalCount - 1}
            title="เลื่อนไปขวา (หน้าถัดไป)"
            aria-label="เลื่อนไปขวา"
            className="flex-1 min-h-[44px] px-2 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-20 flex items-center justify-center gap-1 text-xs font-medium"
          >
            <span>ขวา</span>
            <MoveRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OrganizeTool() {
  const [fileBuffer, setFileBuffer] = useState(null)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [pdfDocProxy, setPdfDocProxy] = useState(null)

  const [pages, setPages] = useState([])
  const [initialPages, setInitialPages] = useState([])

  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // Drag-and-drop state for desktop
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  // Shared in-memory thumbnail cache (originalPageNumber -> dataUrl)
  const thumbnailCache = useRef(new Map())

  // Sequential render queue to ensure only ONE canvas renders at a time (protects mobile RAM)
  const renderQueue = useRef([])
  const isQueueProcessing = useRef(false)

  // Process render queue sequentially
  const processRenderQueue = useCallback(async () => {
    if (isQueueProcessing.current || renderQueue.current.length === 0 || !pdfDocProxy) return
    isQueueProcessing.current = true

    while (renderQueue.current.length > 0) {
      const job = renderQueue.current.shift()
      try {
        if (thumbnailCache.current.has(job.originalPageNumber)) {
          job.callback(thumbnailCache.current.get(job.originalPageNumber))
          continue
        }

        const page = await pdfDocProxy.getPage(job.originalPageNumber)
        const unscaledViewport = page.getViewport({ scale: 1.0 })
        // Target thumbnail width around 160px
        const scale = 160 / (unscaledViewport.width || 160)
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const ctx = canvas.getContext('2d')

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        await page.render({ canvasContext: ctx, viewport }).promise

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        thumbnailCache.current.set(job.originalPageNumber, dataUrl)
        job.callback(dataUrl)

        // Clean up page resources immediately to reclaim memory on mobile browsers
        if (typeof page.cleanup === 'function') {
          page.cleanup()
        }
      } catch (err) {
        console.warn(`Error rendering page ${job.originalPageNumber}:`, err)
      }
    }

    isQueueProcessing.current = false
  }, [pdfDocProxy])

  // Enqueue a page for thumbnail rendering
  const enqueueThumbnailRender = useCallback(
    (originalPageNumber, callback) => {
      if (thumbnailCache.current.has(originalPageNumber)) {
        callback(thumbnailCache.current.get(originalPageNumber))
        return
      }
      renderQueue.current.push({ originalPageNumber, callback })
      processRenderQueue()
    },
    [processRenderQueue]
  )

  // Handle single PDF file selection
  const handleFileSelected = async (fileList) => {
    const file = fileList[0]
    if (!file) return

    // Verify PDF file extension
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'
    if (!isPdf) {
      setToast({
        type: 'error',
        message: `ไฟล์ "${file.name}" ไม่ใช่ไฟล์ PDF (รับเฉพาะ .pdf เท่านั้น)`,
      })
      return
    }

    setIsLoadingFile(true)
    setToast(null)
    setFileName(file.name)
    setFileSize(file.size)

    try {
      const buffer = await file.arrayBuffer()
      setFileBuffer(buffer)

      // Test load with pdf-lib to check encryption and count pages
      let pdfDoc
      try {
        pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: false })
      } catch (docErr) {
        const errMsg = docErr?.message?.toLowerCase() || ''
        if (errMsg.includes('encrypted') || errMsg.includes('password')) {
          setToast({
            type: 'error',
            message: `ไฟล์ "${file.name}" มีรหัสผ่าน ไม่สามารถเปิดได้`,
          })
        } else {
          setToast({
            type: 'error',
            message: `ไฟล์ "${file.name}" เสียหายหรือไม่สามารถอ่านได้`,
          })
        }
        setIsLoadingFile(false)
        return
      }

      const count = pdfDoc.getPageCount()
      if (count === 0) {
        setToast({
          type: 'error',
          message: `ไฟล์ "${file.name}" ไม่มีหน้าเอกสาร`,
        })
        setIsLoadingFile(false)
        return
      }

      // Check max pages limit (MAX_PAGES = 100)
      if (count > MAX_PAGES) {
        setToast({
          type: 'error',
          message: `ไฟล์นี้มีจำนวน ${count} หน้า ซึ่งเกินขีดจำกัดสูงสุด ${MAX_PAGES} หน้าสำหรับการจัดหน้าบนเบราว์เซอร์`,
        })
        setIsLoadingFile(false)
        return
      }

      // Initialize pdfjs-dist proxy for thumbnail rendering
      const proxy = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise
      setPdfDocProxy(proxy)

      // Reset cache and build page items
      thumbnailCache.current.clear()
      const newItems = []
      for (let i = 1; i <= count; i++) {
        newItems.push({
          id: `page-${i}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          originalPageNumber: i,
          originalIndex: i - 1,
          rotation: 0,
          isDeleted: false,
        })
      }

      setPages(newItems)
      setInitialPages(newItems)
    } catch (err) {
      console.error('File load error:', err)
      setToast({
        type: 'error',
        message: `เกิดข้อผิดพลาดในการอ่านไฟล์: ${err.message || 'ไม่สามารถเปิดไฟล์ได้'}`,
      })
    } finally {
      setIsLoadingFile(false)
    }
  }

  // Rotate single page (+90 or -90)
  const handleRotatePage = (index, delta) => {
    setPages((prev) => {
      const next = [...prev]
      const current = next[index]
      next[index] = {
        ...current,
        rotation: (current.rotation + delta + 360) % 360,
      }
      return next
    })
  }

  // Rotate all non-deleted pages by 90 degrees clockwise
  const handleRotateAllRight = () => {
    setPages((prev) =>
      prev.map((p) =>
        p.isDeleted
          ? p
          : {
              ...p,
              rotation: (p.rotation + 90) % 360,
            }
      )
    )
  }

  // Toggle delete status of a page (soft delete)
  const handleDeleteToggle = (index) => {
    setPages((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        isDeleted: !next[index].isDeleted,
      }
      return next
    })
  }

  // Move page position by delta (-1 left, +1 right)
  const handleMovePage = (index, delta) => {
    const targetIndex = index + delta
    if (targetIndex < 0 || targetIndex >= pages.length) return

    setPages((prev) => {
      const next = [...prev]
      const temp = next[index]
      next[index] = next[targetIndex]
      next[targetIndex] = temp
      return next
    })
  }

  // Reset to initial state
  const handleReset = () => {
    if (initialPages.length === 0) return
    setPages(
      initialPages.map((p) => ({
        ...p,
        rotation: 0,
        isDeleted: false,
      }))
    )
    setToast({
      type: 'success',
      message: 'รีเซ็ตสถานะหน้าเอกสารกลับสู่ค่าเริ่มต้นแล้ว',
    })
  }

  // Clear current document and pick a new file
  const handleSwitchFile = () => {
    if (pdfDocProxy) {
      try {
        if (typeof pdfDocProxy.destroy === 'function') {
          pdfDocProxy.destroy()
        } else if (pdfDocProxy.loadingTask && typeof pdfDocProxy.loadingTask.destroy === 'function') {
          pdfDocProxy.loadingTask.destroy()
        } else if (typeof pdfDocProxy.cleanup === 'function') {
          pdfDocProxy.cleanup()
        }
      } catch (err) {
        console.warn('Non-critical cleanup warning in organize:', err)
      }
    }
    setFileBuffer(null)
    setFileName('')
    setFileSize(0)
    setPdfDocProxy(null)
    setPages([])
    setInitialPages([])
    thumbnailCache.current.clear()
    setToast(null)
  }

  // Desktop Drag and Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDrop = (e, targetIndex) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === targetIndex) {
      handleDragEnd()
      return
    }

    setPages((prev) => {
      const updated = [...prev]
      const [moved] = updated.splice(draggedIndex, 1)
      updated.splice(targetIndex, 0, moved)
      return updated
    })
    handleDragEnd()
  }

  // Save organized PDF using pdf-lib
  const handleSave = async () => {
    const activePages = pages.filter((p) => !p.isDeleted)

    // Validation: Cannot save if all pages are deleted
    if (activePages.length === 0) {
      setToast({
        type: 'error',
        message: 'ไม่สามารถบันทึกได้เนื่องจากทุกหน้าถูกลบ กรุณากู้คืนอย่างน้อย 1 หน้า',
      })
      return
    }

    setIsSaving(true)

    try {
      const srcDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: false })
      const newDoc = await PDFDocument.create()

      for (const p of activePages) {
        const [copiedPage] = await newDoc.copyPages(srcDoc, [p.originalIndex])
        // Add original page rotation to user rotation
        const originalAngle = copiedPage.getRotation().angle || 0
        const finalAngle = (originalAngle + p.rotation + 360) % 360
        copiedPage.setRotation(degrees(finalAngle))
        newDoc.addPage(copiedPage)
      }

      const savedBytes = await newDoc.save()
      downloadFile(savedBytes, 'organized.pdf', 'application/pdf')

      setToast({
        type: 'success',
        message: `บันทึกเอกสารใหม่สำเร็จเรียบร้อย (${activePages.length} หน้า)`,
      })
    } catch (err) {
      console.error('Save organized PDF error:', err)
      setToast({
        type: 'error',
        message: `เกิดข้อผิดพลาดในการบันทึก: ${err.message || 'ไม่สามารถสร้างไฟล์ใหม่ได้'}`,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const activePagesCount = pages.filter((p) => !p.isDeleted).length
  const deletedPagesCount = pages.filter((p) => p.isDeleted).length

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

      {/* Header Info */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              จัดหน้า PDF (Organize)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              หมุนหน้า สลับลำดับ และลบหน้าที่ไม่ต้องการ (จำกัดไม่เกิน {MAX_PAGES} หน้า)
            </p>
          </div>
        </div>
      </div>

      {/* File Dropzone (Shown when no file is loaded) */}
      {!fileBuffer && (
        <FileDropzone
          onFilesSelected={handleFileSelected}
          onError={(msg) => setToast({ type: 'error', message: msg })}
          accept=".pdf,application/pdf"
          multiple={false}
          title="แตะหรือลากไฟล์ PDF มาวางที่นี่"
          subtitle={`รองรับ 1 ไฟล์ (ขนาดสูงสุด 50 MB, ไม่เกิน ${MAX_PAGES} หน้า)`}
          buttonText="เลือกไฟล์ PDF"
        />
      )}

      {/* Loading state while reading file */}
      {isLoadingFile && (
        <LoadingIndicator
          message="กำลังอ่านเอกสาร PDF..."
          subMessage="ตรวจสอบความสมบูรณ์และจำนวนหน้าเอกสาร"
        />
      )}

      {/* Pages Workspace (Shown when file is loaded) */}
      {fileBuffer && pages.length > 0 && (
        <div className="space-y-4">
          {/* Action Toolbar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
            {/* Document summary info */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate" title={fileName}>
                  {fileName}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  ทั้งหมด {pages.length} หน้า ({formatBytes(fileSize)}) • เหลือบันทึก{' '}
                  <strong className="text-blue-700 font-semibold">{activePagesCount} หน้า</strong>
                  {deletedPagesCount > 0 && (
                    <span className="text-red-600 ml-1.5">(ถูกลบ {deletedPagesCount} หน้า)</span>
                  )}
                </p>
              </div>

              {/* Save PDF Action Button (Top) */}
              <button
                onClick={handleSave}
                disabled={isSaving || activePagesCount === 0}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 transition-all active:scale-98"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>บันทึก PDF ใหม่ ({activePagesCount} หน้า)</span>
                  </>
                )}
              </button>
            </div>

            {/* Batch Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleRotateAllRight}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <RotateCw className="w-4 h-4 text-blue-600" />
                  <span>หมุนทุกหน้าขวา (+90°)</span>
                </button>

                <button
                  onClick={handleReset}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <ResetIcon className="w-4 h-4 text-slate-500" />
                  <span>รีเซ็ต</span>
                </button>
              </div>

              <button
                onClick={handleSwitchFile}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>เปลี่ยนไฟล์ใหม่</span>
              </button>
            </div>
          </div>

          {/* Grid of Pages (2 columns on mobile, 3-4 on larger screens) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {pages.map((item, idx) => (
              <PageThumbnailCard
                key={item.id}
                item={item}
                index={idx}
                totalCount={pages.length}
                onRotate={handleRotatePage}
                onDeleteToggle={handleDeleteToggle}
                onMove={handleMovePage}
                enqueueThumbnailRender={enqueueThumbnailRender}
                dragOverIndex={dragOverIndex}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
              />
            ))}
          </div>

          {/* Bottom Save Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <span className="text-xs text-slate-500 text-center sm:text-left">
              พร้อมบันทึกเอกสารจำนวน {activePagesCount} หน้า (ดาวน์โหลดเป็นไฟล์ organized.pdf)
            </span>

            <button
              onClick={handleSave}
              disabled={isSaving || activePagesCount === 0}
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 transition-all active:scale-98"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>บันทึก PDF ใหม่</span>
                </>
              )}
            </button>
          </div>
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
