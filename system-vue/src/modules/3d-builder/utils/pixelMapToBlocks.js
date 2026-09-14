/**
 * Matriz de ids da paleta → lista de blocos voxel (camada base, y = 0).
 * Id 0 (vazio) não gera cubo.
 */
import { getCellHex } from '@/constants/palette.js'

const BASE_HEIGHT = 0
const BASE_TYPE = 'base'

/**
 * @param {number[][]} grid
 * @param {Array<{ id: number, hex: string }>} colors
 * @returns {import('../types/block.js').VoxelBlock[]}
 */
export function pixelMapToBlocks(grid, colors) {
  const rows = grid.length
  const cols = rows > 0 ? grid[0].length : 0
  if (!cols || !rows) return []

  let count = 0
  for (let z = 0; z < rows; z += 1) {
    const row = grid[z]
    for (let x = 0; x < cols; x += 1) {
      if (row[x]) count += 1
    }
  }

  const blocks = new Array(count)
  let i = 0
  for (let z = 0; z < rows; z += 1) {
    const row = grid[z]
    for (let x = 0; x < cols; x += 1) {
      const colorId = row[x]
      if (!colorId) continue
      blocks[i] = {
        x,
        y: BASE_HEIGHT,
        z,
        color: getCellHex(colors, colorId),
        colorId,
        blockType: BASE_TYPE,
      }
      i += 1
    }
  }
  return blocks
}

/**
 * Dimensões da matriz (colunas × linhas).
 *
 * @param {number[][]} grid
 */
export function gridSize(grid) {
  const height = grid.length
  const width = height > 0 ? grid[0].length : 0
  return { width, height }
}
