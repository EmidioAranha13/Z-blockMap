/**
 * Cliente HTTP da Pokopia API (`https://pokopiapi.com/api/v1`).
 * No Vite, `/api/v1` é proxy para esse host (evita CORS no browser).
 *
 * Créditos e licença: `@/apis/credits.js` e `@/apis/LICENSE-pokopiapi.txt`.
 */
import { POKOPIA_API_CREDITS } from '@/apis/credits.js'

export { POKOPIA_API_CREDITS }
export const API_BASE = '/api/v1'

/**
 * @param {string} pathname  Ex.: `/pokemon`, `/items/honey`
 * @param {Record<string, string | number | undefined | null>} [params]
 */
export async function apiGet(pathname, params = {}) {
  const url = new URL(`${API_BASE}${pathname}`, window.location.origin)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    url.searchParams.set(key, String(value))
  }

  const res = await fetch(url)
  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok) {
    const error = new Error(body?.error || `Não foi possível consultar ${pathname}.`)
    error.status = res.status
    throw error
  }
  return body
}

/**
 * Normaliza opções vindas de `/filters` (string, { name, iconUrl } ou { slug, name }).
 * @param {unknown} list
 * @returns {Array<{ value: string, label: string, iconUrl: string | null }>}
 */
export function asFilterOptions(list) {
  if (!Array.isArray(list)) return []
  return list.map((item) => {
    if (typeof item === 'string') {
      return { value: item, label: labelForValue(item), iconUrl: null }
    }
    if (!item || typeof item !== 'object') {
      return { value: '', label: '', iconUrl: null }
    }
    const name = typeof item.name === 'string' ? item.name : ''
    const slug = typeof item.slug === 'string' ? item.slug : ''
    const value = slug || name
    return {
      value,
      label: name || slug || labelForValue(value),
      iconUrl: typeof item.iconUrl === 'string' ? item.iconUrl : null,
    }
  }).filter((item) => item.value)
}

const VALUE_LABELS = {
  comun: 'Comum',
  evento: 'Evento',
  event: 'Evento',
  regular: 'Regular',
  basin: 'Basin',
  base: 'Base',
  'free-update': 'Atualização gratuita',
  'expansion-pass': 'Expansion Pass',
  none: 'Sem receita',
  verified: 'Verificada',
  incomplete: 'Incompleta',
}

/**
 * @param {string} value
 */
export function labelForValue(value) {
  return VALUE_LABELS[value] || value
}
