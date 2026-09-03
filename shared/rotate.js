/**
 * Giro do desenho em torno do próprio centro (não da origem do cartesiano).
 * O ângulo é em graus inteiros; a rasterização é vizinho mais próximo.
 */

/**
 * Pivô do mapa no espaço de blocos (centro do bloco do meio, ou a cruz da malha).
 *
 * @param {number} cols
 * @param {number} rows
 * @param {boolean} centerCellAxes
 * @returns {{ x: number, y: number }}
 */
export function mapPivot(cols, rows, centerCellAxes) {
  const midX = Math.floor(cols / 2)
  const midY = Math.floor(rows / 2)
  if (centerCellAxes && cols % 2 === 1 && rows % 2 === 1) {
    return { x: midX + 0.5, y: midY + 0.5 }
  }
  return { x: midX, y: midY }
}

/**
 * Ângulo do centro do bloco até o pivô, em graus (Y para baixo = horário na tela).
 *
 * @param {{ x: number, y: number }} block
 * @param {{ x: number, y: number }} pivot
 */
export function blockAngleDeg(block, pivot) {
  return (Math.atan2(block.y + 0.5 - pivot.y, block.x + 0.5 - pivot.x) * 180) / Math.PI
}

function wrapSigned180(deg) {
  let value = deg
  while (value > 180) value -= 360
  while (value < -180) value += 360
  return value
}

/**
 * Graus inteiros entre o clique e o bloco atual, em torno do pivô do desenho.
 * Perto do pivô: 1 bloco horizontal = 1°.
 *
 * @param {{ x: number, y: number }} start
 * @param {{ x: number, y: number }} current
 * @param {{ x: number, y: number }} pivot
 */
export function snappedRotateDegrees(start, current, pivot) {
  const dist = Math.hypot(start.x + 0.5 - pivot.x, start.y + 0.5 - pivot.y)
  if (dist < 2) return current.x - start.x
  return Math.round(wrapSigned180(blockAngleDeg(current, pivot) - blockAngleDeg(start, pivot)))
}

/**
 * @param {{ x: number, y: number }} start
 * @param {{ x: number, y: number }} current
 * @param {{ x: number, y: number } | null} pivot
 */
export function formatRotateDegrees(start, current, pivot) {
  if (!pivot) return '0°'
  const deg = snappedRotateDegrees(start, current, pivot)
  return `${deg}°`
}

function allocGrid(rows, cols, fillValue = 0) {
  const out = new Array(rows)
  for (let y = 0; y < rows; y += 1) {
    out[y] = new Array(cols).fill(fillValue)
  }
  return out
}

function paintedBounds(src, cols, rows) {
  let minX = cols
  let minY = rows
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < rows; y += 1) {
    const row = src[y]
    for (let x = 0; x < cols; x += 1) {
      if (row[x] === 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return null
  return { minX, minY, maxX, maxY }
}

/**
 * Centro do desenho pintado (união das grades). Sem tinta, devolve null.
 *
 * @param {number[][]} grids
 * @returns {{ x: number, y: number } | null}
 */
export function drawingPivotFromGrids(grids) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -1
  let maxY = -1
  for (let i = 0; i < grids.length; i += 1) {
    const src = grids[i]
    const rows = src.length
    const cols = rows ? src[0].length : 0
    const bounds = paintedBounds(src, cols, rows)
    if (!bounds) continue
    if (bounds.minX < minX) minX = bounds.minX
    if (bounds.minY < minY) minY = bounds.minY
    if (bounds.maxX > maxX) maxX = bounds.maxX
    if (bounds.maxY > maxY) maxY = bounds.maxY
  }
  if (maxX < 0) return null
  return {
    x: (minX + maxX) / 2 + 0.5,
    y: (minY + maxY) / 2 + 0.5,
  }
}

/**
 * Gira a grade `angleDeg` em torno do pivô. Ângulo 0 devolve uma cópia.
 * Só varre a região que o desenho ocupava (e o AABB após o giro).
 *
 * @param {number[][]} src
 * @param {number} angleDeg
 * @param {number} ox
 * @param {number} oy
 * @returns {number[][]}
 */
export function rotateGrid(src, angleDeg, ox, oy) {
  const rows = src.length
  const cols = rows ? src[0].length : 0
  const out = allocGrid(rows, cols, 0)
  if (!rows || !cols) return out

  const bounds = paintedBounds(src, cols, rows)
  if (!bounds) return out

  if (!angleDeg) {
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      const srcRow = src[y]
      const dstRow = out[y]
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) dstRow[x] = srcRow[x]
    }
    return out
  }

  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  let destMinX = cols
  let destMinY = rows
  let destMaxX = -1
  let destMaxY = -1
  const corners = [
    [bounds.minX, bounds.minY],
    [bounds.maxX + 1, bounds.minY],
    [bounds.minX, bounds.maxY + 1],
    [bounds.maxX + 1, bounds.maxY + 1],
  ]
  for (let i = 0; i < 4; i += 1) {
    const dx = corners[i][0] - ox
    const dy = corners[i][1] - oy
    const fx = ox + dx * cos - dy * sin
    const fy = oy + dx * sin + dy * cos
    if (fx < destMinX) destMinX = fx
    if (fx > destMaxX) destMaxX = fx
    if (fy < destMinY) destMinY = fy
    if (fy > destMaxY) destMaxY = fy
  }

  const x0 = Math.max(0, Math.floor(destMinX) - 1)
  const y0 = Math.max(0, Math.floor(destMinY) - 1)
  const x1 = Math.min(cols - 1, Math.ceil(destMaxX) + 1)
  const y1 = Math.min(rows - 1, Math.ceil(destMaxY) + 1)

  for (let y = y0; y <= y1; y += 1) {
    const dy = y + 0.5 - oy
    const dstRow = out[y]
    for (let x = x0; x <= x1; x += 1) {
      const dx = x + 0.5 - ox
      const sx = ox + dx * cos + dy * sin
      const sy = oy - dx * sin + dy * cos
      const ix = Math.floor(sx)
      const iy = Math.floor(sy)
      if (iy >= 0 && iy < rows && ix >= 0 && ix < cols) {
        dstRow[x] = src[iy][ix]
      }
    }
  }
  return out
}
