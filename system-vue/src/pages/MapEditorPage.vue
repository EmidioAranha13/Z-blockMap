<script setup>
/**
 * MapEditorPage.vue
 *
 * Página do editor: drawer (nome, escala, camadas, toolbar), canvas e status.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import ConfirmModal from '@/components/ConfirmModal.vue'
import EditorToolbar from '@/components/EditorToolbar.vue'
import LayerPanel from '@/components/LayerPanel.vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import MapCanvas from '@/components/MapCanvas.vue'
import ScalePanel from '@/components/ScalePanel.vue'
import SideCollapse from '@/components/SideCollapse.vue'
import StatusBar from '@/components/StatusBar.vue'
import { TOOLS, isStrokeTool } from '@/constants/tools.js'
import { useMapEditor } from '@/composables/useMapEditor.js'
import { useTheme } from '@/composables/useTheme.js'
import { LIBRARY_KINDS } from '@/constants/brand.js'
import {
  editorRouteName,
  libraryHomePath,
  libraryKindFromRoute,
} from '@/utils/libraryApi.js'
import luaIcon from '@/assets/lua.png'
import solIcon from '@/assets/sol.png'

const route = useRoute()
const router = useRouter()
const libraryKind = libraryKindFromRoute(route)
const libraryHome = libraryHomePath(libraryKind)

const {
  mapName,
  grid,
  scaleInput,
  scaleLocked,
  centerCellAxes,
  activeTool,
  selectedColor,
  selectedColorInfo,
  fillShapes,
  alphaPaint,
  mirrorX,
  mirrorY,
  brushSize,
  hoverBlock,
  previewCells,
  paintDabs,
  isDrawing,
  sceneTick,
  rotatePivot,
  gridSize,
  activeToolMeta,
  fixedColors,
  allColors,
  recentCustom,
  extraCustom,
  canUndo,
  canRedo,
  isDirty,
  fileMessage,
  libraryFileName,
  layerTree,
  activeNodeId,
  selectedNodeIds,
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
  duplicateNode,
  flipActiveLayer,
  toggleGroupCollapsed,
  undo,
  redo,
  saveMapFile,
  saveDraft,
  disposeEditor,
  loadMapFile,
  loadMapFromLibrary,
  savePng,
  stampPerfectShape,
  handleKeydown,
} = useMapEditor(libraryKind)

const { theme, toggleTheme } = useTheme()
const loadingMap = ref(Boolean(route.query.file))
const zoom = ref(1)
const lod = ref(1)
const fileInput = ref(null)
const showLeaveModal = ref(false)
const leaving = ref(false)
const allowLeave = ref(false)
let pendingLeaveTo = null
const DRAWER_KEY = 'zblockmap-drawer-open'
const drawerOpen = ref(readDrawerOpen())

/**
 * @returns {boolean}
 */
function readDrawerOpen() {
  try {
    const saved = localStorage.getItem(DRAWER_KEY)
    if (saved === '0') return false
    if (saved === '1') return true
  } catch {
    /* storage pode estar bloqueado */
  }
  return true
}

function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value
  try {
    localStorage.setItem(DRAWER_KEY, drawerOpen.value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

const clampStroke = computed(() => isStrokeTool(activeTool.value))

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

async function onSaveMap() {
  const id = await saveMapFile()
  if (id && route.query.file !== id) {
    router.replace({ name: editorRouteName(libraryKind), query: { file: id } })
  }
}

function goLibrary() {
  router.push(libraryHome)
}

onBeforeRouteLeave((to) => {
  if (allowLeave.value || !isDirty.value) return true
  pendingLeaveTo = to
  showLeaveModal.value = true
  return false
})

function stayInEditor() {
  showLeaveModal.value = false
  pendingLeaveTo = null
}

async function leaveEditor() {
  leaving.value = true
  try {
    await saveDraft()
  } catch {
    /* o usuário já confirmou a saída */
  }
  allowLeave.value = true
  showLeaveModal.value = false
  const target = pendingLeaveTo
  pendingLeaveTo = null
  leaving.value = false
  if (target) router.push(target)
}

function onBeforeUnload(event) {
  if (!isDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}

watch(
  () => libraryFileName.value,
  (id) => {
    if (!id || route.query.file === id) return
    if (route.query.file) return
    router.replace({ name: editorRouteName(libraryKind), query: { file: id } })
  },
)

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
  const file = route.query.file
  if (!file) {
    loadingMap.value = false
    return
  }
  loadingMap.value = true
  try {
    await loadMapFromLibrary(String(file))
  } finally {
    loadingMap.value = false
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
  disposeEditor()
})
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="hero__left">
        <button type="button" class="back" @click="goLibrary">← Biblioteca</button>
        <p class="hero__kicker">{{ libraryKind === LIBRARY_KINDS.MODEL_3D ? '3D Builder' : 'Z-blockMap' }}</p>
      </div>
      <button
        type="button"
        class="theme-switch"
        :title="theme === 'dark' ? 'Mudar para modo ensolarado' : 'Mudar para modo noturno'"
        @click="toggleTheme"
      >
        <img
          class="theme-switch__icon"
          :src="theme === 'dark' ? luaIcon : solIcon"
          alt=""
        />
        <span>{{ theme === 'dark' ? 'Noturno' : 'Ensolarado' }}</span>
      </button>
    </header>

    <LoadingOverlay v-if="loadingMap" title="Carregando mapa" />

    <div v-else class="workspace">
      <div class="drawer" :class="{ 'drawer--closed': !drawerOpen }">
        <aside class="side" id="editor-drawer">
          <label class="map-name">
            <span>Nome do mapa</span>
            <input v-model="mapName" type="text" maxlength="80" placeholder="Nome do mapa" />
          </label>
          <SideCollapse title="Escala" storage-key="escala">
            <ScalePanel
              v-model:scale-input="scaleInput"
              v-model:locked="scaleLocked"
              v-model:center-cell-axes="centerCellAxes"
              :current-width="gridSize.width"
              :current-height="gridSize.height"
              @apply="applyScale"
              @field="onScaleField($event.axis, $event.value)"
            />
          </SideCollapse>
          <SideCollapse title="Camadas" storage-key="camadas">
            <LayerPanel
              :tree="layerTree"
              :active-id="activeNodeId"
              :selected-ids="selectedNodeIds"
              @select="selectNode"
              @toggle-visible="toggleNodeVisible"
              @rename="renameNode($event.id, $event.name)"
              @toggle-collapsed="toggleGroupCollapsed"
              @add-layer="addLayer"
              @add-group="addGroup"
              @group="groupSelection"
              @duplicate="duplicateNode"
              @flip-h="flipActiveLayer('h')"
              @flip-v="flipActiveLayer('v')"
              @remove="deleteNode"
              @shift="shiftNode"
            />
          </SideCollapse>
          <EditorToolbar
            :active-tool="activeTool"
            v-model:fill-shapes="fillShapes"
            v-model:alpha-paint="alphaPaint"
            v-model:mirror-x="mirrorX"
            v-model:mirror-y="mirrorY"
            :selected-color="selectedColor"
            :selected-color-info="selectedColorInfo"
            :fixed-colors="fixedColors"
            :recent-custom="recentCustom"
            :extra-custom="extraCustom"
            :can-undo="canUndo"
            :can-redo="canRedo"
            :brush-size="brushSize"
            :map-width="gridSize.width"
            :map-height="gridSize.height"
            :center-cell-axes="centerCellAxes"
            @set-tool="setTool"
            @set-color="setColor"
            @set-brush="setBrushSize"
            @commit-color="commitWheelColor"
            @rename="renameColor($event.id, $event.name)"
            @recolor="recolor($event.id, $event.hex)"
            @undo="undo"
            @redo="redo"
            @save="onSaveMap"
            @load="openLoadDialog"
            @png="savePng(theme)"
            @clear="clearMap"
            @perfect-shape="stampPerfectShape($event)"
          />
        </aside>
        <button
          type="button"
          class="drawer-tab"
          :aria-expanded="drawerOpen"
          aria-controls="editor-drawer"
          :title="drawerOpen ? 'Fechar painel' : 'Abrir painel'"
          @click="toggleDrawer"
        >
          <svg class="drawer-tab__arrow" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M4 2 L8 6 L4 10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <section class="stage" aria-label="Área de desenho">
        <MapCanvas
          :grid="grid"
          :preview-cells="previewCells"
          :hover-block="hoverBlock"
          :colors="allColors"
          :active-tool="activeTool"
          :brush-size="activeTool === TOOLS.FILL || activeTool === TOOLS.EYEDROPPER ? 1 : brushSize"
          :clamp-stroke="clampStroke"
          :theme="theme"
          :center-cell-axes="centerCellAxes"
          :scene-tick="sceneTick"
          :paint-dabs="paintDabs"
          :rotate-pivot="rotatePivot"
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
      v-if="!loadingMap"
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

    <ConfirmModal
      v-if="showLeaveModal"
      title="Voltar à biblioteca?"
      message="Há alterações que ainda não foram salvas no mapa. Um rascunho de segurança pode já ter sido gravado. Deseja mesmo sair?"
      cancel-label="Continuar editando"
      confirm-label="Sair"
      :busy="leaving"
      @cancel="stayInEditor"
      @confirm="leaveEditor"
    />
  </div>
</template>

<style scoped>
.page {
  position: relative;
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
  padding: 10px 20px 6px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.hero__left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.back {
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 600;
}

.back:hover {
  border-color: var(--brass);
}

.hero__kicker {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--brass);
}

.map-name {
  display: grid;
  gap: 6px;
  padding-bottom: 10px;
  margin-bottom: 2px;
  border-bottom: 1px solid var(--line);
  font-size: 0.75rem;
  color: var(--ink-dim);
}

.map-name input {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--ink);
  font-size: 0.95rem;
  font-weight: 600;
}

.map-name input:focus {
  outline: none;
  border-color: var(--brass);
}

.theme-switch {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg-panel);
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 600;
}

.theme-switch:hover {
  border-color: var(--brass);
}

.theme-switch__icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  filter: var(--icon-filter);
}

.workspace {
  position: relative;
  flex: 1;
  min-height: 0;
}

.drawer {
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 12px;
  z-index: 2;
  display: flex;
  align-items: stretch;
  pointer-events: none;
  transition: transform 0.22s ease;
}

.drawer--closed {
  transform: translateX(-280px);
}

.side {
  width: 280px;
  padding: 14px;
  border: 1px solid var(--line);
  border-left: 0;
  border-radius: 0 var(--radius) var(--radius) 0;
  background: var(--bg-panel);
  overflow-y: auto;
  min-height: 0;
  pointer-events: auto;
}

.drawer--closed .side {
  visibility: hidden;
}

.drawer-tab {
  pointer-events: auto;
  display: grid;
  place-items: center;
  align-self: flex-start;
  width: 28px;
  height: 56px;
  margin: 0;
  padding: 0;
  border: 1px solid var(--line);
  border-left: 0;
  border-radius: 0 10px 10px 0;
  background: var(--bg-panel);
  color: var(--ink);
}

.drawer-tab:hover {
  color: var(--brass);
}

.drawer-tab__arrow {
  width: 14px;
  height: 14px;
  display: block;
}

.drawer:not(.drawer--closed) .drawer-tab__arrow {
  transform: scaleX(-1);
}

.stage {
  min-height: 0;
  min-width: 0;
  height: 100%;
  padding: 8px 20px 12px;
  position: relative;
  z-index: 0;
  isolation: isolate;
  overflow: hidden;
}

.file {
  display: none;
}
</style>
