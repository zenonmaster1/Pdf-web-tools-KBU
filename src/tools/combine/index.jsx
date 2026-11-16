import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Files, ArrowLeft, Clock } from 'lucide-react'
import FileDropzone from '../../components/FileDropzone'
import Toast from '../../components/Toast'

export default function CombineTool() {
  const [toastMessage, setToastMessage] = useState('')

  const handleFilesSelected = (files) => {
    setToastMessage(`เลือกสำเร็จ ${files.length} ไฟล์ (ฟีเจอร์นี้กำลังพัฒนา)`)
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 min-h-[44px] px-2 py-1 rounded-lg"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>กลับหน้าแรก</span>
      </Link>

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Files className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">ผสานไฟล์ PDF (Combine)</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                รวมไฟล์ PDF หลายไฟล์เข้าด้วยกันเป็นไฟล์เดียวตามลำดับที่ต้องการ
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            <Clock className="w-3.5 h-3.5" />
            กำลังพัฒนา
          </span>
        </div>
      </div>

      {/* Demo of Reusable FileDropzone */}
      <div className="space-y-3">
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          accept="application/pdf"
          multiple={true}
          title="ทดสอบเลือกไฟล์ PDF หลายไฟล์"
          subtitle="ลากและวางไฟล์ หรือแตะเพื่อเลือกไฟล์จากอุปกรณ์"
          buttonText="เลือกไฟล์ PDF"
        />
      </div>

      <Toast message={toastMessage} type="success" onClose={() => setToastMessage('')} />
    </div>
  )
}
