/**
 * API local da biblioteca de mapas (pasta `maps/` na raiz do repo).
 *
 * Só funciona com o servidor Vite (`npm run dev` / `preview`): o plugin
 * lê e grava JSONS, PREVIA e IMGS no disco do projeto.
 */
import { LIBRARY_KINDS } from '@/constants/brand.js'

/**
 * @param {'pixel' | '3d'} kind
 */
export function libraryKindPath(kind) {
  return kind === LIBRARY_KINDS.MODEL_3D ? '3d' : 'pixel'
}

/**
 * @param {'pixel' | '3d'} kind
 * @returns {Promise<Array<{ id: string, name: string, previewUrl: string | null, updatedAt: number }>>}
 */
export async function listLibraryMaps(kind) {
  const res = await fetch(`/api/library/${libraryKindPath(kind)}`)
  if (!res.ok) throw new Error('Não foi possível listar os mapas.')
  const data = await res.json()
  return Array.isArray(data.items) ? data.items : []
}

/**
 * @param {'pixel' | '3d'} kind
 * @param {string} id
 */
export async function fetchLibraryMap(kind, id) {
  const res = await fetch(`/api/library/${libraryKindPath(kind)}/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error('Mapa não encontrado na biblioteca.')
  return res.json()
}

/**
 * @param {'pixel' | '3d'} kind
 * @param {string} id
 * @param {object} json
 * @param {string} [previewPngBase64] PNG reduzido para maps/.../PREVIA
 */
export async function saveLibraryMap(kind, id, json, previewPngBase64) {
  const res = await fetch(`/api/library/${libraryKindPath(kind)}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json, previewPngBase64 }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Não foi possível salvar na biblioteca.')
  }
  return res.json()
}

/**
 * Grava o PNG de exportação em IMGS (não é a prévia dos cards).
 * @param {'pixel' | '3d'} kind
 * @param {string} id
 * @param {string} pngBase64
 */
export async function saveLibraryPng(kind, id, pngBase64) {
  const res = await fetch(`/api/library/${libraryKindPath(kind)}/${encodeURIComponent(id)}/png`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pngBase64 }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Não foi possível gravar o PNG na biblioteca.')
  }
  return res.json()
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {string} PNG em base64, sem o prefixo data:
 */
export function canvasToPngBase64(canvas) {
  const dataUrl = canvas.toDataURL('image/png')
  const comma = dataUrl.indexOf(',')
  return comma >= 0 ? dataUrl.slice(comma + 1) : ''
}

/**
 * @param {import('vue-router').RouteLocationNormalizedLoaded} route
 */
export function libraryKindFromRoute(route) {
  const name = String(route.name || '')
  return name.startsWith('3d') ? LIBRARY_KINDS.MODEL_3D : LIBRARY_KINDS.PIXEL
}

/**
 * @param {'pixel' | '3d'} kind
 */
export function libraryHomePath(kind) {
  return kind === LIBRARY_KINDS.MODEL_3D ? '/3d' : '/pixel'
}

/**
 * @param {'pixel' | '3d'} kind
 */
export function editorRouteName(kind) {
  return kind === LIBRARY_KINDS.MODEL_3D ? '3d-edit' : 'pixel-edit'
}

/**
 * @param {'pixel' | '3d'} kind
 */
export function viewerRouteName(kind) {
  return kind === LIBRARY_KINDS.MODEL_3D ? '3d-view' : 'pixel-view'
}

/**
 * @param {'pixel' | '3d'} kind
 */
export function mapsFolderLabel(kind) {
  return kind === LIBRARY_KINDS.MODEL_3D ? 'maps/3DMap' : 'maps/pixelMap'
}

/**
 * @param {'pixel' | '3d'} kind
 * @param {string} id
 */
export async function deleteLibraryMap(kind, id) {
  const res = await fetch(`/api/library/${libraryKindPath(kind)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || 'Não foi possível excluir o mapa.')
  }
  return res.json()
}
