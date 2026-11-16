import { Lock, ShieldCheck } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white py-8 text-slate-500 text-xs">
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">
              เว็บเครื่องมือจัดการไฟล์ PDF (โครงงานมหาวิทยาลัย)
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              ประมวลผลบนเบราว์เซอร์ทั้งหมด ไม่มีการอัปโหลดไฟล์ไปยังเซิร์ฟเวอร์ภายนอก 100%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-400">
          <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            ปลอดภัยต่อข้อมูลส่วนบุคคล
          </span>
        </div>
      </div>
    </footer>
  )
}
