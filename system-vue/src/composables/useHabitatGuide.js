/**
 * Guia de Habitat: Pokémon ou itens da Pokopia API, com filtros dinâmicos.
 */
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { fetchItemBySlug, fetchItemFilters, itemFilterSelectors, listItems } from '@/apis/items.js'
import { fetchPokemonBySlugOrNumber, fetchPokemonFilters, listPokemon, pokemonFilterSelectors } from '@/apis/pokemon.js'

const PAGE_SIZE = 24
const emptyPaging = { total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 }

export function useHabitatGuide() {
  const catalog = ref('pokemon')
  const query = ref('')
  const selectors = ref([])
  const chosen = reactive({})
  const results = ref([])
  const paging = ref({ ...emptyPaging })
  const loading = ref(false)
  const loadingFilters = ref(false)
  const error = ref('')
  let debounce = 0
  let requestSeq = 0
  let suppress = false

  function resetChosen() {
    for (const key of Object.keys(chosen)) delete chosen[key]
  }

  function activeFilters() {
    const params = {}
    for (const field of selectors.value) {
      const value = chosen[field.query]
      if (value) params[field.query] = value
    }
    return params
  }

  async function loadSelectors() {
    loadingFilters.value = true
    suppress = true
    try {
      if (catalog.value === 'pokemon') {
        selectors.value = pokemonFilterSelectors(await fetchPokemonFilters())
      } else {
        selectors.value = itemFilterSelectors(await fetchItemFilters())
      }
      resetChosen()
      for (const field of selectors.value) chosen[field.query] = ''
      await nextTick()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Não foi possível carregar os filtros.'
      selectors.value = []
    } finally {
      loadingFilters.value = false
      suppress = false
    }
  }

  async function loadResults() {
    const seq = (requestSeq += 1)
    loading.value = true
    error.value = ''
    const search = query.value.trim()
    const filters = activeFilters()
    const page = paging.value.page
    const onlySearch = search && Object.keys(filters).length === 0 && page === 1

    try {
      if (catalog.value === 'pokemon') {
        if (onlySearch) {
          try {
            const one = await fetchPokemonBySlugOrNumber(search)
            if (seq !== requestSeq) return
            results.value = [one]
            paging.value = { total: 1, page: 1, limit: PAGE_SIZE, totalPages: 1 }
            return
          } catch (err) {
            if (err.status && err.status !== 404) throw err
          }
        }
        const payload = await listPokemon({ ...filters, search, page, limit: PAGE_SIZE })
        if (seq !== requestSeq) return
        results.value = Array.isArray(payload.data) ? payload.data : []
        paging.value = payload.pagination || { ...emptyPaging, page }
      } else {
        if (onlySearch) {
          try {
            const one = await fetchItemBySlug(search)
            if (seq !== requestSeq) return
            results.value = [one]
            paging.value = { total: 1, page: 1, limit: PAGE_SIZE, totalPages: 1 }
            return
          } catch (err) {
            if (err.status && err.status !== 404) throw err
          }
        }
        const payload = await listItems({ ...filters, search, page, limit: PAGE_SIZE })
        if (seq !== requestSeq) return
        results.value = Array.isArray(payload.data) ? payload.data : []
        paging.value = payload.pagination || { ...emptyPaging, page }
      }
    } catch (err) {
      if (seq !== requestSeq) return
      results.value = []
      error.value = err instanceof Error ? err.message : 'Falha ao consultar a API.'
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  function scheduleLoad() {
    window.clearTimeout(debounce)
    debounce = window.setTimeout(() => {
      loadResults()
    }, 280)
  }

  function setCatalog(next) {
    if (catalog.value === next) return
    suppress = true
    catalog.value = next
    query.value = ''
    paging.value = { ...emptyPaging }
    results.value = []
    loadSelectors().then(loadResults)
  }

  function setPage(page) {
    const next = Math.max(1, Math.min(page, paging.value.totalPages || 1))
    if (next === paging.value.page) return
    paging.value = { ...paging.value, page: next }
    loadResults()
  }

  watch(query, () => {
    if (suppress) return
    paging.value = { ...paging.value, page: 1 }
    scheduleLoad()
  })

  watch(
    chosen,
    () => {
      if (suppress) return
      paging.value = { ...paging.value, page: 1 }
      scheduleLoad()
    },
    { deep: true },
  )

  onMounted(async () => {
    await loadSelectors()
    await loadResults()
  })

  return {
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
    loadResults,
  }
}
