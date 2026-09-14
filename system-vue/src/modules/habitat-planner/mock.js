/**
 * Dados fictícios do Guia de Habitat até existir API real.
 * Tipos estáticos: Fogo, Água, Planta.
 */

export const HABITAT_TYPES = [
  { id: 'all', label: 'Todos' },
  { id: 'fogo', label: 'Fogo' },
  { id: 'agua', label: 'Água' },
  { id: 'planta', label: 'Planta' },
]

export const HABITAT_TYPE_COLORS = {
  fogo: '#f6c9bc',
  agua: '#c5dff0',
  planta: '#cfe6c8',
}

function glyphSvg(type, letter) {
  const fill = type === 'fogo' ? '#c45c4a' : type === 'agua' ? '#3d6e8a' : '#4f7a4a'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="${fill}"/><text x="32" y="40" text-anchor="middle" font-size="22" font-family="Segoe UI,sans-serif" fill="#fff">${letter}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export const HABITAT_ITEMS = [
  { id: 'brasa', name: 'Brasa', type: 'fogo', image: glyphSvg('fogo', 'B') },
  { id: 'chama', name: 'Chama', type: 'fogo', image: glyphSvg('fogo', 'C') },
  { id: 'fagulha', name: 'Fagulha', type: 'fogo', image: glyphSvg('fogo', 'F') },
  { id: 'magma', name: 'Magma', type: 'fogo', image: glyphSvg('fogo', 'M') },
  { id: 'mare', name: 'Maré', type: 'agua', image: glyphSvg('agua', 'M') },
  { id: 'gotinha', name: 'Gotinha', type: 'agua', image: glyphSvg('agua', 'G') },
  { id: 'coral', name: 'Coral', type: 'agua', image: glyphSvg('agua', 'C') },
  { id: 'nuvem', name: 'Nuvem', type: 'agua', image: glyphSvg('agua', 'N') },
  { id: 'folha', name: 'Folha', type: 'planta', image: glyphSvg('planta', 'F') },
  { id: 'brotinho', name: 'Brotinho', type: 'planta', image: glyphSvg('planta', 'B') },
  { id: 'musgo', name: 'Musgo', type: 'planta', image: glyphSvg('planta', 'M') },
  { id: 'flor', name: 'Flor', type: 'planta', image: glyphSvg('planta', 'L') },
]
