import { useState } from 'react'
import {
  FilePlus,
  Image as ImageIcon,
  Type,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  Loader2,
  CheckCircle,
} from 'lucide-react'
import Dropzone from '../ui/Dropzone'
import { createPdfFromImages, createPdfFromText } from '../../services/pdfService'
import { downloadFile } from '../../utils/fileUtils'

export default function CreateTool() {
  const [mode, setMode] = useState('images') // 'images' | 'text'

  // Image mode states
  const [images, setImages] = useState([])
  const [pageSize, setPageSize] = useState('a4') // 'a4' | 'fit'
  const [orientation, setOrientation] = useState('auto') // 'auto' | 'portrait' | 'landscape'
  const [margin, setMargin] = useState(20)

  // Text mode states
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const [fontSize, setFontSize] = useState(14)

  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadReady, setDownloadReady] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  // Handle image files added
  const handleImagesAdded = (files) => {
    setErrorMessage('')
    setDownloadReady(null)

    const validImages = files.filter((f) => f.type.startsWith('image/'))
    if (validImages.length === 0) {
      setErrorMessage('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WebP) เท่านั้น')
      return
    }

    const newItems = validImages.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
    }))

    setImages((prev) => [...prev, ...newItems])
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
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  // Generate PDF from images
  const handleGenerateFromImages = async () => {
    if (images.length === 0) {
      setErrorMessage('กรุณาเลือกรูปภาพอย่างน้อย 1 รูป')
      return
    }

    setIsProcessing(true)
    setErrorMessage('')
    setDownloadReady(null)

    try {
      const rawFiles = images.map((img) => img.file)
      const pdfBytes = await createPdfFromImages(rawFiles, {
        pageSize,
        orientation,
        margin: parseInt(margin, 10),
      })

      setDownloadReady({
        bytes: pdfBytes,
        name: 'images_document.pdf',
      })
    } catch (err) {
      console.error(err)
      setErrorMessage('เกิดข้อผิดพลาดในการสร้าง PDF จากรูปภาพ: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  // Generate PDF from text
  const handleGenerateFromText = async () => {
    if (!textContent.trim() && !textTitle.trim()) {
      setErrorMessage('กรุณาระบุหัวข้อหรือเนื้อหาข้อความ')
      return
    }

    setIsProcessing(true)
    setErrorMessage('')
    setDownloadReady(null)

    try {
      const pdfBytes = await createPdfFromText(textTitle, textContent, {
        fontSize: parseInt(fontSize, 10),
      })

      const safeName = textTitle.trim()
        ? `${textTitle.trim().replace(/[^a-zA-Z0-9ก-๙_-]/g, '_')}.pdf`
        : 'text_document.pdf'

      setDownloadReady({
        bytes: pdfBytes,
        name: safeName,
      })
    } catch (err) {
      console.error(err)
      setErrorMessage('เกิดข้อผิดพลาดในการสร้าง PDF จากข้อความ: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <FilePlus className="w-5 h-5 text-blue-600" />
          สร้างเอกสาร PDF (Create)
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          สร้างไฟล์ PDF ใหม่ได้ทันที ทั้งจากการรวมรูปภาพ (เอกสารสแกน/สลิป) หรือการพิมพ์ข้อความ
        </p>

        {/* Mode Selector Tabs */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
          <button
            onClick={() => {
              setMode('images')
              setErrorMessage('')
              setDownloadReady(null)
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
              mode === 'images'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>สร้างจากรูปภาพ</span>
          </button>

          <button
            onClick={() => {
              setMode('text')
              setErrorMessage('')
              setDownloadReady(null)
            }}
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
              mode === 'text'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>สร้างจากข้อความ</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {/* MODE 1: From Images */}
      {mode === 'images' && (
        <div className="space-y-6">
          <Dropzone
            onFilesSelected={handleImagesAdded}
            accept="image/*"
            multiple={true}
            title="แตะเพื่อเลือกรูปภาพจากมือถือหรือคอมพิวเตอร์"
            subtitle="รองรับ JPG, PNG, WebP (เลือกหลายรูปพร้อมกันได้)"
            icon={ImageIcon}
            buttonText="เลือกรูปภาพ"
          />

          {images.length > 0 && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-700">
                  รูปภาพที่เลือก ({images.length} รูป)
                </span>
                <button
                  onClick={() => setImages([])}
                  className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50"
                >
                  ล้างทั้งหมด
                </button>
              </div>

              {/* Image List */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={img.id}
                    className="relative bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                        #{idx + 1}
                      </span>
                      <button
                        onClick={() => removeImage(idx)}
                        className="p-1 rounded text-red-600 hover:bg-red-50"
                        title="ลบรูป"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="aspect-[4/3] bg-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
                      <img
                        src={img.previewUrl}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <p className="text-[11px] font-medium text-slate-700 truncate mt-1">
                      {img.name}
                    </p>

                    <div className="flex items-center justify-center gap-2 mt-2 pt-1 border-t border-slate-200/60">
                      <button
                        onClick={() => moveImageUp(idx)}
                        disabled={idx === 0}
                        className="p-1 rounded text-slate-600 hover:bg-white disabled:opacity-20"
                        title="เลื่อนไปข้างหน้า"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveImageDown(idx)}
                        disabled={idx === images.length - 1}
                        className="p-1 rounded text-slate-600 hover:bg-white disabled:opacity-20"
                        title="เลื่อนไปข้างหลัง"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs">
                <div>
                  <label className="block font-medium text-slate-600 mb-1">ขนาดหน้ากระดาษ:</label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="a4">ขนาดมาตรฐาน A4</option>
                    <option value="fit">พอดีกับขนาดรูป (Fit Image)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">การจัดวาง:</label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="auto">อัตโนมัติตามรูป</option>
                    <option value="portrait">แนวตั้ง (Portrait)</option>
                    <option value="landscape">แนวนอน (Landscape)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">ระยะขอบ (Margin):</label>
                  <select
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="0">ไม่มีขอบ (0 pt)</option>
                    <option value="20">ขอบแคบ (20 pt)</option>
                    <option value="40">ขอบปกติ (40 pt)</option>
                  </select>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleGenerateFromImages}
                disabled={isProcessing || images.length === 0}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 min-h-[44px] transition-all"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังประมวลผลรูปเป็น PDF...</span>
                  </>
                ) : (
                  <>
                    <FilePlus className="w-4 h-4" />
                    <span>แปลง {images.length} รูปเป็นไฟล์ PDF</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: From Text */}
      {mode === 'text' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              หัวข้อเอกสาร (Title):
            </label>
            <input
              type="text"
              placeholder="เช่น บันทึกข้อความ, สรุปการประชุม, รายงานโครงงาน"
              value={textTitle}
              onChange={(e) => setTextTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">เนื้อหาข้อความ:</label>
              <span className="text-[11px] text-slate-400">
                {textContent.length} ตัวอักษร ({textContent.split(/\s+/).filter(Boolean).length} คำ)
              </span>
            </div>
            <textarea
              rows={8}
              placeholder="พิมพ์หรือวางข้อความที่นี่... รองรับภาษาไทยและภาษาอังกฤษ มีการตัดบรรทัดและขึ้นหน้าใหม่อัตโนมัติ"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="w-full p-3 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-slate-600">ขนาดตัวอักษร:</label>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="12">12 pt (เล็ก)</option>
                <option value="14">14 pt (ปกติ)</option>
                <option value="16">16 pt (ปานกลาง)</option>
                <option value="18">18 pt (ใหญ่)</option>
              </select>
            </div>

            <button
              onClick={handleGenerateFromText}
              disabled={isProcessing || (!textTitle.trim() && !textContent.trim())}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 min-h-[44px] transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังสร้าง PDF...</span>
                </>
              ) : (
                <>
                  <FilePlus className="w-4 h-4" />
                  <span>สร้างไฟล์ PDF</span>
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
              <p className="font-semibold text-emerald-900 text-sm">สร้างเอกสาร PDF สำเร็จ!</p>
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
