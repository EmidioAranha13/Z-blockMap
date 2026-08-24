<script setup>
/**
 * ColorPalette.vue
 *
 * Paleta do editor:
 *  - 7 cores fixas
 *  - 7 slots das cores mais recentes da roda
 *  - collapse com o restante do histórico da roda
 *  - nome e hex editáveis da cor selecionada
 *
 * A roda em si fica num collapse para não ocupar a coluna o tempo todo.
 */
import { computed, ref, watch } from 'vue'
import { RECENT_COLOR_SLOTS } from '@/constants/limits.js'
import ColorWheel from '@/components/ColorWheel.vue'

const props = defineProps({
  fixedColors: { type: Array, required: true },
  recentCustom: { type: Array, required: true },
  extraCustom: { type: Array, required: true },
  selectedColor: { type: Number, required: true },
  selectedColorInfo: { type: Object, default: null },
})

const emit = defineEmits({
  'set-color': (id) => typeof id === 'number',
  commit: (hex) => typeof hex === 'string',
  rename: (payload) => payload && typeof payload.id === 'number',
  recolor: (payload) => payload && typeof payload.id === 'number',
})

const wheelOpen = ref(false)
const extraOpen = ref(false)
const wheelHex = ref('#c4a35a')
const nameDraft = ref('')
const hexDraft = ref('')

const emptySlots = computed(() =>
  Math.max(0, RECENT_COLOR_SLOTS - props.recentCustom.length),
)

watch(
  () => props.selectedColorInfo,
  (info) => {
    if (!info) return
    nameDraft.value = info.name
    hexDraft.value = info.hex
    if (info.id !== 0) wheelHex.value = info.hex
  },
  { immediate: true, deep: true },
)

/**
 * Confirma o nome ao sair do campo.
 */
function onNameBlur() {
  if (!props.selectedColorInfo) return
  emit('rename', { id: props.selectedColorInfo.id, name: nameDraft.value })
}

/**
 * Confirma o hex ao sair do campo (Enter também).
 */
function onHexBlur() {
  if (!props.selectedColorInfo || props.selectedColorInfo.id === 0) return
  emit('recolor', { id: props.selectedColorInfo.id, hex: hexDraft.value })
}
</script>

<template>
  <section class="palette" aria-label="Paleta de cores">
    <span class="kicker">Cor</span>

    <div class="selected">
      <span
        class="selected__swatch"
        :style="{ background: selectedColorInfo ? selectedColorInfo.hex : '#808080' }"
      />
      <label class="selected__field">
        <span>Nome</span>
        <input
          v-model="nameDraft"
          type="text"
          maxlength="32"
          @blur="onNameBlur"
          @keydown.enter.prevent="onNameBlur"
        />
      </label>
      <label class="selected__field">
        <span>Hex</span>
        <input
          v-model="hexDraft"
          type="text"
          maxlength="7"
          :disabled="selectedColor === 0"
          @blur="onHexBlur"
          @keydown.enter.prevent="onHexBlur"
        />
      </label>
    </div>

    <p class="row-label">Fixas</p>
    <div class="swatches" role="list">
      <button
        v-for="swatch in fixedColors"
        :key="swatch.id"
        type="button"
        class="swatch"
        :class="{ 'swatch--on': selectedColor === swatch.id }"
        :title="`${swatch.name} (${swatch.hex})`"
        :style="{ background: swatch.hex }"
        @click="emit('set-color', swatch.id)"
      >
        <span class="sr">{{ swatch.name }}</span>
      </button>
    </div>

    <p class="row-label">Da roda</p>
    <div class="swatches" role="list">
      <button
        v-for="swatch in recentCustom"
        :key="swatch.id"
        type="button"
        class="swatch"
        :class="{ 'swatch--on': selectedColor === swatch.id }"
        :title="`${swatch.name} (${swatch.hex})`"
        :style="{ background: swatch.hex }"
        @click="emit('set-color', swatch.id)"
      >
        <span class="sr">{{ swatch.name }}</span>
      </button>
      <span
        v-for="n in emptySlots"
        :key="`empty-${n}`"
        class="swatch swatch--empty"
        title="Espaço para uma cor da roda"
      />
    </div>

    <details v-if="extraCustom.length > 0" class="fold" :open="extraOpen" @toggle="extraOpen = $event.target.open">
      <summary>Mais cores da roda ({{ extraCustom.length }})</summary>
      <div class="swatches extra-swatches" role="list">
        <button
          v-for="swatch in extraCustom"
          :key="swatch.id"
          type="button"
          class="swatch"
          :class="{ 'swatch--on': selectedColor === swatch.id }"
          :title="`${swatch.name} (${swatch.hex})`"
          :style="{ background: swatch.hex }"
          @click="emit('set-color', swatch.id)"
        >
          <span class="sr">{{ swatch.name }}</span>
        </button>
      </div>
    </details>

    <details class="fold" :open="wheelOpen" @toggle="wheelOpen = $event.target.open">
      <summary>Roda de cores</summary>
      <p class="hint">Escolha na roda e clique em Adicionar esta cor para guardar no histórico.</p>
      <ColorWheel v-if="wheelOpen" v-model:hex="wheelHex" />
      <button v-if="wheelOpen" type="button" class="add" @click="emit('commit', wheelHex)">
        Adicionar esta cor
      </button>
    </details>
  </section>
</template>

<style scoped>
.palette {
  display: grid;
  gap: 10px;
}

.kicker,
.row-label {
  margin: 0;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--brass);
}

.selected {
  display: grid;
  grid-template-columns: 36px 1fr;
  grid-template-rows: auto auto;
  gap: 6px 8px;
}

.selected__swatch {
  grid-row: 1 / 3;
  border-radius: 8px;
  border: 1px solid var(--line);
}

.selected__field {
  display: grid;
  gap: 2px;
  font-size: 0.68rem;
  color: var(--ink-dim);
}

.selected__field input {
  width: 100%;
  padding: 5px 7px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--ink);
  font-family: var(--mono);
  font-size: 0.8rem;
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

.swatch--empty {
  border: 1px dashed var(--line);
  background: transparent;
}

.extra-swatches {
  margin-top: 8px;
  max-height: 132px;
  overflow: auto;
}

.fold {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 8px;
  background: var(--bg-raised);
}

.fold summary {
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
}

.hint {
  margin: 8px 0;
  font-size: 0.75rem;
  color: var(--ink-dim);
}

.add {
  width: 100%;
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--brass);
  color: #1a150c;
  font-weight: 700;
}

.add:hover {
  filter: brightness(1.08);
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
