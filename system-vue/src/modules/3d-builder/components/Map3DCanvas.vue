<script setup>
/**
 * Canvas WebGL do editor voxel. Um InstancedMesh para o mundo, não v-for.
 */
import { onMounted, ref } from 'vue'
import { useVoxelScene } from '../composables/useVoxelScene.js'

const props = defineProps({
  world: { type: Object, required: true },
  tool: { type: String, required: true },
  activeColor: { type: String, required: true },
  selected: { type: Object, default: null },
  theme: { type: String, default: 'dark' },
  viewOnly: { type: Boolean, default: false },
})

const emit = defineEmits({
  hover: null,
  edit: null,
})

const canvasRef = ref(null)
const { mount, capturePngBase64 } = useVoxelScene(canvasRef, props, emit)

onMounted(() => {
  mount()
})

defineExpose({ capturePngBase64 })
</script>

<template>
  <div class="map3d" :class="viewOnly ? 'map3d--view' : `map3d--${tool}`">
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

.map3d--add .map3d__canvas {
  cursor: cell;
}

.map3d--remove .map3d__canvas {
  cursor: pointer;
}

.map3d--select .map3d__canvas {
  cursor: default;
}

.map3d--view .map3d__canvas {
  cursor: grab;
}
</style>
