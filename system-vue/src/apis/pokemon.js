/**
 * Coleta Pokémon da Pokopia API.
 *
 * GET /api/v1/pokemon
 * GET /api/v1/pokemon/filters
 * GET /api/v1/pokemon/{slugOrNumber}
 */
import { apiGet, asFilterOptions } from '@/apis/client.js'

/** Campos de /pokemon/filters → querystring de /pokemon */
export const POKEMON_FILTER_FIELDS = [
  { source: 'types', query: 'type', label: 'Tipo' },
  { source: 'specialties', query: 'specialty', label: 'Especialidade' },
  { source: 'climates', query: 'climate', label: 'Clima' },
  { source: 'zones', query: 'zone', label: 'Zona' },
  { source: 'habitats', query: 'habitat', label: 'Habitat' },
  { source: 'materials', query: 'produces', label: 'Produz' },
  { source: 'classifications', query: 'classification', label: 'Classificação' },
  { source: 'dexes', query: 'dex', label: 'Pokédex' },
  { source: 'contentSources', query: 'contentSource', label: 'Conteúdo' },
  { source: 'events', query: 'event', label: 'Evento' },
  { source: 'forms', query: 'form', label: 'Forma' },
]

/**
 * @param {object} [params]
 */
export function listPokemon(params = {}) {
  return apiGet('/pokemon', params)
}

export function fetchPokemonFilters() {
  return apiGet('/pokemon/filters')
}

/**
 * Nome ou número nacional (ex.: bulbasaur, 1, 001).
 * @param {string} slugOrNumber
 */
export function fetchPokemonBySlugOrNumber(slugOrNumber) {
  return apiGet(`/pokemon/${encodeURIComponent(slugOrNumber)}`)
}

/**
 * @param {object} raw
 */
export function pokemonFilterSelectors(raw) {
  return POKEMON_FILTER_FIELDS.map((field) => ({
    ...field,
    options: asFilterOptions(raw?.[field.source]),
  })).filter((field) => field.options.length > 0)
}
