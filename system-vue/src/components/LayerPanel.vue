<script setup>
/**
 * LayerPanel.vue
 *
 * Lista a árvore de camadas e grupos: olho (visível), nome, seleção.
 * Grupos aparecem em cascata; o olho do grupo aplica-se a todas as filhas.
 */
import LayerRow from '@/components/LayerRow.vue'

defineProps({
  tree: { type: Array, required: true },
  activeId: { type: String, default: '' },
})

const emit = defineEmits({
  select: (id) => typeof id === 'string',
  'toggle-visible': (id) => typeof id === 'string',
  rename: null,
  'toggle-collapsed': (id) => typeof id === 'string',
  addLayer: null,
  addGroup: null,
  group: null,
  remove: null,
  shift: (dir) => typeof dir === 'number',
})
</script>

<template>
  <section class="layers" aria-label="Camadas">
    <ul class="tree">
      <LayerRow
        v-for="node in [...tree].reverse()"
        :key="node.id"
        :node="node"
        :active-id="activeId"
        :depth="0"
        @select="emit('select', $event)"
        @toggle-visible="emit('toggle-visible', $event)"
        @rename="emit('rename', $event)"
        @toggle-collapsed="emit('toggle-collapsed', $event)"
      />
    </ul>

    <div class="row-btns">
      <button type="button" class="ghost" title="Nova camada" @click="emit('addLayer')">+ Camada</button>
      <button type="button" class="ghost" title="Novo grupo" @click="emit('addGroup')">+ Grupo</button>
    </div>
    <div class="row-btns">
      <button type="button" class="ghost" @click="emit('group')">Agrupar</button>
      <button type="button" class="ghost" title="Trazer para frente" @click="emit('shift', 1)">↑</button>
      <button type="button" class="ghost" title="Enviar para trás" @click="emit('shift', -1)">↓</button>
      <button type="button" class="danger" @click="emit('remove')">Excluir</button>
    </div>
  </section>
</template>

<style scoped>
.layers {
  display: grid;
  gap: 8px;
}

.tree {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-input);
  max-height: 220px;
  overflow: auto;
}

.row-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ghost,
.danger {
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.ghost {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
}

.danger {
  border: 1px solid rgba(196, 92, 74, 0.45);
  background: transparent;
  color: var(--danger-text);
  margin-left: auto;
}
</style>
