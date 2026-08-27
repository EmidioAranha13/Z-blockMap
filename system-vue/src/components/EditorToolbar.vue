<script setup>
/**
 * EditorToolbar.vue
 *
 * Ferramentas de desenho, paleta (fixas + roda) e ações de arquivo/histórico.
 */
import ColorPalette from '@/components/ColorPalette.vue'
import SideCollapse from '@/components/SideCollapse.vue'
import {
  COMPACT_ACTION_META,
  PERFECT_TOOL_META,
  SHAPE_TOOL_META,
  THICKNESS,
  THICKNESS_ORIENTATIONS,
  TOOLS,
} from '@/constants/tools.js'
import { clampThickness, maxPerfectThickness } from '@/utils/shapes.js'
import penIcon from '@/assets/pen.png'
import borrachaIcon from '@/assets/borracha.png'
import tintaIcon from '@/assets/tinta.png'
import perfectIcon from '@/assets/perfect.png'
import moveDesenhoIcon from '@/assets/move_desenho.png'
import { nextTick, onUnmounted, computed, ref, watch } from 'vue'

const TOOL_ICONS = {
  [TOOLS.PENCIL]: penIcon,
  [TOOLS.ERASER]: borrachaIcon,
  [TOOLS.FILL]: tintaIcon,
  [PERFECT_TOOL_META.id]: perfectIcon,
  [TOOLS.MOVE]: moveDesenhoIcon,
}

const props = defineProps({
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
  mapWidth: { type: Number, required: true },
  mapHeight: { type: Number, required: true },
  centerCellAxes: { type: Boolean, default: false },
  mirrorX: { type: Boolean, default: false },
})

const emit = defineEmits({
  'set-tool': (toolId) => typeof toolId === 'string',
  'set-color': (colorId) => typeof colorId === 'number',
  'update:fillShapes': (value) => typeof value === 'boolean',
  'update:mirrorX': (value) => typeof value === 'boolean',
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
  'perfect-shape': null,
})

const showPerfectModal = ref(false)
const perfectBusy = ref(false)
const perfectTool = ref(TOOLS.CIRCLE)
const perfectX = ref(1)
const perfectY = ref(1)
const perfectThickness = ref(1)
const perfectOrientation = ref(THICKNESS.CENTERED)
const perfectMaxThickness = ref(1)
const shapeTip = ref(null)
const shapeTipStyle = ref({ left: '0px', top: '0px' })
const perfectIsLine = computed(() => perfectTool.value === TOOLS.LINE)

let computeGen = 0
let scaleDebounce = 0
let skipThicknessWatch = false

function afterPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

function computeMaxThickness() {
  return maxPerfectThickness({
    tool: perfectTool.value,
    cols: props.mapWidth,
    rows: props.mapHeight,
    sizeX: perfectX.value,
    sizeY: perfectY.value,
    centerCellAxes: props.centerCellAxes,
    orientation: perfectOrientation.value,
  })
}

async function refreshMaxThickness() {
  const gen = ++computeGen
  const max = computeMaxThickness()
  if (gen !== computeGen) return
  perfectMaxThickness.value = max
  perfectThickness.value = clampThickness(perfectThickness.value, max)
}

async function openPerfectModal() {
  hideShapeTip()
  skipThicknessWatch = true
  perfectTool.value = TOOLS.CIRCLE
  perfectX.value = props.mapWidth
  perfectY.value = props.mapHeight
  perfectOrientation.value = THICKNESS.CENTERED
  perfectThickness.value = 1
  showPerfectModal.value = true
  perfectBusy.value = true
  await nextTick()
  await afterPaint()
  await refreshMaxThickness()
  if (showPerfectModal.value) perfectBusy.value = false
  skipThicknessWatch = false
}

function closePerfectModal() {
  computeGen += 1
  window.clearTimeout(scaleDebounce)
  showPerfectModal.value = false
  perfectBusy.value = false
  skipThicknessWatch = false
}

async function confirmPerfectShape() {
  if (perfectBusy.value) return
  const x = Math.min(props.mapWidth, Math.max(1, Math.floor(Number(perfectX.value)) || 1))
  const y = Math.min(props.mapHeight, Math.max(1, Math.floor(Number(perfectY.value)) || 1))
  const payload = {
    tool: perfectTool.value,
    x,
    y,
    thickness: clampThickness(perfectThickness.value, perfectMaxThickness.value),
    orientation: perfectOrientation.value,
  }
  perfectBusy.value = true
  await nextTick()
  await afterPaint()
  emit('perfect-shape', payload)
  closePerfectModal()
}

async function runInnerCompute() {
  if (!showPerfectModal.value || skipThicknessWatch) return
  const gen = ++computeGen
  perfectBusy.value = true
  await nextTick()
  await afterPaint()
  if (gen !== computeGen) return
  const max = computeMaxThickness()
  if (gen !== computeGen) return
  perfectMaxThickness.value = max
  perfectThickness.value = clampThickness(perfectThickness.value, max)
  perfectBusy.value = false
}

watch([perfectTool, perfectOrientation], () => {
  if (perfectIsLine.value) {
    perfectBusy.value = false
    return
  }
  runInnerCompute()
})

watch([perfectX, perfectY], () => {
  if (!showPerfectModal.value || skipThicknessWatch || perfectIsLine.value) return
  perfectBusy.value = true
  window.clearTimeout(scaleDebounce)
  scaleDebounce = window.setTimeout(() => {
    runInnerCompute()
  }, 160)
})

onUnmounted(() => {
  computeGen += 1
  window.clearTimeout(scaleDebounce)
})

function showShapeTip(tool, event) {
  const box = event.currentTarget.getBoundingClientRect()
  const width = 220
  const left = Math.min(box.left, window.innerWidth - width - 8)
  shapeTipStyle.value = {
    left: `${Math.max(8, left)}px`,
    top: `${box.bottom + 6}px`,
  }
  shapeTip.value = tool
}

function hideShapeTip() {
  shapeTip.value = null
}

function onCompactClick(tool) {
  if (tool.id === PERFECT_TOOL_META.id) {
    openPerfectModal()
    return
  }
  emit('set-tool', tool.id)
}
</script>

<template>
  <section class="toolbar" aria-label="Ferramentas de desenho">
    <SideCollapse title="Ferramentas" storage-key="ferramentas">
      <div class="tool-list">
        <div class="tool-grid" role="group" aria-label="Ferramentas">
          <button
            v-for="tool in COMPACT_ACTION_META"
            :key="tool.id"
            type="button"
            class="tool-btn"
            :class="{ 'tool--on': activeTool === tool.id }"
            :aria-label="`${tool.label}. ${tool.blurb}`"
            @click="onCompactClick(tool)"
            @mouseenter="showShapeTip(tool, $event)"
            @mouseleave="hideShapeTip"
            @focus="showShapeTip(tool, $event)"
            @blur="hideShapeTip"
          >
            <img v-if="TOOL_ICONS[tool.id]" class="tool-btn__icon" :src="TOOL_ICONS[tool.id]" alt="" />
            <kbd v-if="tool.shortcut">{{ tool.shortcut }}</kbd>
          </button>
        </div>

        <div class="tool-grid" role="group" aria-label="Formas">
          <button
            v-for="tool in SHAPE_TOOL_META"
            :key="tool.id"
            type="button"
            class="tool-btn"
            :class="{ 'tool--on': activeTool === tool.id }"
            :aria-label="`${tool.label}. ${tool.blurb}`"
            @click="emit('set-tool', tool.id)"
            @mouseenter="showShapeTip(tool, $event)"
            @mouseleave="hideShapeTip"
            @focus="showShapeTip(tool, $event)"
            @blur="hideShapeTip"
          >
            <span class="tool-btn__glyph" aria-hidden="true">{{ tool.glyph }}</span>
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

      <label class="fill">
        <input
          type="checkbox"
          :checked="fillShapes"
          @change="emit('update:fillShapes', $event.target.checked)"
        />
        Preencher forma
      </label>

      <label class="fill">
        <input
          type="checkbox"
          :checked="mirrorX"
          @change="emit('update:mirrorX', $event.target.checked)"
        />
        Simetria espelhada
      </label>
    </SideCollapse>

    <SideCollapse title="Cores" storage-key="cores">
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
    </SideCollapse>

    <SideCollapse title="Extras" storage-key="extras">
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
    </SideCollapse>
  </section>

  <Teleport to="body">
    <div v-if="shapeTip" class="shape-tip" :style="shapeTipStyle" role="tooltip">
      <strong>{{ shapeTip.label }}</strong>
      <span class="shape-tip__rule" />
      <span>{{ shapeTip.blurb }}</span>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="showPerfectModal"
      class="modal-back"
      @click.self="closePerfectModal"
      @keydown.escape="closePerfectModal"
    >
      <form class="modal" @submit.prevent="confirmPerfectShape" @keydown.escape="closePerfectModal">
        <h3>Forma perfeita</h3>
        <p v-if="perfectIsLine">
          Linha centrada na origem. X e Y são a largura e a altura em blocos:
          269×5 vira uma barra horizontal de 269 por 5 de grossura; 5×269, vertical.
        </p>
        <p v-else>
          Geometria centrada na origem. A escala define o tamanho-base; a espessura,
          quantos blocos o contorno ocupa, sem alterar essa escala.
        </p>

        <div class="modal__block">
          <span class="modal__label">Forma</span>
          <div class="shape-group" role="group" aria-label="Forma">
            <button
              v-for="tool in SHAPE_TOOL_META"
              :key="tool.id"
              type="button"
              class="shape-group__btn"
              :class="{ 'shape-group__btn--on': perfectTool === tool.id }"
              @click="perfectTool = tool.id"
            >
              {{ tool.label }}
            </button>
          </div>
        </div>

        <div class="modal__fields">
          <label>
            <span>{{ perfectIsLine ? 'X (largura)' : 'Escala X' }}</span>
            <input
              v-model.number="perfectX"
              type="number"
              min="1"
              :max="mapWidth"
              required
            />
          </label>
          <label>
            <span>{{ perfectIsLine ? 'Y (altura)' : 'Escala Y' }}</span>
            <input
              v-model.number="perfectY"
              type="number"
              min="1"
              :max="mapHeight"
              required
            />
          </label>
        </div>

        <label v-if="!perfectIsLine" class="modal__block">
          <span class="modal__label">Espessura (máx. {{ perfectMaxThickness }} px)</span>
          <input
            v-model.number="perfectThickness"
            type="number"
            min="1"
            :max="perfectMaxThickness"
            required
          />
        </label>

        <div v-if="!perfectIsLine" class="modal__block">
          <span class="modal__label">Orientação da espessura</span>
          <div class="shape-group" role="group" aria-label="Orientação da espessura">
            <button
              v-for="item in THICKNESS_ORIENTATIONS"
              :key="item.id"
              type="button"
              class="shape-group__btn"
              :class="{ 'shape-group__btn--on': perfectOrientation === item.id }"
              :title="item.hint"
              @click="perfectOrientation = item.id"
            >
              {{ item.label }}
            </button>
          </div>
        </div>

        <div class="modal__actions">
          <button type="button" class="ghost" @click="closePerfectModal">Cancelar</button>
          <button type="submit" class="apply">Criar</button>
        </div>

        <div v-if="perfectBusy" class="modal__busy" role="status" aria-live="polite">
          <span class="spinner-simple" aria-hidden="true" />
          Recalculando…
        </div>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.toolbar {
  display: grid;
  gap: 0;
}

.tool-list {
  display: grid;
  gap: 6px;
}

.tool--on {
  border-color: var(--brass);
  background: var(--tool-on);
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

.tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  min-height: 44px;
  padding: 7px 2px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-raised);
  color: var(--ink);
}

.tool-btn.tool--on {
  box-shadow: inset 0 -3px 0 var(--brass);
}

.tool-btn__icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  filter: var(--icon-filter);
}

.tool-btn__glyph {
  font-size: 1.05rem;
  line-height: 1;
}

kbd {
  font-family: var(--mono);
  font-size: 0.72rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--ink-dim);
}

.tool-btn kbd {
  padding: 1px 4px;
  font-size: 0.65rem;
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

.modal-back {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.55);
}

.modal {
  position: relative;
  width: min(440px, 100%);
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg-panel);
  color: var(--ink);
}

.modal h3 {
  margin: 0;
  font-size: 1.05rem;
}

.modal p {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--ink-dim);
}

.modal__block {
  display: grid;
  gap: 6px;
}

.modal__label {
  font-size: 0.75rem;
  color: var(--ink-dim);
}

.modal__fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.modal__fields label,
.modal__block > input {
  display: grid;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--ink-dim);
}

.modal__fields input,
.modal__block > input {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--ink);
  font-family: var(--mono);
  font-size: 1rem;
}

.shape-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.shape-group__btn {
  flex: 1 1 auto;
  padding: 7px 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-raised);
  color: var(--ink);
  font-size: 0.75rem;
  font-weight: 600;
}

.shape-group__btn--on {
  border-color: var(--brass);
  background: var(--tool-on);
  box-shadow: inset 0 -3px 0 var(--brass);
  color: var(--ink);
}

.modal__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.apply {
  border: 0;
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--brass);
  color: #1a150c;
  font-weight: 700;
}

.modal__busy {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: inherit;
  background: color-mix(in srgb, var(--bg-panel) 78%, transparent);
  color: var(--ink);
  font-size: 0.85rem;
  font-weight: 600;
}

.spinner-simple {
  width: 18px;
  height: 18px;
  border: 2px solid var(--line);
  border-top-color: var(--brass);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

<style>
.shape-tip {
  position: fixed;
  z-index: 50;
  display: grid;
  gap: 6px;
  width: 220px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--ink);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
  pointer-events: none;
}

.shape-tip strong {
  font-size: 0.85rem;
}

.shape-tip__rule {
  display: block;
  height: 1px;
  background: var(--line);
}

.shape-tip span:last-child {
  font-size: 0.78rem;
  line-height: 1.4;
  color: var(--ink-dim);
}
</style>
