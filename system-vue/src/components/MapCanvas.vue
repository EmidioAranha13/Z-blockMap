<script setup>
/**
 * MapCanvas.vue
 *
 * Renderiza a grade em um <canvas> e traduz eventos de ponteiro em blocos.
 *
 * Zoom:
 *  - botões + / − no canto inferior direito (centro da tela)
 *  - scroll do mouse, usando a posição do cursor como centro do zoom
 *  - zoom 1 mantém a grade visível (bloco mínimo) sem mudar o tamanho da página
 *
 * Pan: botão direito pressionado e arrastado.
 * Desenho: botão esquerdo (igual ao restante do editor).
 * LOD: a malha agrupa linhas com zoom distante; o desenho é a matriz
 * em menor resolução (não um bloco de uma cor só).
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import tintaIcon from '@/assets/tinta.png'
import { MAX_ZOOM, MIN_ZOOM } from '@/constants/limits.js'
import { TOOLS } from '@/constants/tools.js'
import {
  centeredOrigin,
  eventToCanvasPoint,
  fitCellSize,
  originAfterZoom,
  pointerToBlock,
  pointerToBlockClamped,
  readableCellSize,
} from '@/utils/coords.js'
import { drawMap } from '@/utils/drawMap.js'
import { makeIconCursor } from '@/utils/iconCursor.js'
import { lodFactor } from '@/utils/lod.js'

const props = defineProps({
  grid: { type: Array, required: true },
  previewCells: { type: Array, default: () => [] },
  hoverBlock: { type: Object, default: null },
  brushSize: { type: Number, default: 1 },
  colors: { type: Array, required: true },
  activeTool: { type: String, default: 'pencil' },
  /** Se verdadeiro, o arrasto de forma/mover prende nas bordas do cartesiano. */
  clampStroke: { type: Boolean, default: false },
  /** Tema do canvas: dark (noturno) ou light (ensolarado). */
  theme: { type: String, default: 'dark' },
  /** Eixos pelo centro da coluna/linha do meio (só ímpar×ímpar). */
  centerCellAxes: { type: Boolean, default: false },
})

const emit = defineEmits({
  hover: null,
  'stroke-start': null,
  'stroke-move': null,
  'stroke-end': null,
  'zoom-change': (value) => typeof value === 'number',
  'lod-change': (value) => typeof value === 'number',
})

const wrapRef = ref(null)
const canvasRef = ref(null)
const viewSize = ref({ width: 640, height: 480 })
const zoom = ref(1)
const origin = ref({ x: 0, y: 0 })
/** True enquanto o botão direito está arrastando o mapa. */
const isPanning = ref(false)
const canvasCursor = ref('crosshair')
/** Cursor da tinta, um por tema (invertido no dark). */
const fillCursorByTheme = { dark: '', light: '' }

const cols = computed(() => (props.grid[0] ? props.grid[0].length : 0))
const rows = computed(() => props.grid.length)

/**
 * Tamanho do bloco no zoom 1: no mínimo o suficiente para a grade aparecer.
 * Em mapas grandes o desenho passa da área visível (mover com o botão direito).
 */
const fittedCellSize = computed(() =>
  fitCellSize(viewSize.value.width, viewSize.value.height, cols.value, rows.value),
)

const baseCellSize = computed(() =>
  readableCellSize(viewSize.value.width, viewSize.value.height, cols.value, rows.value),
)

/**
 * Zoom mínimo para ainda caber o mapa inteiro na tela (visão geral).
 * O zoom 1 prioriza a malha visível, não o encaixe total.
 */
const minZoom = computed(() => {
  if (baseCellSize.value <= 0) return MIN_ZOOM
  return Math.max(MIN_ZOOM, Math.min(1, fittedCellSize.value / baseCellSize.value))
})

/** Tamanho real do bloco com o zoom aplicado. */
const cellSize = computed(() => baseCellSize.value * zoom.value)

/** Agrupamento visual N×N; 1 = cada célula da matriz. */
const lod = computed(() => lodFactor(cellSize.value))

let resizeObserver = null
let panLast = { x: 0, y: 0 }

/**
 * Centraliza o mapa no zoom 1 (malha visível). Em escalas grandes o mapa
 * transborda; o usuário move com o botão direito.
 */
function resetCamera() {
  zoom.value = 1
  origin.value = centeredOrigin(
    viewSize.value.width,
    viewSize.value.height,
    cols.value,
    rows.value,
    baseCellSize.value,
  )
  emit('zoom-change', zoom.value)
  emit('lod-change', lod.value)
}

/**
 * Mede o wrapper e, se o zoom ainda for 1 sem pan intencional, recentraliza.
 */
function measure() {
  const wrap = wrapRef.value
  if (!wrap) return
  const rect = wrap.getBoundingClientRect()
  viewSize.value = {
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
  }
}

/**
 * Aplica um novo zoom mantendo um ponto da tela (cursor ou centro) fixo.
 * @param {number} nextZoom
 * @param {number} canvasX
 * @param {number} canvasY
 */
function applyZoomAt(nextZoom, canvasX, canvasY) {
  const clamped = Math.min(MAX_ZOOM, Math.max(minZoom.value, nextZoom))
  if (clamped === zoom.value) return
  const oldSize = cellSize.value
  zoom.value = clamped
  origin.value = originAfterZoom(
    canvasX,
    canvasY,
    origin.value.x,
    origin.value.y,
    oldSize,
    baseCellSize.value * zoom.value,
  )
  emit('zoom-change', zoom.value)
  emit('lod-change', lod.value)
  draw()
}

/**
 * Zoom pelos botões: o centro da área do canvas é o ponto âncora.
 * @param {number} factor
 */
function zoomByButton(factor) {
  applyZoomAt(zoom.value * factor, viewSize.value.width / 2, viewSize.value.height / 2)
}

/**
 * Redesenha grade, preview, hover, eixos e fundo do tema.
 */
function draw() {
  const canvas = canvasRef.value
  if (!canvas) return

  const dpr = window.devicePixelRatio || 1
  const cssW = viewSize.value.width
  const cssH = viewSize.value.height

  canvas.width = Math.floor(cssW * dpr)
  canvas.height = Math.floor(cssH * dpr)
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`

  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  emit('lod-change', lod.value)
  drawMap(ctx, {
    grid: props.grid,
    colors: props.colors,
    previewCells: props.previewCells,
    hoverBlock: props.hoverBlock,
    brushSize: props.brushSize,
    originX: origin.value.x,
    originY: origin.value.y,
    cellSize: cellSize.value,
    viewWidth: cssW,
    viewHeight: cssH,
    theme: props.theme === 'light' ? 'light' : 'dark',
    pixelRatio: dpr,
    centerCellAxes: props.centerCellAxes,
  })
}

/**
 * @param {PointerEvent} event
 */
function eventToBlock(event) {
  return pointerToBlock(
    event,
    canvasRef.value,
    cellSize.value,
    origin.value.x,
    origin.value.y,
    cols.value,
    rows.value,
  )
}

function eventToBlockClamped(event) {
  return pointerToBlockClamped(
    event,
    canvasRef.value,
    cellSize.value,
    origin.value.x,
    origin.value.y,
    cols.value,
    rows.value,
  )
}

/**
 * Esquerdo = desenho; direito = pan do mapa (útil com zoom).
 * @param {PointerEvent} event
 */
function onPointerDown(event) {
  if (event.button === 2) {
    event.preventDefault()
    isPanning.value = true
    panLast = eventToCanvasPoint(event, canvasRef.value)
    canvasRef.value.setPointerCapture(event.pointerId)
    return
  }
  if (event.button !== 0) return
  event.preventDefault()
  const block = eventToBlock(event)
  emit('hover', block)
  if (!block) return
  canvasRef.value.setPointerCapture(event.pointerId)
  emit('stroke-start', block)
}

/**
 * @param {PointerEvent} event
 */
function onPointerMove(event) {
  if (isPanning.value) {
    const point = eventToCanvasPoint(event, canvasRef.value)
    origin.value = {
      x: origin.value.x + (point.x - panLast.x),
      y: origin.value.y + (point.y - panLast.y),
    }
    panLast = point
    draw()
    return
  }

  const block = eventToBlock(event)
  emit('hover', block)
  if ((event.buttons & 1) !== 1) return
  const next = props.clampStroke ? eventToBlockClamped(event) : block
  if (next) emit('stroke-move', next)
}

function onPointerUp() {
  if (isPanning.value) {
    isPanning.value = false
    return
  }
  emit('stroke-end')
}

function onPointerCancel() {
  isPanning.value = false
  emit('stroke-end')
}

/**
 * Scroll com o cursor como centro do zoom.
 * @param {WheelEvent} event
 */
function onWheel(event) {
  event.preventDefault()
  const point = eventToCanvasPoint(event, canvasRef.value)
  const factor = event.deltaY > 0 ? 0.9 : 1.1
  applyZoomAt(zoom.value * factor, point.x, point.y)
}

onMounted(() => {
  measure()
  resetCamera()
  draw()
  resizeObserver = new ResizeObserver(() => {
    measure()
    if (zoom.value === 1) resetCamera()
    draw()
  })
  if (wrapRef.value) resizeObserver.observe(wrapRef.value)
  canvasRef.value?.addEventListener('wheel', onWheel, { passive: false })
})

onUnmounted(() => {
  if (resizeObserver) resizeObserver.disconnect()
  canvasRef.value?.removeEventListener('wheel', onWheel)
})

watch(
  () => [cols.value, rows.value],
  () => {
    resetCamera()
    draw()
  },
)

watch(
  () => [props.grid, props.previewCells, props.hoverBlock, props.brushSize, props.colors, props.theme, props.centerCellAxes, viewSize.value],
  draw,
  { deep: true },
)

watch(
  () => [props.activeTool, isPanning.value, props.theme],
  async () => {
    if (isPanning.value) {
      canvasCursor.value = 'grabbing'
      return
    }
    if (props.activeTool !== TOOLS.FILL) {
      canvasCursor.value = 'crosshair'
      return
    }
    const key = props.theme === 'light' ? 'light' : 'dark'
    if (!fillCursorByTheme[key]) {
      fillCursorByTheme[key] = await makeIconCursor(tintaIcon, { invert: key === 'dark' })
    }
    if (props.activeTool === TOOLS.FILL && !isPanning.value) {
      canvasCursor.value = fillCursorByTheme[key]
    }
  },
  { immediate: true },
)
</script>

<template>
  <div ref="wrapRef" class="map-wrap">
    <canvas
      ref="canvasRef"
      class="map-canvas"
      :class="{ 'map-canvas--pan': isPanning }"
      :style="{ cursor: canvasCursor }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @contextmenu.prevent
    />
    <div class="zoom" aria-label="Controles de zoom">
      <button type="button" title="Aproximar" @click="zoomByButton(1.2)">+</button>
      <button type="button" title="Afastar" @click="zoomByButton(1 / 1.2)">−</button>
    </div>
  </div>
</template>

<style scoped>
.map-wrap {
  position: relative;
  z-index: 0;
  isolation: isolate;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 14px;
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--line);
  touch-action: none;
}

.map-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.map-canvas--pan {
  cursor: grabbing !important;
}

.zoom {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: grid;
  gap: 6px;
}

.zoom button {
  width: 36px;
  height: 36px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--ink);
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.zoom button:hover {
  border-color: var(--brass);
}
</style>
