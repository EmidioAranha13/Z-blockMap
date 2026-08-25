<script>
/**
 * LayerRow.vue
 *
 * Uma linha da árvore de camadas. Recursiva: grupos renderizam as filhas
 * indentadas abaixo (em cascata).
 */
import closeEye from '@/assets/close_eye.png'
import openEye from '@/assets/open_eye.png'

export default {
  name: 'LayerRow',
  props: {
    node: { type: Object, required: true },
    activeId: { type: String, default: '' },
    depth: { type: Number, default: 0 },
  },
  emits: ['select', 'toggle-visible', 'rename', 'toggle-collapsed'],
  data() {
    return { closeEye, openEye }
  },
}
</script>

<template>
  <li>
    <div
      class="item"
      :class="{ 'item--on': activeId === node.id, 'item--group': node.type === 'group' }"
      :style="{ paddingLeft: 6 + depth * 12 + 'px' }"
      @click="$emit('select', node.id)"
    >
      <button
        v-if="node.type === 'group'"
        type="button"
        class="caret"
        :title="node.collapsed ? 'Expandir grupo' : 'Recolher grupo'"
        @click.stop="$emit('toggle-collapsed', node.id)"
      >
        {{ node.collapsed ? '▸' : '▾' }}
      </button>
      <button
        type="button"
        class="eye"
        :title="node.visible ? 'Ocultar' : 'Mostrar'"
        @click.stop="$emit('toggle-visible', node.id)"
      >
        <img
          class="eye__icon"
          :src="node.visible ? openEye : closeEye"
          alt=""
        />
      </button>
      <input
        class="name"
        :value="node.name"
        maxlength="40"
        @click.stop
        @change="$emit('rename', { id: node.id, name: $event.target.value })"
      />
      <span v-if="node.type === 'layer'" class="off">{{ node.offsetX }},{{ node.offsetY }}</span>
    </div>
    <ul v-if="node.type === 'group' && !node.collapsed && node.children.length" class="nest">
      <LayerRow
        v-for="child in [...node.children].reverse()"
        :key="child.id"
        :node="child"
        :active-id="activeId"
        :depth="depth + 1"
        @select="$emit('select', $event)"
        @toggle-visible="$emit('toggle-visible', $event)"
        @rename="$emit('rename', $event)"
        @toggle-collapsed="$emit('toggle-collapsed', $event)"
      />
    </ul>
  </li>
</template>

<style scoped>
.item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 6px;
  cursor: pointer;
  border-bottom: 1px solid var(--line);
}

.item--on {
  background: var(--tool-on);
}

.item--group .name {
  font-weight: 700;
}

.caret,
.eye {
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--ink);
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 0.85rem;
}

.eye__icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  filter: var(--icon-filter);
}

.name {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: 0.78rem;
}

.off {
  font-family: var(--mono);
  font-size: 0.65rem;
  color: var(--ink-dim);
}

.nest {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
