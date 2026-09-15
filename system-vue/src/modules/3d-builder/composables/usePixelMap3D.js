/**
 * Carrega o JSON da construção 3D (maps/3DMap) ou, se ainda não houver,
 * a base Pixel Art (maps/pixelMap) para converter em cubos.
 */
import { computed, ref } from 'vue'
import { LIBRARY_KINDS } from '@/constants/brand.js'
import { parseMapFile } from '@/utils/fileFormat.js'
import { fetchLibraryMap } from '@/utils/libraryApi.js'
import { isVoxelMapFile, parseVoxelMapFile } from '../utils/fileFormat3d.js'

/**
 * Prefere a construção 3D salva; cai na base Pixel Art se ainda não existir.
 * @param {string} id
 */
async function fetch3dOrPixelMap(id) {
  try {
    const raw = await fetchLibraryMap(LIBRARY_KINDS.MODEL_3D, id)
    return { raw, sourceKind: LIBRARY_KINDS.MODEL_3D }
  } catch {
    const raw = await fetchLibraryMap(LIBRARY_KINDS.PIXEL, id)
    return { raw, sourceKind: LIBRARY_KINDS.PIXEL }
  }
}

export function usePixelMap3D() {
  const loading = ref(true)
  const error = ref('')
  const mapName = ref('')
  const mapWidth = ref(0)
  const mapHeight = ref(0)
  const layerTree = ref([])
  const voxelLayerTree = ref(null)
  const isVoxelFile = ref(false)
  const sourceKind = ref(LIBRARY_KINDS.PIXEL)
  const sourcePixelMap = ref('')
  const libraryFileName = ref('')
  const fixedColors = ref([])
  const customColors = ref([])
  const colors = ref(/** @type {Array<{ id: number, name: string, hex: string }>} */ ([]))
  const sceneTick = ref(0)

  const canShow = computed(() => !error.value && mapWidth.value > 0 && mapHeight.value > 0)

  /**
   * @param {string} fileId
   */
  async function load(fileId) {
    const id = String(fileId || '')
    if (!id) {
      loading.value = false
      error.value = 'Mapa não informado.'
      return
    }
    loading.value = true
    error.value = ''
    try {
      const found = await fetch3dOrPixelMap(id)
      libraryFileName.value = id
      sourceKind.value = found.sourceKind
      if (isVoxelMapFile(found.raw)) {
        const parsed = parseVoxelMapFile(found.raw)
        isVoxelFile.value = true
        mapName.value = parsed.mapName
        mapWidth.value = parsed.width
        mapHeight.value = parsed.height
        voxelLayerTree.value = parsed.layerTree
        layerTree.value = []
        sourcePixelMap.value = parsed.sourcePixelMap || ''
        fixedColors.value = parsed.fixedColors
        customColors.value = parsed.customColors
        colors.value = [...parsed.fixedColors, ...parsed.customColors]
      } else {
        const parsed = parseMapFile(found.raw)
        isVoxelFile.value = false
        mapName.value = parsed.mapName
        mapWidth.value = parsed.width
        mapHeight.value = parsed.height
        layerTree.value = parsed.layerTree
        voxelLayerTree.value = null
        sourcePixelMap.value = found.sourceKind === LIBRARY_KINDS.PIXEL ? id : ''
        fixedColors.value = parsed.fixedColors
        customColors.value = parsed.customColors
        colors.value = [...parsed.fixedColors, ...parsed.customColors]
      }
      sceneTick.value += 1
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Não foi possível abrir o mapa.'
      layerTree.value = []
      voxelLayerTree.value = null
      mapWidth.value = 0
      mapHeight.value = 0
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    mapName,
    mapWidth,
    mapHeight,
    layerTree,
    voxelLayerTree,
    isVoxelFile,
    sourceKind,
    sourcePixelMap,
    libraryFileName,
    fixedColors,
    customColors,
    colors,
    sceneTick,
    canShow,
    load,
  }
}
