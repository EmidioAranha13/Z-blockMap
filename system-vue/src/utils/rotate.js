import { markRaw } from 'vue'
import { rotateGrid as rotateGridShared } from '../../../shared/rotate.js'

export {
  mapPivot,
  blockAngleDeg,
  snappedRotateDegrees,
  formatRotateDegrees,
  drawingPivotFromGrids,
} from '../../../shared/rotate.js'

/**
 * Mesma rasterização do shared, sem Proxy do Vue nas células.
 */
export function rotateGrid(src, angleDeg, ox, oy) {
  return markRaw(rotateGridShared(src, angleDeg, ox, oy))
}
