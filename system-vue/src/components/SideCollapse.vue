<script setup>
/**
 * SideCollapse.vue
 *
 * Título do side em caixa alta (igual aos kickers) que abre e fecha o bloco.
 * O estado fica no localStorage para não reabrir tudo a cada visita.
 */
import { ref } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  storageKey: { type: String, required: true },
})

const STORAGE_PREFIX = 'zblockmap-fold-'

/**
 * @param {string} key
 * @returns {boolean}
 */
function readOpen(key) {
  try {
    const saved = localStorage.getItem(STORAGE_PREFIX + key)
    if (saved === '0') return false
    if (saved === '1') return true
  } catch {
    /* storage pode estar bloqueado */
  }
  return true
}

const open = ref(readOpen(props.storageKey))

function onToggle(event) {
  open.value = event.target.open
  try {
    localStorage.setItem(STORAGE_PREFIX + props.storageKey, open.value ? '1' : '0')
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <details class="fold" :open="open" @toggle="onToggle">
    <summary class="fold__head">
      <span>{{ title }}</span>
      <span class="fold__caret" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
    </summary>
    <div class="fold__body">
      <slot />
    </div>
  </details>
</template>

<style scoped>
.fold {
  margin: 0;
  border-bottom: 1px solid var(--line);
  padding-bottom: 8px;
}

.fold__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  padding: 10px 0 8px;
  list-style: none;
  cursor: pointer;
  font-size: 0.7rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--brass);
  user-select: none;
}

.fold__head::-webkit-details-marker {
  display: none;
}

.fold__head::marker {
  content: '';
}

.fold__caret {
  font-size: 0.85rem;
  letter-spacing: 0;
  color: var(--brass);
}

.fold__body {
  display: grid;
  gap: 12px;
  padding-bottom: 6px;
}
</style>
