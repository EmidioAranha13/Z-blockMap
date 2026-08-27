import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { COMPACT_ACTION_META, PERFECT_TOOL_META, SHAPE_TOOL_META, TOOLS } from '../constants/tools.js'
import { UI } from '../theme.js'
import penIcon from '../assets/pen.png'
import borrachaIcon from '../assets/borracha.png'
import tintaIcon from '../assets/tinta.png'
import perfectIcon from '../assets/perfect.png'
import moveDesenhoIcon from '../assets/move_desenho.png'

const ICONS = {
  [TOOLS.PENCIL]: penIcon,
  [TOOLS.ERASER]: borrachaIcon,
  [TOOLS.FILL]: tintaIcon,
  [PERFECT_TOOL_META.id]: perfectIcon,
  [TOOLS.MOVE]: moveDesenhoIcon,
}

export default function ToolStrip({ activeTool, theme, onSetTool, onPerfect }) {
  const ui = UI[theme] || UI.dark

  function onPress(tool) {
    if (tool.id === PERFECT_TOOL_META.id) {
      onPerfect()
      return
    }
    onSetTool(tool.id)
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        {COMPACT_ACTION_META.map((tool) => (
          <Pressable
            key={tool.id}
            onPress={() => onPress(tool)}
            accessibilityLabel={`${tool.label}. ${tool.blurb}`}
            style={[
              styles.btn,
              { borderColor: ui.line, backgroundColor: ui.raised },
              activeTool === tool.id && { borderColor: ui.brass, backgroundColor: ui.toolOn },
            ]}
          >
            <Image source={ICONS[tool.id]} style={[styles.icon, { tintColor: ui.iconTint }]} />
            {tool.shortcut ? (
              <Text style={[styles.shortcut, { color: ui.inkDim, backgroundColor: ui.input }]}>{tool.shortcut}</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
      <View style={styles.grid}>
        {SHAPE_TOOL_META.map((tool) => (
          <Pressable
            key={tool.id}
            onPress={() => onSetTool(tool.id)}
            accessibilityLabel={`${tool.label}. ${tool.blurb}`}
            style={[
              styles.btn,
              { borderColor: ui.line, backgroundColor: ui.raised },
              activeTool === tool.id && { borderColor: ui.brass, backgroundColor: ui.toolOn },
            ]}
          >
            <Text style={[styles.glyph, { color: ui.ink }]}>{tool.glyph}</Text>
            <Text style={[styles.shortcut, { color: ui.inkDim, backgroundColor: ui.input }]}>{tool.shortcut}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6, paddingHorizontal: 10, paddingVertical: 8 },
  grid: { flexDirection: 'row', gap: 6 },
  btn: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  icon: { width: 18, height: 18 },
  glyph: { fontSize: 16, lineHeight: 18 },
  shortcut: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
})
