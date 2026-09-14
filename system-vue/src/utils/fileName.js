/**
 * Nome de arquivo seguro a partir do nome do mapa.
 * @param {string} name
 * @returns {string}
 */
export function safeFileName(name) {
  const trimmed = String(name || '').trim() || 'mapa'
  return trimmed
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'mapa'
}

export const OFFICIAL_MAP_SUFFIX = '.zblockmap.json'
export const DRAFT_MAP_SUFFIX = '.zblockmap.draft.json'

/**
 * @param {string} file
 */
export function isDraftFileName(file) {
  return /\.zblockmap\.draft\.json$/i.test(String(file || ''))
}

/**
 * Nome-base sem extensão oficial/rascunho.
 * @param {string} [file]
 * @param {string} [mapName]
 */
export function mapFileStem(file, mapName) {
  const raw = String(file || '').trim()
  if (!raw) return safeFileName(mapName)
  return raw
    .replace(/\.zblockmap\.draft\.json$/i, '')
    .replace(/\.zblockmap\.json$/i, '')
    .replace(/\.json$/i, '')
}

/**
 * @param {string} [file]
 * @param {string} [mapName]
 */
export function officialFileName(file, mapName) {
  return `${mapFileStem(file, mapName)}${OFFICIAL_MAP_SUFFIX}`
}

/**
 * @param {string} [file]
 * @param {string} [mapName]
 */
export function draftFileName(file, mapName) {
  return `${mapFileStem(file, mapName)}${DRAFT_MAP_SUFFIX}`
}
