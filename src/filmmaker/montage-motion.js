// Nether Film Maker → Timeline nativo. Conversión y preflight puros: no mutan proyectos ni assets.
// Los tracks de animación son por ID, las tomas Jolt ya están horneadas y usan el mismo reloj del montaje.
import { newKey, newTrack } from '../core/timeline/model.js'
import { normalizeNodeTracks } from './node-tracks.js'
import { normalizePhysicsBakes, physicsSignature } from './physics-data.js'

const MANUAL_DENIED = new Set(['node', 'gameplayObject', 'rigidbody3d', 'staticbody3d', 'characterbody3d', 'collisionshape3d', 'area3d'])
const idOf = o => String(o?.id || '')

/** Valida ANTES de importar; nunca reubica animaciones por nombre cuando falta el ID original. */
export function validateFilmMotion(film, objects, overrides = {}) {
  const tracks = normalizeNodeTracks(film?.edit?.nodeTracks || [])
  const bakes = normalizePhysicsBakes(film?.edit?.physicsBakes || [])
  if (!tracks.length && !bakes.length) return { tracks, bakes }
  if (!Array.isArray(objects)) throw new Error('Cinemática: escena de destino no disponible')
  const byId = new Map(objects.map(o => [idOf(o), o]))
  const actorId = film?.actor?.objectId || ''
  const manualIds = new Set(), physicalIds = new Set()
  for (const track of tracks) {
    const obj = byId.get(track.nodeId)
    if (!obj) throw new Error(`Cinemática: no existe el nodo de animación ID «${track.nodeId}»`)
    if (track.nodeId === actorId || MANUAL_DENIED.has(obj.type)) throw new Error(`Cinemática: nodo incompatible con animación manual «${track.nodeId}»`)
    manualIds.add(track.nodeId)
  }
  const merged = objects.map(o => ({ ...o, ...(overrides[o.id] || {}) }))
  for (const bake of bakes) {
    if (bake.signature !== physicsSignature(merged)) throw new Error('Cinemática: Physics Bake desactualizado. Rehornea la simulación en Nether Film Maker.')
    for (const body of bake.bodies) {
      const obj = byId.get(body.nodeId)
      if (!obj || obj.type !== 'rigidbody3d') throw new Error(`Cinemática: RigidBody3D inexistente o incompatible: «${body.nodeId}»`)
      if (physicalIds.has(body.nodeId)) throw new Error(`Cinemática: bake físico duplicado en «${body.nodeId}»`)
      physicalIds.add(body.nodeId)
      if (manualIds.has(body.nodeId)) throw new Error(`Cinemática: doble control de Transform para «${body.nodeId}»`)
    }
  }
  return { tracks, bakes }
}

/** Genera pistas nativas: curvas existentes de AnimRunner y un bloque quaternion por cuerpo. */
export function convertFilmMotion(film, objects, overrides) {
  const { tracks, bakes } = validateFilmMotion(film, objects, overrides)
  const result = []
  for (const tr of tracks) for (const part of tr.properties) {
    if (!part.keys.length) continue
    const native = newTrack('node', { name: `${tr.name || tr.nodeId} · ${part.prop}`, node: tr.nodeId, byId: true, prop: part.prop, muted: tr.muted })
    native.keys = part.keys.map(k => newKey('node', k.t, { v: [...k.v], ease: k.ease, ...(k.bz ? { bz: [...k.bz] } : {}) }))
    result.push(native)
  }
  for (const bake of bakes) for (const body of bake.bodies) {
    result.push(newTrack('bake', {
      name: `Física horneada · ${body.nodeId}`, node: body.nodeId, start: bake.start,
      duration: bake.duration, hz: bake.hz,
      samples: body.samples.map(sample => ({ pos: [...sample.pos], quat: [...sample.quat] })),
    }))
  }
  return result
}
