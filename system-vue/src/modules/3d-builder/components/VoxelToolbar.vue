<script setup>
/**
 * Ferramentas, paleta, camadas Pixel Art e empilhamento experimental.
 */
import { computed } from 'vue'
import { STACK_DIRS, VOXEL_TOOL_META } from '../constants.js'
import VoxelLayerPanel from './VoxelLayerPanel.vue'

const props = defineProps({
  tool: { type: String, required: true },
  colors: { type: Array, required: true },
  activeColorId: { type: Number, required: true },
  selected: { type: Object, default: null },
  hover: { type: Object, default: null },
  blockCount: { type: Number, default: 0 },
  hint: { type: String, default: '' },
  layerTree: { type: Array, default: () => [] },
  activeLayerId: { type: String, default: '' },
  activeLayerName: { type: String, default: '' },
  stackMode: { type: Boolean, default: false },
  canUndo: { type: Boolean, default: false },
  canRedo: { type: Boolean, default: false },
  fileMessage: { type: String, default: '' },
  saving: { type: Boolean, default: false },
})

const emit = defineEmits({
  'set-tool': (id) => typeof id === 'string',
  'set-color': (swatch) => swatch && typeof swatch.id === 'number',
  'select-layer': null,
  'toggle-visible': (id) => typeof id === 'string',
  rename: null,
  'toggle-collapsed': (id) => typeof id === 'string',
  'set-stack-mode': (on) => typeof on === 'boolean',
  stack: (dirId) => typeof dirId === 'string',
  undo: null,
  redo: null,
  save: null,
})

const paintColors = computed(() => props.colors.filter((item) => item.id !== 0))

const hoverLabel = computed(() => {
  const hit = props.hover
  if (!hit) return '—'
  const cell = `${hit.x}, ${hit.y}, ${hit.z}`
  if (hit.kind === 'ground') return `${cell} · chão`
  return `${cell} · ${hit.face}`
})

const selectedLabel = computed(() => {
  const sel = props.selected
  if (!sel) return '—'
  return `${sel.x}, ${sel.y}, ${sel.z} · ${sel.face}`
})
</script>

<template>
  <aside class="toolbar" aria-label="Ferramentas 3D">
    <h2>Ferramentas</h2>
    <div class="tools" role="group">
      <button
        v-for="item in VOXEL_TOOL_META"
        :key="item.id"
        type="button"
        class="tool"
        :class="{ 'tool--on': tool === item.id && !stackMode }"
        :title="`${item.hint} (${item.shortcut})`"
        :aria-pressed="tool === item.id && !stackMode"
        @click="emit('set-tool', item.id)"
      >
        <span class="tool__name">{{ item.label }}</span>
        <kbd>{{ item.shortcut }}</kbd>
      </button>
    </div>

    <h2>Arquivo</h2>
    <div class="history">
      <button type="button" class="ghost" :disabled="!canUndo" title="Desfazer (Ctrl+Z)" @click="emit('undo')">
        Undo
      </button>
      <button type="button" class="ghost" :disabled="!canRedo" title="Refazer (Ctrl+Y)" @click="emit('redo')">
        Redo
      </button>
    </div>
    <button type="button" class="ghost" :disabled="saving" @click="emit('save')">
      {{ saving ? 'Salvando…' : 'Salvar mapa' }}
    </button>
    <p v-if="fileMessage" class="toolbar__hint">{{ fileMessage }}</p>

    <h2>Camadas</h2>
    <VoxelLayerPanel
      :tree="layerTree"
      :active-id="activeLayerId"
      @select="emit('select-layer', $event)"
      @toggle-visible="emit('toggle-visible', $event)"
      @rename="emit('rename', $event)"
      @toggle-collapsed="emit('toggle-collapsed', $event)"
    />

    <h2>Empilhar</h2>
    <p class="toolbar__hint">
      Experimental: escolha a camada, ative a função e use as setas. Cima sobe a altura
      do desenho (um cubo sobre cada pixel da camada).
    </p>
    <button
      type="button"
      class="tool"
      :class="{ 'tool--on': stackMode }"
      title="Empilhar a camada selecionada (E)"
      :aria-pressed="stackMode"
      @click="emit('set-stack-mode', !stackMode)"
    >
      <span class="tool__name">Empilhar camada</span>
      <kbd>E</kbd>
    </button>
    <div class="pad" role="group" aria-label="Direção do empilhamento">
      <span class="pad__cell" />
      <button
        type="button"
        class="pad__btn"
        :disabled="!stackMode"
        :title="`Cima (${STACK_DIRS.up.axis})`"
        @click="emit('stack', 'up')"
      >
        ↑
      </button>
      <span class="pad__cell" />
      <button
        type="button"
        class="pad__btn"
        :disabled="!stackMode"
        :title="`Esquerda (${STACK_DIRS.left.axis})`"
        @click="emit('stack', 'left')"
      >
        ←
      </button>
      <span class="pad__mid">{{ activeLayerName }}</span>
      <button
        type="button"
        class="pad__btn"
        :disabled="!stackMode"
        :title="`Direita (${STACK_DIRS.right.axis})`"
        @click="emit('stack', 'right')"
      >
        →
      </button>
      <span class="pad__cell" />
      <button
        type="button"
        class="pad__btn"
        :disabled="!stackMode"
        :title="`Baixo (${STACK_DIRS.down.axis})`"
        @click="emit('stack', 'down')"
      >
        ↓
      </button>
      <span class="pad__cell" />
    </div>

    <h2>Cor do bloco</h2>
    <div class="swatches" role="list">
      <button
        v-for="swatch in paintColors"
        :key="swatch.id"
        type="button"
        class="swatch"
        :class="{ 'swatch--on': activeColorId === swatch.id }"
        :title="`${swatch.name} (${swatch.hex})`"
        :style="{ background: swatch.hex }"
        @click="emit('set-color', swatch)"
      >
        <span class="sr">{{ swatch.name }}</span>
      </button>
    </div>

    <dl class="stats">
      <div>
        <dt>Cubos</dt>
        <dd>{{ blockCount }}</dd>
      </div>
      <div>
        <dt>Cursor</dt>
        <dd>{{ hoverLabel }}</dd>
      </div>
      <div>
        <dt>Seleção</dt>
        <dd>{{ selectedLabel }}</dd>
      </div>
    </dl>
    <p v-if="stackMode" class="toolbar__hint">
      Ativo na camada «{{ activeLayerName }}». Cada seta copia todos os cubos um passo.
    </p>
    <p v-else-if="hint" class="toolbar__hint">{{ hint }}</p>
  </aside>
</template>

<style scoped>
.toolbar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 14px 16px;
  border-right: 1px solid var(--line);
  background: var(--bg-panel);
  overflow-y: auto;
  min-height: 0;
}

h2 {
  margin: 4px 0 0;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--brass);
}

.tools,
.history {
  display: grid;
  gap: 6px;
}

.history {
  grid-template-columns: 1fr 1fr;
}

.ghost {
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font-weight: 600;
}

.ghost:disabled {
  opacity: 0.4;
  cursor: default;
}

.tool {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-raised);
  color: var(--ink);
  text-align: left;
}

.tool:hover {
  border-color: var(--brass);
}

.tool--on {
  border-color: var(--brass);
  background: var(--tool-on);
  box-shadow: inset 3px 0 0 var(--brass);
}

.tool__name {
  font-size: 0.85rem;
  font-weight: 600;
}

kbd {
  padding: 1px 6px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--bg-input);
  font-family: var(--mono);
  font-size: 0.68rem;
  color: var(--ink-dim);
}

.pad {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 4px;
  align-items: stretch;
}

.pad__cell {
  min-height: 36px;
}

.pad__btn {
  min-height: 36px;
  margin: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-raised);
  color: var(--ink);
  font-size: 1.1rem;
  font-weight: 700;
}

.pad__btn:hover:not(:disabled) {
  border-color: var(--brass);
}

.pad__btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.pad__mid {
  display: grid;
  place-items: center;
  padding: 4px;
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--ink-dim);
  font-size: 0.65rem;
  text-align: center;
  overflow: hidden;
}

.swatches {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
}

.swatch {
  aspect-ratio: 1;
  border: 2px solid transparent;
  border-radius: 6px;
  padding: 0;
}

.swatch--on {
  border-color: var(--swatch-on);
  outline: 1px solid var(--brass);
}

.stats {
  display: grid;
  gap: 8px;
  margin: 8px 0 0;
}

.stats div {
  display: grid;
  gap: 2px;
}

dt {
  font-size: 0.68rem;
  color: var(--ink-dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

dd {
  margin: 0;
  font-family: var(--mono);
  font-size: 0.78rem;
}

.toolbar__hint {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--ink-dim);
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
</style>
