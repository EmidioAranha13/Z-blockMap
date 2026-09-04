/**
 * Árvore de camadas e grupos.
 *
 * Cada camada tem a própria grade (mesmo X×Y do cartesiano).
 * offsetX/Y só existem no arrasto ao vivo da ferramenta Mover; ao soltar,
 * o desenho é copiado na grade e o offset volta a 0.
 */
import { clearGrid, cloneGrid, createGrid, flipGridHorizontal, flipGridVertical, resizeGrid, translateGrid } from '@/utils/grid.js'

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
 * Cópia profunda de um nó, com ids novos (duplicar camada/grupo).
 * @param {LayerNode | GroupNode} node
 * @returns {LayerNode | GroupNode}
 */
export function cloneNodeDeep(node) {
  if (node.type === 'group') {
    return {
      ...node,
      id: newNodeId('group'),
      name: `${node.name} cópia`.slice(0, 40),
      children: (node.children || []).map(cloneNodeDeep),
    }
  }
  return {
    ...node,
    id: newNodeId('layer'),
    name: `${node.name} cópia`.slice(0, 40),
    grid: cloneGrid(node.grid),
  }
}

/**
 * Insere `newNode` logo após o nó `targetId` na lista de irmãos.
 * @param {Array<LayerNode | GroupNode>} nodes
 * @param {string} targetId
 * @param {LayerNode | GroupNode} newNode
 * @returns {boolean}
 */
export function insertNodeAfter(nodes, targetId, newNode) {
  const index = nodes.findIndex((node) => node.id === targetId)
  if (index >= 0) {
    nodes.splice(index + 1, 0, newNode)
    return true
  }
  for (const node of nodes) {
    if (node.type === 'group' && insertNodeAfter(node.children, targetId, newNode)) return true
  }
  return false
}

/**
 * Espelha a grade da camada (ou de todas as camadas do grupo).
 * @param {LayerNode | GroupNode} node
 * @param {'h' | 'v'} axis
 */
export function flipNodeGrids(node, axis) {
  const flip = axis === 'v' ? flipGridVertical : flipGridHorizontal
  forEachLayer(node, (layer) => {
    flip(layer.grid)
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
 * Grava o offset na grade (translada os blocos) e zera o deslocamento.
 * O que cairia fora do cartesiano é descartado.
 * @param {LayerNode} layer
 */
export function bakeLayerOffset(layer) {
  const dx = layer.offsetX || 0
  const dy = layer.offsetY || 0
  if (dx === 0 && dy === 0) return
  layer.grid = translateGrid(layer.grid, dx, dy)
  layer.offsetX = 0
  layer.offsetY = 0
}

/**
 * Grava o offset de todas as camadas da árvore.
 * @param {Array<LayerNode | GroupNode>} nodes
 */
export function bakeTreeOffsets(nodes) {
  walkTree(nodes, (node) => {
    if (node.type === 'layer') bakeLayerOffset(node)
  })
}

/**
 * Soma um deslocamento no desenho de todas as camadas sob o nó.
 * @param {LayerNode | GroupNode} node
 * @param {number} dx
 * @param {number} dy
 */
export function nudgeTree(node, dx, dy) {
  forEachLayer(node, (layer) => {
    layer.grid = translateGrid(layer.grid, dx, dy)
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
  const layers = visibleLayers(nodes)
  if (layers.length === 1) {
    const layer = layers[0]
    const ox = layer.offsetX || 0
    const oy = layer.offsetY || 0
    if (ox === 0 && oy === 0) {
      const rows = layer.grid.length
      const cols = rows > 0 ? layer.grid[0].length : 0
      if (cols === width && rows === height) return layer.grid
    }
  }

  const out = acquireComposite(width, height)
  for (let i = 0; i < layers.length; i += 1) {
    blitLayer(out, layers[i], width, height)
  }
  return out
}

let compositeBuf = null
let compositeW = 0
let compositeH = 0

function acquireComposite(width, height) {
  if (compositeBuf && compositeW === width && compositeH === height) {
    clearGrid(compositeBuf, 0)
    return compositeBuf
  }
  compositeBuf = createGrid(width, height, 0)
  compositeW = width
  compositeH = height
  return compositeBuf
}

function blitLayer(out, layer, width, height) {
  const src = layer.grid
  const rows = src.length
  const cols = rows > 0 ? src[0].length : 0
  const ox = layer.offsetX || 0
  const oy = layer.offsetY || 0
  for (let y = 0; y < rows; y += 1) {
    const wy = y + oy
    if (wy < 0 || wy >= height) continue
    const srcRow = src[y]
    const dstRow = out[wy]
    if (ox === 0) {
      const xEnd = cols < width ? cols : width
      for (let x = 0; x < xEnd; x += 1) {
        const value = srcRow[x]
        if (value !== 0) dstRow[x] = value
      }
    } else {
      for (let x = 0; x < cols; x += 1) {
        const wx = x + ox
        if (wx < 0 || wx >= width) continue
        const value = srcRow[x]
        if (value !== 0) dstRow[wx] = value
      }
    }
  }
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
 * Lista de irmãos que contém o nó, e o índice dele nela.
 * @param {Array<LayerNode | GroupNode>} nodes
 * @param {string} id
 * @returns {{ list: Array<LayerNode | GroupNode>, index: number } | null}
 */
export function findSiblingList(nodes, id) {
  const index = nodes.findIndex((node) => node.id === id)
  if (index >= 0) return { list: nodes, index }
  for (const node of nodes) {
    if (node.type === 'group') {
      const found = findSiblingList(node.children, id)
      if (found) return found
    }
  }
  return null
}

/**
 * Ids de ancestrais do nó (do pai até a raiz), ou null se não achar.
 * @param {Array<LayerNode | GroupNode>} nodes
 * @param {string} id
 * @param {string[]} [trail]
 */
export function ancestorIds(nodes, id, trail = []) {
  for (const node of nodes) {
    if (node.id === id) return trail
    if (node.type === 'group') {
      const found = ancestorIds(node.children, id, [...trail, node.id])
      if (found) return found
    }
  }
  return null
}

/**
 * Remove da seleção os nós que já entram porque o ancestral também está selecionado.
 * @param {Array<LayerNode | GroupNode>} nodes
 * @param {string[]} ids
 */
export function selectedRoots(nodes, ids) {
  const set = new Set(ids)
  return ids.filter((id) => {
    const anc = ancestorIds(nodes, id) || []
    return !anc.some((item) => set.has(item))
  })
}

/**
 * Quantas camadas-folha restam se esses nós (e o que há dentro) saírem.
 * @param {Array<LayerNode | GroupNode>} nodes
 * @param {string[]} ids
 */
export function countLayersAfterRemoval(nodes, ids) {
  const roots = new Set(selectedRoots(nodes, ids))
  let total = 0
  function visit(list, parentRemoved) {
    for (const node of list) {
      const gone = parentRemoved || roots.has(node.id)
      if (node.type === 'layer') {
        if (!gone) total += 1
      } else {
        visit(node.children || [], gone)
      }
    }
  }
  visit(nodes, false)
  return total
}

/**
 * Envolve os ids num grupo novo. Só vale se todos forem irmãos.
 * @param {Array<LayerNode | GroupNode>} nodes
 * @param {string[]} ids
 * @returns {GroupNode | null}
 */
export function groupSiblingIds(nodes, ids) {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return null
  const first = findSiblingList(nodes, unique[0])
  if (!first) return null
  const { list } = first
  const indexes = []
  for (const id of unique) {
    const index = list.findIndex((node) => node.id === id)
    if (index < 0) return null
    indexes.push(index)
  }
  indexes.sort((a, b) => a - b)
  const taken = indexes.map((index) => list[index])
  for (let i = indexes.length - 1; i >= 0; i -= 1) list.splice(indexes[i], 1)
  const group = createGroup('Grupo', taken)
  list.splice(indexes[0], 0, group)
  return group
}

/**
 * Desloca um bloco contíguo de irmãos. Devolve false se não forem contig.
 * @param {Array<LayerNode | GroupNode>} list
 * @param {string[]} ids
 * @param {number} dir
 */
export function moveContiguousSiblings(list, ids, dir) {
  const indexes = ids.map((id) => list.findIndex((node) => node.id === id)).sort((a, b) => a - b)
  if (indexes.length === 0 || indexes.some((index) => index < 0)) return false
  for (let i = 1; i < indexes.length; i += 1) {
    if (indexes[i] !== indexes[i - 1] + 1) return false
  }
  if (dir > 0) {
    const last = indexes[indexes.length - 1]
    if (last >= list.length - 1) return false
    const [after] = list.splice(last + 1, 1)
    list.splice(indexes[0], 0, after)
    return true
  }
  const firstIdx = indexes[0]
  if (firstIdx <= 0) return false
  const [before] = list.splice(firstIdx - 1, 1)
  list.splice(indexes[indexes.length - 1], 0, before)
  return true
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
