/**
 * Tema dia / noite da interface.
 *
 * Aplica data-theme no <html> para as variáveis CSS e guarda a escolha
 * no localStorage. O canvas lê o mesmo valor para fundo branco/preto.
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
 * Aplica o tema no documento (variáveis CSS em html[data-theme]).
 * @param {'day' | 'night'} next
 */
function apply(next) {
  const root = document.documentElement
  root.setAttribute('data-theme', next)
  root.style.colorScheme = next === 'day' ? 'light' : 'dark'
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
