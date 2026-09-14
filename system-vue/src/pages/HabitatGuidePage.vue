<script setup>
import { POKOPIA_API_CREDITS } from '@/apis/credits.js'
import { useHabitatGuide } from '@/composables/useHabitatGuide.js'

const {
  catalog,
  query,
  selectors,
  chosen,
  results,
  paging,
  loading,
  loadingFilters,
  error,
  setCatalog,
  setPage,
} = useHabitatGuide()

const TYPE_COLORS = {
  Fuego: '#f6c9bc',
  Agua: '#c5dff0',
  Planta: '#cfe6c8',
  Electrico: '#f6e9b8',
  Hielo: '#d7eef6',
  Lucha: '#e8c4b8',
  Veneno: '#dcc6e8',
  Tierra: '#e6d7c0',
  Volador: '#d5e4f4',
  Psíquico: '#f0cde4',
  Bicho: '#d5e4b8',
  Roca: '#ddd3c4',
  Fantasma: '#cfc6e0',
  Dragon: '#c9d4f0',
  Siniestro: '#cfc8c4',
  Acero: '#d5dde4',
  Hada: '#f4d4e4',
  Normal: '#e4e0d8',
}

function typeColor(types) {
  const name = types?.[0]?.name
  return TYPE_COLORS[name] || 'var(--bg-panel)'
}
</script>

<template>
  <section>
    <header class="head">
      <h2>Guia de Habitat</h2>
      <p>
        Consulte Pokémon e itens da Pokopia: habitats, climas, especialidades e receitas.
        A busca usa nome ou número; os seletores montam a consulta na API.
      </p>
    </header>

    <div class="switch" role="tablist" aria-label="Catálogo">
      <button
        type="button"
        role="tab"
        :aria-selected="catalog === 'pokemon'"
        :class="{ 'switch__btn--on': catalog === 'pokemon' }"
        @click="setCatalog('pokemon')"
      >
        Pokémon
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="catalog === 'items'"
        :class="{ 'switch__btn--on': catalog === 'items' }"
        @click="setCatalog('items')"
      >
        Itens
      </button>
    </div>

    <div class="filters">
      <label class="field field--search">
        <span>{{ catalog === 'pokemon' ? 'Buscar por nome ou número' : 'Buscar por nome ou slug' }}</span>
        <input
          v-model="query"
          type="search"
          :placeholder="catalog === 'pokemon' ? 'Ex.: Charmander ou 4' : 'Ex.: honey'"
        />
      </label>

      <label v-for="field in selectors" :key="field.query" class="field">
        <span>{{ field.label }}</span>
        <select v-model="chosen[field.query]">
          <option value="">Todos</option>
          <option v-for="option in field.options" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="loadingFilters" class="status">Carregando filtros…</p>
    <p v-else-if="error" class="status status--err">{{ error }}</p>
    <p v-else-if="loading" class="status">Consultando a API…</p>

    <hr class="rule" />

    <div v-if="catalog === 'pokemon'" class="grid">
      <article
        v-for="item in results"
        :key="item.slug || item.nationalNumber"
        class="card"
        :style="{ background: typeColor(item.types) }"
      >
        <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" />
        <span v-else class="card__ph">Sem imagem</span>
        <p class="card__num">N.º {{ item.localNumber || item.nationalNumber }}</p>
        <h3>{{ item.name }}</h3>
        <p v-if="item.types?.length" class="card__meta">
          {{ item.types.map((type) => type.name).join(' · ') }}
        </p>
      </article>
    </div>

    <div v-else class="grid">
      <article v-for="item in results" :key="item.slug || item.name" class="card card--item">
        <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" />
        <span v-else class="card__ph">Sem imagem</span>
        <h3>{{ item.name }}</h3>
        <p v-if="item.category" class="card__meta">{{ item.category }}</p>
      </article>
    </div>

    <p v-if="!loading && !error && results.length === 0" class="empty">Nenhum resultado com esses filtros.</p>

    <nav v-if="paging.totalPages > 1" class="pager">
      <button type="button" class="ghost" :disabled="paging.page <= 1" @click="setPage(paging.page - 1)">
        Anterior
      </button>
      <span>Página {{ paging.page }} de {{ paging.totalPages }} ({{ paging.total }})</span>
      <button
        type="button"
        class="ghost"
        :disabled="paging.page >= paging.totalPages"
        @click="setPage(paging.page + 1)"
      >
        Próxima
      </button>
    </nav>

    <footer class="credits">
      <p>
        Dados via
        <a :href="POKOPIA_API_CREDITS.siteUrl" target="_blank" rel="noopener noreferrer">{{ POKOPIA_API_CREDITS.name }}</a>,
        criada por
        <a :href="POKOPIA_API_CREDITS.repoUrl" target="_blank" rel="noopener noreferrer">{{ POKOPIA_API_CREDITS.author }}</a>.
        Licença {{ POKOPIA_API_CREDITS.licenseName }} — {{ POKOPIA_API_CREDITS.copyright }}.
        Obrigado por disponibilizar a API.
      </p>
      <p>
        Pokémon, Pokédex, Pokopia e marcas relacionadas pertencem à Nintendo, Game Freak e The Pokémon Company.
        Este guia não é oficial nem endossado por eles.
      </p>
    </footer>
  </section>
</template>

<style scoped>
.head {
  margin-bottom: 16px;
}

.head h2 {
  margin: 0 0 6px;
  font-size: 1.15rem;
}

.head p {
  margin: 0;
  max-width: 42rem;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--ink-dim);
}

.switch {
  display: inline-flex;
  margin-bottom: 16px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg-panel);
}

.switch button {
  padding: 7px 16px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--ink-dim);
  font-weight: 700;
}

.switch__btn--on {
  background: var(--tool-on);
  color: var(--ink);
  box-shadow: inset 0 -2px 0 var(--brass);
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  align-items: end;
}

.field--search {
  grid-column: 1 / -1;
}

.field {
  display: grid;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--ink-dim);
}

.field input,
.field select {
  width: 100%;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--ink);
  font-size: 0.95rem;
}

.status {
  margin: 12px 0 0;
  color: var(--ink-dim);
}

.status--err {
  color: var(--danger-text);
}

.rule {
  margin: 18px 0;
  border: 0;
  border-top: 1px solid var(--line);
}

.grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.card {
  display: grid;
  gap: 6px;
  padding: 12px 10px 10px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  color: #2a2a2a;
  text-align: center;
}

.card--item {
  background: var(--bg-panel);
  color: var(--ink);
  border-color: var(--line);
}

.card img {
  width: 72px;
  height: 72px;
  margin: 0 auto;
  object-fit: contain;
}

.card__ph {
  display: grid;
  place-items: center;
  min-height: 72px;
  font-size: 0.72rem;
  color: var(--ink-dim);
}

.card__num {
  margin: 0;
  font-size: 0.7rem;
  color: inherit;
  opacity: 0.75;
}

.card h3 {
  margin: 0;
  font-size: 0.85rem;
}

.card__meta {
  margin: 0;
  font-size: 0.72rem;
  opacity: 0.8;
}

.empty {
  color: var(--ink-dim);
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 18px;
  font-size: 0.85rem;
  color: var(--ink-dim);
}

.ghost {
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font-weight: 600;
}

.ghost:disabled {
  opacity: 0.45;
}

.credits {
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  max-width: 46rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--ink-dim);
}

.credits p {
  margin: 0 0 8px;
}

.credits a {
  color: var(--brass);
  font-weight: 600;
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
