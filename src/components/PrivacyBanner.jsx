import { ShieldCheck, Lock } from 'lucide-react'

export default function PrivacyBanner() {
  return (
    <div className="bg-emerald-50 border-b border-emerald-200/80 text-emerald-900 px-4 py-2 text-xs">
      <div className="max-w-6xl mx-auto flex items-center justify-center sm:justify-start gap-2 text-center sm:text-left">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 hidden sm:inline-block" />
        <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0 sm:hidden" />
        <span className="font-medium">
          ไฟล์ของคุณไม่ถูกอัปโหลด ประมวลผลบนเครื่องคุณเท่านั้น (100% Client-Side Privacy)
        </span>
      </div>
    </div>
  )
}
