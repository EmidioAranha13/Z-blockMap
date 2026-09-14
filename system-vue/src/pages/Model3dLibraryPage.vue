<script setup>
import ConfirmModal from '@/components/ConfirmModal.vue'
import MapLibraryGrid from '@/components/MapLibraryGrid.vue'
import { useMapLibrary } from '@/composables/useMapLibrary.js'
import { LIBRARY_KINDS } from '@/constants/brand.js'

const {
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
} = useMapLibrary(LIBRARY_KINDS.MODEL_3D)
</script>

<template>
  <section>
    <header class="head">
      <h2>Mapa 3D</h2>
      <p>
        Prepare a base do mapa para virar um modelo 3D. Desenhe e organize o terreno aqui;
        a conversão para volume entra na sequência do fluxo.
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
      :message="`Isso apaga “${pendingDelete.name}” da biblioteca. Não dá para desfazer.`"
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
