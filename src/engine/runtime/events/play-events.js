// Eventos: páginas, gráficos, zonas y ejecución
import * as THREE from 'three'
import { gameplayRuntimeProps } from '../gameplay/object-state.js'
import { interactLabel } from './play-interaction-indicator.js'
import { LAYER } from './play-shared.js'
import { buildPrefabGraphic } from '../nodes/prefab-graphic.js'
import { resolveGraphic, graphicPhysics } from '../database/models.js'
import { buildEventGraphic, disposeEventGraphic } from '../nodes/event.js'

export const eventsMethods = {
  // =================== eventos ===================
  _applyPage(inst, idx) {
    this._eventPhysicsStop(inst)
    if (inst.gfx) {
      inst.node.remove(inst.gfx)
      for (const m of inst.gfxColl) { m.layers.disable(LAYER); this.phys?.removeMesh(m); const i = this.colliders.indexOf(m); if (i >= 0) this.colliders.splice(i, 1) }
      this._disposeGfx(inst.gfx); inst.gfx = null; inst.gfxColl = []
    }
    const previousParallel = inst.par
    inst.par = null
    previousParallel?.cancel()
    inst.pageIdx = idx
    inst.quick = 0; inst.off = false
    const page = inst.props.pages[idx]
    if (page && page.graphic.kind !== 'none') {
      const g = this._buildGfx(inst, page.graphic)
      if (g) {
        inst.node.add(g); inst.gfx = g
        const profile = graphicPhysics(page.graphic, this.game?.party?.db || this.project.database)
        inst.physicsProfile = profile
        // Solo un dueño de colisiones: con Physics explícito, page.solid no crea un cuerpo adicional.
        if (profile ? ['static', 'kinematic'].includes(profile.type) : page.solid) {
          inst.node.updateMatrixWorld(true)
          this._addColliders(g, inst.gfxColl)
          for (const m of inst.gfxColl) this.colliders.push(m)
          if (profile?.type === 'kinematic') this.phys?.makeKinematic(g)
        }
        if (inst.held) this._vmAdopt(inst, g) // cambia de página con el evento en la mano
        else if (inst.stashed) this._vmStashAdopt(inst, g) // ...o guardado: su gráfico nuevo tampoco choca
        else this._eventPhysicsResume(inst)
      }
    }
    if (!inst.gfx) inst.physicsProfile = null
    inst.inside = !!page && this._zone(inst, this.body.radius * 0.5)
    inst.gazeT = 0; inst.fired = false
    if (this.actors) this._startAuto(inst, page)
  },

  _buildGfx(inst, gr) {
    const prefab = (id) => buildPrefabGraphic(this.project.prefabs?.find((p) => p.id === id), this.ed._ctx(), { play: true })
    return buildEventGraphic(resolveGraphic(gr, this.game?.party?.db || this.project.database), inst.obj.scale, (id) => this.ed.models.get(id), { prefab, sprite: (id) => this.ed.spriteTexture(id) })
  },

  _disposeGfx(g) { disposeEventGraphic(g) },

  /** ¿Está el jugador dentro de la zona del evento (ampliada `margin` metros)? */
  _zone(inst, margin) {
    if (this.phys) return this.zoneHits.has(margin > this.body.radius ? inst.reachId : inst.coreId)
    const n = inst.node
    n.updateWorldMatrix(true, false)
    const inv = n.matrixWorld.clone().invert()
    const l = this.pos.clone().applyMatrix4(inv)
    const s = inst.obj.scale || [1, 1, 1]
    return Math.abs(l.x) <= s[0] / 2 + margin && Math.abs(l.z) <= s[2] / 2 + margin && l.y <= s[1] / 2 + 0.1 && l.y + this.body.height >= -s[1] / 2
  },

  /** Aplica los cambios de página antes de despachar una interacción o una señal.
   *  No inicia comandos nuevos: eso le corresponde a cada disparador. */
  _reconcilePages() {
    const g = this.game
    if (!g || this._reconcilingPages || g.rev === this._lastRev) return
    this._reconcilingPages = true
    try {
      // Una página puede cambiar estado durante su aplicación. Repetimos solo si cambió la revisión.
      for (let pass = 0; pass < 12 && g.rev !== this._lastRev; pass++) {
        this._lastRev = g.rev
        for (const e of this.events) {
          const idx = e.erased ? -1 : g.activePage(e.props, e.id)
          if (idx !== e.pageIdx) this._applyPage(e, idx)
          // Al cargar o regresar a esta escena, no reaparece un objeto ya guardado o usado.
          // Al cargar la escena, el arma equipada vuelve al View Model desde su evento original.
          const equipped = g.state.dbWeapons3D?.[e.id]
          if (equipped) {
            const actor = g.party.actor(equipped.actorId)
            if (e.held && actor?.equips[0] !== equipped.weaponId) {
              // También cubre un cambio de equipo hecho desde el comando antiguo o el inventario.
              this.viewModelStash({ target: e.id })
              equipped.status = 'stored'
            } else if (!e.held && !e.stashed) {
              if (equipped.status === 'hand' && actor?.equips[0] === equipped.weaponId) {
                void this.viewModelAttach({ target: e.id, slot: equipped.slot || 'right', seconds: 0 })
              } else this.viewModelStash({ target: e.id })
            }
          }
          const saved = g.state.dbItems3D?.[e.id]
          if (!saved || e.held || e.stashed) continue
          if (saved.status === 'stored' || saved.status === 'consumed') this.viewModelStash({ target: e.id })
          else if (saved.status === 'hand') this.viewModelAttach({ target: e.id, seconds: 0 })
        }
      }
      if (g.rev !== this._lastRev) {
        g.report(new Error('Las páginas siguen cambiando de estado durante la reconciliación.'), 'Páginas de evento')
        return false
      }
    } finally {
      this._reconcilingPages = false
      // Una señal originada mientras cambiaba un gráfico se entrega después de confirmar las páginas.
      const pending = this._pageSignals
      this._pageSignals = null
      // Si no se pudo estabilizar una página, no iniciamos receptores con una página dudosa.
      if (pending?.length && g.rev === this._lastRev) {
        for (const [name, data] of pending) this._signalEvents(name, data)
      }
    }
  },

  _events(dt = 0.016) {
    this._dtEv = dt
    const g = this.game
    if (this.phys && this.hasPlayer) { this.zoneHits = new Set(this.phys.overlaps()); this._triggers() }
    if (this._reconcilePages() === false) return
    if (this.hasPlayer) this._lookTick()
    // automáticos y paralelos
    if (!this.main) {
      for (const e of this.events) {
        if (!this._nodeEnabled(e.obj)) continue
        const pg = e.props.pages[e.pageIdx]
        if (pg && pg.trigger === 'auto' && !e.off && !e.stashed) { this._startMain(e); break }
      }
    }
    if (this._reconcilePages() === false) return
    for (const e of this.events) {
      if (this._reconcilePages() === false) return
      if (!this._nodeEnabled(e.obj)) continue
      const pg = e.props.pages[e.pageIdx]
      if (pg && pg.trigger === 'parallel' && !e.par && !e.off && !e.stashed) {
        const r = g.run(pg.list, { eventId: e.id, name: e.obj.name, onEnd: () => { if (e.par === r) e.par = null } })
        e.par = r
      }
    }
    // Un paralelo puede cambiar un interruptor al iniciar; el siguiente despachador usa páginas actuales.
    if (this._reconcilePages() === false) return
    // eventos comunes con interruptor (automáticos / paralelos)
    for (const ce of g.db.commonEvents) {
      if (!ce.list?.length || ce.trigger === 'none' || !ce.switch || !g.getSw(ce.switch)) continue
      this.commons ||= new Map()
      if (this.commons.get(ce.id)) continue
      if (ce.trigger === 'auto' && this.main) continue
      const r = g.run(ce.list, { name: ce.name, onEnd: () => { this.commons.delete(ce.id); if (this.main === r) this.main = null } })
      this.commons.set(ce.id, r)
      if (ce.trigger === 'auto') this.main = r
    }
    if (this._reconcilePages() === false) return
    // contacto, acción y «al mirarlo» (necesitan al jugador: sin Spawn no hay quien toque ni mire nada)
    let best = null, bestD = Infinity
    const pl = this.state
    if (!this.hasPlayer) { this.cand = null; this.gameplayCand = null; if (pl.prompt) pl.prompt = ''; pl.interactionIndicator = null; return }
    for (const e of this.events) {
      if (!this._nodeEnabled(e.obj)) continue
      const pg = e.props.pages[e.pageIdx]
      if (!pg || e.held || e.stashed) continue // un evento en la mano (view model) no se activa por contacto, acción ni mirada
      const gz = pg.gaze
      // mirada: se acumula el tiempo que el jugador mantiene el círculo amarillo
      const needGaze = pg.trigger === 'look' || (gz?.on && (pg.trigger === 'touch' || pg.trigger === 'action'))
      let gazing = true
      if (needGaze) {
        gazing = this.control && !this.main && this._gazeHit(e, pg)
        e.gazeT = gazing ? (e.gazeT || 0) + dt : 0
        gazing = gazing && e.gazeT >= (gz.hold || 0)
      }
      if (pg.trigger === 'touch') {
        const inside = this._zone(e, this.body.radius * 0.5) && gazing
        if (inside && !e.inside && !this.main) this._startMain(e)
        e.inside = inside
      } else if (pg.trigger === 'look') {
        if (gazing && !e.inside && !this.main) this._startMain(e)
        e.inside = gazing
      } else if (pg.trigger === 'action' && !this.main && this.control) {
        const reach = (e.props.reach ?? 1.2) + this.body.radius
        if (pg.showIndicator === true && this._inIndicatorZone ? !this._inIndicatorZone(e, 'key') : !this._zone(e, reach)) continue
        if (pg.showIndicator === true && this._indicatorScreen && !this._indicatorScreen(e)) continue
        const c = new THREE.Vector3(); e.node.getWorldPosition(c)
        const d = Math.hypot(c.x - this.pos.x, c.z - this.pos.z)
        // basta con estar dentro del alcance; mirar el evento solo se exige si «El jugador debe mirarlo» está marcado
        if ((!gz?.on || gazing) && d < bestD) { best = e; bestD = d }
      }
    }
    // Eventos y Gameplay Objects comparten una sola selección para la acción E.
    const gp = this._gpCandidate?.()
    this.gameplayCand = gp && gp.distance < bestD ? gp.item : null
    this.cand = this.gameplayCand ? null : best
    // Solo un Canvas personalizado conserva el texto anterior. El indicador nativo se dibuja en el objeto.
    const target = this.gameplayCand || this.cand
    const page = target?.props?.pages?.[target.pageIdx]
    const prompt = target && this._customActionPrompt?.() &&
      (target.obj.type === 'gameplayObject' ? gameplayRuntimeProps(target.obj, target.node).showIndicator !== false : page?.showIndicator === true)
      ? `${interactLabel(this.input?.map)} · ${target.obj.name}` : ''
    if (pl.prompt !== prompt) pl.prompt = prompt
  },

  /** Revalida E contra la página actual. Un candidato del frame anterior puede haber cambiado por self-switch. */
  _canAction(inst) {
    if (!inst || inst.erased || inst.off || inst.held || inst.stashed) return false
    const pg = inst.props.pages[inst.pageIdx]
    if (!pg || pg.trigger !== 'action') return false
    if (pg.showIndicator === true && this._inIndicatorZone ? !this._inIndicatorZone(inst, 'key') : !this._zone(inst, (inst.props.reach ?? 1.2) + this.body.radius)) return false
    if (pg.showIndicator === true && this._indicatorScreen && !this._indicatorScreen(inst)) return false
    return !pg.gaze?.on || (this._gazeHit(inst, pg) && (inst.gazeT || 0) >= (pg.gaze.hold || 0))
  },

  _startMain(inst) {
    const pg = inst.props.pages[inst.pageIdx]
    if (!pg || this.main || !this._nodeEnabled(inst.obj)) return
    const t0 = this.game.time
    if (pg.options?.face) { const v = new THREE.Vector3(this.pos.x - inst.node.position.x, 0, this.pos.z - inst.node.position.z); if (v.lengthSq() > 1e-6) { inst.node.rotation.y = Math.atan2(-v.x, -v.z); inst.node.updateMatrixWorld(true); this.phys?.syncNode(inst.node) } }
    const run = this.game.run(pg.list, {
      eventId: inst.id, name: inst.obj.name,
      onEnd: () => {
        if (this.main === run) this.main = null
        if (pg.trigger === 'auto') {
          inst.quick = this.game.time - t0 < 0.05 ? inst.quick + 1 : 0
          if (inst.quick > 120) { inst.off = true; this.game?.report(new Error('Evento automático que se repite sin parar: añade un interruptor o auto-interruptor que cambie de página.'), inst.obj.name) }
        }
      },
    })
    run.mode = pg.options?.during || 'locked'
    if (run.mode === 'face') run.faceInst = inst
    this.main = run
    this.state.prompt = ''
    this.state.interactionIndicator = null
  },
}
