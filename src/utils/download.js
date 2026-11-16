// Client-side file download helper compatible with PC, Android Chrome, and iOS Safari

/**
 * Trigger client-side file download using Blob
 * @param {Blob|Uint8Array|ArrayBuffer} bytes - File data
 * @param {string} filename - Target file name with extension
 * @param {string} [mimeType='application/pdf'] - MIME type of the file
 */
export function downloadFile(bytes, filename, mimeType = 'application/pdf') {
  if (!bytes) {
    console.error('downloadFile: bytes data is required')
    return
  }

  // Convert Uint8Array / ArrayBuffer to Blob if needed
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mimeType })

  // Use standard object URL download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'document.pdf'
  a.rel = 'noopener'

  // Append to DOM to ensure click works consistently on iOS Safari and Android Chrome
  document.body.appendChild(a)
  a.click()

  // Clean up element immediately
  document.body.removeChild(a)

  // Delay revoking URL so iOS Safari has sufficient time to complete the blob handoff
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 3000)
}

/**
 * Format bytes into human-readable string (KB, MB)
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
