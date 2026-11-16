import { useState } from 'react'
import {
  LayoutGrid,
  RotateCw,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Download,
  Loader2,
  CheckCircle,
  RefreshCw,
} from 'lucide-react'
import Dropzone from '../ui/Dropzone'
import { loadPdfPagesForOrganize, saveOrganizedPdf } from '../../services/pdfService'
import { downloadFile } from '../../utils/fileUtils'

export default function OrganizeTool() {
  const [originalBuffer, setOriginalBuffer] = useState(null)
  const [fileName, setFileName] = useState('')
  const [pages, setPages] = useState([])
  const [loadingProgress, setLoadingProgress] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [downloadReady, setDownloadReady] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const handleFileSelected = async ([file]) => {
    if (!file) return
    setErrorMessage('')
    setDownloadReady(null)
    setIsProcessing(true)
    setFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()
      setOriginalBuffer(buffer)

      const loadedPages = await loadPdfPagesForOrganize(buffer, (percent) => {
        setLoadingProgress(percent)
      })

      setPages(loadedPages)
    } catch (err) {
      console.error(err)
      setErrorMessage('ไม่สามารถอ่านไฟล์ PDF ได้: ' + err.message)
    } finally {
      setIsProcessing(false)
      setLoadingProgress(null)
    }
  }

  // Rotate individual page by delta degrees (+90 or -90)
  const rotatePage = (index, delta) => {
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

  // Rotate all pages by 90 degrees
  const rotateAllPages = () => {
    setPages((prev) =>
      prev.map((page) => ({
        ...page,
        rotation: (page.rotation + 90) % 360,
      }))
    )
  }

  // Move page to left (earlier)
  const moveLeft = (index) => {
    if (index === 0) return
    setPages((prev) => {
      const next = [...prev]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp
      return next
    })
  }

  // Move page to right (later)
  const moveRight = (index) => {
    if (index === pages.length - 1) return
    setPages((prev) => {
      const next = [...prev]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp
      return next
    })
  }

  // Delete page from list
  const deletePage = (index) => {
    if (pages.length <= 1) {
      setErrorMessage('ไม่สามารถลบทุกหน้าได้ เอกสารต้องมีอย่างน้อย 1 หน้า')
      return
    }
    setPages((prev) => prev.filter((_, i) => i !== index))
  }

  // Save organized PDF
  const handleSave = async () => {
    if (!originalBuffer || pages.length === 0) return
    setIsSaving(true)
    setErrorMessage('')
    setDownloadReady(null)

    try {
      const pageConfigs = pages.map((p) => ({
        originalIndex: p.originalIndex,
        rotation: p.rotation,
      }))

      const modifiedBytes = await saveOrganizedPdf(originalBuffer, pageConfigs)
      setDownloadReady({
        bytes: modifiedBytes,
        name: `organized_${fileName}`,
      })
    } catch (err) {
      console.error(err)
      setErrorMessage('เกิดข้อผิดพลาดในการบันทึก: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-blue-600" />
          จัดระเบียบหน้า PDF (Organize)
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          หมุนหน้าเอกสาร สลับลำดับหน้า ลบหน้าที่ไม่ต้องการ หรือจัดระเบียบใหม่ทั้งหมด
        </p>
      </div>

      {/* Upload Dropzone */}
      {!originalBuffer && (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="แตะเพื่อเลือกไฟล์ PDF ที่ต้องการจัดหน้า"
          subtitle="ประมวลผลและสร้างรูปตัวอย่างบนเครื่องของคุณทั้งหมด"
          buttonText="เลือกไฟล์ PDF"
        />
      )}

      {/* Loading Progress */}
      {isProcessing && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="font-semibold text-slate-800 text-sm">กำลังสร้างรูปตัวอย่างแต่ละหน้า...</p>
          {loadingProgress !== null && (
            <p className="text-xs text-slate-500">ความคืบหน้า {loadingProgress}%</p>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Pages Workspace */}
      {pages.length > 0 && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-sm text-slate-800">
                เอกสาร: {fileName} ({pages.length} หน้า)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={rotateAllPages}
                className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 min-h-[38px]"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>หมุนทุกหน้า (+90°)</span>
              </button>

              <button
                onClick={() => {
                  setOriginalBuffer(null)
                  setPages([])
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 min-h-[38px]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>เปลี่ยนไฟล์ใหม่</span>
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-sm min-h-[38px] active:scale-95"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>บันทึกเป็น PDF ใหม่</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Page Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {pages.map((page, idx) => (
              <div
                key={page.id}
                className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                {/* Header & Badges */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    หน้า {idx + 1}
                  </span>
                  {page.rotation > 0 && (
                    <span className="text-[10px] text-amber-600 font-medium">
                      หมุน {page.rotation}°
                    </span>
                  )}
                </div>

                {/* Thumbnail Preview with Dynamic CSS Rotation */}
                <div className="relative aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-100">
                  <img
                    src={page.dataUrl}
                    alt={`หน้า ${idx + 1}`}
                    className="max-h-full max-w-full object-contain transition-transform duration-200"
                    style={{ transform: `rotate(${page.rotation}deg)` }}
                  />
                </div>

                {/* Controls */}
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => rotatePage(idx, -90)}
                      title="หมุนซ้าย"
                      className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => rotatePage(idx, 90)}
                      title="หมุนขวา"
                      className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => moveLeft(idx)}
                      disabled={idx === 0}
                      title="เลื่อนไปหน้า"
                      className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-20"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveRight(idx)}
                      disabled={idx === pages.length - 1}
                      title="เลื่อนไปหลัง"
                      className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-20"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deletePage(idx)}
                      title="ลบหน้านี้"
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Download Success Card */}
      {downloadReady && (
        <div className="p-4 sm:p-6 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900 text-sm">จัดหน้า PDF สำเร็จแล้ว!</p>
              <p className="text-xs text-emerald-700">ไฟล์พร้อมดาวน์โหลด: {downloadReady.name}</p>
            </div>
          </div>
          <button
            onClick={() => downloadFile(downloadReady.bytes, downloadReady.name)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>ดาวน์โหลด PDF ทันที</span>
          </button>
        </div>
      )}
    </div>
  )
}
