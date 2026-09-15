/** Módulo 3D Builder — voxel a partir do mapa Pixel Art + editor. */
export { usePixelMap3D } from './composables/usePixelMap3D.js'
export { useVoxelEditor } from './composables/useVoxelEditor.js'
export { createVoxelWorld } from './utils/voxelWorld.js'
export { pixelMapToBlocks } from './utils/pixelMapToBlocks.js'
export { mapCenterOffset, blockToWorld } from './utils/blockCoordinates.js'
export { blockKey } from './utils/blockKey.js'
export { VOXEL_TOOLS, WORLD_OPS } from './constants.js'
export { serializeVoxelMapFile, parseVoxelMapFile, isVoxelMapFile } from './utils/fileFormat3d.js'

export const MODULE_ID = '3d-builder'
