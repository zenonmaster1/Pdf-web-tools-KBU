import { Link } from 'react-router-dom'
import {
  Files,
  LayoutGrid,
  FilePlus,
  Share2,
  MessageSquarePlus,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Cpu,
} from 'lucide-react'
import { PDF_TOOLS } from '../utils/constants'

const iconMap = {
  Files,
  LayoutGrid,
  FilePlus,
  Share2,
  MessageSquarePlus,
  ShieldAlert,
}

export default function Home() {
  return (
    <div className="space-y-8">
      {/* Hero Intro Section */}
      <section className="text-center py-6 sm:py-10 space-y-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
          <ShieldCheck className="w-3.5 h-3.5" />
          ประมวลผลบนเครื่องของคุณ (No Server)
        </span>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
          เครื่องมือจัดการไฟล์ PDF เบื้องต้น
        </h1>

        <p className="max-w-2xl mx-auto text-xs sm:text-base text-slate-600 leading-relaxed px-4">
          จัดการไฟล์ PDF ได้สะดวกรวดเร็ว ทั้งบนคอมพิวเตอร์และมือถือ ไม่มีการอัปโหลดไฟล์ไปยังเซิร์ฟเวอร์
          ข้อมูลส่วนตัวของคุณจึงได้รับความปลอดภัยสูงสุด
        </p>

        {/* Feature Highlights */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            ทำงานแบบ Client-Side
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <Smartphone className="w-3.5 h-3.5 text-blue-600" />
            รองรับบนโทรศัพท์มือถือ
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            ขนาดไฟล์สูงสุด 50 MB
          </span>
        </div>
      </section>

      {/* 6 Feature Cards Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            เลือกเครื่องมือที่ต้องการใช้งาน
          </h2>
          <span className="text-xs text-slate-400">ทั้งหมด 6 เครื่องมือ</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {PDF_TOOLS.map((tool) => {
            const Icon = iconMap[tool.iconName] || Files

            return (
              <Link
                key={tool.id}
                to={tool.path}
                className="group bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 hover:border-blue-400/80 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[140px] select-none active:scale-98"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {tool.subTitle}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {tool.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {tool.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600 group-hover:text-blue-700">
                  <span>เปิดใช้งานเครื่องมือ</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
