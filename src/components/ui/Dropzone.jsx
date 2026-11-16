import { useRef, useState } from 'react'
import { UploadCloud, FileUp } from 'lucide-react'

export default function Dropzone({
  onFilesSelected,
  accept = 'application/pdf',
  multiple = false,
  title = 'แตะหรือลากไฟล์มาวางที่นี่',
  subtitle = 'รองรับไฟล์ PDF (ประมวลผลบนเครื่องของคุณ)',
  icon: Icon = UploadCloud,
  buttonText = 'เลือกไฟล์จากอุปกรณ์',
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef(null)

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
      const files = Array.from(e.dataTransfer.files)
      onFilesSelected(multiple ? files : [files[0]])
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      onFilesSelected(multiple ? files : [files[0]])
      // Reset input value to allow selecting same file again if needed
      e.target.value = ''
    }
  }

  return (
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
          <Icon className="w-7 h-7" />
        </div>

        <div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-800">{title}</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>

        <button
          type="button"
          className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm transition-colors active:scale-95"
        >
          <FileUp className="w-4 h-4" />
          <span>{buttonText}</span>
        </button>
      </div>
    </div>
  )
}
