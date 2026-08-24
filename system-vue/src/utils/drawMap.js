/**
 * Desenho compartilhado do mapa (tela ao vivo e exportação PNG).
 *
 * Mapas grandes (até 500×500) pintam os blocos visíveis via ImageData
 * (1 pixel por bloco, depois escala sem smoothing). Grade e eixos
 * cartesianos são traçados por cima.
 */
import { getCellHex, hexToRgb, THEME_CANVAS } from '@/constants/palette.js'
import {
  collectUsedColors,
  drawLegend,
  LEGEND_MAP_GAP,
  LEGEND_PAD,
  measureLegendHeight,
} from '@/utils/legend.js'
import { clipCells, expandBrush } from '@/utils/shapes.js'

/**
 * Pinta o mapa no contexto 2D informado.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} options
 * @param {number[][]} options.grid
 * @param {Array<{ id: number, hex: string }>} options.colors
 * @param {Array<{ x: number, y: number }>} [options.previewCells]
 * @param {{ x: number, y: number } | null} [options.hoverBlock]
 * @param {number} [options.brushSize]
 * @param {number} options.originX  Pixel X do canto do bloco (0,0)
 * @param {number} options.originY  Pixel Y do canto do bloco (0,0)
 * @param {number} options.cellSize Tamanho de um bloco em pixels
 * @param {number} options.viewWidth
 * @param {number} options.viewHeight
 * @param {'day' | 'night'} options.theme
 * @param {boolean} [options.showPreview]
 * @param {boolean} [options.showHover]
 * @param {boolean} [options.showGrid]
 * @param {boolean} [options.showAxes]
 */
export function drawMap(ctx, options) {
  const {
    grid,
    colors,
    previewCells = [],
    hoverBlock = null,
    brushSize = 1,
    originX,
    originY,
    cellSize,
    viewWidth,
    viewHeight,
    theme,
    showPreview = true,
    showHover = true,
    showGrid = true,
    showAxes = true,
  } = options

  const rows = grid.length
  const cols = rows > 0 ? grid[0].length : 0
  const skin = THEME_CANVAS[theme] ?? THEME_CANVAS.night

  ctx.save()
  ctx.fillStyle = skin.background
  ctx.fillRect(0, 0, viewWidth, viewHeight)

  if (cols === 0 || rows === 0 || cellSize <= 0) {
    ctx.restore()
    return
  }

  const startX = Math.max(0, Math.floor((0 - originX) / cellSize))
  const startY = Math.max(0, Math.floor((0 - originY) / cellSize))
  const endX = Math.min(cols, Math.ceil((viewWidth - originX) / cellSize))
  const endY = Math.min(rows, Math.ceil((viewHeight - originY) / cellSize))
  const visW = Math.max(0, endX - startX)
  const visH = Math.max(0, endY - startY)

  if (visW > 0 && visH > 0) {
    paintCells(ctx, grid, colors, theme, startX, startY, visW, visH, originX, originY, cellSize)
  }

  if (showPreview && previewCells.length > 0) {
    ctx.fillStyle = skin.previewFill
    for (const cell of previewCells) {
      ctx.fillRect(originX + cell.x * cellSize, originY + cell.y * cellSize, cellSize, cellSize)
    }
    ctx.strokeStyle = skin.previewStroke
    ctx.lineWidth = Math.max(1, cellSize * 0.08)
    for (const cell of previewCells) {
      ctx.strokeRect(
        originX + cell.x * cellSize + 0.5,
        originY + cell.y * cellSize + 0.5,
        cellSize - 1,
        cellSize - 1,
      )
    }
  }

  if (showHover && hoverBlock) {
    const hoverCells = clipCells(expandBrush([hoverBlock], brushSize), cols, rows)
    ctx.fillStyle = skin.hover
    for (const cell of hoverCells) {
      ctx.fillRect(originX + cell.x * cellSize, originY + cell.y * cellSize, cellSize, cellSize)
    }
  }

  if (showGrid && cellSize >= 3) {
    drawGridLines(ctx, originX, originY, cellSize, cols, rows, startX, startY, endX, endY, skin.grid)
  }

  if (showAxes) {
    drawCartesianAxes(ctx, originX, originY, cellSize, cols, rows, skin)
  }

  ctx.restore()
}

/**
 * Pinta os blocos visíveis: 1 pixel por célula, depois escala.
 * @param {CanvasRenderingContext2D} ctx
 */
function paintCells(ctx, grid, colors, theme, startX, startY, visW, visH, originX, originY, cellSize) {
  const image = ctx.createImageData(visW, visH)
  const data = image.data

  for (let y = 0; y < visH; y += 1) {
    const row = grid[startY + y]
    for (let x = 0; x < visW; x += 1) {
      const hex = getCellHex(colors, row[startX + x], theme)
      const { r, g, b } = hexToRgb(hex)
      const i = (y * visW + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }

  const scratch = getScratchCanvas(visW, visH)
  scratch.ctx.putImageData(image, 0, 0)

  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    scratch.canvas,
    originX + startX * cellSize,
    originY + startY * cellSize,
    visW * cellSize,
    visH * cellSize,
  )
}

/** Canvas auxiliar reutilizado entre frames (evita alocar 500×500 toda hora). */
let scratch = null

/**
 * @param {number} width
 * @param {number} height
 */
function getScratchCanvas(width, height) {
  if (!scratch) {
    const canvas = document.createElement('canvas')
    scratch = { canvas, ctx: canvas.getContext('2d') }
  }
  if (scratch.canvas.width !== width || scratch.canvas.height !== height) {
    scratch.canvas.width = width
    scratch.canvas.height = height
  }
  return scratch
}

/**
 * Linhas da grade só na região visível.
 */
function drawGridLines(ctx, originX, originY, cellSize, cols, rows, startX, startY, endX, endY, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()

  const top = originY + startY * cellSize
  const bottom = originY + Math.min(endY, rows) * cellSize
  const left = originX + startX * cellSize
  const right = originX + Math.min(endX, cols) * cellSize

  for (let x = startX; x <= endX && x <= cols; x += 1) {
    const px = originX + x * cellSize + 0.5
    ctx.moveTo(px, top)
    ctx.lineTo(px, bottom)
  }
  for (let y = startY; y <= endY && y <= rows; y += 1) {
    const py = originY + y * cellSize + 0.5
    ctx.moveTo(left, py)
    ctx.lineTo(right, py)
  }
  ctx.stroke()
}

/**
 * Eixos cartesianos sobre a malha de blocos, sempre em uma linha da grade
 * (nunca no meio de um bloco). Em largura ímpar (ex.: 265) o corte fica
 * em floor(n/2): 132 blocos de um lado e 133 do outro, sem inventar célula.
 * O plano tem exatamente cols × rows; espaço extra na tela é só fundo,
 * não estica os eixos.
 *
 * @param {CanvasRenderingContext2D} ctx
 */
function drawCartesianAxes(ctx, originX, originY, cellSize, cols, rows, skin) {
  const midX = Math.floor(cols / 2)
  const midY = Math.floor(rows / 2)
  const axisX = originX + midX * cellSize
  const axisY = originY + midY * cellSize
  const left = originX
  const top = originY
  const right = originX + cols * cellSize
  const bottom = originY + rows * cellSize

  ctx.lineWidth = Math.max(2, Math.min(3, cellSize * 0.15))

  ctx.strokeStyle = skin.axisX
  ctx.beginPath()
  ctx.moveTo(left, axisY)
  ctx.lineTo(right, axisY)
  ctx.stroke()

  ctx.strokeStyle = skin.axisY
  ctx.beginPath()
  ctx.moveTo(axisX, top)
  ctx.lineTo(axisX, bottom)
  ctx.stroke()

  const originR = Math.max(3, Math.min(6, cellSize * 0.25))
  ctx.fillStyle = skin.origin
  ctx.beginPath()
  ctx.arc(axisX, axisY, originR, 0, Math.PI * 2)
  ctx.fill()

  const fontPx = Math.max(10, Math.min(14, cellSize * 0.9))
  ctx.font = `600 ${fontPx}px "Segoe UI", sans-serif`
  ctx.fillStyle = skin.label
  ctx.textBaseline = 'middle'

  const pad = Math.max(8, cellSize * 0.4)
  const q1x = (axisX + right) / 2
  const q2x = (left + axisX) / 2
  const qTop = (top + axisY) / 2
  const qBot = (axisY + bottom) / 2

  ctx.textAlign = 'center'
  ctx.fillText('Q1', q1x, qTop)
  ctx.fillText('Q2', q2x, qTop)
  ctx.fillText('Q3', q2x, qBot)
  ctx.fillText('Q4', q1x, qBot)

  ctx.font = `500 ${Math.max(9, fontPx - 1)}px "Cascadia Mono", Consolas, monospace`
  ctx.fillStyle = skin.axisX
  ctx.textAlign = 'right'
  ctx.fillText('+X', right - pad, axisY - pad)
  ctx.fillStyle = skin.axisY
  ctx.textAlign = 'left'
  ctx.fillText('+Y', axisX + pad, top + pad)
}

/**
 * Renderiza o mapa inteiro num canvas offscreen para PNG:
 * margem em todos os lados, grade, eixos e, abaixo, as tags das cores em uso.
 *
 * @param {object} options
 * @param {number[][]} options.grid
 * @param {Array<{ id: number, name: string, hex: string }>} options.colors
 * @param {'day' | 'night'} options.theme
 * @returns {HTMLCanvasElement}
 */
export function renderMapToCanvas(options) {
  const rows = options.grid.length
  const cols = rows > 0 ? options.grid[0].length : 1
  const maxPx = 4096
  const cellSize = Math.max(6, Math.min(16, Math.floor(maxPx / Math.max(cols, rows))))
  const mapW = cols * cellSize
  const mapH = rows * cellSize
  const used = collectUsedColors(options.grid, options.colors)

  const measure = document.createElement('canvas').getContext('2d')
  const legendH = measureLegendHeight(measure, used, mapW)
  const gap = legendH > 0 ? LEGEND_MAP_GAP : 0

  const canvas = document.createElement('canvas')
  canvas.width = mapW + LEGEND_PAD * 2
  canvas.height = mapH + LEGEND_PAD * 2 + gap + legendH
  const ctx = canvas.getContext('2d')
  const skin = THEME_CANVAS[options.theme] ?? THEME_CANVAS.night

  ctx.fillStyle = skin.background
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.save()
  ctx.translate(LEGEND_PAD, LEGEND_PAD)
  drawMap(ctx, {
    grid: options.grid,
    colors: options.colors,
    originX: 0,
    originY: 0,
    cellSize,
    viewWidth: mapW,
    viewHeight: mapH,
    theme: options.theme,
    showPreview: false,
    showHover: false,
    showGrid: true,
    showAxes: true,
  })
  ctx.restore()

  if (legendH > 0) {
    drawLegend(ctx, {
      items: used,
      x: LEGEND_PAD,
      y: LEGEND_PAD + mapH + gap,
      maxWidth: mapW,
      theme: options.theme,
    })
  }

  return canvas
}
