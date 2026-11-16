// Utility functions for file handling, formatting and downloads

/**
 * Trigger client-side file download
 * @param {Blob|Uint8Array} data 
 * @param {string} fileName 
 * @param {string} mimeType 
 */
export function downloadFile(data, fileName, mimeType = 'application/pdf') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Format bytes to human readable format (KB, MB)
 * @param {number} bytes 
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Convert any browser-supported image File to PNG or JPEG Uint8Array bytes
 * Handles formats like WebP, PNG, JPEG across mobile browsers
 * @param {File} file 
 * @returns {Promise<{ bytes: Uint8Array, width: number, height: number, isPng: boolean }>}
 */
export async function normalizeImageForPdf(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const isPng = file.type === 'image/png'

        // Render to canvas to ensure standard format and avoid orientation/unsupported format issues
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)

        // Export as JPEG for photos (smaller size) or PNG for transparency
        const exportType = isPng ? 'image/png' : 'image/jpeg'
        canvas.toBlob(async (blob) => {
          if (!blob) {
            reject(new Error('Failed to process image canvas'))
            return
          }
          const buffer = await blob.arrayBuffer()
          resolve({
            bytes: new Uint8Array(buffer),
            width: canvas.width,
            height: canvas.height,
            isPng: exportType === 'image/png',
          })
        }, exportType, 0.92)
      }
      img.onerror = () => reject(new Error('Cannot load image file'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
