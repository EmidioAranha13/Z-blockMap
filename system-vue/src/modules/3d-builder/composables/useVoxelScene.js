/**
 * Cena Three.js: cubos instanciados, OrbitControls e iluminação básica.
 * Um único componente Vue dono do canvas — nenhum cubo vira componente.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { onUnmounted, watch } from 'vue'
import { THEME_CANVAS } from '@/constants/palette.js'
import { fitCameraToMap } from './useCameraFit.js'
import { createInstancedBlockMesh, disposeInstancedBlockMesh } from '../utils/instancedBlocks.js'
import { gridSize } from '../utils/pixelMapToBlocks.js'

/**
 * @param {import('vue').Ref<HTMLCanvasElement | null>} canvasRef
 * @param {object} props
 * @param {number[][]} props.grid
 * @param {Array<{ id: number, hex: string }>} props.colors
 * @param {'dark' | 'light'} props.theme
 * @param {number} props.sceneTick
 */
export function useVoxelScene(canvasRef, props) {
  /** @type {THREE.WebGLRenderer | null} */
  let renderer = null
  /** @type {THREE.Scene | null} */
  let scene = null
  /** @type {THREE.PerspectiveCamera | null} */
  let camera = null
  /** @type {OrbitControls | null} */
  let controls = null
  /** @type {{ mesh: THREE.InstancedMesh, texture: THREE.Texture } | null} */
  let blocks = null
  let raf = 0
  let resizeObserver = null

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

  function rebuildMesh() {
    if (!scene) return
    if (blocks) {
      scene.remove(blocks.mesh)
      disposeInstancedBlockMesh(blocks)
      blocks = null
    }
    const bundle = createInstancedBlockMesh(props.grid, props.colors)
    blocks = bundle
    scene.add(bundle.mesh)

    const { width, height } = gridSize(props.grid)
    const { width: vw, height: vh } = viewSize()
    if (camera && controls) {
      fitCameraToMap(camera, controls, width, height, vw / vh)
    }
  }

  function tick() {
    raf = requestAnimationFrame(tick)
    if (controls) controls.update()
    if (renderer && scene && camera) renderer.render(scene, camera)
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
    controls.target.set(0, 0, 0)

    mountLights(scene)
    rebuildMesh()
    resize()

    const parent = canvas.parentElement || canvas
    resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(parent)

    tick()
  }

  function dispose() {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    if (controls) {
      controls.dispose()
      controls = null
    }
    if (blocks && scene) {
      scene.remove(blocks.mesh)
      disposeInstancedBlockMesh(blocks)
      blocks = null
    }
    if (renderer) {
      renderer.dispose()
      renderer = null
    }
    scene = null
    camera = null
  }

  watch(
    () => props.sceneTick,
    () => {
      if (!renderer) {
        mount()
        return
      }
      rebuildMesh()
    },
    { flush: 'post' },
  )

  watch(
    () => props.theme,
    (theme) => {
      applyTheme(theme)
      if (renderer) renderer.setClearColor(backgroundHex(theme), 1)
    },
  )

  onUnmounted(dispose)

  return { mount, dispose }
}
