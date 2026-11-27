// Navegación: regiones horneadas en Assets/Navigation
import * as db from '../db.js'
import { uid } from '../../engine/runtime/util.js'
import { addFolderChain, uniqueFileName } from '../project.js'
import { store, toast } from './state.js'
import { assetData } from './assets.js'
import { updateObject } from './objects.js'
import { navGrid as runtimeNavGrid, loadNavCache as runtimeLoadNavCache } from '../../engine/runtime/nav-cache.js'
import { navCache } from '../../engine/runtime/nav/world.js'

// ---------- navegación (regiones horneadas en Assets/Navigation) ----------
let navAbort = null
/** Decodifica los mapas de navegación de la escena (para la vista previa y el inspector). */
export const navGrid = (assetId) => runtimeNavGrid({ assetData }, assetId)
export async function loadNavCache() { if (store.editor) await runtimeLoadNavCache(store.editor) }
export async function bakeNavigation(id) {
  const p = store.project, ed = store.editor, o = p?.objects.find((x) => x.id === id)
  if (!o || o.type !== 'navigation' || store.nav.running) return false
  navAbort = new AbortController()
  store.nav.running = true; store.nav.fraction = 0
  try {
    const { bakeNavRegion } = await import('../nav/editorBake.js')
    const t0 = performance.now()
    const grid = await bakeNavRegion({ editor: ed, project: p, obj: o, signal: navAbort.signal, onProgress: (f) => { store.nav.fraction = f } })
    if (o.props.asset) { p.assets = p.assets.filter((a) => a.id !== o.props.asset); await db.deleteAsset(p.id, o.props.asset); navCache.delete(o.props.asset) }
    addFolderChain(p, 'Assets/Navigation')
    const id2 = uid('a'), name = uniqueFileName(p, 'Assets/Navigation', `${o.name.replace(/[^\w-]+/g, '_') || 'nav'}.navmesh`)
    const bytes = grid.encode()
    await db.putAsset(p.id, id2, name, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
    p.assets.push({ id: id2, name, folder: 'Assets/Navigation', kind: 'file', ext: 'navmesh', bytes: bytes.byteLength })
    navCache.set(id2, grid)
    let cells = 0; for (let i = 0; i < grid.ok.length; i++) if (grid.ok[i]) cells++
    updateObject(o.id, { props: { asset: id2, stats: { cells, nx: grid.nx, nz: grid.nz, seconds: +((performance.now() - t0) / 1000).toFixed(1) } } }, { label: 'Hornear navegación' })
    toast(`Navegación horneada · ${cells} celdas`, 'ok', 3500)
    return true
  } catch (err) {
    if (/Cancelado/.test(err.message)) toast('Horneado cancelado', 'info')
    else { console.error(err); toast('No se pudo hornear la navegación: ' + (err.message || err), 'error', 6000) }
    return false
  } finally { store.nav.running = false; navAbort = null }
}
export function cancelNavBake() { navAbort?.abort() }
export async function clearNavigation(id) {
  const p = store.project, o = p?.objects.find((x) => x.id === id)
  if (!o?.props.asset) return
  p.assets = p.assets.filter((a) => a.id !== o.props.asset); await db.deleteAsset(p.id, o.props.asset); navCache.delete(o.props.asset)
  updateObject(o.id, { props: { asset: '', stats: null } }, { label: 'Quitar navegación horneada' })
}

