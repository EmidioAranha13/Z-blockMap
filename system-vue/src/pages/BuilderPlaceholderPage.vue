<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="placeholder">
    <header>
      <button type="button" class="ghost" @click="router.push('/3d')">← Biblioteca</button>
    </header>
    <section>
      <h1>3D Builder</h1>
      <p>
        Este módulo ainda vai ser desenvolvido. A estrutura e a pasta
        <code>maps/3DMap</code> já estão prontas para receber os arquivos.
      </p>
    </section>
  </div>
</template>

<style scoped>
.placeholder {
  display: grid;
  gap: 24px;
  height: 100%;
  padding: 20px;
  background: var(--bg);
  color: var(--ink);
}

h1 {
  margin: 0 0 10px;
  color: var(--brass);
}

p {
  margin: 0;
  max-width: 36rem;
  line-height: 1.5;
  color: var(--ink-dim);
}

code {
  font-family: var(--mono);
}

.ghost {
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-panel);
  color: var(--ink);
  font-weight: 600;
}
</style>
