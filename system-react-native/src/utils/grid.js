/**
 * Operações sobre a matriz do mapa.
 *
 * A grade é um array bidimensional: grid[linha][coluna] = índice de cor.
 * Linha = Y, coluna = X. O valor 0 significa bloco vazio.
 */

/**
 * Cria uma grade nova preenchida com um valor (por padrão, vazio).
 * @param {number} width  Quantidade de blocos no eixo X (colunas)
 * @param {number} height Quantidade de blocos no eixo Y (linhas)
 * @param {number} fillValue Índice de cor inicial
 * @returns {number[][]}
 */
export function createGrid(width, height, fillValue = 0) {
  const cols = Math.max(1, Math.floor(width))
  const rows = Math.max(1, Math.floor(height))
  const grid = []

  for (let y = 0; y < rows; y += 1) {
    const row = []
    for (let x = 0; x < cols; x += 1) {
      row.push(fillValue)
    }
    grid.push(row)
  }

  return grid
}

/**
 * Cópia profunda da grade. Usada no histórico de desfazer e ao redimensionar.
 * @param {number[][]} grid
 * @returns {number[][]}
 */
export function cloneGrid(grid) {
  return grid.map((row) => row.slice())
}

/**
 * Espelha a grade no eixo vertical (esquerda ↔ direita).
 * @param {number[][]} grid
 */
export function flipGridHorizontal(grid) {
  for (let y = 0; y < grid.length; y += 1) {
    grid[y].reverse()
  }
  return grid
}

/**
 * Espelha a grade no eixo horizontal (cima ↔ baixo).
 * @param {number[][]} grid
 */
export function flipGridVertical(grid) {
  grid.reverse()
  return grid
}

/**
 * Devolve a largura (X) e a altura (Y) da grade.
 * @param {number[][]} grid
 * @returns {{ width: number, height: number }}
 */
export function getGridSize(grid) {
  const height = grid.length
  const width = height > 0 ? grid[0].length : 0
  return { width, height }
}

/**
 * Verifica se o bloco (x, y) está dentro da grade.
 * @param {number[][]} grid
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function inBounds(grid, x, y) {
  const { width, height } = getGridSize(grid)
  return x >= 0 && y >= 0 && x < width && y < height
}

/**
 * Lê a cor de um bloco. Fora da grade devolve 0.
 * @param {number[][]} grid
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function getCell(grid, x, y) {
  if (!inBounds(grid, x, y)) return 0
  return grid[y][x]
}

/**
 * Escreve uma cor em um bloco, se ele existir.
 * Mutação intencional: a reatividade do Vue observa a posição grid[y][x].
 * @param {number[][]} grid
 * @param {number} x
 * @param {number} y
 * @param {number} value
 */
export function setCell(grid, x, y, value) {
  if (!inBounds(grid, x, y)) return
  grid[y][x] = value
}

/**
 * Preenchimento por inundação (4 vizinhos): todos os blocos conectados
 * com a mesma cor do ponto inicial. Se a cor já for a nova, devolve vazio.
 *
 * @param {number[][]} grid
 * @param {number} startX
 * @param {number} startY
 * @param {number} newValue
 * @returns {Array<{ x: number, y: number }>}
 */
export function floodFillCells(grid, startX, startY, newValue) {
  if (!inBounds(grid, startX, startY)) return []
  const target = grid[startY][startX]
  if (target === newValue) return []

  const { width, height } = getGridSize(grid)
  const cells = []
  const stack = [{ x: startX, y: startY }]
  const seen = new Set()

  while (stack.length > 0) {
    const { x, y } = stack.pop()
    const key = `${x},${y}`
    if (seen.has(key)) continue
    if (x < 0 || y < 0 || x >= width || y >= height) continue
    if (grid[y][x] !== target) continue
    seen.add(key)
    cells.push({ x, y })
    stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 })
  }

  return cells
}

/**
 * Pinta uma lista de células com a mesma cor (usado ao confirmar uma forma).
 * @param {number[][]} grid
 * @param {Array<{ x: number, y: number }>} cells
 * @param {number} value
 */
export function applyCells(grid, cells, value) {
  for (const cell of cells) {
    setCell(grid, cell.x, cell.y, value)
  }
}

/**
 * Zera todos os blocos da grade (não altera o tamanho).
 * @param {number[][]} grid
 * @param {number} fillValue
 */
export function clearGrid(grid, fillValue = 0) {
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      grid[y][x] = fillValue
    }
  }
}

/**
 * Recria a grade com novo tamanho, preservando os blocos que ainda cabem.
 * @param {number[][]} grid
 * @param {number} width
 * @param {number} height
 * @param {number} fillValue
 * @returns {number[][]}
 */
export function resizeGrid(grid, width, height, fillValue = 0) {
  const next = createGrid(width, height, fillValue)
  const { width: oldW, height: oldH } = getGridSize(grid)
  const copyW = Math.min(oldW, next[0].length)
  const copyH = Math.min(oldH, next.length)

  for (let y = 0; y < copyH; y += 1) {
    for (let x = 0; x < copyW; x += 1) {
      next[y][x] = grid[y][x]
    }
  }

  return next
}

/**
 * Copia a grade deslocada em (dx, dy). O que sairia do retângulo some;
 * a região de origem fica vazia. Não altera o tamanho da matriz.
 *
 * @param {number[][]} grid
 * @param {number} dx
 * @param {number} dy
 * @returns {number[][]}
 */
export function translateGrid(grid, dx, dy) {
  const { width, height } = getGridSize(grid)
  const shiftX = Math.trunc(dx) || 0
  const shiftY = Math.trunc(dy) || 0
  if (shiftX === 0 && shiftY === 0) return cloneGrid(grid)

  const next = createGrid(width, height, 0)
  for (let y = 0; y < height; y += 1) {
    const ny = y + shiftY
    if (ny < 0 || ny >= height) continue
    for (let x = 0; x < width; x += 1) {
      const nx = x + shiftX
      if (nx < 0 || nx >= width) continue
      next[ny][nx] = grid[y][x]
    }
  }
  return next
}
