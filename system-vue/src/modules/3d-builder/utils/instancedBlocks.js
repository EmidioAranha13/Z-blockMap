/**
 * InstancedMesh sincronizado com o Map do mundo.
 * Crescimento por capacidade; remoção por swap com a última instância.
 */
import * as THREE from 'three'
import { blockToWorld } from './blockCoordinates.js'
import { createEdgeTexture } from './edgeTexture.js'
import { blockKey } from './blockKey.js'

export const CUBE_SCALE = 0.985

const dummy = new THREE.Object3D()
const tint = new THREE.Color()
const copied = new THREE.Matrix4()

function nextCapacity(minCount) {
  let cap = 256
  while (cap < minCount) cap = Math.ceil(cap * 1.6)
  return cap
}

export function createVoxelInstanceLayer() {
  const offset = { x: 0, z: 0 }
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const texture = createEdgeTexture()
  const material = new THREE.MeshLambertMaterial({ map: texture })

  let capacity = 256
  let count = 0
  /** @type {string[]} */
  let keys = new Array(capacity)
  /** @type {Map<string, number>} */
  const indexByKey = new Map()

  let mesh = new THREE.InstancedMesh(geometry, material, capacity)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.name = 'voxels'
  mesh.userData.isVoxelMesh = true

  /**
   * @param {{ x: number, z: number }} next
   */
  function setOffset(next) {
    offset.x = next.x
    offset.z = next.z
  }

  function writeInstance(index, block) {
    const world = blockToWorld(block.x, block.y, block.z, offset)
    dummy.position.set(world.x, world.y, world.z)
    dummy.scale.setScalar(CUBE_SCALE)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
    tint.set(block.color)
    mesh.setColorAt(index, tint)
  }

  function flagDirty() {
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }

  /**
   * @param {THREE.Scene} scene
   * @param {number} minCount
   */
  function ensureCapacity(scene, minCount) {
    if (minCount <= capacity) return
    const next = nextCapacity(minCount)
    const neu = new THREE.InstancedMesh(geometry, material, next)
    neu.frustumCulled = false
    neu.name = 'voxels'
    neu.userData.isVoxelMesh = true
    neu.count = count
    for (let i = 0; i < count; i += 1) {
      mesh.getMatrixAt(i, copied)
      neu.setMatrixAt(i, copied)
      if (mesh.instanceColor) {
        mesh.getColorAt(i, tint)
        neu.setColorAt(i, tint)
      }
    }
    neu.instanceMatrix.needsUpdate = true
    if (neu.instanceColor) neu.instanceColor.needsUpdate = true
    if (mesh.parent) {
      mesh.parent.add(neu)
      mesh.parent.remove(mesh)
    } else if (scene) {
      scene.add(neu)
    }
    mesh = neu
    const grown = new Array(next)
    for (let i = 0; i < count; i += 1) grown[i] = keys[i]
    keys = grown
    capacity = next
  }

  /**
   * @param {Map<string, object>} blocks
   * @param {THREE.Scene} scene
   */
  function syncAll(blocks, scene) {
    ensureCapacity(scene, Math.max(blocks.size, 1))
    indexByKey.clear()
    count = 0
    for (const block of blocks.values()) {
      const key = blockKey(block.x, block.y, block.z)
      keys[count] = key
      indexByKey.set(key, count)
      writeInstance(count, block)
      count += 1
    }
    mesh.count = count
    flagDirty()
  }

  /**
   * @param {object} block
   * @param {THREE.Scene} scene
   */
  function upsert(block, scene) {
    const key = blockKey(block.x, block.y, block.z)
    const existing = indexByKey.get(key)
    if (existing != null) {
      writeInstance(existing, block)
      flagDirty()
      return
    }
    ensureCapacity(scene, count + 1)
    keys[count] = key
    indexByKey.set(key, count)
    writeInstance(count, block)
    count += 1
    mesh.count = count
    flagDirty()
  }

  /**
   * @param {string} key
   */
  function remove(key) {
    const index = indexByKey.get(key)
    if (index == null) return
    const last = count - 1
    if (index !== last) {
      mesh.getMatrixAt(last, copied)
      mesh.setMatrixAt(index, copied)
      if (mesh.instanceColor) {
        mesh.getColorAt(last, tint)
        mesh.setColorAt(index, tint)
      }
      const moved = keys[last]
      keys[index] = moved
      indexByKey.set(moved, index)
    }
    indexByKey.delete(key)
    count -= 1
    mesh.count = count
    flagDirty()
  }

  function dispose() {
    if (mesh.parent) mesh.parent.remove(mesh)
    geometry.dispose()
    material.dispose()
    texture.dispose()
  }

  function blockAtInstance(instanceId) {
    const key = keys[instanceId]
    return key || null
  }

  return {
    get mesh() {
      return mesh
    },
    setOffset,
    syncAll,
    upsert,
    remove,
    dispose,
    blockAtInstance,
  }
}
