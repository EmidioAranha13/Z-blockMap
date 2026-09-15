/**
 * Mundo voxel: camadas (Maps por "x,y,z") + composite visível para a malha.
 */
import { BLOCK_SOURCE, MAX_VOXEL_BLOCKS, WORLD_OPS } from '../constants.js'
import { findNode, forEachLayer, setTreeVisible } from '@/utils/layers.js'
import { blockKey } from './blockKey.js'
import { isCellInBounds, mapCenterOffset } from './blockCoordinates.js'
import { gridSize } from './pixelMapToBlocks.js'
import {
  cloneVoxelLayerTree,
  firstVoxelLayer,
  pixelTreeToVoxelTree,
  visibleVoxelLayers,
} from './voxelLayers.js'

/**
 * @returns {ReturnType<typeof createVoxelWorld>}
 */
export function createVoxelWorld() {
  /** Composite visível (uma célula = um cubo na GPU). */
  const blocks = new Map()
  /** @type {Set<(op: object) => void>} */
  const listeners = new Set()

  let layerTree = []
  let activeLayerId = ''
  let width = 0
  let height = 0
  let offset = mapCenterOffset(1, 1)

  function emit(op) {
    listeners.forEach((fn) => fn(op))
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  function has(x, y, z) {
    return blocks.has(blockKey(x, y, z))
  }

  function get(x, y, z) {
    return blocks.get(blockKey(x, y, z)) ?? null
  }

  function inBounds(x, y, z) {
    return isCellInBounds(x, y, z, width, height)
  }

  function activeLayer() {
    const node = findNode(layerTree, activeLayerId)
    if (!node) return firstVoxelLayer(layerTree)
    if (node.type === 'layer') return node
    let first = null
    forEachLayer(node, (layer) => {
      if (!first) first = layer
    })
    return first
  }

  function drawingLayers() {
    const node = findNode(layerTree, activeLayerId)
    if (!node) {
      const layer = activeLayer()
      return layer ? [layer] : []
    }
    const list = []
    forEachLayer(node, (layer) => list.push(layer))
    return list
  }

  function compositeAt(key) {
    const vis = visibleVoxelLayers(layerTree)
    for (let i = vis.length - 1; i >= 0; i -= 1) {
      const found = vis[i].voxels.get(key)
      if (found) return found
    }
    return null
  }

  function rebuildComposite() {
    blocks.clear()
    const vis = visibleVoxelLayers(layerTree)
    for (const layer of vis) {
      for (const [key, block] of layer.voxels) {
        blocks.set(key, block)
      }
    }
    emit({ type: WORLD_OPS.RESET, blocks })
  }

  function makeBlock(x, y, z, input, layerId) {
    const source = input.source || BLOCK_SOURCE.BUILD
    return {
      x,
      y,
      z,
      color: input.color,
      colorId: input.colorId,
      materialId: input.materialId || (input.colorId != null ? String(input.colorId) : undefined),
      blockType: input.blockType || source,
      source,
      layerId,
    }
  }

  /**
   * @param {{ x: number, y: number, z: number, color: string, colorId?: number, source?: string, blockType?: string, materialId?: string }} input
   */
  function addBlock(input) {
    const layer = activeLayer()
    if (!layer) return false
    const x = Math.round(input.x)
    const y = Math.round(input.y)
    const z = Math.round(input.z)
    if (!inBounds(x, y, z)) return false
    const key = blockKey(x, y, z)
    if (layer.voxels.has(key)) return false
    if (blocks.has(key)) return false
    if (blocks.size >= MAX_VOXEL_BLOCKS) return false

    const block = makeBlock(x, y, z, input, layer.id)
    layer.voxels.set(key, block)
    blocks.set(key, block)
    const op = { type: WORLD_OPS.ADD_BLOCK, block, key }
    emit(op)
    return op
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  function removeBlock(x, y, z) {
    const layer = activeLayer()
    if (!layer) return false
    const key = blockKey(Math.round(x), Math.round(y), Math.round(z))
    if (!layer.voxels.has(key)) return false
    const removed = layer.voxels.get(key)
    layer.voxels.delete(key)
    const shown = blocks.get(key)
    if (shown && shown.layerId === layer.id) {
      const next = compositeAt(key)
      if (next) {
        blocks.set(key, next)
        emit({ type: WORLD_OPS.ADD_BLOCK, block: next, key })
      } else {
        blocks.delete(key)
        emit({ type: WORLD_OPS.REMOVE_BLOCK, block: removed, key })
      }
    }
    return { type: WORLD_OPS.REMOVE_BLOCK, block: removed, key }
  }

  function collectStackPending(dir) {
    const layers = drawingLayers()
    const pending = []
    if (!layers.length || !dir) return pending
    for (const layer of layers) {
      const snapshot = [...layer.voxels.values()]
      for (const block of snapshot) {
        const x = block.x + dir.x
        const y = block.y + dir.y
        const z = block.z + dir.z
        if (!inBounds(x, y, z)) continue
        const key = blockKey(x, y, z)
        if (layer.voxels.has(key) || blocks.has(key)) continue
        if (blocks.size + pending.length >= MAX_VOXEL_BLOCKS) break
        pending.push({
          layer,
          key,
          block: makeBlock(x, y, z, { ...block, source: BLOCK_SOURCE.BUILD }, layer.id),
        })
      }
    }
    return pending
  }

  /**
   * @param {{ x: number, y: number, z: number }} dir
   */
  function stackPreviewCount(dir) {
    return collectStackPending(dir).length
  }

  /**
   * Empilha um passo: copia cada cubo da seleção na direção, se a célula estiver livre.
   * @param {{ x: number, y: number, z: number }} dir
   * @returns {number} cubos criados
   */
  function stackActive(dir) {
    const pending = collectStackPending(dir)
    if (!pending.length) return 0
    for (const item of pending) {
      item.layer.voxels.set(item.key, item.block)
    }
    rebuildComposite()
    return pending.length
  }

  function setActiveLayer(id) {
    if (!findNode(layerTree, id)) return false
    activeLayerId = id
    return true
  }

  function toggleVisible(id) {
    const node = findNode(layerTree, id)
    if (!node) return false
    setTreeVisible(node, !node.visible)
    rebuildComposite()
    return true
  }

  function renameNode(id, name) {
    const node = findNode(layerTree, id)
    if (!node) return false
    const next = String(name || '').trim()
    if (!next) return false
    node.name = next
    return true
  }

  function toggleCollapsed(id) {
    const node = findNode(layerTree, id)
    if (!node || node.type !== 'group') return false
    node.collapsed = !node.collapsed
    return true
  }

  /**
   * @param {Array} pixelTree
   * @param {number} mapWidth
   * @param {number} mapHeight
   * @param {Array<{ id: number, hex: string }>} colors
   */
  function resetFromPixelLayers(pixelTree, mapWidth, mapHeight, colors) {
    width = Math.max(1, mapWidth)
    height = Math.max(1, mapHeight)
    offset = mapCenterOffset(width, height)
    layerTree = pixelTreeToVoxelTree(pixelTree, colors, width, height)
    const first = firstVoxelLayer(layerTree)
    activeLayerId = first ? first.id : ''
    rebuildComposite()
  }

  /**
   * Hidrata o mundo a partir de um JSON 3D já parseado.
   * @param {Array} voxelTree
   * @param {number} mapWidth
   * @param {number} mapHeight
   */
  function resetFromVoxelLayers(voxelTree, mapWidth, mapHeight) {
    width = Math.max(1, mapWidth)
    height = Math.max(1, mapHeight)
    offset = mapCenterOffset(width, height)
    layerTree = cloneVoxelLayerTree(voxelTree)
    const first = firstVoxelLayer(layerTree)
    activeLayerId = first ? first.id : ''
    rebuildComposite()
  }

  function exportSnapshot() {
    return {
      layerTree: cloneVoxelLayerTree(layerTree),
      activeLayerId,
      width,
      height,
    }
  }

  /**
   * @param {{ layerTree: Array, activeLayerId?: string, width: number, height: number }} snapshot
   */
  function restoreSnapshot(snapshot) {
    if (!snapshot) return
    width = Math.max(1, snapshot.width || width)
    height = Math.max(1, snapshot.height || height)
    offset = mapCenterOffset(width, height)
    layerTree = cloneVoxelLayerTree(snapshot.layerTree)
    activeLayerId = snapshot.activeLayerId || ''
    if (!findNode(layerTree, activeLayerId)) {
      const first = firstVoxelLayer(layerTree)
      activeLayerId = first ? first.id : ''
    }
    rebuildComposite()
  }

  /**
   * @deprecated use resetFromPixelLayers
   */
  function resetFromPixel(grid, colors) {
    const size = gridSize(grid)
    const fake = [{ id: 'layer-1', type: 'layer', name: 'Camada 1', visible: true, grid }]
    resetFromPixelLayers(fake, size.width, size.height, colors)
  }

  return {
    get blocks() {
      return blocks
    },
    get layerTree() {
      return layerTree
    },
    get activeLayerId() {
      return activeLayerId
    },
    get width() {
      return width
    },
    get height() {
      return height
    },
    get offset() {
      return offset
    },
    get size() {
      return blocks.size
    },
    subscribe,
    has,
    get,
    inBounds,
    activeLayer,
    addBlock,
    removeBlock,
    stackPreviewCount,
    stackActive,
    setActiveLayer,
    toggleVisible,
    renameNode,
    toggleCollapsed,
    resetFromPixelLayers,
    resetFromVoxelLayers,
    resetFromPixel,
    exportSnapshot,
    restoreSnapshot,
  }
}
