import { useState } from 'react'
import {
  Files,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  Loader2,
  CheckCircle,
} from 'lucide-react'
import Dropzone from '../ui/Dropzone'
import { mergePdfBuffers } from '../../services/pdfService'
import { formatBytes, downloadFile } from '../../utils/fileUtils'

export default function CombineTool() {
  const [files, setFiles] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadReady, setDownloadReady] = useState(null)
  const [customName, setCustomName] = useState('combined_document.pdf')
  const [errorMessage, setErrorMessage] = useState('')

  const handleFilesAdded = async (newFiles) => {
    setErrorMessage('')
    setDownloadReady(null)

    const pdfFiles = newFiles.filter((f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (pdfFiles.length === 0) {
      setErrorMessage('กรุณาเลือกไฟล์ PDF เท่านั้น')
      return
    }

    const items = await Promise.all(
      pdfFiles.map(async (file) => {
        const buffer = await file.arrayBuffer()
        return {
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          name: file.name,
          size: file.size,
          buffer,
        }
      })
    )

    setFiles((prev) => [...prev, ...items])
  }

  const moveUp = (index) => {
    if (index === 0) return
    setFiles((prev) => {
      const next = [...prev]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const moveDown = (index) => {
    if (index === files.length - 1) return
    setFiles((prev) => {
      const next = [...prev]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleMerge = async () => {
    if (files.length < 2) {
      setErrorMessage('กรุณาเพิ่มไฟล์ PDF อย่างน้อย 2 ไฟล์เพื่อผสาน')
      return
    }

    setIsProcessing(true)
    setErrorMessage('')
    setDownloadReady(null)

    try {
      const mergedBytes = await mergePdfBuffers(files)
      setDownloadReady({
        bytes: mergedBytes,
        name: customName.endsWith('.pdf') ? customName : `${customName}.pdf`,
      })
    } catch (err) {
      console.error(err)
      setErrorMessage('เกิดข้อผิดพลาดในการรวมไฟล์: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!downloadReady) return
    downloadFile(downloadReady.bytes, downloadReady.name)
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Files className="w-5 h-5 text-blue-600" />
          ผสานไฟล์ PDF (Combine)
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          รวมไฟล์ PDF หลายไฟล์ให้เป็นไฟล์เดียว จัดเรียงลำดับไฟล์ตามต้องการได้ทันที
        </p>
      </div>

      {/* Upload Dropzone */}
      <Dropzone
        onFilesSelected={handleFilesAdded}
        multiple={true}
        title="แตะเพื่อเลือกไฟล์ PDF หลายไฟล์"
        subtitle="หรือลากไฟล์ PDF มาวางที่นี่ (เรียงตามลำดับที่เลือก)"
        buttonText="เพิ่มไฟล์ PDF"
      />

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-slate-700">
              รายการไฟล์ทั้งหมด ({files.length} ไฟล์)
            </span>
            <button
              onClick={() => setFiles([])}
              className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50"
            >
              ล้างทั้งหมด
            </button>
          </div>

          <div className="space-y-2">
            {files.map((file, idx) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/60 transition-colors gap-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                  </div>
                </div>

                {/* Touch-friendly Action Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    title="เลื่อนขึ้น"
                    className="p-2 rounded-lg text-slate-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === files.length - 1}
                    title="เลื่อนลง"
                    className="p-2 rounded-lg text-slate-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeFile(idx)}
                    title="ลบไฟล์นี้"
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Merge Settings & Actions */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                ชื่อไฟล์เมื่อบันทึก:
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <button
              onClick={handleMerge}
              disabled={isProcessing || files.length < 2}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 min-h-[44px] active:scale-98 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังผสานไฟล์...</span>
                </>
              ) : (
                <>
                  <Files className="w-4 h-4" />
                  <span>เริ่มผสาน {files.length} ไฟล์</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Download Success Card */}
      {downloadReady && (
        <div className="p-4 sm:p-6 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900 text-sm">ผสานไฟล์สำเร็จเรียบร้อย!</p>
              <p className="text-xs text-emerald-700">ไฟล์พร้อมดาวน์โหลด: {downloadReady.name}</p>
            </div>
          </div>
          <button
            onClick={handleDownload}
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
