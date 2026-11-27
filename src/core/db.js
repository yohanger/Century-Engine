// Persistencia local con IndexedDB: un registro por proyecto (nivel) + assets binarios aparte.
import { strictJson } from '../engine/runtime/numeric-integrity.js'
import { migrateScene } from './project.js'
import { makeRecoveryRecord, verifyRecoveryRecord, summarizeRecovery } from './recovery.js'
import { methodOf } from '../engine/runtime/render/config.js'
import { shallowReactive } from 'vue'

const DB_NAME = 'levelforge'
const DB_VER = 5
const assetChanges = shallowReactive(new Map())
const assetKey = (projectId, assetId) => JSON.stringify([projectId, assetId])
function touchAsset(projectId, assetId) {
  const key = assetKey(projectId, assetId)
  assetChanges.set(key, (assetChanges.get(key) || 0) + 1)
}
export function assetVersion(projectId, assetId) {
  return JSON.stringify([projectId, assetId, assetChanges.get(assetKey(projectId)), assetChanges.get(assetKey(projectId, assetId))])
}

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('assets')) {
        const s = db.createObjectStore('assets', { keyPath: 'key' })
        s.createIndex('byProject', 'projectId')
      }
      // Estado confirmado para que «Salir sin guardar» no conserve el autoguardado de trabajo.
      if (!db.objectStoreNames.contains('confirmed')) db.createObjectStore('confirmed', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('recovery')) db.createObjectStore('recovery', { keyPath: 'id' })
      // v3: ubicaciones en disco (rutas de Electron o handles del navegador)
      if (!db.objectStoreNames.contains('locs')) db.createObjectStore('locs', { keyPath: 'key' })
      // v2: una escena por registro (un proyecto puede tener varias)
      if (!db.objectStoreNames.contains('scenes')) {
        const s = db.createObjectStore('scenes', { keyPath: 'key' })
        s.createIndex('byProject', 'projectId')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(db, stores, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode)
    let result
    t.oncomplete = () => resolve(result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
    result = fn(t)
  })
}

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })

let dbp
const db = () => (dbp ??= open())

export async function saveProject(project, thumb) {
  const d = await db()
  const rec = { ...JSON.parse(strictJson(project, "Proyecto")), thumb: thumb ?? undefined }
  if (thumb === undefined) {
    const prev = await wrap(d.transaction('projects').objectStore('projects').get(project.id))
    rec.thumb = prev?.thumb
  }
  await tx(d, ['projects'], 'readwrite', (t) => t.objectStore('projects').put(rec))
}

export async function loadProject(id) {
  const d = await db()
  return wrap(d.transaction('projects').objectStore('projects').get(id))
}

export async function listProjects() {
  const d = await db()
  const all = await wrap(d.transaction('projects').objectStore('projects').getAll())
  return all
    .filter((p) => !String(p.id).startsWith('nfm_')) // copias de trabajo de Nether Film Maker: no son proyectos del usuario
    .map((p) => ({
      id: p.id, name: p.name, updatedAt: p.updatedAt, createdAt: p.createdAt, thumb: p.thumb,
      scenes: p.scenes?.length ?? 1, renderer: methodOf(p.render), template: p.template,
      objects: p.scenes ? p.scenes.reduce((n, s) => n + (s.count || 0), 0) : p.objects?.length ?? 0,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteProject(id) {
  const d = await db()
  const keys = await wrap(d.transaction('assets').objectStore('assets').index('byProject').getAllKeys(id))
  const skeys = await wrap(d.transaction('scenes').objectStore('scenes').index('byProject').getAllKeys(id))
  await tx(d, ['projects', 'assets', 'scenes', 'locs', 'confirmed', 'recovery'], 'readwrite', (t) => {
    t.objectStore('projects').delete(id)
    t.objectStore('confirmed').delete(id)
    t.objectStore('recovery').delete(id)
    t.objectStore('locs').delete('proj:' + id); t.objectStore('locs').delete('godot:' + id)
    keys.forEach((k) => t.objectStore('assets').delete(k))
    skeys.forEach((k) => t.objectStore('scenes').delete(k))
  })
  touchAsset(id)
}

// ---------- escenas (un registro por escena) ----------
export async function saveScene(projectId, sceneId, data) {
  const d = await db()
  const rec = { key: `${projectId}:${sceneId}`, projectId, sceneId, ...JSON.parse(strictJson(data, `Escena ${sceneId}`)) }
  await tx(d, ['scenes'], 'readwrite', (t) => t.objectStore('scenes').put(rec))
}

export async function loadScene(projectId, sceneId) {
  const d = await db()
  const r = await wrap(d.transaction('scenes').objectStore('scenes').get(`${projectId}:${sceneId}`))
  return r ? migrateScene(r) : r // proyectos antiguos: el agua pasa de «Escena» a un objeto
}

export async function deleteScene(projectId, sceneId) {
  const d = await db()
  await tx(d, ['scenes'], 'readwrite', (t) => t.objectStore('scenes').delete(`${projectId}:${sceneId}`))
}

export async function putAsset(projectId, assetId, name, bytes) {
  const d = await db()
  await tx(d, ['assets'], 'readwrite', (t) => t.objectStore('assets').put({ key: `${projectId}:${assetId}`, projectId, assetId, name, bytes }))
  touchAsset(projectId, assetId)
}

/** Importación de Assets: escenas, binarios y metadatos se confirman en UNA transacción.
 *  Si falla una escritura o el almacenamiento se llena, IndexedDB revierte todo. */
export async function saveLevelPackageImport(project, scenes, assets) {
  const d = await db()
  const meta = JSON.parse(JSON.stringify(project))
  const old = await wrap(d.transaction('projects').objectStore('projects').get(project.id))
  meta.thumb = old?.thumb
  await tx(d, ['projects', 'scenes', 'assets'], 'readwrite', (t) => {
    const ps = t.objectStore('projects'), ss = t.objectStore('scenes'), aa = t.objectStore('assets')
    ps.put(meta)
    for (const scene of scenes) ss.put({
      key: `${project.id}:${scene.id}`, projectId: project.id, sceneId: scene.id,
      ...JSON.parse(JSON.stringify(scene.data)),
    })
    for (const asset of assets) aa.put({
      key: `${project.id}:${asset.id}`, projectId: project.id, assetId: asset.id,
      name: asset.name, bytes: asset.bytes,
    })
  })
  for (const asset of assets) touchAsset(project.id, asset.id)
}

export async function getAsset(projectId, assetId) {
  const d = await db()
  return wrap(d.transaction('assets').objectStore('assets').get(`${projectId}:${assetId}`))
}

export async function deleteAsset(projectId, assetId) {
  const d = await db()
  await tx(d, ['assets'], 'readwrite', (t) => t.objectStore('assets').delete(`${projectId}:${assetId}`))
  touchAsset(projectId, assetId)
}

export async function listAssets(projectId) {
  const d = await db()
  return wrap(d.transaction('assets').objectStore('assets').index('byProject').getAll(projectId))
}

export const lastProjectId = {
  get: () => localStorage.getItem('levelforge:last'),
  set: (id) => localStorage.setItem('levelforge:last', id),
}

// ---------- ubicaciones en disco ----------
// key: `proj:<id>` (carpeta del proyecto) · `godot:<id>` (carpeta del proyecto Godot)
export async function putLoc(key, loc) {
  const d = await db()
  await tx(d, ['locs'], 'readwrite', (t) => t.objectStore('locs').put({ key, loc }))
}
export async function getLoc(key) {
  const d = await db()
  return (await wrap(d.transaction('locs').objectStore('locs').get(key)))?.loc || null
}
export async function deleteLoc(key) {
  const d = await db()
  await tx(d, ['locs'], 'readwrite', (t) => t.objectStore('locs').delete(key))
}

// Copia del último guardado CONFIRMADO, distinta del autoguardado de trabajo.
// No se usa para recuperar un cierre inesperado: eso corresponde al Gate G002.
export async function getConfirmedProject(id) {
  const d = await db()
  return wrap(d.transaction('confirmed').objectStore('confirmed').get(id))
}

/** Captura todos los registros del proyecto que se acaba de guardar explícitamente. */
export async function confirmProject(id) {
  const d = await db()
  const project = await loadProject(id)
  if (!project) throw new Error('No existe el proyecto que se intenta confirmar')
  const scenes = await wrap(d.transaction('scenes').objectStore('scenes').index('byProject').getAll(id))
  const assets = await listAssets(id)
  await tx(d, ['confirmed'], 'readwrite', (t) => t.objectStore('confirmed').put({ id, project, scenes, assets, dirty: false }))
}

/** Inicializa el punto de partida de un proyecto heredado sin alterar otro punto confirmado. */
export async function ensureConfirmedProject(id) {
  if (!(await getConfirmedProject(id))) await confirmProject(id)
}

export async function markProjectPending(id) {
  const d = await db()
  await tx(d, ['confirmed'], 'readwrite', (t) => {
    const s = t.objectStore('confirmed')
    const r = s.get(id)
    r.onsuccess = () => { if (r.result) s.put({ ...r.result, dirty: true }) }
  })
}

/** Restaura meta, escenas y binarios en UNA transacción. Si falla, el cierre queda cancelado. */
export async function restoreConfirmedProject(id) {
  const d = await db()
  const rec = await getConfirmedProject(id)
  if (!rec?.project) throw new Error('No hay un guardado confirmado para descartar los cambios')
  const oldScenes = await wrap(d.transaction('scenes').objectStore('scenes').index('byProject').getAllKeys(id))
  const oldAssets = await wrap(d.transaction('assets').objectStore('assets').index('byProject').getAllKeys(id))
  await tx(d, ['projects', 'scenes', 'assets', 'confirmed'], 'readwrite', (t) => {
    t.objectStore('projects').put(rec.project)
    const ss = t.objectStore('scenes'), aa = t.objectStore('assets')
    for (const key of oldScenes) ss.delete(key)
    for (const key of oldAssets) aa.delete(key)
    for (const scene of rec.scenes) ss.put(scene)
    for (const asset of rec.assets) aa.put(asset)
    t.objectStore('confirmed').put({ ...rec, dirty: false })
  })
  touchAsset(id)
}


/** Una sola copia de recuperación por proyecto. Captura coherente en una transacción de lectura.
 * Los hashes se calculan fuera de la transacción; el registro solo se sustituye si está completo. */
export async function captureRecoveryProject(id) {
  const d = await db()
  const t = d.transaction(['projects', 'scenes', 'assets'], 'readonly')
  const [project, scenes, assets] = await Promise.all([
    wrap(t.objectStore('projects').get(id)),
    wrap(t.objectStore('scenes').index('byProject').getAll(id)),
    wrap(t.objectStore('assets').index('byProject').getAll(id)),
  ])
  const record = await makeRecoveryRecord(id, { project, scenes, assets })
  await tx(d, ['recovery'], 'readwrite', (t) => t.objectStore('recovery').put(record))
  return record.token
}

export async function listRecoveryProjects() {
  const d = await db()
  const records = await wrap(d.transaction('recovery').objectStore('recovery').getAll())
  const result = []
  for (const record of records) {
    let valid = true, summary = null, error = null
    try {
      await verifyRecoveryRecord(record)
      const confirmed = await getConfirmedProject(record.id)
      summary = summarizeRecovery(record, confirmed)
    } catch (err) { valid = false; error = err.message }
    result.push({ id: record.id, valid, error, summary, capturedAt: record.capturedAt, token: record.token })
  }
  return result.sort((a, b) => b.capturedAt - a.capturedAt)
}

/** Reinstala únicamente el proyecto señalado, sin consumir la copia si la transacción falla. */
export async function restoreRecoveryProject(id) {
  const d = await db()
  const record = await wrap(d.transaction('recovery').objectStore('recovery').get(id))
  await verifyRecoveryRecord(record)
  const { project, scenes, assets } = record.snapshot
  const t = d.transaction(['projects', 'scenes', 'assets', 'confirmed'], 'readwrite')
  const [oldScenes, oldAssets] = await Promise.all([
    wrap(t.objectStore('scenes').index('byProject').getAllKeys(id)),
    wrap(t.objectStore('assets').index('byProject').getAllKeys(id)),
  ])
  // Todos los cambios ocurren bajo la MISMA transacción; un error la revierte completa.
  t.objectStore('projects').put(project)
  const ss = t.objectStore('scenes'), aa = t.objectStore('assets')
  oldScenes.forEach((key) => ss.delete(key)); oldAssets.forEach((key) => aa.delete(key))
  scenes.forEach((s) => ss.put(s)); assets.forEach((a) => aa.put(a))
  const previous = await wrap(t.objectStore('confirmed').get(id))
  if (previous) t.objectStore('confirmed').put({ ...previous, dirty: true })
  await new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error) })
  touchAsset(id)
  return record.token
}

export async function consumeRecoveryProject(id, token) {
  const d = await db()
  await tx(d, ['recovery'], 'readwrite', (t) => {
    const s = t.objectStore('recovery'); const request = s.get(id)
    request.onsuccess = () => {
      if (request.result && (token === undefined || request.result.token === token)) s.delete(id)
    }
  })
}
