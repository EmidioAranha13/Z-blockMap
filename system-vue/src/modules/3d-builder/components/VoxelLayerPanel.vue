<script setup>
/**
 * Lista compacta das camadas Pixel Art no editor 3D.
 */
import LayerRow from '@/components/LayerRow.vue'

defineProps({
  tree: { type: Array, required: true },
  activeId: { type: String, default: '' },
})

const emit = defineEmits({
  select: (payload) =>
    typeof payload === 'string' || (payload && typeof payload.id === 'string'),
  'toggle-visible': (id) => typeof id === 'string',
  rename: null,
  'toggle-collapsed': (id) => typeof id === 'string',
})
</script>

<template>
  <section class="layers" aria-label="Camadas do mapa">
    <ul class="tree">
      <LayerRow
        v-for="node in [...tree].reverse()"
        :key="node.id"
        :node="node"
        :active-id="activeId"
        :selected-ids="activeId ? [activeId] : []"
        :depth="0"
        @select="emit('select', $event)"
        @toggle-visible="emit('toggle-visible', $event)"
        @rename="emit('rename', $event)"
        @toggle-collapsed="emit('toggle-collapsed', $event)"
      />
    </ul>
    <p class="hint">A ferramenta ADD/REMOVE e o empilhamento atuam nesta camada.</p>
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
  max-height: 200px;
  overflow: auto;
}

.hint {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.4;
  color: var(--ink-dim);
}
</style>
