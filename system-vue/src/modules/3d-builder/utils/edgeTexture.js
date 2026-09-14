/**
 * Textura 1:1 por face: centro branco (multiplica a cor da instância)
 * e borda escura para separar cubos da mesma cor.
 */
import * as THREE from 'three'

const SIZE = 64
const BORDER = 5
const EDGE = '#3a3228'
const FACE = '#ffffff'

/**
 * @returns {THREE.CanvasTexture}
 */
export function createEdgeTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = EDGE
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = FACE
  ctx.fillRect(BORDER, BORDER, SIZE - BORDER * 2, SIZE - BORDER * 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
