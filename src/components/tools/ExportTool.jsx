import { useState } from 'react'
import {
  Share2,
  Image as ImageIcon,
  FileText,
  Download,
  Copy,
  Check,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import Dropzone from '../ui/Dropzone'
import {
  exportPageToImage,
  exportPdfToText,
  loadPdfPagesForOrganize,
} from '../../services/pdfService'
import { downloadFile } from '../../utils/fileUtils'
import { copyTextToClipboard } from '../../utils/clipboard'

export default function ExportTool() {
  const [fileBuffer, setFileBuffer] = useState(null)
  const [fileName, setFileName] = useState('')
  const [mode, setMode] = useState('images') // 'images' | 'text'

  // Image mode states
  const [pages, setPages] = useState([])
  const [imageFormat, setImageFormat] = useState('png') // 'png' | 'jpeg'
  const [isExportingImage, setIsExportingImage] = useState(false)

  // Text mode states
  const [extractedText, setExtractedText] = useState('')
  const [isExtractingText, setIsExtractingText] = useState(false)
  const [hasCopied, setHasCopied] = useState(false)

  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleFileSelected = async ([file]) => {
    if (!file) return
    setErrorMessage('')
    setIsLoadingFile(true)
    setFileName(file.name)
    setExtractedText('')

    try {
      const buffer = await file.arrayBuffer()
      setFileBuffer(buffer)

      // Load page thumbnails for image export view
      const loadedPages = await loadPdfPagesForOrganize(buffer)
      setPages(loadedPages)
    } catch (err) {
      console.error(err)
      setErrorMessage('ไม่สามารถอ่านไฟล์ PDF ได้: ' + err.message)
    } finally {
      setIsLoadingFile(false)
    }
  }

  // Export single page image
  const handleExportSinglePage = async (pageNumber) => {
    if (!fileBuffer) return
    setIsExportingImage(true)
    try {
      const result = await exportPageToImage(fileBuffer, pageNumber, imageFormat, 2.0)
      const baseName = fileName.replace(/\.[^/.]+$/, '')
      downloadFile(result.blob, `${baseName}_page_${pageNumber}.${imageFormat}`, `image/${imageFormat}`)
    } catch (err) {
      console.error(err)
      setErrorMessage('เกิดข้อผิดพลาดในการแปลงรูปภาพ: ' + err.message)
    } finally {
      setIsExportingImage(false)
    }
  }

  // Export all pages sequentially as separate image downloads
  const handleExportAllPages = async () => {
    if (!fileBuffer || pages.length === 0) return
    setIsExportingImage(true)
    try {
      const baseName = fileName.replace(/\.[^/.]+$/, '')
      for (let i = 1; i <= pages.length; i++) {
        const result = await exportPageToImage(fileBuffer, i, imageFormat, 2.0)
        downloadFile(result.blob, `${baseName}_page_${i}.${imageFormat}`, `image/${imageFormat}`)
        // Delay slightly so mobile browsers can trigger consecutive downloads smoothly
        await new Promise((r) => setTimeout(r, 400))
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('เกิดข้อผิดพลาดในการแปลงรูป: ' + err.message)
    } finally {
      setIsExportingImage(false)
    }
  }

  // Extract all text
  const handleExtractText = async () => {
    if (!fileBuffer) return
    setIsExtractingText(true)
    setErrorMessage('')
    try {
      const text = await exportPdfToText(fileBuffer)
      setExtractedText(text)
    } catch (err) {
      console.error(err)
      setErrorMessage('เกิดข้อผิดพลาดในการดึงข้อความ: ' + err.message)
    } finally {
      setIsExtractingText(false)
    }
  }

  // Copy text to clipboard (HTTP and legacy mobile safe)
  const handleCopyText = async () => {
    if (!extractedText) return
    const success = await copyTextToClipboard(extractedText)
    if (success) {
      setHasCopied(true)
      setTimeout(() => setHasCopied(false), 2000)
    }
  }

  // Download text file
  const handleDownloadTextFile = () => {
    if (!extractedText) return
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' })
    const baseName = fileName.replace(/\.[^/.]+$/, '')
    downloadFile(blob, `${baseName}_extracted.txt`, 'text/plain')
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Share2 className="w-5 h-5 text-blue-600" />
          ส่งออกรูปภาพและข้อความ (Export)
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          แปลงหน้า PDF ให้เป็นไฟล์รูปภาพความละเอียดสูง หรือแยกข้อความทั้งหมดในเอกสารออกมาเป็นไฟล์ .txt
        </p>

        {fileBuffer && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={() => setMode('images')}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                mode === 'images'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>แปลงเป็นรูปภาพ</span>
            </button>

            <button
              onClick={() => {
                setMode('text')
                if (!extractedText) handleExtractText()
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                mode === 'text'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>ดึงข้อความ (.TXT)</span>
            </button>
          </div>
        )}
      </div>

      {/* Upload Dropzone */}
      {!fileBuffer && (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="แตะเพื่อเลือกไฟล์ PDF ที่ต้องการส่งออก"
          subtitle="ประมวลผลบนเครื่อง 100% ไม่ส่งข้อมูลออกนอกอุปกรณ์"
          buttonText="เลือกไฟล์ PDF"
        />
      )}

      {isLoadingFile && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="font-semibold text-slate-800 text-sm">กำลังโหลดหน้าเอกสาร...</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {/* EXPORT MODE 1: Images */}
      {fileBuffer && mode === 'images' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">รูปแบบรูปภาพ:</span>
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                <button
                  onClick={() => setImageFormat('png')}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                    imageFormat === 'png' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  PNG (คมชัดสูง)
                </button>
                <button
                  onClick={() => setImageFormat('jpeg')}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                    imageFormat === 'jpeg' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  JPEG (ขนาดกะทัดรัด)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setFileBuffer(null)
                  setPages([])
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 min-h-[38px]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>เปลี่ยนไฟล์</span>
              </button>

              <button
                onClick={handleExportAllPages}
                disabled={isExportingImage}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-sm min-h-[38px] active:scale-95 disabled:opacity-50"
              >
                {isExportingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังส่งออก...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดทุกหน้า ({pages.length} รูป)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Grid of Pages to download */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {pages.map((page, idx) => (
              <div
                key={page.id}
                className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    หน้า {idx + 1}
                  </span>
                </div>

                <div className="aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-100">
                  <img
                    src={page.dataUrl}
                    alt={`หน้า ${idx + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <button
                  onClick={() => handleExportSinglePage(idx + 1)}
                  disabled={isExportingImage}
                  className="mt-3 w-full py-2 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>บันทึกรูป ({imageFormat.toUpperCase()})</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXPORT MODE 2: Text */}
      {fileBuffer && mode === 'text' && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold text-sm text-slate-800">
              ข้อความที่ดึงได้จากเอกสาร ({fileName})
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyText}
                disabled={!extractedText || isExtractingText}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                {hasCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">คัดลอกแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>คัดลอกข้อความ</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadTextFile}
                disabled={!extractedText || isExtractingText}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลดไฟล์ .TXT</span>
              </button>
            </div>
          </div>

          {isExtractingText ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-sm font-medium text-slate-700">กำลังสกัดข้อความจากแต่ละหน้า...</p>
            </div>
          ) : (
            <textarea
              readOnly
              rows={12}
              value={extractedText}
              placeholder="ไม่พบข้อความ หรือข้อความในหน้านี้เป็นรูปภาพสแกน"
              className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs sm:text-sm text-slate-800 focus:outline-none"
            />
          )}
        </div>
      )}
    </div>
  )
}
