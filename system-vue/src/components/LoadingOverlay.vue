<script setup>
defineProps({
  title: { type: String, default: 'Carregando mapa' },
  hint: { type: String, default: 'Mapas grandes podem levar alguns segundos.' },
})
</script>

<template>
  <div class="load-modal" role="status" aria-live="polite">
    <div class="load-modal__box">
      <span class="spinner" aria-hidden="true" />
      <strong>{{ title }}</strong>
      <p>{{ hint }}</p>
    </div>
  </div>
</template>

<style scoped>
.load-modal {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  background: var(--bg);
}

.load-modal__box {
  display: grid;
  justify-items: center;
  gap: 10px;
  min-width: 240px;
  padding: 22px 24px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--bg-panel);
  color: var(--ink);
  text-align: center;
}

.load-modal__box p {
  margin: 0;
  font-size: 0.82rem;
  color: var(--ink-dim);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--line);
  border-top-color: var(--brass);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
