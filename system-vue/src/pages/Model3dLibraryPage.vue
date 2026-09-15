<script setup>
/**
 * Biblioteca do módulo 3D: construções em maps/3DMap e bases Pixel Art
 * que ainda não têm um JSON 3D salvo.
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmModal from '@/components/ConfirmModal.vue'
import MapLibraryGrid from '@/components/MapLibraryGrid.vue'
import { LIBRARY_KINDS } from '@/constants/brand.js'
import { mapFileStem } from '@/utils/fileName.js'
import { deleteLibraryMap, listLibraryMaps } from '@/utils/libraryApi.js'

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
    const [voxel, pixel] = await Promise.all([
      listLibraryMaps(LIBRARY_KINDS.MODEL_3D),
      listLibraryMaps(LIBRARY_KINDS.PIXEL),
    ])
    const savedStems = new Set(voxel.map((item) => mapFileStem(item.id)))
    items.value = [
      ...voxel.map((item) => ({ ...item, libraryKind: LIBRARY_KINDS.MODEL_3D })),
      ...pixel
        .filter((item) => !savedStems.has(mapFileStem(item.id)))
        .map((item) => ({ ...item, libraryKind: LIBRARY_KINDS.PIXEL })),
    ]
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Falha ao ler a biblioteca.'
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(refresh)

function onView(id) {
  router.push({ name: '3d-view', query: { file: id } })
}

function onEdit(id) {
  router.push({ name: '3d-edit', query: { file: id } })
}

function onCreate() {
  router.push({ name: 'pixel-edit' })
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
    const kind = pendingDelete.value.libraryKind || LIBRARY_KINDS.MODEL_3D
    await deleteLibraryMap(kind, pendingDelete.value.id)
    pendingDelete.value = null
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não foi possível excluir o mapa.'
  } finally {
    deleting.value = false
  }
}

const deleteMessage = () => {
  const item = pendingDelete.value
  if (!item) return ''
  if (item.libraryKind === LIBRARY_KINDS.PIXEL) {
    return `Isso apaga “${item.name}” da biblioteca Pixel Art. Não dá para desfazer.`
  }
  return `Isso apaga a construção 3D “${item.name}” em maps/3DMap. A base Pixel Art permanece.`
}
</script>

<template>
  <section>
    <header class="head">
      <h2>Mapa 3D</h2>
      <p>
        Ver só orbita o terreno em blocos. Editar abre o editor voxel para empilhar,
        adicionar e remover cubos. Salvar grava o JSON da construção em maps/3DMap.
        A pintura da base 2D continua no Mapa PixelArt.
      </p>
    </header>
    <MapLibraryGrid
      :items="items"
      :loading="loading"
      :error="error"
      create-label="Criar uma base"
      @create="onCreate"
      @view="onView"
      @edit="onEdit"
      @delete="requestDelete"
    />
    <ConfirmModal
      v-if="pendingDelete"
      title="Excluir mapa?"
      :message="deleteMessage()"
      cancel-label="Cancelar"
      confirm-label="Excluir"
      danger
      :busy="deleting"
      @cancel="cancelDelete"
      @confirm="confirmDelete"
    />
  </section>
</template>

<style scoped>
.head {
  margin-bottom: 18px;
}

.head h2 {
  margin: 0 0 6px;
  font-size: 1.15rem;
}

.head p {
  margin: 0;
  max-width: 42rem;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--ink-dim);
}
</style>
