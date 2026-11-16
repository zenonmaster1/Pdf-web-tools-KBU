/**
 * Text and Color utility functions for PDF Comments
 * Supports Thai word tokenization, line wrapping, emoji sanitization, and color mapping.
 */

// Color palettes for Highlights and Text Annotations
export const HIGHLIGHT_COLORS = {
  yellow: {
    id: 'yellow',
    name: 'เหลือง',
    hex: '#fef08a',
    border: '#eab308',
    pdfRgb: [1.0, 0.94, 0.54],
  },
  green: {
    id: 'green',
    name: 'เขียว',
    hex: '#bbf7d0',
    border: '#22c55e',
    pdfRgb: [0.73, 0.97, 0.82],
  },
  pink: {
    id: 'pink',
    name: 'ชมพู',
    hex: '#fbcfe8',
    border: '#ec4899',
    pdfRgb: [0.98, 0.81, 0.91],
  },
  blue: {
    id: 'blue',
    name: 'ฟ้า',
    hex: '#bfdbfe',
    border: '#3b82f6',
    pdfRgb: [0.75, 0.86, 1.0],
  },
}

export const TEXT_COLORS = {
  black: {
    id: 'black',
    name: 'ดำ',
    hex: '#0f172a',
    pdfRgb: [0.06, 0.09, 0.16],
  },
  red: {
    id: 'red',
    name: 'แดง',
    hex: '#dc2626',
    pdfRgb: [0.86, 0.15, 0.15],
  },
  blue: {
    id: 'blue',
    name: 'น้ำเงิน',
    hex: '#2563eb',
    pdfRgb: [0.15, 0.39, 0.92],
  },
}

export const FONT_SIZES = [12, 14, 18, 24]

/**
 * Fallback tokenizer for Thai text when Intl.Segmenter is unavailable.
 * Keeps Thai base consonants together with their combining vowels and tone marks.
 */
export function fallbackTokenize(text) {
  const thaiClusterRegex = /[\u0E01-\u0E2E][\u0E30-\u0E3A\u0E47-\u0E4E]*|[^\u0E01-\u0E2E]/g
  const tokens = []
  const parts = text.split(/(\s+)/)

  for (const part of parts) {
    if (!part) continue
    if (/\s+/.test(part)) {
      tokens.push(part)
    } else {
      const clusters = part.match(thaiClusterRegex) || [part]
      tokens.push(...clusters)
    }
  }
  return tokens
}

/**
 * Tokenize Thai and Latin text using Intl.Segmenter with graceful fallback.
 */
export function tokenizeThaiText(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter('th', { granularity: 'word' })
      return Array.from(segmenter.segment(text)).map((s) => s.segment)
    } catch {
      return fallbackTokenize(text)
    }
  }
  return fallbackTokenize(text)
}

/**
 * Replace unsupported emoji or complex pictorial glyphs with '?'
 * to ensure pdf-lib / fontkit never throws during embedding.
 */
export function sanitizeUnsupportedChars(text) {
  const emojiRegex = /[\p{Extended_Pictographic}\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u
  let cleanText = ''
  let hasReplaced = false

  for (const char of text) {
    if (emojiRegex.test(char)) {
      cleanText += '?'
      hasReplaced = true
    } else {
      cleanText += char
    }
  }

  return { cleanText, hasReplaced }
}

/**
 * Wraps text into multiple lines based on maximum allowed width in PDF points.
 * Respects explicit newlines in paragraphs and uses font.widthOfTextAtSize.
 */
export function wrapTextToLines(text, font, fontSize, maxLineWidth) {
  const paragraphs = text.split('\n')
  const lines = []

  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push('')
      continue
    }

    const tokens = tokenizeThaiText(para)
    let currentLine = ''

    for (const token of tokens) {
      const candidate = currentLine + token
      let width = 0

      try {
        width = font.widthOfTextAtSize(candidate, fontSize)
      } catch {
        // Fallback width estimation if font measure throws
        width = candidate.length * fontSize * 0.6
      }

      if (width <= maxLineWidth || currentLine === '') {
        currentLine = candidate
      } else {
        if (currentLine.trim()) lines.push(currentLine.trim())
        currentLine = token.trimStart()
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim())
    }
  }

  return lines
}

/**
 * Generate unique ID without crypto.randomUUID for maximum cross-device support
 */
export function generateUniqueId(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}
