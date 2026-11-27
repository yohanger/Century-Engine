import { getDef } from '../nodes/registry.js'
import { validateNodeTree, nodeEffectiveActive } from '../nodes/hierarchy.js'
import { nodeScriptIds } from './node-scripts.js'

// Ciclo de vida de los nodos que ya posee SceneGraph. No guarda otro árbol; delega los callbacks del script cuando está activo.
// Solo se activa mediante start(); en edición permanece inactivo.
export class NodeLifecycle {
  constructor(scene) {
    this.scene = scene
    this.active = false
    this.entered = new Map() // ID → {obj, parentId, type}; solo seguimiento del ciclo de vida
    this.ready = new Set() // _ready solo una vez por estancia de la instancia en esta escena
    this.processEntries = new Map() // solo nodos con trabajo periódico: nativo o script
    this.physicsEntries = new Map()
    this._dispatchVersion = 0 // invalida iteradores cuando sync cambia la escena durante un callback
    this.scripts = null // solo lo conecta el runtime de juego
    this._removing = new Map() // desmontajes síncronos entre beginRemoval/endRemoval, no otro árbol
  }

  _call(obj, method, dt, type = obj.type) {
    const fn = getDef(type)?.[method]
    try {
      if (typeof fn === 'function') {
        if (dt === undefined) fn(obj, this.scene)
        else fn(obj, dt, this.scene)
      }
    } catch (error) {
      // Un fallo de un nodo no impide desmontar los demás ni bloquea el loop.
      console.error(`Ciclo de vida ${method} en ${obj.id}`, error)
    }
    if (method === 'onEnterTree') this.scripts?.enter(obj, true)
    else if (method !== 'onExitTree') this.scripts?.call(obj, method, dt)
  }

  start() {
    if (this.active) return
    this.active = true
    this.sync()
  }

  _ordered(entries) {
    const byId = new Map(entries.map((obj) => [obj.id, obj]))
    const visited = new Set(), out = []
    const visit = (obj) => {
      if (visited.has(obj.id)) return
      if (obj.parentId && byId.has(obj.parentId)) visit(byId.get(obj.parentId))
      visited.add(obj.id)
      out.push(obj)
    }
    for (const obj of entries) visit(obj)
    return out
  }

  _beginExit(item) {
    // Los scripts siguen activos durante _exit_tree y tree_exiting.
    this._call(item.obj, 'onExitTree', undefined, item.type)
    this.scripts?.beginExit?.(item.obj)
    this.scripts?.emitLifecycle?.(item.obj, 'tree_exiting', true)
  }

  _completeExit(item) {
    this.entered.delete(item.obj.id)
    // La emisión final sucede una vez finalizada la pertenencia lógica al árbol.
    this.scripts?.emitLifecycle?.(item.obj, 'tree_exited', true)
    this.scripts?.finishExit?.(item.obj)
  }

  /** En SceneGraph.removeObject la salida ocurre alrededor del desmontaje real 3D. */
  beginRemoval(id) {
    if (!this.active || !this.entered.has(id)) return
    const descendants = this._ordered([...this.entered.values()].map(v => ({ ...v.obj, parentId: v.parentId })))
      .filter(obj => {
        for (let current = obj.id; current;) {
          if (current === id) return true
          current = this.entered.get(current)?.parentId || null
        }
        return false
      }).reverse()
    const items = descendants.map(obj => this.entered.get(obj.id)).filter(Boolean)
    this._removing.set(id, items)
    for (const item of items) this._beginExit(item)
  }

  endRemoval(id) {
    const items = this._removing.get(id)
    if (!items) return
    this._removing.delete(id)
    for (const item of items) {
      this._completeExit(item)
      this.ready.delete(item.obj.id)
    }
    this._dispatchVersion++
  }

  sync() {
    if (!this.active) return
    const scene = this.scene
    const objects = scene.host.project?.objects || []
    validateNodeTree(objects)
    // Solo entran al ciclo los nodos montados y efectivamente activos.
    const enabled = this.isEnabled || ((obj) => nodeEffectiveActive(objects, obj))
    const current = this._ordered(objects.filter((obj) => scene.nodes.has(obj.id) && enabled(obj)))
    const next = new Map(current.map((obj) => [obj.id, { obj, parentId: obj.parentId || null, type: obj.type, scriptId: JSON.stringify(nodeScriptIds(obj)) }]))
    const changed = new Set()
    for (const [id, prev] of this.entered) {
      if (!next.has(id) || next.get(id).obj !== prev.obj || next.get(id).parentId !== prev.parentId || next.get(id).type !== prev.type || next.get(id).scriptId !== prev.scriptId) changed.add(id)
    }
    // Mover un padre implica salir y volver a entrar con todo su subárbol.
    for (const obj of current) {
      if (obj.parentId && changed.has(obj.parentId)) changed.add(obj.id)
    }
    const previous = this._ordered([...this.entered.values()].map((v) => ({ ...v.obj, parentId: v.parentId })))
    for (const obj of previous.reverse()) if (changed.has(obj.id) && this.entered.has(obj.id)) {
      const prior = this.entered.get(obj.id)
      this._beginExit(prior)
      this._completeExit(prior)
      if (!next.has(obj.id) || next.get(obj.id).obj !== prior.obj || next.get(obj.id).type !== prior.type || next.get(obj.id).scriptId !== prior.scriptId) this.ready.delete(obj.id)
    }
    const newly = new Set()
    // Evaluar primero todos los scripts, sin adelantar _enter_tree. Así una conexión
    // persistente puede recibir la primera emisión tree_entered de cualquier emisor.
    for (const obj of current) {
      if (!this.entered.has(obj.id)) {
        this.entered.set(obj.id, next.get(obj.id))
        this.scripts?.prepare?.(obj)
        newly.add(obj.id)
      } else this.entered.set(obj.id, next.get(obj.id))
    }
    this.scripts?.syncSceneConnections?.({ onlySignal: 'tree_entered' })
    for (const obj of current) if (newly.has(obj.id)) {
      this._call(obj, 'onEnterTree')
      this.scripts?.emitLifecycle?.(obj, 'tree_entered')
    }
    // Después de _enter_tree se publicaron los métodos tardíos; conectar ahora
    // el resto antes de _ready mantiene la semántica del Gate G002.
    this.scripts?.syncSceneConnections?.()
    // _ready de hijos antes que padres; la señal se emite justo después del callback.
    for (const obj of [...current].reverse()) if (newly.has(obj.id) && !this.ready.has(obj.id)) {
      this._call(obj, 'onReady')
      this.ready.add(obj.id)
      this.scripts?.emitLifecycleReady?.(obj)
    }
    // El registro se recalcula al sincronizar la escena, nunca por fotograma.
    // Registro de procesos actualizado solo al cambiar el árbol o su activación.
    // Respeta el orden padre→hijo y los callbacks nativos, incluido VFX3D.
    this.processEntries.clear()
    this.physicsEntries.clear()
    for (const obj of current) {
      const def = getDef(obj.type)
      if (typeof def?.onProcess === 'function' || this.scripts?.hasCallback(obj.id, 'onProcess')) this.processEntries.set(obj.id, obj)
      if (typeof def?.onPhysicsProcess === 'function' || this.scripts?.hasCallback(obj.id, 'onPhysicsProcess')) this.physicsEntries.set(obj.id, obj)
    }
    this._dispatchVersion++
    this.scripts?.syncSceneConnections?.() // Reintento sin repetir ninguna señal ready.
  }

  process(dt) {
    if (!this.active || !Number.isFinite(dt) || dt < 0) return
    const version = this._dispatchVersion
    for (const [id, obj] of this.processEntries) {
      if (!this.active || version !== this._dispatchVersion) break
      if (this.entered.get(id)?.obj === obj) this._call(obj, 'onProcess', dt)
    }
  }

  physicsProcess(dt) {
    if (!this.active || !Number.isFinite(dt) || dt < 0) return
    const version = this._dispatchVersion
    for (const [id, obj] of this.physicsEntries) {
      if (!this.active || version !== this._dispatchVersion) break
      if (this.entered.get(id)?.obj === obj) this._call(obj, 'onPhysicsProcess', dt)
    }
  }

  stop() {
    if (!this.active) return
    const previous = this._ordered([...this.entered.values()].map((v) => ({ ...v.obj, parentId: v.parentId })))
    for (const obj of previous.reverse()) {
      const item = this.entered.get(obj.id)
      if (item) { this._beginExit(item); this._completeExit(item) }
    }
    this._removing.clear()
    this.entered.clear()
    this.ready.clear()
    this.processEntries.clear()
    this.physicsEntries.clear()
    this.scripts?.clear()
    this._dispatchVersion++
    this.active = false
  }
}
