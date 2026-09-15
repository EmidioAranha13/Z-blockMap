/**
 * Enquadra a câmera no mapa centralizado em (0,0,0).
 */
import { mapSpan } from '../utils/blockCoordinates.js'

/**
 * @param {import('three').PerspectiveCamera} camera
 * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} controls
 * @param {number} width
 * @param {number} height
 * @param {number} aspect
 */
export function fitCameraToMap(camera, controls, width, height, aspect) {
  const span = mapSpan(width, height)
  const dist = Math.max(8, span * 0.92)

  camera.aspect = aspect > 0 ? aspect : 1
  camera.near = 0.1
  camera.far = Math.max(400, span * 10)
  camera.position.set(dist * 0.78, dist * 0.86, dist * 0.78)
  camera.updateProjectionMatrix()

  controls.target.set(0, 0, 0)
  controls.minDistance = Math.max(3, span * 0.08)
  controls.maxDistance = Math.max(40, span * 5.5)
  controls.update()
}
