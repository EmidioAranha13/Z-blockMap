import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { UI } from '../theme.js'
import openEye from '../assets/open_eye.png'
import closeEye from '../assets/close_eye.png'

function Row({ node, activeId, depth, theme, onSelect, onToggleVisible, onRename, onToggleCollapsed }) {
  const ui = UI[theme]
  const on = activeId === node.id
  return (
    <View>
      <Pressable
        onPress={() => onSelect(node.id)}
        style={[
          styles.item,
          { paddingLeft: 6 + depth * 12, borderColor: ui.line, backgroundColor: on ? ui.toolOn : 'transparent' },
          on && { borderLeftWidth: 3, borderLeftColor: ui.brass },
        ]}
      >
        {node.type === 'group' ? (
          <Pressable onPress={() => onToggleCollapsed(node.id)} hitSlop={8}>
            <Text style={{ color: ui.ink }}>{node.collapsed ? '▸' : '▾'}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => onToggleVisible(node.id)} hitSlop={8}>
          <Image source={node.visible ? openEye : closeEye} style={[styles.eye, { tintColor: ui.iconTint }]} />
        </Pressable>
        <TextInput
          value={node.name}
          onChangeText={(name) => onRename(node.id, name)}
          style={[styles.name, { color: ui.ink }]}
        />
      </Pressable>
      {node.type === 'group' && !node.collapsed
        ? [...node.children].reverse().map((child) => (
            <Row
              key={child.id}
              node={child}
              activeId={activeId}
              depth={depth + 1}
              theme={theme}
              onSelect={onSelect}
              onToggleVisible={onToggleVisible}
              onRename={onRename}
              onToggleCollapsed={onToggleCollapsed}
            />
          ))
        : null}
    </View>
  )
}

export default function LayerList({ tree, activeId, theme, ...handlers }) {
  return (
    <View style={styles.tree}>
      {[...tree].reverse().map((node) => (
        <Row key={node.id} node={node} activeId={activeId} depth={0} theme={theme} {...handlers} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  tree: { borderRadius: 8, overflow: 'hidden' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingRight: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  eye: { width: 18, height: 18 },
  name: { flex: 1, padding: 0, fontSize: 14 },
})
