<script setup>
/**
 * EditorToolbar.vue
 *
 * Ferramentas de desenho, paleta (fixas + roda) e ações de arquivo/histórico.
 */
import ColorPalette from '@/components/ColorPalette.vue'
import { TOOL_META } from '@/constants/tools.js'
import tintaIcon from '@/assets/tinta.png'

defineProps({
  activeTool: { type: String, required: true },
  fillShapes: { type: Boolean, required: true },
  selectedColor: { type: Number, required: true },
  selectedColorInfo: { type: Object, default: null },
  fixedColors: { type: Array, required: true },
  recentCustom: { type: Array, required: true },
  extraCustom: { type: Array, required: true },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  brushSize: { type: Number, default: 1 },
})

const emit = defineEmits({
  'set-tool': (toolId) => typeof toolId === 'string',
  'set-color': (colorId) => typeof colorId === 'number',
  'update:fillShapes': (value) => typeof value === 'boolean',
  'commit-color': (hex) => typeof hex === 'string',
  rename: null,
  recolor: null,
  undo: null,
  redo: null,
  save: null,
  load: null,
  png: null,
  clear: null,
  'set-brush': (size) => typeof size === 'number',
})
</script>

<template>
  <section class="toolbar" aria-label="Ferramentas de desenho">
    <div>
      <span class="kicker">Ferramenta</span>
      <div class="tool-list">
        <button
          v-for="tool in TOOL_META"
          :key="tool.id"
          type="button"
          class="tool"
          :class="{ 'tool--on': activeTool === tool.id }"
          :title="tool.hint"
          @click="emit('set-tool', tool.id)"
        >
          <span class="tool__lead">
            <img v-if="tool.icon === 'tinta'" class="tool__icon" :src="tintaIcon" alt="" />
            <span class="tool__name">{{ tool.label }}</span>
          </span>
          <kbd>{{ tool.shortcut }}</kbd>
        </button>
      </div>
    </div>

    <label class="fill">
      <span>Pixels</span>
      <select
        class="brush"
        :value="brushSize"
        @change="emit('set-brush', Number($event.target.value))"
      >
        <option :value="1">1 × 1</option>
        <option :value="2">2 × 2</option>
        <option :value="3">3 × 3</option>
      </select>
    </label>

    <label class="fill" :class="{ 'fill--dim': activeTool !== 'circle' }">
      <input
        type="checkbox"
        :checked="fillShapes"
        :disabled="activeTool !== 'circle'"
        @change="emit('update:fillShapes', $event.target.checked)"
      />
      Preencher forma
    </label>

    <ColorPalette
      :fixed-colors="fixedColors"
      :recent-custom="recentCustom"
      :extra-custom="extraCustom"
      :selected-color="selectedColor"
      :selected-color-info="selectedColorInfo"
      @set-color="emit('set-color', $event)"
      @commit="emit('commit-color', $event)"
      @rename="emit('rename', $event)"
      @recolor="emit('recolor', $event)"
    />

    <div class="history">
      <button type="button" class="ghost" :disabled="!canUndo" @click="emit('undo')">
        Undo
      </button>
      <button type="button" class="ghost" :disabled="!canRedo" @click="emit('redo')">
        Redo
      </button>
    </div>

    <div class="actions">
      <button type="button" class="ghost" @click="emit('save')">Salvar mapa</button>
      <button type="button" class="ghost" @click="emit('load')">Carregar mapa</button>
      <button type="button" class="ghost" @click="emit('png')">Salvar PNG</button>
      <button type="button" class="danger" @click="emit('clear')">Limpar mapa</button>
    </div>
  </section>
</template>

<style scoped>
.toolbar {
  display: grid;
  gap: 16px;
}

.kicker {
  display: block;
  margin-bottom: 8px;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--brass);
}

.tool-list {
  display: grid;
  gap: 6px;
}

.tool {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-raised);
  color: var(--ink);
  text-align: left;
}

.tool--on {
  border-color: var(--brass);
  background: var(--tool-on);
  box-shadow: inset 3px 0 0 var(--brass);
}

.tool__lead {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.tool__icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  filter: var(--icon-filter);
}

.tool__name {
  font-weight: 600;
}

kbd {
  font-family: var(--mono);
  font-size: 0.72rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--ink-dim);
}

.fill {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
}

.brush {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--ink);
}

.fill--dim {
  opacity: 0.45;
}

.history {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.actions {
  display: grid;
  gap: 6px;
}

.ghost,
.danger {
  padding: 8px 10px;
  border-radius: 8px;
  font-weight: 600;
}

.ghost {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
}

.ghost:disabled {
  opacity: 0.4;
  cursor: default;
}

.danger {
  border: 1px solid rgba(196, 92, 74, 0.45);
  background: transparent;
  color: var(--danger-text);
}
</style>
