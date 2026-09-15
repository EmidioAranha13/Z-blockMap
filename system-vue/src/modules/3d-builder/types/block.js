/**
 * Bloco voxel no mundo 3D.
 *
 * @typedef {object} VoxelBlock
 * @property {number} x coluna (inteiro)
 * @property {number} y altura (inteiro, 0 = chão)
 * @property {number} z profundidade / linha da matriz 2D (inteiro)
 * @property {string} color hex #rrggbb
 * @property {number} [colorId] id da paleta Pixel Art
 * @property {string} [materialId] futuro tipo de material
 * @property {string} [blockType] 'base' | 'build' | outro
 * @property {string} [source] origem: pixel art ('base') ou editor 3D ('build')
 */

/**
 * Material de bloco (preparado para texturas futuras).
 *
 * @typedef {object} BlockMaterial
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {string} [texture]
 */

/**
 * @typedef {object} FaceNormal
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {object} VoxelHit
 * @property {'block' | 'ground'} kind
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {FaceNormal} faceNormal
 * @property {string} face
 * @property {number} [instanceId]
 */

export {}
