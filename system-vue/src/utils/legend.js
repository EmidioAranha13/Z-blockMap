/**
 * Legenda visual do PNG: tags estilo mapa geográfico.
 *
 * Cada cor em uso vira uma etiqueta [hex] Nome — o retângulo colorido
 * traz o hexadecimal escrito dentro; o nome fica ao lado.
 * Os tamanhos acompanham a largura do mapa para o texto continuar legível.
 */
import { contrastInk, findColor, THEME_CANVAS } from '@/constants/palette.js'

const PAD = 48
const MAP_LEGEND_GAP = 36

/**
 * Escala da legenda em função da largura do mapa exportado.
 * Fontes fixas (12–13 px) ficavam ilegíveis em mapas grandes.
 *
 * @param {number} mapWidth
 */
function legendMetrics(mapWidth) {
  const hexPx = Math.round(Math.max(22, Math.min(56, mapWidth * 0.024)))
  const namePx = Math.round(hexPx * 1.12)
  return {
    hexPx,
    namePx,
    tagH: Math.round(namePx * 2.15),
    tagPadX: Math.round(hexPx * 0.7),
    nameGap: Math.round(hexPx * 0.7),
    tagGap: Math.round(hexPx * 1.1),
    rowGap: Math.round(namePx * 0.7),
    radius: Math.max(8, Math.round(hexPx * 0.35)),
  }
}

/**
 * Cores realmente pintadas na grade, na ordem da paleta.
 * O vazio (id 0) não entra: é só fundo, não uma categoria do mapa.
 *
 * @param {number[][]} grid
 * @param {Array<{ id: number, name: string, hex: string }>} colors
 * @returns {Array<{ id: number, name: string, hex: string }>}
 */
export function collectUsedColors(grid, colors) {
  const used = new Set()
  for (const row of grid) {
    for (const id of row) {
      if (id !== 0) used.add(id)
    }
  }

  const list = []
  for (const color of colors) {
    if (!used.has(color.id)) continue
    list.push({ id: color.id, name: color.name, hex: color.hex })
    used.delete(color.id)
  }

  for (const id of used) {
    const found = findColor(colors, id)
    list.push({
      id,
      name: found?.name || `Cor ${id}`,
      hex: found?.hex || '#888888',
    })
  }

  return list
}

/**
 * Mede uma tag: caixa do hex + nome ao lado.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ name: string, hex: string }} item
 * @param {ReturnType<typeof legendMetrics>} metrics
 */
function measureTag(ctx, item, metrics) {
  ctx.font = `700 ${metrics.hexPx}px "Cascadia Mono", Consolas, monospace`
  const hexW = ctx.measureText(item.hex).width
  const boxW = Math.ceil(hexW) + metrics.tagPadX * 2
  ctx.font = `700 ${metrics.namePx}px "Segoe UI", sans-serif`
  const nameW = ctx.measureText(item.name).width
  return {
    boxW,
    width: boxW + metrics.nameGap + nameW,
    height: metrics.tagH,
  }
}

/**
 * Quebra as tags em linhas que cabem na largura do mapa.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{ name: string, hex: string }>} items
 * @param {number} maxWidth
 * @param {ReturnType<typeof legendMetrics>} metrics
 */
function layoutRows(ctx, items, maxWidth, metrics) {
  const rows = []
  let current = []
  let rowWidth = 0

  for (const item of items) {
    const size = measureTag(ctx, item, metrics)
    const extra = current.length === 0 ? 0 : metrics.tagGap
    if (current.length > 0 && rowWidth + extra + size.width > maxWidth) {
      rows.push({ items: current, width: rowWidth })
      current = []
      rowWidth = 0
    }
    if (current.length > 0) rowWidth += metrics.tagGap
    current.push({ item, size })
    rowWidth += size.width
  }

  if (current.length > 0) {
    rows.push({ items: current, width: rowWidth })
  }

  return rows
}

/**
 * Altura total da faixa de legendas (0 se não houver cores em uso).
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{ name: string, hex: string }>} items
 * @param {number} maxWidth
 */
export function measureLegendHeight(ctx, items, maxWidth) {
  if (items.length === 0) return 0
  const metrics = legendMetrics(maxWidth)
  const rows = layoutRows(ctx, items, maxWidth, metrics)
  return rows.length * metrics.tagH + Math.max(0, rows.length - 1) * metrics.rowGap
}

/**
 * Desenha as tags abaixo do mapa, alinhadas à esquerda da área do mapa.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} options
 * @param {Array<{ name: string, hex: string }>} options.items
 * @param {number} options.x
 * @param {number} options.y
 * @param {number} options.maxWidth
 * @param {'day' | 'night'} options.theme
 */
export function drawLegend(ctx, options) {
  const { items, x, y, maxWidth, theme } = options
  if (items.length === 0) return

  const metrics = legendMetrics(maxWidth)
  const skin = THEME_CANVAS[theme] ?? THEME_CANVAS.night
  const rows = layoutRows(ctx, items, maxWidth, metrics)
  let cursorY = y

  ctx.textBaseline = 'middle'

  for (const row of rows) {
    let cursorX = x
    for (const { item, size } of row.items) {
      const boxH = metrics.tagH

      ctx.fillStyle = item.hex
      roundRect(ctx, cursorX, cursorY, size.boxW, boxH, metrics.radius)
      ctx.fill()

      ctx.font = `700 ${metrics.hexPx}px "Cascadia Mono", Consolas, monospace`
      ctx.fillStyle = contrastInk(item.hex)
      ctx.textAlign = 'center'
      ctx.fillText(item.hex, cursorX + size.boxW / 2, cursorY + boxH / 2)

      ctx.font = `700 ${metrics.namePx}px "Segoe UI", sans-serif`
      ctx.fillStyle = skin.label
      ctx.textAlign = 'left'
      ctx.fillText(item.name, cursorX + size.boxW + metrics.nameGap, cursorY + boxH / 2)

      cursorX += size.width + metrics.tagGap
    }
    cursorY += metrics.tagH + metrics.rowGap
  }
}

/**
 * Retângulo com cantos arredondados (a “tag” da cor).
 * @param {CanvasRenderingContext2D} ctx
 */
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export const LEGEND_PAD = PAD
export const LEGEND_MAP_GAP = MAP_LEGEND_GAP
