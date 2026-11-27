// Nodos y eventos por nombre, teletransporte y cambio de escena984 1136 host Host del intérprete: API que ven los scripts y el jugador
import * as THREE from 'three'
import { NEVER } from './play-shared.js'
import { loadNavCache } from '../nav-cache.js'
import { graphicRecord } from '../database/models.js'
import { levelName } from '../world/params.js'
import { DEG } from '../util.js'
import { normalizeSceneTransitions, sceneFadeSeconds, sceneFadeState } from './scene-transitions.js'
import { resolveNodePath } from '../scene/node-scripts.js'
import { nodeActive } from '../nodes/hierarchy.js'
import { materializePrefab } from '../../../core/project.js'
import { uid } from '../util.js'
import { expandSceneInstances, makeSceneInstance, readSceneSources } from '../scene/instances.js'

// Envolver delegados existentes sin duplicar la implementación de Groups o animaciones.
function guardedDescriptors(api, requireActive) {
  const out = {}
  for (const [key, d] of Object.entries(Object.getOwnPropertyDescriptors(api))) {
    if (typeof d.value === 'function') out[key] = { ...d, value: (...args) => { requireActive(); return d.value(...args) } }
    else if (d.get || d.set) out[key] = {
      ...d,
      get: d.get ? () => { requireActive(); return d.get.call(api) } : undefined,
      set: d.set ? (v) => { requireActive(); d.set.call(api, v) } : undefined,
    }
    else out[key] = d
  }
  return out
}

export const nodesMethods = {
  /** Instancias de Prefab que existen solo durante esta sesión de juego.
   * La escena sigue siendo el árbol propietario; este mapa guarda únicamente la pertenencia de cada instancia.
   */
  _prefabInstantiate(ref, options = {}, afterPhysics = null) {
    if (!this.on) throw new Error('Instanciar Prefab requiere Play activo')
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Opciones del Prefab inválidas')
    const id = typeof ref === 'string' ? ref : ref?.id
    const matches = (this.project.prefabs || []).filter(p => p.id === id || p.name === id)
    if (matches.length !== 1) throw new Error(`Prefab inexistente o ambiguo: ${String(id)}`)
    const pf = matches[0]
    // Estos recursos requieren propietarios adicionales que no se registran en este Gate.
    const unsupported = pf.objects?.find(o => ['event', 'terrain', 'navigation', 'liquid', 'sceneInstance'].includes(o.type))
    if (unsupported) throw new Error(`Prefab no compatible con instanciación dinámica: ${unsupported.type}`)
    const parentRef = options.parent ?? null
    const parentId = parentRef && (typeof parentRef === 'string' ? parentRef : parentRef.id)
    if (parentId && !this._nodeHandle(parentId)?.is_valid()) throw new Error('Padre de Prefab inexistente o inactivo')
    if (parentId && [...(this._runtimePrefabInstances?.values() || [])].some(instance => instance.ids.has(parentId)))
      throw new Error('No se permite anidar un Prefab dinámico en otra instancia transitoria')
    const position = options.position
    if (position != null && (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)))
      throw new TypeError('Prefab: posición mundial debe ser [x,y,z] finita')
    const { objects, connections } = materializePrefab(pf, parentId)
    const ids = new Set(objects.map(o => o.id))
    if (objects.some(o => this.project.objects.some(current => current.id === o.id))) throw new Error('Prefab: ID de nodo duplicado')
    if (objects.some(o => ['characterbody3d','staticbody3d','rigidbody3d','area3d'].includes(o.type)) && !this.phys?.nodeBodyRuntime)
      throw new Error('Prefab físico requiere Jolt activo')
    const root = objects[0]
    root.prefabId = pf.id
    root.prefabRev = pf.rev
    if (position) {
      const pos = new THREE.Vector3(...position)
      if (parentId) {
        const parentNode = this.ed.nodes.get(parentId)
        parentNode.updateWorldMatrix(true, false)
        pos.applyMatrix4(parentNode.matrixWorld.clone().invert())
      }
      root.position = pos.toArray()
    }
    const scene = this.project.activeSceneId
    const owner = { scene, rootId: root.id, ids, objects, connections: new Set(connections.map(c => c.id)) }
    this._runtimePrefabInstances ??= new Map()
    // Registrar primero la pertenencia para que el rollback retire cualquier alta parcial.
    this._runtimePrefabInstances.set(root.id, owner)
    const project = this.project
    project.objects.push(...objects)
    project.signalConnections ||= []
    project.signalConnections.push(...connections)
    const scripts = afterPhysics && this.ed.nodeLifecycle?.scripts
    if (scripts) { scripts._spawnInitIds = ids; scripts._spawnInitFailure = null }
    try {
      const before = this.ed._syncingAll
      this.ed._syncingAll = true
      try { for (const obj of objects) this.ed.syncObject(obj.id) }
      finally { this.ed._syncingAll = before }
      this.phys?.nodeBodyRuntime?.attach(ids)
      // En Spawn Player el vínculo se publica antes de _enter_tree y _ready.
      // No se expone este callback en game.prefabs.instantiate().
      if (afterPhysics) afterPhysics(objects, root)
      this.ed.nodeLifecycle?.sync()
      if (scripts?._spawnInitFailure) throw scripts._spawnInitFailure
      return this._nodeHandle(root.id)
    } catch (error) {
      this._prefabDestroy(root.id, true)
      throw error
    } finally {
      if (scripts) { scripts._spawnInitIds = null; scripts._spawnInitFailure = null }
    }
  },

  /** Único desmontaje de subárboles transitorios: reutilizado por Prefabs y escenas. */
  _destroyTransientInstance(ref, registry, force = false) {
    const rootId = typeof ref === 'string' ? ref : ref?.id
    const owner = registry?.get(rootId)
    if (!owner) return false
    if (!force && (!this.on || owner.scene !== this.project.activeSceneId)) return false
    const objects = this.project.objects || []
    const existing = objects.filter(o => owner.ids.has(o.id))
    const removingPlayer = !!this._nativePlayerId && owner.ids.has(this._nativePlayerId)
    this.ed.nodeLifecycle?.beginRemoval(rootId)
    this.ed.nodeLifecycle?.endRemoval(rootId)
    if (removingPlayer) {
      this._vmTeardown({ restoreWorld: !!this.on && !force })
      this._nativePlayerId = null
      this.hasPlayer = false
      if (this.state) this.state.player = false
    }
    this.phys?.nodeBodyRuntime?.detach(owner.ids)
    const previous = this.ed._syncingAll
    this.ed._syncingAll = true
    try { for (const obj of [...existing].reverse()) this.ed.removeObject(obj.id) }
    finally { this.ed._syncingAll = previous }
    this.project.objects = objects.filter(o => !owner.ids.has(o.id))
    this.project.signalConnections = (this.project.signalConnections || []).filter(c =>
      !owner.connections.has(c.id) && !owner.ids.has(c.emitterId) && !owner.ids.has(c.receiverId))
    registry.delete(rootId)
    owner.releaseModels?.()
    this.ed.nodeLifecycle?.sync()
    return true
  },

  /** Destruye una instancia creada por game.prefabs, nunca un nodo autoral. */
  _prefabDestroy(ref, force = false) {
    return this._destroyTransientInstance(ref, this._runtimePrefabInstances, force)
  },

  /** Instancia dinámicamente una escena vinculada al recurso fuente sin alterar su autoría. */
  async _sceneInstantiate(ref, options = {}) {
    if (!this.on || !this.rt.readStreamScene) throw new Error('Instanciar escena requiere Play activo')
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Opciones de escena inválidas')
    const id = typeof ref === 'string' ? ref : ref?.id
    const matches = (this.project.scenes || []).filter(s => s.id === id || s.name === id)
    if (matches.length !== 1) throw new Error(`Escena inexistente o ambigua: ${String(id)}`)
    const source = matches[0]
    const origin = this.project.activeSceneId
    if (source.id === origin) throw new Error('La escena actual no puede instanciarse a sí misma')
    const parentRef = options.parent ?? null
    const parentId = parentRef && (typeof parentRef === 'string' ? parentRef : parentRef.id)
    if (parentId && !this._nodeHandle(parentId)?.is_valid()) throw new Error('Padre de escena inexistente o inactivo')
    if (parentId && [...(this._runtimePrefabInstances?.values() || []), ...(this._runtimeSceneInstances?.values() || [])]
      .some(instance => instance.ids.has(parentId))) throw new Error('No se permite anidar una instancia transitoria bajo otra')
    const position = options.position
    if (position != null && (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)))
      throw new TypeError('Posición de escena inválida; utiliza [x,y,z]')
    const root = makeSceneInstance(source, { id: uid(), parentId })
    const sources = await readSceneSources([root], sceneId => this.rt.readStreamScene(sceneId),
      this._runtimeSceneSourceCache || (this._runtimeSceneSourceCache = new Map()))
    if (!this.on || this.project.activeSceneId !== origin ||
      !this.project.scenes.some(s => s.id === source.id)) throw new Error('La escena activa cambió durante la carga')
    if (parentId && !this._nodeHandle(parentId)?.is_valid()) throw new Error('El padre dejó de estar activo')
    const expanded = expandSceneInstances({ objects: [root], signalConnections: [] },
      this.project.activeSceneId, sources)
    // Esta raíz existe únicamente durante Play: nunca se guarda en la escena autoral.
    root.sceneRuntimeOnly = true
    const objects = expanded.objects
    const connections = expanded.signalConnections
    const unsupported = objects.find(o => ['event', 'navigation', 'liquid', 'terrain'].includes(o.type))
    if (unsupported) throw new Error(`Instancia dinámica de escena no admite ${unsupported.type}; utiliza una instancia en el Editor`)
    if (objects.some(o => this.project.objects.some(current => current.id === o.id))) throw new Error('Instancia: ID duplicado')
    if (objects.some(o => ['characterbody3d', 'staticbody3d', 'rigidbody3d', 'area3d'].includes(o.type)) && !this.phys?.nodeBodyRuntime)
      throw new Error('La escena contiene cuerpos físicos y requiere Jolt activo')
    if (position) {
      const pos = new THREE.Vector3(...position)
      if (parentId) {
        const parent = this.ed.nodes.get(parentId)
        parent.updateWorldMatrix(true, false)
        if (Math.abs(parent.matrixWorld.determinant()) < 1e-10) throw new Error('Transform del padre no invertible')
        pos.applyMatrix4(parent.matrixWorld.clone().invert())
      }
      root.position = pos.toArray()
    }
    const ids = new Set(objects.map(o => o.id))
    const models = [...new Set(objects.filter(o => o.type === 'model').map(o => o.modelId).filter(Boolean))]
    const releaseModels = models.length ? await this.rt.retainStreamModels?.(models) : null
    if (!this.on || this.project.activeSceneId !== origin) {
      releaseModels?.()
      throw new Error('La escena activa cambió durante la carga de modelos')
    }
    const owner = { scene: this.project.activeSceneId, rootId: root.id, ids, objects,
      releaseModels, connections: new Set(connections.map(c => c.id)) }
    this._runtimeSceneInstances ??= new Map()
    this._runtimeSceneInstances.set(root.id, owner)
    this.project.objects.push(...objects)
    this.project.signalConnections ||= []
    this.project.signalConnections.push(...connections)
    try {
      const before = this.ed._syncingAll
      this.ed._syncingAll = true
      try { for (const obj of objects) this.ed.syncObject(obj.id) }
      finally { this.ed._syncingAll = before }
      this.phys?.nodeBodyRuntime?.attach(ids)
      this.ed.nodeLifecycle?.sync()
      return this._nodeHandle(root.id)
    } catch (error) {
      this._sceneDestroy(root.id, true)
      throw error
    }
  },

  _sceneDestroy(ref, force = false) {
    return this._destroyTransientInstance(ref, this._runtimeSceneInstances, force)
  },

  _sceneClearRuntime() {
    for (const rootId of [...(this._runtimeSceneInstances?.keys() || [])]) this._sceneDestroy(rootId, true)
    this._runtimeSceneInstances?.clear()
    this._runtimeSceneSourceCache?.clear()
  },

  /** Limpieza antes de guardar una escena, cambiarla o devolver el Editor tras STOP. */
  _prefabClearRuntime() {
    for (const rootId of [...(this._runtimePrefabInstances?.keys() || [])]) this._prefabDestroy(rootId, true)
    this._runtimePrefabInstances?.clear()
  },

  _find(name, type = null) {
    const objects = this.project.objects || []
    const ref = name && typeof name === 'object' ? (typeof name.is_valid === 'function' && !name.is_valid() ? null : (name.id ?? name.name)) : name
    if (typeof ref === 'string' && ref.startsWith('/')) {
      const match = resolveNodePath(objects, null, ref)
      return match && (!type || match.type === type) ? match : null
    }
    const q = String(ref ?? '').trim().toLowerCase()
    const list = objects.filter((o) => !type || o.type === type)
    return list.find((o) => o.id === ref) || list.find((o) => o.name.toLowerCase() === q) || null
  },

  _nodeHandle(name) {
    const o = this._find(name)
    if (!o || !this.ed.nodes.has(o.id)) return undefined
    const self = this
    const session = this._referenceSession
    const live = () => {
      if (self.on === false || self._referenceSession !== session) return false
      const mounted = self.ed.nodes.get(o.id)
      if (!mounted) return false
      // En SceneGraph real el registro propietario está marcado: acceso O(1), sin escaneo por _process.
      return Object.hasOwn(mounted, '_lfNodeOwner') ? mounted._lfNodeOwner === o : self.project.objects.includes(o)
    }
    const active = () => {
      if (!live()) throw new Error(`Referencia de nodo inválida: ${o.id}`)
      return self.ed.nodes.get(o.id)
    }
    const handle = {
      get id() { return o.id },
      get name() { return o.name },
      is_valid: live,
      call(name, ...args) {
        active()
        const runtime = self.ed.nodeLifecycle?.scripts
        if (!runtime) throw new Error(`Script de nodo no disponible: ${o.id}`)
        return runtime.callPublic(o, name, args)
      },
      connect(name, receiver, method) {
        active()
        const runtime = self.ed.nodeLifecycle?.scripts
        if (!runtime) throw new Error(`Script de nodo no disponible: ${o.id}`)
        return runtime.connectSignal(o, name, receiver, method)
      },
      disconnect(name, receiver, method) {
        active()
        const runtime = self.ed.nodeLifecycle?.scripts
        if (!runtime) throw new Error(`Script de nodo no disponible: ${o.id}`)
        return runtime.disconnectSignal(o, name, receiver, method)
      },
      get object3D() { return active() },
      get type() { active(); return o.type },
      get rotation() { const n = active(); return [n.rotation.x / DEG, n.rotation.y / DEG, n.rotation.z / DEG] },
      set rotation(v) { const n = active(); n.rotation.set(v[0] * DEG, v[1] * DEG, v[2] * DEG); n.updateMatrixWorld(true); self.phys?.syncNode(n) },
      get scale() { const n = active(); return n.userData.visual ? n.userData.visual.scale.toArray() : n.scale.toArray() },
      get worldPosition() { return active().getWorldPosition(new THREE.Vector3()).toArray() },
      // Frente mundial (-Z local), incluida la rotación heredada de los padres.
      get worldForward() { const n = active(); n.updateWorldMatrix(true, false); return new THREE.Vector3(0, 0, -1).transformDirection(n.matrixWorld).toArray() },
      get distance() { return active().getWorldPosition(new THREE.Vector3()).distanceTo(self.pos) },
      get active() { active(); return self._nodeEnabled(o, false) },
      set active(v) { active(); self._nodeActive(o.id, !!v) },
      get visible() { const n = active(); return n.userData._lfRuntimeVisible ?? (o.visible !== false) },
      set visible(v) { active(); self._nodeVisible(o.id, !!v) },
      get position() { return active().position.toArray() },
      set position(v) { const n = active(); n.position.set(v[0], v[1], v[2]); n.updateMatrixWorld(true); self.phys?.syncNode(n) },
      move(pos, seconds = 1, rel = false) { active(); return self._nodeMove(o.id, { rel, pos, seconds }, o) },
      get parent() { active(); return o.parentId ? self._nodeHandle(o.parentId) || null : null },
      get children() { active(); return self.project.objects.filter((c) => c.parentId === o.id).map((c) => self._nodeHandle(c.id)).filter(Boolean) },
      get_node(path) { active(); const found = resolveNodePath(self.project.objects, o, path); return found ? self._nodeHandle(found.id) || null : null },
      get dontDestroyOnLoad() { active(); return self._persistMarked(o) },
      set dontDestroyOnLoad(v) { active(); self._persistSet(o.id, v) },
      keepOnLoad(v = true) { active(); return self._persistSet(o.id, v) },
      get held() { active(); return !!self.vm?.held.has(o.id) },
      get heldSlot() { active(); return self.vm?.held.get(o.id)?.slot ?? null },
      get light() { active(); return self._lightHandle(o) },
    }
    if (o.type === 'characterbody3d') {
      // El handle consulta el cuerpo de la escena activa: no conserva otro estado ni la física anterior.
      const characterPhysics = () => {
        const node = active()
        const spatial = self.phys?.nodeSpatial
        const character = spatial?.characters.get(o.id)
        if (!spatial || spatial.disposed || character?.obj !== o || character.node !== node || !self._nodeEnabled(o))
          throw new Error(`CharacterBody3D sin cuerpo físico activo: ${o.id}`)
        return spatial
      }
      const state = () => characterPhysics().characterState(o.id)
      Object.defineProperties(handle, {
        velocity: { enumerable: true, get: () => state().velocity, set: value => characterPhysics().setVelocity(o.id, value) },
        ground: { enumerable: true, get: () => state().ground },
        onFloor: { enumerable: true, get: () => state().onFloor },
        onWall: { enumerable: true, get: () => state().onWall },
        onCeiling: { enumerable: true, get: () => state().onCeiling },
      })
    }
    Object.defineProperties(handle, guardedDescriptors(self._tagLayerApi(o), active))
    return Object.defineProperties(handle, guardedDescriptors(self._animMethodsFor(o.id), active))
  },

  _eventHandle(id) {
    const e = this.events.find((x) => x.id === id)
    const self = this, game = this.game
    return {
      id, name: e?.obj.name ?? id, node: e?.node,
      erase: () => self._erase(id),
      /** Ejecuta la página activa (o la elegida con { page: n }, desde 1) en segundo plano. Promesa: true si terminó, false si se detuvo. */
      run: (opts = {}) => self._eventRun(id, opts),
      /** Detiene lo que esté ejecutando este evento; devuelve cuántas ejecuciones paró. */
      stop: () => self._eventStop(id),
      get isRunning() { return self._eventRunning(id) },
      /** Número (desde 1) de la página activa; 0 si ninguna cumple las condiciones. */
      get page() { return e ? e.pageIdx + 1 : 0 },
      get pages() { return e ? e.props.pages.length : 0 },
      selfSwitch: (ch) => game.getSelf(id, ch), setSelfSwitch: (ch, v = true) => game.setSelf(id, ch, v),
      get position() { return e ? e.node.position.toArray() : [0, 0, 0] },
      /** ¿Está este evento en la mano (view model)? */
      get held() { return !!e && !!self.vm?.held.has(e.obj.id) },
    }
  },

  _erase(id) {
    const e = this.events.find((x) => x.id === id)
    if (!e) return
    e.erased = true
    this._lastRev = -1
  },

  _syncParty() { if (this.game) this.state.party = this.game.party.snapshot() },

  _eventInst(id) { return id ? this.events.find((e) => e.id === id) : null },
  _eventName(id) { return this._eventInst(id)?.obj.name },
  /** Nombre del personaje (Base de datos) que dibuja el evento en su página activa; undefined si no tiene. */
  _eventActorName(id) {
    const inst = this._eventInst(id)
    const gr = inst?.props.pages[inst.pageIdx]?.graphic
    if (gr?.kind !== 'actor') return undefined
    const P = this.game?.party, db = P?.db || this.project.database
    const r = graphicRecord(gr, db)
    return r ? P?.actors[r.id]?.name || r.name : undefined
  },

  /** Contexto de los códigos de escape (\N \P \G \I \T) con el estado real del grupo. */
  _textCtx(eventId) {
    const P = this.game?.party, db = P?.db || this.project.database
    const KINDS = { item: 'items', weapon: 'weapons', armor: 'armors', skill: 'skills', state: 'states', class: 'classes', enemy: 'enemies', actor: 'actors', quest: 'quests', lore: 'lore', common: 'commonEvents' }
    const find = (arg) => { const m = /^(\w+):(.+)$/.exec(String(arg).trim()); return m && KINDS[m[1]] ? [m[1], P?.rec(KINDS[m[1]], m[2].trim())] : [null, null] }
    return {
      // \N[3] = actor 3 · \N[Nombre] = ese actor · \N[0] / \N = el personaje (Base de datos) del evento que está hablando
      actor: (n) => {
        const pa = () => { const id = db.player?.actorId; return id ? P?.actors[id]?.name || (db.actors || []).find((a) => a.id === id)?.name : null }
        if (typeof n === 'string' && /^(player|jugador)$/i.test(n)) return pa() ?? 'Jugador'
        if (typeof n === 'string') { const r = (db.actors || []).find((a) => (a.name || '').toLowerCase() === n.toLowerCase()); return r ? P?.actors[r.id]?.name || r.name : n }
        if (n === 0) { const id = eventId ?? this.main?.ctx?.eventId; return this._eventActorName(id) ?? (id == null ? pa() : null) ?? this._eventName(id) ?? 'Actor 0' }
        return P?.actors[n]?.name || db.actors?.[n - 1]?.name || `Actor ${n}`
      },
      party: (n) => { const id = P?.members[n - 1]; return id ? P.actors[id].name : `Miembro ${n}` },
      level: () => levelName(this.project.environment, this.project.scenes.find((x) => x.id === this.project.activeSceneId)?.name),
      currency: () => db.system?.currency || '',
      icon: (arg) => { const [, r] = find(arg); return r?.icon || '◆' },
      name: (arg) => { const a = String(arg).trim(); if (a.startsWith('term:')) return P?.term(a.slice(5)) ?? a; const [k, r] = find(a); return k === 'actor' && P?.actors[r?.id] ? P.actors[r.id].name : r?.name || a },
    }
  },

  /** Propiedad propia o estado efectivo (antecesores); sólo el render consulta visible. */
  _nodeEnabled(obj, effective = true) {
    if (!obj) return false
    for (let o = obj; o; o = effective && o.parentId ? this._find(o.parentId) : null) {
      if (effective && o.parentId && !this._find(o.parentId)) return false
      const node = this.ed.nodes.get(o.id)
      if (!node || !(node.userData._lfRuntimeActive ?? nodeActive(o))) return false
    }
    return true
  },
  _nodeVisualState(obj, node) {
    const shown = (node.userData._lfRuntimeVisible ?? (obj.visible !== false)) && this._nodeEnabled(obj)
    // La representación editorial de estos nodos no debe aparecer en Play, aunque estén activos.
    const editorialOnly = (this.hidden || []).includes(node)
    node.visible = !!shown && !editorialOnly
    if (obj.type === 'sprite2d') {
      this.sprite2dVis.set(obj.id, !!shown)
      this.state.spriteRev = (this.state.spriteRev || 0) + 1
    }
  },
  _syncNodeActivationPhysics() {
    if (!this.phys) return
    const objs = this.project.objects || []
    const depth = (o) => { let n = o, d = 0; while (n?.parentId && d < objs.length) { n = this._find(n.parentId); d++ } return d }
    for (const obj of [...objs].sort((a, b) => depth(a) - depth(b))) {
      const node = this.ed.nodes.get(obj.id)
      if (node) this.phys.setNodeEnabled(node, this._nodeEnabled(obj))
      if (obj.type === 'terrain') this.phys.setTerrainActive?.(obj.id, this._nodeEnabled(obj))
    }
  },

  _nodeVisible(id, v) {
    const obj = this._find(id), node = obj && this.ed.nodes.get(obj.id)
    if (!node) throw new Error(`No existe el nodo «${id}»`)
    node.userData._lfRuntimeVisible = !!v // sólo dura esta sesión Play; no escribe el proyecto
    this._nodeVisualState(obj, node)
    if (obj.type === 'terrain') this.ed.applyView()
    this.vp.requestRender()
  },
  _nodeActive(id, on) {
    const obj = this._find(id), node = obj && this.ed.nodes.get(obj.id)
    if (!node) throw new Error(`No existe el nodo «${id}»`)
    node.userData._lfRuntimeActive = !!on
    // Sólo recorrer el subárbol afectado cuando cambia active; nunca durante cada frame.
    const descendants = this.project.objects.filter(o => {
      for (let p = o; p; p = p.parentId ? this._find(p.parentId) : null) if (p.id === obj.id) return true
      return false
    })
    // Los cambios del padre deben preceder a sus hijos; el hijo decide su estado propio final.
    const depth = (o) => { let n = o, level = 0; while (n?.parentId && level < this.project.objects.length) { n = this._find(n.parentId); level++ } return level }
    descendants.sort((a, b) => depth(a) - depth(b))
    for (const descendant of descendants) {
      if (!this._nodeEnabled(descendant)) {
        this._eventStop?.(descendant.id)
        this.events?.find(e => e.id === descendant.id)?.par?.cancel?.()
      }
      const target = this.ed.nodes.get(descendant.id)
      if (!target) continue
      this._nodeVisualState(descendant, target)
      this.phys?.setNodeEnabled(target, this._nodeEnabled(descendant))
      if (descendant.type === 'terrain') this.phys?.setTerrainActive?.(descendant.id, this._nodeEnabled(descendant))
      this.audio?.setNodeEnabled?.(descendant.id, this._nodeEnabled(descendant))
    }
    this._tlChannelSweep?.()
    this.ed.nodeLifecycle?.sync()
    this._lastRev = -1
    // La física conserva sus cuerpos y recursos para permitir reactivación.
    if (descendants.some(d => d.type === 'terrain')) this.ed.applyView()
    this.vp.requestRender()
  },

  _nodeMove(id, { rel, pos, seconds }, expectedObj = null) {
    const o = this._find(id)
    const node = o && this.ed.nodes.get(o.id)
    if (!node || (expectedObj && expectedObj !== o)) throw new Error(`Referencia de nodo inválida: ${id}`)
    const from = node.position.clone()
    const to = rel ? from.clone().add(new THREE.Vector3(...pos)) : new THREE.Vector3(...pos)
    for (const o of this.tweens.filter((m) => m.node === node)) o.r()
    this.tweens = this.tweens.filter((m) => m.node !== node)
    if (!(seconds > 0)) { node.position.copy(to); node.updateMatrixWorld(true); this.phys?.syncNode(node); return Promise.resolve() }
    this.phys?.makeKinematic(node)
    return new Promise((r) => this.tweens.push({ node, from, to, t: 0, dur: seconds, r, valid: () => this.on && this.ed.nodes.get(o.id) === node && (Object.hasOwn(node, '_lfNodeOwner') ? node._lfNodeOwner === o : this.project.objects.includes(o)) }))
  },

  _teleport({ mode, node, pos, yaw }) {
    if (!this._nativePlayerId) throw new Error('Teletransporte: no existe un jugador nativo en la escena')
    if (mode === 'pos') {
      this._nativePositionSet(pos)
      if (yaw !== undefined) this.yaw = yaw * DEG
    } else {
      const o = this._find(node)
      if (!o) throw new Error(`Destino «${node || '(sin nodo)'}» no encontrado`)
      const m = this.ed.worldMatrix(o.id)
      const p = new THREE.Vector3().setFromMatrixPosition(m)
      this._nativePositionSet(p)
      if (yaw !== undefined) this.yaw = yaw * DEG
      else if (o.type === 'spawn') { const f = new THREE.Vector3(0, 0, -1).transformDirection(m); this.yaw = Math.atan2(-f.x, -f.z) }
    }
    this.vy = 0
    this.pitch = 0
  },

  async _gotoScene({ scene, tag, pos, yaw, fadeOut, fadeIn, color }) {
    const p = this.project
    const q = String(scene ?? '').toLowerCase()
    const target = p.scenes.find((s) => s.id === scene || s.name.toLowerCase() === q)
    if (!target) throw new Error(`Escena «${scene}» no encontrada`)
    const source = p.scenes.find((s) => s.id === p.activeSceneId)
    const outgoing = normalizeSceneTransitions(source?.transitions)
    const incoming = normalizeSceneTransitions(target.transitions)
    const outSeconds = sceneFadeSeconds(outgoing, 'out', fadeOut)
    const inSeconds = sceneFadeSeconds(incoming, 'in', fadeIn)
    // Un solo color durante la transferencia: no cambiarlo mientras la imagen esté cubierta.
    const tone = color || (outSeconds ? outgoing.color : incoming.color)
    const curve = outSeconds ? outgoing.curve : incoming.curve
    const wait = (s) => new Promise((r) => setTimeout(r, Math.max(0, s) * 1000))
    const cover = () => { this.state.fade = sceneFadeState('out', 0, tone, curve) }
    const reveal = (s) => { this.state.fade = sceneFadeState('in', s, tone, incoming.curve) }
    if (outSeconds > 0) {
      this.state.fade = sceneFadeState('out', outSeconds, tone, outgoing.curve)
      await wait(outSeconds)
      if (!this.on) return NEVER
    } else if (inSeconds > 0) cover() // no mostrar un fotograma de la escena nueva antes del Fade In
    const recover = () => { this.state.fade = sceneFadeState('in', 0, tone) }
    const place = (t) => {
      if (!this._nativePlayerId) return // El cambio de escena no crea jugadores ocultos.
      if (pos) this._teleport({ mode: 'pos', pos, yaw })
      else { this._placeAtSpawn(t); if (yaw !== undefined) this.yaw = yaw * DEG }
    }
    if (target.id === p.activeSceneId) place(tag)
    else {
      if (!this._restoringPhysical) { this._rememberEventPhysics(); this._gpCapture() }
      this._sceneSignalReady = false
      // Las conexiones salientes siguen activas hasta NodeLifecycle.stop() de loadScene.
      // Ese mismo stop las libera: no desconectar antes de tree_exiting/tree_exited.
      this._sceneClearRuntime() // referencias transitorias de la escena saliente
      this._prefabClearRuntime() // antes de que switchScene guarde la escena saliente
      this._persistBeforeScene()
      this._teardownScene()
      let ok = false
      // switchScene sincroniza el SceneGraph y ejecuta _ready internamente.
      // Habilitar las conexiones antes de entrar en él, no tras _setupScene.
      this._sceneSignalReady = true
      try { ok = await this.rt.switchScene(target.id) }
      catch (e) {
        // Si falla la carga, intentar conservar los nodos vivos y rearmar la física del estado disponible.
        try { this._persistAfterScene(); this._setupScene(tag) } catch (restoreError) { console.warn('Recuperación de escena persistente', restoreError) }
        this.ed._persistRetainIds = null
        recover()
        throw e
      }
      if (!ok) { this.ed._persistRetainIds = null; this._persistAfterScene(); this._setupScene(tag); recover(); throw new Error('No se pudo cargar la escena') }
      this._persistAfterScene()
      if (!this.on) return NEVER
      this._cameraReset() // liberar leases de la escena anterior, no reutilizar IDs de otras escenas
      this.vp.playing = true
      this.vp.camera = this.cam
      this.showPlayView()
      await loadNavCache(this.ed)
      this._setupScene(tag)
      this.ed.nodeLifecycle?.scripts?.syncSceneConnections()
      if (pos || yaw !== undefined) place(tag)
      if (!this.film) await this._startWorldStreaming()
      if (!this.on) return NEVER
    }
    if (inSeconds > 0) {
      if (incoming.delay > 0 && fadeIn === undefined) { await wait(incoming.delay); if (!this.on) return NEVER }
      reveal(inSeconds)
    } else if (outSeconds > 0) recover()
    this.audio?.resetSources({ keep: new Set(this._persistObjects?.keys() || []) })
    await this.game.emit('scene', { scene: target.name })
    if (this.game.db.player?.autosaveScene && !this.game.saves.busy) this.game.saves.autosave()
  },
}
