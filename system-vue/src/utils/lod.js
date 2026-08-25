/**
 * Nível de detalhe (LOD) só da renderização.
 *
 * A matriz continua na resolução real. Há duas camadas:
 *  - Grade: linhas a cada N células quando o zoom está distante.
 *  - Conteúdo: o desenho é uma versão em menor resolução da matriz,
 *    não um bloco de uma cor só. O vazio não apaga linhas finas.
 */
import { getCellHex, hexToRgb } from '@/constants/palette.js'
import { MIN_CELL_FOR_GRID } from '@/constants/limits.js'

/**
 * Fator N do agrupamento da malha: um quadrado da grade cobre N×N células.
 * 1 = uma linha por célula. Não altera as cores do desenho.
 *
 * @param {number} cellSize Pixels que uma célula da matriz ocuparia na tela
 * @param {number} [minPx=MIN_CELL_FOR_GRID]
 * @returns {number}
 */
export function lodFactor(cellSize, minPx = MIN_CELL_FOR_GRID) {
  if (!(cellSize > 0) || !(minPx > 0)) return 1
  return Math.max(1, Math.ceil(minPx / cellSize))
}

/**
 * Cor de um retângulo da matriz ao reduzir para 1 pixel de tela (pixel art).
 *
 * O vazio (id 0) só aparece se não houver nenhuma célula pintada — assim uma
 * linha de 1 bloco em 8×8 de vazio continua visível. Entre cores pintadas,
 * usa a média das pintadas e escolhe a cor da paleta mais próxima (não cria
 * tons novos e não deixa a majoritária apagar um detalhe contrastante se a
 * média puxar para ele).
 *
 * @param {number[][]} grid
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1 Exclusive
 * @param {number} y1 Exclusive
 * @param {(id: number) => { r: number, g: number, b: number }} rgbOf
 * @param {Map<number, number>} paintedCounts Reutilizado entre pixels (evita GC)
 * @returns {{ r: number, g: number, b: number }}
 */
export function downsampleBoxRgb(grid, x0, y0, x1, y1, rgbOf, paintedCounts) {
  paintedCounts.clear()
  let paintCount = 0
  let sumR = 0
  let sumG = 0
  let sumB = 0

  for (let y = y0; y < y1; y += 1) {
    const row = grid[y]
    if (!row) continue
    for (let x = x0; x < x1; x += 1) {
      const id = row[x]
      if (id === 0) continue
      paintCount += 1
      paintedCounts.set(id, (paintedCounts.get(id) || 0) + 1)
      const rgb = rgbOf(id)
      sumR += rgb.r
      sumG += rgb.g
      sumB += rgb.b
    }
  }

  if (paintCount === 0) return rgbOf(0)

  const avgR = sumR / paintCount
  const avgG = sumG / paintCount
  const avgB = sumB / paintCount

  let bestId = 0
  let bestScore = Infinity
  for (const [id, n] of paintedCounts) {
    const rgb = rgbOf(id)
    const dist = (rgb.r - avgR) ** 2 + (rgb.g - avgG) ** 2 + (rgb.b - avgB) ** 2
    // Distância à média; empate: cor mais frequente (estável).
    const score = dist - n * 1e-6
    if (score < bestScore) {
      bestScore = score
      bestId = id
    }
  }
  return rgbOf(bestId)
}

/**
 * Cache id → RGB para não recalcular hex a cada célula.
 *
 * @param {Array<{ id: number, hex: string }>} colors
 * @param {'dark' | 'light'} theme
 * @returns {(id: number) => { r: number, g: number, b: number }}
 */
export function makeRgbLookup(colors, theme) {
  const cache = new Map()
  return (id) => {
    const hit = cache.get(id)
    if (hit) return hit
    const rgb = hexToRgb(getCellHex(colors, id, theme))
    cache.set(id, rgb)
    return rgb
  }
}

/**
 * Converte células da matriz nos retângulos visuais da malha LOD.
 * Usado no hover/preview: o ponteiro ainda aponta para (x, y) reais.
 *
 * @param {Array<{ x: number, y: number }>} cells
 * @param {number} lod
 * @param {number} cols
 * @param {number} rows
 * @returns {Array<{ x: number, y: number, w: number, h: number }>}
 */
export function cellsToLodRects(cells, lod, cols, rows) {
  const step = Math.max(1, lod)
  if (step === 1) {
    return cells.map((cell) => ({ x: cell.x, y: cell.y, w: 1, h: 1 }))
  }

  const seen = new Set()
  const rects = []
  for (const cell of cells) {
    const x = Math.floor(cell.x / step) * step
    const y = Math.floor(cell.y / step) * step
    const key = `${x},${y}`
    if (seen.has(key)) continue
    seen.add(key)
    rects.push({
      x,
      y,
      w: Math.min(step, cols - x),
      h: Math.min(step, rows - y),
    })
  }
  return rects
}
