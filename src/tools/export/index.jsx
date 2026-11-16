import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Share2, ArrowLeft, Clock } from 'lucide-react'
import FileDropzone from '../../components/FileDropzone'
import Toast from '../../components/Toast'

export default function ExportTool() {
  const [toastMessage, setToastMessage] = useState('')

  const handleFilesSelected = (files) => {
    setToastMessage(`เลือกไฟล์ "${files[0]?.name}" สำหรับส่งออก (ฟีเจอร์นี้กำลังพัฒนา)`)
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
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">ส่งออกรูปภาพและข้อความ (Export)</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                แปลงหน้า PDF เป็นรูปภาพ หรือดึงข้อความทั้งหมดออกเป็นไฟล์ .txt
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
          accept="application/pdf"
          multiple={false}
          title="แตะเพื่อเลือกไฟล์ PDF ที่ต้องการส่งออก"
          subtitle="ประมวลผลบนเครื่อง 100% ไม่ส่งข้อมูลออกนอกอุปกรณ์"
          buttonText="เลือกไฟล์ PDF"
        />
      </div>

      <Toast message={toastMessage} type="success" onClose={() => setToastMessage('')} />
    </div>
  )
}
