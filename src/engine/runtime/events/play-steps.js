// Superficie bajo un punto y tags/layers de los nodos (consultas del mundo). Se mezcla en PlayMode.prototype.
// `surfaceAt` sirve a los Scripts de Nodo, el audio del mundo y otros consumidores físicos.
import * as THREE from 'three'
import { surfaceOf, surfaceFromPaintName, layersOf, tagOf, groupsOf, layerName, layerIndex, soundLayerOf, layerForSurface } from '../layers.js'

const DOWN = new THREE.Vector3(0, -1, 0), _o = new THREE.Vector3()
const FALLBACK_OBJ = 'stone'   // un objeto sin superficie en sus layers suena a piedra
const FALLBACK_TERRAIN = 'dirt'

export const stepMethods = {
  /** Superficie bajo el punto (x, y, z): '' si no hay suelo a menos de ~2 m. `info` (opcional) recibe { obj, y } del suelo. */
  surfaceAt(x, y, z, info = null) {
    const tl = this.project.tagLayers
    let best = { y: -Infinity, surface: '', obj: null }
    if (this.colliders?.length) {
      this.ray.set(_o.set(x, y + 0.5, z), DOWN); this.ray.far = 2.5
      const h = this.ray.intersectObjects(this.colliders, false)[0]
      if (h) { const o = h.object.userData.rtObj || null; best = { y: h.point.y, surface: o ? surfaceOf(tl, o) || FALLBACK_OBJ : FALLBACK_OBJ, obj: o, layer: o ? soundLayerOf(tl, o) : -1 } }
    }
    for (const t of this.ed.terrains || []) {
      const g = t.groundAt(x, z)
      // un objeto al ras del terreno (una tarima, una carretera) manda: el terreno solo gana si queda claramente por encima
      if (!Number.isFinite(g) || g > y + 0.6 || g < y - 2 || g <= best.y + 0.02) continue
      const l = t.layers?.[t.paintAt(x, z)]
      const surface = l?.surface || surfaceFromPaintName(l?.name) || FALLBACK_TERRAIN
      best = { y: g, surface, obj: null, layer: layerForSurface(tl, surface) }
    }
    if (best.layer == null || best.layer < 0) best.layer = layerForSurface(tl, best.surface)
    if (info) { info.obj = best.obj; info.y = best.y; info.layer = best.layer }
    return best.surface
  },

  // ---- API de scripts: Groups son temporales durante Play, Layers/Tags se conservan para compatibilidad ----
  _runtimeGroupsOf(o) { return this._runtimeGroups?.get(o.id) ?? groupsOf(o) },
  _changeRuntimeGroup(o, name, add) {
    const n = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
    if (!n) return false
    const current = this._runtimeGroupsOf(o)
    const found = current.some((g) => g.toLowerCase() === n.toLowerCase())
    if (found === add) return false
    const next = add ? [...current, n] : current.filter((g) => g.toLowerCase() !== n.toLowerCase())
    this._runtimeGroups ??= new Map()
    this._runtimeGroups.set(o.id, next)
    return true
  },
  _findByGroup(group) {
    const name = String(group ?? '').trim().toLowerCase()
    if (!name) return []
    return this.project.objects.filter((o) => this._runtimeGroupsOf(o).some((n) => n.toLowerCase() === name))
      .map((o) => this._nodeHandle(o.id)).filter(Boolean)
  },
  /** Invoca los métodos expuestos por Scripts de Nodo de los miembros actuales del grupo. */
  _callGroup(group, method, ...args) {
    if (typeof method !== 'string' || !method.trim()) throw new Error('Nombre de método de grupo inválido')
    const snapshot = this._findByGroup(group)
    const sceneGroups = this._runtimeGroups
    const session = this._referenceSession
    const sceneId = this.project.activeSceneId
    const scripts = this.ed.nodeLifecycle?.scripts
    if (!scripts) return
    for (const handle of snapshot) {
      // La escena, la sesión o la pertenencia pueden cambiar dentro del método anterior.
      if (this.on === false || this._runtimeGroups !== sceneGroups ||
          this._referenceSession !== session || this.project.activeSceneId !== sceneId) break
      if (!handle.is_valid() || !handle.is_in_group(group)) continue
      const obj = this._find(handle.id)
      if (!obj || !scripts.hasPublic(obj, method)) continue
      const where = `game.call_group("${String(group)}", "${method}") · ${handle.id}`
      try {
        const result = handle.call(method, ...args)
        if (result && typeof result.then === 'function') {
          Promise.resolve(result).catch((error) => this.game?.report?.(error, where))
        }
      } catch (error) { this.game?.report?.(error, where) }
    }
  },
  _tagLayerApi(o) {
    const tl = this.project.tagLayers
    return {
      get tag() { return tagOf(o) }, // API heredada de solo lectura
      add_to_group: (name) => this._changeRuntimeGroup(o, name, true),
      remove_from_group: (name) => this._changeRuntimeGroup(o, name, false),
      is_in_group: (name) => this._runtimeGroupsOf(o).some((g) => g.toLowerCase() === String(name ?? '').trim().toLowerCase()),
      get_groups: () => [...this._runtimeGroupsOf(o)],
      get layers() { return layersOf(o).map((i) => layerName(tl, i)) },
      inLayer: (name) => { const i = layerIndex(tl, name); return i >= 0 && layersOf(o).includes(i) },
      get surface() { return surfaceOf(tl, o) },
    }
  },
  /** game.findByTag("Respawn") → handles de todos los nodos con esa etiqueta. */
  _findByTag(tag) {
    const k = String(tag ?? '').trim().toLowerCase()
    return this.project.objects.filter((o) => tagOf(o).toLowerCase() === k).map((o) => this._nodeHandle(o.id)).filter(Boolean)
  },
  _findByLayer(name) {
    const i = layerIndex(this.project.tagLayers, name)
    return i < 0 ? [] : this.project.objects.filter((o) => layersOf(o).includes(i)).map((o) => this._nodeHandle(o.id)).filter(Boolean)
  },
}
