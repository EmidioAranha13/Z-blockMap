/**
 * Coleta itens da Pokopia API.
 *
 * GET /api/v1/items
 * GET /api/v1/items/filters
 * GET /api/v1/items/{slug}
 */
import { apiGet, asFilterOptions } from '@/apis/client.js'

/** Campos de /items/filters → querystring de /items */
export const ITEM_FILTER_FIELDS = [
  { source: 'categories', query: 'category', label: 'Categoria' },
  { source: 'tags', query: 'tag', label: 'Tag' },
  { source: 'contentSources', query: 'contentSource', label: 'Conteúdo' },
  { source: 'recipeStatuses', query: 'recipeStatus', label: 'Receita' },
  { source: 'events', query: 'event', label: 'Evento' },
]

/**
 * @param {object} [params]
 */
export function listItems(params = {}) {
  return apiGet('/items', params)
}

export function fetchItemFilters() {
  return apiGet('/items/filters')
}

/**
 * @param {string} slug
 */
export async function fetchItemBySlug(slug) {
  const body = await apiGet(`/items/${encodeURIComponent(slug)}`)
  return body?.data ?? body
}

/**
 * @param {object} raw
 */
export function itemFilterSelectors(raw) {
  return ITEM_FILTER_FIELDS.map((field) => ({
    ...field,
    options: asFilterOptions(raw?.[field.source]),
  })).filter((field) => field.options.length > 0)
}
