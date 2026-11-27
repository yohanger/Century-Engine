// Pistas de Transform en segundos ABSOLUTOS de montaje, referidas por ID de nodo.
// Reutilizan la interpolación de AnimRunner, independiente del antiguo editor de clips.
import { uid } from '../engine/runtime/util.js'
import { EASES, normalizeKey } from '../engine/runtime/anim/model.js'
import { sampleTrack } from '../engine/runtime/anim/eval.js'

const PROPERTIES = new Set(['position', 'rotation', 'scale'])
const SUPPORTED = new Set(EASES.map(([name]) => name))
const identifier = (value, prefix) => typeof value === 'string' && value.trim() ? value : uid(prefix)
const assert = (condition, message) => { if (!condition) throw new Error(`Pista de animación: ${message}`) }

/** Validación no destructiva de identificadores, propiedades, claves y tiempos únicos. */
export function normalizeNodeTracks(input = []) {
  assert(Array.isArray(input), 'nodeTracks debe ser una lista')
  const usedNodes = new Set(), usedIds = new Set()
  return input.map((track) => {
    assert(track && typeof track === 'object' && !Array.isArray(track), 'pista inválida')
    const nodeId = String(track.nodeId || '').trim()
    assert(nodeId, 'falta nodeId (no se permiten referencias por nombre)')
    assert(!usedNodes.has(nodeId), `pista duplicada para el nodo ${nodeId}`)
    usedNodes.add(nodeId)
    const id = identifier(track.id, 'fn')
    assert(!usedIds.has(id), `id de pista duplicado: ${id}`); usedIds.add(id)
    assert(Array.isArray(track.properties), `faltan propiedades para ${nodeId}`)
    const usedProps = new Set()
    const properties = track.properties.map((part) => {
      assert(part && PROPERTIES.has(part.prop), 'solo se admiten position, rotation y scale en S01')
      assert(!usedProps.has(part.prop), `propiedad repetida ${part.prop} de ${nodeId}`)
      usedProps.add(part.prop)
      const pid = identifier(part.id, 'fp')
      assert(!usedIds.has(pid), `id duplicado: ${pid}`); usedIds.add(pid)
      assert(Array.isArray(part.keys), `claves inválidas de ${part.prop}`)
      const keys = part.keys.map((key) => {
        assert(key && Number.isFinite(key.t) && key.t >= 0, `tiempo inválido de ${part.prop}`)
        assert(Array.isArray(key.v) && key.v.length === 3 && key.v.every((v) => typeof v === 'number' && Number.isFinite(v)), `vec3 inválido de ${part.prop}`)
        assert(key.ease === undefined || SUPPORTED.has(key.ease), `interpolación inválida de ${part.prop}`)
        if (key.ease === 'bezier') assert(Array.isArray(key.bz) && key.bz.length === 4 && key.bz.every(Number.isFinite), 'curva Bézier inválida')
        const kid = identifier(key.id, 'fk')
        assert(!usedIds.has(kid), `id de clave duplicado: ${kid}`); usedIds.add(kid)
        const normalized = normalizeKey(part.prop, { ...key, id: kid })
        return normalized
      }).sort((a, b) => a.t - b.t)
      for (let i = 1; i < keys.length; i++) assert(keys[i].t - keys[i - 1].t > 1e-5, `dos claves en el mismo instante para ${part.prop}`)
      return { id: pid, prop: part.prop, keys }
    })
    return { id, nodeId, name: String(track.name || ''), muted: !!track.muted, properties }
  })
}

/** Única función de muestreo: devuelve la pose por ID sin modificar el proyecto ni disparar eventos. */
export function sampleNodeTracks(tracks, T, availableIds = null) {
  if (!Number.isFinite(T) || T < 0) throw new Error('Tiempo del montaje inválido')
  const result = new Map(), missing = []
  for (const track of tracks || []) {
    if (track.muted) continue
    if (availableIds && !availableIds.has(track.nodeId)) { missing.push(track.nodeId); continue }
    const values = {}
    for (const part of track.properties) {
      const v = sampleTrack(part, T)
      if (v !== undefined) values[part.prop] = Array.isArray(v) ? [...v] : v
    }
    if (Object.keys(values).length) result.set(track.nodeId, values)
  }
  return { values: result, missing }
}

/** La elegibilidad del selector coincide con el escritor real de poses; no ocultar por selección UI. */
export function filmNodeAnimationAllowed(data, actorId = '') {
  if (!data?.id || data.id === actorId) return false
  return !['node','gameplayObject','rigidbody3d','characterbody3d','staticbody3d','collisionshape3d','area3d'].includes(data.type)
}

/** Overlay temporal sobre objetos Three.js, nunca sobre store.project.objects. */
export class FilmNodePose {
  constructor(editor, tracks, objects, { actorId = '' } = {}) {
    this.editor = editor
    this.tracks = tracks || []
    this.objects = objects || []
    this.byId = new Map(this.objects.map((o) => [o.id, o]))
    this.allowedIds = new Set(this.byId.keys())
    this.actorId = actorId
    this.saved = new Map()
    this.warnings = new Set()
  }
  getNode(id) { return this.editor?.nodes?.get(id) || null }
  target(id) {
    const data = this.byId.get(id)
    if (!data) return null
    // En S01 el rig del actor y Jolt son los únicos escritores de sus Transform.
    if (!filmNodeAnimationAllowed(data, this.actorId)) {
      this.warnings.add(id); return null
    }
    const node = this.getNode(id)
    if (!node) { this.warnings.add(id); return null }
    return { data, node }
  }
  capture(id, node, data) {
    let entry = this.saved.get(id)
    if (entry && entry.node === node) return entry
    if (entry) this.restoreOne(entry)
    const scale = ['node3d', 'group'].includes(data.type) ? node.scale : node.userData?.visual?.scale || node.scale
    entry = { node, scale, position: node.position.toArray(), rotation: node.rotation.toArray().slice(0, 3), scaleValue: scale.toArray(), order: node.rotation.order }
    this.saved.set(id, entry)
    return entry
  }
  restoreOne(entry) {
    entry.node.position.set(...entry.position)
    entry.node.rotation.order = entry.order
    entry.node.rotation.set(...entry.rotation)
    entry.scale.set(...entry.scaleValue)
    entry.node.updateMatrixWorld?.(true)
  }
  /** Cada seek recompone TODA la pose a partir de la base, nunca del fotograma previo. */
  at(T) {
    this.restore()
    const sampled = sampleNodeTracks(this.tracks, T, this.allowedIds)
    for (const missing of sampled.missing) this.warnings.add(missing)
    for (const [id, values] of sampled.values) {
      const target = this.target(id)
      if (!target) continue
      const { data, node } = target
      const entry = this.capture(id, node, data)
      if (values.position) node.position.set(...values.position)
      if (values.rotation) { node.rotation.order = 'YXZ'; node.rotation.set(...values.rotation.map((d) => d * Math.PI / 180)) }
      if (values.scale) entry.scale.set(...values.scale)
      node.updateMatrixWorld?.(true)
    }
    this.editor?.vp?.requestRender?.()
    return [...this.warnings]
  }
  restore() {
    for (const entry of this.saved.values()) this.restoreOne(entry)
    this.saved.clear()
  }
}
