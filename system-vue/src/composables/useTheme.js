/**
 * Tema dia / noite da interface.
 *
 * Classe no <html> (theme-day / theme-night) + data-theme para os
 * seletores :global. O canvas lê o mesmo valor para fundo branco/preto.
 */
import { onMounted, ref, watch } from 'vue'

const STORAGE_KEY = 'zblockmap-theme'

/**
 * @returns {'day' | 'night'}
 */
function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'day' || saved === 'night') return saved
  } catch {
    /* storage pode estar bloqueado */
  }
  return 'night'
}

/**
 * Aplica o tema no documento.
 * @param {'day' | 'night'} next
 */
function apply(next) {
  const root = document.documentElement
  const isDay = next === 'day'
  root.setAttribute('data-theme', next)
  root.classList.toggle('theme-day', isDay)
  root.classList.toggle('theme-night', !isDay)
  // Nunca setar color-scheme no <html>: no Chromium isso recria a
  // camada GPU do <canvas> e ela pode cobrir a página inteira de preto.
  root.style.removeProperty('color-scheme')
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* storage pode estar bloqueado */
  }
}

/**
 * @returns {{ theme: import('vue').Ref<'day' | 'night'>, toggleTheme: () => void }}
 */
export function useTheme() {
  const theme = ref(/** @type {'day' | 'night'} */ (readStored()))
  apply(theme.value)

  /**
   * Alterna entre dia (fundo branco) e noite (fundo preto).
   */
  function toggleTheme() {
    theme.value = theme.value === 'night' ? 'day' : 'night'
  }

  onMounted(() => {
    apply(theme.value)
  })

  watch(theme, apply)

  return { theme, toggleTheme }
}
