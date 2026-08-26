/**
 * Raster do mapa para pixels (Skia) e geometria de grade/eixos.
 */
import { THEME_CANVAS } from '../constants/palette.js'
import { cartesianAxisPixel } from './coords.js'
import { cellsToLodRects, downsampleBoxRgb, lodFactor, makeRgbLookup } from './lod.js'
import { clipCells, expandBrush } from './shapes.js'

/**
 * @param {object} options
 */
export function visibleRange(originX, originY, cellSize, viewWidth, viewHeight, cols, rows) {
  const startX = Math.max(0, Math.floor((0 - originX) / cellSize))
  const startY = Math.max(0, Math.floor((0 - originY) / cellSize))
  const endX = Math.min(cols, Math.ceil((viewWidth - originX) / cellSize))
  const endY = Math.min(rows, Math.ceil((viewHeight - originY) / cellSize))
  return {
    startX,
    startY,
    endX,
    endY,
    visW: Math.max(0, endX - startX),
    visH: Math.max(0, endY - startY),
  }
}

/**
 * Pixels RGBA da região visível (1 pixel por célula, ou downsample).
 * @returns {Uint8Array | null}
 */
export function buildVisiblePixels(grid, colors, theme, startX, startY, visW, visH, destW, destH) {
  if (visW <= 0 || visH <= 0) return null
  const rgbOf = makeRgbLookup(colors, theme)
  const rows = grid.length
  const cols = rows > 0 ? grid[0].length : 0
  const outW = destW < visW ? destW : visW
  const outH = destH < visH ? destH : visH
  const pixels = new Uint8Array(outW * outH * 4)

  if (outW >= visW && outH >= visH) {
    for (let y = 0; y < visH; y += 1) {
      const row = grid[startY + y]
      for (let x = 0; x < visW; x += 1) {
        const { r, g, b } = rgbOf(row[startX + x])
        const i = (y * visW + x) * 4
        pixels[i] = r
        pixels[i + 1] = g
        pixels[i + 2] = b
        pixels[i + 3] = 255
      }
    }
    return { pixels, width: visW, height: visH }
  }

  const paintedCounts = new Map()
  for (let py = 0; py < outH; py += 1) {
    const y0 = Math.min(rows - 1, startY + Math.floor((py * visH) / outH))
    const y1 = Math.min(
      rows,
      startY + Math.max(Math.floor((py * visH) / outH) + 1, Math.ceil(((py + 1) * visH) / outH)),
    )
    for (let px = 0; px < outW; px += 1) {
      const x0 = Math.min(cols - 1, startX + Math.floor((px * visW) / outW))
      const x1 = Math.min(
        cols,
        startX + Math.max(Math.floor((px * visW) / outW) + 1, Math.ceil(((px + 1) * visW) / outW)),
      )
      const { r, g, b } = downsampleBoxRgb(
        grid,
        x0,
        y0,
        Math.max(x0 + 1, x1),
        Math.max(y0 + 1, y1),
        rgbOf,
        paintedCounts,
      )
      const i = (py * outW + px) * 4
      pixels[i] = r
      pixels[i + 1] = g
      pixels[i + 2] = b
      pixels[i + 3] = 255
    }
  }
  return { pixels, width: outW, height: outH }
}

/**
 * Retângulos de preview/hover em pixels de tela.
 */
export function overlayRects(cells, originX, originY, cellSize, lod, cols, rows) {
  const rects = cellsToLodRects(cells, lod, cols, rows)
  return rects.map((rect) => ({
    x: originX + rect.x * cellSize,
    y: originY + rect.y * cellSize,
    w: rect.w * cellSize,
    h: rect.h * cellSize,
  }))
}

export function hoverOverlay(hoverBlock, brushSize, originX, originY, cellSize, lod, cols, rows) {
  if (!hoverBlock) return []
  const hoverCells = clipCells(expandBrush([hoverBlock], brushSize), cols, rows)
  return overlayRects(hoverCells, originX, originY, cellSize, lod, cols, rows)
}

/**
 * Segmentos de linha da malha (x1,y1,x2,y2).
 */
export function gridSegments(originX, originY, cellSize, cols, rows, startX, startY, endX, endY, lod) {
  const step = Math.max(1, lod)
  const top = originY + startY * cellSize
  const bottom = originY + Math.min(endY, rows) * cellSize
  const left = originX + startX * cellSize
  const right = originX + Math.min(endX, cols) * cellSize
  const segs = []

  const xFirst = Math.floor(startX / step) * step
  for (let x = xFirst; x <= endX && x <= cols; x += step) {
    const px = originX + x * cellSize
    segs.push({ x1: px, y1: top, x2: px, y2: bottom })
  }
  if (cols % step !== 0 && endX >= cols) {
    const px = originX + cols * cellSize
    segs.push({ x1: px, y1: top, x2: px, y2: bottom })
  }

  const yFirst = Math.floor(startY / step) * step
  for (let y = yFirst; y <= endY && y <= rows; y += step) {
    const py = originY + y * cellSize
    segs.push({ x1: left, y1: py, x2: right, y2: py })
  }
  if (rows % step !== 0 && endY >= rows) {
    const py = originY + rows * cellSize
    segs.push({ x1: left, y1: py, x2: right, y2: py })
  }
  return segs
}

export function axesGeometry(originX, originY, cellSize, cols, rows, centerCellAxes) {
  const throughCenter = !!centerCellAxes && cols % 2 === 1 && rows % 2 === 1
  const axisX = cartesianAxisPixel(cols, originX, cellSize, throughCenter)
  const axisY = cartesianAxisPixel(rows, originY, cellSize, throughCenter)
  return {
    axisX,
    axisY,
    left: originX,
    top: originY,
    right: originX + cols * cellSize,
    bottom: originY + rows * cellSize,
    originR: Math.max(3, Math.min(6, cellSize * 0.25)),
    lineWidth: Math.max(2, Math.min(3, cellSize * 0.15)),
  }
}

export function mapLod(cellSize) {
  return lodFactor(cellSize)
}

export { THEME_CANVAS }
