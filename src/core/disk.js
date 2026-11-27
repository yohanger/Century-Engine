// Acceso al disco para proyectos y exportaciones.
//   · Electron: diálogos nativos del sistema operativo + fs (vía IPC, ver electron/main.cjs).
//   · Navegador con File System Access API (Chrome/Edge): selector de carpetas del sistema; los handles se guardan en IndexedDB.
//   · Otros navegadores: no hay acceso a carpetas (canDisk = false) y se usan descargas.
//
// Una «ubicación» es { kind: 'path', path } (Electron) o { kind: 'handle', handle } (navegador).

const fsApi = () => (typeof window !== 'undefined' ? window.lf?.fs : null)
export const isElectron = () => !!fsApi()
export const canDisk = () => isElectron() || (typeof window !== 'undefined' && 'showDirectoryPicker' in window)

export const locName = (loc) => (!loc ? '' : loc.kind === 'path' ? loc.path : loc.handle.name)
export const sameLoc = async (a, b) => (a?.kind === 'path' && b?.kind === 'path' ? a.path === b.path : a?.kind === 'handle' && b?.kind === 'handle' ? a.handle.isSameEntry(b.handle) : false)

const clean = (rel) => String(rel).split('/').filter((s) => s && s !== '.')
function safeParts(rel) {
  const parts = clean(rel)
  if (parts.some((p) => p === '..' || /[\\:*?"<>|]/.test(p))) throw new Error('Ruta no válida: ' + rel)
  return parts
}

/** Abre el selector de carpetas del sistema. Devuelve una ubicación o null si se cancela. */
export async function pickDirectory({ title = 'Elegir carpeta', id = 'levelforge' } = {}) {
  if (isElectron()) {
    const p = await fsApi().pickDir({ title })
    return p ? { kind: 'path', path: p } : null
  }
  if (!('showDirectoryPicker' in window)) return null
  try {
    const handle = await window.showDirectoryPicker({ id, mode: 'readwrite' })
    return { kind: 'handle', handle }
  } catch (e) {
    if (e?.name === 'AbortError') return null
    throw e
  }
}

/** Pide (si hace falta) permiso de lectura/escritura; debe llamarse desde un gesto del usuario en el navegador. */
export async function ensurePermission(loc) {
  if (!loc || loc.kind === 'path') return true
  const h = loc.handle
  const opts = { mode: 'readwrite' }
  if ((await h.queryPermission?.(opts)) === 'granted') return true
  return (await h.requestPermission?.(opts)) === 'granted'
}

async function dirHandle(root, parts, create) {
  let d = root
  for (const p of parts) d = await d.getDirectoryHandle(p, { create })
  return d
}

export async function exists(loc, rel) {
  const parts = safeParts(rel)
  if (loc.kind === 'path') return fsApi().exists(loc.path, parts.join('/'))
  try {
    const dir = await dirHandle(loc.handle, parts.slice(0, -1), false)
    const last = parts[parts.length - 1]
    try { await dir.getFileHandle(last); return true } catch { try { await dir.getDirectoryHandle(last); return true } catch { return false } }
  } catch { return false }
}

export async function readFile(loc, rel) {
  const parts = safeParts(rel)
  if (loc.kind === 'path') {
    const b = await fsApi().readFile(loc.path, parts.join('/'))
    return b ? new Uint8Array(b) : null
  }
  try {
    const dir = await dirHandle(loc.handle, parts.slice(0, -1), false)
    const f = await (await dir.getFileHandle(parts[parts.length - 1])).getFile()
    return new Uint8Array(await f.arrayBuffer())
  } catch { return null }
}

/** Nombres de las subcarpetas de `rel` (sin crear nada; [] si no existe). */
export async function listDirs(loc, rel = '') {
  const parts = safeParts(rel)
  if (loc.kind === 'path') return (await fsApi().listDirs(loc.path, parts.join('/'))) || []
  try {
    const dir = await dirHandle(loc.handle, parts, false)
    const out = []
    for await (const [name, h] of dir.entries()) if (h.kind === 'directory') out.push(name)
    return out
  } catch { return [] }
}

/** Archivos bajo `rel` (recursivo; solo los que acaban en `ext` si se indica): [{ path (relativa a `loc`), mtime (ms), size }]. [] si la carpeta no existe. Sin temporales. */
export async function scanFiles(loc, rel = '', ext = '') {
  const parts = safeParts(rel)
  const base = parts.join('/')
  if (loc.kind === 'path') return (await fsApi().scan(loc.path, base, ext)) || []
  const out = []
  async function walk(dir, prefix, depth) {
    if (depth > 8 || out.length > 3000) return
    for await (const [name, h] of dir.entries()) {
      if (name.endsWith('.lftmp')) continue
      if (h.kind === 'directory') await walk(h, prefix + name + '/', depth + 1)
      else if (!ext || name.endsWith(ext)) { const f = await h.getFile(); out.push({ path: prefix + name, mtime: f.lastModified, size: f.size }) }
    }
  }
  try { await walk(await dirHandle(loc.handle, parts, false), base ? base + '/' : '', 0) } catch { /* no existe */ }
  return out
}

/** Subcarpeta (se crea si no existe) como nueva ubicación. */
export async function subDir(loc, rel) {
  const parts = safeParts(rel)
  if (loc.kind === 'path') return { kind: 'path', path: await fsApi().mkdir(loc.path, parts.join('/')) }
  return { kind: 'handle', handle: await dirHandle(loc.handle, parts, true) }
}

/**
 * Escribe varios archivos bajo `loc`. `files`: Map(rutaRelativa → Uint8Array|string).
 * `remove`: rutas relativas a borrar (archivos de exportaciones anteriores que ya no existen).
 */
export async function writeFiles(loc, files, { remove = [] } = {}) {
  const list = [...files].map(([p, d]) => [safeParts(p), d])
  if (loc.kind === 'path') {
    await fsApi().writeFiles(loc.path, list.map(([p, d]) => ({ path: p.join('/'), data: typeof d === 'string' ? d : d })), remove.map((r) => safeParts(r).join('/')))
    return
  }
  for (const r of remove) {
    const parts = safeParts(r)
    try { const dir = await dirHandle(loc.handle, parts.slice(0, -1), false); await dir.removeEntry(parts[parts.length - 1]) } catch { /* ya no existe */ }
  }
  for (const [parts, data] of list) {
    const dir = await dirHandle(loc.handle, parts.slice(0, -1), true)
    const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true })
    const w = await fh.createWritable()
    await w.write(typeof data === 'string' ? new Blob([data]) : data)
    await w.close()
  }
}
