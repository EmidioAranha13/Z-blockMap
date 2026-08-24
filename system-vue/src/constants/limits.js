/**
 * Limites do editor.
 * Centralizados aqui para ScalePanel, histórico e o composable usarem o mesmo valor.
 */
export const MAX_GRID_SIZE = 500

/** Quantidade máxima de ações no histórico Undo/Redo (FIFO: o mais antigo sai). */
export const MAX_HISTORY = 50

/** Zoom mínimo absoluto (visão geral de mapas enormes). */
export const MIN_ZOOM = 0.05

/** Zoom máximo para inspecionar blocos individuais em mapas grandes. */
export const MAX_ZOOM = 64

/**
 * Tamanho mínimo de um bloco (px) para as linhas da grade continuarem visíveis.
 * Abaixo disso o canvas encolhia as células e a grade era omitida (~140×140+).
 */
export const MIN_CELL_FOR_GRID = 6

/** Quantidade de cores fixas e de slots visíveis do histórico da roda. */
export const FIXED_COLOR_COUNT = 7
export const RECENT_COLOR_SLOTS = 7
