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
