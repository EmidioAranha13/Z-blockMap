/**
 * Giro de uma camada em torno da origem do cartesiano.
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
 * Graus inteiros entre o clique e o bloco atual.
 * Longe da origem: o arrasto gira em torno do cartesiano.
 * Perto da origem: 1 bloco horizontal = 1°.
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
 * @param {number} cols
 * @param {number} rows
 * @param {boolean} centerCellAxes
 */
export function formatRotateDegrees(start, current, cols, rows, centerCellAxes) {
  const deg = snappedRotateDegrees(start, current, mapPivot(cols, rows, centerCellAxes))
  return `${deg}°`
}

/**
 * Gira a grade `angleDeg` em torno do pivô. Ângulo 0 devolve uma cópia.
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
  const out = []
  for (let y = 0; y < rows; y += 1) {
    out.push(new Array(cols).fill(0))
  }
  if (!rows || !cols) return out
  if (!angleDeg) {
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) out[y][x] = src[y][x]
    }
    return out
  }

  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  for (let y = 0; y < rows; y += 1) {
    const dy = y + 0.5 - oy
    for (let x = 0; x < cols; x += 1) {
      const dx = x + 0.5 - ox
      const sx = ox + dx * cos + dy * sin
      const sy = oy - dx * sin + dy * cos
      const ix = Math.floor(sx)
      const iy = Math.floor(sy)
      if (iy >= 0 && iy < rows && ix >= 0 && ix < cols) {
        out[y][x] = src[iy][ix]
      }
    }
  }
  return out
}
