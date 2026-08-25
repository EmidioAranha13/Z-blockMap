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
 * Tamanho mínimo de um bloco visível (px).
 * Na câmera, o zoom 1 não encolhe abaixo disso (o mapa transborda).
 * No desenho, se a célula projetada ficar menor, o LOD agrupa vizinhas
 * até o bloco na tela voltar a ter pelo menos este tamanho.
 */
export const MIN_CELL_FOR_GRID = 6

/** Quantidade de cores fixas e de slots visíveis do histórico da roda. */
export const FIXED_COLOR_COUNT = 7
export const RECENT_COLOR_SLOTS = 7
