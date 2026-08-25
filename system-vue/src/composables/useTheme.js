/**
 * Tema noturno (dark) ou ensolarado (light).
 * Só troca a classe no <html>; não altera color-scheme.
 */
import { onMounted, ref, watch } from 'vue'

const STORAGE_KEY = 'zblockmap-theme'

/**
 * @returns {'dark' | 'light'}
 */
function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'day') return 'light'
    if (saved === 'dark' || saved === 'night') return 'dark'
  } catch {
    /* storage pode estar bloqueado */
  }
  return 'dark'
}

/**
 * @param {'dark' | 'light'} next
 */
function apply(next) {
  const root = document.documentElement
  root.classList.toggle('theme-light', next === 'light')
  root.classList.toggle('theme-dark', next === 'dark')
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* ignore */
  }
}

/**
 * @returns {{
 *   theme: import('vue').Ref<'dark' | 'light'>,
 *   setTheme: (next: 'dark' | 'light') => void,
 * }}
 */
export function useTheme() {
  const theme = ref(/** @type {'dark' | 'light'} */ (readStored()))
  apply(theme.value)

  /**
   * @param {'dark' | 'light'} next
   */
  function setTheme(next) {
    theme.value = next === 'light' ? 'light' : 'dark'
  }

  onMounted(() => {
    apply(theme.value)
  })

  watch(theme, apply)

  return { theme, setTheme }
}
