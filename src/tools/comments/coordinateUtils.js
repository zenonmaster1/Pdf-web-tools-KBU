/**
 * Coordinate utility functions for PDF annotations (Comments & Highlights)
 * 
 * Maps normalized visual screen coordinates (0..1, origin at visual top-left)
 * to unrotated PDF page user space coordinates (points, origin at PDF bottom-left).
 * Handles all 4 standard PDF page rotation angles: 0, 90, 180, and 270 degrees.
 */

/**
 * Returns the visual width and height of a PDF page in PDF points,
 * taking into account whether the page is rotated 90 or 270 degrees.
 *
 * @param {{ x: number, y: number, width: number, height: number }} box Page CropBox or MediaBox
 * @param {number} rotation Page rotation angle in degrees (0, 90, 180, 270)
 * @returns {{ width: number, height: number }} Visual page dimensions in points
 */
export function getVisualPageDimensions(box, rotation = 0) {
  const rot = ((rotation % 360) + 360) % 360
  if (rot === 90 || rot === 270) {
    return { width: box.height, height: box.width }
  }
  return { width: box.width, height: box.height }
}

/**
 * Maps a single normalized visual point (u, v) in range [0, 1]
 * (where u=0 is left, u=1 is right, v=0 is top, v=1 is bottom)
 * to an unrotated PDF user space coordinate (x, y) in points.
 *
 * Formula derivations for each rotation angle:
 * - 0°: Standard unrotated PDF coordinate space.
 *   x increases from left (box.x) to right (box.x + width).
 *   y increases from bottom (box.y) to top (box.y + height).
 *   Visual top (v=0) -> PDF top (box.y + height).
 *   Visual bottom (v=1) -> PDF bottom (box.y).
 *   => x = box.x + u * width, y = box.y + (1 - v) * height
 *
 * - 90°: Page is rotated 90° clockwise when displayed.
 *   Original bottom-left (box.x, box.y) rotates to visual top-left (u=0, v=0).
 *   Original top-left (box.x, box.y + height) rotates to visual top-right (u=1, v=0).
 *   Original bottom-right (box.x + width, box.y) rotates to visual bottom-left (u=0, v=1).
 *   Moving visual right (u: 0 -> 1) moves along PDF +Y axis (box.y -> box.y + height).
 *   Moving visual down (v: 0 -> 1) moves along PDF +X axis (box.x -> box.x + width).
 *   => x = box.x + v * width, y = box.y + u * height
 *
 * - 180°: Page is rotated 180° upside-down.
 *   Original bottom-right (box.x + width, box.y) rotates to visual top-left (u=0, v=0).
 *   Original top-left (box.x, box.y + height) rotates to visual bottom-right (u=1, v=1).
 *   Moving visual right (u: 0 -> 1) moves along PDF -X axis.
 *   Moving visual down (v: 0 -> 1) moves along PDF +Y axis.
 *   => x = box.x + (1 - u) * width, y = box.y + v * height
 *
 * - 270°: Page is rotated 270° clockwise (90° counter-clockwise).
 *   Original top-right (box.x + width, box.y + height) rotates to visual top-left (u=0, v=0).
 *   Moving visual right (u: 0 -> 1) moves along PDF -Y axis.
 *   Moving visual down (v: 0 -> 1) moves along PDF -X axis.
 *   => x = box.x + (1 - v) * width, y = box.y + (1 - u) * height
 *
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @param {number} rotation
 * @param {number} u Normalized horizontal coordinate [0, 1]
 * @param {number} v Normalized vertical coordinate [0, 1]
 * @returns {{ x: number, y: number }} PDF coordinates in points
 */
export function visualToPdfPoint(box, rotation = 0, u = 0, v = 0) {
  const rot = ((rotation % 360) + 360) % 360
  const W = box.width
  const H = box.height

  if (rot === 90) {
    return {
      x: box.x + v * W,
      y: box.y + u * H,
    }
  }

  if (rot === 180) {
    return {
      x: box.x + (1 - u) * W,
      y: box.y + v * H,
    }
  }

  if (rot === 270) {
    return {
      x: box.x + (1 - v) * W,
      y: box.y + (1 - u) * H,
    }
  }

  // rot === 0 (default)
  return {
    x: box.x + u * W,
    y: box.y + (1 - v) * H,
  }
}

/**
 * Maps a visual rectangle (u1, v1) to (u2, v2) into PDF rectangle parameters { x, y, width, height }
 * suitable for pdf-lib's `page.drawRectangle({ x, y, width, height })`, where (x, y) is
 * the bottom-left corner of the rectangle in unrotated PDF coordinate space.
 *
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @param {number} rotation
 * @param {number} u1 Visual left [0, 1]
 * @param {number} v1 Visual top [0, 1]
 * @param {number} u2 Visual right [0, 1]
 * @param {number} v2 Visual bottom [0, 1]
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function getHighlightPdfRect(box, rotation = 0, u1 = 0, v1 = 0, u2 = 0, v2 = 0) {
  const rot = ((rotation % 360) + 360) % 360
  const W = box.width
  const H = box.height

  const minU = Math.max(0, Math.min(u1, u2))
  const maxU = Math.min(1, Math.max(u1, u2))
  const minV = Math.max(0, Math.min(v1, v2))
  const maxV = Math.min(1, Math.max(v1, v2))

  const normW = maxU - minU
  const normH = maxV - minV

  if (rot === 90) {
    return {
      x: box.x + minV * W,
      y: box.y + minU * H,
      width: normH * W,
      height: normW * H,
    }
  }

  if (rot === 180) {
    return {
      x: box.x + (1 - maxU) * W,
      y: box.y + minV * H,
      width: normW * W,
      height: normH * H,
    }
  }

  if (rot === 270) {
    return {
      x: box.x + (1 - maxV) * W,
      y: box.y + (1 - maxU) * H,
      width: normH * W,
      height: normW * H,
    }
  }

  // rot === 0 (default)
  return {
    x: box.x + minU * W,
    y: box.y + (1 - maxV) * H,
    width: normW * W,
    height: normH * H,
  }
}

/**
 * Calculates the PDF coordinate and rotation parameters for a specific line of text
 * so that it renders horizontally and upright to the user viewing the rotated page.
 *
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @param {number} rotation
 * @param {number} u Visual horizontal start [0, 1]
 * @param {number} visualBaselineY Visual baseline position in points from top of visual page
 * @param {number} visualPageH Total visual height in points
 * @returns {{ x: number, y: number, rotationDegrees: number }}
 */
export function getTextLinePdfCoords(box, rotation = 0, u = 0, visualBaselineY = 0, visualPageH = 1) {
  const rot = ((rotation % 360) + 360) % 360
  const safeH = Math.max(1, visualPageH)
  const v_baseline = visualBaselineY / safeH

  const pt = visualToPdfPoint(box, rot, u, v_baseline)
  return {
    x: pt.x,
    y: pt.y,
    rotationDegrees: rot,
  }
}
