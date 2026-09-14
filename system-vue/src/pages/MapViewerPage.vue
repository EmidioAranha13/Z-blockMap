<script setup>
/**
 * Visualização em tela cheia de um mapa pixel (sem ferramentas de desenho).
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import MapCanvas from '@/components/MapCanvas.vue'
import { useTheme } from '@/composables/useTheme.js'
import { parseMapFile } from '@/utils/fileFormat.js'
import { compositeLayerTree } from '@/utils/layers.js'
import { fetchLibraryMap, libraryHomePath, libraryKindFromRoute } from '@/utils/libraryApi.js'

const route = useRoute()
const router = useRouter()
const { theme } = useTheme()
const libraryKind = libraryKindFromRoute(route)
const libraryHome = libraryHomePath(libraryKind)

const error = ref('')
const loadingMap = ref(true)
const mapName = ref('')
const grid = ref([[]])
const colors = ref([])
const centerCellAxes = ref(false)
const sceneTick = ref(0)

const canShow = computed(() => !error.value && grid.value.length > 0 && grid.value[0]?.length > 0)

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
    <section v-else-if="canShow" class="viewer__stage">
      <MapCanvas
        :grid="grid"
        :colors="colors"
        :theme="theme"
        :center-cell-axes="centerCellAxes"
        :scene-tick="sceneTick"
        view-only
      />
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

.viewer__stage {
  flex: 1;
  min-height: 0;
  padding: 8px 12px 12px;
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
