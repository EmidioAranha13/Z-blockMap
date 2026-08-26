/**
 * Rasterização de formas em coordenadas de bloco.
 *
 * As funções devolvem listas de { x, y } já em índices da grade.
 * Quem chama deve filtrar os pontos que caem fora do mapa (ver clipCells).
 */

/**
 * Remove duplicatas e pontos fora do retângulo [0, width) x [0, height).
 * @param {Array<{ x: number, y: number }>} cells
 * @param {number} width
 * @param {number} height
 * @returns {Array<{ x: number, y: number }>}
 */
export function clipCells(cells, width, height) {
  const seen = new Set()
  const result = []

  for (const cell of cells) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= width || cell.y >= height) {
      continue
    }
    const key = `${cell.x},${cell.y}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(cell)
  }

  return result
}

/**
 * Algoritmo de Bresenham: todos os blocos de uma linha reta entre dois pontos.
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {Array<{ x: number, y: number }>}
 */
export function getLineCells(x0, y0, x1, y1) {
  const cells = []
  let x = x0
  let y = y0
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let error = dx - dy

  while (true) {
    cells.push({ x, y })
    if (x === x1 && y === y1) break

    const doubled = 2 * error
    if (doubled > -dy) {
      error -= dy
      x += sx
    }
    if (doubled < dx) {
      error += dx
      y += sy
    }
  }

  return cells
}

/**
 * Elipse (ou círculo) inscrita no retângulo de blocos entre origem e destino.
 * O clique inicial é um canto da caixa; o cursor é o canto oposto. Se |dx|
 * e |dy| forem iguais, a forma é um círculo; senão, uma elipse.
 *
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number, cx: number, cy: number, rx: number, ry: number }}
 */
function ellipseBox(x0, y0, x1, y1) {
  const minX = Math.min(x0, x1)
  const maxX = Math.max(x0, x1)
  const minY = Math.min(y0, y1)
  const maxY = Math.max(y0, y1)
  const width = maxX - minX + 1
  const height = maxY - minY + 1
  return {
    minX,
    maxX,
    minY,
    maxY,
    cx: minX + width / 2,
    cy: minY + height / 2,
    rx: width / 2,
    ry: height / 2,
  }
}

/**
 * Bloco (x, y) está dentro da elipse inscrita na caixa (teste no centro do bloco).
 * @param {number} x
 * @param {number} y
 * @param {{ cx: number, cy: number, rx: number, ry: number }} box
 */
function cellInsideEllipse(x, y, box) {
  const nx = (x + 0.5 - box.cx) / box.rx
  const ny = (y + 0.5 - box.cy) / box.ry
  return nx * nx + ny * ny <= 1
}

/**
 * Contorno da elipse/círculo definido pelos cantos (x0,y0) e (x1,y1).
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {Array<{ x: number, y: number }>}
 */
export function getEllipseOutlineCells(x0, y0, x1, y1) {
  const filled = getEllipseFilledCells(x0, y0, x1, y1)
  const inside = new Set(filled.map((cell) => `${cell.x},${cell.y}`))
  const outline = []

  for (const cell of filled) {
    const edge =
      !inside.has(`${cell.x - 1},${cell.y}`) ||
      !inside.has(`${cell.x + 1},${cell.y}`) ||
      !inside.has(`${cell.x},${cell.y - 1}`) ||
      !inside.has(`${cell.x},${cell.y + 1}`)
    if (edge) outline.push(cell)
  }

  return outline
}

/**
 * Elipse/círculo preenchido definido pelos cantos (x0,y0) e (x1,y1).
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {Array<{ x: number, y: number }>}
 */
export function getEllipseFilledCells(x0, y0, x1, y1) {
  const box = ellipseBox(x0, y0, x1, y1)
  const cells = []

  for (let y = box.minY; y <= box.maxY; y += 1) {
    for (let x = box.minX; x <= box.maxX; x += 1) {
      if (cellInsideEllipse(x, y, box)) {
        cells.push({ x, y })
      }
    }
  }

  return cells
}

/**
 * Caixa de uma elipse centrada na origem do cartesiano.
 * sizeX e sizeY são a largura e a altura em blocos (já limitadas ao mapa).
 *
 * Sem eixo no bloco central: o eixo cai na linha floor(n/2); lados iguais
 * quando o tamanho é par.
 * Com eixo no bloco central (ímpar): o bloco do meio é o centro da forma.
 *
 * @param {number} cols
 * @param {number} rows
 * @param {number} sizeX
 * @param {number} sizeY
 * @param {boolean} centerCellAxes
 * @returns {{ x0: number, y0: number, x1: number, y1: number }}
 */
export function originCenteredEllipseBox(cols, rows, sizeX, sizeY, centerCellAxes) {
  const w = Math.min(cols, Math.max(1, Math.floor(Number(sizeX)) || 1))
  const h = Math.min(rows, Math.max(1, Math.floor(Number(sizeY)) || 1))
  const midX = Math.floor(cols / 2)
  const midY = Math.floor(rows / 2)
  const throughX = !!centerCellAxes && cols % 2 === 1
  const throughY = !!centerCellAxes && rows % 2 === 1
  const x0 = throughX ? midX - Math.floor((w - 1) / 2) : midX - Math.floor(w / 2)
  const y0 = throughY ? midY - Math.floor((h - 1) / 2) : midY - Math.floor(h / 2)
  return { x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 }
}

/**
 * Expande cada bloco para um carimbo de size×size (1, 2 ou 3).
 * 1×1 e 2×2: o bloco clicado é o canto superior esquerdo.
 * 3×3: o bloco clicado é o centro (quinta célula).
 *
 * @param {Array<{ x: number, y: number }>} cells
 * @param {number} size
 * @returns {Array<{ x: number, y: number }>}
 */
export function expandBrush(cells, size) {
  const stamp = Math.max(1, Math.min(3, Math.floor(size) || 1))
  if (stamp === 1) return cells
  const originOffset = stamp === 3 ? -1 : 0
  const out = []
  for (const cell of cells) {
    for (let dy = 0; dy < stamp; dy += 1) {
      for (let dx = 0; dx < stamp; dx += 1) {
        out.push({ x: cell.x + originOffset + dx, y: cell.y + originOffset + dy })
      }
    }
  }
  return out
}

/**
 * Monta a lista de blocos da forma em construção, de acordo com a ferramenta.
 *
 * @param {'line' | 'circle'} tool
 * @param {{ x: number, y: number }} origin  Bloco do pointerdown (canto da caixa)
 * @param {{ x: number, y: number }} current Bloco atual do cursor (canto oposto)
 * @param {boolean} filled  Se verdadeiro, o círculo/elipse vem preenchido
 * @param {number} width    Largura da grade (para recortar)
 * @param {number} height   Altura da grade (para recortar)
 * @param {number} [brushSize=1] Espessura 1–3
 * @returns {Array<{ x: number, y: number }>}
 */
export function getShapeCells(tool, origin, current, filled, width, height, brushSize = 1) {
  let cells = []

  if (tool === 'line') {
    cells = getLineCells(origin.x, origin.y, current.x, current.y)
  } else if (tool === 'circle') {
    cells = filled
      ? getEllipseFilledCells(origin.x, origin.y, current.x, current.y)
      : getEllipseOutlineCells(origin.x, origin.y, current.x, current.y)
  }

  return clipCells(expandBrush(cells, brushSize), width, height)
}
