// Nether Film Maker · sesión: abre una película (.nfm) o una escena de Century (.lfproj), la monta con el motor de
// Century (la escena se guarda como copia propia «nfm_…», nunca pisa el proyecto original), aplica los cambios de objetos
// de la película, reproduce el entorno «como en Play» y guarda/exporta el .nfm.
import { reactive, markRaw } from 'vue'
import * as THREE from 'three'
import { store, openLfproj, switchScene, updateObject, saveNow, toast } from '../core/store.js'
import { parseLfproj } from '../core/lfproj.js'
import { newFilm, normalizeFilm, normalizeFilmCamera, normalizeOperator, activeFilmCamera, diffOverrides, diffSetting, applyOverrides, pruneOverrides, packNfm, unpackNfm } from './film.js'
import * as db from '../core/db.js'
import { addFolderChain } from '../core/project.js'
import { getAudio } from '../engine/runtime/audio/engine.js'
import { newCapture, normalizeCapture } from '../core/capture/format.js'
import { r4 } from '../core/capture/math.js'
import { PoseSource } from './pose.js'
import { ActorRig, TakePlayer, solveTake } from './actor.js'
import { OperatorRig, rotOf } from './operator.js'
import { sampleCamera } from '../core/capture/edit.js'
import { quatFromRot } from '../engine/runtime/timeline/eval.js'
import { FilmNodePose } from './node-tracks.js'
import { nodeScaleTarget } from '../engine/runtime/nodes/three-helpers.js'
import { FilmPhysicsPose, simulatePhysicsBake } from './physics-bake.js'
import { physicsSignature } from './physics-data.js'
import * as NA from './node-authoring.js'
import { sequence, locate, cameraAt as montageCamera, cameraForPass, effectsAt as montageEffects, transitionAt, audioAt, filmEnd, hasMontageContent, createEditorialShot as makeEditorialShot, resizeEditorialShot as resizeEditorialShotModel } from './montage.js'

const clone = (o) => JSON.parse(JSON.stringify(o))
const asFile = (name, bytes) => ({ name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) })
const isZipNfm = async (bytes) => { try { const { default: JSZip } = await import('jszip'); const z = await JSZip.loadAsync(bytes); return !!z.file('film.json') } catch { return false } }

export const session = reactive({
  film: null,          // film.json en memoria
  native: null,        // { projectId, cinematicId, revision, sceneStamp }, sólo sesión Electron
  lfproj: null,        // bytes del proyecto de Century (el entorno, sin los cambios de la película)
  baseline: [],        // objetos de la escena tal como vienen en el .lfproj
  base: { env: null, render: null, audio: null, assets: [] }, // ajustes y archivos originales (para saber qué cambió)
  playing: false, paused: false, time: 0, busy: '', error: '',
  pendingScenes: null, // al abrir un .lfproj con varias escenas: [{ id, name, count }] para elegir
  // pasada del actor
  live: { on: false, kind: '', fps: 0, calibrated: false, image: null, error: '' },
  rec: { state: 'idle', count: 0, frames: 0, t: 0 }, // idle · countdown · rec
  playback: { index: -1, t: 0, duration: 0 },
  // pasada del camarógrafo
  pass: { state: 'idle', count: 0, t: 0, keys: 0, input: '', take: -1, error: '' }, // idle · countdown · rec
  view: { index: -1, t: 0, duration: 0 },  // ver un pase de cámara
  montage: { on: false, T: 0, total: 0, index: -1 }, // reproducción del montaje
  author: { active: false, autoKey: false, undo: false, redo: false },
  physics: { state: 'idle', progress: 0, error: '', bodies: 0 },
})
let source = null, rig = null, recCap = null, take = null, op = null, remoteOp = null, remoteLast = 0, viewing = null, mont = null, nodePose = null, authorPose = null, physicsPose = null, stagedBake = null, bakeAbort = null, previewCameraBase = null
const trackHistory = new NA.FilmTrackHistory()

/** Escenas de un .lfproj (para elegir con cuál rodar). */
export async function scenesOf(bytes) {
  const { meta, scenes } = await parseLfproj(bytes)
  return { meta, list: meta.scenes.map((s) => ({ id: s.id, name: s.name, count: scenes.get(s.id)?.objects?.length ?? 0 })) }
}

/** Abre un archivo: .nfm (película) o .lfproj (escena nueva). `sceneId` elige la escena de un .lfproj con varias. */
export async function openFile(bytes, name = '', { sceneId = null } = {}) {
  session.native = null
  session.error = ''
  bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  if (/\.nfm$/i.test(name) || (await isZipNfm(bytes))) {
    const { film, lfproj, assets } = await unpackNfm(bytes)
    return mount(film, lfproj, { assets })
  }
  const { meta, list } = await scenesOf(bytes)
  if (!list.length) throw new Error('El proyecto no tiene escenas')
  if (!sceneId && list.length > 1) { session.pendingScenes = { bytes: markRaw(bytes), name, list, project: meta.name }; return 'choose' }
  const sc = list.find((s) => s.id === sceneId) || list.find((s) => s.id === meta.activeSceneId) || list[0]
  session.pendingScenes = null
  return mount(newFilm({ name: `${sc.name} · película`, sceneId: sc.id, sceneName: sc.name, projectId: meta.id, projectName: meta.name }), bytes)
}

/** Recurso del proyecto: se abre por ID, sin descargar ni reimportar su película. */
export async function openNativeFilm({ film, lfproj, revision, sceneStamp }, projectId, cinematicId) {
  if (film?.id !== cinematicId || film.scene?.projectId !== projectId || typeof revision !== 'string' || !revision) throw new Error('Recurso Cinematic nativo inválido')
  session.native = null
  const result = await mount(film, new Uint8Array(lfproj))
  session.native = { projectId, cinematicId, revision, sceneStamp }
  return result
}
/** Assets incorporados por FilmMaker a su copia aislada: el editor los agregará de forma atómica. */
export async function nativeAssetChanges() {
  const P = store.project, original = new Set(session.base.assets)
  const out = []
  for (const a of P?.assets || []) if (!original.has(a.id)) {
    const data = await db.getAsset(P.id, a.id)
    if (!data?.bytes) throw new Error(`Falta el archivo cinematográfico ${a.name}`)
    out.push({ id: a.id, name: a.name, folder: a.folder, kind: a.kind, ext: a.ext, bytes: new Uint8Array(data.bytes) })
  }
  return out
}

async function mount(film, lfproj, { keepOverrides = true, assets = new Map() } = {}) {
  cancelPhysicsSimulation(); physicsPose?.restore(); physicsPose=null; stagedBake=null; session.physics.state='idle'
  stopNodeAuthoring(); restoreEditorialCamera(); trackHistory.reset(); syncTrackHistory();
  stopRemotePreview(); stopPlayback(); stopLive(); stopView(); stopMontage(); nodePose?.restore(); nodePose = null; await cancelPass(); rig = null
  await stopEnvironment()
  session.busy = 'Montando la escena…'
  try {
    const ok = await openLfproj(asFile('scene.lfproj', lfproj), { id: 'nfm_' + film.id, quiet: true })
    if (!ok) throw new Error('No se pudo abrir la escena')
    const p = store.project
    if (!p.scenes.some((s) => s.id === film.scene.id)) {
      // la escena de la película ya no está en el proyecto: se usa la activa y se avisa
      toast(`La escena «${film.scene.name}» no está en el proyecto; se usa «${p.scenes.find((s) => s.id === p.activeSceneId)?.name}»`, 'error', 6000)
      film = { ...film, scene: { ...film.scene, id: p.activeSceneId, name: p.scenes.find((s) => s.id === p.activeSceneId)?.name || '' } }
    } else if (p.activeSceneId !== film.scene.id) await switchScene(film.scene.id)
    session.baseline = clone(store.project.objects)
    const P = store.project
    session.base = { env: clone(P.environment), render: clone(P.render || null), audio: clone(P.audio || null), assets: P.assets.map((a) => a.id) }
    let f = normalizeFilm(film)
    // archivos añadidos en la app (audio, imágenes): vuelven a la copia de trabajo
    for (const a of f.assets) {
      const b = assets.get(a.id); if (!b || P.assets.some((x) => x.id === a.id)) continue
      await db.putAsset(P.id, a.id, a.name, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
      P.assets.push({ id: a.id, name: a.name, folder: a.folder, kind: a.kind, ext: a.ext, bytes: b.byteLength }); addFolderChain(P, a.folder)
    }
    // atmósfera, color y mezclador de la película (vuelven a la escena al importar)
    if (f.scene.env) { P.environment = clone(f.scene.env); store.editor.syncEnvironment() }
    if (f.scene.render) P.render = clone(f.scene.render)
    if (f.scene.audio) P.audio = clone(f.scene.audio)
    if (keepOverrides) {
      const pr = pruneOverrides(f, store.project.objects)
      f = pr.film
      if (pr.removed.length) toast(`${pr.removed.length} objeto(s) movidos en la película ya no existen en la escena`, 'error', 5000)
      applyFilmOverrides(f.overrides)
    }
    session.film = f
    session.lfproj = markRaw(lfproj)
    store.project.name = f.name
    document.title = `${f.name} · Nether Film Maker`
    ensureFilmEditMode() // CA-001: abrir un Cinematic habilita la autoría sin pulsar «Animar».
    return 'ok'
  } finally { session.busy = '' }
}

function applyFilmOverrides(overrides) {
  const { applied } = applyOverrides(store.project.objects, overrides)
  for (const id of applied) updateObject(id, clone(overrides[id]), { commit: false })
  store.editor?.syncAll()
}

/** Sustituye el entorno por una versión nueva de la escena (.lfproj o .nfm exportado de Century): conserva todo lo de la película. */
export async function replaceScene(bytes, name = '') {
  if (!session.film) throw new Error('Primero abre una película')
  if (session.native) throw new Error('Un Cinematic nativo conserva la escena de su proyecto; abre otra película para sustituirla')
  bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const film = { ...currentFilm() }
  const files = await addedAssetFiles()
  let lfproj = bytes
  if (/\.nfm$/i.test(name) || (await isZipNfm(bytes))) lfproj = (await unpackNfm(bytes)).lfproj
  const { meta } = await scenesOf(lfproj)
  if (film.scene.projectId && meta.id !== film.scene.projectId) toast(`Ojo: «${meta.name}» es otro proyecto distinto al de la película`, 'error', 6000)
  film.scene = { ...film.scene, projectId: meta.id, projectName: meta.name }
  await mount(film, lfproj, { assets: files })
  toast('Escena sustituida: tomas, cámaras y cambios de objetos conservados', 'ok', 4000)
}

/** La película con los cambios actuales de la escena (lo que se guardará): objetos, atmósfera, color, mezclador y archivos añadidos. */
export function currentFilm() {
  if (!session.film) return null
  const P = store.project, B = session.base
  const added = (P?.assets || []).filter((a) => !B.assets.includes(a.id))
  return {
    ...session.film,
    overrides: diffOverrides(session.baseline, P?.objects || []),
    scene: { ...session.film.scene, env: diffSetting(B.env, P?.environment), render: diffSetting(B.render, P?.render ?? null), audio: diffSetting(B.audio, P?.audio ?? null) },
    assets: [...(session.native ? session.film.assets.filter(a => !added.some(b => b.id === a.id)) : []), ...added.map((a) => ({ id: a.id, name: a.name, folder: a.folder, kind: a.kind, ext: a.ext }))],
  }
}
/** Bytes de los archivos añadidos en la app. */
async function addedAssetFiles() {
  const P = store.project, out = new Map()
  const nativeIds = new Set(session.native ? session.film?.assets?.map(a => a.id) || [] : [])
  for (const a of P?.assets || []) if (!session.base.assets.includes(a.id) || nativeIds.has(a.id)) { const r = await db.getAsset(P.id, a.id); if (r?.bytes) out.set(a.id, new Uint8Array(r.bytes)) }
  return out
}
/** Qué ha cambiado de la escena (para el aviso de la barra). */
export function sceneChanges() {
  const f = currentFilm(); if (!f) return { objects: 0, env: false, render: false, audio: false, assets: 0 }
  return { objects: Object.keys(f.overrides).length, env: !!f.scene.env, render: !!f.scene.render, audio: !!f.scene.audio, assets: f.assets.length }
}
export function prepareFilmForSave() {
  if (session.film?.actor.contact && session.film.takes.some((c) => !c.solved)) {
    try { session.film = { ...session.film, takes: session.film.takes.map((c) => { if (c.solved) return c; const x = { ...c }; solveInto(x); return x }) } } catch (e) { console.warn('contacto', e) }
  }
  const f = currentFilm()
  if (!f) throw new Error('No hay película abierta')
  session.film = f
  return f
}
export async function buildNfm() {
  const f = prepareFilmForSave()
  return packNfm(f, session.lfproj, await addedAssetFiles())
}
/** Deshace los cambios de un objeto (vuelve a como está en la escena). */
export function resetObject(id) {
  const b = session.baseline.find((o) => o.id === id), o = store.project?.objects.find((x) => x.id === id)
  if (!b || !o) return
  for (const k of Object.keys(o)) if (!['id', 'parentId', 'type', 'kind', 'children'].includes(k) && !(k in b)) delete o[k]
  for (const [k, v] of Object.entries(clone(b))) if (!['id', 'parentId', 'type', 'kind', 'children'].includes(k)) o[k] = v
  store.editor?.syncObject(id); store.editor?.syncAll()
}
/** Vuelve la atmósfera / el color / el mezclador a como están en la escena. */
export function resetSetting(which) {
  const P = store.project, B = session.base; if (!P) return
  if (which === 'env') { P.environment = clone(B.env); store.editor.syncEnvironment() }
  if (which === 'render') P.render = clone(B.render)
  if (which === 'audio') P.audio = clone(B.audio)
}
export const changedObjects = () => Object.keys(diffOverrides(session.baseline, store.project?.objects || []))

// ---------- entorno «como en Play» ----------
/** Reproduce el entorno: clima, hora, rayos (con la semilla de la película), eventos y scripts; sin jugador. */
export async function playEnvironment({ onFrame = null } = {}) {
  const ed = store.editor
  if (!ed || !session.film || ed.player.on) return
  store.selectedId = null
  await ed.player.start({ film: { seed: session.film.seed, onFrame, camera: (cam) => { const v = ed.vp.persp; cam.position.copy(v.position); cam.quaternion.copy(v.quaternion); if (cam.fov !== v.fov) { cam.fov = v.fov; cam.updateProjectionMatrix() } } } })
  session.playing = !!ed.player.on; session.paused = false
}
/** Vuelve a empezar el entorno desde 0 (misma semilla: todo se repite igual). */
export async function restartEnvironment(opts) { await stopEnvironment(); await playEnvironment(opts) }
export async function stopEnvironment() {
  const ed = store.editor
  if (ed?.player.on) await ed.player.stop()
  session.playing = false; session.paused = false; session.time = 0
}
export function togglePause() { const pl = store.editor?.player; if (!pl?.on) return; pl.paused = !pl.paused; session.paused = pl.paused; store.play.paused = pl.paused }
export function tickInfo() { const f = store.editor?.player?.film; session.time = f ? f.time : 0 }

/** Tamaño de la escena (caja de terreno + objetos visibles), para saber los límites del rodaje. */
export function sceneBounds() {
  const ed = store.editor; if (!ed) return null
  const box = new THREE.Box3()
  ed.objectsGroup.updateMatrixWorld(true)
  box.expandByObject(ed.objectsGroup)
  for (const t of ed.terrains || []) if (t.enabled !== false && t.mesh) box.expandByObject(t.mesh)
  if (box.isEmpty()) return null
  const s = box.getSize(new THREE.Vector3())
  return { min: box.min.toArray().map((v) => +v.toFixed(2)), max: box.max.toArray().map((v) => +v.toFixed(2)), size: s.toArray().map((v) => +v.toFixed(1)) }
}
// ---------- pasada del actor ----------
export function actorObject() { const id = session.film?.actor.objectId; return id ? store.project?.objects.find((o) => o.id === id) : null }
function ensureRig() {
  const obj = actorObject()
  if (!obj?.modelId) throw new Error('Elige primero el personaje (pestaña Actor)')
  const a = session.film.actor
  const contact = a.contact ? { project: store.project, grip: a.grip } : null
  if (!rig || rig.obj.id !== obj.id || !!rig.contact !== !!contact) { rig?.rest(); rig = new ActorRig(store.editor, obj, { contact }) }
  else if (rig.contact) rig.contact.grip = a.grip
  if (!rig.ok) throw new Error(rig.sk ? `No reconozco el esqueleto humanoide (faltan: ${rig.report.missing.join(', ')})` : 'El personaje no tiene huesos')
  return rig
}
/** Enciende la fuente del cuerpo: 'camera' (facing 'user'|'environment'), 'video' (file) o 'sim'. El personaje imita al actor en vivo. */
export async function startLive(kind = 'camera', { facing = 'environment', file = null } = {}) {
  stopPlayback()
  stopLive()
  const r = ensureRig()
  r.resetCalibration()
  session.live = { on: true, kind, fps: 0, calibrated: false, image: null, error: '' }
  source = new PoseSource(kind, {
    facing, file, hands: !!session.film.actor.hands,
    onFrame: (f) => {
      const L = session.live
      L.fps = source?.fps || 0; L.image = f.image ? markRaw(f.image) : null
      r.applyRaw(f); L.calibrated = !!r.basis
      if (session.rec.state === 'rec' && recCap) {
        const t = (performance.now() - session.rec.t0) / 1000 // tiempo real: el movimiento no se estira aunque el móvil vaya lento
        recCap.body.frames.push(f.c ? { t: r4(t), p: f.p.map(r4), c: f.c } : { t: r4(t), p: f.p.map(r4) })
        session.rec.frames = recCap.body.frames.length; session.rec.t = t
      }
    },
    onError: (e) => { session.live.error = e.message || String(e) },
  })
  source.onEnd = () => { if (session.rec.state === 'rec') stopRecording(); session.live.on = false }
  try { await source.start() } catch (e) { session.live = { ...session.live, on: false, error: e.message || String(e) }; source = null; throw e }
  session.live.video = source.video ? markRaw(source.video) : null
}
export function stopLive() {
  source?.stop(); source = null
  if (session.rec.state !== 'idle') session.rec = { state: 'idle', count: 0, frames: 0, t: 0 }
  session.live = { on: false, kind: '', fps: 0, calibrated: false, image: null, error: '' }
  rig?.rest()
}
/** Cuenta atrás (te pones de frente: se calibra), el entorno vuelve a empezar desde 0 y se graba la toma. */
export async function startRecording({ countdown = 3 } = {}) {
  if (!session.live.on) throw new Error('Enciende primero la cámara (o el actor simulado)')
  const r = ensureRig()
  r.resetCalibration()
  session.rec = { state: 'countdown', count: countdown, frames: 0, t: 0 }
  for (let n = countdown; n > 0; n--) { session.rec.count = n; await new Promise((res) => setTimeout(res, 1000)); if (session.rec.state !== 'countdown') return }
  await restartEnvironment()
  recCap = newCapture(`Toma ${(session.film.takes.length || 0) + 1}`, { source: session.live.kind })
  session.rec = { state: 'rec', count: 0, frames: 0, t: 0, t0: performance.now() }
}
/** Termina la toma, la guarda en la película y para el entorno. */
export async function stopRecording() {
  if (session.rec.state === 'countdown') { session.rec = { state: 'idle', count: 0, frames: 0, t: 0 }; return null }
  if (session.rec.state !== 'rec' || !recCap) return null
  const cap = recCap; recCap = null
  session.rec = { state: 'idle', count: 0, frames: 0, t: 0 }
  await stopEnvironment()
  if (cap.body.frames.length < 5) { toast('Toma demasiado corta: no se guardó', 'error'); return null }
  const saved = normalizeCapture(cap)
  solveInto(saved)
  session.film = { ...session.film, takes: [...session.film.takes, saved] }
  toast(`${saved.name}: ${saved.body.frames.length} fotogramas`, 'ok')
  return saved
}
/** Reproduce una toma: el entorno empieza desde 0 y el personaje repite el movimiento en el mismo instante. */
export async function playTake(i) {
  const cap = session.film?.takes[i]
  if (!cap) return
  stopLive()
  const r = ensureRig()
  take = new TakePlayer(cap)
  const solved = solvedPlayer(cap, r)
  session.playback = { index: i, t: 0, duration: take.duration }
  await restartEnvironment({ onFrame: (t) => {
    if (!take) return
    session.playback.t = t
    const tt = Math.min(t, take.duration)
    if (solved) solved(tt); else { const f = take.frameAt(tt); if (f) r.applyCanonical(f) }
    if (t > take.duration + 0.5) stopPlayback()
  } })
}
export function stopPlayback() {
  if (!take) return
  take = null; session.playback = { index: -1, t: 0, duration: 0 }
  stopEnvironment(); rig?.rest()
}
/** Resuelve el contacto de una toma contra la escena actual y lo guarda en ella (`solved`). */
function solveInto(cap) {
  const r = ensureRig()
  if (!r.contact) { delete cap.solved; return null }
  const s = solveTake(r, cap)
  if (s) cap.solved = { modelId: r.obj.modelId, objectId: r.obj.id, ...s }
  return s
}
/** Vuelve a calcular el contacto de todas las tomas (tras mover objetos, sustituir la escena o cambiar el agarre). */
export function resolveAllTakes() {
  if (!session.film?.takes.length) return 0
  rig?.refreshColliders()
  const takes = session.film.takes.map((c) => { const x = { ...c }; solveInto(x); return x })
  session.film = { ...session.film, takes }
  return takes.length
}
/** Reproduce las pistas ya resueltas sobre los huesos del modelo de la escena. */
function solvedPlayer(cap, r) {
  const s = cap.solved; if (!s || s.modelId !== r.obj.modelId) return null
  r._bones()
  return (t) => {
    const B = r._byName; if (!B) return
    for (const tr of s.tracks) {
      const b = B.get(tr.bone); if (!b) continue
      const ts = tr.times; let i = 0
      if (t >= ts[ts.length - 1]) i = ts.length - 1; else while (i < ts.length - 1 && ts[i + 1] <= t) i++
      const j = Math.min(ts.length - 1, i + 1), u = j > i ? (t - ts[i]) / (ts[j] - ts[i]) : 0, v = tr.values
      b.quaternion.set(v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3])
      if (u > 0) b.quaternion.slerp(_qTmp.set(v[j * 4], v[j * 4 + 1], v[j * 4 + 2], v[j * 4 + 3]), Math.min(1, u))
    }
    store.editor.vp.requestRender()
  }
}
const _qTmp = new THREE.Quaternion()
export function renameTake(i, name) { const takes = [...session.film.takes]; takes[i] = { ...takes[i], name: String(name || takes[i].name) }; session.film = { ...session.film, takes } }
export function deleteTake(i) { if (session.playback.index === i) stopPlayback(); session.film = { ...session.film, takes: session.film.takes.filter((_, k) => k !== i) } }
export const takeDuration = (cap) => cap.body.frames.at(-1)?.t ?? 0

// Cámaras editoriales: el ID y el rig pertenecen a film.json, no a los nodos Gameplay.
export const selectedCamera = () => activeFilmCamera(session.film)
const cameraIdle = () => {
  if (!session.film || !store.editor) throw new Error('Abre primero una película')
  if (session.pass.state !== 'idle' || session.view.index >= 0 || session.montage.on || session.playing || remoteOp) throw new Error('Detén las grabaciones y reproducciones antes de editar cámaras')
  restoreEditorialCamera()
}
function cameraPoseNow() {
  const camera = store.editor.vp.persp
  return { pos: camera.position.toArray(), rot: rotOf(camera.quaternion), fov: camera.fov }
}
function showCameraPose(pose) {
  const cam = store.editor.vp.persp
  cam.position.set(...pose.pos); cam.quaternion.copy(quatFromRot(pose.rot)); cam.fov = pose.fov
  cam.updateProjectionMatrix()
  const controls = store.editor.vp.controls
  if (controls?.target) {
    const forward = new THREE.Vector3(0, 0, -5).applyQuaternion(cam.quaternion)
    controls.target.copy(cam.position).add(forward)
    controls.update?.()
  }
  store.editor.vp.requestRender()
}
export function selectCamera(id) {
  cameraIdle()
  const camera = session.film.cameras.find(c => c.id === id)
  if (!camera) throw new Error('La cámara seleccionada no existe')
  session.film = { ...session.film, activeCameraId: id }
  showCameraPose(camera.pose)
  return camera
}
export function addCamera({ duplicate = false } = {}) {
  cameraIdle()
  const current = selectedCamera()
  const camera = normalizeFilmCamera({ id: `cam_${Math.random().toString(36).slice(2, 11)}`,
    name: `Cámara ${session.film.cameras.length + 1}`,
    operator: duplicate ? clone(current.operator) : { kind: 'person' },
    pose: duplicate ? clone(current.pose) : cameraPoseNow() })
  session.film = { ...session.film, cameras: [...session.film.cameras, camera], activeCameraId: camera.id }
  showCameraPose(camera.pose)
  return camera
}
export function renameCamera(id, name) {
  cameraIdle()
  session.film = { ...session.film, cameras: session.film.cameras.map(c => c.id === id ? { ...c, name: String(name).trim() || c.name } : c) }
}
export function deleteCamera(id) {
  cameraIdle()
  if (session.film.cameras.length < 2) throw new Error('Debe conservarse al menos una cámara')
  if (session.film.passes.some(p => p.cameraId === id)) throw new Error('La cámara tiene pasadas: reasígnalas por ID antes de borrarla')
  const cameras = session.film.cameras.filter(c => c.id !== id)
  if (cameras.length === session.film.cameras.length) throw new Error('Cámara inexistente')
  session.film = { ...session.film, cameras, activeCameraId: session.film.activeCameraId === id ? cameras[0].id : session.film.activeCameraId }
  showCameraPose(selectedCamera().pose)
}
export function reassignPassCamera(index, id) {
  cameraIdle()
  if (!session.film.cameras.some(c => c.id === id)) throw new Error('Cámara destino inexistente')
  if (!session.film.passes[index]) throw new Error('Pasada inexistente')
  session.film = { ...session.film, passes: session.film.passes.map((p, i) => i === index ? { ...p, cameraId: id } : p) }
}
export function updateCameraOperator(patch) {
  cameraIdle()
  const cam = selectedCamera()
  const prev = cam.operator
  const next = normalizeOperator({ ...prev, ...patch,
    dolly: { ...prev.dolly, ...(patch.dolly || {}) },
    crane: { ...prev.crane, ...(patch.crane || {}) },
    shake: { ...prev.shake, ...(patch.shake || {}) } })
  session.film = { ...session.film, cameras: session.film.cameras.map(c => c.id === cam.id ? { ...c, operator: next } : c) }
}
/** Restaura el encuadre anterior al preview, sin escribir ni un dato de escena ni un pass. */
export function restoreEditorialCamera() {
  if (!previewCameraBase) return
  const pose = previewCameraBase; previewCameraBase = null
  if (store.editor?.vp?.persp) showCameraPose(pose)
}
/** Autoría de cámara sin grabación: un pass estático y su shot en la misma película. */
export function createFilmEditorialShot(cameraId = session.film?.activeCameraId, duration = 5) {
  cameraIdle()
  const camera = session.film.cameras.find(c => c.id === cameraId)
  if (!camera) throw new Error('Cámara de película no disponible')
  // Un plano desde la paleta usa el encuadre GUARDADO de la cámara; el visor solo previsualiza.
  const pose = camera.pose
  const result = makeEditorialShot(session.film, cameraId, duration, pose)
  session.film = result.film
  previewFilmTime(session.montage.T)
  return result
}
export function resizeFilmEditorialShot(shotId, out) {
  if (!session.film || session.playing || session.montage.on) throw new Error('Detén la reproducción antes de editar un plano')
  session.film = resizeEditorialShotModel(session.film, shotId, out)
  previewFilmTime(session.montage.T)
}
export function saveCameraPose() {
  cameraIdle()
  const current = selectedCamera(), pose = cameraPoseNow()
  session.film = { ...session.film, cameras: session.film.cameras.map(c => c.id === current.id ? { ...c, pose } : c) }
}
export function captureDollyPoint() {
  cameraIdle()
  const points = [...selectedCamera().operator.dolly.points]
  if (points.length >= 32) throw new Error('Máximo 32 puntos de riel')
  points.push(cameraPoseNow().pos)
  updateCameraOperator({ dolly: { points } })
}
export function clearDolly() { updateCameraOperator({ dolly: { points: [] } }) }
export function setCranePivotFromView() {
  cameraIdle()
  const rig = selectedCamera().operator.crane, p = cameraPoseNow().pos, a = rig.yaw * Math.PI / 180, e = rig.elevation * Math.PI / 180
  updateCameraOperator({ crane: { pivot: [p[0] - Math.sin(a) * Math.cos(e) * rig.arm,
    p[1] - Math.sin(e) * rig.arm, p[2] + Math.cos(a) * Math.cos(e) * rig.arm] } })
}
export const availableCameraShakes = () => (store.project?.objects || []).filter(o => o.type === 'cameraShake').map(o => ({ id: o.id, name: o.name || o.id }))
const shakeOptions = () => ({ objects: store.project?.objects || [], animations: store.project?.animations || [],
  onMissingShake: (id) => { if (!session._missingShake?.includes(id)) { session._missingShake = [...(session._missingShake || []), id]; toast(`Camera Shake Base inexistente: ${id}`, 'error', 5000) } } })

// Vista previa móvil S02: no arma, graba ni modifica la película.
export function beginRemotePreview() {
  if (!session.film || !store.editor) throw new Error('Abre primero una película o escena en FilmMaker')
  if (session.pass.state !== 'idle' || session.view.index >= 0 || session.playing || session.montage.on) throw new Error('Detén la reproducción y las tomas antes de vincular la cámara')
  stopRemotePreview()
  remoteOp = new OperatorRig({ editor: store.editor, operator: selectedCamera().operator, input: 'remote' }).begin()
  remoteLast = 0
  return true
}
export function remoteOrientation(values) { return remoteOp?.setRemoteOrientation(values) || false }
export function tickRemotePreview(delta) { if (remoteOp) remoteOp.update(Math.min(.05, Math.max(0, delta))) }
export function stopRemotePreview() { if (remoteOp) { remoteOp.end(); remoteOp = null }; remoteLast = 0 }

// ---------- pasada del camarógrafo ----------
export const operatorRig = () => op
/** Entrada disponible: 'ar' (si el móvil admite WebXR), 'sensors' (móvil) o 'mouse' (PC). */
export async function bestInput() {
  try { if (navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar'))) return 'ar' } catch { /* sin WebXR */ }
  return matchMedia('(pointer: coarse)').matches && 'DeviceOrientationEvent' in window ? 'sensors' : 'mouse'
}
function takeRunner(i) {
  const cap = session.film?.takes[i]
  if (!cap) return null
  let r = null
  try { r = ensureRig() } catch { return null }
  const tp = new TakePlayer(cap), solved = solvedPlayer(cap, r)
  return { duration: tp.duration, at: (t) => { const tt = Math.min(t, tp.duration); if (solved) solved(tt); else { const f = tp.frameAt(tt); if (f) r.applyCanonical(f) } } }
}
/**
 * Graba un pase de cámara: el entorno (y la toma del actor, si se elige) vuelven a empezar y tú filmas moviendo el móvil
 * (o el ratón). `input`: 'ar' | 'sensors' | 'mouse'. `overlay`: elemento que queda visible durante la sesión AR.
 */
export async function startPass({ input = 'mouse', take: ti = -1, countdown = 3, overlay = null } = {}) {
  stopRemotePreview()
  stopLive(); stopPlayback(); stopView()
  if (session.pass.state !== 'idle') return
  const camera = selectedCamera()
  if (!camera) throw new Error('No hay cámara editorial activa')
  if (camera.operator.kind === 'machine' && camera.operator.rig === 'dolly' && camera.operator.dolly.points.length < 2) throw new Error('Define al menos dos puntos del riel antes de grabar')
  showCameraPose(camera.pose)
  op = new OperatorRig({ editor: store.editor, operator: camera.operator, input }).begin()
  session.pass = { state: 'countdown', count: countdown, t: 0, keys: 0, input, take: ti, error: '' }
  try {
    if (input === 'sensors') op.startSensors()
    if (input === 'ar') await op.startAR(overlay || document.body)
  } catch (e) { op.end(); op = null; session.pass = { ...session.pass, state: 'idle', error: e.message || String(e) }; throw e }
  // la cuenta atrás ya mueve la cámara (para encuadrar), pero no graba
  let last = performance.now(), pre = true
  const preLoop = () => { if (!pre || !op) return; const now = performance.now(); op.update((now - last) / 1000); last = now; requestAnimationFrame(preLoop) }
  requestAnimationFrame(preLoop)
  for (let n = countdown; n > 0; n--) { session.pass.count = n; await new Promise((res) => setTimeout(res, 1000)); if (session.pass.state !== 'countdown') { pre = false; return } }
  pre = false
  const runner = ti >= 0 ? takeRunner(ti) : null
  let prevT = 0
  op.recording = true; op.recKeys = []; op._lastKey = -1
  session.pass.state = 'rec'
  await restartEnvironment({ onFrame: (t) => {
    if (!op) return
    runner?.at(t)
    op.update(Math.max(0, t - prevT)); prevT = t
    op.sample(t)
    session.pass.t = t; session.pass.keys = op.recKeys.length
    if (runner && t > runner.duration + 0.5) stopPass()
  } })
  store.editor.vp.controls.enabled = false // la cámara es del camarógrafo, no de la órbita del visor
}
/** Termina el pase y lo guarda en la película. */
export async function stopPass() {
  if (!op) return null
  const o = op; op = null
  const keys = o.recKeys
  o.end(); await o.stopAR()
  const st = session.pass
  session.pass = { state: 'idle', count: 0, t: 0, keys: 0, input: '', take: -1, error: '' }
  await stopEnvironment(); rig?.rest()
  if (st.state !== 'rec' || keys.length < 3) { if (st.state === 'rec') toast('Pase demasiado corto: no se guardó', 'error'); return null }
  const pass = { id: 'pass_' + Math.random().toString(36).slice(2, 9), name: `Cámara ${session.film.passes.length + 1}`, take: st.take, input: st.input, cameraId: selectedCamera().id, operator: clone(selectedCamera().operator), duration: keys.at(-1).t, keys }
  session.film = { ...session.film, passes: [...session.film.passes, pass] }
  toast(`${pass.name}: ${keys.length} claves de cámara`, 'ok')
  return pass
}
async function cancelPass() { if (op) { const o = op; op = null; o.end(); await o.stopAR() } session.pass = { state: 'idle', count: 0, t: 0, keys: 0, input: '', take: -1, error: '' } }
/** Ver un pase: el entorno y la toma vuelven a empezar y el visor mira por la cámara grabada. */
export async function viewPass(i) {
  const pass = session.film?.passes[i]
  if (!pass) return
  stopLive(); stopPlayback(); stopView()
  const runner = pass.take >= 0 ? takeRunner(pass.take) : null
  const cam = store.editor.vp.persp
  viewing = { pass }
  session.view = { index: i, t: 0, duration: pass.duration }
  store.editor.vp.controls.enabled = false
  await restartEnvironment({ onFrame: (t) => {
    if (!viewing) return
    runner?.at(t)
    const k = cameraForPass(session.film, pass, t, shakeOptions())
    if (k) { cam.position.set(...k.pos); cam.quaternion.copy(quatFromRot(k.rot)); if (Math.abs(cam.fov - k.fov) > 1e-3) { cam.fov = k.fov; cam.updateProjectionMatrix() } }
    session.view.t = t
    if (t > pass.duration + 0.5) stopView()
  } })
  store.editor.vp.controls.enabled = false
}
export function stopView() {
  if (!viewing) return
  viewing = null; session.view = { index: -1, t: 0, duration: 0 }
  store.editor.vp.controls.enabled = true
  stopEnvironment(); rig?.rest()
}
export function renamePass(i, name) { const passes = [...session.film.passes]; passes[i] = { ...passes[i], name: String(name || passes[i].name) }; session.film = { ...session.film, passes } }
export function deletePass(i) { if (session.view.index === i) stopView(); session.film = { ...session.film, passes: session.film.passes.filter((_, k) => k !== i) } }

// ---------- montaje (modo edición) ----------
export const setEdit = (edit) => { session.film = { ...session.film, edit } }

// ---------- edición de pistas por nodo (sin escribir en scene.lfproj) ----------
const syncTrackHistory = () => { session.author.undo = trackHistory.canUndo; session.author.redo = trackHistory.canRedo }
function authorTarget(nodeId) {
  const obj = store.project?.objects?.find(o => o.id === nodeId)
  if (!obj || !store.editor?.nodes?.has(nodeId)) throw new Error('El nodo no está disponible en esta escena')
  // S01-G001 define esta lista de exclusiones; se comparte con la evaluación real.
  const pose = new FilmNodePose(store.editor, [], store.project.objects, { actorId: session.film?.actor.objectId })
  if (!pose.target(nodeId)) throw new Error('Este nodo está reservado para física, actor o sistema de escena')
  return obj
}
function applyTrackEdit(next) {
  if (!ensureFilmEditMode() || session.playing || session.montage.on) { toast('Detén la reproducción antes de editar pistas', 'error'); return false }
  if (!session.film || !next || next === session.film.edit) return false
  if (!trackHistory.commit(session.film.edit, next)) return false
  setEdit(next)
  syncTrackHistory()
  if (session.author.active) previewNodeTracks(session.montage.T)
  return true
}
export function addFilmNode(nodeId) {
  try { const o=authorTarget(nodeId); return applyTrackEdit(NA.addNodeTrack(session.film.edit,nodeId,o.name)) }
  catch(e){ toast(e.message,'error');return false }
}
export function removeFilmNode(nodeId){return applyTrackEdit(NA.removeNodeTrack(session.film.edit,nodeId))}
export function toggleFilmNodeMute(nodeId, muted){return applyTrackEdit(NA.muteNodeTrack(session.film.edit,nodeId,muted))}
export function addFilmNodeProperty(nodeId,prop){return applyTrackEdit(NA.addProperty(session.film.edit,nodeId,prop))}
export function addFilmKey(nodeId,prop,T,v,ease,bz){return applyTrackEdit(NA.upsertNodeKey(session.film.edit,nodeId,prop,T,v,ease,bz))}
export function moveFilmKey(nodeId,prop,keyId,T){return applyTrackEdit(NA.moveNodeKey(session.film.edit,nodeId,prop,keyId,T))}
export function removeFilmKey(nodeId,prop,keyId){return applyTrackEdit(NA.removeNodeKey(session.film.edit,nodeId,prop,keyId))}
export function editFilmKey(nodeId,prop,keyId,v,ease,bz){return applyTrackEdit(NA.editNodeKey(session.film.edit,nodeId,prop,keyId,v,ease,bz))}
export function undoFilmTrack(){if(!ensureFilmEditMode())return false;const e=trackHistory.undo(session.film.edit);if(!e)return false;setEdit(e);syncTrackHistory();if(session.author.active)previewNodeTracks(session.montage.T);return true}
export function redoFilmTrack(){if(!ensureFilmEditMode())return false;const e=trackHistory.redo(session.film.edit);if(!e)return false;setEdit(e);syncTrackHistory();if(session.author.active)previewNodeTracks(session.montage.T);return true}
/** Firma de los colisionadores y de sus ancestros; ningún bake obsoleto se aplica silenciosamente. */
export function physicsBakeStatus() {
  const bake=session.film?.edit?.physicsBakes?.[0]
  if (!bake) return 'none'
  return bake.signature === physicsSignature(store.project?.objects||[]) ? 'valid' : 'stale'
}
/** Solo prepara una simulación aislada. Hornear es una operación posterior y deshacible. */
export async function simulateFilmPhysics({duration=3,start=0}={}) {
  if(!ensureFilmEditMode() || !session.film || !store.editor || session.playing || session.montage.on || bakeAbort) {
    toast('Detén el montaje antes de simular física','error');return false
  }
  const ctrl=new AbortController();bakeAbort=ctrl
  session.physics={state:'running',progress:0,error:'',bodies:0};stagedBake=null
  try {
    // Las transformaciones temporales de Animar se retiran antes de clonar la escena.
    authorPose?.restore();physicsPose?.restore()
    const result=await simulatePhysicsBake({ objects:store.project.objects,nodes:store.editor.nodes,duration,start,signal:ctrl.signal,
      onProgress:p=>{session.physics.progress=Math.round(p*100)} })
    if (ctrl.signal.aborted) throw new Error('Physics Bake cancelado')
    stagedBake=result
    session.physics={state:'simulated',progress:100,error:'',bodies:result.bodies.length,start:result.start,duration:result.duration}
    previewNodeTracks(session.montage.T)
    return true
  } catch(err) {
    session.physics={state:ctrl.signal.aborted?'idle':'error',progress:0,error:err.message||String(err),bodies:0}
    if(!ctrl.signal.aborted)toast(session.physics.error,'error',6000)
    previewNodeTracks(session.montage.T)
    return false
  } finally {if(bakeAbort===ctrl)bakeAbort=null}
}
export function cancelPhysicsSimulation(){bakeAbort?.abort();stagedBake=null;if(['simulated','running'].includes(session.physics.state))session.physics.state='idle';if(session.author.active && !session.montage.on)previewNodeTracks(session.montage.T)}
export const physicsDraft = () => stagedBake
export function commitFilmPhysicsBake() {
  if (!stagedBake || !session.author.active || session.montage.on) return false
  if (stagedBake.signature !== physicsSignature(store.project.objects)) {toast('Las colisiones cambiaron; vuelve a simular','error');return false}
  const next={...session.film.edit,physicsBakes:[stagedBake]}
  if (!applyTrackEdit(next)) return false
  session.physics={state:'baked',progress:100,error:'',bodies:stagedBake.bodies.length};stagedBake=null
  return true
}
export function removeFilmPhysicsBake() {
  if (!session.author.active || !session.film?.edit.physicsBakes?.length) return false
  const ok=applyTrackEdit({...session.film.edit,physicsBakes:[]})
  if(ok){physicsPose?.restore();session.physics={state:'idle',progress:0,error:'',bodies:0}}
  return ok
}
/** El estado active sigue protegiendo las poses temporales; ya no es una acción manual previa. */
export function ensureFilmEditMode() {
  if (!session.film || !store.project || !store.editor || session.playing || session.montage.on || session.pass.state !== 'idle' || session.rec.state !== 'idle' || session.view.index >= 0) return false
  if (!session.author.active) setNodeAuthoring(true)
  return session.author.active
}
export function setNodeAuthoring(active) {
  if (!active) { stopNodeAuthoring(); return }
  if (!session.film || !store.project || session.playing || session.montage.on) { toast('Detén la reproducción antes de editar animaciones','error'); return }
  session.author.active=true
  previewNodeTracks(session.montage.T)
}
export function stopNodeAuthoring(){
  cancelPhysicsSimulation()
  authorPose?.restore();authorPose=null
  physicsPose?.restore();physicsPose=null
  session.author.active=false;session.author.autoKey=false
  store.editor?.vp?.requestRender?.()
}
/** Cabezal de montaje: compone pose de nodos y cámara sin disparar sonido ni scripts. */
export function previewFilmTime(T) {
  if (!ensureFilmEditMode()) return false
  if (!previewNodeTracks(T)) return false
  const camera = montageCamera(session.film, sequence(session.film), Math.max(0, T), shakeOptions())
  if (camera) {
    if (!previewCameraBase) previewCameraBase = cameraPoseNow()
    showCameraPose(camera)
  } else restoreEditorialCamera()
  return true
}
export function previewNodeTracks(T) {
  if (!session.film || !session.author.active || session.montage.on || session.playing || !store.project) return false
  if (!authorPose) authorPose=new FilmNodePose(store.editor,session.film.edit.nodeTracks,store.project.objects,{actorId:session.film.actor.objectId})
  authorPose.tracks=session.film.edit.nodeTracks
  authorPose.at(Math.max(0,T))
  if (!physicsPose) physicsPose=new FilmPhysicsPose(store.editor,store.project.objects,session.film.edit.physicsBakes)
  physicsPose.bakes=stagedBake?[stagedBake]:session.film.edit.physicsBakes;physicsPose.objects=store.project.objects
  physicsPose.at(Math.max(0,T));session.montage.T=Math.max(0,T)
  return true
}
/** El gizmo aplica la pose solo en Three.js. Convertimos la pose final en una transacción Undo. */
/** Punto de commit del gizmo: el modelo de escena permanece en su estado confirmado. */
export function finishFilmGizmo(obj,node,isScale,mode) {
  if (!session.author.active) return false
  const part=mode==='scale'||isScale?'scale':mode==='rotate'?'rotation':'position'
  const scale=nodeScaleTarget(node,obj.type).scale
  const value=part==='scale'?scale.toArray():part==='rotation'?[node.rotation.x,node.rotation.y,node.rotation.z].map(v=>v*180/Math.PI):node.position.toArray()
  // La primera clave aún no tiene base capturada: restaurarla desde el dato canónico.
  if (!authorPose?.saved.has(obj.id)) {
    node.position.set(...(obj.position || [0,0,0]))
    node.rotation.set(...(obj.rotation || [0,0,0]).map(v=>v*Math.PI/180))
    scale.set(...(obj.scale || [1,1,1]))
    node.updateMatrixWorld?.(true)
  }
  try {
    authorTarget(obj.id)
    if (session.author.autoKey) {
      if (!NA.nodeTrackOf(session.film.edit,obj.id)) throw new Error('Añade primero una pista de este nodo')
      addFilmKey(obj.id,part,session.montage.T,value)
    }
  } catch(e) { toast(e.message,'error',4500) }
  finally {
    if (authorPose) authorPose.at(session.montage.T)
    else previewNodeTracks(session.montage.T)
    store.editor?.setSelection?.(store.selectedId,store.selectedIds)
  }
  return true
}
const filterProfileId = (id) => 'nfm_' + id
/** Los filtros de la película como perfiles de post-proceso de la copia de trabajo (para verlos aquí). */
function syncFilterProfiles() {
  const p = store.project; if (!p) return
  p.profiles = (p.profiles || []).filter((x) => !String(x.id).startsWith('nfm_flt'))
  for (const f of session.film.edit.filters) p.profiles.push({ id: filterProfileId(f.id), name: `${f.name}.profile`, folder: 'Assets/Profiles', fx: JSON.parse(JSON.stringify(f.fx)) })
}
function applyOverlay(fx) {
  const pl = store.play
  pl.caption = fx.caption ? { id: 'mont', text: fx.caption, pos: fx.captionPos } : null
  pl.letterbox = fx.letterbox
  pl.fade = { color: fx.fadeColor, alpha: fx.fade, ms: 0 }
}
function clearOverlay() { const pl = store.play; pl.caption = null; pl.letterbox = 0; pl.fade = { color: '#000000', alpha: 0, ms: 0 } }
// ---- sonido del montaje: una voz por clip que suena, con su segundo del archivo y su fundido ----
const voices = new Map() // id de clip → { voice, pending }
let voicesPaused = false
function syncAudio(T, paused) {
  const eng = getAudio()
  if (paused !== voicesPaused) { voicesPaused = paused; for (const v of voices.values()) v.voice && (paused ? v.voice.pause() : v.voice.resume()) }
  if (paused) return
  const now = audioAt(session.film, T), want = new Set(now.map((x) => x.clip.id))
  for (const [id, v] of voices) if (!want.has(id)) { v.voice?.stop(0.03); v.dead = true; voices.delete(id) }
  for (const x of now) {
    const v = voices.get(x.clip.id)
    if (v) { if (v.voice) v.voice.setVolume(x.gain); continue }
    const rec = { voice: null }
    voices.set(x.clip.id, rec)
    const g = eng.cfg.groups.find((y) => y.id === x.track.group || y.name.toLowerCase() === String(x.track.group).toLowerCase())
    eng.play(x.clip.asset, { group: g?.id || 'music', mode: 'ui', volume: x.gain, offset: x.offset }).catch((e) => { console.warn('audio del montaje', e); return null }).then((voice) => { if (rec.dead || voices.get(x.clip.id) !== rec) voice?.stop(); else rec.voice = voice })
  }
}
/** Clips que suenan ahora mismo en el montaje (para la interfaz y las pruebas). */
export const montageVoices = () => [...voices.values()].filter((v) => v.voice?.isPlaying).length
export const _voicesDebug = () => [...voices].map(([id, v]) => ({ id, has: !!v.voice, playing: v.voice?.playing, paused: v.voice?.paused, dead: !!v.dead, vol: v.voice?.volume }))
function stopAudio() { for (const v of voices.values()) { v.dead = true; v.voice?.stop(0.05) } voices.clear(); voicesPaused = false }
/** Reproduce la secuencia del montaje desde T: cámara de cada plano, actor de su toma, clima en su instante, filtro y capas. */
export async function playMontage(fromT = 0, { pause = false } = {}) {
  stopLive(); stopPlayback(); stopView(); await cancelPass()
  const seq = sequence(session.film)
  // La película puede contener únicamente animaciones de nodos, física o sonido.
  if (!montageHasContent()) { toast('El montaje no contiene contenido reproducible', 'error'); return }
  const total = Math.max(0.1, filmEnd(session.film, seq))
  restoreEditorialCamera()
  stopNodeAuthoring()
  syncFilterProfiles()
  nodePose?.restore(); nodePose = new FilmNodePose(store.editor, session.film.edit.nodeTracks, store.project.objects, { actorId: session.film.actor.objectId })
  physicsPose?.restore(); physicsPose = new FilmPhysicsPose(store.editor,store.project.objects,session.film.edit.physicsBakes)
  stopAudio()
  mont = { seq, index: -1, runner: null, item: null, total }
  session.montage = { on: true, T: Math.min(total, Math.max(0, Number.isFinite(fromT) ? fromT : 0)), total, index: -1 }
  const pl = store.editor.player
  const enter = (loc) => {
    mont.index = loc.index; mont.item = loc.item
    mont.runner = loc.item.pass.take >= 0 ? takeRunner(loc.item.pass.take) : null
    if (!mont.runner) rig?.rest()
    pl.filmJump(loc.local)
    try { pl._profSet(loc.item.shot.filter ? filterProfileId(loc.item.shot.filter) : '', 0) } catch { /* filtro borrado */ }
    session.montage.index = loc.index
  }
  const cam = store.editor.vp.persp
  const show = (T, local) => {
    mont.runner?.at(local)
    const skipped = [...(nodePose?.at(T)||[]), ...(physicsPose?.at(T)||[])] // tiempos absolutos, sin Jolt ni modificar scene.lfproj
    for (const id of skipped) {
      if (!mont.reported) mont.reported = new Set()
      if (!mont.reported.has(id)) { mont.reported.add(id); toast(`Animación del nodo ${id}: no existe o no admite control editorial`, 'error', 4500) }
    }
    const k = montageCamera(session.film, mont.seq, T, shakeOptions())
    if (k) { cam.position.set(...k.pos); cam.quaternion.copy(quatFromRot(k.rot)); if (Math.abs(cam.fov - k.fov) > 1e-3) { cam.fov = k.fov; cam.updateProjectionMatrix() } }
    const fx = montageEffects(session.film, T), tr = transitionAt(session.film, mont.seq, T)
    if (tr.alpha > fx.fade) { fx.fade = tr.alpha; fx.fadeColor = tr.color }
    applyOverlay(fx)
    syncAudio(T, !!store.editor.player.paused)
    session.montage.T = T
  }
  await restartEnvironment({ onFrame: (t) => {
    if (!mont) return
    const it = mont.item
    if (!it) {
      // Sin planos: el reloj de FilmMaker sigue siendo absoluto y las pistas
      // de nodos/física/sonido se pueden reproducir sin cámara inventada.
      if (t >= mont.total) { show(mont.total, mont.total); stopMontage(); return }
      show(t, t)
      return
    }
    // reloj real: si el equipo no llega a dibujar a tiempo, la imagen salta para seguir al sonido (como un editor de vídeo)
    const pl = store.editor.player, now = performance.now()
    if (pl.paused || !mont.clock) mont.clock = { real: now, T: session.montage.T }
    else if (mont.tail == null) {
      const want = mont.clock.T + (now - mont.clock.real) / 1000, have = it.start + (t - it.in)
      if (want - have > 0.3 && want < it.end) { pl.filmJump(it.in + (want - it.start)); t = pl.film.time }
      else if (want - have > 0.3 && want >= it.end && mont.index < mont.seq.items.length - 1) { const nx = locate(mont.seq, Math.min(want, mont.seq.total - 1e-3)); enter(nx); show(want, nx.local); mont.clock = { real: now, T: want }; return }
      else if (want - have > 0.3 && want >= it.end) { // ya pasó el último plano: queda el sonido (o se acabó)
        if (want >= mont.total) { show(mont.total - 1e-3, it.out); stopMontage(); return }
        mont.tail = t - (want - mont.seq.total)
      }
    }
    let T = it.start + (t - it.in)
    if (mont.tail != null) { // después del último plano: la imagen queda quieta mientras termina el sonido
      T = mont.seq.total + (t - mont.tail)
      if (T >= mont.total) { stopMontage(); return }
      show(T, it.out); return
    }
    if (t >= it.out - 1e-6) {
      if (mont.index >= mont.seq.items.length - 1) {
        if (mont.total > mont.seq.total + 1e-3) { mont.tail = t; show(mont.seq.total, it.out); return }
        show(mont.seq.total - 1e-3, it.out); stopMontage(); return
      }
      const next = locate(mont.seq, it.end + 1e-4); enter(next); T = next.item.start + (next.local - next.item.in); mont.clock = { real: performance.now(), T }
      show(T, next.local); return
    }
    show(T, t)
  } })
  // Solo uno escribe cada cuerpo horneado: al arrancar Player, se retiran sus cuerpos
  // dinámicos del mundo de juego. El overlay grabado será su controlador durante el montaje.
  if (physicsBakeStatus()==='valid' && pl.phys?.bodies && Array.isArray(pl._bodies)) {
    const ids=new Set(session.film.edit.physicsBakes.flatMap(b=>b.bodies.map(x=>x.nodeId)))
    for (const body of pl._bodies.filter(b=>ids.has(b.id))) {
      pl.phys.rigidNodes.delete(body.node)
      pl.phys.bodies.remove(body.item)
    }
    pl._bodies=pl._bodies.filter(b=>!ids.has(b.id))
  }
  store.editor.vp.controls.enabled = false
  if (seq.items.length) {
    const loc = locate(seq, Math.min(session.montage.T, seq.total))
    enter(loc)
    if (session.montage.T > seq.total) { mont.tail = store.editor.player.film.time - (session.montage.T - seq.total) }
    show(session.montage.T, loc.local)
  } else {
    // No se pasa por locate()/enter() sobre una secuencia vacía.
    pl.filmJump(session.montage.T)
    show(session.montage.T, session.montage.T)
  }
  if (pause) togglePause()
}
export function stopMontage() {
  nodePose?.restore(); nodePose = null
  physicsPose?.restore(); physicsPose = null
  if (!mont) return
  const T = session.montage.T, total = session.montage.total
  mont = null; session.montage = { on: false, T, total, index: -1 } // el cabezal se queda donde estaba
  clearOverlay(); stopAudio()
  try { store.editor.player._profSet('', 0) } catch { /* sin juego */ }
  store.editor.vp.controls.enabled = true
  void stopEnvironment().then(() => { if (!session.montage.on) previewFilmTime(session.montage.T) })
  rig?.rest()
}
/** Ir a un instante del montaje (en pausa: se ve ese fotograma). */
export async function seekMontage(T) { const was = session.montage.on && !session.paused; await playMontage(T, { pause: !was }) }
/** Una película puede tener pistas sin planos; las capas solas son overlays. */
export const montageHasContent = () => hasMontageContent(session.film)
export const montageSequence = () => (session.film ? sequence(session.film) : { items: [], total: 0 })
export const montageEnd = () => (session.film ? filmEnd(session.film) : 0)
/** Duración real de un archivo de audio del proyecto (s), para el timeline. */
export async function assetDuration(id) { try { const e = getAudio(); await e.ensure(); const b = await e.buffer(id); return b?.duration || 0 } catch { return 0 } }

export { saveNow }
