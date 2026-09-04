import { useState } from 'react'
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { UI } from '../theme.js'
import ColorWheel from './ColorWheel.js'
import LayerList from './LayerList.js'
import padlockLocked from '../assets/padlock1.png'
import padlockOpen from '../assets/padlock2.png'

const TABS = [
  { id: 'escala', label: 'Escala' },
  { id: 'camadas', label: 'Camadas' },
  { id: 'cores', label: 'Cores' },
  { id: 'extras', label: 'Extras' },
]

export default function EditorSheet({ visible, onClose, theme, editor }) {
  const ui = UI[theme]
  const [tab, setTab] = useState('escala')
  const odd = editor.gridSize.width % 2 === 1 && editor.gridSize.height % 2 === 1

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.back}>
        <View style={[styles.sheet, { backgroundColor: ui.panel }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: ui.brass }]}>PAINEL</Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: ui.ink, fontWeight: '700' }}>Fechar</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {TABS.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={[
                  styles.tab,
                  { borderColor: ui.line },
                  tab === item.id && { borderColor: ui.brass, backgroundColor: ui.toolOn },
                ]}
              >
                <Text style={{ color: tab === item.id ? ui.brass : ui.ink, fontWeight: '700', fontSize: 12 }}>
                  {item.label.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView style={styles.body} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
            {tab === 'escala' ? (
              <>
                <Text style={{ color: ui.inkDim, fontSize: 13 }}>
                  Mapa atual {editor.gridSize.width} × {editor.gridSize.height}. Máximo 500.
                </Text>
                <View style={styles.row}>
                  <Pressable
                    onPress={editor.toggleScaleLock}
                    style={[
                      styles.lock,
                      { borderColor: ui.line, backgroundColor: ui.raised },
                      editor.scaleLocked && { borderColor: ui.brass, backgroundColor: ui.toolOn },
                    ]}
                  >
                    <Image
                      source={editor.scaleLocked ? padlockLocked : padlockOpen}
                      style={{ width: 22, height: 22, tintColor: ui.iconTint }}
                    />
                  </Pressable>
                  <Field
                    label="X"
                    value={String(editor.scaleInput.x)}
                    theme={theme}
                    onChange={(t) => editor.onScaleField('x', Number(t))}
                  />
                  <Text style={{ color: ui.brass, fontSize: 18 }}>×</Text>
                  <Field
                    label="Y"
                    value={String(editor.scaleInput.y)}
                    theme={theme}
                    editable={!editor.scaleLocked}
                    onChange={(t) => editor.onScaleField('y', Number(t))}
                  />
                </View>
                <Pressable style={[styles.apply, { backgroundColor: ui.brass }]} onPress={editor.applyScale}>
                  <Text style={styles.applyTxt}>Criar mapa</Text>
                </Pressable>
                <View style={styles.row}>
                  <Switch
                    value={editor.centerCellAxes && odd}
                    disabled={!odd}
                    onValueChange={editor.setCenterCellAxes}
                  />
                  <Text style={{ color: ui.ink, flex: 1 }}>Eixo no bloco central (só ímpar × ímpar)</Text>
                </View>
              </>
            ) : null}

            {tab === 'camadas' ? (
              <>
                <LayerList
                  tree={editor.layerTree}
                  activeId={editor.activeNodeId}
                  theme={theme}
                  onSelect={editor.selectNode}
                  onToggleVisible={editor.toggleNodeVisible}
                  onRename={editor.renameNode}
                  onToggleCollapsed={editor.toggleGroupCollapsed}
                />
                <View style={styles.wrapBtns}>
                  <Ghost theme={theme} label="+ Camada" onPress={editor.addLayer} />
                  <Ghost theme={theme} label="+ Grupo" onPress={editor.addGroup} />
                  <Ghost theme={theme} label="Duplicar" onPress={editor.duplicateNode} />
                  <Ghost theme={theme} label="Inverter H" onPress={() => editor.flipActiveLayer('h')} />
                  <Ghost theme={theme} label="Inverter V" onPress={() => editor.flipActiveLayer('v')} />
                  <Ghost theme={theme} label="Agrupar" onPress={editor.groupSelection} />
                  <Ghost theme={theme} label="↑" onPress={() => editor.shiftNode(1)} />
                  <Ghost theme={theme} label="↓" onPress={() => editor.shiftNode(-1)} />
                  <Ghost theme={theme} label="Excluir" danger onPress={editor.deleteNode} />
                </View>
              </>
            ) : null}

            {tab === 'cores' ? (
              <>
                {editor.selectedColorInfo ? (
                  <View style={styles.row}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: editor.selectedColorInfo.hex,
                        borderWidth: 1,
                        borderColor: ui.line,
                      }}
                    />
                    <Field
                      label="Nome"
                      value={editor.selectedColorInfo.name}
                      theme={theme}
                      onChange={(t) => editor.renameColor(editor.selectedColor, t)}
                    />
                    <Field
                      label="Hex"
                      value={editor.selectedColorInfo.hex}
                      theme={theme}
                      editable={editor.selectedColor !== 0}
                      onChange={(t) => editor.recolor(editor.selectedColor, t)}
                    />
                  </View>
                ) : null}
                <Text style={[styles.kicker, { color: ui.brass }]}>FIXAS</Text>
                <View style={styles.swatches}>
                  {editor.fixedColors.map((swatch) => (
                    <Pressable
                      key={swatch.id}
                      onPress={() => editor.setColor(swatch.id)}
                      style={[
                        styles.swatch,
                        { backgroundColor: swatch.hex },
                        editor.selectedColor === swatch.id && { borderColor: ui.brass, borderWidth: 2 },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.kicker, { color: ui.brass }]}>DA RODA</Text>
                <View style={styles.swatches}>
                  {editor.recentCustom.map((swatch) => (
                    <Pressable
                      key={swatch.id}
                      onPress={() => editor.setColor(swatch.id)}
                      style={[
                        styles.swatch,
                        { backgroundColor: swatch.hex },
                        editor.selectedColor === swatch.id && { borderColor: ui.brass, borderWidth: 2 },
                      ]}
                    />
                  ))}
                </View>
                <ColorWheel theme={theme} onCommit={editor.commitWheelColor} />
              </>
            ) : null}

            {tab === 'extras' ? (
              <>
                <View style={styles.row}>
                  <Ghost theme={theme} label="Undo" disabled={!editor.canUndo} onPress={editor.undo} />
                  <Ghost theme={theme} label="Redo" disabled={!editor.canRedo} onPress={editor.redo} />
                </View>
                <Ghost theme={theme} label="Salvar mapa" onPress={editor.saveMapFile} />
                <Ghost theme={theme} label="Carregar mapa" onPress={editor.loadMapFile} />
                <Ghost theme={theme} label="Salvar PNG" onPress={() => editor.savePng(theme)} />
                <Ghost theme={theme} label="Limpar mapa" danger onPress={editor.clearMap} />
                <View style={styles.row}>
                  <Switch value={editor.fillShapes} onValueChange={editor.setFillShapes} />
                  <Text style={{ color: ui.ink }}>Preencher forma</Text>
                </View>
                <View style={styles.row}>
                  <Switch value={editor.alphaPaint} onValueChange={editor.setAlphaPaint} />
                  <Text style={{ color: ui.ink }}>Pintura alfa</Text>
                </View>
                <Text style={{ color: ui.ink, fontWeight: '700', marginTop: 4 }}>Simetria espelhada</Text>
                <View style={styles.col}>
                  <View style={styles.row}>
                    <Switch value={editor.mirrorX} onValueChange={editor.setMirrorX} />
                    <Text style={{ color: ui.ink }}>Horizontal</Text>
                  </View>
                  <View style={styles.row}>
                    <Switch value={editor.mirrorY} onValueChange={editor.setMirrorY} />
                    <Text style={{ color: ui.ink }}>Vertical</Text>
                  </View>
                </View>
                <Text style={{ color: ui.inkDim }}>Pixels</Text>
                <View style={styles.row}>
                  {[1, 2, 3].map((size) => (
                    <Ghost
                      key={size}
                      theme={theme}
                      label={`${size}×${size}`}
                      onPress={() => editor.setBrushSize(size)}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function Field({ label, value, onChange, theme, editable = true }) {
  const ui = UI[theme]
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: ui.inkDim, fontSize: 11 }}>{label}</Text>
      <TextInput
        value={value}
        editable={editable}
        onChangeText={onChange}
        keyboardType={label === 'Hex' || label === 'Nome' ? 'default' : 'number-pad'}
        style={{
          borderWidth: 1,
          borderColor: ui.line,
          borderRadius: 8,
          padding: 8,
          color: ui.ink,
          backgroundColor: ui.input,
        }}
      />
    </View>
  )
}

function Ghost({ theme, label, onPress, danger, disabled }) {
  const ui = UI[theme]
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flexGrow: 1,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: danger ? ui.danger : ui.line,
        opacity: disabled ? 0.4 : 1,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: danger ? ui.dangerText : ui.ink, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  back: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '86%', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { letterSpacing: 2, fontWeight: '700', fontSize: 12 },
  tabs: { gap: 6, paddingBottom: 10 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  body: { minHeight: 220 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  col: { gap: 6 },
  lock: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  apply: { borderRadius: 8, padding: 12, alignItems: 'center' },
  applyTxt: { color: '#1a150c', fontWeight: '700' },
  wrapBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kicker: { fontSize: 11, letterSpacing: 1.4 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatch: { width: 32, height: 32, borderRadius: 6, borderWidth: 1, borderColor: 'transparent' },
})
