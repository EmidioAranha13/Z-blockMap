/**
 * Composable central do editor de mapas.
 *
 * Grade do cartesiano, camadas/grupos, ferramentas, cores, preview e Undo/Redo.
 */
import { computed, reactive, ref, watch } from 'vue'
import { cloneFixedColors, findColor, normalizeHex } from '@/constants/palette.js'
import { MAX_GRID_SIZE, MAX_HISTORY, RECENT_COLOR_SLOTS } from '@/constants/limits.js'
import { TOOLS, getToolMeta, isStampTool } from '@/constants/tools.js'
import { downloadBlob, readTextFile } from '@/utils/download.js'
import { renderMapToCanvas } from '@/utils/drawMap.js'
import { FILE_EXTENSION, parseMapFile, serializeMapFile } from '@/utils/fileFormat.js'
import { safeFileName } from '@/utils/fileName.js'
import { blockKey, withMirrorX } from '@/utils/coords.js'
import { applyCells, clearGrid, getGridSize, inBounds, floodFillCells, setCell } from '@/utils/grid.js'
import { createHistory } from '@/utils/history.js'
import {
  cloneLayerTree,
  cloneNodeDeep,
  insertNodeAfter,
  flipNodeGrids,
  compositeLayerTree,
  countLayers,
  createGroup,
  createLayer,
  findNode,
  forEachLayer,
  bakeLayerOffset,
  bakeTreeOffsets,
  moveNodeAmongSiblings,
  removeNode,
  resizeLayerTree,
  setTreeVisible,
} from '@/utils/layers.js'
import { expandBrush, getLineCells, getPerfectShapeCells, getShapeCells } from '@/utils/shapes.js'

const DEFAULT_WIDTH = 24
const DEFAULT_HEIGHT = 16
const CUSTOM_ID_START = 100

/**
 * Cria o estado e as ações do editor.
 */
export function useMapEditor() {
  const mapName = ref('Mapa sem nome')
  const mapWidth = ref(DEFAULT_WIDTH)
  const mapHeight = ref(DEFAULT_HEIGHT)
  const scaleLocked = ref(false)
  const centerCellAxes = ref(false)
  const scaleInput = reactive({
    x: DEFAULT_WIDTH,
    y: DEFAULT_HEIGHT,
  })

  const layerTree = ref([createLayer(DEFAULT_WIDTH, DEFAULT_HEIGHT, 'Camada 1')])
  const activeNodeId = ref(layerTree.value[0].id)
  /** Incrementado a cada mudança visual da cena (força o composite). */
  const sceneTick = ref(0)

  const activeTool = ref(TOOLS.PENCIL)
  const fillShapes = ref(false)
  const mirrorX = ref(false)
  const brushSize = ref(1)
  const hoverBlock = ref(null)
  const previewCells = ref([])
  const paintDabs = ref([])
  const strokeOrigin = ref(null)
  const isDrawing = ref(false)
  const visitedInStroke = new Set()
  /** Último bloco do pincel/borracha neste traço (para interpolar pulos do mouse). */
  let stampLast = null

  const moveOrigin = ref(null)
  const moveBaseOffsets = ref([])

  const fixedColors = ref(cloneFixedColors())
  const customColors = ref([])
  const selectedColor = ref(1)
  let nextCustomId = CUSTOM_ID_START

  const fileMessage = ref('')
  const canUndo = ref(false)
  const canRedo = ref(false)

  function captureHistory() {
    return {
      layerTree: cloneLayerTree(layerTree.value),
      width: mapWidth.value,
      height: mapHeight.value,
      scaleLocked: scaleLocked.value,
      centerCellAxes: centerCellAxes.value,
      activeNodeId: activeNodeId.value,
    }
  }

  /**
   * Restaura um snapshot. Cópia nova para não mutar o histórico.
   * A escala entra no snapshot: sem ela o cartesiano ficava grande e a
   * grade da camada pequena, e o pincel caía fora do array.
   */
  function restoreHistory(snapshot) {
    const treeSource = Array.isArray(snapshot) ? snapshot : snapshot.layerTree
    const tree = cloneLayerTree(treeSource)
    layerTree.value = tree

    let width
    let height
    if (!Array.isArray(snapshot) && snapshot.width && snapshot.height) {
      width = snapshot.width
      height = snapshot.height
      scaleLocked.value = snapshot.scaleLocked
      centerCellAxes.value = snapshot.centerCellAxes
      activeNodeId.value = snapshot.activeNodeId
    } else {
      const first = firstLayer(tree)
      const size = first ? getGridSize(first.grid) : { width: mapWidth.value, height: mapHeight.value }
      width = size.width
      height = size.height
    }

    mapWidth.value = width
    mapHeight.value = height
    scaleInput.x = width
    scaleInput.y = height

    if (!findNode(layerTree.value, activeNodeId.value)) {
      const first = firstLayer(layerTree.value)
      activeNodeId.value = first ? first.id : ''
    }

    paintDabs.value = []
    cancelStroke()
    sceneTick.value += 1
  }

  const history = createHistory(MAX_HISTORY, captureHistory, restoreHistory)

  function syncHistoryFlags() {
    canUndo.value = history.canUndo()
    canRedo.value = history.canRedo()
  }

  function recordHistory() {
    history.record()
    syncHistoryFlags()
  }

  function bumpScene() {
    sceneTick.value += 1
  }

  const gridSize = computed(() => ({
    width: mapWidth.value,
    height: mapHeight.value,
  }))

  const grid = computed(() => {
    sceneTick.value
    return compositeLayerTree(layerTree.value, mapWidth.value, mapHeight.value)
  })

  const activeNode = computed(() => findNode(layerTree.value, activeNodeId.value))
  const activeLayer = computed(() => {
    const node = activeNode.value
    return node && node.type === 'layer' ? node : null
  })

  const activeToolMeta = computed(() => getToolMeta(activeTool.value))
  const allColors = computed(() => [...fixedColors.value, ...customColors.value])
  const selectedColorInfo = computed(() => findColor(allColors.value, selectedColor.value))
  const recentCustom = computed(() => customColors.value.slice(0, RECENT_COLOR_SLOTS))
  const extraCustom = computed(() => customColors.value.slice(RECENT_COLOR_SLOTS))

  watch(scaleLocked, (on) => {
    if (on) scaleInput.y = scaleInput.x
  })

  /**
   * Primeira camada-folha da árvore.
   * @param {Array} nodes
   */
  function firstLayer(nodes) {
    for (const node of nodes) {
      if (node.type === 'layer') return node
      const nested = firstLayer(node.children || [])
      if (nested) return nested
    }
    return null
  }

  /**
   * Converte bloco do cartesiano para a grade da camada (considera o offset).
   * @param {object} layer
   * @param {number} wx
   * @param {number} wy
   */
  function toLocal(layer, wx, wy) {
    return { x: wx - layer.offsetX, y: wy - layer.offsetY }
  }

  /**
   * Quando o cadeado está ligado, Y acompanha X (mapa quadrado).
   * @param {'x' | 'y'} axis
   * @param {number} value
   */
  function onScaleField(axis, value) {
    scaleInput[axis] = value
    if (scaleLocked.value) {
      scaleInput.y = scaleInput.x
    }
  }

  function toggleScaleLock() {
    scaleLocked.value = !scaleLocked.value
    if (scaleLocked.value) {
      scaleInput.y = scaleInput.x
    }
  }

  /**
   * Aplica a escala (1–500) em todas as camadas.
   */
  function applyScale() {
    let width = Math.min(MAX_GRID_SIZE, Math.max(1, Math.floor(Number(scaleInput.x))))
    let height = Math.min(MAX_GRID_SIZE, Math.max(1, Math.floor(Number(scaleInput.y))))
    if (scaleLocked.value) height = width
    if (!Number.isFinite(width) || !Number.isFinite(height)) return

    scaleInput.x = width
    scaleInput.y = height
    if (width % 2 === 0 || height % 2 === 0) {
      centerCellAxes.value = false
    }
    recordHistory()
    mapWidth.value = width
    mapHeight.value = height
    resizeLayerTree(layerTree.value, width, height)
    previewCells.value = []
    hoverBlock.value = null
    bumpScene()
  }

  function setTool(toolId) {
    activeTool.value = toolId
    cancelStroke()
  }

  function setBrushSize(size) {
    const next = Number(size)
    if (![1, 2, 3].includes(next)) return
    brushSize.value = next
  }

  function setColor(colorId) {
    if (!findColor(allColors.value, colorId) && colorId !== 0) return
    selectedColor.value = colorId
  }

  function commitWheelColor(hex) {
    const normalized = normalizeHex(hex)
    if (!normalized) return

    const existing = customColors.value.find((item) => item.hex === normalized)
    if (existing) {
      customColors.value = [
        existing,
        ...customColors.value.filter((item) => item.id !== existing.id),
      ]
      selectedColor.value = existing.id
      return
    }

    const color = {
      id: nextCustomId,
      name: `Cor ${customColors.value.length + 1}`,
      hex: normalized,
      source: 'custom',
    }
    nextCustomId += 1
    customColors.value = [color, ...customColors.value]
    selectedColor.value = color.id
  }

  function renameColor(colorId, name) {
    const color = findColor(allColors.value, colorId)
    if (!color) return
    color.name = name.slice(0, 32)
    bumpColorLists()
  }

  function recolor(colorId, hex) {
    if (colorId === 0) return
    const normalized = normalizeHex(hex)
    if (!normalized) return
    const color = findColor(allColors.value, colorId)
    if (!color) return
    color.hex = normalized
    bumpColorLists()
  }

  function bumpColorLists() {
    fixedColors.value = fixedColors.value.slice()
    customColors.value = customColors.value.slice()
  }

  function clearMap() {
    const node = activeNode.value
    if (!node) return
    recordHistory()
    forEachLayer(node, (layer) => {
      clearGrid(layer.grid, 0)
    })
    previewCells.value = []
    bumpScene()
  }

  function setHover(block) {
    hoverBlock.value = block
  }

  function refreshShapePreview(current) {
    if (!strokeOrigin.value) {
      previewCells.value = []
      return
    }
    previewCells.value = withMirrorX(
      getShapeCells(
        activeTool.value,
        strokeOrigin.value,
        current,
        fillShapes.value,
        mapWidth.value,
        mapHeight.value,
        brushSize.value,
      ),
      mapWidth.value,
      mirrorX.value,
      centerCellAxes.value,
    )
  }

  /**
   * Pinta ou apaga o carimbo do pincel na camada ativa, em coords do mundo.
   * Acrescenta em `dabs` só os blocos realmente gravados.
   */
  function stampBrush(layer, wx, wy, color, dabs) {
    const size = brushSize.value
    if (size === 1 && !mirrorX.value) {
      const lx = wx - layer.offsetX
      const ly = wy - layer.offsetY
      const key = blockKey(lx, ly)
      if (visitedInStroke.has(key)) return
      if (!inBounds(layer.grid, lx, ly)) return
      visitedInStroke.add(key)
      layer.grid[ly][lx] = color
      dabs.push({ x: wx, y: wy, color })
      return
    }
    const stamps = withMirrorX(
      expandBrush([{ x: wx, y: wy }], size),
      mapWidth.value,
      mirrorX.value,
      centerCellAxes.value,
    )
    for (const world of stamps) {
      const local = toLocal(layer, world.x, world.y)
      const key = blockKey(local.x, local.y)
      if (visitedInStroke.has(key)) continue
      if (!inBounds(layer.grid, local.x, local.y)) continue
      visitedInStroke.add(key)
      layer.grid[local.y][local.x] = color
      dabs.push({ x: world.x, y: world.y, color })
    }
  }

  function flushDabs(dabs) {
    if (dabs.length) paintDabs.value = dabs
  }

  function stampColor() {
    return activeTool.value === TOOLS.ERASER ? 0 : selectedColor.value
  }

  function beginStroke(block) {
    isDrawing.value = true
    strokeOrigin.value = { ...block }
    visitedInStroke.clear()

    if (activeTool.value === TOOLS.MOVE) {
      const node = activeNode.value
      if (!node) return
      recordHistory()
      moveOrigin.value = { ...block }
      const bases = []
      forEachLayer(node, (layer) => {
        bases.push({ id: layer.id, x: layer.offsetX, y: layer.offsetY })
      })
      moveBaseOffsets.value = bases
      return
    }

    const layer = activeLayer.value
    if (!layer) {
      fileMessage.value = 'Selecione uma camada para desenhar.'
      cancelStroke()
      return
    }

    if (isStampTool(activeTool.value)) {
      recordHistory()
      stampLast = { x: block.x, y: block.y }
      const dabs = []
      stampBrush(layer, block.x, block.y, stampColor(), dabs)
      flushDabs(dabs)
      previewCells.value = []
      return
    }

    if (activeTool.value === TOOLS.FILL) {
      const local = toLocal(layer, block.x, block.y)
      const cells = floodFillCells(layer.grid, local.x, local.y, selectedColor.value)
      if (cells.length === 0) return
      recordHistory()
      const worlds = cells.map((cell) => ({
        x: cell.x + layer.offsetX,
        y: cell.y + layer.offsetY,
      }))
      const mirrored = withMirrorX(worlds, mapWidth.value, mirrorX.value, centerCellAxes.value)
      const locals = []
      for (const world of mirrored) {
        const at = toLocal(layer, world.x, world.y)
        if (inBounds(layer.grid, at.x, at.y)) locals.push(at)
      }
      applyCells(layer.grid, locals, selectedColor.value)
      previewCells.value = []
      bumpScene()
      return
    }

    refreshShapePreview(block)
  }

  function continueStroke(block) {
    if (!isDrawing.value) return

    if (activeTool.value === TOOLS.MOVE) {
      if (!moveOrigin.value) return
      const dx = block.x - moveOrigin.value.x
      const dy = block.y - moveOrigin.value.y
      for (const base of moveBaseOffsets.value) {
        const layer = findNode(layerTree.value, base.id)
        if (layer && layer.type === 'layer') {
          layer.offsetX = base.x + dx
          layer.offsetY = base.y + dy
        }
      }
      bumpScene()
      return
    }

    const layer = activeLayer.value
    if (!layer) return

    if (isStampTool(activeTool.value)) {
      const points = Array.isArray(block) ? block : [block]
      const color = stampColor()
      const dabs = []
      for (const point of points) {
        if (stampLast && stampLast.x === point.x && stampLast.y === point.y) continue
        const from = stampLast || point
        const jumped = Math.abs(point.x - from.x) > 1 || Math.abs(point.y - from.y) > 1
        if (jumped) {
          const path = getLineCells(from.x, from.y, point.x, point.y)
          for (const cell of path) stampBrush(layer, cell.x, cell.y, color, dabs)
        } else {
          stampBrush(layer, point.x, point.y, color, dabs)
        }
        stampLast = { x: point.x, y: point.y }
      }
      flushDabs(dabs)
      return
    }

    if (activeTool.value === TOOLS.FILL) return

    refreshShapePreview(block)
  }

  function endStroke() {
    if (!isDrawing.value) return

    if (activeTool.value === TOOLS.MOVE) {
      for (const base of moveBaseOffsets.value) {
        const layer = findNode(layerTree.value, base.id)
        if (layer && layer.type === 'layer') bakeLayerOffset(layer)
      }
      bumpScene()
      cancelStroke()
      return
    }

    if (activeTool.value === TOOLS.FILL) {
      cancelStroke()
      return
    }

    if (isStampTool(activeTool.value)) {
      bumpScene()
      paintDabs.value = []
      cancelStroke()
      return
    }

    const layer = activeLayer.value
    if (layer && !isStampTool(activeTool.value) && previewCells.value.length > 0) {
      recordHistory()
      const locals = []
      for (const world of previewCells.value) {
        const local = toLocal(layer, world.x, world.y)
        if (inBounds(layer.grid, local.x, local.y)) locals.push(local)
      }
      applyCells(layer.grid, locals, selectedColor.value)
      bumpScene()
    }

    cancelStroke()
  }

  function cancelStroke() {
    isDrawing.value = false
    strokeOrigin.value = null
    previewCells.value = []
    visitedInStroke.clear()
    stampLast = null
    moveOrigin.value = null
    moveBaseOffsets.value = []
  }

  /**
   * Forma centrada na origem: escala, espessura em blocos e orientação do contorno.
   * @param {{ tool: string, x: number, y: number, thickness: number, orientation: string }} opts
   */
  function stampPerfectShape(opts) {
    const layer = activeLayer.value
    if (!layer) {
      fileMessage.value = 'Selecione uma camada para desenhar.'
      return
    }

    const worlds = withMirrorX(
      getPerfectShapeCells({
        tool: opts.tool,
        cols: mapWidth.value,
        rows: mapHeight.value,
        sizeX: opts.x,
        sizeY: opts.y,
        centerCellAxes: centerCellAxes.value,
        filled: fillShapes.value,
        thickness: opts.thickness,
        orientation: opts.orientation,
      }),
      mapWidth.value,
      mirrorX.value,
      centerCellAxes.value,
    )
    if (worlds.length === 0) return

    recordHistory()
    const locals = []
    for (const world of worlds) {
      const local = toLocal(layer, world.x, world.y)
      if (inBounds(layer.grid, local.x, local.y)) locals.push(local)
    }
    applyCells(layer.grid, locals, selectedColor.value)
    bumpScene()
    fileMessage.value = 'Forma perfeita criada.'
  }

  function selectNode(id) {
    activeNodeId.value = id
  }

  function addLayer() {
    recordHistory()
    const node = activeNode.value
    const layer = createLayer(mapWidth.value, mapHeight.value, `Camada ${countLayers(layerTree.value) + 1}`)
    if (node && node.type === 'group') {
      node.children = [...node.children, layer]
      layerTree.value = layerTree.value.slice()
    } else {
      layerTree.value = [...layerTree.value, layer]
    }
    activeNodeId.value = layer.id
    bumpScene()
  }

  function addGroup() {
    recordHistory()
    const group = createGroup(`Grupo ${layerTree.value.length + 1}`)
    layerTree.value = [...layerTree.value, group]
    activeNodeId.value = group.id
    bumpScene()
  }

  /**
   * Envolve o nó selecionado em um grupo novo (se ainda não for a raiz única).
   */
  function groupSelection() {
    const id = activeNodeId.value
    const index = layerTree.value.findIndex((node) => node.id === id)
    if (index < 0) {
      fileMessage.value = 'Agrupe a partir da lista raiz, ou crie um grupo e adicione camadas nele.'
      return
    }
    recordHistory()
    const [node] = layerTree.value.splice(index, 1)
    const group = createGroup('Grupo', [node])
    layerTree.value.splice(index, 0, group)
    layerTree.value = layerTree.value.slice()
    activeNodeId.value = group.id
    bumpScene()
  }

  function deleteNode() {
    if (countLayers(layerTree.value) <= 1 && activeLayer.value) {
      fileMessage.value = 'O mapa precisa de ao menos uma camada.'
      return
    }
    const id = activeNodeId.value
    if (!id) return
    recordHistory()
    removeNode(layerTree.value, id)
    layerTree.value = layerTree.value.slice()
    const first = firstLayer(layerTree.value)
    if (!first) {
      const layer = createLayer(mapWidth.value, mapHeight.value, 'Camada 1')
      layerTree.value = [layer]
      activeNodeId.value = layer.id
    } else {
      activeNodeId.value = first.id
    }
    bumpScene()
  }

  function toggleNodeVisible(id) {
    const node = findNode(layerTree.value, id)
    if (!node) return
    recordHistory()
    setTreeVisible(node, !node.visible)
    bumpScene()
  }

  function renameNode(id, name) {
    const node = findNode(layerTree.value, id)
    if (!node) return
    node.name = String(name).slice(0, 40)
    bumpScene()
  }

  function shiftNode(dir) {
    recordHistory()
    moveNodeAmongSiblings(layerTree.value, activeNodeId.value, dir)
    layerTree.value = layerTree.value.slice()
    bumpScene()
  }

  function duplicateNode() {
    const node = activeNode.value
    if (!node) {
      fileMessage.value = 'Selecione uma camada ou grupo para duplicar.'
      return
    }
    recordHistory()
    const copy = cloneNodeDeep(node)
    if (!insertNodeAfter(layerTree.value, node.id, copy)) {
      layerTree.value = [...layerTree.value, copy]
    }
    layerTree.value = layerTree.value.slice()
    activeNodeId.value = copy.id
    bumpScene()
  }

  /**
   * @param {'h' | 'v'} axis
   */
  function flipActiveLayer(axis) {
    const node = activeNode.value
    if (!node) {
      fileMessage.value = 'Selecione uma camada para inverter.'
      return
    }
    recordHistory()
    flipNodeGrids(node, axis)
    bumpScene()
  }

  function toggleGroupCollapsed(id) {
    const node = findNode(layerTree.value, id)
    if (!node || node.type !== 'group') return
    node.collapsed = !node.collapsed
    bumpScene()
  }

  function undo() {
    if (!history.undo()) return
    previewCells.value = []
    syncHistoryFlags()
  }

  function redo() {
    if (!history.redo()) return
    previewCells.value = []
    syncHistoryFlags()
  }

  function saveMapFile() {
    const payload = serializeMapFile({
      mapName: mapName.value,
      width: mapWidth.value,
      height: mapHeight.value,
      layerTree: layerTree.value,
      fixedColors: fixedColors.value,
      customColors: customColors.value,
      selectedColor: selectedColor.value,
      scaleLocked: scaleLocked.value,
      centerCellAxes: centerCellAxes.value,
      brushSize: brushSize.value,
    })
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    downloadBlob(blob, `${safeFileName(mapName.value)}${FILE_EXTENSION}`)
    fileMessage.value = 'Mapa salvo.'
  }

  async function loadMapFile(file) {
    try {
      const text = await readTextFile(file)
      const parsed = parseMapFile(JSON.parse(text))
      mapName.value = parsed.mapName
      mapWidth.value = parsed.width
      mapHeight.value = parsed.height
      scaleInput.x = parsed.width
      scaleInput.y = parsed.height
      scaleLocked.value = parsed.scaleLocked
      centerCellAxes.value = parsed.centerCellAxes
      brushSize.value = parsed.brushSize
      layerTree.value = parsed.layerTree
      bakeTreeOffsets(layerTree.value)
      const first = firstLayer(layerTree.value)
      activeNodeId.value = first ? first.id : ''
      fixedColors.value = parsed.fixedColors
      customColors.value = parsed.customColors
      selectedColor.value = parsed.selectedColor
      const maxCustom = parsed.customColors.reduce(
        (max, item) => Math.max(max, item.id),
        CUSTOM_ID_START - 1,
      )
      nextCustomId = maxCustom + 1
      history.reset()
      syncHistoryFlags()
      previewCells.value = []
      bumpScene()
      fileMessage.value = 'Mapa carregado.'
    } catch (error) {
      fileMessage.value = error instanceof Error ? error.message : 'Falha ao carregar o mapa.'
    }
  }

  /**
   * @param {'dark' | 'light'} [theme='dark']
   */
  function savePng(theme = 'dark') {
    const canvas = renderMapToCanvas({
      grid: grid.value,
      colors: allColors.value,
      theme,
      centerCellAxes: centerCellAxes.value,
    })
    canvas.toBlob((blob) => {
      if (!blob) return
      downloadBlob(blob, `${safeFileName(mapName.value)}.png`)
      fileMessage.value = 'PNG exportado.'
    }, 'image/png')
  }

  function handleKeydown(event) {
    const key = event.key.toLowerCase()
    if ((event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey) {
      event.preventDefault()
      undo()
      return
    }
    if ((event.ctrlKey || event.metaKey) && (key === 'y' || (key === 'z' && event.shiftKey))) {
      event.preventDefault()
      redo()
      return
    }
    if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
      return
    }
    if (key === 'b') setTool(TOOLS.PENCIL)
    if (key === 'r') setTool(TOOLS.ERASER)
    if (key === 't') setTool(TOOLS.FILL)
    if (key === 'l') setTool(TOOLS.LINE)
    if (key === 'c') setTool(TOOLS.CIRCLE)
    if (key === 'q') setTool(TOOLS.SQUARE)
    if (key === 'p') setTool(TOOLS.PENTAGON)
    if (key === 'e') setTool(TOOLS.STAR)
    if (key === 'v') setTool(TOOLS.MOVE)
  }

  return {
    mapName,
    grid,
    scaleInput,
    scaleLocked,
    centerCellAxes,
    activeTool,
    selectedColor,
    selectedColorInfo,
    fillShapes,
    mirrorX,
    brushSize,
    hoverBlock,
    previewCells,
    paintDabs,
    isDrawing,
    sceneTick,
    gridSize,
    activeToolMeta,
    fixedColors,
    customColors,
    allColors,
    recentCustom,
    extraCustom,
    canUndo,
    canRedo,
    fileMessage,
    layerTree,
    activeNodeId,
    activeNode,
    onScaleField,
    toggleScaleLock,
    applyScale,
    setTool,
    setBrushSize,
    setColor,
    commitWheelColor,
    renameColor,
    recolor,
    clearMap,
    setHover,
    beginStroke,
    continueStroke,
    endStroke,
    selectNode,
    addLayer,
    addGroup,
    groupSelection,
    deleteNode,
    toggleNodeVisible,
    renameNode,
    shiftNode,
    duplicateNode,
    flipActiveLayer,
    toggleGroupCollapsed,
    undo,
    redo,
    saveMapFile,
    loadMapFile,
    savePng,
    stampPerfectShape,
    handleKeydown,
  }
}
