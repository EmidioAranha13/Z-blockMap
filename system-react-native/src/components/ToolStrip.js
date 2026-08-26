import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { TOOL_META, TOOLS } from '../constants/tools.js'
import { UI } from '../theme.js'
import penIcon from '../assets/pen.png'
import borrachaIcon from '../assets/borracha.png'
import tintaIcon from '../assets/tinta.png'
import linhaIcon from '../assets/linha.png'
import circuloIcon from '../assets/circulo.png'
import perfectIcon from '../assets/perfect.png'
import moveDesenhoIcon from '../assets/move_desenho.png'

const ICONS = {
  [TOOLS.PENCIL]: penIcon,
  [TOOLS.ERASER]: borrachaIcon,
  [TOOLS.FILL]: tintaIcon,
  [TOOLS.LINE]: linhaIcon,
  [TOOLS.CIRCLE]: circuloIcon,
  [TOOLS.MOVE]: moveDesenhoIcon,
}

export default function ToolStrip({ activeTool, theme, onSetTool, onPerfect }) {
  const ui = UI[theme] || UI.dark
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {TOOL_META.map((tool) => (
        <Pressable
          key={tool.id}
          onPress={() => onSetTool(tool.id)}
          style={[
            styles.btn,
            { borderColor: ui.line, backgroundColor: ui.raised },
            activeTool === tool.id && { borderColor: ui.brass, backgroundColor: ui.toolOn },
          ]}
        >
          <Image source={ICONS[tool.id]} style={[styles.icon, { tintColor: ui.iconTint }]} />
          <Text style={[styles.label, { color: ui.ink }]} numberOfLines={1}>
            {tool.label}
          </Text>
        </Pressable>
      ))}
      <Pressable
        onPress={onPerfect}
        style={[styles.btn, { borderColor: ui.line, backgroundColor: ui.raised }]}
      >
        <Image source={perfectIcon} style={[styles.icon, { tintColor: ui.iconTint }]} />
        <Text style={[styles.label, { color: ui.ink }]} numberOfLines={1}>
          Perfeita
        </Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: 6, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  btn: {
    minWidth: 64,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  icon: { width: 20, height: 20 },
  label: { fontSize: 10, fontWeight: '600' },
})
