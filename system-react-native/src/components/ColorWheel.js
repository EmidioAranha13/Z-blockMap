import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { UI } from '../theme.js'

function hsvToHex(h, s, v) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const to = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function Band({ label, value, color, theme, onChange }) {
  const ui = UI[theme]
  return (
    <View style={styles.band}>
      <Text style={[styles.bandLabel, { color: ui.inkDim }]}>{label}</Text>
      <View
        style={[styles.track, { backgroundColor: ui.input, borderColor: ui.line }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => onChange(e.nativeEvent.locationX)}
        onResponderMove={(e) => onChange(e.nativeEvent.locationX)}
      >
        <View style={[styles.fill, { width: `${Math.round(value * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  )
}

export default function ColorWheel({ theme, onCommit }) {
  const ui = UI[theme]
  const [h, setH] = useState(35)
  const [s, setS] = useState(0.55)
  const [v, setV] = useState(0.77)
  const hex = useMemo(() => hsvToHex(h, s, v), [h, s, v])

  const setFromX = (setter, max, width) => (x) => {
    const t = Math.min(1, Math.max(0, x / Math.max(1, width)))
    setter(t * max)
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.preview, { backgroundColor: hex, borderColor: ui.line }]} />
      <Text style={[styles.hex, { color: ui.ink }]}>{hex}</Text>
      <Band
        label="Matiz"
        value={h / 360}
        color={ui.brass}
        theme={theme}
        onChange={(x) => setH(Math.min(359, Math.max(0, (x / 220) * 360)))}
      />
      <Band label="Saturação" value={s} color={ui.brass} theme={theme} onChange={(x) => setS(Math.min(1, Math.max(0, x / 220)))} />
      <Band label="Brilho" value={v} color={ui.brass} theme={theme} onChange={(x) => setV(Math.min(1, Math.max(0, x / 220)))} />
      <Pressable style={[styles.add, { backgroundColor: ui.brass }]} onPress={() => onCommit(hex)}>
        <Text style={styles.addTxt}>Adicionar esta cor</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  preview: { height: 36, borderRadius: 8, borderWidth: 1 },
  hex: { fontFamily: 'monospace', fontSize: 13 },
  band: { gap: 4 },
  bandLabel: { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  track: { height: 22, borderRadius: 6, borderWidth: 1, overflow: 'hidden' },
  fill: { height: '100%' },
  add: { borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  addTxt: { color: '#1a150c', fontWeight: '700' },
})
