<script setup>
/**
 * Canvas WebGL do mapa voxel. A malha é um InstancedMesh, não v-for de cubos.
 */
import { onMounted, ref } from 'vue'
import { useVoxelScene } from '../composables/useVoxelScene.js'

const props = defineProps({
  grid: { type: Array, required: true },
  colors: { type: Array, required: true },
  theme: { type: String, default: 'dark' },
  sceneTick: { type: Number, default: 0 },
})

const canvasRef = ref(null)
const { mount } = useVoxelScene(canvasRef, props)

onMounted(() => {
  mount()
})
</script>

<template>
  <div class="map3d">
    <canvas ref="canvasRef" class="map3d__canvas" />
  </div>
</template>

<style scoped>
.map3d {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 14px;
  background: var(--bg);
  box-shadow: inset 0 0 0 1px var(--line);
}

.map3d__canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
</style>
