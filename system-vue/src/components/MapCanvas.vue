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
 * Pan: botão direito pressionado e arrastado. O botão acima do zoom +
 * ativa o mesmo movimento com o esquerdo enquanto estiver ligado.
 * Tela cheia: a página inteira (side incluso), como a janela do navegador.
 * Desenho: botão esquerdo (quando o pan por esquerdo não está ativo).
 * LOD: a malha agrupa linhas com zoom distante; o desenho é a matriz
 * em menor resolução (não um bloco de uma cor só).
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import tintaIcon from '@/assets/tinta.png'
import moveTudoIcon from '@/assets/move_gtudo.png'
import expandIcon from '@/assets/expande.png'
import minimoIcon from '@/assets/minimo.png'
import { MAX_ZOOM, MIN_ZOOM } from '@/constants/limits.js'
import { THEME_CANVAS } from '@/constants/palette.js'
import { TOOLS, isStampTool } from '@/constants/tools.js'
import {
  blocksAlongCanvasSegment,
  centeredOrigin,
  eventToCanvasPoint,
  fitCellSize,
  originAfterZoom,
  pointerToBlock,
  pointerToBlockClamped,
  readableCellSize,
} from '@/utils/coords.js'
import { drawMap, rasterizeGridToCanvas } from '@/utils/drawMap.js'
import { makeIconCursor } from '@/utils/iconCursor.js'
import { lodFactor } from '@/utils/lod.js'
import { formatLineDistance } from '@/utils/shapes.js'
import { formatRotateDegrees } from '@/utils/rotate.js'

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
  /** Incrementa quando a cena muda; evita deep-watch na grade. */
  sceneTick: { type: Number, default: 0 },
  /** Blocos recém-pintados pelo pincel/borracha (pintura incremental). */
  paintDabs: { type: Array, default: () => [] },
  /** Centro do desenho durante o giro (HUD e ângulo). */
  rotatePivot: { type: Object, default: null },
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
/** True enquanto o mapa está sendo arrastado (direito, ou esquerdo no modo pan). */
const isPanning = ref(false)
/** True quando o botão de mover tudo está ligado: esquerdo arrasta o mapa. */
const panMode = ref(false)
/** True quando o canvas está em tela cheia. */
const isFullscreen = ref(false)
const canvasCursor = ref('crosshair')
/** Cursor da tinta, um por tema (invertido no dark). */
const fillCursorByTheme = { dark: '', light: '' }
const lineOrigin = ref(null)
const hudPos = ref({ x: 0, y: 0 })

const cols = computed(() => (props.grid[0] ? props.grid[0].length : 0))
const rows = computed(() => props.grid.length)

const lineHudText = computed(() => {
  if (!lineOrigin.value || !props.hoverBlock || isPanning.value || panMode.value) return ''
  if (props.activeTool === TOOLS.LINE) {
    return formatLineDistance(lineOrigin.value, props.hoverBlock)
  }
  if (props.activeTool === TOOLS.ROTATE) {
    if (!props.rotatePivot) return ''
    return formatRotateDegrees(lineOrigin.value, props.hoverBlock, props.rotatePivot)
  }
  return ''
})

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
let drawPending = false
let lastCanvasCssW = 0
let lastCanvasCssH = 0
let lastEmittedLod = -1
/** Bitmap 1 px/célula do mapa composto — pan/hover/zoom só fazem blit. */
const mapBitmap = document.createElement('canvas')
const mapBitmapCtx = mapBitmap.getContext('2d', { alpha: false }) || mapBitmap.getContext('2d')
let mapBitmapKey = ''
/** Último ponto CSS do pincel/borracha neste traço (caminho real do cursor). */
let lastStrokeCanvas = null
let stampStrokeActive = false
/** Chrome/Edge: pointerrawupdate entrega amostras que o pointermove agrupa. */
let stampUsesRawUpdate = false
/** Pontos do cursor acumulados até o próximo frame. */
const stampPointQueue = []
let stampRaf = 0
/** getBoundingClientRect cacheado durante o traço (caro em rawupdate). */
let stampCanvasRect = null

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

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null
}

function syncFullscreen() {
  isFullscreen.value = Boolean(fullscreenElement())
}

async function toggleFullscreen() {
  const root = document.documentElement
  try {
    if (fullscreenElement()) {
      if (document.exitFullscreen) await document.exitFullscreen()
      else document.webkitExitFullscreen?.()
      return
    }
    if (root.requestFullscreen) await root.requestFullscreen()
    else root.webkitRequestFullscreen?.()
  } catch {
    /* API indisponível ou recusada */
  }
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
  const bufW = Math.floor(cssW * dpr)
  const bufH = Math.floor(cssH * dpr)

  if (canvas.width !== bufW || canvas.height !== bufH || lastCanvasCssW !== cssW || lastCanvasCssH !== cssH) {
    canvas.width = bufW
    canvas.height = bufH
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    lastCanvasCssW = cssW
    lastCanvasCssH = cssH
  }

  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (lod.value !== lastEmittedLod) {
    lastEmittedLod = lod.value
    emit('lod-change', lod.value)
  }
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
    contentBitmap: syncMapBitmap(),
  })
}

function colorSignature(colors) {
  let sig = ''
  for (let i = 0; i < colors.length; i += 1) {
    sig += colors[i].id
    sig += colors[i].hex
  }
  return sig
}

function syncMapBitmap() {
  const c = cols.value
  const r = rows.value
  if (c <= 0 || r <= 0 || !mapBitmapCtx) return null
  const theme = props.theme === 'light' ? 'light' : 'dark'
  const key = `${props.sceneTick}|${c}x${r}|${theme}|${colorSignature(props.colors)}`
  if (key === mapBitmapKey && mapBitmap.width === c && mapBitmap.height === r) {
    return mapBitmap
  }
  if (mapBitmap.width !== c) mapBitmap.width = c
  if (mapBitmap.height !== r) mapBitmap.height = r
  rasterizeGridToCanvas(mapBitmapCtx, props.grid, props.colors, theme)
  mapBitmapKey = key
  return mapBitmap
}

function scheduleDraw() {
  if (drawPending) return
  drawPending = true
  requestAnimationFrame(() => {
    drawPending = false
    draw()
  })
}

function dabFill(colorId) {
  if (!colorId) {
    const skin = THEME_CANVAS[props.theme === 'light' ? 'light' : 'dark']
    return skin.empty
  }
  const swatch = props.colors.find((item) => item.id === colorId)
  return swatch ? swatch.hex : THEME_CANVAS.dark.empty
}

function paintDabsNow(dabs) {
  const canvas = canvasRef.value
  if (!canvas || !dabs.length) return
  const dpr = window.devicePixelRatio || 1
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const size = cellSize.value
  const ox = origin.value.x
  const oy = origin.value.y
  const bitmap = syncMapBitmap()
  let lastColor = dabs[0].color
  const fill = dabFill(lastColor)
  ctx.fillStyle = fill
  if (bitmap && mapBitmapCtx) mapBitmapCtx.fillStyle = fill
  for (const dab of dabs) {
    if (dab.color !== lastColor) {
      lastColor = dab.color
      const next = dabFill(lastColor)
      ctx.fillStyle = next
      if (bitmap && mapBitmapCtx) mapBitmapCtx.fillStyle = next
    }
    ctx.fillRect(ox + dab.x * size, oy + dab.y * size, size, size)
    if (bitmap && mapBitmapCtx) mapBitmapCtx.fillRect(dab.x, dab.y, 1, 1)
  }
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

function updateHudPos(event) {
  const wrap = wrapRef.value
  if (!wrap) return
  const rect = wrap.getBoundingClientRect()
  hudPos.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
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

function coalescedPointerEvents(event) {
  if (typeof event.getCoalescedEvents === 'function') {
    const list = event.getCoalescedEvents()
    if (list && list.length) return list
  }
  return [event]
}

function pointerToCachedCanvas(event) {
  const rect = stampCanvasRect
  if (rect) return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  return eventToCanvasPoint(event, canvasRef.value)
}

function flushStampPath() {
  stampRaf = 0
  if (!stampStrokeActive || !lastStrokeCanvas || stampPointQueue.length === 0) {
    stampPointQueue.length = 0
    return
  }
  const ox = origin.value.x
  const oy = origin.value.y
  const size = cellSize.value
  const c = cols.value
  const r = rows.value
  const blocks = []
  let from = lastStrokeCanvas
  for (let i = 0; i < stampPointQueue.length; i += 1) {
    const to = stampPointQueue[i]
    const piece = blocksAlongCanvasSegment(from.x, from.y, to.x, to.y, ox, oy, size, c, r, false)
    for (let j = 0; j < piece.length; j += 1) blocks.push(piece[j])
    from = to
  }
  lastStrokeCanvas = from
  stampPointQueue.length = 0
  if (blocks.length) emit('stroke-move', blocks)
}

function queueStampEvent(event) {
  if (!stampStrokeActive || !canvasRef.value) return
  const samples = coalescedPointerEvents(event)
  for (let i = 0; i < samples.length; i += 1) {
    stampPointQueue.push(pointerToCachedCanvas(samples[i]))
  }
  if (!stampRaf) stampRaf = requestAnimationFrame(flushStampPath)
}

function clearStampStroke() {
  if (stampRaf) {
    cancelAnimationFrame(stampRaf)
    stampRaf = 0
  }
  if (stampStrokeActive) flushStampPath()
  stampStrokeActive = false
  lastStrokeCanvas = null
  stampCanvasRect = null
  stampPointQueue.length = 0
}

function onPointerRawUpdate(event) {
  if (!stampStrokeActive || isPanning.value || panMode.value) return
  if ((event.buttons & 1) !== 1) return
  queueStampEvent(event)
}

/**
 * Direito = pan do mapa. Esquerdo = desenho, ou pan se o modo mover-tudo
 * estiver ligado.
 * @param {PointerEvent} event
 */
function onPointerDown(event) {
  const leftPan = event.button === 0 && panMode.value
  if (event.button === 2 || leftPan) {
    event.preventDefault()
    clearStampStroke()
    isPanning.value = true
    lineOrigin.value = null
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
  if (props.activeTool === TOOLS.LINE || props.activeTool === TOOLS.ROTATE) {
    lineOrigin.value = block
    updateHudPos(event)
  }
  lastStrokeCanvas = eventToCanvasPoint(event, canvasRef.value)
  stampCanvasRect = canvasRef.value.getBoundingClientRect()
  stampStrokeActive = isStampTool(props.activeTool)
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
    scheduleDraw()
    return
  }

  if (panMode.value) {
    emit('hover', null)
    return
  }

  if (props.activeTool === TOOLS.LINE || props.activeTool === TOOLS.ROTATE) updateHudPos(event)

  if ((event.buttons & 1) === 1) {
    if (stampStrokeActive) {
      if (!stampUsesRawUpdate) queueStampEvent(event)
      return
    }
    const next = props.clampStroke ? eventToBlockClamped(event) : eventToBlock(event)
    if (next) {
      if (props.activeTool === TOOLS.LINE || props.activeTool === TOOLS.ROTATE) emit('hover', next)
      emit('stroke-move', next)
    }
    return
  }

  emit('hover', eventToBlock(event))
}

function onPointerUp() {
  lineOrigin.value = null
  clearStampStroke()
  if (isPanning.value) {
    isPanning.value = false
    return
  }
  emit('stroke-end')
}

function onPointerCancel() {
  lineOrigin.value = null
  clearStampStroke()
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
  if (typeof window !== 'undefined' && 'onpointerrawupdate' in window) {
    stampUsesRawUpdate = true
    canvasRef.value?.addEventListener('pointerrawupdate', onPointerRawUpdate)
  }
  document.addEventListener('fullscreenchange', syncFullscreen)
  document.addEventListener('webkitfullscreenchange', syncFullscreen)
})

onUnmounted(() => {
  if (stampRaf) {
    cancelAnimationFrame(stampRaf)
    stampRaf = 0
  }
  if (resizeObserver) resizeObserver.disconnect()
  canvasRef.value?.removeEventListener('wheel', onWheel)
  canvasRef.value?.removeEventListener('pointerrawupdate', onPointerRawUpdate)
  document.removeEventListener('fullscreenchange', syncFullscreen)
  document.removeEventListener('webkitfullscreenchange', syncFullscreen)
  if (fullscreenElement()) {
    if (document.exitFullscreen) document.exitFullscreen()
    else document.webkitExitFullscreen?.()
  }
})

watch(
  () => [cols.value, rows.value],
  () => {
    resetCamera()
    draw()
  },
)

watch(
  [
    () => props.sceneTick,
    () => (props.hoverBlock ? props.hoverBlock.x : -1),
    () => (props.hoverBlock ? props.hoverBlock.y : -1),
    () => props.previewCells,
    () => props.brushSize,
    () => props.theme,
    () => props.centerCellAxes,
    () => viewSize.value.width,
    () => viewSize.value.height,
    () => props.colors,
  ],
  scheduleDraw,
)

watch(
  () => props.paintDabs,
  (dabs) => {
    if (dabs && dabs.length) paintDabsNow(dabs)
  },
  { flush: 'sync' },
)

watch(
  () => [props.activeTool, isPanning.value, panMode.value, props.theme],
  async () => {
    if (isPanning.value) {
      canvasCursor.value = 'grabbing'
      return
    }
    if (panMode.value) {
      canvasCursor.value = 'grab'
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
    <div
      v-if="lineHudText"
      class="line-hud"
      :style="{ left: `${hudPos.x}px`, top: `${hudPos.y}px` }"
    >
      {{ lineHudText }}
    </div>
    <div class="zoom" aria-label="Controles de câmera">
      <button
        type="button"
        class="zoom__pan"
        :title="isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'"
        @click="toggleFullscreen"
      >
        <img class="zoom__icon" :src="isFullscreen ? minimoIcon : expandIcon" alt="" />
      </button>
      <button
        type="button"
        class="zoom__pan"
        :class="{ 'zoom__pan--on': panMode }"
        title="Mover o mapa com o botão esquerdo"
        :aria-pressed="panMode"
        @click="panMode = !panMode"
      >
        <img class="zoom__icon" :src="moveTudoIcon" alt="" />
      </button>
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

.line-hud {
  position: absolute;
  z-index: 3;
  transform: translate(-50%, calc(-100% - 14px));
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg-panel);
  color: var(--ink);
  font-family: var(--mono);
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.28);
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

.zoom__pan {
  display: grid;
  place-items: center;
  padding: 0;
}

.zoom button.zoom__pan--on,
.zoom button.zoom__pan--on:hover {
  border-color: var(--brass);
  background: var(--tool-on);
  box-shadow: inset 3px 0 0 var(--brass), 0 4px 12px rgba(0, 0, 0, 0.25);
}

.zoom__icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  filter: var(--icon-filter);
}
</style>
