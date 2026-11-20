import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldAlert,
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  Printer,
  Copy,
  FileEdit,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

import FileDropzone from '../../components/FileDropzone'
import Toast from '../../components/Toast'
import LoadingIndicator from '../../components/LoadingIndicator'
import { downloadFile, formatBytes } from '../../utils/download'
import { MAX_FILE_MB, MAX_PAGES } from '../../utils/constants'

// Configure worker for legacy pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

/**
 * Safely clean up PDF.js document proxy instance
 */
async function safeCleanupPdf(pdfDoc) {
  if (!pdfDoc) return
  try {
    if (typeof pdfDoc.destroy === 'function') {
      await pdfDoc.destroy()
    } else if (pdfDoc.loadingTask && typeof pdfDoc.loadingTask.destroy === 'function') {
      await pdfDoc.loadingTask.destroy()
    } else if (typeof pdfDoc.cleanup === 'function') {
      pdfDoc.cleanup()
    }
  } catch (err) {
    console.warn('Non-critical error cleaning up PDF:', err)
  }
}

/**
 * Evaluates password strength based on length and character diversity
 */
function evaluatePasswordStrength(password) {
  if (!password) {
    return { score: 0, label: '', color: 'slate', percent: 0 }
  }

  const length = password.length
  if (length < 6) {
    return { score: 1, label: 'สั้นเกินไป (อย่างน้อย 6 ตัวอักษร)', color: 'red', percent: 20 }
  }

  let score = 0
  if (length >= 6) score += 1
  if (length >= 8) score += 1
  if (length >= 12) score += 1

  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const hasSpecial = /[^a-zA-Z0-9]/.test(password)

  const varietyCount = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length
  if (varietyCount >= 2) score += 1
  if (varietyCount >= 3) score += 1
  if (varietyCount >= 4) score += 1

  if (score <= 2) {
    return { score: 2, label: 'อ่อน', color: 'red', percent: 35 }
  } else if (score <= 4) {
    return { score: 3, label: 'พอใช้', color: 'amber', percent: 65 }
  } else {
    return { score: 4, label: 'แข็งแรง', color: 'emerald', percent: 100 }
  }
}

export default function ProtectTool() {
  // File state
  const [fileInfo, setFileInfo] = useState(null)
  const [rawPdfBuffer, setRawPdfBuffer] = useState(null)

  // Password inputs state
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Permission restriction options (defaults to unrestricted)
  const [allowPrinting, setAllowPrinting] = useState(true)
  const [allowCopying, setAllowCopying] = useState(true)
  const [allowModifying, setAllowModifying] = useState(true)

  // Verification state (shown after encryption check passes)
  const [verificationPassed, setVerificationPassed] = useState(false)

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [toast, setToast] = useState({ type: 'info', message: '' })

  // Clean passwords and buffers on unmount
  useEffect(() => {
    return () => {
      setPassword('')
      setConfirmPassword('')
      setRawPdfBuffer(null)
    }
  }, [])

  // Handle PDF file selection
  const handleFileSelected = async (files) => {
    const file = files[0]
    if (!file) return

    setIsLoading(true)
    setLoadingMessage('กำลังตรวจสอบไฟล์ PDF...')
    setVerificationPassed(false)

    // Reset passwords
    setPassword('')
    setConfirmPassword('')

    try {
      const buffer = await file.arrayBuffer()

      // Check if file is already encrypted using pdfjs-dist
      let isEncrypted = false
      let doc = null

      try {
        const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) })
        doc = await loadingTask.promise
      } catch (checkErr) {
        if (
          checkErr?.name === 'PasswordException' ||
          checkErr instanceof pdfjsLib.PasswordException ||
          checkErr?.message?.toLowerCase().includes('password')
        ) {
          isEncrypted = true
        } else if (
          checkErr?.name === 'InvalidPDFException' ||
          checkErr instanceof pdfjsLib.InvalidPDFException
        ) {
          setToast({ type: 'error', message: 'ไฟล์ไม่ใช่ PDF ที่ถูกต้องหรือเสียหาย' })
          setIsLoading(false)
          return
        } else {
          console.error('File check error:', checkErr?.name, checkErr?.message)
          setToast({
            type: 'error',
            message: `ไม่สามารถเปิดไฟล์ได้: ${checkErr?.message || 'ไฟล์อาจเสียหาย'}`,
          })
          setIsLoading(false)
          return
        }
      }

      if (isEncrypted) {
        setToast({
          type: 'error',
          message: 'ไฟล์นี้มีรหัสผ่านอยู่แล้ว ไม่สามารถใส่รหัสซ้ำได้',
        })
        setIsLoading(false)
        return
      }

      if (doc) {
        if (doc.numPages > MAX_PAGES) {
          setToast({
            type: 'error',
            message: `ไฟล์มีจำนวนหน้า (${doc.numPages} หน้า) เกินขีดจำกัดสูงสุด ${MAX_PAGES} หน้า`,
          })
          await safeCleanupPdf(doc)
          setIsLoading(false)
          return
        }

        setFileInfo({
          name: file.name,
          size: file.size,
          numPages: doc.numPages,
        })
        setRawPdfBuffer(buffer)
        await safeCleanupPdf(doc)
      }
    } catch (err) {
      console.error('File load error:', err?.name, err?.message)
      setToast({
        type: 'error',
        message: `เกิดข้อผิดพลาดในการโหลดไฟล์: ${err?.message || 'ไม่ทราบสาเหตุ'}`,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Clear current file and reset state
  const handleResetFile = () => {
    setFileInfo(null)
    setRawPdfBuffer(null)
    setPassword('')
    setConfirmPassword('')
    setVerificationPassed(false)
  }

  // Password validation computations
  const strength = evaluatePasswordStrength(password)
  const isMatch = password === confirmPassword && confirmPassword.length > 0
  const isLengthValid = password.length >= 6
  const canProtect = isLengthValid && isMatch && !isLoading
  const hasNonAscii = /[^\x20-\x7E]/.test(password)

  // Encrypt and verify PDF
  const handleProtectAndDownload = async () => {
    if (!canProtect || !rawPdfBuffer) return

    setIsLoading(true)
    setLoadingMessage('กำลังเข้ารหัสเอกสารด้วยมาตรฐานความปลอดภัยสูงสุด (AES-256)...')
    setVerificationPassed(false)

    let encryptedBytes = null

    // 1. Encryption Phase using @cantoo/pdf-lib (loaded via dynamic import)
    try {
      const { PDFDocument } = await import('@cantoo/pdf-lib')
      const pdfDoc = await PDFDocument.load(rawPdfBuffer.slice(0), {
        ignoreEncryption: false,
      })

      const isRestricted = !allowPrinting || !allowCopying || !allowModifying
      // If restrictions are applied, generate a distinct random owner password so user password adheres to permissions
      const ownerPassword = isRestricted
        ? `owner-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
        : password

      pdfDoc.encrypt({
        userPassword: password,
        ownerPassword,
        algorithm: 'AES-256',
        permissions: {
          printing: allowPrinting ? 'highResolution' : false,
          copying: allowCopying,
          modifying: allowModifying,
          annotating: allowModifying,
          fillingForms: allowModifying,
          documentAssembly: allowModifying,
          contentAccessibility: true,
        },
      })

      encryptedBytes = await pdfDoc.save()
    } catch (err) {
      console.error('Encryption error:', err?.name, err?.message)
      setToast({
        type: 'error',
        message: `การเข้ารหัสล้มเหลว: ${err?.message || 'ไม่ทราบสาเหตุ'}`,
      })
      setIsLoading(false)
      return
    }

    // 2. Automated Verification Phase using pdfjs-dist
    setLoadingMessage('กำลังตรวจสอบความปลอดภัยอัตโนมัติ (Automated Verification)...')

    let step1Passed = false
    let step2Passed = false

    // Verification Step 1: Opening without password MUST throw PasswordException
    try {
      const taskWithoutPass = pdfjsLib.getDocument({ data: encryptedBytes.slice(0) })
      const docWithoutPass = await taskWithoutPass.promise
      // If it opened without password, encryption is broken!
      await safeCleanupPdf(docWithoutPass)
      step1Passed = false
    } catch (err) {
      if (
        err?.name === 'PasswordException' ||
        err instanceof pdfjsLib.PasswordException ||
        err?.message?.toLowerCase().includes('password')
      ) {
        step1Passed = true
      } else {
        console.error('Verification step 1 unexpected error:', err?.name, err?.message)
      }
    }

    // Verification Step 2: Opening with password MUST succeed and match original page count
    try {
      const taskWithPass = pdfjsLib.getDocument({
        data: encryptedBytes.slice(0),
        password,
      })
      const docWithPass = await taskWithPass.promise

      if (docWithPass.numPages === fileInfo.numPages) {
        step2Passed = true
      }
      await safeCleanupPdf(docWithPass)
    } catch (err) {
      console.error('Verification step 2 failed:', err?.name, err?.message)
    }

    setIsLoading(false)

    // Check verification outcome
    if (step1Passed && step2Passed) {
      setVerificationPassed(true)

      const downloadName = (fileInfo?.name || 'document')
        .replace(/\.pdf$/i, '')
        .concat('-protected.pdf')

      downloadFile(encryptedBytes, downloadName, 'application/pdf')

      setToast({
        type: 'success',
        message: `ตรวจสอบแล้ว: ไฟล์ถูกล็อกด้วยรหัสผ่านจริง ดาวน์โหลด "${downloadName}" เรียบร้อยแล้ว`,
      })

      // Clean passwords from memory for security
      setPassword('')
      setConfirmPassword('')
    } else {
      console.error('Verification failed:', { step1Passed, step2Passed })
      setToast({
        type: 'error',
        message: 'การตรวจสอบล้มเหลว: ไฟล์ไม่ได้ถูกล็อกด้วยรหัสผ่านอย่างถูกต้อง ไม่อนุญาตให้ดาวน์โหลด',
      })
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 min-h-[44px] px-2 py-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับหน้าแรก</span>
        </Link>

        {fileInfo && (
          <button
            onClick={handleResetFile}
            className="text-xs text-slate-500 hover:text-red-600 font-medium px-3 py-2 min-h-[44px] rounded-lg transition-colors"
          >
            เปลี่ยนไฟล์ PDF
          </button>
        )}
      </div>

      {/* Tool Title & Description */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              ใส่รหัสผ่านป้องกันไฟล์ (Protect)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              เข้ารหัสล็อกไฟล์ PDF เพื่อป้องกันการเปิดอ่านโดยไม่ได้รับอนุญาต
            </p>
          </div>
        </div>

        {/* Required Critical Warnings */}
        <div className="space-y-2">
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs sm:text-sm leading-relaxed">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">ข้อควรระวังสำคัญ: </span>
              หากลืมรหัสผ่าน ไม่สามารถกู้คืนไฟล์ได้ ระบบนี้ประมวลผลบนเครื่องของคุณและไม่เก็บรหัสผ่านไว้
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm leading-relaxed">
            <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">หมายเหตุเรื่องสิทธิ์: </span>
              การจำกัดสิทธิ์ (พิมพ์/คัดลอก/แก้ไข) เป็นคำขอให้โปรแกรมอ่าน PDF ปฏิบัติตาม
              บางโปรแกรมอาจไม่ทำตาม
            </div>
          </div>
        </div>
      </div>

      {/* Step 1: File Selection Dropzone */}
      {!fileInfo && (
        <FileDropzone
          onFilesSelected={handleFileSelected}
          onError={(msg) => setToast({ type: 'error', message: msg })}
          accept="application/pdf"
          multiple={false}
          maxFileMb={MAX_FILE_MB}
          title="แตะหรือลากไฟล์ PDF มาวางที่นี่เพื่อใส่รหัสผ่าน"
          subtitle={`รองรับไฟล์ PDF สูงสุด ${MAX_FILE_MB} MB`}
          buttonText="เลือกไฟล์ PDF"
        />
      )}

      {/* Step 2: Protection Configuration Workspace */}
      {fileInfo && (
        <div className="space-y-5">
          {/* File Information Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-xs sm:text-sm">
                <p className="font-bold text-slate-800 break-all">{fileInfo.name}</p>
                <p className="text-slate-500">
                  {formatBytes(fileInfo.size)} • {fileInfo.numPages} หน้า
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>พร้อมตั้งรหัสผ่าน</span>
            </div>
          </div>

          {/* Password Settings Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600" />
              <span>ตั้งรหัสผ่านเปิดเอกสาร</span>
            </h2>

            <div className="space-y-4">
              {/* Password Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="protect-password"
                  className="block text-xs sm:text-sm font-semibold text-slate-700"
                >
                  รหัสผ่าน (อย่างน้อย 6 ตัวอักษร) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="protect-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="พิมพ์รหัสผ่านที่ต้องการ..."
                    className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-xl text-sm min-h-[44px] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-1 top-1 bottom-1 px-3 text-slate-400 hover:text-slate-700 flex items-center justify-center min-w-[44px]"
                    title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="space-y-1.5 pt-1">
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          strength.color === 'emerald'
                            ? 'bg-emerald-500'
                            : strength.color === 'amber'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${strength.percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">ความแข็งแรง:</span>
                      <span
                        className={`font-semibold ${
                          strength.color === 'emerald'
                            ? 'text-emerald-600'
                            : strength.color === 'amber'
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }`}
                      >
                        {strength.label}
                      </span>
                    </div>
                  </div>
                )}

                {/* Non-ASCII Warning (Trap ก) */}
                {hasNonAscii && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      คำแนะนำ: รหัสผ่านมีอักขระภาษาไทยหรือพิเศษ แนะนำให้ใช้ตัวอักษรอังกฤษ ตัวเลข
                      และสัญลักษณ์ เพื่อให้เปิดได้ในทุกโปรแกรมอ่าน PDF
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="protect-confirm-password"
                  className="block text-xs sm:text-sm font-semibold text-slate-700"
                >
                  ยืนยันรหัสผ่านอีกครั้ง <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="protect-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="พิมพ์รหัสผ่านเดิมซ้ำอีกครั้ง..."
                    className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-xl text-sm min-h-[44px] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-1 top-1 bottom-1 px-3 text-slate-400 hover:text-slate-700 flex items-center justify-center min-w-[44px]"
                    title={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {confirmPassword && (
                  <div className="text-xs pt-0.5">
                    {isMatch ? (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        รหัสผ่านทั้งสองช่องตรงกัน
                      </span>
                    ) : (
                      <span className="text-red-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        รหัสผ่านไม่ตรงกัน
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Permissions Restriction Card (Optional) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                จำกัดสิทธิ์การใช้งานเอกสาร (Permissions)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                เลือกสิทธิ์ที่ต้องการอนุญาตให้ผู้เปิดไฟล์ทำได้ (ค่าเริ่มต้นคืออนุญาตทั้งหมด)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Allow Printing */}
              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer min-h-[44px] transition-colors">
                <input
                  type="checkbox"
                  checked={allowPrinting}
                  onChange={(e) => setAllowPrinting(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-800">
                  <Printer className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>อนุญาตให้พิมพ์</span>
                </div>
              </label>

              {/* Allow Copying */}
              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer min-h-[44px] transition-colors">
                <input
                  type="checkbox"
                  checked={allowCopying}
                  onChange={(e) => setAllowCopying(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-800">
                  <Copy className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>อนุญาตให้คัดลอก</span>
                </div>
              </label>

              {/* Allow Modifying */}
              <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer min-h-[44px] transition-colors">
                <input
                  type="checkbox"
                  checked={allowModifying}
                  onChange={(e) => setAllowModifying(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-800">
                  <FileEdit className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>อนุญาตให้แก้ไข</span>
                </div>
              </label>
            </div>
          </div>

          {/* Automated Verification Evidence Badge */}
          {verificationPassed && (
            <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-semibold">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                ตรวจสอบแล้ว: ไฟล์ถูกล็อกด้วยรหัสผ่านจริง (ผ่านการทดสอบเปิดไฟล์แบบไม่มีรหัสและมีรหัส 100%)
              </span>
            </div>
          )}

          {/* Action Button: Protect and Download */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleProtectAndDownload}
              disabled={!canProtect}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-blue-600 text-white font-bold text-sm sm:text-base hover:bg-blue-700 active:scale-98 transition-all min-h-[48px] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              <span>ใส่รหัสผ่านและดาวน์โหลด (Protect & Download)</span>
            </button>

            {!isLengthValid && password && (
              <p className="text-center text-xs text-red-500 mt-2 font-medium">
                รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร
              </p>
            )}
            {isLengthValid && !isMatch && confirmPassword && (
              <p className="text-center text-xs text-red-500 mt-2 font-medium">
                รหัสผ่านทั้งสองช่องต้องตรงกัน
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <LoadingIndicator message={loadingMessage} />
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        type={toast.type}
        message={toast.message}
        onClose={() => setToast({ type: 'info', message: '' })}
      />
    </div>
  )
}
