import { useState, useRef } from 'react'
import {
  MessageSquareQuote,
  Plus,
  Trash2,
  Download,
  Loader2,
  CheckCircle,
  MousePointerClick,
  RefreshCw,
} from 'lucide-react'
import Dropzone from '../ui/Dropzone'
import { renderPageThumbnail, addCommentsToPdf } from '../../services/pdfService'
import { downloadFile } from '../../utils/fileUtils'
import { PDFDocument } from 'pdf-lib'

export default function AddCommentsTool() {
  const [fileBuffer, setFileBuffer] = useState(null)
  const [fileName, setFileName] = useState('')
  const [numPages, setNumPages] = useState(1)
  const [selectedPageIndex, setSelectedPageIndex] = useState(0) // 0-based
  const [pagePreviewUrl, setPagePreviewUrl] = useState(null)

  // Current comment form input
  const [commentText, setCommentText] = useState('')
  const [clickCoords, setClickCoords] = useState({ xPercent: 50, yPercent: 10 })
  const [fontSize, setFontSize] = useState(16)
  const [textColor, setTextColor] = useState('#dc2626') // red default
  const [bgStyle, setBgStyle] = useState('yellow') // 'none' | 'yellow' | 'white' | 'light-red'

  // List of comments added
  const [comments, setComments] = useState([])

  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [downloadReady, setDownloadReady] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const previewContainerRef = useRef(null)

  const handleFileSelected = async ([file]) => {
    if (!file) return
    setErrorMessage('')
    setDownloadReady(null)
    setComments([])
    setFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()
      setFileBuffer(buffer)

      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
      const count = doc.getPageCount()
      setNumPages(count)
      setSelectedPageIndex(0)

      await loadPagePreview(buffer, 1)
    } catch (err) {
      console.error(err)
      setErrorMessage('ไม่สามารถอ่านไฟล์ PDF ได้: ' + err.message)
    }
  }

  // Load preview for selected page
  const loadPagePreview = async (buffer, pageNumber) => {
    setIsLoadingPage(true)
    try {
      const { dataUrl } = await renderPageThumbnail(buffer, pageNumber, 1.0)
      setPagePreviewUrl(dataUrl)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoadingPage(false)
    }
  }

  // When user switches page
  const handlePageChange = async (newIdx) => {
    setSelectedPageIndex(newIdx)
    if (fileBuffer) {
      await loadPagePreview(fileBuffer, newIdx + 1)
    }
  }

  // Handle clicking or tapping on the page preview to set X, Y
  const handlePreviewClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const xPercent = Math.max(5, Math.min(95, Math.round((x / rect.width) * 100)))
    const yPercent = Math.max(5, Math.min(95, Math.round((y / rect.height) * 100)))

    setClickCoords({ xPercent, yPercent })
  }

  // Quick placement presets
  const applyPreset = (preset) => {
    if (preset === 'top') setClickCoords({ xPercent: 10, yPercent: 5 })
    if (preset === 'center') setClickCoords({ xPercent: 30, yPercent: 50 })
    if (preset === 'bottom') setClickCoords({ xPercent: 10, yPercent: 92 })
  }

  // Add comment to list
  const handleAddComment = () => {
    if (!commentText.trim()) {
      setErrorMessage('กรุณาระบุข้อความที่ต้องการใส่')
      return
    }

    const newComment = {
      id: `c-${Date.now()}`,
      pageIndex: selectedPageIndex,
      text: commentText.trim(),
      xPercent: clickCoords.xPercent,
      yPercent: clickCoords.yPercent,
      fontSize: Number(fontSize),
      colorHex: textColor,
      bgStyle,
    }

    setComments((prev) => [...prev, newComment])
    setCommentText('')
    setErrorMessage('')
  }

  // Remove comment
  const handleRemoveComment = (id) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  // Save modified PDF with baked comments
  const handleSavePdf = async () => {
    if (comments.length === 0) {
      setErrorMessage('กรุณาเพิ่มข้อความหรือโน้ตอย่างน้อย 1 รายการ')
      return
    }

    setIsSaving(true)
    setErrorMessage('')
    setDownloadReady(null)

    try {
      const modifiedBytes = await addCommentsToPdf(fileBuffer, comments)
      setDownloadReady({
        bytes: modifiedBytes,
        name: `annotated_${fileName}`,
      })
    } catch (err) {
      console.error(err)
      setErrorMessage('เกิดข้อผิดพลาดในการบันทึกข้อความ: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <MessageSquareQuote className="w-5 h-5 text-blue-600" />
          ใส่ข้อความและโน้ตบน PDF (Add comments)
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          แตะบนหน้าเอกสารเพื่อกำหนดตำแหน่ง แล้วพิมพ์ข้อความหรือโน้ต เช่น &quot;อนุมัติแล้ว&quot; หรือ &quot;ฉบับร่าง&quot;
        </p>
      </div>

      {/* Upload Dropzone */}
      {!fileBuffer && (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="แตะเพื่อเลือกไฟล์ PDF ที่ต้องการใส่ข้อความ"
          subtitle="ประมวลผลบนเครื่อง 100% ไม่ส่งข้อมูลออกนอกอุปกรณ์"
          buttonText="เลือกไฟล์ PDF"
        />
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {fileBuffer && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Interactive Preview Canvas / Image (7 cols) */}
          <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                เลือกหน้า:
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={selectedPageIndex}
                  onChange={(e) => handlePageChange(Number(e.target.value))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-medium"
                >
                  {Array.from({ length: numPages }).map((_, i) => (
                    <option key={i} value={i}>
                      หน้าที่ {i + 1} จาก {numPages}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    setFileBuffer(null)
                    setComments([])
                  }}
                  className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs"
                  title="เปลี่ยนไฟล์ใหม่"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-2 bg-slate-50 rounded-xl text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
              <MousePointerClick className="w-3.5 h-3.5 text-blue-600" />
              <span>แตะหรือคลิกบนหน้าเอกสารด้านล่าง เพื่อเลือกตำแหน่งวางข้อความ</span>
            </div>

            {/* Clickable Page Canvas Container */}
            <div
              ref={previewContainerRef}
              onClick={handlePreviewClick}
              className="relative aspect-[1/1.414] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 cursor-crosshair select-none flex items-center justify-center"
            >
              {isLoadingPage ? (
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              ) : pagePreviewUrl ? (
                <>
                  <img
                    src={pagePreviewUrl}
                    alt="Page Preview"
                    className="w-full h-full object-contain pointer-events-none"
                  />

                  {/* Marker for Current Click Selection */}
                  <div
                    className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white bg-blue-600 shadow-md ring-2 ring-blue-400/50 animate-pulse pointer-events-none"
                    style={{
                      left: `${clickCoords.xPercent}%`,
                      top: `${clickCoords.yPercent}%`,
                    }}
                  />

                  {/* Render Existing Comments on this Page */}
                  {comments
                    .filter((c) => c.pageIndex === selectedPageIndex)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="absolute px-2 py-0.5 rounded text-xs font-semibold shadow-xs pointer-events-none"
                        style={{
                          left: `${c.xPercent}%`,
                          top: `${c.yPercent}%`,
                          color: c.colorHex,
                          backgroundColor:
                            c.bgStyle === 'yellow'
                              ? '#fef08a'
                              : c.bgStyle === 'white'
                              ? '#ffffff'
                              : c.bgStyle === 'light-red'
                              ? '#fee2e2'
                              : 'transparent',
                          fontSize: `${Math.max(10, c.fontSize * 0.75)}px`,
                        }}
                      >
                        {c.text}
                      </div>
                    ))}
                </>
              ) : null}
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              พิกัดปัจจุบัน: แนวนอน {clickCoords.xPercent}%, แนวตั้ง {clickCoords.yPercent}%
            </p>
          </div>

          {/* Form and Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
              <h3 className="font-semibold text-sm text-slate-800">
                กำหนดข้อความที่จะวาง
              </h3>

              {/* Text Input */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  ข้อความ / บันทึก (รองรับภาษาไทย):
                </label>
                <input
                  type="text"
                  placeholder="เช่น อนุมัติแล้ว, DRAFT, ตรวจสอบแล้ว"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Presets */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  ตำแหน่งสำเร็จรูป:
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <button
                    onClick={() => applyPreset('top')}
                    type="button"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    หัวกระดาษ
                  </button>
                  <button
                    onClick={() => applyPreset('center')}
                    type="button"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    กลางหน้า
                  </button>
                  <button
                    onClick={() => applyPreset('bottom')}
                    type="button"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
                  >
                    ท้ายกระดาษ
                  </button>
                </div>
              </div>

              {/* Styling Controls */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-600 mb-1">ขนาดตัวอักษร:</label>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="12">12 pt (เล็ก)</option>
                    <option value="16">16 pt (ปกติ)</option>
                    <option value="20">20 pt (ปานกลาง)</option>
                    <option value="26">26 pt (ใหญ่)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-600 mb-1">สีตัวอักษร:</label>
                  <div className="flex items-center gap-1.5 pt-1">
                    {[
                      { hex: '#dc2626', name: 'แดง' },
                      { hex: '#2563eb', name: 'น้ำเงิน' },
                      { hex: '#16a34a', name: 'เขียว' },
                      { hex: '#0f172a', name: 'ดำ' },
                    ].map((col) => (
                      <button
                        key={col.hex}
                        type="button"
                        onClick={() => setTextColor(col.hex)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          textColor === col.hex ? 'scale-115 border-slate-900 ring-2 ring-blue-300' : 'border-white'
                        }`}
                        style={{ backgroundColor: col.hex }}
                        title={col.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Background Highlight */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  แถบพื้นหลังไฮไลต์:
                </label>
                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  {[
                    { id: 'yellow', label: 'เหลือง' },
                    { id: 'light-red', label: 'แดงอ่อน' },
                    { id: 'white', label: 'ขาว' },
                    { id: 'none', label: 'ไม่มี' },
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setBgStyle(bg.id)}
                      className={`p-1.5 rounded-lg border text-center transition-colors ${
                        bgStyle === bg.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add Button */}
              <button
                type="button"
                onClick={handleAddComment}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-all min-h-[42px]"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มข้อความลงในหน้านี้</span>
              </button>
            </div>

            {/* List of comments */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
              <span className="font-semibold text-xs text-slate-700">
                รายการข้อความที่เพิ่ม ({comments.length} รายการ)
              </span>

              {comments.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">ยังไม่มีข้อความที่เพิ่ม</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-blue-600 mr-1.5">
                          หน้า {c.pageIndex + 1}
                        </span>
                        <span className="font-medium text-slate-800 truncate">{c.text}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveComment(c.id)}
                        className="p-1 rounded text-red-600 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Save PDF Action */}
              <button
                onClick={handleSavePdf}
                disabled={isSaving || comments.length === 0}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 min-h-[44px] transition-all"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>บันทึกและดาวน์โหลด PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Success Card */}
      {downloadReady && (
        <div className="p-4 sm:p-6 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900 text-sm">ใส่ข้อความใน PDF สำเร็จแล้ว!</p>
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
