<script setup>
/**
 * Mundo voxel: Ver (só câmera) ou Editar (ferramentas ADD/REMOVE/SELECT).
 */
import { computed, onMounted, markRaw, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import Map3DCanvas from '@/modules/3d-builder/components/Map3DCanvas.vue'
import VoxelToolbar from '@/modules/3d-builder/components/VoxelToolbar.vue'
import { usePixelMap3D } from '@/modules/3d-builder/composables/usePixelMap3D.js'
import { useVoxelEditor } from '@/modules/3d-builder/composables/useVoxelEditor.js'
import { serializeVoxelMapFile } from '@/modules/3d-builder/utils/fileFormat3d.js'
import { createVoxelWorld } from '@/modules/3d-builder/utils/voxelWorld.js'
import { useTheme } from '@/composables/useTheme.js'
import { LIBRARY_KINDS } from '@/constants/brand.js'
import { downloadBlob } from '@/utils/download.js'
import { officialFileName } from '@/utils/fileName.js'
import { mapsFolderLabel, saveLibraryMap } from '@/utils/libraryApi.js'

const route = useRoute()
const router = useRouter()
const viewOnly = route.name === '3d-view'
const { theme } = useTheme()
const {
  loading,
  error,
  mapName,
  mapWidth,
  mapHeight,
  layerTree,
  voxelLayerTree,
  isVoxelFile,
  sourcePixelMap,
  libraryFileName,
  fixedColors,
  customColors,
  colors,
  canShow,
  load,
} = usePixelMap3D()

const world = markRaw(createVoxelWorld())
const worldReady = ref(false)
const canvasRef = ref(null)
const saving = ref(false)
const fileMessage = ref('')
const {
  tool,
  toolMeta,
  activeColor,
  activeColorId,
  selected,
  hover,
  blockCount,
  initPalette,
  setColor,
  setTool,
  setHover,
  applyClick,
  syncFromWorld,
  resetHistory,
  stackMode,
  setStackMode,
  stack,
  activeLayerId,
  activeLayerName,
  layerTreeUi,
  canUndo,
  canRedo,
  undo,
  redo,
  selectLayer,
  toggleLayerVisible,
  renameLayer,
  toggleLayerCollapsed,
} = useVoxelEditor(world, { viewOnly })

const ready = computed(() => canShow.value && worldReady.value)

onMounted(async () => {
  await load(String(route.query.file || ''))
  if (error.value) return
  if (isVoxelFile.value) {
    world.resetFromVoxelLayers(voxelLayerTree.value, mapWidth.value, mapHeight.value)
  } else {
    world.resetFromPixelLayers(layerTree.value, mapWidth.value, mapHeight.value, colors.value)
  }
  initPalette(colors.value)
  syncFromWorld()
  resetHistory()
  worldReady.value = true
})

async function onSaveMap() {
  if (viewOnly || saving.value) return
  saving.value = true
  fileMessage.value = 'Salvando…'
  const payload = serializeVoxelMapFile({
    mapName: mapName.value,
    width: world.width,
    height: world.height,
    selectedColor: activeColorId.value,
    sourcePixelMap: sourcePixelMap.value || (isVoxelFile.value ? '' : libraryFileName.value),
    fixedColors: fixedColors.value,
    customColors: customColors.value,
    layerTree: world.layerTree,
  })
  const id = officialFileName(libraryFileName.value, mapName.value)
  const preview = canvasRef.value?.capturePngBase64?.() || ''
  try {
    await saveLibraryMap(LIBRARY_KINDS.MODEL_3D, id, payload, preview)
    libraryFileName.value = id
    fileMessage.value = `Mapa salvo em ${mapsFolderLabel(LIBRARY_KINDS.MODEL_3D)}.`
    if (route.query.file !== id) {
      router.replace({ name: '3d-edit', query: { file: id } })
    }
  } catch {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    downloadBlob(blob, id)
    fileMessage.value = 'Biblioteca indisponível; o arquivo foi baixado.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="viewer">
    <header class="viewer__bar">
      <button type="button" class="ghost" @click="router.push('/3d')">← Biblioteca</button>
      <h1>{{ mapName || (viewOnly ? 'Visualização 3D' : 'Editor 3D') }}</h1>
      <span />
    </header>
    <LoadingOverlay v-if="loading" title="Montando o mundo 3D" />
    <p v-else-if="error" class="err">{{ error }}</p>
    <section v-else-if="ready" class="viewer__body" :class="{ 'viewer__body--view': viewOnly }">
      <VoxelToolbar
        v-if="!viewOnly"
        :tool="tool"
        :colors="colors"
        :active-color-id="activeColorId"
        :selected="selected"
        :hover="hover"
        :block-count="blockCount"
        :hint="toolMeta.hint"
        :layer-tree="layerTreeUi"
        :active-layer-id="activeLayerId"
        :active-layer-name="activeLayerName"
        :stack-mode="stackMode"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :file-message="fileMessage"
        :saving="saving"
        @set-tool="setTool"
        @set-color="setColor"
        @select-layer="selectLayer"
        @toggle-visible="toggleLayerVisible"
        @rename="renameLayer"
        @toggle-collapsed="toggleLayerCollapsed"
        @set-stack-mode="setStackMode"
        @stack="stack"
        @undo="undo"
        @redo="redo"
        @save="onSaveMap"
      />
      <div class="viewer__stage">
        <Map3DCanvas
          ref="canvasRef"
          :world="world"
          :tool="tool"
          :active-color="activeColor"
          :selected="selected"
          :theme="theme"
          :view-only="viewOnly"
          @hover="setHover"
          @edit="applyClick"
        />
        <p class="hint">
          {{
            viewOnly
              ? 'Esquerdo: orbitar · Direito: mover · Scroll: zoom'
              : stackMode
                ? 'Empilhar: ↑ sobe a altura · ← → desloca em X · ↓ desce · E desliga'
                : 'Clique: ferramenta · Arrastar: orbitar · Direito: mover · Scroll: zoom'
          }}
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.viewer {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
  color: var(--ink);
}

.viewer__bar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--bg-panel);
}

.viewer__bar h1 {
  margin: 0;
  text-align: center;
  font-size: 1rem;
}

.viewer__body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
}

.viewer__stage {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 8px 12px 12px;
}

.hint {
  position: absolute;
  left: 20px;
  bottom: 20px;
  margin: 0;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--ink-dim);
  font-size: 0.75rem;
  pointer-events: none;
}

.err {
  padding: 20px;
  color: var(--danger-text);
}

.ghost {
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font-weight: 600;
}
</style>
