/**
 * Cena Three.js do editor voxel: InstancedMesh, grid, raycast, overlays.
 * Regras de add/remove ficam no mundo + useVoxelEditor.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { onUnmounted, watch } from 'vue'
import { canvasToPngBase64 } from '@/utils/libraryApi.js'
import { THEME_CANVAS } from '@/constants/palette.js'
import { CLICK_DRAG_PX, VOXEL_TOOLS, WORLD_OPS } from '../constants.js'
import { fitCameraToMap } from './useCameraFit.js'
import { createVoxelInstanceLayer } from '../utils/instancedBlocks.js'
import { createGroundGrid } from '../utils/groundGrid.js'
import { parseBlockKey } from '../utils/blockKey.js'
import {
  blockToWorld,
  faceNameFromNormal,
  snapFaceNormal,
  worldToGroundCell,
} from '../utils/blockCoordinates.js'

/**
 * @param {import('vue').Ref<HTMLCanvasElement | null>} canvasRef
 * @param {object} props
 * @param {ReturnType<import('../utils/voxelWorld.js').createVoxelWorld>} props.world
 * @param {string} props.tool
 * @param {string} props.activeColor
 * @param {object | null} props.selected
 * @param {'dark' | 'light'} props.theme
 * @param {boolean} [props.viewOnly]
 * @param {(event: string, payload?: unknown) => void} emit
 */
export function useVoxelScene(canvasRef, props, emit) {
  /** @type {THREE.WebGLRenderer | null} */
  let renderer = null
  /** @type {THREE.Scene | null} */
  let scene = null
  /** @type {THREE.PerspectiveCamera | null} */
  let camera = null
  /** @type {OrbitControls | null} */
  let controls = null
  let layer = null
  let ground = null
  let raf = 0
  let resizeObserver = null
  let unsubWorld = null

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const localNormal = new THREE.Vector3()

  let hoverMesh = null
  let previewMesh = null
  let selectedLines = null
  /** @type {object | null} */
  let lastHit = null
  let pointerDown = null
  let dragged = false
  let hoverRaf = 0
  /** @type {PointerEvent | null} */
  let pendingHover = null

  function backgroundHex(theme) {
    return theme === 'light' ? THEME_CANVAS.light.background : '#0c0c0c'
  }

  function applyTheme(theme) {
    if (!scene) return
    scene.background = new THREE.Color(backgroundHex(theme))
  }

  function viewSize() {
    const canvas = canvasRef.value
    if (!canvas) return { width: 1, height: 1 }
    const parent = canvas.parentElement || canvas
    const rect = parent.getBoundingClientRect()
    return {
      width: Math.max(1, Math.floor(rect.width)),
      height: Math.max(1, Math.floor(rect.height)),
    }
  }

  function resize() {
    if (!renderer || !camera || !canvasRef.value) return
    const { width, height } = viewSize()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    renderer.setPixelRatio(dpr)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  function placeCell(object, x, y, z, scale = 1) {
    const world = blockToWorld(x, y, z, props.world.offset)
    object.position.set(world.x, world.y, world.z)
    object.scale.setScalar(scale)
  }

  function updateOverlays() {
    if (!hoverMesh || !previewMesh || !selectedLines) return
    const hit = lastHit
    const tool = props.tool

    hoverMesh.visible = false
    previewMesh.visible = false

    if (hit && hit.kind === 'block' && tool === VOXEL_TOOLS.REMOVE) {
      placeCell(hoverMesh, hit.x, hit.y, hit.z, 1.04)
      hoverMesh.material.color.set('#c45c4a')
      hoverMesh.material.opacity = 0.38
      hoverMesh.visible = true
    } else if (hit && hit.kind === 'block' && tool === VOXEL_TOOLS.SELECT) {
      placeCell(hoverMesh, hit.x, hit.y, hit.z, 1.03)
      hoverMesh.material.color.set('#f4e6c5')
      hoverMesh.material.opacity = 0.22
      hoverMesh.visible = true
    }

    if (tool === VOXEL_TOOLS.ADD && hit) {
      const addPos = emitAddTarget(hit)
      if (addPos) {
        placeCell(previewMesh, addPos.x, addPos.y, addPos.z, 0.985)
        previewMesh.material.color.set(props.activeColor || '#c4a35a')
        previewMesh.visible = true
      }
    }

    if (props.selected) {
      placeCell(selectedLines, props.selected.x, props.selected.y, props.selected.z, 1.06)
      selectedLines.visible = true
    } else {
      selectedLines.visible = false
    }
  }

  function emitAddTarget(hit) {
    if (hit.kind === 'ground') {
      const pos = { x: hit.x, y: 0, z: hit.z }
      if (!props.world.inBounds(pos.x, pos.y, pos.z) || props.world.has(pos.x, pos.y, pos.z)) {
        return null
      }
      return pos
    }
    const pos = {
      x: hit.x + hit.faceNormal.x,
      y: hit.y + hit.faceNormal.y,
      z: hit.z + hit.faceNormal.z,
    }
    if (!props.world.inBounds(pos.x, pos.y, pos.z) || props.world.has(pos.x, pos.y, pos.z)) {
      return null
    }
    return pos
  }

  function pick(event) {
    const canvas = canvasRef.value
    if (!canvas || !camera || !layer) return null
    const rect = canvas.getBoundingClientRect()
    const w = rect.width || 1
    const h = rect.height || 1
    ndc.x = ((event.clientX - rect.left) / w) * 2 - 1
    ndc.y = -((event.clientY - rect.top) / h) * 2 + 1
    raycaster.setFromCamera(ndc, camera)

    const targets = []
    if (layer.mesh.count > 0) targets.push(layer.mesh)
    if (ground) targets.push(ground.plane)
    if (!targets.length) return null

    const hits = raycaster.intersectObjects(targets, false)
    if (!hits.length) return null
    const hit = hits[0]
    if (hit.object.userData.isVoxelMesh && hit.instanceId != null && hit.face) {
      const key = layer.blockAtInstance(hit.instanceId)
      const pos = key ? parseBlockKey(key) : null
      if (!pos) return null
      localNormal.copy(hit.face.normal)
      const n = snapFaceNormal(localNormal)
      return {
        kind: 'block',
        x: pos.x,
        y: pos.y,
        z: pos.z,
        faceNormal: n,
        face: faceNameFromNormal(n),
        instanceId: hit.instanceId,
      }
    }
    if (hit.object.userData.isGround) {
      const cell = worldToGroundCell(hit.point.x, hit.point.z, props.world.offset)
      const maxX = Math.max(0, props.world.width - 1)
      const maxZ = Math.max(0, props.world.height - 1)
      return {
        kind: 'ground',
        x: Math.max(0, Math.min(maxX, cell.x)),
        y: 0,
        z: Math.max(0, Math.min(maxZ, cell.z)),
        faceNormal: { x: 0, y: 1, z: 0 },
        face: 'TOP',
      }
    }
    return null
  }

  function applyHover(event) {
    if (props.viewOnly) return
    lastHit = pick(event)
    emit('hover', lastHit)
    updateOverlays()
  }

  function onPointerMove(event) {
    if (pointerDown && event.buttons) {
      const dx = event.clientX - pointerDown.x
      const dy = event.clientY - pointerDown.y
      if (dx * dx + dy * dy > CLICK_DRAG_PX * CLICK_DRAG_PX) dragged = true
    }
    pendingHover = event
    if (hoverRaf) return
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0
      if (pendingHover) applyHover(pendingHover)
    })
  }

  function onPointerDown(event) {
    if (event.button !== 0) return
    pointerDown = { x: event.clientX, y: event.clientY }
    dragged = false
  }

  function onPointerUp(event) {
    if (event.button !== 0) {
      pointerDown = null
      return
    }
    const wasDrag = dragged
    pointerDown = null
    dragged = false
    if (wasDrag) return
    if (props.viewOnly) return
    emit('edit', pick(event))
    lastHit = pick(event)
    updateOverlays()
    emit('hover', lastHit)
  }

  function onPointerLeave() {
    pointerDown = null
    if (props.viewOnly) return
    lastHit = null
    emit('hover', null)
    updateOverlays()
  }

  function bindPointer(canvas) {
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('contextmenu', onContextMenu)
  }

  function unbindPointer(canvas) {
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointerleave', onPointerLeave)
    canvas.removeEventListener('contextmenu', onContextMenu)
  }

  function onContextMenu(event) {
    event.preventDefault()
  }

  function makeOverlays() {
    hoverMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: '#f4e6c5',
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    )
    hoverMesh.raycast = () => {}
    hoverMesh.visible = false

    previewMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({
        color: props.activeColor || '#c4a35a',
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    )
    previewMesh.raycast = () => {}
    previewMesh.visible = false

    selectedLines = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: '#c4a35a', linewidth: 2 }),
    )
    selectedLines.raycast = () => {}
    selectedLines.visible = false

    scene.add(hoverMesh, previewMesh, selectedLines)
  }

  function disposeOverlays() {
    for (const obj of [hoverMesh, previewMesh, selectedLines]) {
      if (!obj) continue
      if (obj.parent) obj.parent.remove(obj)
      obj.geometry.dispose()
      obj.material.dispose()
    }
    hoverMesh = null
    previewMesh = null
    selectedLines = null
  }

  function rebuildGround() {
    if (ground) {
      ground.dispose()
      ground = null
    }
    if (!scene) return
    ground = createGroundGrid(props.world.width, props.world.height, props.world.offset, props.theme)
    scene.add(ground.group)
  }

  function onWorldOp(op) {
    if (!layer || !scene) return
    if (op.type === WORLD_OPS.RESET) {
      layer.setOffset(props.world.offset)
      layer.syncAll(props.world.blocks, scene)
      rebuildGround()
      return
    }
    if (op.type === WORLD_OPS.ADD_BLOCK) layer.upsert(op.block, scene)
    if (op.type === WORLD_OPS.REMOVE_BLOCK) layer.remove(op.key)
  }

  function mountLights(target) {
    const ambient = new THREE.AmbientLight(0xffffff, 0.62)
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3d3a32, 0.42)
    const key = new THREE.DirectionalLight(0xfff6e8, 0.9)
    key.position.set(0.55, 1.15, 0.4)
    const fill = new THREE.DirectionalLight(0xb8c8e0, 0.28)
    fill.position.set(-0.7, 0.35, -0.45)
    target.add(ambient, hemi, key, fill)
  }

  function tick() {
    raf = requestAnimationFrame(tick)
    if (controls) controls.update()
    if (renderer && scene && camera) renderer.render(scene, camera)
  }

  function mount() {
    const canvas = canvasRef.value
    if (!canvas || renderer) return

    scene = new THREE.Scene()
    applyTheme(props.theme)

    const { width, height } = viewSize()
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000)

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(backgroundHex(props.theme), 1)
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setSize(width, height, false)

    controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = true
    controls.screenSpacePanning = true
    controls.minPolarAngle = 0
    controls.maxPolarAngle = Math.PI
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    }

    mountLights(scene)
    if (!props.viewOnly) makeOverlays()

    layer = createVoxelInstanceLayer()
    layer.setOffset(props.world.offset)
    scene.add(layer.mesh)
    layer.syncAll(props.world.blocks, scene)
    rebuildGround()

    const { width: vw, height: vh } = viewSize()
    fitCameraToMap(camera, controls, props.world.width, props.world.height, vw / vh)

    unsubWorld = props.world.subscribe(onWorldOp)
    bindPointer(canvas)

    const parent = canvas.parentElement || canvas
    resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(parent)
    resize()
    tick()
  }

  function dispose() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    if (hoverRaf) cancelAnimationFrame(hoverRaf)
    hoverRaf = 0
    if (unsubWorld) {
      unsubWorld()
      unsubWorld = null
    }
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    const canvas = canvasRef.value
    if (canvas) unbindPointer(canvas)
    if (controls) {
      controls.dispose()
      controls = null
    }
    disposeOverlays()
    if (ground) {
      ground.dispose()
      ground = null
    }
    if (layer) {
      layer.dispose()
      layer = null
    }
    if (renderer) {
      renderer.dispose()
      renderer = null
    }
    scene = null
    camera = null
  }

  watch(
    () => props.theme,
    (theme) => {
      applyTheme(theme)
      if (renderer) renderer.setClearColor(backgroundHex(theme), 1)
      rebuildGround()
    },
  )

  watch(
    () => [props.tool, props.activeColor, props.selected],
    () => updateOverlays(),
  )

  function capturePngBase64() {
    if (!renderer || !scene || !camera) return ''
    const hidden = []
    for (const overlay of [hoverMesh, previewMesh, selectedLines]) {
      if (!overlay) continue
      hidden.push([overlay, overlay.visible])
      overlay.visible = false
    }
    renderer.render(scene, camera)
    const png = canvasToPngBase64(renderer.domElement)
    for (const [overlay, visible] of hidden) overlay.visible = visible
    return png
  }

  onUnmounted(dispose)

  return { mount, dispose, capturePngBase64 }
}
