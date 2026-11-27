// Contrato de arrastre compartido por Assets y los destinos del editor.
// El payload solo identifica; la entrada autorizada siempre viene del proyecto abierto.
export const ASSET_ENTRY_MIME = 'application/x-lf-entry'
export const ASSET_ENTRIES_MIME = 'application/x-lf-entries'

const ENTRY_KINDS = new Set([
  'folder', 'scene', 'prefab', 'model', 'texture', 'audio', 'font', 'file',
  'timeline', 'script', 'shader', 'material', 'profile', 'gamemanager', 'ui', 'vfx',
])
const validEntry = (value) => value && typeof value === 'object' && !Array.isArray(value) &&
  ENTRY_KINDS.has(value.kind) && typeof value.id === 'string' &&
  value.id.length > 0 && value.id.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value.id) &&
  Object.keys(value).length === 2
const identity = (entry) => `${entry.kind}\u0000${entry.id}`

export function hasAssetDrag(transfer) {
  const types = transfer?.types
  return Boolean(types && (Array.from(types).includes(ASSET_ENTRY_MIME) || Array.from(types).includes(ASSET_ENTRIES_MIME)))
}

/** Conserva el formato anterior, incluidos los arrastres múltiples de carpetas. */
export function writeAssetDrag(transfer, entries, label = '') {
  if (!transfer?.setData || !Array.isArray(entries) || !entries.length || entries.length > 10000) return false
  const payload = entries.map((entry) => ({ kind: entry?.kind, id: entry?.id }))
  if (payload.some((entry) => !validEntry(entry)) || new Set(payload.map(identity)).size !== payload.length) return false
  try {
    transfer.setData(ASSET_ENTRIES_MIME, JSON.stringify(payload))
    const first = payload.find((entry) => entry.kind !== 'folder')
    if (first) transfer.setData(ASSET_ENTRY_MIME, JSON.stringify(first))
    if (label) transfer.setData('text/plain', String(label))
    return true
  } catch { return false }
}

/** Datos declarativos sin privilegios. No se confía en el nombre, ruta ni tipo del texto arrastrado. */
export function readAssetDrag(transfer, { multiple = false } = {}) {
  if (typeof transfer?.getData !== 'function') return null
  try {
    const rawList = transfer.getData(ASSET_ENTRIES_MIME)
    const rawSingle = transfer.getData(ASSET_ENTRY_MIME)
    if (!rawList && !rawSingle) return null
    const list = rawList ? JSON.parse(rawList) : [JSON.parse(rawSingle)]
    if (!Array.isArray(list) || !list.length || list.length > 10000 || list.some((entry) => !validEntry(entry))) return null
    if (new Set(list.map(identity)).size !== list.length) return null
    const first = list.find((entry) => entry.kind !== 'folder')
    if (rawSingle && (!first || !validEntry(JSON.parse(rawSingle)) || identity(JSON.parse(rawSingle)) !== identity(first))) return null
    if (!multiple && (list.length !== 1 || list[0].kind === 'folder')) return null
    return list.map((entry) => ({ kind: entry.kind, id: entry.id }))
  } catch { return null }
}

/** Resuelve contra allEntries(project), la autoridad actual de Assets Browser. Sin mutaciones. */
export function resolveAssetDrop(transfer, currentEntries, { kinds, multiple = false, filterKinds = false, accepts } = {}) {
  const requested = readAssetDrag(transfer, { multiple })
  if (!requested || !Array.isArray(currentEntries)) return null
  const allowed = kinds ? new Set(kinds) : null
  const result = []
  for (const source of requested) {
    if (source.kind === 'folder' || (allowed && !allowed.has(source.kind))) {
      if (multiple && filterKinds) continue
      return null
    }
    const found = currentEntries.filter((entry) => entry.kind === source.kind && entry.id === source.id)
    if (found.length !== 1 || (accepts && !accepts(found[0]))) return null
    result.push(found[0])
  }
  return result.length ? (multiple ? result : result[0]) : null
}
