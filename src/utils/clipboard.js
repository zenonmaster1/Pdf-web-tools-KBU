/**
 * Copy text to clipboard with fallback for non-secure HTTP context
 * Works across iOS Safari, Android Chrome, and desktop browsers
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
export async function copyTextToClipboard(text) {
  if (!text) return false

  // Try modern Clipboard API if supported and in secure context
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to fallback on permission error or non-secure context
    }
  }

  // Fallback using temporary textarea and execCommand('copy')
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    // Prevent scrolling to bottom of page in iOS Safari
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.width = '2em'
    textArea.style.height = '2em'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    textArea.setAttribute('readonly', '')

    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    textArea.setSelectionRange(0, text.length)

    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch (err) {
    console.error('Failed to copy text using fallback:', err)
    return false
  }
}
