/**
 * Carrega o JSON do mapa Pixel Art (mesmo formato/arquivo da biblioteca),
 * compõe as camadas e expõe a grade 2D. Os cubos 3D são só uma transformação
 * dessa grade — não há uma segunda cópia persistida.
 */
import { computed, ref } from 'vue'
import { LIBRARY_KINDS } from '@/constants/brand.js'
import { parseMapFile } from '@/utils/fileFormat.js'
import { compositeLayerTree } from '@/utils/layers.js'
import { fetchLibraryMap } from '@/utils/libraryApi.js'

/**
 * Tenta o arquivo na biblioteca Pixel Art e, se não houver, na pasta 3D.
 * @param {string} id
 */
async function fetchPixelOr3dMap(id) {
  try {
    return await fetchLibraryMap(LIBRARY_KINDS.PIXEL, id)
  } catch {
    return fetchLibraryMap(LIBRARY_KINDS.MODEL_3D, id)
  }
}

export function usePixelMap3D() {
  const loading = ref(true)
  const error = ref('')
  const mapName = ref('')
  const grid = ref(/** @type {number[][]} */ ([[]]))
  const colors = ref(/** @type {Array<{ id: number, name: string, hex: string }>} */ ([]))
  const sceneTick = ref(0)

  const canShow = computed(
    () => !error.value && grid.value.length > 0 && grid.value[0]?.length > 0,
  )

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
      const raw = await fetchPixelOr3dMap(id)
      const parsed = parseMapFile(raw)
      mapName.value = parsed.mapName
      colors.value = [...parsed.fixedColors, ...parsed.customColors]
      grid.value = compositeLayerTree(parsed.layerTree, parsed.width, parsed.height)
      sceneTick.value += 1
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Não foi possível abrir o mapa.'
      grid.value = [[]]
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    mapName,
    grid,
    colors,
    sceneTick,
    canShow,
    load,
  }
}
