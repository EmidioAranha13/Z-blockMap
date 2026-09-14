<script setup>
/**
 * Shell da home: header da toolkit e drawer com os 3 módulos.
 */
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { BRAND } from '@/constants/brand.js'
import { useTheme } from '@/composables/useTheme.js'
import luaIcon from '@/assets/lua.png'
import solIcon from '@/assets/sol.png'

const { theme, toggleTheme } = useTheme()
const route = useRoute()

const modules = [
  { to: '/pixel', name: 'pixel-library', label: 'Mapa PixelArt', hint: 'Z-BlockMap' },
  { to: '/3d', name: '3d-library', label: 'Mapa 3D', hint: '3D Builder' },
  { to: '/habitat', name: 'habitat', label: 'Guia de Habitat', hint: 'Habitat Planner' },
]
</script>

<template>
  <div class="home">
    <header class="home__header">
      <div class="home__brand">
        <h1>{{ BRAND.name }}</h1>
        <p>{{ BRAND.tagline }}</p>
      </div>
      <button
        type="button"
        class="theme-switch"
        :title="theme === 'dark' ? 'Mudar para modo ensolarado' : 'Mudar para modo noturno'"
        @click="toggleTheme"
      >
        <img class="theme-switch__icon" :src="theme === 'dark' ? luaIcon : solIcon" alt="" />
        <span>{{ theme === 'dark' ? 'Noturno' : 'Ensolarado' }}</span>
      </button>
    </header>

    <div class="home__body">
      <nav class="home__drawer" aria-label="Módulos">
        <RouterLink
          v-for="item in modules"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ 'nav-item--on': route.name === item.name }"
        >
          <span class="nav-item__label">{{ item.label }}</span>
          <span class="nav-item__hint">{{ item.hint }}</span>
        </RouterLink>
      </nav>

      <main class="home__main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--bg);
  color: var(--ink);
}

.home__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
  background: var(--bg-panel);
}

.home__brand h1 {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--brass);
}

.home__brand p {
  margin: 6px 0 0;
  max-width: 42rem;
  font-size: 0.88rem;
  line-height: 1.4;
  color: var(--ink-dim);
}

.theme-switch {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg);
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 600;
}

.theme-switch:hover {
  border-color: var(--brass);
}

.theme-switch__icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  filter: var(--icon-filter);
}

.home__body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.home__drawer {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 12px;
  border-right: 1px solid var(--line);
  background: var(--bg-panel);
  overflow: auto;
}

.nav-item {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg-raised);
  color: var(--ink);
  text-decoration: none;
}

.nav-item:hover {
  border-color: var(--brass);
}

.nav-item--on {
  border-color: var(--brass);
  background: var(--tool-on);
  box-shadow: inset 3px 0 0 var(--brass);
}

.nav-item__label {
  font-weight: 700;
  font-size: 0.9rem;
}

.nav-item__hint {
  font-size: 0.72rem;
  color: var(--ink-dim);
}

.home__main {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 20px 24px 32px;
}
</style>
