<script setup>
/**
 * StatusBar.vue
 *
 * Faixa inferior: escala, ferramenta, bloco, zoom e recado de arquivo.
 */
defineProps({
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  toolLabel: { type: String, required: true },
  toolHint: { type: String, required: true },
  hoverBlock: { type: Object, default: null },
  isDrawing: { type: Boolean, default: false },
  zoom: { type: Number, default: 1 },
  fileMessage: { type: String, default: '' },
  mapName: { type: String, default: '' },
})
</script>

<template>
  <footer class="status">
    <span>{{ mapName || 'Mapa' }}</span>
    <span class="dot" aria-hidden="true">·</span>
    <span>{{ width }} × {{ height }}</span>
    <span class="dot" aria-hidden="true">·</span>
    <span>{{ toolLabel }}{{ isDrawing ? ' (desenhando)' : '' }}</span>
    <span class="dot" aria-hidden="true">·</span>
    <span v-if="hoverBlock">bloco ({{ hoverBlock.x }}, {{ hoverBlock.y }})</span>
    <span v-else>fora da grade</span>
    <span class="dot" aria-hidden="true">·</span>
    <span>zoom {{ Math.round(zoom * 100) }}%</span>
    <span v-if="fileMessage" class="msg">{{ fileMessage }}</span>
    <span class="hint">{{ toolHint }}</span>
  </footer>
</template>

<style scoped>
.status {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 10px 14px;
  border-top: 1px solid var(--line);
  background: var(--bg-status);
  color: var(--ink-dim);
  font-family: var(--mono);
  font-size: 0.78rem;
}

.dot {
  color: var(--brass-dim);
}

.msg {
  color: var(--brass);
}

.hint {
  margin-left: auto;
  color: var(--ink-dim);
  font-family: var(--font);
  font-size: 0.78rem;
}
</style>
