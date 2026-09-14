/**
 * Lista, abre e exclui mapas de uma biblioteca (pixel ou 3D).
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  deleteLibraryMap,
  editorRouteName,
  listLibraryMaps,
  viewerRouteName,
} from '@/utils/libraryApi.js'

/**
 * @param {'pixel' | '3d'} kind
 */
export function useMapLibrary(kind) {
  const router = useRouter()
  const items = ref([])
  const loading = ref(true)
  const error = ref('')
  const pendingDelete = ref(null)
  const deleting = ref(false)

  async function refresh() {
    loading.value = true
    error.value = ''
    try {
      items.value = await listLibraryMaps(kind)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Falha ao ler a biblioteca.'
      items.value = []
    } finally {
      loading.value = false
    }
  }

  onMounted(refresh)

  function onCreate() {
    router.push({ name: editorRouteName(kind) })
  }

  function onView(id) {
    router.push({ name: viewerRouteName(kind), query: { file: id } })
  }

  function onEdit(id) {
    router.push({ name: editorRouteName(kind), query: { file: id } })
  }

  function requestDelete(id) {
    pendingDelete.value = items.value.find((item) => item.id === id) || { id, name: id }
  }

  function cancelDelete() {
    if (deleting.value) return
    pendingDelete.value = null
  }

  async function confirmDelete() {
    if (!pendingDelete.value) return
    deleting.value = true
    error.value = ''
    try {
      await deleteLibraryMap(kind, pendingDelete.value.id)
      pendingDelete.value = null
      await refresh()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Não foi possível excluir o mapa.'
    } finally {
      deleting.value = false
    }
  }

  return {
    items,
    loading,
    error,
    pendingDelete,
    deleting,
    onCreate,
    onView,
    onEdit,
    requestDelete,
    cancelDelete,
    confirmDelete,
  }
}
