/**
 * Bloco voxel derivado de um pixel do mapa 2D.
 *
 * x/z = coluna/linha da matriz; y = índice de altura (MVP = 0).
 * Vários blocos podem ocupar o mesmo (x, z) com y diferentes.
 *
 * @typedef {object} VoxelBlock
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {string} color hex #rrggbb
 * @property {number} [colorId] id da paleta (0 = vazio, não vira bloco)
 * @property {string} [blockType]
 */

export {}
