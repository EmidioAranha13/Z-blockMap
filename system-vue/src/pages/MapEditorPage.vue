<script setup>
/**
 * MapEditorPage.vue
 *
 * Página do editor: escala, camadas, toolbar, canvas e status.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import EditorToolbar from '@/components/EditorToolbar.vue'
import LayerPanel from '@/components/LayerPanel.vue'
import MapCanvas from '@/components/MapCanvas.vue'
import ScalePanel from '@/components/ScalePanel.vue'
import StatusBar from '@/components/StatusBar.vue'
import { TOOLS } from '@/constants/tools.js'
import { useMapEditor } from '@/composables/useMapEditor.js'
import { useTheme } from '@/composables/useTheme.js'

const {
  mapName,
  grid,
  scaleInput,
  scaleLocked,
  activeTool,
  selectedColor,
  selectedColorInfo,
  fillShapes,
  brushSize,
  hoverBlock,
  previewCells,
  isDrawing,
  gridSize,
  activeToolMeta,
  fixedColors,
  allColors,
  recentCustom,
  extraCustom,
  canUndo,
  canRedo,
  fileMessage,
  layerTree,
  activeNodeId,
  onScaleField,
  applyScale,
  setTool,
  setBrushSize,
  setColor,
  commitWheelColor,
  renameColor,
  recolor,
  clearMap,
  setHover,
  beginStroke,
  continueStroke,
  endStroke,
  selectNode,
  addLayer,
  addGroup,
  groupSelection,
  deleteNode,
  toggleNodeVisible,
  renameNode,
  shiftNode,
  toggleGroupCollapsed,
  undo,
  redo,
  saveMapFile,
  loadMapFile,
  savePng,
  handleKeydown,
} = useMapEditor()

const { theme, setTheme } = useTheme()
const zoom = ref(1)
const lod = ref(1)
const fileInput = ref(null)

const clampStroke = computed(
  () => activeTool.value === TOOLS.LINE || activeTool.value === TOOLS.CIRCLE || activeTool.value === TOOLS.MOVE,
)

function onKeydown(event) {
  handleKeydown(event)
}

function openLoadDialog() {
  fileInput.value?.click()
}

async function onFilePicked(event) {
  const input = event.target
  const file = input.files && input.files[0]
  if (file) await loadMapFile(file)
  input.value = ''
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="hero__names">
        <p class="hero__kicker">Z-blockMap</p>
        <label class="map-name">
          <span class="sr">Nome do mapa</span>
          <input v-model="mapName" type="text" maxlength="80" placeholder="Nome do mapa" />
        </label>
      </div>
      <div class="theme-switch" role="group" aria-label="Tema">
        <button
          type="button"
          class="theme-btn"
          :class="{ 'theme-btn--on': theme === 'dark' }"
          title="Fundo preto, blocos vazios pretos"
          @click="setTheme('dark')"
        >
          Modo noturno
        </button>
        <button
          type="button"
          class="theme-btn"
          :class="{ 'theme-btn--on': theme === 'light' }"
          title="Fundo claro, blocos vazios brancos"
          @click="setTheme('light')"
        >
          Modo ensolarado
        </button>
      </div>
    </header>

    <div class="layout">
      <aside class="side">
        <ScalePanel
          v-model:scale-input="scaleInput"
          v-model:locked="scaleLocked"
          :current-width="gridSize.width"
          :current-height="gridSize.height"
          @apply="applyScale"
          @field="onScaleField($event.axis, $event.value)"
        />
        <hr class="rule" />
        <LayerPanel
          :tree="layerTree"
          :active-id="activeNodeId"
          @select="selectNode"
          @toggle-visible="toggleNodeVisible"
          @rename="renameNode($event.id, $event.name)"
          @toggle-collapsed="toggleGroupCollapsed"
          @add-layer="addLayer"
          @add-group="addGroup"
          @group="groupSelection"
          @remove="deleteNode"
          @shift="shiftNode"
        />
        <hr class="rule" />
        <EditorToolbar
          :active-tool="activeTool"
          v-model:fill-shapes="fillShapes"
          :selected-color="selectedColor"
          :selected-color-info="selectedColorInfo"
          :fixed-colors="fixedColors"
          :recent-custom="recentCustom"
          :extra-custom="extraCustom"
          :can-undo="canUndo"
          :can-redo="canRedo"
          :brush-size="brushSize"
          @set-tool="setTool"
          @set-color="setColor"
          @set-brush="setBrushSize"
          @commit-color="commitWheelColor"
          @rename="renameColor($event.id, $event.name)"
          @recolor="recolor($event.id, $event.hex)"
          @undo="undo"
          @redo="redo"
          @save="saveMapFile"
          @load="openLoadDialog"
          @png="savePng(theme)"
          @clear="clearMap"
        />
      </aside>

      <section class="stage" aria-label="Área de desenho">
        <MapCanvas
          :grid="grid"
          :preview-cells="previewCells"
          :hover-block="hoverBlock"
          :colors="allColors"
          :active-tool="activeTool"
          :brush-size="activeTool === TOOLS.FILL ? 1 : brushSize"
          :clamp-stroke="clampStroke"
          :theme="theme"
          @hover="setHover"
          @stroke-start="beginStroke"
          @stroke-move="continueStroke"
          @stroke-end="endStroke"
          @zoom-change="zoom = $event"
          @lod-change="lod = $event"
        />
      </section>
    </div>

    <StatusBar
      :map-name="mapName"
      :width="gridSize.width"
      :height="gridSize.height"
      :tool-label="activeToolMeta.label"
      :tool-hint="activeToolMeta.hint"
      :hover-block="hoverBlock"
      :is-drawing="isDrawing"
      :zoom="zoom"
      :lod="lod"
      :file-message="fileMessage"
    />

    <input
      ref="fileInput"
      class="file"
      type="file"
      accept=".json,application/json,.zblockmap.json"
      @change="onFilePicked"
    />
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  background: var(--bg);
  color: var(--ink);
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 28px 4px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.hero__kicker {
  margin: 0 0 4px;
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--brass);
}

.map-name input {
  width: min(420px, 55vw);
  padding: 6px 0;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
  font-size: 1.28rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.map-name input:focus {
  outline: none;
  border-bottom-color: var(--brass);
}

.theme-switch {
  display: flex;
  flex-shrink: 0;
  gap: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}

.theme-btn {
  margin: 0;
  padding: 8px 12px;
  border: 0;
  background: var(--bg-panel);
  color: var(--ink-dim);
  font-size: 0.78rem;
  font-weight: 600;
}

.theme-btn + .theme-btn {
  border-left: 1px solid var(--line);
}

.theme-btn:hover {
  color: var(--ink);
}

.theme-btn--on {
  background: var(--tool-on);
  color: var(--ink);
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 16px;
  flex: 1;
  padding: 8px 20px 12px;
  min-height: 0;
}

.side {
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg-panel);
  overflow-y: auto;
  min-height: 0;
  position: relative;
  z-index: 1;
}

.rule {
  border: 0;
  border-top: 1px solid var(--line);
  margin: 14px 0;
}

.stage {
  min-height: 0;
  min-width: 0;
  height: 100%;
  position: relative;
  z-index: 0;
  isolation: isolate;
  overflow: hidden;
}

.file {
  display: none;
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 38vh) minmax(0, 1fr);
  }
}
</style>
