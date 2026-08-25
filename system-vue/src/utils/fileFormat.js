/**
 * Formato de arquivo .zblockmap (JSON).
 *
 * v3: nome do mapa, árvore de camadas/grupos, cores e escala.
 * v2/v1 (só cells): vira uma única camada ao carregar.
 */
import { MAX_GRID_SIZE } from '@/constants/limits.js'
import { cloneFixedColors, normalizeHex } from '@/constants/palette.js'
import { createGrid } from '@/utils/grid.js'
import { createLayer, serializeLayerTree, syncIdCounter } from '@/utils/layers.js'

export const FILE_FORMAT = 'z-blockmap'
export const FILE_VERSION = 3
export const FILE_EXTENSION = '.zblockmap.json'

/**
 * Monta o objeto que será gravado em disco.
 *
 * @param {object} state
 */
export function serializeMapFile(state) {
  return {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    name: state.mapName,
    width: state.width,
    height: state.height,
    selectedColor: state.selectedColor,
    scaleLocked: !!state.scaleLocked,
    centerCellAxes: !!state.centerCellAxes,
    brushSize: state.brushSize || 1,
    colors: {
      fixed: state.fixedColors.map(stripColor),
      custom: state.customColors.map(stripColor),
    },
    layers: serializeLayerTree(state.layerTree),
  }
}

/**
 * Lê um JSON (v3 com camadas ou o formato antigo só com cells).
 * @param {unknown} raw
 */
export function parseMapFile(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Arquivo de mapa inválido.')
  }

  const data = raw
  const width = Math.floor(Number(data.width))
  const height = Math.floor(Number(data.height))
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error('O arquivo não informa largura e altura.')
  }
  if (width < 1 || height < 1 || width > MAX_GRID_SIZE || height > MAX_GRID_SIZE) {
    throw new Error(`A escala precisa estar entre 1 e ${MAX_GRID_SIZE}.`)
  }

  const fixedColors = cloneFixedColors()
  const savedFixed = data.colors?.fixed
  if (Array.isArray(savedFixed)) {
    for (const saved of savedFixed) {
      const target = fixedColors.find((item) => item.id === saved.id)
      if (!target) continue
      if (typeof saved.name === 'string' && saved.name.trim()) {
        target.name = saved.name.trim()
      }
      const hex = normalizeHex(saved.hex)
      if (hex && target.id !== 0) target.hex = hex
    }
  }

  const customColors = []
  const savedCustom = data.colors?.custom
  if (Array.isArray(savedCustom)) {
    for (const saved of savedCustom) {
      const hex = normalizeHex(saved.hex)
      if (!hex) continue
      customColors.push({
        id: Number(saved.id),
        name: typeof saved.name === 'string' && saved.name.trim() ? saved.name.trim() : 'Cor',
        hex,
        source: 'custom',
      })
    }
  }

  let layerTree
  if (Array.isArray(data.layers) && data.layers.length > 0) {
    layerTree = data.layers.map((node) => parseLayerNode(node, width, height))
  } else {
    const layer = createLayer(width, height, 'Camada 1')
    const cells = Array.isArray(data.cells) ? data.cells : []
    copyGrid(layer.grid, cells, width, height)
    layerTree = [layer]
  }
  syncIdCounter(layerTree)

  return {
    mapName: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Mapa sem nome',
    width,
    height,
    layerTree,
    fixedColors,
    customColors,
    selectedColor: Number.isFinite(Number(data.selectedColor)) ? Number(data.selectedColor) : 1,
    scaleLocked: !!data.scaleLocked,
    centerCellAxes: !!data.centerCellAxes && width % 2 === 1 && height % 2 === 1,
    brushSize: [1, 2, 3].includes(Number(data.brushSize)) ? Number(data.brushSize) : 1,
  }
}

/**
 * @param {unknown} raw
 * @param {number} width
 * @param {number} height
 */
function parseLayerNode(raw, width, height) {
  if (!raw || typeof raw !== 'object') {
    return createLayer(width, height, 'Camada')
  }
  if (raw.type === 'group') {
    const children = Array.isArray(raw.children)
      ? raw.children.map((child) => parseLayerNode(child, width, height))
      : []
    return {
      id: String(raw.id || `group-${Math.random()}`),
      type: 'group',
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Grupo',
      visible: raw.visible !== false,
      collapsed: !!raw.collapsed,
      children,
    }
  }

  const layer = createLayer(width, height, typeof raw.name === 'string' ? raw.name : 'Camada')
  if (raw.id) layer.id = String(raw.id)
  layer.visible = raw.visible !== false
  layer.offsetX = Number.isFinite(Number(raw.offsetX)) ? Number(raw.offsetX) : 0
  layer.offsetY = Number.isFinite(Number(raw.offsetY)) ? Number(raw.offsetY) : 0
  if (Array.isArray(raw.grid)) copyGrid(layer.grid, raw.grid, width, height)
  return layer
}

/**
 * @param {number[][]} target
 * @param {unknown} source
 * @param {number} width
 * @param {number} height
 */
function copyGrid(target, source, width, height) {
  for (let y = 0; y < height; y += 1) {
    const row = Array.isArray(source[y]) ? source[y] : []
    for (let x = 0; x < width; x += 1) {
      const value = Number(row[x])
      target[y][x] = Number.isFinite(value) ? value : 0
    }
  }
}

/**
 * @param {{ id: number, name: string, hex: string }} color
 */
function stripColor(color) {
  return {
    id: color.id,
    name: color.name,
    hex: color.hex,
  }
}
