/**
 * Rasterização de formas em coordenadas de bloco.
 *
 * Módulo compartilhado entre system-vue e system-react-native.
 * Quem chama deve filtrar os pontos que caem fora do mapa (ver clipCells),
 * salvo quando o próprio rasterizador já recorta.
 */

import { THICKNESS, TOOLS } from './tools.js'

const CARDINALS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

const STAR_INNER = (3 - Math.sqrt(5)) / 2

function cellKey(x, y) {
  return `${x},${y}`
}

/**
 * Remove duplicatas e pontos fora do retângulo [0, width) x [0, height).
 * @param {Array<{ x: number, y: number }>} cells
 * @param {number} width
 * @param {number} height
 * @returns {Array<{ x: number, y: number }>}
 */
export function clipCells(cells, width, height) {
  const seen = new Set()
  const result = []

  for (const cell of cells) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) {
      continue
    }
    const key = cellKey(cell.x, cell.y)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(cell)
  }

  return result
}

function uniqueCells(cells) {
  const seen = new Set()
  const result = []
  for (const cell of cells) {
    const key = cellKey(cell.x, cell.y)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(cell)
  }
  return result
}

function anyOutsideMap(cells, width, height) {
  for (const cell of cells) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) return true
  }
  return false
}

/**
 * Algoritmo de Bresenham: todos os blocos de uma linha reta entre dois pontos.
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {Array<{ x: number, y: number }>}
 */
export function getLineCells(x0, y0, x1, y1) {
  const cells = []
  let x = x0
  let y = y0
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let error = dx - dy

  while (true) {
    cells.push({ x, y })
    if (x === x1 && y === y1) break

    const doubled = 2 * error
    if (doubled > -dy) {
      error -= dy
      x += sx
    }
    if (doubled < dx) {
      error += dx
      y += sy
    }
  }

  return cells
}

function boundsOf(x0, y0, x1, y1) {
  const minX = Math.min(x0, x1)
  const maxX = Math.max(x0, x1)
  const minY = Math.min(y0, y1)
  const maxY = Math.max(y0, y1)
  return { minX, maxX, minY, maxY }
}

/**
 * Elipse (ou círculo) inscrita no retângulo de blocos entre origem e destino.
 * O clique inicial é um canto da caixa; o cursor é o canto oposto. Se |dx|
 * e |dy| forem iguais, a forma é um círculo; senão, uma elipse.
 *
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number, cx: number, cy: number, rx: number, ry: number }}
 */
function ellipseBox(x0, y0, x1, y1) {
  const box = boundsOf(x0, y0, x1, y1)
  const width = box.maxX - box.minX + 1
  const height = box.maxY - box.minY + 1
  return {
    ...box,
    cx: box.minX + width / 2,
    cy: box.minY + height / 2,
    rx: width / 2,
    ry: height / 2,
  }
}

function cellInsideEllipse(x, y, box) {
  if (box.rx <= 0 || box.ry <= 0) return x === Math.floor(box.cx) && y === Math.floor(box.cy)
  const nx = (x + 0.5 - box.cx) / box.rx
  const ny = (y + 0.5 - box.cy) / box.ry
  return nx * nx + ny * ny <= 1
}

/**
 * Contorno da elipse/círculo definido pelos cantos (x0,y0) e (x1,y1).
 */
export function getEllipseOutlineCells(x0, y0, x1, y1) {
  return outlineOfFilled(getEllipseFilledCells(x0, y0, x1, y1))
}

/**
 * Elipse/círculo preenchido definido pelos cantos (x0,y0) e (x1,y1).
 */
export function getEllipseFilledCells(x0, y0, x1, y1) {
  const box = ellipseBox(x0, y0, x1, y1)
  const cells = []

  for (let y = box.minY; y <= box.maxY; y += 1) {
    for (let x = box.minX; x <= box.maxX; x += 1) {
      if (cellInsideEllipse(x, y, box)) cells.push({ x, y })
    }
  }

  return cells.length ? cells : [{ x: box.minX, y: box.minY }]
}

export function getRectFilledCells(x0, y0, x1, y1) {
  const box = boundsOf(x0, y0, x1, y1)
  const cells = []
  for (let y = box.minY; y <= box.maxY; y += 1) {
    for (let x = box.minX; x <= box.maxX; x += 1) {
      cells.push({ x, y })
    }
  }
  return cells
}

export function getRectOutlineCells(x0, y0, x1, y1) {
  return outlineOfFilled(getRectFilledCells(x0, y0, x1, y1))
}

function pointInPolygon(px, py, verts) {
  let inside = false
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i, i += 1) {
    const xi = verts[i].x
    const yi = verts[i].y
    const xj = verts[j].x
    const yj = verts[j].y
    const crosses = yi > py !== yj > py
    if (crosses && px < ((xj - xi) * (py - yi)) / (yj - yi || Number.EPSILON) + xi) {
      inside = !inside
    }
  }
  return inside
}

function polygonVertices(n, box, innerRatio = 1) {
  const verts = []
  const steps = innerRatio === 1 ? n : n * 2
  for (let i = 0; i < steps; i += 1) {
    const ratio = innerRatio === 1 || i % 2 === 0 ? 1 : innerRatio
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / steps
    verts.push({
      x: box.cx + box.rx * ratio * Math.cos(angle),
      y: box.cy + box.ry * ratio * Math.sin(angle),
    })
  }
  return verts
}

function rasterizePolygon(verts, box) {
  const cells = []
  for (let y = box.minY; y <= box.maxY; y += 1) {
    for (let x = box.minX; x <= box.maxX; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, verts)) cells.push({ x, y })
    }
  }
  if (cells.length) return cells

  const edge = []
  for (let i = 0; i < verts.length; i += 1) {
    const a = verts[i]
    const b = verts[(i + 1) % verts.length]
    edge.push(
      ...getLineCells(Math.round(a.x - 0.5), Math.round(a.y - 0.5), Math.round(b.x - 0.5), Math.round(b.y - 0.5)),
    )
  }
  return uniqueCells(edge)
}

export function getPentagonFilledCells(x0, y0, x1, y1) {
  const box = ellipseBox(x0, y0, x1, y1)
  return rasterizePolygon(polygonVertices(5, box), box)
}

export function getPentagonOutlineCells(x0, y0, x1, y1) {
  return outlineOfFilled(getPentagonFilledCells(x0, y0, x1, y1))
}

export function getStarFilledCells(x0, y0, x1, y1) {
  const box = ellipseBox(x0, y0, x1, y1)
  return rasterizePolygon(polygonVertices(5, box, STAR_INNER), box)
}

export function getStarOutlineCells(x0, y0, x1, y1) {
  return outlineOfFilled(getStarFilledCells(x0, y0, x1, y1))
}

function outlineOfFilled(filled) {
  const inside = new Set(filled.map((cell) => cellKey(cell.x, cell.y)))
  const outline = []
  for (const cell of filled) {
    const edge =
      !inside.has(cellKey(cell.x - 1, cell.y)) ||
      !inside.has(cellKey(cell.x + 1, cell.y)) ||
      !inside.has(cellKey(cell.x, cell.y - 1)) ||
      !inside.has(cellKey(cell.x, cell.y + 1))
    if (edge) outline.push(cell)
  }
  return outline
}

/**
 * Caixa centrada na origem do cartesiano.
 * sizeX e sizeY são a largura e a altura em blocos (já limitadas ao mapa).
 */
export function originCenteredEllipseBox(cols, rows, sizeX, sizeY, centerCellAxes) {
  const w = Math.min(cols, Math.max(1, Math.floor(Number(sizeX)) || 1))
  const h = Math.min(rows, Math.max(1, Math.floor(Number(sizeY)) || 1))
  const midX = Math.floor(cols / 2)
  const midY = Math.floor(rows / 2)
  const throughX = !!centerCellAxes && cols % 2 === 1
  const throughY = !!centerCellAxes && rows % 2 === 1
  const x0 = throughX ? midX - Math.floor((w - 1) / 2) : midX - Math.floor(w / 2)
  const y0 = throughY ? midY - Math.floor((h - 1) / 2) : midY - Math.floor(h / 2)
  return { x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 }
}

export const originCenteredBox = originCenteredEllipseBox

/**
 * Expande cada bloco para um carimbo de size×size (1, 2 ou 3).
 * Usado pelo pincel/borracha e pelo arrasto livre das formas.
 */
export function expandBrush(cells, size) {
  const stamp = Math.max(1, Math.min(3, Math.floor(size) || 1))
  if (stamp === 1) return cells
  const originOffset = stamp === 3 ? -1 : 0
  const out = []
  for (const cell of cells) {
    for (let dy = 0; dy < stamp; dy += 1) {
      for (let dx = 0; dx < stamp; dx += 1) {
        out.push({ x: cell.x + originOffset + dx, y: cell.y + originOffset + dy })
      }
    }
  }
  return out
}

export function getFilledCells(tool, x0, y0, x1, y1) {
  if (tool === TOOLS.LINE) return getLineCells(x0, y0, x1, y1)
  if (tool === TOOLS.CIRCLE) return getEllipseFilledCells(x0, y0, x1, y1)
  if (tool === TOOLS.SQUARE) return getRectFilledCells(x0, y0, x1, y1)
  if (tool === TOOLS.PENTAGON) return getPentagonFilledCells(x0, y0, x1, y1)
  if (tool === TOOLS.STAR) return getStarFilledCells(x0, y0, x1, y1)
  return []
}

export function getOutlineCells(tool, x0, y0, x1, y1) {
  if (tool === TOOLS.LINE) return getLineCells(x0, y0, x1, y1)
  if (tool === TOOLS.CIRCLE) return getEllipseOutlineCells(x0, y0, x1, y1)
  if (tool === TOOLS.SQUARE) return getRectOutlineCells(x0, y0, x1, y1)
  if (tool === TOOLS.PENTAGON) return getPentagonOutlineCells(x0, y0, x1, y1)
  if (tool === TOOLS.STAR) return getStarOutlineCells(x0, y0, x1, y1)
  return []
}

/**
 * Parte o total de pixels da espessura entre interior e exterior.
 * O contorno original conta como 1 px do total.
 * Em Centralizada, o pixel extra de uma espessura par vai para fora.
 *
 * @param {number} thickness
 * @param {string} orientation
 * @returns {{ total: number, inward: number, outward: number }}
 */
export function splitThickness(thickness, orientation) {
  const total = Math.max(1, Math.floor(Number(thickness)) || 1)
  if (orientation === THICKNESS.INWARD) return { total, inward: total - 1, outward: 0 }
  if (orientation === THICKNESS.OUTWARD) return { total, inward: 0, outward: total - 1 }
  const inward = Math.floor((total - 1) / 2)
  return { total, inward, outward: total - 1 - inward }
}

function manhattanFromSeeds(seeds, minX, maxX, minY, maxY) {
  const dist = new Map()
  const queue = []
  for (const seed of seeds) {
    if (seed.x < minX || seed.x > maxX || seed.y < minY || seed.y > maxY) continue
    const key = cellKey(seed.x, seed.y)
    if (dist.has(key)) continue
    dist.set(key, 0)
    queue.push(seed.x, seed.y)
  }

  for (let i = 0; i < queue.length; ) {
    const x = queue[i]
    const y = queue[i + 1]
    i += 2
    const d = dist.get(cellKey(x, y))
    for (const [dx, dy] of CARDINALS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue
      const key = cellKey(nx, ny)
      if (dist.has(key)) continue
      dist.set(key, d + 1)
      queue.push(nx, ny)
    }
  }

  return dist
}

/**
 * Espessura de um contorno fechado. O pixel do contorno faz parte do total.
 */
function thickenClosed(filled, thickness, orientation) {
  const { inward, outward } = splitThickness(thickness, orientation)
  const filledSet = new Set(filled.map((cell) => cellKey(cell.x, cell.y)))
  if (inward === 0 && outward === 0) return outlineOfFilled(filled)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const cell of filled) {
    if (cell.x < minX) minX = cell.x
    if (cell.x > maxX) maxX = cell.x
    if (cell.y < minY) minY = cell.y
    if (cell.y > maxY) maxY = cell.y
  }

  const pad = Math.max(outward, 1)
  const searchMinX = minX - pad
  const searchMaxX = maxX + pad
  const searchMinY = minY - pad
  const searchMaxY = maxY + pad

  const complementSeeds = []
  for (let y = searchMinY; y <= searchMaxY; y += 1) {
    for (let x = searchMinX; x <= searchMaxX; x += 1) {
      if (!filledSet.has(cellKey(x, y))) complementSeeds.push({ x, y })
    }
  }

  const distIn = manhattanFromSeeds(complementSeeds, minX - 1, maxX + 1, minY - 1, maxY + 1)
  const distOut = manhattanFromSeeds(filled, searchMinX, searchMaxX, searchMinY, searchMaxY)
  const result = []
  const seen = new Set()

  function add(x, y) {
    const key = cellKey(x, y)
    if (seen.has(key)) return
    seen.add(key)
    result.push({ x, y })
  }

  for (const cell of filled) {
    const d = distIn.get(cellKey(cell.x, cell.y))
    if (d !== undefined && d >= 1 && d <= 1 + inward) add(cell.x, cell.y)
  }

  if (outward > 0) {
    for (const [key, d] of distOut) {
      if (d < 1 || d > outward) continue
      if (filledSet.has(key)) continue
      const [x, y] = key.split(',').map(Number)
      add(x, y)
    }
  }

  return result
}

function lineSide(x, y, x0, y0, x1, y1) {
  return (x1 - x0) * (y + 0.5 - y0) - (y1 - y0) * (x + 0.5 - x0)
}

/**
 * Espessura de uma linha aberta: "dentro" é o lado esquerdo do vetor origem→destino.
 */
function thickenLine(lineCells, x0, y0, x1, y1, thickness, orientation) {
  const { inward, outward } = splitThickness(thickness, orientation)
  if (inward === 0 && outward === 0) return lineCells.slice()

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const cell of lineCells) {
    if (cell.x < minX) minX = cell.x
    if (cell.x > maxX) maxX = cell.x
    if (cell.y < minY) minY = cell.y
    if (cell.y > maxY) maxY = cell.y
  }

  const pad = Math.max(inward, outward, 1)
  const dist = manhattanFromSeeds(lineCells, minX - pad, maxX + pad, minY - pad, maxY + pad)
  const result = []
  const seen = new Set()
  const degenerate = x0 === x1 && y0 === y1
  const limit = Math.max(inward, outward)

  for (const [key, d] of dist) {
    if (d > limit) continue
    const [x, y] = key.split(',').map(Number)
    let keep = false
    if (d === 0) {
      keep = true
    } else if (degenerate) {
      keep = d <= limit
    } else {
      const side = lineSide(x, y, x0, y0, x1, y1)
      if (side < 0 && d <= inward) keep = true
      if (side > 0 && d <= outward) keep = true
      if (side === 0 && d <= limit) keep = true
    }
    if (!keep) continue
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ x, y })
  }

  return result
}

/**
 * Espessura de círculo/elipse em distância euclidiana (anel).
 * thickenClosed usa Manhattan 4-conectado: a borda interna (contorno da
 * elipse) fica redonda, mas a externa vira losango e “quebra” nas diagonais.
 */
function thickenEllipse(x0, y0, x1, y1, thickness, orientation) {
  const box = ellipseBox(x0, y0, x1, y1)
  const { inward, outward } = splitThickness(thickness, orientation)
  const filled = getEllipseFilledCells(x0, y0, x1, y1)
  if (inward === 0 && outward === 0) return outlineOfFilled(filled)

  const { cx, cy, rx, ry } = box
  if (rx <= 0 || ry <= 0) return outlineOfFilled(filled)

  const minX = box.minX - outward
  const maxX = box.maxX + outward
  const minY = box.minY - outward
  const maxY = box.maxY + outward
  const innerSlack = inward + 1
  const cells = []

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const dist = Math.hypot(dx, dy)
      const norm = Math.hypot(rx ? dx / rx : 0, ry ? dy / ry : 0)
      if (norm < 1e-12) {
        if (innerSlack >= Math.min(rx, ry)) cells.push({ x, y })
        continue
      }
      const rLocal = dist / norm
      if (dist <= rLocal + outward && dist > rLocal - innerSlack) {
        cells.push({ x, y })
      }
    }
  }

  return cells.length ? cells : outlineOfFilled(filled)
}

function applyThickness(tool, filled, x0, y0, x1, y1, thickness, orientation) {
  const total = Math.max(1, Math.floor(Number(thickness)) || 1)
  if (tool === TOOLS.LINE) return thickenLine(filled, x0, y0, x1, y1, total, orientation)
  if (tool === TOOLS.CIRCLE) return thickenEllipse(x0, y0, x1, y1, total, orientation)
  return thickenClosed(filled, total, orientation)
}

function unionCells(a, b) {
  return uniqueCells(a.concat(b))
}

/**
 * Rasteriza uma forma na caixa (x0,y0)–(x1,y1), com espessura e orientação.
 * Por padrão não recorta o mapa, para que maxPerfectThickness detecte overflow.
 *
 * @param {object} opts
 * @returns {Array<{ x: number, y: number }>}
 */
export function rasterizeShape(opts) {
  const tool = opts.tool
  const x0 = opts.x0
  const y0 = opts.y0
  const x1 = opts.x1
  const y1 = opts.y1
  const filled = !!opts.filled
  const thickness = opts.thickness == null ? 1 : opts.thickness
  const orientation = opts.orientation || THICKNESS.CENTERED
  const body = tool === TOOLS.LINE ? getRectFilledCells(x0, y0, x1, y1) : getFilledCells(tool, x0, y0, x1, y1)
  const stroke = tool === TOOLS.LINE ? body : applyThickness(tool, body, x0, y0, x1, y1, thickness, orientation)
  const cells = tool === TOOLS.LINE || filled ? unionCells(body, stroke) : stroke
  if (opts.clip && opts.cols != null && opts.rows != null) {
    return clipCells(cells, opts.cols, opts.rows)
  }
  return uniqueCells(cells)
}

/**
 * Monta a lista de blocos da forma em construção (arrasto livre no canvas).
 * A espessura do arrasto continua sendo o carimbo 1×1 / 2×2 / 3×3 do pincel.
 */
export function getShapeCells(tool, origin, current, filled, width, height, brushSize = 1) {
  const cells = filled ? getFilledCells(tool, origin.x, origin.y, current.x, current.y) : getOutlineCells(tool, origin.x, origin.y, current.x, current.y)
  return clipCells(expandBrush(cells, brushSize), width, height)
}

/**
 * Forma perfeita centrada na origem.
 * Linha: X×Y é a barra preenchida (269×5 = horizontal de 5 de grossura).
 * Demais formas: escala + espessura/orientação do contorno.
 */
export function getPerfectShapeCells(opts) {
  const box = originCenteredEllipseBox(opts.cols, opts.rows, opts.sizeX, opts.sizeY, opts.centerCellAxes)
  return rasterizeShape({
    tool: opts.tool,
    x0: box.x0,
    y0: box.y0,
    x1: box.x1,
    y1: box.y1,
    filled: opts.filled,
    thickness: opts.thickness,
    orientation: opts.orientation,
    cols: opts.cols,
    rows: opts.rows,
    clip: opts.clip !== false,
  })
}

function maxInteriorThickness(filled) {
  if (!filled.length) return 1
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const filledSet = new Set()
  for (const cell of filled) {
    filledSet.add(cellKey(cell.x, cell.y))
    if (cell.x < minX) minX = cell.x
    if (cell.x > maxX) maxX = cell.x
    if (cell.y < minY) minY = cell.y
    if (cell.y > maxY) maxY = cell.y
  }
  const complement = []
  for (let y = minY - 1; y <= maxY + 1; y += 1) {
    for (let x = minX - 1; x <= maxX + 1; x += 1) {
      if (!filledSet.has(cellKey(x, y))) complement.push({ x, y })
    }
  }
  const distIn = manhattanFromSeeds(complement, minX - 1, maxX + 1, minY - 1, maxY + 1)
  let max = 1
  for (const cell of filled) {
    const d = distIn.get(cellKey(cell.x, cell.y))
    if (d > max) max = d
  }
  return max
}

function thicknessFits(opts, thickness) {
  const cells = rasterizeShape({
    ...opts,
    thickness,
    filled: false,
    clip: false,
  })
  return !anyOutsideMap(cells, opts.cols, opts.rows)
}

/**
 * Maior espessura que mantém a forma dentro do mapa, para a forma/escala/orientação atuais.
 * Para dentro, o teto também é o raio interior da forma (além disso a espessura só preenche o miolo).
 */
export function maxPerfectThickness(opts) {
  if (opts.tool === TOOLS.LINE) return 1
  const box = originCenteredEllipseBox(opts.cols, opts.rows, opts.sizeX, opts.sizeY, opts.centerCellAxes)
  const rasterOpts = {
    tool: opts.tool,
    x0: box.x0,
    y0: box.y0,
    x1: box.x1,
    y1: box.y1,
    orientation: opts.orientation || THICKNESS.CENTERED,
    cols: opts.cols,
    rows: opts.rows,
  }
  if (!thicknessFits(rasterOpts, 1)) return 1

  let lo = 1
  let hi = Math.max(opts.cols, opts.rows)
  let best = 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (thicknessFits(rasterOpts, mid)) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  if (opts.tool !== TOOLS.LINE && rasterOpts.orientation === THICKNESS.INWARD) {
    best = Math.min(best, maxInteriorThickness(getFilledCells(opts.tool, box.x0, box.y0, box.x1, box.y1)))
  }
  return best
}

export function clampThickness(value, max) {
  const cap = Math.max(1, Math.floor(Number(max)) || 1)
  return Math.min(cap, Math.max(1, Math.floor(Number(value)) || 1))
}

/**
 * Distância euclidiana em blocos entre a origem e o destino da linha.
 * A origem conta como 1 na UI (o bloco 0 do cartesiano); o valor interno não muda.
 * @param {{ x: number, y: number }} origin
 * @param {{ x: number, y: number }} current
 */
export function formatLineDistance(origin, current) {
  const dist = Math.hypot(current.x - origin.x, current.y - origin.y) + 1
  const text = dist.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 })
  const unit = Math.abs(dist - 1) < 0.05 ? 'bloco' : 'blocos'
  return `${text} ${unit}`
}
