import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

export default function Toast({ type = 'error', message, onClose, autoCloseMs = 5000 }) {
  useEffect(() => {
    if (!message || !autoCloseMs || !onClose) return
    const timer = setTimeout(() => {
      onClose()
    }, autoCloseMs)
    return () => clearTimeout(timer)
  }, [message, autoCloseMs, onClose])

  if (!message) return null

  const isSuccess = type === 'success'

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div
        className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border ${
          isSuccess
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-red-50 border-red-200 text-red-900'
        }`}
      >
        {isSuccess ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        )}

        <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
          {message}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            aria-label="ปิดการแจ้งเตือน"
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-black/5 shrink-0 min-h-[32px] min-w-[32px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
