/**
 * Configuração do Vite para o Z-blockMap.
 *
 * O alias "@" aponta para a pasta src/, para que imports como
 * `@/utils/grid.js` funcionem de qualquer arquivo do projeto.
 */
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const root = fileURLToPath(new URL('.', import.meta.url))
const workspace = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
    fs: {
      allow: [root, workspace],
    },
  },
})
