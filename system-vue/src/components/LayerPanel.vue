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
  selectedIds: { type: Array, default: () => [] },
})

const emit = defineEmits({
  select: (payload) =>
    typeof payload === 'string' || (payload && typeof payload.id === 'string'),
  'toggle-visible': (id) => typeof id === 'string',
  rename: null,
  'toggle-collapsed': (id) => typeof id === 'string',
  addLayer: null,
  addGroup: null,
  group: null,
  remove: null,
  duplicate: null,
  'flip-h': null,
  'flip-v': null,
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
        :selected-ids="selectedIds"
        :depth="0"
        @select="emit('select', $event)"
        @toggle-visible="emit('toggle-visible', $event)"
        @rename="emit('rename', $event)"
        @toggle-collapsed="emit('toggle-collapsed', $event)"
      />
    </ul>
    <p class="hint">Ctrl + clique para selecionar várias camadas.</p>

    <div class="row-btns">
      <button type="button" class="ghost" title="Nova camada" @click="emit('addLayer')">+ Camada</button>
      <button type="button" class="ghost" title="Novo grupo" @click="emit('addGroup')">+ Grupo</button>
    </div>
    <div class="row-btns">
      <button type="button" class="ghost" title="Duplicar as camadas ou grupos selecionados" @click="emit('duplicate')">Duplicar</button>
      <button type="button" class="ghost" title="Inverter as camadas selecionadas na horizontal" @click="emit('flip-h')">Inverter H</button>
      <button type="button" class="ghost" title="Inverter as camadas selecionadas na vertical" @click="emit('flip-v')">Inverter V</button>
    </div>
    <div class="row-btns">
      <button type="button" class="ghost" title="Agrupar as camadas selecionadas (precisam ser irmãs, no mesmo nível)" @click="emit('group')">Agrupar</button>
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

.hint {
  margin: 0;
  font-size: 0.72rem;
  color: var(--ink-dim);
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
