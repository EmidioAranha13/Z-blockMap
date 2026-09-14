<script setup>
/**
 * Grade de cards da biblioteca (3 por linha) + card de criar.
 */
defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  createLabel: { type: String, default: 'Criar uma base' },
})

const emit = defineEmits({
  create: null,
  view: (id) => typeof id === 'string',
  edit: (id) => typeof id === 'string',
  delete: (id) => typeof id === 'string',
})
</script>

<template>
  <p v-if="loading" class="status">Carregando biblioteca…</p>
  <p v-else-if="error" class="status status--err">{{ error }}</p>

  <div v-else class="grid">
    <article
      v-for="item in items"
      :key="item.id"
      class="card"
      :class="item.origin === 'draft' ? 'card--draft' : 'card--saved'"
    >
      <div class="card__preview">
        <img v-if="item.previewUrl" :src="item.previewUrl" :alt="item.name" />
        <span v-else class="card__ph">Sem prévia</span>
      </div>
      <h3>
        {{ item.name }}
        <span v-if="item.origin === 'draft'" class="card__badge card__badge--draft">Rascunho</span>
        <span v-else class="card__badge card__badge--saved">Salvo</span>
      </h3>
      <p v-if="item.file && item.file !== item.name" class="card__file">{{ item.file }}</p>
      <div class="card__actions">
        <button type="button" class="ghost" @click="emit('view', item.id)">Ver</button>
        <button type="button" class="ghost" @click="emit('edit', item.id)">Editar</button>
        <button type="button" class="ghost ghost--danger" @click="emit('delete', item.id)">Excluir</button>
      </div>
    </article>

    <button type="button" class="card card--create" @click="emit('create')">
      <span class="card__plus" aria-hidden="true">+</span>
      <span>{{ createLabel }}</span>
    </button>
  </div>
</template>

<style scoped>
.status {
  margin: 0 0 16px;
  color: var(--ink-dim);
}

.status--err {
  color: var(--danger-text);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 2px solid var(--line);
  border-radius: 12px;
  background: var(--bg-panel);
  color: var(--ink);
  text-align: left;
}

.card--saved {
  border-color: var(--card-saved);
}

.card--draft {
  border-color: var(--card-draft);
}

.card h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  font-weight: 700;
  overflow: hidden;
}

.card__badge {
  flex-shrink: 0;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.card__badge--draft {
  background: color-mix(in srgb, var(--card-draft) 22%, transparent);
  color: var(--card-draft);
}

.card__badge--saved {
  background: color-mix(in srgb, var(--card-saved) 22%, transparent);
  color: var(--card-saved);
}

.card__file {
  margin: 0;
  font-size: 0.68rem;
  color: var(--ink-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card__preview {
  aspect-ratio: 4 / 3;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-input);
  display: grid;
  place-items: center;
}

.card__preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.card__ph {
  font-size: 0.78rem;
  color: var(--ink-dim);
}

.card__actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.ghost {
  padding: 7px 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font-weight: 600;
}

.ghost:hover {
  border-color: var(--brass);
}

.ghost--danger {
  color: var(--danger-text);
}

.ghost--danger:hover {
  border-color: var(--danger);
}

.card--create {
  align-content: center;
  justify-items: center;
  min-height: 220px;
  cursor: pointer;
  color: var(--ink-dim);
  font-weight: 700;
}

.card--create:hover {
  border-color: var(--brass);
  color: var(--ink);
}

.card__plus {
  font-size: 2.4rem;
  line-height: 1;
  color: var(--brass);
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
