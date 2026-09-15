/**
 * Ferramenta ativa, camadas, empilhamento, undo/redo e regras de clique (sem Three.js).
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { MAX_HISTORY } from '@/constants/limits.js'
import { createHistory } from '@/utils/history.js'
import { STACK_DIRS, VOXEL_TOOLS, VOXEL_TOOL_META } from '../constants.js'
import { adjacentCell } from '../utils/blockCoordinates.js'
import { blockKey } from '../utils/blockKey.js'
import { voxelTreeForUi } from '../utils/voxelLayers.js'

/**
 * @param {ReturnType<import('../utils/voxelWorld.js').createVoxelWorld>} world
 * @param {{ viewOnly?: boolean }} [options]
 */
export function useVoxelEditor(world, options = {}) {
  const viewOnly = Boolean(options.viewOnly)
  const tool = ref(VOXEL_TOOLS.SELECT)
  const stackMode = ref(false)
  const activeColor = ref('#c4a35a')
  const activeColorId = ref(1)
  const selected = ref(/** @type {null | { x: number, y: number, z: number, faceNormal: { x: number, y: number, z: number }, face: string }} */ (null))
  const hover = ref(/** @type {null | object} */ (null))
  const blockCount = ref(0)
  const activeLayerId = ref('')
  const layersRevision = ref(0)
  const canUndo = ref(false)
  const canRedo = ref(false)

  const toolMeta = computed(
    () => VOXEL_TOOL_META.find((item) => item.id === tool.value) || VOXEL_TOOL_META[0],
  )

  const layerTreeUi = computed(() => {
    void layersRevision.value
    return voxelTreeForUi(world.layerTree)
  })

  const activeLayerName = computed(() => {
    void layersRevision.value
    const layer = world.activeLayer()
    return layer?.name || '—'
  })

  function bumpLayers() {
    layersRevision.value += 1
    activeLayerId.value = world.activeLayerId
  }

  function syncCount() {
    blockCount.value = world.size
  }

  function captureHistory() {
    return world.exportSnapshot()
  }

  function restoreHistory(snapshot) {
    world.restoreSnapshot(snapshot)
    selected.value = null
    syncFromWorld()
  }

  const history = createHistory(MAX_HISTORY, captureHistory, restoreHistory)

  function syncHistoryFlags() {
    canUndo.value = history.canUndo()
    canRedo.value = history.canRedo()
  }

  function recordHistory() {
    if (viewOnly) return
    history.record()
    syncHistoryFlags()
  }

  function undo() {
    if (viewOnly) return
    if (!history.undo()) return
    syncHistoryFlags()
  }

  function redo() {
    if (viewOnly) return
    if (!history.redo()) return
    syncHistoryFlags()
  }

  function resetHistory() {
    history.reset()
    syncHistoryFlags()
  }

  /**
   * @param {Array<{ id: number, hex: string }>} colors
   */
  function initPalette(colors) {
    const first = colors.find((item) => item.id !== 0)
    if (!first) return
    activeColor.value = first.hex
    activeColorId.value = first.id
  }

  function syncFromWorld() {
    bumpLayers()
    syncCount()
  }

  /**
   * @param {{ id: number, hex: string }} swatch
   */
  function setColor(swatch) {
    if (!swatch || swatch.id === 0) return
    activeColor.value = swatch.hex
    activeColorId.value = swatch.id
  }

  /**
   * @param {string} next
   */
  function setTool(next) {
    if (!Object.values(VOXEL_TOOLS).includes(next)) return
    tool.value = next
    if (next !== VOXEL_TOOLS.SELECT) stackMode.value = false
  }

  function setStackMode(on) {
    stackMode.value = Boolean(on)
    if (stackMode.value) tool.value = VOXEL_TOOLS.SELECT
  }

  /**
   * @param {string} dirId
   */
  function stack(dirId) {
    if (viewOnly || !stackMode.value) return 0
    const dir = STACK_DIRS[dirId]
    if (!dir) return 0
    if (!world.stackPreviewCount(dir)) return 0
    recordHistory()
    const created = world.stackActive(dir)
    if (created) syncCount()
    return created
  }

  /**
   * @param {{ id: string, additive?: boolean } | string} payload
   */
  function selectLayer(payload) {
    const id = typeof payload === 'string' ? payload : payload?.id
    if (!id) return
    if (world.setActiveLayer(id)) bumpLayers()
  }

  function toggleLayerVisible(id) {
    recordHistory()
    if (world.toggleVisible(id)) {
      bumpLayers()
      syncCount()
    }
  }

  function renameLayer(payload) {
    if (!payload?.id) return
    if (world.renameNode(payload.id, payload.name)) bumpLayers()
  }

  function toggleLayerCollapsed(id) {
    if (world.toggleCollapsed(id)) bumpLayers()
  }

  /**
   * @param {object | null} hit
   */
  function addTarget(hit) {
    if (!hit) return null
    if (hit.kind === 'ground') {
      const pos = { x: hit.x, y: 0, z: hit.z }
      if (!world.inBounds(pos.x, pos.y, pos.z) || world.has(pos.x, pos.y, pos.z)) return null
      return pos
    }
    const pos = adjacentCell(hit, hit.faceNormal)
    if (!world.inBounds(pos.x, pos.y, pos.z) || world.has(pos.x, pos.y, pos.z)) return null
    return pos
  }

  /**
   * @param {object | null} hit
   */
  function setHover(hit) {
    if (!hit) {
      hover.value = null
      return
    }
    hover.value = {
      ...hit,
      addPos: addTarget(hit),
    }
  }

  /**
   * @param {object | null} hit
   */
  function applyClick(hit) {
    if (viewOnly) return false
    if (stackMode.value) return false
    if (!hit) return false
    if (tool.value === VOXEL_TOOLS.SELECT) {
      if (hit.kind !== 'block') {
        selected.value = null
        return true
      }
      selected.value = {
        x: hit.x,
        y: hit.y,
        z: hit.z,
        faceNormal: hit.faceNormal,
        face: hit.face,
      }
      const shown = world.get(hit.x, hit.y, hit.z)
      if (shown?.layerId) selectLayer(shown.layerId)
      return true
    }
    if (tool.value === VOXEL_TOOLS.ADD) {
      const pos = addTarget(hit)
      if (!pos) return false
      recordHistory()
      const op = world.addBlock({
        ...pos,
        color: activeColor.value,
        colorId: activeColorId.value,
      })
      if (op) {
        syncCount()
        selected.value = {
          x: pos.x,
          y: pos.y,
          z: pos.z,
          faceNormal: { x: 0, y: 1, z: 0 },
          face: 'TOP',
        }
      }
      return Boolean(op)
    }
    if (tool.value === VOXEL_TOOLS.REMOVE) {
      if (hit.kind !== 'block') return false
      const layer = world.activeLayer()
      if (!layer?.voxels.has(blockKey(hit.x, hit.y, hit.z))) return false
      recordHistory()
      const op = world.removeBlock(hit.x, hit.y, hit.z)
      if (op) {
        syncCount()
        if (
          selected.value &&
          selected.value.x === hit.x &&
          selected.value.y === hit.y &&
          selected.value.z === hit.z
        ) {
          selected.value = null
        }
      }
      return Boolean(op)
    }
    return false
  }

  function onKey(event) {
    const key = event.key.toLowerCase()
    if ((event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
      event.preventDefault()
      undo()
      return
    }
    if ((event.ctrlKey || event.metaKey) && (key === 'y' || (key === 'z' && event.shiftKey))) {
      event.preventDefault()
      redo()
      return
    }
    const tag = String(event.target?.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return
    if (key === 'v') {
      setTool(VOXEL_TOOLS.SELECT)
      return
    }
    if (key === 'a') {
      setTool(VOXEL_TOOLS.ADD)
      return
    }
    if (key === 'r') {
      setTool(VOXEL_TOOLS.REMOVE)
      return
    }
    if (key === 'e') {
      setStackMode(!stackMode.value)
      event.preventDefault()
      return
    }
    if (!stackMode.value) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      stack('left')
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      stack('right')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      stack('up')
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      stack('down')
    }
  }

  onMounted(() => {
    if (viewOnly) return
    window.addEventListener('keydown', onKey)
  })
  onUnmounted(() => {
    if (viewOnly) return
    window.removeEventListener('keydown', onKey)
  })

  return {
    tool,
    toolMeta,
    stackMode,
    activeColor,
    activeColorId,
    selected,
    hover,
    blockCount,
    activeLayerId,
    activeLayerName,
    layerTreeUi,
    canUndo,
    canRedo,
    initPalette,
    setColor,
    setTool,
    setStackMode,
    stack,
    selectLayer,
    toggleLayerVisible,
    renameLayer,
    toggleLayerCollapsed,
    setHover,
    applyClick,
    addTarget,
    syncCount,
    syncFromWorld,
    undo,
    redo,
    resetHistory,
  }
}
