// Nivel: título del mapa, sensores/disparadores, colisionadores y puntos de aparición
import { LAYER } from './play-shared.js'
import { getDef } from '../nodes/registry.js'
import { triggerRuntimeProps } from './play-look.js'
import { normalizeLevel, levelName, titleAlpha } from '../world/params.js'

export const levelMethods = {
  /** Rótulo con el nombre del mapa (interfaz «Nombre del mapa»). Sin texto: el del nivel actual. Tiempos y posición: los del nivel. */
  showLevelName(text, opts = {}) {
    const lv = normalizeLevel(this.project.environment?.level)
    const name = text != null && String(text) !== '' ? String(text) : levelName(this.project.environment, this.project.scenes.find((x) => x.id === this.project.activeSceneId)?.name)
    if (!name) return
    const n = (v, d) => (Number.isFinite(+v) && +v >= 0 ? +v : d)
    this.state.levelTitle = {
      id: (this._ltSeq = (this._ltSeq || 0) + 1), text: name, pos: opts.position || lv.namePos, alpha: 0, t: 0,
      delay: n(opts.delay, lv.nameDelay), in: n(opts.fadeIn, lv.nameIn), hold: n(opts.hold, lv.nameHold), out: n(opts.fadeOut, lv.nameOut),
    }
  },

  _levelTitleTick(lt, dt) {
    lt.t += dt
    const a = titleAlpha(lt.t, lt)
    if (a < 0) { if (this.state.levelTitle === lt || this.state.levelTitle?.id === lt.id) this.state.levelTitle = null; return }
    lt.alpha = a
  },

  /** Zonas de evento y triggers como sensores de Jolt (la cápsula del jugador los toca de verdad, con rotación y alturas). */
  _buildSensors(p) {
    this.zoneHits = new Set()
    this.triggers = []
    this._trigCache = null; this._lookCur = null // lista de Trigger para los rayos y mirada actual (play-look.js)
    if (!this.phys) return
    const grow = (s, m) => [s[0] + 2 * m, s[1] + 2 * m, s[2] + 2 * m]
    for (const e of this.events) {
      const s = e.obj.scale || [1, 1, 1]
      e.coreId = this.phys.addSensor(e.node, s)
      e.reachId = e.props.pages.some((pg) => pg.trigger === 'action') ? this.phys.addSensor(e.node, grow(s, e.props.reach ?? 1.2)) : e.coreId
    }
    for (const o of p.objects) {
      if (o.type !== 'trigger') continue
      const node = this.ed.nodes.get(o.id)
      if (node) this.triggers.push({ obj: o, id: this.phys.addSensor(node, o.scale || [1, 1, 1]), inside: false })
    }
  },

  /** Dispara game.on("triggerEnter") / game.on("triggerExit") y los slots «Al entrar» / «Al salir» del Trigger cuando el jugador entra o sale. */
  _triggers() {
    for (const t of this.triggers || []) {
      const inside = this.zoneHits.has(t.id)
      if (inside === t.inside) continue
      t.inside = inside
      this._triggerFire(t.obj, inside ? 'triggerEnter' : 'triggerExit', inside ? triggerRuntimeProps(this, t.obj).onEnter : triggerRuntimeProps(this, t.obj).onExit)
    }
  },

  _teardownScene() {
    this._closeWorldStreaming?.()
    // Los movimientos y fundidos de la escena desmontada no pueden actuar sobre IDs reutilizados.
    for (const t of this.tweens || []) t.r()
    this.tweens = []
    for (const f of this._lightFades || []) f.r()
    this._lightFades = []
    this._destructionReset?.()
    this._tornadoReset?.()
    this._animReset?.()
    try { this.lod?.detach() } catch (e) { console.warn('LOD', e) }
    this.lod = null
    this.vm?.stash.clear()
    if (this.vm) for (const id of [...this.vm.held.keys()]) this._vmDrop(id, { discard: true }) // lo que había en la mano era de la escena que se va
    for (const e of this.events) { e.par?.cancel(); for (const r of e.runs?.values() || []) r.cancel(); if (e.gfx) { e.node.remove(e.gfx); this._disposeGfx(e.gfx) } }
    this.events = []
    for (const m of this.colliders) m.layers.disable(LAYER)
    this.colliders = []
    // Cancelar primero las tareas NavGrid: un Promise resuelto tras STOP o
    // cambio de escena no puede instalar un mapa temporal en la escena nueva.
    this.nav?.dispose?.()
    this.nav = null
    for (const obj of this.project.objects || []) if (obj.type === 'navigation') {
      const node = this.ed.nodes.get(obj.id)
      if (!node?.userData) continue
      delete node.userData.navBakeRuntime
      delete node.userData.timelineNavBake
      delete node.userData.timelineNavStepHeight
    }
    this.phys?.dispose(); this.phys = null
    this.water = null
    this._waterConnection = null
    this.ed._activeWaterWorld = null
    this._waterFilmInitial = null
    this._waterViewTime = 0
    this.ed.hidePhysicalWater()
    this.ed.setPhysicalWaterBounds({ regions: new Map() })
    for (const obj of this.project.objects || []) if (obj.type === 'subtract' || obj.type === 'meshSubtract') {
      const node = this.ed.nodes.get(obj.id)
      if (node?.userData) delete node.userData.timelineSubtractKind
    }
    this.ed.refreshBrushes?.()
    // El siguiente frame de edición restaurará su vista previa sin avanzar la física.
    this.ed._physicalPreviewSig = null
    for (const h of this.hidden || []) h.visible = true
    this.hidden = []
    for (const obj of this.project.objects || []) {
      const node = this.ed.nodes.get(obj.id)
      if (!node) continue
      // Si Play termina de forma abrupta, la pieza recupera su posición autoral
      // mediante el mismo aplicador; nunca guardar una posición de Timeline.
      const piece = obj.type === 'terrain' && node.userData.terrainPiece
      if (piece?._timelineAuthoredPosition) {
        getDef('terrain').animation['terrain.piecePosition'].restore(node,
          { position: [...piece._timelineAuthoredPosition], had: false }, obj)
      }
      delete node.userData._lfRuntimeActive
      delete node.userData._lfRuntimeVisible
      if (!this.on) delete node.userData.rtEnergy
      node.visible = obj.active !== false && obj.visible !== false
    }
    this.ed.applyView()
  },

  _addColliders(node, list, o = null) {
    const parts = node.userData.parts // carretera: solo asfalto y aceras son transitables (las líneas pintadas no)
    node.traverse((m) => {
      if (!m.isMesh || m.userData.helper) return
      if (m.userData.road && parts && m !== parts.asphalt && m !== parts.side) return
      const box = o?.type === 'text' && m === node.userData.body ? m.geometry.userData.box : null // texto 3D: caja de colisión
      if (box) { m.layers.enable(LAYER); list.push(m); this.phys?.addBox(m, [box[0] * o.scale[0], box[1] * o.scale[1], box[2] * o.scale[2]]); return }
      m.layers.enable(LAYER)
      if (o) m.userData.rtObj = o // layers/tag del objeto (superficie de los pasos, game.raycast)
      list.push(m)
      this.phys?.addMesh(m)
    })
  },

  _spawnFor(tag) {
    const objects = this.project.objects || []
    // Cualquier Node3D con tag o nombre puede servir como marcador de llegada.
    // Los Spawn antiguos sólo se leen; no se generan ni ofrecen como nodos nuevos.
    const active = objects.filter(o => this._nodeEnabled(o) && this.ed?.nodes?.has(o.id))
    const value = obj => obj.type === 'spawn'
      ? (this.ed.nodes.get(obj.id)?.userData?.timelineSpawnTag ?? obj.props?.tag ?? 'player')
      : (obj.tag || obj.name)
    return active.find(o => value(o) === tag) || null
  },
}
