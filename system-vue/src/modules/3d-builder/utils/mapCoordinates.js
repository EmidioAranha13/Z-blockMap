/**
 * Conversão matriz 2D (coluna x, linha z) → mundo Three.js (Y-up),
 * com o centro do mapa em (0, 0, 0).
 */

/**
 * Deslocamento para centralizar um grid width×height em torno da origem.
 * O bloco (0, 0) fica em (−offset.x, y, −offset.z).
 *
 * @param {number} width colunas
 * @param {number} height linhas
 */
export function mapCenterOffset(width, height) {
  return {
    x: (Math.max(1, width) - 1) / 2,
    z: (Math.max(1, height) - 1) / 2,
  }
}

/**
 * Centro do cubo no mundo. y da pilha 0 assenta o cubo sobre o plano y = 0.
 *
 * @param {number} x coluna
 * @param {number} y índice de altura
 * @param {number} z linha (y da matriz 2D)
 * @param {{ x: number, z: number }} offset
 */
export function blockToWorld(x, y, z, offset) {
  return {
    x: x - offset.x,
    y: y + 0.5,
    z: z - offset.z,
  }
}

/**
 * Maior lado do mapa, para enquadramento da câmera.
 *
 * @param {number} width
 * @param {number} height
 */
export function mapSpan(width, height) {
  return Math.max(width, height, 1)
}
