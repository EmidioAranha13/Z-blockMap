/**
 * Árvore de camadas e grupos.
 *
 * Cada camada tem a própria grade (mesmo X×Y do cartesiano) e um deslocamento
 * em blocos. Grupos só organizam filhas: visibilidade e movimento no grupo
 * se aplicam a todas as camadas descendentes.
 */
import { cloneGrid, createGrid, resizeGrid } from '@/utils/grid.js'

/**
 * @typedef {object} LayerNode
 * @property {string} id
 * @property {'layer'} type
 * @property {string} name
 * @property {boolean} visible
 * @property {number} offsetX
 * @property {number} offsetY
 * @property {number[][]} grid
 */

/**
 * @typedef {object} GroupNode
 * @property {string} id
 * @property {'group'} type
 * @property {string} name
 * @property {boolean} visible
 * @property {boolean} collapsed
 * @property {Array<LayerNode | GroupNode>} children
 */

let nextId = 1

/**
 * Gera um id único para camada ou grupo nesta sessão.
 * @param {'layer' | 'group'} kind
 */
export function newNodeId(kind) {
  const id = `${kind}-${nextId}`
  nextId += 1
  return id
}

/**
 * Cria uma camada vazia do tamanho do cartesiano.
 * @param {number} width
 * @param {number} height
 * @param {string} name
 * @returns {LayerNode}
 */
export function createLayer(width, height, name = 'Camada') {
  return {
    id: newNodeId('layer'),
    type: 'layer',
    name,
    visible: true,
    offsetX: 0,
    offsetY: 0,
    grid: createGrid(width, height, 0),
  }
}

/**
 * Cria um grupo vazio.
 * @param {string} name
 * @param {Array<LayerNode | GroupNode>} [children]
 * @returns {GroupNode}
 */
export function createGroup(name = 'Grupo', children = []) {
  return {
    id: newNodeId('group'),
    type: 'group',
    name,
    visible: true,
    collapsed: false,
    children,
  }
}

/**
 * Cópia profunda da árvore (incluindo as grades).
 * @param {Array<LayerNode | GroupNode>} nodes
 */
export function cloneLayerTree(nodes) {
  return nodes.map((node) => {
    if (node.type === 'group') {
      return {
        ...node,
        children: cloneLayerTree(node.children),
      }
    }
    return {
      ...node,
      grid: cloneGrid(node.grid),
    }
  })
}

/**
 * Percorre a árvore em ordem de pintura (primeiro = atrás).
 * @param {Array<LayerNode | GroupNode>} nodes
 * @param {(node: LayerNode | GroupNode, parentVisible: boolean) => void} visit
 * @param {boolean} [parentVisible]
 */
export function walkTree(nodes, visit, parentVisible = true) {
  for (const node of nodes) {
    const visible = parentVisible && node.visible
    visit(node, visible)
    if (node.type === 'group') {
      walkTree(node.children, visit, visible)
    }
  }
}

/**
 * Camadas visíveis, na ordem em que devem ser pintadas (fundo → topo).
 * @param {Array<LayerNode | GroupNode>} nodes
 * @returns {LayerNode[]}
 */
export function visibleLayers(nodes) {
  const list = []
  walkTree(nodes, (node, visible) => {
    if (node.type === 'layer' && visible) list.push(node)
  })
  return list
}

/**
 * Localiza um nó pelo id.
 * @param {Array<LayerNode | GroupNode>} nodes
 * @param {string} id
 * @returns {LayerNode | GroupNode | null}
 */
export function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.type === 'group') {
      const found = findNode(node.children, id)
      if (found) return found
    }
  }
  return null
}

/**
 * Aplica fn em todas as camadas-folha sob o nó (ele próprio se for camada).
 * @param {LayerNode | GroupNode} node
 * @param {(layer: LayerNode) => void} fn
 */
export function forEachLayer(node, fn) {
  if (node.type === 'layer') {
    fn(node)
    return
  }
  for (const child of node.children) {
    forEachLayer(child, fn)
  }
}

/**
 * Propaga visibilidade do grupo para todas as filhas (ação em cascata).
 * @param {LayerNode | GroupNode} node
 * @param {boolean} visible
 */
export function setTreeVisible(node, visible) {
  node.visible = visible
  if (node.type === 'group') {
    for (const child of node.children) {
      setTreeVisible(child, visible)
    }
  }
}

/**
 * Soma um deslocamento em todas as camadas sob o nó.
 * @param {LayerNode | GroupNode} node
 * @param {number} dx
 * @param {number} dy
 */
export function nudgeTree(node, dx, dy) {
  forEachLayer(node, (layer) => {
    layer.offsetX += dx
    layer.offsetY += dy
  })
}

/**
 * Redimensiona a grade de todas as camadas, preservando o que ainda cabe.
 * @param {Array<LayerNode | GroupNode>} nodes
 * @param {number} width
 * @param {number} height
 */
export function resizeLayerTree(nodes, width, height) {
  walkTree(nodes, (node) => {
    if (node.type === 'layer') {
      node.grid = resizeGrid(node.grid, width, height)
    }
  })
}

/**
 * Monta a grade final do cartesiano: camadas visíveis, da de trás para a da frente.
 * Célula 0 é transparente (mostra o que está abaixo / vazio).
 *
 * @param {Array<LayerNode | GroupNode>} nodes
 * @param {number} width
 * @param {number} height
 * @returns {number[][]}
 */
export function compositeLayerTree(nodes, width, height) {
  const out = createGrid(width, height, 0)
  const layers = visibleLayers(nodes)
  for (const layer of layers) {
    const rows = layer.grid.length
    const cols = rows > 0 ? layer.grid[0].length : 0
    for (let y = 0; y < rows; y += 1) {
      const wy = y + layer.offsetY
      if (wy < 0 || wy >= height) continue
      for (let x = 0; x < cols; x += 1) {
        const wx = x + layer.offsetX
        if (wx < 0 || wx >= width) continue
        const value = layer.grid[y][x]
        if (value !== 0) out[wy][wx] = value
      }
    }
  }
  return out
}

/**
 * Remove o nó da árvore. Devolve true se encontrou.
 * Não deixa a árvore vazia — o chamador deve garantir ao menos uma camada.
 * @param {Array<LayerNode | GroupNode>} nodes
 * @param {string} id
 */
export function removeNode(nodes, id) {
  const index = nodes.findIndex((node) => node.id === id)
  if (index >= 0) {
    nodes.splice(index, 1)
    return true
  }
  for (const node of nodes) {
    if (node.type === 'group' && removeNode(node.children, id)) return true
  }
  return false
}

/**
 * Move o nó uma posição na lista do pai (dir = -1 sobe na lista / vai para trás na pintura).
 * @param {Array<LayerNode | GroupNode>} nodes
 * @param {string} id
 * @param {number} dir
 */
export function moveNodeAmongSiblings(nodes, id, dir) {
  const index = nodes.findIndex((node) => node.id === id)
  if (index >= 0) {
    const next = index + dir
    if (next < 0 || next >= nodes.length) return false
    const [item] = nodes.splice(index, 1)
    nodes.splice(next, 0, item)
    return true
  }
  for (const node of nodes) {
    if (node.type === 'group' && moveNodeAmongSiblings(node.children, id, dir)) {
      return true
    }
  }
  return false
}

/**
 * Conta camadas-folha na árvore.
 * @param {Array<LayerNode | GroupNode>} nodes
 */
export function countLayers(nodes) {
  let total = 0
  walkTree(nodes, (node) => {
    if (node.type === 'layer') total += 1
  })
  return total
}

/**
 * Restaura o gerador de ids após carregar um arquivo.
 * @param {Array<LayerNode | GroupNode>} nodes
 */
export function syncIdCounter(nodes) {
  let max = 0
  walkTree(nodes, (node) => {
    const match = String(node.id).match(/(\d+)$/)
    if (match) max = Math.max(max, Number(match[1]))
  })
  nextId = max + 1
}

/**
 * Serializa a árvore para JSON (grades incluídas).
 * @param {Array<LayerNode | GroupNode>} nodes
 */
export function serializeLayerTree(nodes) {
  return nodes.map((node) => {
    if (node.type === 'group') {
      return {
        id: node.id,
        type: 'group',
        name: node.name,
        visible: node.visible,
        collapsed: node.collapsed,
        children: serializeLayerTree(node.children),
      }
    }
    return {
      id: node.id,
      type: 'layer',
      name: node.name,
      visible: node.visible,
      offsetX: node.offsetX,
      offsetY: node.offsetY,
      grid: node.grid,
    }
  })
}
