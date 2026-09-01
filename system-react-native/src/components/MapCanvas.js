/**
 * Canvas Skia: pinch = zoom, dois dedos = pan, um dedo = desenho (ou pan se o modo mover-tudo estiver ligado).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, Pressable, Image, Text } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import {
  AlphaType,
  Canvas,
  ColorType,
  Circle,
  Fill,
  Image as SkiaImage,
  Line,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia'
import { TOOLS, isStampTool } from '../constants/tools.js'
import { MAX_ZOOM, MIN_ZOOM } from '../constants/limits.js'
import { formatLineDistance } from '../utils/shapes.js'
import { formatRotateDegrees } from '../utils/rotate.js'
import {
  blocksAlongCanvasSegment,
  centeredOrigin,
  fitCellSize,
  originAfterZoom,
  readableCellSize,
  xyToBlock,
  xyToBlockClamped,
} from '../utils/coords.js'
import {
  axesGeometry,
  buildVisiblePixels,
  gridSegments,
  hoverOverlay,
  mapLod,
  overlayRects,
  THEME_CANVAS,
  visibleRange,
} from '../utils/drawMap.js'
import { UI } from '../theme.js'
import moveTudoIcon from '../assets/move_gtudo.png'

function pixelsToImage(packed) {
  if (!packed) return null
  const data = Skia.Data.fromBytes(packed.pixels)
  return Skia.Image.MakeImage(
    {
      width: packed.width,
      height: packed.height,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Unpremul,
    },
    data,
    packed.width * 4,
  )
}

export default function MapCanvas({
  grid,
  previewCells,
  hoverBlock,
  colors,
  activeTool,
  brushSize,
  clampStroke,
  theme,
  centerCellAxes,
  panMode,
  onTogglePanMode,
  onHover,
  onStrokeStart,
  onStrokeMove,
  onStrokeEnd,
  onZoomChange,
  onLodChange,
}) {
  const [viewSize, setViewSize] = useState({ width: 1, height: 1 })
  const [zoom, setZoom] = useState(1)
  const [origin, setOrigin] = useState({ x: 0, y: 0 })
  const [lineOrigin, setLineOrigin] = useState(null)
  const [hudPos, setHudPos] = useState({ x: 0, y: 0 })
  const ui = UI[theme] || UI.dark
  const skin = THEME_CANVAS[theme] || THEME_CANVAS.dark

  const cols = grid[0] ? grid[0].length : 0
  const rows = grid.length
  const fitted = fitCellSize(viewSize.width, viewSize.height, cols, rows)
  const baseCell = readableCellSize(viewSize.width, viewSize.height, cols, rows)
  const minZoom = baseCell <= 0 ? MIN_ZOOM : Math.max(MIN_ZOOM, Math.min(1, fitted / baseCell))
  const cellSize = baseCell * zoom
  const lod = mapLod(cellSize)

  const fittedOnce = useRef(false)
  const pinchStartZoom = useRef(1)
  const lastStrokePt = useRef(null)

  const resetCamera = useCallback(
    (width, height, c, r, base) => {
      setZoom(1)
      setOrigin(centeredOrigin(width, height, c, r, base))
      onZoomChange?.(1)
      onLodChange?.(mapLod(base))
    },
    [onZoomChange, onLodChange],
  )

  useEffect(() => {
    if (viewSize.width <= 1 || cols <= 0) return
    const base = readableCellSize(viewSize.width, viewSize.height, cols, rows)
    resetCamera(viewSize.width, viewSize.height, cols, rows, base)
  }, [cols, rows])

  const onLayout = (event) => {
    const { width, height } = event.nativeEvent.layout
    const next = { width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height)) }
    setViewSize(next)
    if (fittedOnce.current) return
    fittedOnce.current = true
    const base = readableCellSize(next.width, next.height, cols, rows)
    resetCamera(next.width, next.height, cols, rows, base)
  }

  const applyZoomAt = useCallback(
    (nextZoom, canvasX, canvasY) => {
      setZoom((prev) => {
        const clamped = Math.min(MAX_ZOOM, Math.max(minZoom, nextZoom))
        const oldSize = baseCell * prev
        const newSize = baseCell * clamped
        setOrigin((prevOrigin) => originAfterZoom(canvasX, canvasY, prevOrigin.x, prevOrigin.y, oldSize, newSize))
        onZoomChange?.(clamped)
        onLodChange?.(mapLod(newSize))
        return clamped
      })
    },
    [minZoom, baseCell, onZoomChange, onLodChange],
  )

  const nudgeOrigin = useCallback((dx, dy) => {
    setOrigin((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
  }, [])

  const range = visibleRange(origin.x, origin.y, cellSize, viewSize.width, viewSize.height, cols, rows)
  const destDevW = Math.max(1, Math.round(range.visW * cellSize))
  const destDevH = Math.max(1, Math.round(range.visH * cellSize))
  const packed = useMemo(
    () =>
      buildVisiblePixels(
        grid,
        colors,
        theme,
        range.startX,
        range.startY,
        range.visW,
        range.visH,
        destDevW,
        destDevH,
      ),
    [grid, colors, theme, range.startX, range.startY, range.visW, range.visH, destDevW, destDevH],
  )
  const image = useMemo(() => pixelsToImage(packed), [packed])
  const destX = origin.x + range.startX * cellSize
  const destY = origin.y + range.startY * cellSize
  const destW = range.visW * cellSize
  const destH = range.visH * cellSize

  const preview = overlayRects(previewCells || [], origin.x, origin.y, cellSize, lod, cols, rows)
  const hover = hoverOverlay(hoverBlock, brushSize, origin.x, origin.y, cellSize, lod, cols, rows)
  const gridLines =
    lod * cellSize >= 3
      ? gridSegments(origin.x, origin.y, cellSize, cols, rows, range.startX, range.startY, range.endX, range.endY, lod)
      : []
  const axes = axesGeometry(origin.x, origin.y, cellSize, cols, rows, centerCellAxes)

  const pointToBlock = useCallback(
    (x, y, clamp) => {
      if (clamp) return xyToBlockClamped(x, y, cellSize, origin.x, origin.y, cols, rows)
      return xyToBlock(x, y, cellSize, origin.x, origin.y, cols, rows)
    },
    [cellSize, origin, cols, rows],
  )

  const handleBegin = useCallback(
    (x, y) => {
      const block = pointToBlock(x, y, false)
      onHover?.(block)
      if (!block) return
      setHudPos({ x, y })
      lastStrokePt.current = { x, y }
      if (activeTool === TOOLS.LINE || activeTool === TOOLS.ROTATE) setLineOrigin(block)
      onStrokeStart?.(clampStroke ? pointToBlock(x, y, true) : block)
    },
    [pointToBlock, onHover, onStrokeStart, clampStroke, activeTool],
  )

  const handleMove = useCallback(
    (x, y) => {
      const block = pointToBlock(x, y, false)
      onHover?.(block)
      setHudPos({ x, y })
      if (isStampTool(activeTool) && lastStrokePt.current) {
        const blocks = blocksAlongCanvasSegment(
          lastStrokePt.current.x,
          lastStrokePt.current.y,
          x,
          y,
          origin.x,
          origin.y,
          cellSize,
          cols,
          rows,
          false,
        )
        lastStrokePt.current = { x, y }
        if (blocks.length) onStrokeMove?.(blocks)
        return
      }
      const next = clampStroke ? pointToBlock(x, y, true) : block
      if (next) onStrokeMove?.(next)
    },
    [pointToBlock, onHover, onStrokeMove, clampStroke, activeTool, origin, cellSize, cols, rows],
  )

  const handleEnd = useCallback(() => {
    lastStrokePt.current = null
    setLineOrigin(null)
    onStrokeEnd?.()
  }, [onStrokeEnd])

  const capturePinchStart = useCallback(() => {
    pinchStartZoom.current = zoom
  }, [zoom])

  const pinchTo = useCallback(
    (scale, fx, fy) => {
      applyZoomAt(pinchStartZoom.current * scale, fx, fy)
    },
    [applyZoomAt],
  )

  const panCamera = Gesture.Pan()
    .minPointers(2)
    .onChange((event) => {
      runOnJS(nudgeOrigin)(event.changeX, event.changeY)
    })

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      runOnJS(capturePinchStart)()
    })
    .onUpdate((event) => {
      runOnJS(pinchTo)(event.scale, event.focalX, event.focalY)
    })

  const oneFinger = Gesture.Pan()
    .maxPointers(1)
    .onBegin((event) => {
      if (panMode) return
      runOnJS(handleBegin)(event.x, event.y)
    })
    .onChange((event) => {
      if (panMode) {
        runOnJS(nudgeOrigin)(event.changeX, event.changeY)
        return
      }
      runOnJS(handleMove)(event.x, event.y)
    })
    .onFinalize(() => {
      if (!panMode) runOnJS(handleEnd)()
    })

  const composed = Gesture.Exclusive(Gesture.Simultaneous(pinch, panCamera), oneFinger)

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <GestureDetector gesture={composed}>
        <Canvas style={styles.canvas}>
          <Fill color={skin.background} />
          {image ? (
            <SkiaImage image={image} x={destX} y={destY} width={destW} height={destH} fit="fill" />
          ) : null}
          {preview.map((rect, i) => (
            <Rect key={`p${i}`} x={rect.x} y={rect.y} width={rect.w} height={rect.h} color={skin.previewFill} />
          ))}
          {hover.map((rect, i) => (
            <Rect key={`h${i}`} x={rect.x} y={rect.y} width={rect.w} height={rect.h} color={skin.hover} />
          ))}
          {gridLines.map((seg, i) => (
            <Line key={`g${i}`} p1={vec(seg.x1, seg.y1)} p2={vec(seg.x2, seg.y2)} color={skin.grid} strokeWidth={1} />
          ))}
          <Line
            p1={vec(axes.left, axes.axisY)}
            p2={vec(axes.right, axes.axisY)}
            color={skin.axisX}
            strokeWidth={axes.lineWidth}
          />
          <Line
            p1={vec(axes.axisX, axes.top)}
            p2={vec(axes.axisX, axes.bottom)}
            color={skin.axisY}
            strokeWidth={axes.lineWidth}
          />
          <Circle cx={axes.axisX} cy={axes.axisY} r={axes.originR} color={skin.origin} />
        </Canvas>
      </GestureDetector>
      { (activeTool === TOOLS.LINE || activeTool === TOOLS.ROTATE) && lineOrigin && hoverBlock && !panMode ? (
        <View
          pointerEvents="none"
          style={[
            styles.hud,
            { left: hudPos.x, top: hudPos.y, backgroundColor: ui.panel, borderColor: ui.line },
          ]}
        >
          <Text style={{ color: ui.ink, fontWeight: '700', fontSize: 12 }}>
            {activeTool === TOOLS.ROTATE
              ? formatRotateDegrees(lineOrigin, hoverBlock, cols, rows, centerCellAxes)
              : formatLineDistance(lineOrigin, hoverBlock)}
          </Text>
        </View>
      ) : null}
      <View style={styles.fab} pointerEvents="box-none">
        <Pressable
          style={[styles.fabBtn, panMode && { borderColor: ui.brass, backgroundColor: ui.toolOn }]}
          onPress={onTogglePanMode}
        >
          <Image source={moveTudoIcon} style={[styles.fabIcon, { tintColor: ui.iconTint }]} />
        </Pressable>
        <Pressable style={styles.fabBtn} onPress={() => applyZoomAt(zoom * 1.2, viewSize.width / 2, viewSize.height / 2)}>
          <Text style={[styles.fabTxt, { color: ui.ink }]}>+</Text>
        </Pressable>
        <Pressable style={styles.fabBtn} onPress={() => applyZoomAt(zoom / 1.2, viewSize.width / 2, viewSize.height / 2)}>
          <Text style={[styles.fabTxt, { color: ui.ink }]}>-</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 0, overflow: 'hidden' },
  canvas: { flex: 1 },
  hud: {
    position: 'absolute',
    transform: [{ translateX: -50 }, { translateY: -36 }],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  fab: { position: 'absolute', right: 10, bottom: 10, gap: 6 },
  fabBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.4)',
    backgroundColor: 'rgba(20,20,20,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: { width: 18, height: 18 },
  fabTxt: { fontSize: 22, fontWeight: '700', lineHeight: 24 },
})
