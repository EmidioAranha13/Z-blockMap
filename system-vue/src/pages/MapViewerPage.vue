<script setup>
/**
 * Visualização em tela cheia de um mapa pixel (sem ferramentas de desenho).
 * Drawer à direita lista as cores usadas; a selecionada pisca no mapa.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import MapCanvas from '@/components/MapCanvas.vue'
import { useTheme } from '@/composables/useTheme.js'
import { contrastInk } from '@/constants/palette.js'
import { parseMapFile } from '@/utils/fileFormat.js'
import { collectUsedColors } from '@/utils/legend.js'
import { compositeLayerTree } from '@/utils/layers.js'
import { fetchLibraryMap, libraryHomePath, libraryKindFromRoute } from '@/utils/libraryApi.js'

const route = useRoute()
const router = useRouter()
const { theme } = useTheme()
const libraryKind = libraryKindFromRoute(route)
const libraryHome = libraryHomePath(libraryKind)

const DRAWER_KEY = 'zblockmap-viewer-colors-open'

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

const error = ref('')
const loadingMap = ref(true)
const mapName = ref('')
const grid = ref([[]])
const colors = ref([])
const centerCellAxes = ref(false)
const sceneTick = ref(0)
const highlightColorId = ref(0)
const drawerOpen = ref(readDrawerOpen())

const canShow = computed(() => !error.value && grid.value.length > 0 && grid.value[0]?.length > 0)

const usedColors = computed(() => collectUsedColors(grid.value, colors.value))

function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value
  try {
    localStorage.setItem(DRAWER_KEY, drawerOpen.value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function selectUsedColor(id) {
  highlightColorId.value = highlightColorId.value === id ? 0 : id
}

onMounted(async () => {
  const id = String(route.query.file || '')
  if (!id) {
    loadingMap.value = false
    error.value = 'Mapa não informado.'
    return
  }
  loadingMap.value = true
  try {
    const raw = await fetchLibraryMap(libraryKind, id)
    const parsed = parseMapFile(raw)
    mapName.value = parsed.mapName
    colors.value = [...parsed.fixedColors, ...parsed.customColors]
    centerCellAxes.value = parsed.centerCellAxes
    grid.value = compositeLayerTree(parsed.layerTree, parsed.width, parsed.height)
    sceneTick.value += 1
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Não foi possível abrir o mapa.'
  } finally {
    loadingMap.value = false
  }
})
</script>

<template>
  <div class="viewer">
    <header class="viewer__bar">
      <button type="button" class="ghost" @click="router.push(libraryHome)">← Biblioteca</button>
      <h1>{{ mapName || 'Visualização' }}</h1>
      <span />
    </header>
    <LoadingOverlay v-if="loadingMap" title="Carregando mapa" />
    <p v-else-if="error" class="err">{{ error }}</p>
    <section v-else-if="canShow" class="viewer__body">
      <div class="viewer__stage">
        <MapCanvas
          :grid="grid"
          :colors="colors"
          :theme="theme"
          :center-cell-axes="centerCellAxes"
          :scene-tick="sceneTick"
          :highlight-color-id="highlightColorId"
          view-only
        />
      </div>
      <div class="drawer" :class="{ 'drawer--closed': !drawerOpen }">
        <button
          type="button"
          class="drawer-tab"
          :aria-expanded="drawerOpen"
          aria-controls="viewer-colors"
          :title="drawerOpen ? 'Fechar cores' : 'Abrir cores'"
          @click="toggleDrawer"
        >
          <svg class="drawer-tab__arrow" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M4 2 L8 6 L4 10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <aside class="side" id="viewer-colors">
          <h2>Cores do mapa</h2>
          <p class="side__hint">Selecione uma cor para destacá-la no mapa. Clique de novo para parar.</p>
          <p v-if="!usedColors.length" class="side__empty">Nenhuma cor pintada neste mapa.</p>
          <ul v-else class="swatches" role="list">
            <li v-for="swatch in usedColors" :key="swatch.id">
              <button
                type="button"
                class="swatch"
                :class="{ 'swatch--on': highlightColorId === swatch.id }"
                :title="`${swatch.name} (${swatch.hex})`"
                @click="selectUsedColor(swatch.id)"
              >
                <span class="swatch__chip" :style="{ background: swatch.hex }" />
                <span class="swatch__meta">
                  <span class="swatch__name">{{ swatch.name }}</span>
                  <span
                    class="swatch__hex"
                    :style="{ background: swatch.hex, color: contrastInk(swatch.hex) }"
                  >
                    {{ swatch.hex }}
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </aside>
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
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 8px 12px 12px;
}

.drawer {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  max-width: 308px;
}

.drawer--closed .side {
  width: 0;
  padding: 0;
  border-width: 0;
  overflow: hidden;
}

.side {
  width: 280px;
  padding: 14px 16px 16px;
  border-left: 1px solid var(--line);
  background: var(--bg-panel);
  overflow-y: auto;
  min-height: 0;
}

.side h2 {
  margin: 0 0 6px;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--brass);
}

.side__hint,
.side__empty {
  margin: 0 0 12px;
  font-size: 0.78rem;
  line-height: 1.4;
  color: var(--ink-dim);
}

.side__empty {
  margin-bottom: 0;
}

.drawer-tab {
  display: grid;
  place-items: center;
  align-self: flex-start;
  width: 28px;
  height: 56px;
  margin: 8px 0 0;
  padding: 0;
  border: 1px solid var(--line);
  border-right: 0;
  border-radius: 10px 0 0 10px;
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
  transform: scaleX(-1);
}

.drawer--closed .drawer-tab__arrow {
  transform: none;
}

.swatches {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 6px;
}

.swatch {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 10px;
  width: 100%;
  margin: 0;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-raised);
  color: var(--ink);
  text-align: left;
}

.swatch:hover {
  border-color: var(--brass);
}

.swatch--on {
  border-color: var(--swatch-on);
  outline: 1px solid var(--brass);
  background: var(--tool-on);
}

.swatch__chip {
  display: block;
  height: 36px;
  border-radius: 6px;
  border: 1px solid var(--line);
}

.swatch__meta {
  display: grid;
  align-content: center;
  gap: 2px;
  min-width: 0;
}

.swatch__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.82rem;
  font-weight: 600;
}

.swatch__hex {
  justify-self: start;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: var(--mono);
  font-size: 0.68rem;
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
