/**
 * Células inteiras, faces e conversão mundo ↔ bloco.
 */
import { MAX_VOXEL_Y } from '../constants.js'

/**
 * Deslocamento para centralizar um grid width×height em torno da origem.
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
 * Centro do cubo no mundo. y=0 assenta o cubo sobre o plano y = 0.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} z
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
 * Mundo → célula do cubo cujo centro está mais perto do ponto.
 *
 * @param {number} wx
 * @param {number} wy
 * @param {number} wz
 * @param {{ x: number, z: number }} offset
 */
export function worldToBlock(wx, wy, wz, offset) {
  return {
    x: Math.round(wx + offset.x),
    y: Math.round(wy - 0.5),
    z: Math.round(wz + offset.z),
  }
}

/**
 * Clique no plano y = 0 → célula (x, 0, z).
 *
 * @param {number} wx
 * @param {number} wz
 * @param {{ x: number, z: number }} offset
 */
export function worldToGroundCell(wx, wz, offset) {
  return {
    x: Math.round(wx + offset.x),
    z: Math.round(wz + offset.z),
  }
}

/**
 * Quantiza a normal da face para um eixo unitário.
 * @param {{ x: number, y: number, z: number }} n
 */
export function snapFaceNormal(n) {
  const ax = Math.abs(n.x)
  const ay = Math.abs(n.y)
  const az = Math.abs(n.z)
  if (ax >= ay && ax >= az) return { x: Math.sign(n.x) || 1, y: 0, z: 0 }
  if (ay >= az) return { x: 0, y: Math.sign(n.y) || 1, z: 0 }
  return { x: 0, y: 0, z: Math.sign(n.z) || 1 }
}

/**
 * @param {{ x: number, y: number, z: number }} n
 * @returns {'TOP' | 'BOTTOM' | 'EAST' | 'WEST' | 'SOUTH' | 'NORTH'}
 */
export function faceNameFromNormal(n) {
  if (n.y === 1) return 'TOP'
  if (n.y === -1) return 'BOTTOM'
  if (n.x === 1) return 'EAST'
  if (n.x === -1) return 'WEST'
  if (n.z === 1) return 'SOUTH'
  return 'NORTH'
}

/**
 * Célula vizinha pela face (sempre inteira).
 *
 * @param {{ x: number, y: number, z: number }} pos
 * @param {{ x: number, y: number, z: number }} normal
 */
export function adjacentCell(pos, normal) {
  return {
    x: pos.x + normal.x,
    y: pos.y + normal.y,
    z: pos.z + normal.z,
  }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} width
 * @param {number} height
 */
export function isCellInBounds(x, y, z, width, height) {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    Number.isInteger(z) &&
    x >= 0 &&
    z >= 0 &&
    x < width &&
    z < height &&
    y >= 0 &&
    y <= MAX_VOXEL_Y
  )
}

/**
 * @param {number} width
 * @param {number} height
 */
export function mapSpan(width, height) {
  return Math.max(width, height, 1)
}
