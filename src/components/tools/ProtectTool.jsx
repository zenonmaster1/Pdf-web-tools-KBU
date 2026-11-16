import { useState } from 'react'
import {
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  Download,
  Loader2,
  CheckCircle,
  ShieldCheck,
  KeyRound,
  RefreshCw,
} from 'lucide-react'
import Dropzone from '../ui/Dropzone'
import { protectPdfWithPassword } from '../../services/pdfService'
import { downloadFile } from '../../utils/fileUtils'

export default function ProtectTool() {
  const [fileBuffer, setFileBuffer] = useState(null)
  const [fileName, setFileName] = useState('')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadReady, setDownloadReady] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const handleFileSelected = async ([file]) => {
    if (!file) return
    setErrorMessage('')
    setDownloadReady(null)
    setFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()
      setFileBuffer(buffer)
    } catch (err) {
      console.error(err)
      setErrorMessage('ไม่สามารถอ่านไฟล์ได้: ' + err.message)
    }
  }

  const handleProtect = async () => {
    setErrorMessage('')
    setDownloadReady(null)

    if (!password) {
      setErrorMessage('กรุณาระบุรหัสผ่าน')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน')
      return
    }

    if (password.length < 4) {
      setErrorMessage('รหัสผ่านควรมีความยาวอย่างน้อย 4 ตัวอักษร')
      return
    }

    setIsProcessing(true)

    try {
      const encryptedBytes = await protectPdfWithPassword(fileBuffer, password)
      setDownloadReady({
        bytes: encryptedBytes,
        name: `protected_${fileName}`,
      })
    } catch (err) {
      console.error(err)
      setErrorMessage('เกิดข้อผิดพลาดในการเข้ารหัส: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-blue-600" />
          ใส่รหัสผ่านป้องกันไฟล์ PDF (Protect)
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          เข้ารหัสไฟล์ PDF ด้วยมาตรฐานความปลอดภัยสูงสุด (AES-256) ผู้เปิดไฟล์ต้องกรอกรหัสผ่านจึงจะสามารถอ่านเอกสารได้
        </p>
      </div>

      {/* Upload Dropzone */}
      {!fileBuffer && (
        <Dropzone
          onFilesSelected={handleFileSelected}
          multiple={false}
          title="แตะเพื่อเลือกไฟล์ PDF ที่ต้องการใส่รหัสผ่าน"
          subtitle="ประมวลผลบนเครื่องของคุณ 100% รหัสผ่านและไฟล์จะไม่หลุดออกนอกเครื่อง"
          buttonText="เลือกไฟล์ PDF"
        />
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Password Configuration Form */}
      {fileBuffer && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-800">ไฟล์ที่เลือก: {fileName}</p>
              <p className="text-xs text-slate-500">พร้อมสำหรับการเข้ารหัส</p>
            </div>
            <button
              onClick={() => {
                setFileBuffer(null)
                setPassword('')
                setConfirmPassword('')
                setDownloadReady(null)
              }}
              className="text-xs text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>เปลี่ยนไฟล์</span>
            </button>
          </div>

          <div className="space-y-4 max-w-md">
            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                กำหนดรหัสผ่านสำหรับเปิดไฟล์ (User Password):
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="กรอกรหัสผ่านอย่างน้อย 4 ตัวอักษร"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                ยืนยันรหัสผ่านอีกครั้ง:
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="กรอกรหัสผ่านให้ตรงกับช่องด้านบน"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>
          </div>

          {/* Privacy Guarantee Box */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>ความปลอดภัยระดับองค์กร (AES-256 Encryption)</span>
            </p>
            <p className="text-blue-700 leading-relaxed text-[11px]">
              ไฟล์ PDF และรหัสผ่านของคุณจะถูกเข้ารหัสผ่าน Web Crypto API บนอุปกรณ์ของคุณโดยตรง
              ไม่มีการส่งข้อมูลหรือรหัสผ่านไปยังเซิร์ฟเวอร์ใดๆ ทั้งสิ้น
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={handleProtect}
            disabled={isProcessing || !password || !confirmPassword}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 min-h-[44px] transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังเข้ารหัสไฟล์...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>เข้ารหัสและล็อกไฟล์ PDF</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Download Success Card */}
      {downloadReady && (
        <div className="p-4 sm:p-6 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900 text-sm">เข้ารหัสไฟล์สำเร็จเรียบร้อย!</p>
              <p className="text-xs text-emerald-700">ไฟล์พร้อมดาวน์โหลด: {downloadReady.name}</p>
            </div>
          </div>
          <button
            onClick={() => downloadFile(downloadReady.bytes, downloadReady.name)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>ดาวน์โหลด PDF ที่ล็อกรหัส</span>
          </button>
        </div>
      )}
    </div>
  )
}
