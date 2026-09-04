/**
 * Estado e ações do editor (porte do composable Vue para React).
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia'
import { cloneFixedColors, findColor, getCellHex, normalizeHex } from '../constants/palette.js'
import { MAX_GRID_SIZE, MAX_HISTORY, RECENT_COLOR_SLOTS } from '../constants/limits.js'
import { TOOLS, getToolMeta, isStampTool } from '../constants/tools.js'
import { FILE_EXTENSION, parseMapFile, serializeMapFile } from '../utils/fileFormat.js'
import { safeFileName } from '../utils/fileName.js'
import { blockKey, withMirrors } from '../utils/coords.js'
import { applyCells, clearGrid, cloneGrid, getGridSize, inBounds, floodFillCells, setCell } from '../utils/grid.js'
import { createHistory } from '../utils/history.js'
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
} from '../utils/layers.js'
import { expandBrush, getLineCells, getPerfectShapeCells, getShapeCells } from '../utils/shapes.js'
import { drawingPivotFromGrids, rotateGrid, snappedRotateDegrees } from '../utils/rotate.js'
import { buildVisiblePixels } from '../utils/drawMap.js'

const DEFAULT_WIDTH = 24
const DEFAULT_HEIGHT = 16
const CUSTOM_ID_START = 100

function firstLayer(nodes) {
  for (const node of nodes) {
    if (node.type === 'layer') return node
    const nested = firstLayer(node.children || [])
    if (nested) return nested
  }
  return null
}

function toLocal(layer, wx, wy) {
  return { x: wx - layer.offsetX, y: wy - layer.offsetY }
}

export function useMapEditor() {
  const [mapName, setMapName] = useState('Mapa sem nome')
  const [mapWidth, setMapWidth] = useState(DEFAULT_WIDTH)
  const [mapHeight, setMapHeight] = useState(DEFAULT_HEIGHT)
  const [scaleLocked, setScaleLocked] = useState(false)
  const [centerCellAxes, setCenterCellAxes] = useState(false)
  const [scaleInput, setScaleInput] = useState({ x: DEFAULT_WIDTH, y: DEFAULT_HEIGHT })

  const initialLayer = createLayer(DEFAULT_WIDTH, DEFAULT_HEIGHT, 'Camada 1')
  const [layerTree, setLayerTree] = useState([initialLayer])
  const [activeNodeId, setActiveNodeId] = useState(initialLayer.id)
  const [sceneTick, setSceneTick] = useState(0)

  const [activeTool, setActiveTool] = useState(TOOLS.PENCIL)
  const [fillShapes, setFillShapes] = useState(false)
  const [alphaPaint, setAlphaPaint] = useState(false)
  const [mirrorX, setMirrorX] = useState(false)
  const [mirrorY, setMirrorY] = useState(false)
  const [brushSize, setBrushSizeState] = useState(1)
  const [hoverBlock, setHoverBlock] = useState(null)
  const [previewCells, setPreviewCells] = useState([])
  const previewCellsRef = useRef([])
  previewCellsRef.current = previewCells
  const [isDrawing, setIsDrawing] = useState(false)

  const [fixedColors, setFixedColors] = useState(cloneFixedColors)
  const [customColors, setCustomColors] = useState([])
  const [selectedColor, setSelectedColor] = useState(1)
  const nextCustomId = useRef(CUSTOM_ID_START)

  const [fileMessage, setFileMessage] = useState('')
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const visitedInStroke = useRef(new Set())
  const stampLast = useRef(null)
  const strokeOrigin = useRef(null)
  const moveOrigin = useRef(null)
  const moveBaseOffsets = useRef([])
  const rotateBases = useRef([])
  const rotateStart = useRef(null)
  const rotatePivotPt = useRef(null)
  const rotateLastDeg = useRef(0)
  const [rotatePivot, setRotatePivot] = useState(null)
  const layerTreeRef = useRef(layerTree)
  const activeNodeIdRef = useRef(activeNodeId)
  const mapSizeRef = useRef({ width: mapWidth, height: mapHeight, centerCellAxes, mirrorX, mirrorY, brushSize, fillShapes, alphaPaint, activeTool, selectedColor })

  layerTreeRef.current = layerTree
  activeNodeIdRef.current = activeNodeId
  mapSizeRef.current = {
    width: mapWidth,
    height: mapHeight,
    scaleLocked,
    centerCellAxes,
    mirrorX,
    mirrorY,
    brushSize,
    fillShapes,
    alphaPaint,
    activeTool,
    selectedColor,
  }

  const historyRef = useRef(null)
  if (!historyRef.current) {
    historyRef.current = createHistory(
      MAX_HISTORY,
      () => ({
        layerTree: cloneLayerTree(layerTreeRef.current),
        width: mapSizeRef.current.width,
        height: mapSizeRef.current.height,
        scaleLocked: mapSizeRef.current.scaleLocked,
        centerCellAxes: mapSizeRef.current.centerCellAxes,
        activeNodeId: activeNodeIdRef.current,
      }),
      (snapshot) => {
        const treeSource = Array.isArray(snapshot) ? snapshot : snapshot.layerTree
        const tree = cloneLayerTree(treeSource)
        let width
        let height
        if (!Array.isArray(snapshot) && snapshot.width && snapshot.height) {
          width = snapshot.width
          height = snapshot.height
          setScaleLocked(Boolean(snapshot.scaleLocked))
          setCenterCellAxes(Boolean(snapshot.centerCellAxes))
          setActiveNodeId(snapshot.activeNodeId)
        } else {
          const first = firstLayer(tree)
          const size = first
            ? getGridSize(first.grid)
            : { width: mapSizeRef.current.width, height: mapSizeRef.current.height }
          width = size.width
          height = size.height
        }
        setLayerTree(tree)
        setMapWidth(width)
        setMapHeight(height)
        setScaleInput({ x: width, y: height })
        if (!findNode(tree, activeNodeIdRef.current)) {
          const first = firstLayer(tree)
          setActiveNodeId(first ? first.id : '')
        }
        setIsDrawing(false)
        visitedInStroke.current.clear()
        stampLast.current = null
        strokeOrigin.current = null
        moveOrigin.current = null
        moveBaseOffsets.current = []
        setPreviewCells([])
        setSceneTick((n) => n + 1)
      },
    )
  }

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(historyRef.current.canUndo())
    setCanRedo(historyRef.current.canRedo())
  }, [])

  const recordHistory = useCallback(() => {
    historyRef.current.record()
    syncHistoryFlags()
  }, [syncHistoryFlags])

  const bumpScene = useCallback(() => {
    setLayerTree((tree) => tree.slice())
    setSceneTick((n) => n + 1)
  }, [])

  const bumpPixels = useCallback(() => {
    setSceneTick((n) => n + 1)
  }, [])

  const grid = useMemo(
    () => compositeLayerTree(layerTree, mapWidth, mapHeight),
    [layerTree, mapWidth, mapHeight, sceneTick],
  )

  const activeNode = useMemo(() => findNode(layerTree, activeNodeId), [layerTree, activeNodeId])
  const activeLayer = activeNode && activeNode.type === 'layer' ? activeNode : null
  const activeToolMeta = useMemo(() => getToolMeta(activeTool), [activeTool])
  const allColors = useMemo(() => [...fixedColors, ...customColors], [fixedColors, customColors])
  const selectedColorInfo = useMemo(() => findColor(allColors, selectedColor), [allColors, selectedColor])
  const recentCustom = useMemo(() => customColors.slice(0, RECENT_COLOR_SLOTS), [customColors])
  const extraCustom = useMemo(() => customColors.slice(RECENT_COLOR_SLOTS), [customColors])
  const gridRef = useRef(grid)
  const colorsRef = useRef(allColors)
  gridRef.current = grid
  colorsRef.current = allColors

  const onScaleField = useCallback((axis, value) => {
    setScaleInput((prev) => {
      const next = { ...prev, [axis]: value }
      if (scaleLocked) next.y = next.x
      return next
    })
  }, [scaleLocked])

  const toggleScaleLock = useCallback(() => {
    setScaleLocked((on) => {
      const next = !on
      if (next) setScaleInput((prev) => ({ ...prev, y: prev.x }))
      return next
    })
  }, [])

  const applyScale = useCallback(() => {
    let width = Math.min(MAX_GRID_SIZE, Math.max(1, Math.floor(Number(scaleInput.x))))
    let height = Math.min(MAX_GRID_SIZE, Math.max(1, Math.floor(Number(scaleInput.y))))
    if (scaleLocked) height = width
    if (!Number.isFinite(width) || !Number.isFinite(height)) return
    setScaleInput({ x: width, y: height })
    if (width % 2 === 0 || height % 2 === 0) setCenterCellAxes(false)
    recordHistory()
    setMapWidth(width)
    setMapHeight(height)
    resizeLayerTree(layerTreeRef.current, width, height)
    setPreviewCells([])
    setHoverBlock(null)
    bumpScene()
  }, [scaleInput, scaleLocked, recordHistory, bumpScene])

  const setTool = useCallback((toolId) => {
    setActiveTool(toolId)
    setIsDrawing(false)
    strokeOrigin.current = null
    setPreviewCells([])
    visitedInStroke.current.clear()
    stampLast.current = null
    moveOrigin.current = null
    moveBaseOffsets.current = []
    rotateBases.current = []
    rotateStart.current = null
    rotatePivotPt.current = null
    rotateLastDeg.current = 0
    setRotatePivot(null)
  }, [])

  const setBrushSize = useCallback((size) => {
    const next = Number(size)
    if (![1, 2, 3].includes(next)) return
    setBrushSizeState(next)
  }, [])

  const setColor = useCallback((colorId) => {
    setSelectedColor(colorId)
  }, [])

  const commitWheelColor = useCallback((hex) => {
    const normalized = normalizeHex(hex)
    if (!normalized) return
    setCustomColors((list) => {
      const existing = list.find((item) => item.hex === normalized)
      if (existing) {
        setSelectedColor(existing.id)
        return [existing, ...list.filter((item) => item.id !== existing.id)]
      }
      const color = {
        id: nextCustomId.current,
        name: `Cor ${list.length + 1}`,
        hex: normalized,
        source: 'custom',
      }
      nextCustomId.current += 1
      setSelectedColor(color.id)
      return [color, ...list]
    })
  }, [])

  const renameColor = useCallback((colorId, name) => {
    const apply = (list) =>
      list.map((item) => (item.id === colorId ? { ...item, name: String(name).slice(0, 32) } : item))
    setFixedColors((list) => apply(list))
    setCustomColors((list) => apply(list))
  }, [])

  const recolor = useCallback((colorId, hex) => {
    if (colorId === 0) return
    const normalized = normalizeHex(hex)
    if (!normalized) return
    const apply = (list) => list.map((item) => (item.id === colorId ? { ...item, hex: normalized } : item))
    setFixedColors((list) => apply(list))
    setCustomColors((list) => apply(list))
  }, [])

  const clearMap = useCallback(() => {
    const node = findNode(layerTreeRef.current, activeNodeIdRef.current)
    if (!node) return
    recordHistory()
    forEachLayer(node, (layer) => {
      clearGrid(layer.grid, 0)
    })
    setPreviewCells([])
    bumpScene()
  }, [recordHistory, bumpScene])

  const cancelStroke = useCallback(() => {
    setIsDrawing(false)
    strokeOrigin.current = null
    setPreviewCells([])
    visitedInStroke.current.clear()
    stampLast.current = null
    moveOrigin.current = null
    moveBaseOffsets.current = []
    rotateBases.current = []
    rotateStart.current = null
    rotatePivotPt.current = null
    rotateLastDeg.current = 0
    setRotatePivot(null)
  }, [])

  const stampBrush = useCallback((layer, wx, wy, color) => {
    const { width, height, mirrorX: mx, mirrorY: my, centerCellAxes: axes, brushSize: size } = mapSizeRef.current
    const stamps = withMirrors(expandBrush([{ x: wx, y: wy }], size), width, height, mx, my, axes)
    for (const world of stamps) {
      const local = toLocal(layer, world.x, world.y)
      const key = blockKey(local.x, local.y)
      if (visitedInStroke.current.has(key)) continue
      if (!inBounds(layer.grid, local.x, local.y)) continue
      if (mapSizeRef.current.alphaPaint && color !== 0 && layer.grid[local.y][local.x] === 0) {
        visitedInStroke.current.add(key)
        continue
      }
      visitedInStroke.current.add(key)
      setCell(layer.grid, local.x, local.y, color)
    }
  }, [])

  const pickColorAt = useCallback((block) => {
    if (!block) return
    const map = gridRef.current
    if (!map || !inBounds(map, block.x, block.y)) return
    const id = map[block.y][block.x]
    if (id === 0) {
      setSelectedColor(0)
      return
    }
    const colors = colorsRef.current
    const hex = getCellHex(colors, id)
    const known = colors.find((item) => item.id !== 0 && item.hex === hex)
    if (known) {
      if (known.source === 'custom') {
        setCustomColors((list) => [known, ...list.filter((item) => item.id !== known.id)])
      }
      setSelectedColor(known.id)
      return
    }
    commitWheelColor(hex)
  }, [commitWheelColor])

  const beginStroke = useCallback((block) => {
    setIsDrawing(true)
    strokeOrigin.current = { ...block }
    visitedInStroke.current.clear()
    const tree = layerTreeRef.current
    const node = findNode(tree, activeNodeIdRef.current)
    const { activeTool: tool, selectedColor: color, width, height, fillShapes: fill, mirrorX: mx, mirrorY: my, centerCellAxes: axes, brushSize: size } =
      mapSizeRef.current

    if (tool === TOOLS.EYEDROPPER) {
      pickColorAt(block)
      return
    }

    if (tool === TOOLS.MOVE) {
      if (!node) return
      recordHistory()
      moveOrigin.current = { ...block }
      const bases = []
      forEachLayer(node, (layer) => {
        bases.push({ id: layer.id, x: layer.offsetX, y: layer.offsetY })
      })
      moveBaseOffsets.current = bases
      return
    }

    if (tool === TOOLS.ROTATE) {
      if (!node) {
        setFileMessage('Selecione uma camada para girar.')
        cancelStroke()
        return
      }
      forEachLayer(node, (layer) => bakeLayerOffset(layer))
      const grids = []
      forEachLayer(node, (layer) => grids.push(layer.grid))
      const pivot = drawingPivotFromGrids(grids)
      if (!pivot) {
        setFileMessage('Não há desenho para girar.')
        cancelStroke()
        return
      }
      recordHistory()
      const bases = []
      forEachLayer(node, (layer) => {
        bases.push({ id: layer.id, grid: cloneGrid(layer.grid) })
      })
      rotateBases.current = bases
      rotatePivotPt.current = pivot
      setRotatePivot(pivot)
      rotateStart.current = { x: block.x, y: block.y }
      rotateLastDeg.current = 0
      return
    }

    const layer = node && node.type === 'layer' ? node : null
    if (!layer) {
      setFileMessage('Selecione uma camada para desenhar.')
      cancelStroke()
      return
    }

    if (isStampTool(tool)) {
      recordHistory()
      stampLast.current = { x: block.x, y: block.y }
      stampBrush(layer, block.x, block.y, tool === TOOLS.ERASER ? 0 : color)
      setPreviewCells([])
      bumpPixels()
      return
    }

    if (tool === TOOLS.FILL) {
      const local = toLocal(layer, block.x, block.y)
      const cells = floodFillCells(layer.grid, local.x, local.y, color)
      if (cells.length === 0) return
      recordHistory()
      const worlds = cells.map((cell) => ({ x: cell.x + layer.offsetX, y: cell.y + layer.offsetY }))
      const mirrored = withMirrors(worlds, width, height, mx, my, axes)
      const locals = []
      for (const world of mirrored) {
        const at = toLocal(layer, world.x, world.y)
        if (inBounds(layer.grid, at.x, at.y)) locals.push(at)
      }
      applyCells(layer.grid, locals, color)
      setPreviewCells([])
      bumpScene()
      return
    }

    setPreviewCells(withMirrors(getShapeCells(tool, block, block, fill, width, height, size), width, height, mx, my, axes))
  }, [recordHistory, stampBrush, bumpScene, bumpPixels, cancelStroke, pickColorAt])

  const continueStroke = useCallback((block) => {
    const { activeTool: tool, selectedColor: color, width, height, fillShapes: fill, mirrorX: mx, mirrorY: my, centerCellAxes: axes, brushSize: size } =
      mapSizeRef.current
    const tree = layerTreeRef.current
    const node = findNode(tree, activeNodeIdRef.current)

    if (tool === TOOLS.EYEDROPPER) {
      pickColorAt(block)
      return
    }

    if (tool === TOOLS.MOVE) {
      if (!moveOrigin.current) return
      const dx = block.x - moveOrigin.current.x
      const dy = block.y - moveOrigin.current.y
      for (const base of moveBaseOffsets.current) {
        const layer = findNode(tree, base.id)
        if (layer && layer.type === 'layer') {
          layer.offsetX = base.x + dx
          layer.offsetY = base.y + dy
        }
      }
      bumpPixels()
      return
    }

    if (tool === TOOLS.ROTATE) {
      if (!rotateStart.current || !rotatePivotPt.current) return
      const deg = snappedRotateDegrees(rotateStart.current, block, rotatePivotPt.current)
      if (deg === rotateLastDeg.current) return
      rotateLastDeg.current = deg
      const pivot = rotatePivotPt.current
      for (const base of rotateBases.current) {
        const layer = findNode(tree, base.id)
        if (layer && layer.type === 'layer') {
          layer.grid = rotateGrid(base.grid, deg, pivot.x, pivot.y)
        }
      }
      bumpPixels()
      return
    }

    const layer = node && node.type === 'layer' ? node : null
    if (!layer) return

    if (isStampTool(tool)) {
      const points = Array.isArray(block) ? block : [block]
      const paint = tool === TOOLS.ERASER ? 0 : color
      for (const point of points) {
        if (stampLast.current && stampLast.current.x === point.x && stampLast.current.y === point.y) continue
        const from = stampLast.current || point
        const jumped = Math.abs(point.x - from.x) > 1 || Math.abs(point.y - from.y) > 1
        if (jumped) {
          const path = getLineCells(from.x, from.y, point.x, point.y)
          for (const cell of path) stampBrush(layer, cell.x, cell.y, paint)
        } else {
          stampBrush(layer, point.x, point.y, paint)
        }
        stampLast.current = { x: point.x, y: point.y }
      }
      bumpPixels()
      return
    }

    if (tool === TOOLS.FILL) return

    setPreviewCells(
      withMirrors(getShapeCells(tool, strokeOrigin.current, block, fill, width, height, size), width, height, mx, my, axes),
    )
  }, [stampBrush, bumpScene, bumpPixels, pickColorAt])

  const endStroke = useCallback(() => {
    const { activeTool: tool, selectedColor: color } = mapSizeRef.current
    const tree = layerTreeRef.current
    const node = findNode(tree, activeNodeIdRef.current)

    if (tool === TOOLS.MOVE) {
      for (const base of moveBaseOffsets.current) {
        const layer = findNode(tree, base.id)
        if (layer && layer.type === 'layer') bakeLayerOffset(layer)
      }
      bumpScene()
      cancelStroke()
      return
    }

    if (tool === TOOLS.ROTATE) {
      bumpScene()
      cancelStroke()
      return
    }

    if (tool === TOOLS.FILL || tool === TOOLS.EYEDROPPER) {
      cancelStroke()
      return
    }

    const layer = node && node.type === 'layer' ? node : null
    const pending = previewCellsRef.current
    if (layer && !isStampTool(tool) && pending.length > 0) {
      recordHistory()
      const locals = []
      for (const world of pending) {
        const local = toLocal(layer, world.x, world.y)
        if (inBounds(layer.grid, local.x, local.y)) locals.push(local)
      }
      applyCells(layer.grid, locals, color)
      bumpScene()
    }
    cancelStroke()
  }, [recordHistory, bumpScene, cancelStroke])

  const stampPerfectShape = useCallback((opts) => {
    const node = findNode(layerTreeRef.current, activeNodeIdRef.current)
    const layer = node && node.type === 'layer' ? node : null
    if (!layer) {
      setFileMessage('Selecione uma camada para desenhar.')
      return
    }
    const { width, height, fillShapes: fill, mirrorX: mx, mirrorY: my, centerCellAxes: axes, selectedColor: color } =
      mapSizeRef.current
    const worlds = withMirrors(
      getPerfectShapeCells({
        tool: opts.tool,
        cols: width,
        rows: height,
        sizeX: opts.x,
        sizeY: opts.y,
        centerCellAxes: axes,
        filled: fill,
        thickness: opts.thickness,
        orientation: opts.orientation,
      }),
      width,
      height,
      mx,
      my,
      axes,
    )
    if (worlds.length === 0) return
    recordHistory()
    const locals = []
    for (const world of worlds) {
      const local = toLocal(layer, world.x, world.y)
      if (inBounds(layer.grid, local.x, local.y)) locals.push(local)
    }
    applyCells(layer.grid, locals, color)
    bumpScene()
    setFileMessage('Forma perfeita criada.')
  }, [recordHistory, bumpScene])

  const selectNode = useCallback((id) => setActiveNodeId(id), [])

  const addLayer = useCallback(() => {
    recordHistory()
    const tree = layerTreeRef.current
    const node = findNode(tree, activeNodeIdRef.current)
    const layer = createLayer(mapSizeRef.current.width, mapSizeRef.current.height, `Camada ${countLayers(tree) + 1}`)
    if (node && node.type === 'group') {
      node.children = [...node.children, layer]
      setLayerTree(tree.slice())
    } else {
      setLayerTree([...tree, layer])
    }
    setActiveNodeId(layer.id)
    setSceneTick((n) => n + 1)
  }, [recordHistory])

  const addGroup = useCallback(() => {
    recordHistory()
    const group = createGroup(`Grupo ${layerTreeRef.current.length + 1}`)
    setLayerTree((tree) => [...tree, group])
    setActiveNodeId(group.id)
  }, [recordHistory])

  const groupSelection = useCallback(() => {
    const tree = layerTreeRef.current
    const id = activeNodeIdRef.current
    const index = tree.findIndex((node) => node.id === id)
    if (index < 0) {
      setFileMessage('Agrupe a partir da lista raiz, ou crie um grupo e adicione camadas nele.')
      return
    }
    recordHistory()
    const next = tree.slice()
    const [node] = next.splice(index, 1)
    const group = createGroup('Grupo', [node])
    next.splice(index, 0, group)
    setLayerTree(next)
    setActiveNodeId(group.id)
  }, [recordHistory])

  const deleteNode = useCallback(() => {
    const tree = layerTreeRef.current
    if (countLayers(tree) <= 1 && findNode(tree, activeNodeIdRef.current)?.type === 'layer') {
      setFileMessage('O mapa precisa de ao menos uma camada.')
      return
    }
    const id = activeNodeIdRef.current
    if (!id) return
    recordHistory()
    removeNode(tree, id)
    let next = tree.slice()
    const first = firstLayer(next)
    if (!first) {
      const layer = createLayer(mapSizeRef.current.width, mapSizeRef.current.height, 'Camada 1')
      next = [layer]
      setActiveNodeId(layer.id)
    } else {
      setActiveNodeId(first.id)
    }
    setLayerTree(next)
    setSceneTick((n) => n + 1)
  }, [recordHistory])

  const toggleNodeVisible = useCallback((id) => {
    const node = findNode(layerTreeRef.current, id)
    if (!node) return
    recordHistory()
    setTreeVisible(node, !node.visible)
    bumpScene()
  }, [recordHistory, bumpScene])

  const renameNode = useCallback((id, name) => {
    const node = findNode(layerTreeRef.current, id)
    if (!node) return
    node.name = String(name).slice(0, 40)
    bumpScene()
  }, [bumpScene])

  const shiftNode = useCallback((dir) => {
    recordHistory()
    moveNodeAmongSiblings(layerTreeRef.current, activeNodeIdRef.current, dir)
    bumpScene()
  }, [recordHistory, bumpScene])

  const duplicateNode = useCallback(() => {
    const tree = layerTreeRef.current
    const node = findNode(tree, activeNodeIdRef.current)
    if (!node) {
      setFileMessage('Selecione uma camada ou grupo para duplicar.')
      return
    }
    recordHistory()
    const copy = cloneNodeDeep(node)
    if (!insertNodeAfter(tree, node.id, copy)) {
      tree.push(copy)
    }
    setLayerTree(tree.slice())
    setActiveNodeId(copy.id)
    setSceneTick((n) => n + 1)
  }, [recordHistory])

  const flipActiveLayer = useCallback((axis) => {
    const node = findNode(layerTreeRef.current, activeNodeIdRef.current)
    if (!node) {
      setFileMessage('Selecione uma camada para inverter.')
      return
    }
    recordHistory()
    flipNodeGrids(node, axis)
    bumpScene()
  }, [recordHistory, bumpScene])

  const toggleGroupCollapsed = useCallback((id) => {
    const node = findNode(layerTreeRef.current, id)
    if (!node || node.type !== 'group') return
    node.collapsed = !node.collapsed
    bumpScene()
  }, [bumpScene])

  const undo = useCallback(() => {
    if (!historyRef.current.undo()) return
    setPreviewCells([])
    syncHistoryFlags()
  }, [syncHistoryFlags])

  const redo = useCallback(() => {
    if (!historyRef.current.redo()) return
    setPreviewCells([])
    syncHistoryFlags()
  }, [syncHistoryFlags])

  const saveMapFile = useCallback(async () => {
    const payload = serializeMapFile({
      mapName,
      width: mapWidth,
      height: mapHeight,
      layerTree: layerTreeRef.current,
      fixedColors,
      customColors,
      selectedColor,
      scaleLocked,
      centerCellAxes,
      brushSize,
    })
    const name = `${safeFileName(mapName)}${FILE_EXTENSION}`
    const path = `${FileSystem.cacheDirectory}${name}`
    await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2))
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Salvar mapa' })
    }
    setFileMessage('Mapa salvo.')
  }, [mapName, mapWidth, mapHeight, fixedColors, customColors, selectedColor, scaleLocked, centerCellAxes, brushSize])

  const loadMapFile = useCallback(async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true,
      })
      if (picked.canceled || !picked.assets?.[0]) return
      const text = await FileSystem.readAsStringAsync(picked.assets[0].uri)
      const parsed = parseMapFile(JSON.parse(text))
      setMapName(parsed.mapName)
      setMapWidth(parsed.width)
      setMapHeight(parsed.height)
      setScaleInput({ x: parsed.width, y: parsed.height })
      setScaleLocked(parsed.scaleLocked)
      setCenterCellAxes(parsed.centerCellAxes)
      setBrushSizeState(parsed.brushSize)
      bakeTreeOffsets(parsed.layerTree)
      setLayerTree(parsed.layerTree)
      const first = firstLayer(parsed.layerTree)
      setActiveNodeId(first ? first.id : '')
      setFixedColors(parsed.fixedColors)
      setCustomColors(parsed.customColors)
      setSelectedColor(parsed.selectedColor)
      const maxCustom = parsed.customColors.reduce((max, item) => Math.max(max, item.id), CUSTOM_ID_START - 1)
      nextCustomId.current = maxCustom + 1
      historyRef.current.reset()
      syncHistoryFlags()
      setPreviewCells([])
      setSceneTick((n) => n + 1)
      setFileMessage('Mapa carregado.')
    } catch (error) {
      setFileMessage(error instanceof Error ? error.message : 'Falha ao carregar o mapa.')
    }
  }, [syncHistoryFlags])

  const savePng = useCallback(async (theme = 'dark') => {
    const cols = mapWidth
    const rows = mapHeight
    const cell = Math.max(4, Math.min(12, Math.floor(2048 / Math.max(cols, rows))))
    const destW = cols * cell
    const destH = rows * cell
    const packed = buildVisiblePixels(grid, allColors, theme, 0, 0, cols, rows, cols, rows)
    if (!packed) return
    const data = Skia.Data.fromBytes(packed.pixels)
    const image = Skia.Image.MakeImage(
      { width: packed.width, height: packed.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
      data,
      packed.width * 4,
    )
    if (!image) {
      setFileMessage('Não foi possível gerar o PNG.')
      return
    }
    const surface = Skia.Surface.MakeOffscreen(destW, destH)
    if (!surface) {
      const b64 = image.encodeToBase64()
      const path = `${FileSystem.cacheDirectory}${safeFileName(mapName)}.png`
      await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 })
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'image/png' })
      setFileMessage('PNG exportado.')
      return
    }
    const canvas = surface.getCanvas()
    canvas.save()
    canvas.scale(cell, cell)
    canvas.drawImage(image, 0, 0)
    canvas.restore()
    const snap = surface.makeImageSnapshot()
    const b64 = snap.encodeToBase64()
    const path = `${FileSystem.cacheDirectory}${safeFileName(mapName)}.png`
    await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 })
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'image/png' })
    setFileMessage('PNG exportado.')
  }, [grid, allColors, mapWidth, mapHeight, mapName])

  return {
    mapName,
    setMapName,
    grid,
    scaleInput,
    scaleLocked,
    centerCellAxes,
    setCenterCellAxes,
    activeTool,
    selectedColor,
    selectedColorInfo,
    fillShapes,
    setFillShapes,
    alphaPaint,
    setAlphaPaint,
    mirrorX,
    setMirrorX,
    mirrorY,
    setMirrorY,
    brushSize,
    hoverBlock,
    previewCells,
    isDrawing,
    sceneTick,
    rotatePivot,
    gridSize: { width: mapWidth, height: mapHeight },
    activeToolMeta,
    fixedColors,
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
    setHover: (block) => {
      setHoverBlock((prev) => {
        if (!block && !prev) return prev
        if (block && prev && block.x === prev.x && block.y === prev.y) return prev
        return block
      })
    },
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
  }
}
