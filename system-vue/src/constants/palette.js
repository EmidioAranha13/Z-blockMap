/**
 * Paleta fixa e cores de desenho ligadas ao tema (dia / noite).
 *
 * O id 0 é sempre "vazio" (borracha). No canvas ele não usa o hex da paleta:
 * no dia o bloco vazio é branco; à noite, preto.
 */
export const FIXED_COLORS = [
  { id: 0, name: 'Vazio', hex: '#808080' },
  { id: 1, name: 'Terreno', hex: '#c4a35a' },
  { id: 2, name: 'Muro', hex: '#8a6a4b' },
  { id: 3, name: 'Água', hex: '#3d6e8a' },
  { id: 4, name: 'Vegetação', hex: '#4f7a4a' },
  { id: 5, name: 'Caminho', hex: '#d97b54' },
  { id: 6, name: 'Destaque', hex: '#d4c4a8' },
]

/**
 * Aparência do canvas em cada tema.
 * background/empty seguem o pedido: branco de dia, preto de noite.
 */
export const THEME_CANVAS = {
  night: {
    background: '#000000',
    empty: '#000000',
    grid: 'rgba(230, 230, 230, 0.62)',
    axisX: '#e05d5d',
    axisY: '#5da8e0',
    origin: '#f4e6c5',
    hover: 'rgba(255, 255, 255, 0.18)',
    previewFill: 'rgba(217, 123, 84, 0.55)',
    previewStroke: 'rgba(244, 214, 176, 0.9)',
    label: '#d8d8d8',
  },
  day: {
    background: '#ffffff',
    empty: '#ffffff',
    grid: 'rgba(40, 40, 40, 0.22)',
    axisX: '#c62828',
    axisY: '#1565c0',
    origin: '#333333',
    hover: 'rgba(0, 0, 0, 0.12)',
    previewFill: 'rgba(217, 123, 84, 0.5)',
    previewStroke: 'rgba(120, 60, 20, 0.85)',
    label: '#333333',
  },
}

/**
 * Cópia mutável da paleta fixa (nome e hex podem ser editados na UI).
 * @returns {Array<{ id: number, name: string, hex: string, source: 'fixed' }>}
 */
export function cloneFixedColors() {
  return FIXED_COLORS.map((item) => ({ ...item, source: 'fixed' }))
}

/**
 * Converte "#rrggbb" em componentes 0–255.
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
export function hexToRgb(hex) {
  const raw = String(hex || '').replace('#', '')
  if (raw.length !== 6) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(raw.slice(0, 2), 16) || 0,
    g: parseInt(raw.slice(2, 4), 16) || 0,
    b: parseInt(raw.slice(4, 6), 16) || 0,
  }
}

/**
 * Normaliza um texto para #rrggbb em minúsculas. Devolve null se for inválido.
 * @param {string} value
 * @returns {string | null}
 */
export function normalizeHex(value) {
  const match = String(value || '')
    .trim()
    .match(/^#?([0-9a-fA-F]{6})$/)
  if (!match) return null
  return `#${match[1].toLowerCase()}`
}

/**
 * Localiza uma cor pelo id na lista combinada (fixas + personalizadas).
 * @param {Array<{ id: number, hex: string }>} colors
 * @param {number} colorId
 */
export function findColor(colors, colorId) {
  return colors.find((item) => item.id === colorId) ?? null
}

/**
 * Hex usado para pintar um bloco.
 * Id 0 (vazio) segue o tema; os demais vêm da lista de cores.
 *
 * @param {Array<{ id: number, hex: string }>} colors
 * @param {number} colorId
 * @param {'day' | 'night'} theme
 * @returns {string}
 */
export function getCellHex(colors, colorId, theme) {
  if (colorId === 0) return THEME_CANVAS[theme].empty
  const found = findColor(colors, colorId)
  if (found) return found.hex
  return THEME_CANVAS[theme].empty
}

/**
 * Texto claro ou escuro sobre um fundo hexadecimal, para o hex dentro da tag.
 * @param {string} hex
 * @returns {string}
 */
export function contrastInk(hex) {
  const { r, g, b } = hexToRgb(hex)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.55 ? '#1a1a1a' : '#ffffff'
}
