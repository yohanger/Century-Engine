// Captura de movimiento (Century Capture → .lfcap): importar, clips de huesos y cinemáticas.
import * as THREE from 'three'
import { uid, DEG } from '../../engine/runtime/util.js'
import { store } from './state.js'
import { commit } from './history.js'
import { worldMatrix } from './tree.js'
import { tool } from '../tools.js'
import { normalizeCaptureClip } from '../capture/clips.js'

// ---- captura de movimiento (Century Capture → .lfcap) ----
const capTool = () => tool('capture') // { parse, bake, retarget, findHumanoid, humanoidReport, cinematicFromTake }
export const filmTool = () => tool('film') // { newFilm, packNfm, unpackNfm, applyOverrides, cinematicFromPass, montageTimeline, sequence, cinematicReel }

/** Pasa project.captures al editor (clips de huesos de cada modelo) y actualiza la lista de clips de los modelos. */
export function applyCaptureClips() {
  const p = store.project
  if (!p || !store.editor?.setCaptureClips) return
  const desc = store.editor.setCaptureClips(p.captures || [])
  for (const m of p.models || []) if (desc[m.id]) m.clips = desc[m.id]
}
/** Lee un .lfcap (texto) y devuelve la captura y sus tomas horneadas, para la ventana de importación. Lanza si no es válido. */
export function readCapture(text) {
  const cap = capTool().parse(text)
  const { takes } = capTool().bake(cap)
  return { cap, takes: takes.map((t, i) => ({ index: i, name: t.name, duration: t.duration, frames: t.frames.length, cameraKeys: t.camera.length, layers: t.layers.length })) }
}
/** ¿El modelo tiene un esqueleto humanoide que reconozca el retarget? */
export function captureRigInfo(modelId) {
  const sk = store.editor?.modelSkeleton?.(modelId)
  if (!sk) return { ok: false, bones: 0, missing: ['esqueleto'], map: null }
  const map = capTool().findHumanoid(sk.bones)
  return { ...capTool().humanoidReport(map), bones: sk.bones.length, map: Object.fromEntries(Object.entries(map).filter(([k]) => k !== 'L' && k !== 'R').map(([k, i]) => [k, sk.bones[i].name])) }
}
const uniqueClipName = (modelId, base) => {
  const used = new Set((store.project.models.find((m) => m.id === modelId)?.clips || []).map((c) => c.name.toLowerCase()))
  let name = base, n = 2
  while (used.has(name.toLowerCase())) name = `${base} ${n++}`
  return name
}
/**
 * Importa una captura: retargetea cada toma al esqueleto del modelo (clip de huesos guardado en el proyecto) y, si se pide,
 * crea una cinemática por toma (cámara del móvil anclada al nodo + reproducir la animación + subtítulos/fundidos/barras).
 * @param o { modelId, nodeId?, takes?: number[] (todas por defecto), timeline?: bool, camera?: bool }
 * @returns { clips: string[], timelines: string[] }
 */
export function importCapture(cap, o = {}) {
  const p = store.project
  const model = p.models.find((m) => m.id === o.modelId)
  if (!model) throw new Error('Elige un modelo con esqueleto')
  const sk = store.editor.modelSkeleton(model.id)
  if (!sk) throw new Error(`«${model.name}» no tiene huesos: la captura necesita un modelo con esqueleto (glTF con skin)`)
  const rep = capTool().humanoidReport(capTool().findHumanoid(sk.bones))
  if (!rep.ok) throw new Error(`No reconozco el esqueleto humanoide de «${model.name}» (faltan: ${rep.missing.join(', ')})`)
  const { takes } = capTool().bake(cap)
  const pick = Array.isArray(o.takes) && o.takes.length ? o.takes.filter((i) => takes[i]) : takes.map((_, i) => i)
  const node = o.nodeId ? p.objects.find((x) => x.id === o.nodeId) : null
  let anchor = { pos: [0, 0, 0], yaw: 0 }
  if (node) {
    const m = worldMatrix(node.id), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
    m.decompose(pos, q, s)
    anchor = { pos: pos.toArray(), yaw: new THREE.Euler().setFromQuaternion(q, 'YXZ').y / DEG }
  }
  p.captures ||= []
  const clips = [], tls = []
  for (const i of pick) {
    const take = takes[i]
    // Nether Film Maker ya resolvió la toma (contacto con el entorno + dedos) para este mismo modelo: se usan esas pistas tal cual
    const rt = o.solved && o.solved.modelId === model.id && pick.length === 1 ? { tracks: o.solved.tracks } : capTool().retarget(take.frames, sk, { facing: o.facing })
    const name = uniqueClipName(model.id, take.name)
    p.captures.push(normalizeCaptureClip({ id: uid('cc'), name, modelId: model.id, fps: take.fps, duration: take.duration, tracks: rt.tracks, from: { capture: cap.id, take: i } }))
    applyCaptureClips()
    clips.push(name)
    if (o.timeline !== false) {
      let tname = name, n = 2
      while (p.timelines.some((t) => t.name.toLowerCase() === tname.toLowerCase())) tname = `${name} ${n++}`
      const tl = capTool().cinematicFromTake(take, { name: tname, node: node?.id || '', clip: node ? name : '', anchor, camera: o.camera !== false })
      p.timelines.push(tl); tls.push(tl.name); store.timelineId = tl.id
    }
  }
  if (!o.quiet) commit('Importar captura')
  return { clips, timelines: tls }
}
/** Borra un clip capturado del proyecto. */
export function deleteCaptureClip(id) {
  const p = store.project
  p.captures = (p.captures || []).filter((c) => c.id !== id)
  applyCaptureClips()
  commit('Eliminar captura')
}
export function openCaptureImport() { store.modal = 'capture' }

