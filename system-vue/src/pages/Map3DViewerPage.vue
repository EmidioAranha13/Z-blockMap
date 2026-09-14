<script setup>
/**
 * Visualização voxel do mapa Pixel Art (orbit 360°, sem ferramentas 3D).
 */
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import Map3DCanvas from '@/modules/3d-builder/components/Map3DCanvas.vue'
import { usePixelMap3D } from '@/modules/3d-builder/composables/usePixelMap3D.js'
import { useTheme } from '@/composables/useTheme.js'

const route = useRoute()
const router = useRouter()
const { theme } = useTheme()
const { loading, error, mapName, grid, colors, sceneTick, canShow, load } = usePixelMap3D()

onMounted(() => {
  load(String(route.query.file || ''))
})
</script>

<template>
  <div class="viewer">
    <header class="viewer__bar">
      <button type="button" class="ghost" @click="router.push('/3d')">← Biblioteca</button>
      <h1>{{ mapName || 'Mapa 3D' }}</h1>
      <span />
    </header>
    <LoadingOverlay v-if="loading" title="Montando o mundo 3D" />
    <p v-else-if="error" class="err">{{ error }}</p>
    <section v-else-if="canShow" class="viewer__stage">
      <Map3DCanvas
        :grid="grid"
        :colors="colors"
        :theme="theme"
        :scene-tick="sceneTick"
      />
      <p class="hint">Esquerdo: orbitar · Direito: mover · Scroll: zoom</p>
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
  position: relative;
  flex: 1;
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
