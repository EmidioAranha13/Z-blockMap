/**
 * Plano y = 0 + malha de células do mapa (referência e clique em chão vazio).
 */
import * as THREE from 'three'

/**
 * @param {number} width
 * @param {number} height
 * @param {{ x: number, z: number }} offset
 * @param {'dark' | 'light'} theme
 */
export function createGroundGrid(width, height, offset, theme) {
  const group = new THREE.Group()
  group.name = 'ground'

  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const x0 = -offset.x - 0.5
  const z0 = -offset.z - 0.5

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      color: theme === 'light' ? 0xd9d0c0 : 0x1a1a1a,
      transparent: true,
      opacity: theme === 'light' ? 0.35 : 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  plane.rotation.x = -Math.PI / 2
  plane.position.set(0, -0.02, 0)
  plane.name = 'ground-plane'
  plane.userData.isGround = true
  group.add(plane)

  const verts = []
  const y = 0.001
  for (let z = 0; z <= h; z += 1) {
    verts.push(x0, y, z0 + z, x0 + w, y, z0 + z)
  }
  for (let x = 0; x <= w; x += 1) {
    verts.push(x0 + x, y, z0, x0 + x, y, z0 + h)
  }
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  const lines = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({
      color: theme === 'light' ? 0x6a6248 : 0x6a6a6a,
      transparent: true,
      opacity: 0.55,
    }),
  )
  lines.raycast = () => {}
  lines.name = 'ground-lines'
  group.add(lines)

  function dispose() {
    if (group.parent) group.parent.remove(group)
    plane.geometry.dispose()
    plane.material.dispose()
    lineGeo.dispose()
    lines.material.dispose()
  }

  return { group, plane, dispose }
}
