/**
 * Um InstancedMesh para todos os cubos (geometria e material compartilhados,
 * cor e posição por instância).
 *
 * A lista de VoxelBlock (`pixelMapToBlocks`) existe para o modelo de dados
 * (empilhamento futuro). O preenchimento da malha percorre a grade direto
 * para não alocar dezenas de milhares de objetos no carregamento.
 */
import * as THREE from 'three'
import { getCellHex } from '@/constants/palette.js'
import { blockToWorld, mapCenterOffset } from './mapCoordinates.js'
import { createEdgeTexture } from './edgeTexture.js'
import { gridSize } from './pixelMapToBlocks.js'

/** Leve retração para evitar z-fighting entre faces coladas. */
const CUBE_SCALE = 0.985

const dummy = new THREE.Object3D()
const tint = new THREE.Color()

/**
 * @param {number[][]} grid
 * @param {Array<{ id: number, hex: string }>} colors
 * @returns {{ mesh: THREE.InstancedMesh, texture: THREE.CanvasTexture, blockCount: number }}
 */
export function createInstancedBlockMesh(grid, colors) {
  const { width, height } = gridSize(grid)
  const offset = mapCenterOffset(width, height)

  let count = 0
  for (let z = 0; z < height; z += 1) {
    const row = grid[z]
    for (let x = 0; x < width; x += 1) {
      if (row[x]) count += 1
    }
  }

  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const texture = createEdgeTexture()
  const material = new THREE.MeshLambertMaterial({
    map: texture,
  })

  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(count, 1))
  mesh.count = count
  mesh.frustumCulled = false
  mesh.castShadow = false
  mesh.receiveShadow = false

  const hexCache = new Map()
  /**
   * @param {number} id
   */
  function hexFor(id) {
    let hex = hexCache.get(id)
    if (!hex) {
      hex = getCellHex(colors, id)
      hexCache.set(id, hex)
    }
    return hex
  }

  let i = 0
  for (let z = 0; z < height; z += 1) {
    const row = grid[z]
    for (let x = 0; x < width; x += 1) {
      const colorId = row[x]
      if (!colorId) continue
      const world = blockToWorld(x, 0, z, offset)
      dummy.position.set(world.x, world.y, world.z)
      dummy.scale.setScalar(CUBE_SCALE)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      tint.set(hexFor(colorId))
      mesh.setColorAt(i, tint)
      i += 1
    }
  }

  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

  return { mesh, texture, blockCount: count }
}

/**
 * @param {{ mesh: THREE.InstancedMesh, texture: THREE.Texture } | null} bundle
 */
export function disposeInstancedBlockMesh(bundle) {
  if (!bundle) return
  bundle.mesh.geometry.dispose()
  if (Array.isArray(bundle.mesh.material)) {
    bundle.mesh.material.forEach((item) => item.dispose())
  } else {
    bundle.mesh.material.dispose()
  }
  bundle.texture.dispose()
}
