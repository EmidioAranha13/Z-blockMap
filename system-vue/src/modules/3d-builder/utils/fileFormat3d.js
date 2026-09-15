/**
 * Formato de arquivo da construção 3D (.zblockmap.json em maps/3DMap).
 * Espelha o z-blockmap: nome, escala, cores e árvore de camadas —
 * as camadas guardam cubos (x,y,z) em vez de uma grade 2D.
 */
import { MAX_GRID_SIZE } from '@/constants/limits.js'
import { cloneFixedColors, normalizeHex } from '@/constants/palette.js'
import { voxelLayersHaveBlocks, parseVoxelLayerTree, serializeVoxelLayerTree } from './voxelLayers.js'

export const FILE_FORMAT_3D = 'z-blockmap-3d'
export const FILE_VERSION_3D = 1

/**
 * @param {unknown} raw
 */
export function isVoxelMapFile(raw) {
  if (!raw || typeof raw !== 'object') return false
  if (raw.format === FILE_FORMAT_3D) return true
  return voxelLayersHaveBlocks(raw.layers)
}

/**
 * @param {object} state
 */
export function serializeVoxelMapFile(state) {
  return {
    format: FILE_FORMAT_3D,
    version: FILE_VERSION_3D,
    name: state.mapName,
    width: state.width,
    height: state.height,
    selectedColor: state.selectedColor,
    sourcePixelMap: state.sourcePixelMap || '',
    colors: {
      fixed: (state.fixedColors || []).map(stripColor),
      custom: (state.customColors || []).map(stripColor),
    },
    layers: serializeVoxelLayerTree(state.layerTree),
  }
}

/**
 * @param {unknown} raw
 */
export function parseVoxelMapFile(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Arquivo de mapa 3D inválido.')
  }
  const data = raw
  const width = Math.floor(Number(data.width))
  const height = Math.floor(Number(data.height))
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error('O arquivo não informa largura e altura.')
  }
  if (width < 1 || height < 1 || width > MAX_GRID_SIZE || height > MAX_GRID_SIZE) {
    throw new Error(`A escala precisa estar entre 1 e ${MAX_GRID_SIZE}.`)
  }

  const fixedColors = cloneFixedColors()
  const savedFixed = data.colors?.fixed
  if (Array.isArray(savedFixed)) {
    for (const saved of savedFixed) {
      const target = fixedColors.find((item) => item.id === saved.id)
      if (!target) continue
      if (typeof saved.name === 'string' && saved.name.trim()) {
        target.name = saved.name.trim()
      }
      const hex = normalizeHex(saved.hex)
      if (hex && target.id !== 0) target.hex = hex
    }
  }

  const customColors = []
  const savedCustom = data.colors?.custom
  if (Array.isArray(savedCustom)) {
    for (const saved of savedCustom) {
      const hex = normalizeHex(saved.hex)
      if (!hex) continue
      customColors.push({
        id: Number(saved.id),
        name: typeof saved.name === 'string' && saved.name.trim() ? saved.name.trim() : 'Cor',
        hex,
        source: 'custom',
      })
    }
  }

  return {
    mapName: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Mapa sem nome',
    width,
    height,
    layerTree: parseVoxelLayerTree(data.layers),
    fixedColors,
    customColors,
    selectedColor: Number.isFinite(Number(data.selectedColor)) ? Number(data.selectedColor) : 1,
    sourcePixelMap: typeof data.sourcePixelMap === 'string' ? data.sourcePixelMap : '',
  }
}

/**
 * @param {{ id: number, name: string, hex: string }} color
 */
function stripColor(color) {
  return {
    id: color.id,
    name: color.name,
    hex: color.hex,
  }
}
