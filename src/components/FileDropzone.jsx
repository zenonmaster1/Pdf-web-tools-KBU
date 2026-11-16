import { useRef, useState } from 'react'
import { UploadCloud, FileUp, AlertTriangle } from 'lucide-react'
import { MAX_FILE_MB } from '../utils/constants'
import { formatBytes } from '../utils/download'

export default function FileDropzone({
  onFilesSelected,
  onError,
  accept = 'application/pdf',
  multiple = false,
  maxFileMb = MAX_FILE_MB,
  title = 'แตะหรือลากไฟล์มาวางที่นี่',
  subtitle = 'รองรับไฟล์ PDF (ประมวลผลบนเครื่องของคุณ)',
  buttonText = 'เลือกไฟล์จากอุปกรณ์',
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [sizeWarning, setSizeWarning] = useState('')
  const inputRef = useRef(null)

  const maxFileBytes = maxFileMb * 1024 * 1024

  const validateAndHandleFiles = (fileList) => {
    setSizeWarning('')
    const rawFiles = Array.from(fileList || [])
    if (rawFiles.length === 0) return

    const validFiles = []
    const oversizedFiles = []

    for (const file of rawFiles) {
      if (file.size > maxFileBytes) {
        oversizedFiles.push(file)
      } else {
        validFiles.push(file)
      }
    }

    if (oversizedFiles.length > 0) {
      const oversizedInfo = oversizedFiles
        .map((f) => `"${f.name}" (${formatBytes(f.size)})`)
        .join(', ')
      const msg = `ไฟล์ ${oversizedInfo} มีขนาดเกินกำหนดสูงสุด ${maxFileMb} MB ไม่อนุญาตให้ประมวลผล`
      setSizeWarning(msg)
      if (onError) onError(msg)
      // Do not process oversized files
      return
    }

    if (validFiles.length > 0) {
      onFilesSelected(multiple ? validFiles : [validFiles[0]])
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndHandleFiles(e.dataTransfer.files)
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndHandleFiles(e.target.files)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all duration-150 select-none ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
            : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
              isDragOver ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
            }`}
          >
            <UploadCloud className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-800">{title}</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">{subtitle}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">ขนาดไฟล์สูงสุด {maxFileMb} MB ต่อไฟล์</p>
          </div>

          {/* Touch-friendly button: minimum 44px height */}
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors min-h-[44px] active:scale-95"
          >
            <FileUp className="w-4 h-4" />
            <span>{buttonText}</span>
          </button>
        </div>
      </div>

      {sizeWarning && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span>{sizeWarning}</span>
        </div>
      )}
    </div>
  )
}
