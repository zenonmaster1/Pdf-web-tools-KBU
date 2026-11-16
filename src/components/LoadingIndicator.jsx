import { Loader2 } from 'lucide-react'

export default function LoadingIndicator({ message = 'กำลังประมวลผลบนเครื่องของคุณ...', subMessage }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white/90 rounded-2xl border border-slate-200 shadow-xs space-y-3">
      <Loader2 className="w-9 h-9 animate-spin text-blue-600" />
      <div className="text-center">
        <p className="font-semibold text-slate-800 text-sm">{message}</p>
        {subMessage && (
          <p className="text-xs text-slate-500 mt-0.5">{subMessage}</p>
        )}
      </div>
    </div>
  )
}
