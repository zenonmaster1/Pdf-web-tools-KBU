import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Files,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  GripVertical,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import FileDropzone from '../../components/FileDropzone'
import Toast from '../../components/Toast'
import LoadingIndicator from '../../components/LoadingIndicator'
import { downloadFile, formatBytes } from '../../utils/download'
import { MAX_FILE_MB } from '../../utils/constants'

export default function CombineTool() {
  const [files, setFiles] = useState([])
  const [isReadingFiles, setIsReadingFiles] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [mergeResult, setMergeResult] = useState(null)
  const [toast, setToast] = useState(null)

  // Drag and drop state for desktop
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  // Generate unique ID without crypto.randomUUID
  const createUniqueId = () => `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

  // Handle files selected from dropzone (sequential processing to save mobile memory)
  const handleFilesAdded = async (newRawFiles) => {
    setIsReadingFiles(true)
    const validAddedItems = []

    for (const file of newRawFiles) {
      // 1. Verify file extension
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'
      if (!isPdf) {
        setToast({
          type: 'error',
          message: `ไฟล์ "${file.name}" ไม่ใช่ไฟล์ PDF (รับเฉพาะ .pdf เท่านั้น)`,
        })
        continue
      }

      // 2. Read arrayBuffer one-by-one to inspect validity and page count
      try {
        const buffer = await file.arrayBuffer()
        // Do not ignore encryption, so password protected files are properly detected
        const doc = await PDFDocument.load(buffer, { ignoreEncryption: false })
        const pageCount = doc.getPageCount()

        if (pageCount === 0) {
          setToast({
            type: 'error',
            message: `ไฟล์ "${file.name}" ไม่มีหน้าเอกสาร`,
          })
          continue
        }

        validAddedItems.push({
          id: createUniqueId(),
          file,
          name: file.name,
          size: file.size,
          pageCount,
        })
      } catch (err) {
        const errMsg = err?.message?.toLowerCase() || ''
        if (errMsg.includes('encrypted') || errMsg.includes('password')) {
          setToast({
            type: 'error',
            message: `ไฟล์ "${file.name}" มีรหัสผ่าน ไม่สามารถรวมได้`,
          })
        } else {
          setToast({
            type: 'error',
            message: `ไฟล์ "${file.name}" เสียหายหรือไม่สามารถอ่านได้`,
          })
        }
      }
    }

    if (validAddedItems.length > 0) {
      setFiles((prev) => [...prev, ...validAddedItems])
      setMergeResult(null)
    }

    setIsReadingFiles(false)
  }

  // Move file up in list
  const moveUp = (index) => {
    if (index === 0) return
    setFiles((prev) => {
      const next = [...prev]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp
      return next
    })
    setMergeResult(null)
  }

  // Move file down in list
  const moveDown = (index) => {
    if (index === files.length - 1) return
    setFiles((prev) => {
      const next = [...prev]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp
      return next
    })
    setMergeResult(null)
  }

  // Remove individual file
  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setMergeResult(null)
  }

  // Clear all files
  const handleClearAll = () => {
    setFiles([])
    setMergeResult(null)
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

    setFiles((prev) => {
      const updated = [...prev]
      const [movedItem] = updated.splice(draggedIndex, 1)
      updated.splice(targetIndex, 0, movedItem)
      return updated
    })
    setMergeResult(null)
    handleDragEnd()
  }

  // Merge files sequentially using pdf-lib
  const handleMerge = async () => {
    if (files.length < 2) return

    // Verify total size does not exceed MAX_FILE_MB * 2
    const totalBytes = files.reduce((acc, f) => acc + f.size, 0)
    const maxCombinedBytes = MAX_FILE_MB * 2 * 1024 * 1024

    if (totalBytes > maxCombinedBytes) {
      setToast({
        type: 'error',
        message: `ขนาดไฟล์รวมทั้งหมด (${formatBytes(totalBytes)}) เกินกำหนดสูงสุด ${MAX_FILE_MB * 2} MB กรุณาลดจำนวนหรือขนาดไฟล์ก่อนรวม`,
      })
      return
    }

    setIsProcessing(true)
    setMergeResult(null)

    try {
      const mergedDoc = await PDFDocument.create()
      let totalMergedPages = 0

      // Process each file one-by-one to prevent mobile memory exhaustion
      for (let i = 0; i < files.length; i++) {
        const item = files[i]
        const buffer = await item.file.arrayBuffer()
        const doc = await PDFDocument.load(buffer, { ignoreEncryption: false })
        const pageIndices = doc.getPageIndices()
        const copiedPages = await mergedDoc.copyPages(doc, pageIndices)

        copiedPages.forEach((page) => mergedDoc.addPage(page))
        totalMergedPages += copiedPages.length
      }

      const mergedPdfBytes = await mergedDoc.save()

      setMergeResult({
        bytes: mergedPdfBytes,
        pageCount: totalMergedPages,
        fileSize: mergedPdfBytes.length,
      })

      setToast({
        type: 'success',
        message: `รวมไฟล์สำเร็จเรียบร้อย (${totalMergedPages} หน้า)`,
      })
    } catch (err) {
      console.error('PDF Merge Error:', err)
      const msg = err?.message?.toLowerCase() || ''
      if (msg.includes('encrypted') || msg.includes('password')) {
        setToast({
          type: 'error',
          message: 'พบไฟล์ที่มีรหัสผ่าน ไม่สามารถรวมเอกสารได้',
        })
      } else {
        setToast({
          type: 'error',
          message: `เกิดข้อผิดพลาดในการรวมไฟล์: ${err.message || 'ไม่สามารถประมวลผลได้'}`,
        })
      }
    } finally {
      setIsProcessing(false)
    }
  }

  // Trigger download of merged.pdf
  const handleDownload = () => {
    if (!mergeResult?.bytes) return
    downloadFile(mergeResult.bytes, 'merged.pdf', 'application/pdf')
  }

  const totalSelectedPages = files.reduce((acc, f) => acc + f.pageCount, 0)
  const totalSelectedSize = files.reduce((acc, f) => acc + f.size, 0)

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
            <Files className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">
              ผสานไฟล์ PDF (Combine)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              รวมไฟล์ PDF หลายไฟล์เป็นไฟล์เดียว จัดเรียงลำดับเอกสารได้ตามต้องการ
            </p>
          </div>
        </div>
      </div>

      {/* Upload Dropzone */}
      <FileDropzone
        onFilesSelected={handleFilesAdded}
        onError={(msg) => setToast({ type: 'error', message: msg })}
        accept=".pdf,application/pdf"
        multiple={true}
        title="แตะหรือลากไฟล์ PDF มาวางที่นี่"
        subtitle="เลือกไฟล์ PDF หลายไฟล์เพื่อนำมารวมกัน (เลือกเพิ่มทีหลังได้)"
        buttonText="เลือกไฟล์ PDF"
      />

      {/* Loading state during file inspection */}
      {isReadingFiles && (
        <LoadingIndicator
          message="กำลังอ่านและตรวจสอบหน้าเอกสาร..."
          subMessage="ประมวลผลทีละไฟล์บนอุปกรณ์ของคุณ"
        />
      )}

      {/* File List & Reorder Section */}
      {files.length > 0 && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
          {/* List Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <span className="font-bold text-sm text-slate-800">
                รายการไฟล์ ({files.length} ไฟล์)
              </span>
              <span className="text-xs text-slate-500 ml-2">
                รวม {totalSelectedPages} หน้า ({formatBytes(totalSelectedSize)})
              </span>
            </div>

            <button
              onClick={handleClearAll}
              className="min-h-[44px] px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl font-medium flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ล้างทั้งหมด</span>
            </button>
          </div>

          {/* Files Draggable / Sortable List */}
          <div className="space-y-2.5">
            {files.map((item, idx) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, idx)}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition-all gap-3 ${
                  dragOverIndex === idx
                    ? 'border-blue-500 bg-blue-50/70 scale-[1.01]'
                    : 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-200'
                }`}
              >
                {/* File info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Grip Icon for PC */}
                  <div
                    className="hidden sm:flex text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing p-1"
                    title="ลากเพื่อสลับลำดับ"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Order Number Badge */}
                  <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>

                  {/* File Metadata */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate" title={item.name}>
                      {item.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-200/70 font-medium text-slate-700">
                        {item.pageCount} หน้า
                      </span>
                      <span>•</span>
                      <span>{formatBytes(item.size)}</span>
                    </div>
                  </div>
                </div>

                {/* Touch-Friendly Action Buttons (min 44x44px touch target) */}
                <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    title="เลื่อนขึ้น"
                    aria-label="เลื่อนขึ้น"
                    className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white border border-slate-200/80 disabled:opacity-25 disabled:pointer-events-none flex items-center justify-center transition-colors shadow-2xs"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === files.length - 1}
                    title="เลื่อนลง"
                    aria-label="เลื่อนลง"
                    className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-white border border-slate-200/80 disabled:opacity-25 disabled:pointer-events-none flex items-center justify-center transition-colors shadow-2xs"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => removeFile(idx)}
                    title="ลบไฟล์นี้ออก"
                    aria-label="ลบไฟล์นี้ออก"
                    className="min-h-[44px] min-w-[44px] p-2 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 border border-slate-200/80 flex items-center justify-center transition-colors shadow-2xs"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Merge Action Button */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500 text-center sm:text-left">
              {files.length < 2
                ? 'กรุณาเพิ่มไฟล์ PDF อย่างน้อย 2 ไฟล์เพื่อเริ่มรวม'
                : `พร้อมรวม ${files.length} ไฟล์ (${totalSelectedPages} หน้า)`}
            </p>

            <button
              onClick={handleMerge}
              disabled={files.length < 2 || isProcessing}
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-98"
            >
              <Files className="w-4 h-4" />
              <span>รวมไฟล์ PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* Processing State during merge */}
      {isProcessing && (
        <LoadingIndicator
          message="กำลังรวมเอกสาร PDF..."
          subMessage="ประมวลผลทีละไฟล์ในหน่วยความจำของอุปกรณ์"
        />
      )}

      {/* Success Result & Download Banner */}
      {mergeResult && (
        <div className="p-5 sm:p-6 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-emerald-950 text-base flex items-center gap-2">
                รวมไฟล์สำเร็จเรียบร้อย!
              </p>
              <p className="text-xs text-emerald-800 mt-0.5">
                เอกสารผลลัพธ์มีจำนวนทั้งหมด <strong className="font-semibold">{mergeResult.pageCount} หน้า</strong> ({formatBytes(mergeResult.fileSize)})
              </p>
            </div>
          </div>

          <button
            onClick={handleDownload}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>ดาวน์โหลด merged.pdf</span>
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
