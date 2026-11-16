import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FilePlus, ArrowLeft, Clock } from 'lucide-react'
import FileDropzone from '../../components/FileDropzone'
import Toast from '../../components/Toast'

export default function CreateTool() {
  const [toastMessage, setToastMessage] = useState('')

  const handleFilesSelected = (files) => {
    setToastMessage(`เลือกรูปภาพ ${files.length} รูปเรียบร้อย (ฟีเจอร์นี้กำลังพัฒนา)`)
  }

  return (
    <div className="space-y-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 min-h-[44px] px-2 py-1 rounded-lg"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>กลับหน้าแรก</span>
      </Link>

      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FilePlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">สร้างเอกสาร PDF (Create)</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                สร้างเอกสาร PDF จากรูปภาพหลายรูป หรือพิมพ์ข้อความขึ้นใหม่
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            <Clock className="w-3.5 h-3.5" />
            กำลังพัฒนา
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          accept="image/*"
          multiple={true}
          title="แตะเพื่อเลือกรูปภาพที่จะนำมารวมเป็น PDF"
          subtitle="รองรับไฟล์ JPG, PNG, WebP"
          buttonText="เลือกรูปภาพ"
        />
      </div>

      <Toast message={toastMessage} type="success" onClose={() => setToastMessage('')} />
    </div>
  )
}
