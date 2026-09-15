/**
 * Plugin Vite: biblioteca de mapas em `maps/` (raiz do repositório).
 *
 * GET  /api/library/:kind
 * GET  /api/library/:kind/:id
 * GET  /api/library/:kind/:id/thumb   PNG em PREVIA
 * PUT  /api/library/:kind/:id         { json, previewPngBase64? } → JSONS + PREVIA
 * PUT  /api/library/:kind/:id/png     { pngBase64 } → pasta IMGS
 * DELETE /api/library/:kind/:id       JSONS + PREVIA + IMGS (e o rascunho irmão)
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const KINDS = {
  pixel: 'pixelMap',
  '3d': '3DMap',
}

/**
 * @param {string} mapsRoot
 */
export function mapsLibraryPlugin(mapsRoot) {
  async function ensureDirs() {
    for (const folder of Object.values(KINDS)) {
      await fs.mkdir(path.join(mapsRoot, folder, 'JSONS'), { recursive: true })
      await fs.mkdir(path.join(mapsRoot, folder, 'IMGS'), { recursive: true })
      await fs.mkdir(path.join(mapsRoot, folder, 'PREVIA'), { recursive: true })
    }
  }

  /**
   * @param {import('vite').ViteDevServer | import('vite').PreviewServer} server
   */
  function attach(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url || ''
      if (!url.startsWith('/api/library/')) {
        next()
        return
      }

      try {
        await ensureDirs()
        const handled = await handleLibraryRequest(mapsRoot, req, res, url)
        if (!handled) next()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro na biblioteca.'
        sendJson(res, 500, { error: message })
      }
    })
  }

  return {
    name: 'maps-library',
    configureServer: attach,
    configurePreviewServer: attach,
    async buildStart() {
      await ensureDirs()
    },
  }
}

/**
 * @param {string} mapsRoot
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} url
 */
async function handleLibraryRequest(mapsRoot, req, res, url) {
  const parsed = new URL(url, 'http://localhost')
  const parts = parsed.pathname.replace(/^\/api\/library\//, '').split('/').filter(Boolean)
  const kindKey = parts[0]
  const folder = KINDS[kindKey]
  if (!folder) {
    sendJson(res, 404, { error: 'Biblioteca desconhecida.' })
    return true
  }

  const jsonDir = path.join(mapsRoot, folder, 'JSONS')
  const imgDir = path.join(mapsRoot, folder, 'IMGS')
  const previaDir = path.join(mapsRoot, folder, 'PREVIA')

  if (parts.length === 1 && req.method === 'GET') {
    const items = await listMaps(jsonDir, previaDir, kindKey)
    sendJson(res, 200, { items })
    return true
  }

  const id = safeId(parts[1])
  if (!id) {
    sendJson(res, 400, { error: 'Identificador inválido.' })
    return true
  }

  const jsonFile = await resolveJsonFile(jsonDir, id)

  if (parts[2] === 'thumb' && req.method === 'GET') {
    if (!jsonFile) {
      res.statusCode = 404
      res.end()
      return true
    }
    const previaPath = path.join(previaDir, pngNameFromJson(jsonFile))
    let png = await readPngFile(previaPath)
    if (!png) {
      png = await buildMapThumb(path.join(jsonDir, jsonFile))
      await fs.mkdir(previaDir, { recursive: true })
      await fs.writeFile(previaPath, png)
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'no-cache')
    res.end(png)
    return true
  }

  if (parts[2] === 'png' && req.method === 'PUT') {
    const body = await readBody(req)
    const payload = JSON.parse(body || '{}')
    if (typeof payload.pngBase64 !== 'string' || !payload.pngBase64.trim()) {
      sendJson(res, 400, { error: 'PNG ausente.' })
      return true
    }
    const pngFile = jsonFile
      ? pngNameFromJson(jsonFile)
      : pngNameFromJson(id.endsWith('.json') ? id : `${id}.zblockmap.json`)
    await fs.writeFile(path.join(imgDir, pngFile), Buffer.from(payload.pngBase64, 'base64'))
    sendJson(res, 200, { ok: true, file: pngFile })
    return true
  }

  if (req.method === 'GET') {
    if (!jsonFile) {
      sendJson(res, 404, { error: 'Mapa não encontrado.' })
      return true
    }
    const jsonPath = path.join(jsonDir, jsonFile)
    try {
      const text = await fs.readFile(jsonPath, 'utf8')
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(text)
    } catch {
      sendJson(res, 404, { error: 'Mapa não encontrado.' })
    }
    return true
  }

  if (req.method === 'PUT') {
    const body = await readBody(req)
    const payload = JSON.parse(body || '{}')
    if (!payload.json || typeof payload.json !== 'object') {
      sendJson(res, 400, { error: 'JSON do mapa ausente.' })
      return true
    }
    const targetName = jsonFile || normalizeNewJsonName(id)
    const jsonPath = path.join(jsonDir, targetName)
    await fs.writeFile(jsonPath, JSON.stringify(payload.json, null, 2), 'utf8')
    if (typeof payload.previewPngBase64 === 'string' && payload.previewPngBase64.trim()) {
      await fs.mkdir(previaDir, { recursive: true })
      await fs.writeFile(
        path.join(previaDir, pngNameFromJson(targetName)),
        Buffer.from(payload.previewPngBase64, 'base64'),
      )
    }
    sendJson(res, 200, { id: targetName, ok: true })
    return true
  }

  if (req.method === 'DELETE') {
    if (!jsonFile) {
      sendJson(res, 404, { error: 'Mapa não encontrado.' })
      return true
    }
    await deleteLibraryFiles(jsonDir, imgDir, previaDir, jsonFile)
    if (!isDraftJson(jsonFile)) {
      await deleteLibraryFiles(jsonDir, imgDir, previaDir, `${stemFromJson(jsonFile)}.zblockmap.draft.json`)
    }
    sendJson(res, 200, { ok: true })
    return true
  }

  return false
}

/**
 * @param {string} jsonDir
 * @param {string} previaDir
 * @param {string} kindKey
 */
async function listMaps(jsonDir, previaDir, kindKey) {
  let names = []
  try {
    names = await fs.readdir(jsonDir)
  } catch {
    names = []
  }

  const items = []
  for (const file of names) {
    if (file.startsWith('.')) continue
    if (!file.toLowerCase().endsWith('.json')) continue
    const jsonPath = path.join(jsonDir, file)
    const stat = await fs.stat(jsonPath)
    const peeked = await peekMapMeta(jsonPath)
    const name = displayName(file, peeked.name)
    const previaPath = path.join(previaDir, pngNameFromJson(file))
    let previewAt = stat.mtimeMs
    try {
      previewAt = (await fs.stat(previaPath)).mtimeMs
    } catch {
      /* a primeira GET /thumb grava o PNG em PREVIA */
    }
    items.push({
      id: file,
      name,
      file,
      origin: isDraftJson(file) ? 'draft' : 'saved',
      previewUrl: `/api/library/${kindKey}/${encodeURIComponent(file)}/thumb?t=${previewAt}`,
      updatedAt: stat.mtimeMs,
    })
  }

  items.sort((a, b) => b.updatedAt - a.updatedAt)
  return items
}

/**
 * Downloads do navegador viram "Nome.zblockmap (1).json". O id da API é o
 * nome real do arquivo, para o GET achar o JSON certo.
 * @param {string} jsonDir
 * @param {string} id
 */
async function resolveJsonFile(jsonDir, id) {
  const candidates = []
  if (id.toLowerCase().endsWith('.json')) candidates.push(id)
  else {
    candidates.push(`${id}.zblockmap.json`, `${id}.zblockmap.draft.json`, `${id}.json`)
  }

  for (const name of candidates) {
    try {
      await fs.access(path.join(jsonDir, name))
      return name
    } catch {
      /* tenta o próximo */
    }
  }

  let names = []
  try {
    names = await fs.readdir(jsonDir)
  } catch {
    return null
  }
  const stem = stripJsonExt(id)
  const found = names.find((file) => !file.startsWith('.') && stripJsonExt(file) === stem)
  return found || null
}

/**
 * @param {string} file
 */
function isDraftJson(file) {
  return /\.zblockmap\.draft\.json$/i.test(String(file))
}

/**
 * Stem sem .json / .zblockmap.json / .zblockmap.draft.json.
 * O PNG do rascunho fica `nome.draft.png` para não colidir com o mapa salvo.
 * @param {string} file
 */
function stripJsonExt(file) {
  const raw = String(file)
  if (isDraftJson(raw)) {
    return `${raw.replace(/\.zblockmap\.draft\.json$/i, '')}.draft`
  }
  return raw.replace(/\.zblockmap\.json$/i, '').replace(/\.json$/i, '')
}

/**
 * Stem do mapa (sem o sufixo `.draft` usado só no PNG).
 * @param {string} file
 */
function stemFromJson(file) {
  return String(file)
    .replace(/\.zblockmap\.draft\.json$/i, '')
    .replace(/\.zblockmap\.json$/i, '')
    .replace(/\.json$/i, '')
}

/**
 * @param {string} jsonDir
 * @param {string} imgDir
 * @param {string} previaDir
 * @param {string} jsonFile
 */
async function deleteLibraryFiles(jsonDir, imgDir, previaDir, jsonFile) {
  if (!jsonFile) return
  const png = pngNameFromJson(jsonFile)
  await unlinkQuiet(path.join(jsonDir, jsonFile))
  await unlinkQuiet(path.join(previaDir, png))
  await unlinkQuiet(path.join(imgDir, png))
}

/**
 * @param {string} filePath
 */
async function unlinkQuiet(filePath) {
  try {
    await fs.unlink(filePath)
  } catch {
    /* arquivo pode não existir */
  }
}

/**
 * @param {string} file
 */
function pngNameFromJson(file) {
  return `${stripJsonExt(file)}.png`
}

/**
 * @param {string} id
 */
function normalizeNewJsonName(id) {
  if (id.toLowerCase().endsWith('.json')) return id
  return `${id}.zblockmap.json`
}

/**
 * @param {string} file
 * @param {string | null} jsonName
 */
function displayName(file, jsonName) {
  const copy = file.match(/\((\d+)\)\s*\.json$/i)
  const base = jsonName || stripJsonExt(file).replace(/-/g, ' ') || 'Mapa'
  if (copy) return `${base} (${copy[1]})`
  return base
}

/**
 * Lê só o começo do JSON (mapas grandes têm dezenas de MB).
 * @param {string} jsonPath
 */
async function peekMapMeta(jsonPath) {
  const handle = await fs.open(jsonPath, 'r')
  try {
    const buf = Buffer.alloc(4096)
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0)
    const sample = buf.subarray(0, bytesRead).toString('utf8')
    const nameMatch = sample.match(/"name"\s*:\s*"([^"]+)"/)
    return { name: nameMatch ? nameMatch[1] : null }
  } catch {
    return { name: null }
  } finally {
    await handle.close()
  }
}

/**
 * @param {string} raw
 */
function safeId(raw) {
  let value = String(raw || '').trim()
  try {
    value = decodeURIComponent(value)
  } catch {
    /* já decodificado */
  }
  if (!value || value.includes('..') || /[\\/]/.test(value) || value.includes('\0')) return ''
  return value.slice(0, 180)
}

/**
 * @param {import('http').IncomingMessage} req
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {object} payload
 */
function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

const THUMB_MAX = 256
const EMPTY_RGB = { r: 0, g: 0, b: 0 }
let thumbTail = Promise.resolve()

/**
 * @param {string} filePath
 */
async function readPngFile(filePath) {
  try {
    return await fs.readFile(filePath)
  } catch {
    return null
  }
}

/**
 * Miniatura independente do alias `@/` (o Vite config não resolve esse alias).
 * @param {object} json
 */
function compositeJsonMap(json) {
  const width = Math.max(1, Math.floor(Number(json.width)) || 1)
  const height = Math.max(1, Math.floor(Number(json.height)) || 1)
  if (json.format === 'z-blockmap-3d' || layersHaveVoxelBlocks(json.layers)) {
    return compositeVoxelTopDown(json, width, height)
  }
  const out = Array.from({ length: height }, () => new Uint16Array(width))
  if (Array.isArray(json.layers) && json.layers.length > 0) {
    blitLayerTree(json.layers, out, width, height)
  } else if (Array.isArray(json.cells)) {
    blitGridOnto(json.cells, out, width, height, 0, 0)
  }
  return out
}

/**
 * @param {unknown} nodes
 */
function layersHaveVoxelBlocks(nodes) {
  if (!Array.isArray(nodes)) return false
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    if (node.type === 'group' && layersHaveVoxelBlocks(node.children)) return true
    if (Array.isArray(node.blocks)) return true
  }
  return false
}

/**
 * Vista de cima: o cubo mais alto em cada coluna XZ pinta a prévia.
 * @param {object} json
 * @param {number} width
 * @param {number} height
 */
function compositeVoxelTopDown(json, width, height) {
  const out = Array.from({ length: height }, () => new Uint16Array(width))
  const topY = Array.from({ length: height }, () => {
    const row = new Int32Array(width)
    row.fill(-1)
    return row
  })
  blitVoxelTree(json.layers, out, topY, width, height)
  return out
}

/**
 * @param {unknown} nodes
 * @param {Uint16Array[]} out
 * @param {Int32Array[]} topY
 * @param {number} width
 * @param {number} height
 */
function blitVoxelTree(nodes, out, topY, width, height) {
  if (!Array.isArray(nodes)) return
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || node.visible === false) continue
    if (node.type === 'group') {
      blitVoxelTree(node.children, out, topY, width, height)
      continue
    }
    if (!Array.isArray(node.blocks)) continue
    for (const block of node.blocks) {
      if (!block || typeof block !== 'object') continue
      const x = Math.round(Number(block.x))
      const z = Math.round(Number(block.z))
      const y = Math.round(Number(block.y))
      if (!Number.isInteger(x) || !Number.isInteger(z) || x < 0 || z < 0 || x >= width || z >= height) {
        continue
      }
      const colorId = Number(block.colorId) || 0
      if (!colorId) continue
      if (y >= topY[z][x]) {
        topY[z][x] = y
        out[z][x] = colorId
      }
    }
  }
}

/**
 * @param {unknown[]} nodes
 * @param {Uint16Array[]} out
 * @param {number} width
 * @param {number} height
 */
function blitLayerTree(nodes, out, width, height) {
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || node.visible === false) continue
    if (node.type === 'group' && Array.isArray(node.children)) {
      blitLayerTree(node.children, out, width, height)
    } else if (Array.isArray(node.grid)) {
      blitGridOnto(
        node.grid,
        out,
        width,
        height,
        Number(node.offsetX) || 0,
        Number(node.offsetY) || 0,
      )
    }
  }
}

/**
 * @param {unknown} src
 * @param {Uint16Array[]} out
 * @param {number} width
 * @param {number} height
 * @param {number} ox
 * @param {number} oy
 */
function blitGridOnto(src, out, width, height, ox, oy) {
  if (!Array.isArray(src)) return
  for (let y = 0; y < src.length; y += 1) {
    const wy = y + oy
    if (wy < 0 || wy >= height) continue
    const row = src[y]
    if (!Array.isArray(row)) continue
    const dst = out[wy]
    for (let x = 0; x < row.length; x += 1) {
      const wx = x + ox
      if (wx < 0 || wx >= width) continue
      const value = Number(row[x]) || 0
      if (value) dst[wx] = value
    }
  }
}

/**
 * @param {object} json
 * @returns {Map<number, { r: number, g: number, b: number }>}
 */
function paletteFromJson(json) {
  const map = new Map()
  const buckets = [json.colors?.fixed, json.colors?.custom]
  for (const list of buckets) {
    if (!Array.isArray(list)) continue
    for (const color of list) {
      if (!color || typeof color !== 'object') continue
      const id = Number(color.id)
      if (!Number.isFinite(id) || id === 0) continue
      map.set(id, hexToRgb(color.hex))
    }
  }
  return map
}

/**
 * @param {Map<number, { r: number, g: number, b: number }>} palette
 * @param {number} id
 */
function rgbOfCell(palette, id) {
  if (!id) return EMPTY_RGB
  return palette.get(id) || EMPTY_RGB
}

/**
 * @param {unknown} hex
 */
function hexToRgb(hex) {
  const raw = String(hex || '').replace('#', '')
  if (raw.length !== 6) return EMPTY_RGB
  return {
    r: parseInt(raw.slice(0, 2), 16) || 0,
    g: parseInt(raw.slice(2, 4), 16) || 0,
    b: parseInt(raw.slice(4, 6), 16) || 0,
  }
}

/**
 * Gera PNG de prévia a partir do JSON na primeira vez (mapas sem arquivo em
 * PREVIA). Fila para não parsear vários de 30 MB juntos.
 * @param {string} jsonPath
 */
function buildMapThumb(jsonPath) {
  const run = thumbTail.then(() => buildMapThumbNow(jsonPath), () => buildMapThumbNow(jsonPath))
  thumbTail = run.catch(() => {})
  return run
}

/**
 * @param {string} jsonPath
 */
async function buildMapThumbNow(jsonPath) {
  const text = await fs.readFile(jsonPath, 'utf8')
  const json = JSON.parse(text)
  const grid = compositeJsonMap(json)
  const palette = paletteFromJson(json)
  const rows = grid.length
  const cols = rows > 0 ? grid[0].length : 1
  const { tw, th } = previewSize(cols, rows, THUMB_MAX)
  const rgb = Buffer.alloc(tw * th * 3)
  const counts = new Map()
  let i = 0
  for (let py = 0; py < th; py += 1) {
    const y0 = Math.floor((py * rows) / th)
    const y1 = Math.max(y0 + 1, Math.floor(((py + 1) * rows) / th))
    for (let px = 0; px < tw; px += 1) {
      const x0 = Math.floor((px * cols) / tw)
      const x1 = Math.max(x0 + 1, Math.floor(((px + 1) * cols) / tw))
      const color = downsampleBox(grid, x0, y0, x1, y1, palette, counts)
      rgb[i] = color.r
      rgb[i + 1] = color.g
      rgb[i + 2] = color.b
      i += 3
    }
  }
  return encodeRgbPng(tw, th, rgb)
}

/**
 * @param {number} cols
 * @param {number} rows
 * @param {number} max
 */
function previewSize(cols, rows, max) {
  const long = Math.max(cols, rows, 1)
  if (long <= max) return { tw: Math.max(1, cols), th: Math.max(1, rows) }
  const scale = max / long
  return {
    tw: Math.max(1, Math.round(cols * scale)),
    th: Math.max(1, Math.round(rows * scale)),
  }
}

/**
 * Cor da caixa: ignora vazio se houver tinta; escolhe a cor pintada mais frequente.
 * @param {Uint16Array[]} grid
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {Map<number, { r: number, g: number, b: number }>} palette
 * @param {Map<number, number>} counts
 */
function downsampleBox(grid, x0, y0, x1, y1, palette, counts) {
  counts.clear()
  let paint = 0
  for (let y = y0; y < y1; y += 1) {
    const row = grid[y]
    if (!row) continue
    for (let x = x0; x < x1; x += 1) {
      const id = row[x]
      if (!id) continue
      paint += 1
      counts.set(id, (counts.get(id) || 0) + 1)
    }
  }
  if (!paint) return EMPTY_RGB
  let bestId = 0
  let bestN = 0
  for (const [id, n] of counts) {
    if (n > bestN) {
      bestId = id
      bestN = n
    }
  }
  return rgbOfCell(palette, bestId)
}

const PNG_CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  PNG_CRC_TABLE[n] = c >>> 0
}

/**
 * @param {Buffer} buf
 */
function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    crc = PNG_CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * PNG RGB 8-bit, sem dependência de canvas.
 * @param {number} width
 * @param {number} height
 * @param {Buffer} rgb
 */
function encodeRgbPng(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const dest = y * (width * 3 + 1)
    raw[dest] = 0
    rgb.copy(raw, dest + 1, y * width * 3, (y + 1) * width * 3)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const chunks = [
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]
  return Buffer.concat(chunks)
}

/**
 * @param {string} type
 * @param {Buffer} data
 */
function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

export const mapsRootFromVue = fileURLToPath(new URL('../maps', import.meta.url))
