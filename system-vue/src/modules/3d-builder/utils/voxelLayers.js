/**
 * Árvore Pixel Art → camadas voxel (cada camada tem o próprio Map de cubos).
 * A matriz 2D original não é alterada: só copiamos os pixels pintados.
 */
import { getCellHex } from '@/constants/palette.js'
import { BLOCK_SOURCE } from '../constants.js'
import { walkTree } from '@/utils/layers.js'
import { blockKey } from './blockKey.js'

/**
 * @param {number[][]} grid
 * @param {Array<{ id: number, hex: string }>} colors
 * @param {string} layerId
 * @returns {Map<string, object>}
 */
export function layerGridToVoxels(grid, colors, layerId, offsetX = 0, offsetY = 0, bounds = null) {
  const voxels = new Map()
  const rows = grid?.length || 0
  const cols = rows > 0 ? grid[0].length : 0
  for (let z = 0; z < rows; z += 1) {
    const row = grid[z]
    for (let x = 0; x < cols; x += 1) {
      const colorId = row[x]
      if (!colorId) continue
      const wx = x + offsetX
      const wz = z + offsetY
      if (bounds && (wx < 0 || wz < 0 || wx >= bounds.width || wz >= bounds.height)) continue
      const block = {
        x: wx,
        y: 0,
        z: wz,
        color: getCellHex(colors, colorId),
        colorId,
        materialId: String(colorId),
        blockType: BLOCK_SOURCE.BASE,
        source: BLOCK_SOURCE.BASE,
        layerId,
      }
      voxels.set(blockKey(wx, 0, wz), block)
    }
  }
  return voxels
}

/**
 * Cópia da árvore para o editor 3D. Grupos permanecem; camadas trocam a
 * grade 2D por um Map de voxels (offsets 2D já devem estar bakeados no JSON).
 *
 * @param {Array} nodes
 * @param {Array<{ id: number, hex: string }>} colors
 */
export function pixelTreeToVoxelTree(nodes, colors, width = 0, height = 0) {
  if (!Array.isArray(nodes)) return []
  const bounds = width > 0 && height > 0 ? { width, height } : null
  return nodes.map((node) => cloneNode(node, colors, bounds))
}

function cloneNode(node, colors, bounds) {
  if (node.type === 'group') {
    return {
      id: node.id,
      type: 'group',
      name: node.name,
      visible: node.visible !== false,
      collapsed: Boolean(node.collapsed),
      children: Array.isArray(node.children)
        ? node.children.map((child) => cloneNode(child, colors, bounds))
        : [],
    }
  }
  return {
    id: node.id,
    type: 'layer',
    name: node.name || 'Camada',
    visible: node.visible !== false,
    voxels: layerGridToVoxels(
      node.grid,
      colors,
      node.id,
      node.offsetX || 0,
      node.offsetY || 0,
      bounds,
    ),
  }
}

/**
 * Camadas-folha visíveis, fundo → topo (igual ao composite 2D).
 * @param {Array} nodes
 * @returns {object[]}
 */
export function visibleVoxelLayers(nodes) {
  const list = []
  walkTree(nodes, (node, visible) => {
    if (node.type === 'layer' && visible) list.push(node)
  })
  return list
}

/**
 * Árvore só com dados de UI (sem os Maps de voxels).
 * @param {Array} nodes
 */
export function voxelTreeForUi(nodes) {
  return (nodes || []).map((node) => {
    if (node.type === 'group') {
      return {
        id: node.id,
        type: 'group',
        name: node.name,
        visible: node.visible,
        collapsed: node.collapsed,
        children: voxelTreeForUi(node.children),
      }
    }
    return {
      id: node.id,
      type: 'layer',
      name: node.name,
      visible: node.visible,
    }
  })
}

/**
 * Primeira camada-folha da árvore.
 * @param {Array} nodes
 * @returns {object | null}
 */
export function firstVoxelLayer(nodes) {
  for (const node of nodes || []) {
    if (node.type === 'layer') return node
    if (node.type === 'group') {
      const found = firstVoxelLayer(node.children)
      if (found) return found
    }
  }
  return null
}

/**
 * Cópia profunda da árvore voxel (Maps novos, blocos clonados).
 * @param {Array} nodes
 */
export function cloneVoxelLayerTree(nodes) {
  return (nodes || []).map((node) => {
    if (node.type === 'group') {
      return {
        id: node.id,
        type: 'group',
        name: node.name,
        visible: node.visible !== false,
        collapsed: Boolean(node.collapsed),
        children: cloneVoxelLayerTree(node.children),
      }
    }
    const voxels = new Map()
    if (node.voxels) {
      for (const [key, block] of node.voxels) {
        voxels.set(key, { ...block })
      }
    }
    return {
      id: node.id,
      type: 'layer',
      name: node.name || 'Camada',
      visible: node.visible !== false,
      voxels,
    }
  })
}

/**
 * Árvore voxel → JSON (blocos em array, sem Map).
 * @param {Array} nodes
 */
export function serializeVoxelLayerTree(nodes) {
  return (nodes || []).map((node) => {
    if (node.type === 'group') {
      return {
        id: node.id,
        type: 'group',
        name: node.name,
        visible: node.visible !== false,
        collapsed: Boolean(node.collapsed),
        children: serializeVoxelLayerTree(node.children),
      }
    }
    const blocks = []
    if (node.voxels) {
      for (const block of node.voxels.values()) {
        blocks.push({
          x: block.x,
          y: block.y,
          z: block.z,
          colorId: block.colorId,
          color: block.color,
          source: block.source,
          blockType: block.blockType,
          materialId: block.materialId,
        })
      }
    }
    return {
      id: node.id,
      type: 'layer',
      name: node.name || 'Camada',
      visible: node.visible !== false,
      blocks,
    }
  })
}

/**
 * JSON de camadas 3D → árvore com Maps de voxels.
 * @param {unknown} nodes
 */
export function parseVoxelLayerTree(nodes) {
  if (!Array.isArray(nodes)) return []
  return nodes.map((node) => parseVoxelNode(node))
}

function parseVoxelNode(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `layer-${Math.random().toString(36).slice(2, 8)}`,
      type: 'layer',
      name: 'Camada',
      visible: true,
      voxels: new Map(),
    }
  }
  if (raw.type === 'group') {
    return {
      id: String(raw.id || `group-${Math.random().toString(36).slice(2, 8)}`),
      type: 'group',
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Grupo',
      visible: raw.visible !== false,
      collapsed: Boolean(raw.collapsed),
      children: Array.isArray(raw.children) ? raw.children.map((child) => parseVoxelNode(child)) : [],
    }
  }
  const id = String(raw.id || `layer-${Math.random().toString(36).slice(2, 8)}`)
  const voxels = new Map()
  const list = Array.isArray(raw.blocks) ? raw.blocks : []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const x = Math.round(Number(item.x))
    const y = Math.round(Number(item.y))
    const z = Math.round(Number(item.z))
    if (![x, y, z].every(Number.isInteger) || y < 0) continue
    const colorId = Number(item.colorId)
    const block = {
      x,
      y,
      z,
      color: typeof item.color === 'string' ? item.color : '#c4a35a',
      colorId: Number.isFinite(colorId) ? colorId : undefined,
      materialId: item.materialId ? String(item.materialId) : Number.isFinite(colorId) ? String(colorId) : undefined,
      blockType: item.blockType || item.source || BLOCK_SOURCE.BUILD,
      source: item.source || BLOCK_SOURCE.BUILD,
      layerId: id,
    }
    voxels.set(blockKey(x, y, z), block)
  }
  return {
    id,
    type: 'layer',
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Camada',
    visible: raw.visible !== false,
    voxels,
  }
}

/**
 * @param {unknown} nodes
 */
export function voxelLayersHaveBlocks(nodes) {
  if (!Array.isArray(nodes)) return false
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    if (node.type === 'group' && voxelLayersHaveBlocks(node.children)) return true
    if (Array.isArray(node.blocks)) return true
  }
  return false
}
