<script setup>
/**
 * Biblioteca do módulo 3D: os mesmos mapas Pixel Art, vistos como voxel.
 * Editar continua no editor 2D — a fonte da verdade não é duplicada.
 */
import { useRouter } from 'vue-router'
import ConfirmModal from '@/components/ConfirmModal.vue'
import MapLibraryGrid from '@/components/MapLibraryGrid.vue'
import { useMapLibrary } from '@/composables/useMapLibrary.js'
import { LIBRARY_KINDS } from '@/constants/brand.js'

const router = useRouter()
const {
  items,
  loading,
  error,
  pendingDelete,
  deleting,
  onCreate,
  onEdit,
  requestDelete,
  cancelDelete,
  confirmDelete,
} = useMapLibrary(LIBRARY_KINDS.PIXEL)

function onView(id) {
  router.push({ name: '3d-view', query: { file: id } })
}
</script>

<template>
  <section>
    <header class="head">
      <h2>Mapa 3D</h2>
      <p>
        Cada pixel do mapa Pixel Art vira um cubo. Use Ver para orbitar o terreno em 360°;
        a pintura da base continua no editor Pixel Art.
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
      :message="`Isso apaga “${pendingDelete.name}” da biblioteca Pixel Art. Não dá para desfazer.`"
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
