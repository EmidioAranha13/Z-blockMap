/**
 * Chave de consulta O(1) por célula inteira.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
export function blockKey(x, y, z) {
  return `${x},${y},${z}`
}

/**
 * @param {string} key
 * @returns {{ x: number, y: number, z: number } | null}
 */
export function parseBlockKey(key) {
  const parts = String(key).split(',')
  if (parts.length !== 3) return null
  const x = Number(parts[0])
  const y = Number(parts[1])
  const z = Number(parts[2])
  if (![x, y, z].every(Number.isInteger)) return null
  return { x, y, z }
}
