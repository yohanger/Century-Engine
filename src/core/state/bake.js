// Iluminación horneada (Assets/Lightmaps): hornear, olvidar y aplicar.
import * as db from '../db.js'
import { uid } from '../../engine/runtime/util.js'
import { addFolderChain, uniqueFileName } from '../project.js'
import { store, toast } from './state.js'
import { markDirty, commit } from './history.js'

// ---------- iluminación horneada (Assets/Lightmaps) ----------
let bakeAbort = null
const bakeFileIds = (b) => (b ? [...Object.values(b.lightmaps || {}).map((l) => l.id), ...(b.probes ? [b.probes.id] : [])] : [])
async function dropBakeAssets(b, p = store.project, editor = store.editor) {
  const ids = new Set(bakeFileIds(b))
  if (!ids.size) return
  // Eliminar registros sólo después de eliminar sus bytes correctamente.
  for (const id of ids) {
    await db.deleteAsset(p.id, id)
    p.assets = p.assets.filter((a) => a.id !== id)
  }
  editor?.bake.forget(ids)
}

/** Hornea la escena (lightmaps + sondas) y guarda los resultados como archivos del proyecto. */
export async function runBake() {
  const p = store.project, ed = store.editor
  if (!p || !ed || store.bake.running) return false
  bakeAbort = new AbortController()
  const { signal } = bakeAbort
  const sceneId = p.activeSceneId, env = p.environment, previous = env.bake
  const staged = []
  let published = false
  let applying = false
  const ensureScene = () => {
    if (signal.aborted || store.project !== p || p.activeSceneId !== sceneId || p.environment !== env)
      throw new Error('Cancelado')
  }
  store.bake.running = true; store.bake.label = 'Preparando…'; store.bake.fraction = 0
  try {
    const [{ bakeScene }, { encodeBakeFile }] = await Promise.all([import('../../engine/runtime/bake/baker.js'), import('../../engine/runtime/bake/runtime.js')])
    const res = await bakeScene({ editor: ed, project: p, signal, onProgress: (o) => { store.bake.label = o.label; store.bake.fraction = o.fraction } })
    ensureScene()
    addFolderChain(p, 'Assets/Lightmaps')
    const scene = p.scenes.find((s) => s.id === p.activeSceneId)?.name || 'Escena'
    const add = async (name, bytes) => {
      ensureScene()
      const id = uid('a'), n = uniqueFileName(p, 'Assets/Lightmaps', name)
      await db.putAsset(p.id, id, n, bytes)
      staged.push({ id, name: n, folder: 'Assets/Lightmaps', kind: 'file', ext: 'lmap', bytes: bytes.byteLength })
      return id
    }
    const lightmaps = {}
    let i = 0
    for (const l of res.lightmaps) lightmaps[l.key] = { id: await add(`${scene}_lightmap_${++i}.lmap`, encodeBakeFile(l.size, l.size, 0, l.half, l.uv)), size: l.size }
    let probes = null
    if (res.probes) {
      const pr = res.probes, n = pr.dims[0] * pr.dims[1] * pr.dims[2]
      probes = { id: await add(`${scene}_sondas.lmap`, encodeBakeFile(n, 27, 1, pr.half)), origin: pr.origin, dims: pr.dims, spacing: pr.spacing }
    }
    ensureScene()
    const beforeView = store.view.bake
    const next = { rev: (previous?.rev || 0) + 1, lightmaps, probes, lights: res.lightsUsed, params: res.params, stats: { ...res.stats, at: Date.now(), worldIgnored: !!res.worldIgnored } }
    applying = true
    p.assets.push(...staged)
    env.bake = next
    store.view.bake = true
    try {
      await ed.bake.apply()
      ensureScene()
    } catch (error) {
      env.bake = previous
      store.view.bake = beforeView
      p.assets = p.assets.filter(a => !staged.some(s => s.id === a.id))
      try { await ed.bake.apply() } catch (restoreError) { console.error('No se pudo restaurar la visualización horneada anterior:', restoreError) }
      throw error
    } finally { applying = false }
    published = true
    commit('Hornear iluminación')
    // Eliminar los assets anteriores sólo después de aplicar el horneado nuevo.
    // Un fallo de limpieza no invalida los datos nuevos ni fuerza un segundo horneado.
    try { await dropBakeAssets(previous, p, ed) }
    catch (cleanupError) { console.error('No se completó la limpieza de lightmaps anteriores:', cleanupError) }
    const nl = (res.lightsUsed || []).length
    const src = nl ? `${nl} luz${nl === 1 ? '' : 'es'} estática${nl === 1 ? '' : 's'} + cielo` : 'solo cielo (no hay luces en modo Estática/Mixta)'
    toast(`Iluminación horneada · ${res.lightmaps.length} lightmaps, ${res.stats.probes} sondas · ${src}${res.worldIgnored ? ' · hora/clima ignorados (se usó el entorno del inspector)' : ''} · ${res.stats.seconds.toFixed(1)} s`, 'ok', res.worldIgnored || !nl ? 7000 : 4000)
    return true
  } catch (err) {
    if (!published && !applying) await Promise.allSettled(staged.map(asset => db.deleteAsset(p.id, asset.id)))
    if (/Cancelado/.test(err?.message || '')) toast('Horneado cancelado; iluminación anterior conservada', 'info')
    else { console.error(err); toast('No se pudo hornear: ' + (err?.message || String(err)), 'error', 6000) }
    return false
  } finally { store.bake.running = false; bakeAbort = null }
}
/** Ajustes del horneado (Escena ▸ Iluminación). */
export function updateBake(patch) {
  import('../../engine/runtime/bake/config.js').then(({ normalizeBake }) => { store.project.bake = normalizeBake({ ...store.project.bake, ...patch }); markDirty() })
}
export function cancelBake() { bakeAbort?.abort() }
/** Borra la iluminación horneada de la escena (las luces estáticas vuelven a verse en tiempo real). */
export async function clearBake() {
  const p = store.project
  if (!p?.environment.bake) return
  await dropBakeAssets(p.environment.bake)
  delete p.environment.bake
  commit('Quitar iluminación horneada')
  await store.editor.bake.apply()
}
/** Abre el selector de punto sobre el mapa. Devuelve [x, null, z] (la Y es automática) o null si se cancela. */
export function pickOnMap({ title = '', point = null } = {}) {
  if (store.mapPick) closeMapPick(null)
  return new Promise((resolve) => { store.mapPick = { title, point, resolve } })
}
export function closeMapPick(value) { const m = store.mapPick; store.mapPick = null; m?.resolve(value) }
