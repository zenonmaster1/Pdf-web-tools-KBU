import { ShieldCheck, Laptop, Smartphone } from 'lucide-react'

export default function Header() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Logo & Title */}
          <div>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 text-white font-bold text-lg shadow-sm">
                PDF
              </span>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  เว็บจัดการ PDF ออฟไลน์
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    โครงงานนักศึกษา
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  เครื่องมือจัดการไฟล์ PDF ในเบราว์เซอร์ 100% ปลอดภัย ไม่ส่งไฟล์ออกนอกเครื่อง
                </p>
              </div>
            </div>
          </div>

          {/* Privacy & Platform Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>ประมวลผลบนเครื่อง (Client-side)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-medium">
              <Smartphone className="w-3.5 h-3.5" />
              <Laptop className="w-3.5 h-3.5" />
              <span>PC & มือถือ</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
