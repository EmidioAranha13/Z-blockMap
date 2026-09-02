/**
 * Conversão entre coordenadas de tela (pixels) e coordenadas de bloco (x, y),
 * levando em conta origem (pan) e tamanho do bloco (zoom).
 */
import { MIN_CELL_FOR_GRID } from '../constants/limits.js'

/**
 * Tamanho que faria o mapa inteiro caber na área (pode ser menor que 1 px).
 *
 * @param {number} areaWidth
 * @param {number} areaHeight
 * @param {number} cols
 * @param {number} rows
 * @param {number} padding
 * @returns {number}
 */
export function fitCellSize(areaWidth, areaHeight, cols, rows, padding = 12) {
  if (cols <= 0 || rows <= 0) return MIN_CELL_FOR_GRID
  const innerW = Math.max(1, areaWidth - padding * 2)
  const innerH = Math.max(1, areaHeight - padding * 2)
  return Math.min(innerW / cols, innerH / rows)
}

/**
 * Tamanho de bloco usado no zoom 1: nunca abaixo de MIN_CELL_FOR_GRID,
 * para a malha continuar visível em mapas grandes. O mapa pode transbordar
 * a área; o usuário move com o botão direito.
 *
 * @param {number} areaWidth
 * @param {number} areaHeight
 * @param {number} cols
 * @param {number} rows
 * @returns {number}
 */
export function readableCellSize(areaWidth, areaHeight, cols, rows) {
  return Math.max(fitCellSize(areaWidth, areaHeight, cols, rows), MIN_CELL_FOR_GRID)
}

/**
 * Posição em pixels de um eixo cartesiano (linha da grade ou centro do bloco).
 *
 * Padrão: sobre a linha da malha em floor(n/2) — em ímpar fica 132 | 133.
 * Com throughCenterCell (só ímpar): pelo centro do bloco do meio — 135 | 1 | 135.
 *
 * @param {number} count cols ou rows
 * @param {number} origin pixel do canto do bloco (0,0)
 * @param {number} cellSize
 * @param {boolean} throughCenterCell
 */
export function cartesianAxisPixel(count, origin, cellSize, throughCenterCell) {
  const mid = Math.floor(count / 2)
  if (throughCenterCell && count % 2 === 1) {
    return origin + mid * cellSize + cellSize / 2
  }
  return origin + mid * cellSize
}

/**
 * Espelha a coluna X pelo eixo vertical do cartesiano (direita ↔ esquerda).
 *
 * @param {number} x
 * @param {number} cols
 * @param {boolean} centerCellAxes
 * @returns {number}
 */
export function mirrorWorldX(x, cols, centerCellAxes) {
  const mid = Math.floor(cols / 2)
  if (centerCellAxes && cols % 2 === 1) {
    return 2 * mid - x
  }
  return 2 * mid - x - 1
}

/**
 * Espelha a linha Y pelo eixo horizontal do cartesiano (cima ↔ baixo).
 *
 * @param {number} y
 * @param {number} rows
 * @param {boolean} centerCellAxes
 * @returns {number}
 */
export function mirrorWorldY(y, rows, centerCellAxes) {
  const mid = Math.floor(rows / 2)
  if (centerCellAxes && rows % 2 === 1) {
    return 2 * mid - y
  }
  return 2 * mid - y - 1
}

/**
 * Acrescenta os blocos espelhados em X. Não altera Y.
 *
 * @param {Array<{ x: number, y: number }>} cells
 * @param {number} cols
 * @param {boolean} enabled
 * @param {boolean} centerCellAxes
 * @returns {Array<{ x: number, y: number }>}
 */
export function withMirrorX(cells, cols, enabled, centerCellAxes) {
  if (!enabled || cols <= 0) return cells
  const seen = new Set()
  const out = []
  for (const cell of cells) {
    const key = `${cell.x},${cell.y}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push(cell)
    }
    const mx = mirrorWorldX(cell.x, cols, centerCellAxes)
    if (mx < 0 || mx >= cols) continue
    const mirrorKey = `${mx},${cell.y}`
    if (seen.has(mirrorKey)) continue
    seen.add(mirrorKey)
    out.push({ x: mx, y: cell.y })
  }
  return out
}

/**
 * Acrescenta os blocos espelhados em Y. Não altera X.
 * Q1 ↔ Q4 e Q2 ↔ Q3.
 *
 * @param {Array<{ x: number, y: number }>} cells
 * @param {number} rows
 * @param {boolean} enabled
 * @param {boolean} centerCellAxes
 * @returns {Array<{ x: number, y: number }>}
 */
export function withMirrorY(cells, rows, enabled, centerCellAxes) {
  if (!enabled || rows <= 0) return cells
  const seen = new Set()
  const out = []
  for (const cell of cells) {
    const key = `${cell.x},${cell.y}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push(cell)
    }
    const my = mirrorWorldY(cell.y, rows, centerCellAxes)
    if (my < 0 || my >= rows) continue
    const mirrorKey = `${cell.x},${my}`
    if (seen.has(mirrorKey)) continue
    seen.add(mirrorKey)
    out.push({ x: cell.x, y: my })
  }
  return out
}

/**
 * Aplica simetria horizontal e/ou vertical. Com as duas, gera as quatro cópias.
 *
 * @param {Array<{ x: number, y: number }>} cells
 * @param {number} cols
 * @param {number} rows
 * @param {boolean} mirrorX
 * @param {boolean} mirrorY
 * @param {boolean} centerCellAxes
 */
export function withMirrors(cells, cols, rows, mirrorX, mirrorY, centerCellAxes) {
  let out = cells
  if (mirrorX) out = withMirrorX(out, cols, true, centerCellAxes)
  if (mirrorY) out = withMirrorY(out, rows, true, centerCellAxes)
  return out
}

/**
 * Origem (pixel do bloco 0,0) para centralizar a grade no canvas, no zoom 1.
 *
 * @param {number} areaWidth
 * @param {number} areaHeight
 * @param {number} cols
 * @param {number} rows
 * @param {number} cellSize
 */
export function centeredOrigin(areaWidth, areaHeight, cols, rows, cellSize) {
  return {
    x: (areaWidth - cols * cellSize) / 2,
    y: (areaHeight - rows * cellSize) / 2,
  }
}

/**
 * Converte a posição do ponteiro em um bloco da grade.
 * Devolve null se o cursor estiver fora do mapa desenhado.
 *
 * @param {PointerEvent} event
 * @param {HTMLCanvasElement} canvas
 * @param {number} cellSize
 * @param {number} originX
 * @param {number} originY
 * @param {number} cols
 * @param {number} rows
 * @returns {{ x: number, y: number } | null}
 */
export function pointerToBlock(event, canvas, cellSize, originX, originY, cols, rows) {
  const rect = canvas.getBoundingClientRect()
  const px = event.clientX - rect.left - originX
  const py = event.clientY - rect.top - originY

  if (cellSize <= 0) return null

  const x = Math.floor(px / cellSize)
  const y = Math.floor(py / cellSize)

  if (x < 0 || y < 0 || x >= cols || y >= rows) return null
  return { x, y }
}

/**
 * Igual ao pointerToBlock, mas prende o resultado nas bordas do cartesiano.
 * Usado em linha/círculo/mover: a forma não cresce para fora do mapa;
 * ao voltar o cursor, o tamanho diminui de novo.
 *
 * @param {PointerEvent} event
 * @param {HTMLCanvasElement} canvas
 * @param {number} cellSize
 * @param {number} originX
 * @param {number} originY
 * @param {number} cols
 * @param {number} rows
 * @returns {{ x: number, y: number } | null}
 */
export function pointerToBlockClamped(event, canvas, cellSize, originX, originY, cols, rows) {
  if (cols <= 0 || rows <= 0 || cellSize <= 0) return null
  const rect = canvas.getBoundingClientRect()
  const px = event.clientX - rect.left - originX
  const py = event.clientY - rect.top - originY
  const x = Math.min(cols - 1, Math.max(0, Math.floor(px / cellSize)))
  const y = Math.min(rows - 1, Math.max(0, Math.floor(py / cellSize)))
  return { x, y }
}

/**
 * Ponto do canvas (CSS px) a partir de um PointerEvent / WheelEvent.
 * @param {PointerEvent | WheelEvent} event
 * @param {HTMLCanvasElement} canvas
 */
export function eventToCanvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

/**
 * Recalcula a origem para que o ponto do mapa sob o cursor continue
 * no mesmo pixel da tela depois de mudar o zoom.
 *
 * @param {number} canvasX
 * @param {number} canvasY
 * @param {number} originX
 * @param {number} originY
 * @param {number} oldCellSize
 * @param {number} newCellSize
 */
export function originAfterZoom(canvasX, canvasY, originX, originY, oldCellSize, newCellSize) {
  if (oldCellSize <= 0) return { x: originX, y: originY }
  const worldX = (canvasX - originX) / oldCellSize
  const worldY = (canvasY - originY) / oldCellSize
  return {
    x: canvasX - worldX * newCellSize,
    y: canvasY - worldY * newCellSize,
  }
}

/**
 * Gera uma chave de texto para um bloco, útil em Sets de "já visitei neste traço".
 * @param {number} x
 * @param {number} y
 * @returns {string}
 */
export function blockKey(x, y) {
  return `${x},${y}`
}

/**
 * Bloco sob um ponto local do canvas (toque).
 * @param {number} px
 * @param {number} py
 * @param {number} cellSize
 * @param {number} originX
 * @param {number} originY
 * @param {number} cols
 * @param {number} rows
 * @returns {{ x: number, y: number } | null}
 */
export function xyToBlock(px, py, cellSize, originX, originY, cols, rows) {
  if (cellSize <= 0) return null
  const x = Math.floor((px - originX) / cellSize)
  const y = Math.floor((py - originY) / cellSize)
  if (x < 0 || y < 0 || x >= cols || y >= rows) return null
  return { x, y }
}

/**
 * Igual a xyToBlock, preso nas bordas do mapa.
 */
export function xyToBlockClamped(px, py, cellSize, originX, originY, cols, rows) {
  if (cols <= 0 || rows <= 0 || cellSize <= 0) return null
  const x = Math.min(cols - 1, Math.max(0, Math.floor((px - originX) / cellSize)))
  const y = Math.min(rows - 1, Math.max(0, Math.floor((py - originY) / cellSize)))
  return { x, y }
}

/**
 * Células que o cursor atravessa entre dois pontos do canvas.
 *
 * @returns {Array<{ x: number, y: number }>}
 */
export function blocksAlongCanvasSegment(
  x0,
  y0,
  x1,
  y1,
  originX,
  originY,
  cellSize,
  cols,
  rows,
  clamp = false,
) {
  if (cellSize <= 0 || cols <= 0 || rows <= 0) return []
  const gx0 = (x0 - originX) / cellSize
  const gy0 = (y0 - originY) / cellSize
  const gx1 = (x1 - originX) / cellSize
  const gy1 = (y1 - originY) / cellSize
  const dgx = gx1 - gx0
  const dgy = gy1 - gy0
  const steps = Math.max(1, Math.ceil(Math.abs(dgx) + Math.abs(dgy)))
  const out = []
  let lastKey = ''
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    let x = Math.floor(gx0 + dgx * t)
    let y = Math.floor(gy0 + dgy * t)
    if (clamp) {
      x = Math.min(cols - 1, Math.max(0, x))
      y = Math.min(rows - 1, Math.max(0, y))
    } else if (x < 0 || y < 0 || x >= cols || y >= rows) {
      continue
    }
    const key = `${x},${y}`
    if (key === lastKey) continue
    lastKey = key
    out.push({ x, y })
  }
  return out
}
