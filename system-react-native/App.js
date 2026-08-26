import { useState } from 'react'
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { TOOLS } from './src/constants/tools.js'
import { useMapEditor } from './src/hooks/useMapEditor.js'
import { useTheme } from './src/hooks/useTheme.js'
import { UI } from './src/theme.js'
import MapCanvas from './src/components/MapCanvas.js'
import ToolStrip from './src/components/ToolStrip.js'
import EditorSheet from './src/components/EditorSheet.js'
import luaIcon from './src/assets/lua.png'
import solIcon from './src/assets/sol.png'

export default function App() {
  const editor = useMapEditor()
  const { theme, toggleTheme } = useTheme()
  const ui = UI[theme]
  const [sheetOpen, setSheetOpen] = useState(false)
  const [panMode, setPanMode] = useState(false)
  const [perfectOpen, setPerfectOpen] = useState(false)
  const [perfectX, setPerfectX] = useState('1')
  const [perfectY, setPerfectY] = useState('1')
  const [zoom, setZoom] = useState(1)
  const [lod, setLod] = useState(1)

  const clampStroke =
    editor.activeTool === TOOLS.LINE || editor.activeTool === TOOLS.CIRCLE || editor.activeTool === TOOLS.MOVE

  function confirmPerfect() {
    const x = Math.min(editor.gridSize.width, Math.max(1, Math.floor(Number(perfectX)) || 1))
    const y = Math.min(editor.gridSize.height, Math.max(1, Math.floor(Number(perfectY)) || 1))
    editor.stampPerfectShape(x, y)
    setPerfectOpen(false)
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView style={[styles.page, { backgroundColor: ui.bg }]} edges={['top', 'left', 'right', 'bottom']}>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kicker, { color: ui.brass }]}>Z-BLOCKMAP</Text>
              <TextInput
                value={editor.mapName}
                onChangeText={editor.setMapName}
                placeholder="Nome do mapa"
                placeholderTextColor={ui.inkDim}
                style={[styles.name, { color: ui.ink, borderColor: ui.line, backgroundColor: ui.input }]}
              />
            </View>
            <Pressable style={[styles.chip, { borderColor: ui.line, backgroundColor: ui.panel }]} onPress={toggleTheme}>
              <Image source={theme === 'dark' ? luaIcon : solIcon} style={{ width: 16, height: 16, tintColor: ui.iconTint }} />
            </Pressable>
            <Pressable style={[styles.chip, { borderColor: ui.line, backgroundColor: ui.panel }]} onPress={() => setSheetOpen(true)}>
              <Text style={{ color: ui.ink, fontWeight: '700', fontSize: 12 }}>Painel</Text>
            </Pressable>
          </View>

          <View style={styles.stage}>
            <MapCanvas
              grid={editor.grid}
              previewCells={editor.previewCells}
              hoverBlock={editor.hoverBlock}
              colors={editor.allColors}
              activeTool={editor.activeTool}
              brushSize={editor.activeTool === TOOLS.FILL ? 1 : editor.brushSize}
              clampStroke={clampStroke}
              theme={theme}
              centerCellAxes={editor.centerCellAxes}
              panMode={panMode}
              onTogglePanMode={() => setPanMode((on) => !on)}
              onHover={editor.setHover}
              onStrokeStart={editor.beginStroke}
              onStrokeMove={editor.continueStroke}
              onStrokeEnd={editor.endStroke}
              onZoomChange={setZoom}
              onLodChange={setLod}
            />
          </View>

          <ToolStrip
            activeTool={editor.activeTool}
            theme={theme}
            onSetTool={(id) => {
              setPanMode(false)
              editor.setTool(id)
            }}
            onPerfect={() => {
              setPerfectX(String(editor.gridSize.width))
              setPerfectY(String(editor.gridSize.height))
              setPerfectOpen(true)
            }}
          />

          <View style={[styles.status, { backgroundColor: ui.status, borderTopColor: ui.line }]}>
            <Text style={{ color: ui.inkDim, fontSize: 11 }} numberOfLines={1}>
              {editor.gridSize.width}×{editor.gridSize.height} · {editor.activeToolMeta.label}
              {editor.isDrawing ? ' · desenhando' : ''} · zoom {Math.round(zoom * 100)}%
              {lod > 1 ? ` · LOD ${lod}×${lod}` : ''}
              {editor.fileMessage ? ` · ${editor.fileMessage}` : ''}
            </Text>
            <Text style={{ color: ui.inkDim, fontSize: 11 }} numberOfLines={1}>
              1 dedo pinta · 2 dedos move · pinça dá zoom
            </Text>
          </View>

          <EditorSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} theme={theme} editor={editor} />

          <Modal visible={perfectOpen} transparent animationType="fade" onRequestClose={() => setPerfectOpen(false)}>
            <View style={styles.modalBack}>
              <View style={[styles.modal, { backgroundColor: ui.panel, borderColor: ui.line }]}>
                <Text style={{ color: ui.ink, fontWeight: '700', fontSize: 16 }}>Forma perfeita</Text>
                <Text style={{ color: ui.inkDim, fontSize: 13 }}>
                  Elipse centrada na origem. Máximo {editor.gridSize.width} × {editor.gridSize.height}.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={perfectX}
                    onChangeText={setPerfectX}
                    keyboardType="number-pad"
                    style={[styles.name, { flex: 1, color: ui.ink, borderColor: ui.line, backgroundColor: ui.input }]}
                  />
                  <TextInput
                    value={perfectY}
                    onChangeText={setPerfectY}
                    keyboardType="number-pad"
                    style={[styles.name, { flex: 1, color: ui.ink, borderColor: ui.line, backgroundColor: ui.input }]}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable style={[styles.chip, { flex: 1, borderColor: ui.line }]} onPress={() => setPerfectOpen(false)}>
                    <Text style={{ color: ui.ink }}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={[styles.chip, { flex: 1, backgroundColor: ui.brass, borderColor: ui.brass }]} onPress={confirmPerfect}>
                    <Text style={{ color: '#1a150c', fontWeight: '700' }}>Criar</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  kicker: { fontSize: 11, letterSpacing: 2, fontWeight: '700', marginBottom: 4 },
  name: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontWeight: '600' },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  stage: { flex: 1, minHeight: 0, marginHorizontal: 8, borderRadius: 12, overflow: 'hidden' },
  status: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  modal: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
})
