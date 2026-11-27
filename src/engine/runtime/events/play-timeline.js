import { nodeAnimationProperty, PROPS } from '../anim/model.js'
import { getDef } from '../nodes/registry.js'
// Timelines en el modo Jugar (cinemáticas): cámara, nodos, audio y comandos. Se mezcla en PlayMode (play.js).
//   game.timeline.play("nombre", { speed, from, lock, skippable }) → Promise  ·  comando de evento «Reproducir timeline».
import * as THREE from 'three'
import { TimelineRunner } from '../timeline/player.js'
import { quatFromRot, resolveCamera3D } from '../timeline/eval.js'
import { sampleBakeTrack } from '../../../core/timeline/physics.js'
import { DEG } from '../util.js'
import { setCameraFov, verticalFov } from '../render/camera-fov.js'
import { resolveAudioGroup } from '../audio/config.js'

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler()

export const timelineMethods = {
  _tlInit() { this.tls = []; this._tlLocks = 0; this._tlCtl = true; this._tlLookCtl = true; this._tlFov = false; this._tlWarned = new Set(); this._tlBakeOwners = new Map(); this._tlBakeReservations = new Map(); this._tlChannels = new Map(); this._tlWriting = null; this._tlCsgSig = null; this._tlCsgFault = false },

  _tlFind(x) {
    const q = String(x ?? '').trim().toLowerCase()
    const list = this.project.timelines || []
    return list.find((t) => t.id === x) || list.find((t) => t.name.toLowerCase() === q)
  },

  /** Lanza un timeline. Devuelve la promesa { stopped, skipped }. Si ya suena, devuelve la misma. */
  timelinePlay(name, opts = {}) {
    const tl = this._tlFind(name)
    if (!tl) throw new Error(`No existe el timeline «${name}»`)
    // La película puede existir en el proyecto aunque su escena no esté cargada.
    // No ejecutar sus pistas sobre nodos homónimos de otra escena.
    if (tl.filmMaker?.sceneId && tl.filmMaker.sceneId !== this.project.activeSceneId) {
      const sceneName = this.project.scenes?.find(s => s.id === tl.filmMaker.sceneId)?.name || tl.filmMaker.sceneId
      throw new Error(`La película «${tl.name}» pertenece a la escena «${sceneName}». Activa esa escena antes de reproducirla.`)
    }
    const cur = this.tls.find((r) => r.tl.id === tl.id)
    if (cur) return cur.done
    // Un nodo horneado solo puede pertenecer a una cinemática activa.
    // Comprobar todo antes de mover Jolt o cambiar los controles del jugador.
    const targets = tl.tracks.filter(tr => tr.kind === 'bake' && !tr.muted)
    for (const tr of targets) {
      if (this._tlBakeReservations.has(tr.node)) throw new Error(`Timeline: el nodo físico «${tr.node}» ya está reservado por otra cinemática`)
      const obj = this.project.objects.find(o => o.id === tr.node)
      const node = this.ed.nodes.get(tr.node)
      const record = this._bodies?.find(b => b.id === tr.node)
      if (obj?.type !== 'rigidbody3d' || !node || !record || !this.phys?.bi) throw new Error(`Timeline: falta RigidBody3D activo o Jolt para «${tr.node}»`)
    }
    const self = this
    const r = new TimelineRunner(tl, this._tlHost(), { speed: +opts.speed > 0 ? +opts.speed : 1, from: +opts.from || 0, onEnd: (run, stopped) => self._tlEnded(run, stopped) })
    r.cam = null
    // Referencia previa local al Runner; no crea pila de cámaras ni cambia el contrato de ownership.
    r._cameraBefore = this._cameraSource?.kind === 'held' || this._cameraSource?.kind === 'player' || this._cameraSource?.kind === 'pose'
      ? { ...this._cameraSource } : { kind: 'base' }
    r.cameraExit = opts.cameraExit ?? tl.cameraExit ?? null
    r.lock = opts.lock ?? tl.lockPlayer
    r.skippable = opts.skippable ?? tl.skippable
    const originalNode = r.host.node
    r.host = Object.assign(Object.create(r.host), {
      camera: (p) => { r.cam = p; if (p) r.lastCamera = p },
      bakeFrame: (time) => this._tlBakeAt(r, time),
      node: (name, prop, value, options) => this._tlApplyNode(r, originalNode, name, prop, value, options),
    })
    try { this._tlChannelAcquire(r); this._tlBakeBegin(r, targets) }
    catch (error) { this._tlChannelRelease(r); this._tlBakeRelease(r); throw error }
    this.tls.push(r)
    if (r.lock && this._tlLocks++ === 0) { this._tlCtl = this.control; this._tlLookCtl = this.lookControl; this.control = false; this.lookControl = false }
    this.state.timeline = { name: tl.name, skippable: r.skippable }
    r.update(0) // aplica ya la pose inicial: sin parpadeo de un fotograma
    if (+opts.from > 0 && !r.finished) this._tlAutomationSync(r)
    return r.done
  },

  /** Identidad de propiedad local a la escena; ninguna posesión se serializa. */
  _tlChannelKey(nodeId, prop) { return JSON.stringify([this.project.activeSceneId, nodeId, prop]) },
  _tlChannelOwner(nodeId, prop) { return this._tlChannels?.get(this._tlChannelKey(nodeId, prop))?.run || null },
  _tlAssertWritable(nodeId, prop) {
    const owner = this._tlChannelOwner(nodeId, prop)
    if (owner && owner !== this._tlWriting)
      throw new Error(`Timeline: propiedad «${prop}» del nodo «${nodeId}» reservada por otra animación`)
  },
  /** Los canales tipados nuevos utilizan captura y restauración del propietario; luz conserva TB01. */
  _tlChannelAcquire(run) {
    const pending = [], seen = new Set()
    for (const track of run.tl.tracks || []) {
      if (track.muted || track.kind !== 'node' || !track.keys?.length ||
          (!['light.energy', 'light.color', 'active'].includes(track.prop) && !PROPS[track.prop]?.ownerType)) continue
      if (track.byId !== true || track.sceneId !== this.project.activeSceneId)
        throw new Error(`Timeline: la pista «${track.name}» necesita nodo y escena vigentes`)
      const spec = PROPS[track.prop]?.ownerType ? PROPS[track.prop] : null
      const obj = this.project.objects.find(o => o.id === track.node && (track.prop === 'active' || o.type === (spec?.ownerType || 'light')))
      const node = obj && this.ed.nodes.get(obj.id)
      const ownsActivation = run.tl.tracks.some(other => !other.muted && other.kind === 'node' &&
        other.prop === 'active' && other.byId === true && other.sceneId === this.project.activeSceneId &&
        other.node === obj?.id && other.keys?.length)
      if (!node || (track.prop !== 'active' && !this._nodeEnabled(obj) && !ownsActivation) ||
          (track.prop === 'active' ? !nodeAnimationProperty(obj, 'active') : spec ? !nodeAnimationProperty(obj, track.prop) : !node.userData?.light))
        throw new Error(`Timeline: destino no disponible «${track.node}»`)
      const key = this._tlChannelKey(obj.id, track.prop)
      if (seen.has(key) || this._tlChannels.has(key)) throw new Error(`Timeline: canal ocupado «${track.prop}» (${obj.id})`)
      seen.add(key)
      const light = spec || track.prop === 'active' ? null : this._lightHandle(obj)
      if (!spec && track.prop !== 'active' && !light) throw new Error(`Timeline: lector de luz no disponible «${obj.id}»`)
      const hadActiveOverride = track.prop === 'active' && Object.hasOwn(node.userData, '_lfRuntimeActive')
      const snapshot = track.prop === 'active' ? node.userData._lfRuntimeActive ?? (obj.active !== false)
        : spec ? spec.capture(node, obj) : track.prop === 'light.energy' ? light.energy : light.color
      pending.push({ key, run, obj, node, prop: track.prop, spec, snapshot, hadActiveOverride, session: this._referenceSession })
    }
    run._tlChannelKeys = []
    for (const record of pending) { this._tlChannels.set(record.key, record); run._tlChannelKeys.push(record.key) }
  },
  _tlApplyNode(run, apply, name, prop, value, opts) {
    if (!['light.energy', 'light.color', 'active'].includes(prop) && !PROPS[prop]?.ownerType) return apply?.(name, prop, value, opts)
    const key = this._tlChannelKey(name, prop), rec = this._tlChannels.get(key)
    if (!rec || rec.run !== run || JSON.parse(key)[0] !== this.project.activeSceneId) return
    if (this.ed.nodes.get(rec.obj.id) !== rec.node || !this.project.objects.includes(rec.obj) ||
        (prop !== 'active' && !this._nodeEnabled(rec.obj))) return
    this._tlWriting = run
    try { return apply?.(name, prop, value, opts) }
    finally { this._tlWriting = null }
  },
  /** Sincronización CSG en el reloj del Player existente: primero el BSP, después
   *  las TriMeshShape3D explícitas que reciben el recorte. Nunca crear BodyID nuevo.
   */
  _tlSyncBrushes() {
    const objects = this.project?.objects || []
    const cutters = objects.filter(o => o.type === 'subtract' || o.type === 'meshSubtract')
    if (!cutters.length) { this._tlCsgSig = null; return }
    const byId = new Map(objects.map(o => [o.id,o]))
    const participants = new Set()
    for (const obj of objects) {
      if (obj.type !== 'subtract' && obj.type !== 'meshSubtract' && obj.type !== 'primitive' && obj.type !== 'mesh') continue
      const seen = new Set()
      for (let cur=obj;cur;cur=byId.get(cur.parentId)) {
        if (seen.has(cur.id)) break
        seen.add(cur.id);participants.add(cur.id)
      }
    }
    for (const cutter of cutters) if (cutter.type === 'meshSubtract') {
      const selected = byId.get(cutter.props?.sourceId)
      const source = selected?.props?.shape?.type === 'TriMeshShape3D' ? byId.get(selected.props.shape.sourceId) : selected
      for (let cur=source, seen=new Set();cur && !seen.has(cur.id);cur=byId.get(cur.parentId)) {
        seen.add(cur.id); participants.add(cur.id)
      }
    }
    const active = (this.tls || []).some(r => !r.finished && (r.tl.tracks || []).some(tr =>
      tr.kind === 'node' && !tr.muted && tr.byId === true &&
      tr.sceneId === this.project.activeSceneId && participants.has(tr.node)
    )) || cutters.some(o => Object.hasOwn(this.ed.nodes.get(o.id)?.userData || {},'timelineSubtractKind'))
    if (!active && !this._tlCsgSig) return
    // El CSG depende de la matriz relativa de cortador y receptor; ambos entran
    // en la firma. Una clave de posición del receptor también actualiza el corte.
    const sig = active ? JSON.stringify(objects.filter(o =>
      o.type === 'subtract' || o.type === 'meshSubtract' || o.type === 'primitive' || o.type === 'mesh').map(o => {
      const node = this.ed.nodes.get(o.id)
      node?.updateWorldMatrix(true,false)
      const s = node?.userData.visual?.scale
      return [o.id, o.type === 'subtract' ? (node?.userData.timelineSubtractKind ?? o.kind) : o.kind,
        ...(node?.matrixWorld?.elements || []).map(v=>Math.round(v*1e4)),
        ...[s?.x,s?.y,s?.z].map(v=>Number.isFinite(v)?Math.round(v*1e4):v),
        node?.userData._lfRuntimeActive ?? o.active]
    })) : null
    if (sig === this._tlCsgSig || this._tlCsgFault) return
    const def = getDef('subtract')
    try {
      for (const obj of cutters) {
        const node = this.ed.nodes.get(obj.id)
        if (node && obj.type === 'subtract') def?.refreshShape(node,obj)
      }
      const changed = this.ed.refreshBrushes({timeline:active}) || []
      this._nodeBodies?.syncCarvedSources(changed)
      this._tlCsgSig = sig
    } catch (error) {
      this._tlCsgFault = true
      // El renderer vuelve a la geometría autoral si Jolt rechaza la nueva forma.
      try {
        const changed = this.ed.refreshBrushes() || []
        this._nodeBodies?.syncCarvedSources(changed)
      } catch (restoreError) { this.game?.report?.(restoreError) }
      this.game?.report?.(error)
      return
    }
  },

  /** Una sesión, nodo o escena inválidos no retienen propiedad ni reciben snapshots. */
  _tlChannelSweep() {
    for (const [key, rec] of this._tlChannels || []) {
      // Si esta misma cinemática desactiva el nodo, sus otros snapshots
      // permanecen reservados para restaurarse al detener (sin escritor rival).
      const animatedActivation = (rec.run?._tlChannelKeys || []).some(channelKey => {
        const active = this._tlChannels.get(channelKey)
        return active?.run === rec.run && active.prop === 'active' && active.obj === rec.obj
      })
      if (JSON.parse(key)[0] === this.project.activeSceneId && this._referenceSession === rec.session &&
          this.project.objects.includes(rec.obj) && this.ed.nodes.get(rec.obj.id) === rec.node &&
          (rec.prop === 'active' || this._nodeEnabled(rec.obj) || animatedActivation)) continue
      this._tlChannels.delete(key)
      if (rec.run._tlChannelKeys) rec.run._tlChannelKeys = rec.run._tlChannelKeys.filter(id => id !== key)
    }
  },
  _tlChannelRelease(run, { restore = true } = {}) {
    const activationOwners = new Set((run._tlChannelKeys || []).map(key => this._tlChannels.get(key))
      .filter(rec => rec?.run === run && rec.prop === 'active').map(rec => rec.obj.id))
    let restorePhysics = false
    for (const key of run._tlChannelKeys || []) {
      const rec = this._tlChannels.get(key)
      if (!rec || rec.run !== run) continue
      this._tlChannels.delete(key)
      if (!restore || this._referenceSession !== rec.session || this.project.activeSceneId !== JSON.parse(key)[0] ||
          !this.project.objects.includes(rec.obj) || this.ed.nodes.get(rec.obj.id) !== rec.node ||
          (rec.prop !== 'active' && !this._nodeEnabled(rec.obj) && !activationOwners.has(rec.obj.id))) continue
      try {
        if (rec.prop === 'active') {
          this._nodeActive(rec.obj.id, rec.snapshot)
          if (!rec.hadActiveOverride) delete rec.node.userData._lfRuntimeActive
        } else if (rec.spec) {
          rec.spec.restore(rec.node, rec.snapshot, rec.obj)
          if (rec.prop.startsWith('physics.') || rec.prop.startsWith('collision.')) restorePhysics = true
          if (rec.obj.type === 'canvas' || rec.obj.type === 'sprite2d') this.state.spriteRev++
        }
        else { const light = this._lightHandle(rec.obj); if (light) light[rec.prop.slice(6)] = rec.snapshot }
      }
      catch (error) { this.game?.report?.(error) }
    }
    run._tlChannelKeys = []
    // Restituye propiedades Jolt inmediatamente al detener; no depende de que
    // el juego ejecute otro paso físico (por ejemplo si acaba de pausarse).
    if (restorePhysics) {
      this._nodeBodies?.syncTimelinePhysics()
      this._nodeBodies?.spatial?.syncTimelineCharacterPhysics()
    }
    if (this._tlCsgSig) this._tlSyncBrushes()
  },

  /** Voz automatizada propiedad de esta sesión, aislada de SFX y de otras cinemáticas. */
  _tlAutomationPlay(run, key, group, elapsed = 0) {
    const id = this.audio?.resolveClip(key.clip)
    if (!id) return Promise.resolve(null)
    const epoch = run._automationEpoch || 0
    const seconds = Math.max(0, elapsed), rate = Math.max(0.01, run.speed)
    return this.audio.engine.play(id, {
      group, mode: 'ui', volume: key.fadeIn > seconds ? 0 : key.volume,
      pitch: key.pitch * rate, loop: key.loop, offset: Math.max(0, (key.offset || 0) + seconds * key.pitch),
      fx: key.fx, volumeAutomation: key.volumeAutomation, automationElapsed: seconds, automationRate: rate,
    }).then(voice => {
      if (!voice) return null
      if (run.finished || (run._automationEpoch || 0) !== epoch) { voice.stop(); return null }
      const record = { voice, key, ending: false }
      ;(run._automationVoices ||= new Set()).add(record)
      voice.done?.finally(() => run._automationVoices?.delete(record))
      if (key.fadeIn > seconds) voice.ramp(key.volume, (key.fadeIn - seconds) / rate, 0)
      if (run.paused) voice.pause()
      return voice
    })
  },
  _tlAutomationStop(run) {
    run._automationEpoch = (run._automationEpoch || 0) + 1
    for (const rec of run._automationVoices || []) rec.voice.stop()
    run._automationVoices?.clear()
  },
  _tlAutomationUpdate(run) {
    for (const rec of run._automationVoices || []) {
      if (rec.ending) continue
      const startFade = rec.key.t + rec.key.duration - (rec.key.fadeOut || 0)
      if (run.time + 1e-6 >= startFade) {
        rec.ending = true
        rec.voice.stop(Math.max(0, (rec.key.t + rec.key.duration - run.time) / Math.max(0.01, run.speed)))
      }
    }
  },
  _tlAutomationSync(run) {
    // Un seek no puede resucitar un clip detenido por una clave Stop posterior.
    const actions = (run.tl.tracks || []).filter(track => track.kind === 'audio' && !track.muted)
      .flatMap(track => track.keys || []).filter(key => key.t < run.time).sort((a,b) => a.t - b.t)
    const active = []
    for (const key of actions) {
      const destination = resolveAudioGroup(this.audio?.engine?.cfg || this.project?.audio, key.group)
      if (key.action === 'stop') {
        if (destination.missing) continue
        if (key.group === 'sfx' && !key.clip) active.length = 0
        else for (let i=active.length-1;i>=0;i--) if (active[i].group === destination.id) active.splice(i,1)
      } else if (key.action === 'play') active.push({ key, group: destination.id })
    }
    for (const {key,group} of active) {
      if (!key.volumeAutomation?.length || !(key.duration > 0) || run.time >= key.t + key.duration) continue
      this._tlAutomationPlay(run, key, group, run.time - key.t)
        .catch(error => this.rt.toast(error.message, 'error', 5000))
    }
  },

  /** Solo los recursos con política declarada alteran la salida al concluir su Runner. */
  _tlCameraExit(run, reason) {
    const policy = run.cameraExit?.[reason]
    if (!policy || !run.lastCamera || this._cameraSource?.kind === 'request' || this.film?.camera ||
        this.tls.some(r => r !== run && !r.finished && r.cam)) return // Recursos vigentes: mismo fallback anterior.
    const to = typeof policy === 'string' ? policy : policy.to
    let next = null
    if (to === 'keep') {
      // Una pose libre no es una fuente viva. No congelar ni regresar automáticamente al FPS.
      const track = [...run.tl.tracks].reverse().find(t => t.kind === 'camera' && !t.muted && t.keys?.some(k => k.t <= run.time))
      const key = track && [...track.keys].filter(k => k.t <= run.time).sort((a,b) => b.t-a.t)[0]
      if (key?.mode === 'camera3d' && key.sceneId === this.project.activeSceneId && this._cameraResolve({ sceneId:key.sceneId, id:key.node }))
        next = { kind: 'held', source: { sceneId:key.sceneId, id:key.node } }
      else if (key?.mode === 'player' && this.hasPlayer) next = { kind:'player' }
      else { this._cameraWarn('tl:no-live:' + run.tl.id, `Timeline: no hay una fuente viva que mantener al salir de «${run.tl.name}»`); next = { kind:'empty' } }
    } else if (to === 'camera3d') {
      const source = { sceneId:policy.sceneId, id:policy.cameraId }
      if (this._cameraResolve(source)) next = { kind:'held', source }
    } else if (to === 'previous') {
      const previous = run._cameraBefore
      if (previous?.kind === 'held' && this._cameraResolve(previous.source)) next = previous
      else if (previous?.kind === 'base' || previous?.kind === 'player' && this.hasPlayer || previous?.kind === 'pose') next = previous
    } else if (to === 'player' && this.hasPlayer) next = { kind:'player' }
    else if (to === 'pose') next = { kind:'pose', pose:run.lastCamera }
    else if (to === 'base') next = { kind:'base' }
    if (!next) { this._cameraWarn('tl:invalid-exit:' + run.tl.id, `Timeline: salida «${to}» no disponible para «${run.tl.name}»`); next = {kind:'empty'} }
    this._cameraSource = next.kind === 'base' ? null : next
    this._cameraBlend = null // Ninguna política de recurso implica un blend tácito.
  },
  _tlEnded(run, stopped = false) {
    this._tlCameraExit(run, run.skipped ? 'skip' : stopped ? 'stop' : 'natural')
    this._tlChannelRelease(run)
    this._tlBakeRelease(run)
    this.tls = this.tls.filter((r) => r !== run)
    if (run.lock && --this._tlLocks === 0) { this.control = this._tlCtl; this.lookControl = this._tlLookCtl }
    const top = this.tls.at(-1)
    this.state.timeline = top ? { name: top.tl.name, skippable: top.skippable } : null
  },
  /** Reserva IDs sin alterar Jolt: el cuerpo sigue dinámico hasta el inicio de su bake. */
  _tlBakeBegin(run, tracks) {
    run.bakeTracks = tracks
    run.bakeNodes = []
    for (const tr of tracks) this._tlBakeReservations.set(tr.node, run)
  },
  /** Adquiere el control exactamente al cruzar start; también sirve para seek y loop. */
  _tlBakeAt(run, time) {
    for (const tr of run.bakeTracks || []) {
      const owned = this._tlBakeOwners.get(tr.node) === run
      if (time < tr.start) {
        if (owned) this._tlBakeRestore(run, tr.node)
        continue
      }
      if (owned) continue
      if (this._tlBakeReservations.get(tr.node) !== run) throw new Error(`Timeline: reserva física perdida para «${tr.node}»`)
      const id = tr.node, node = this.ed.nodes.get(id)
      const body = this._bodies?.find(b => b.id === id)
      if (!node || !body || !this.phys?.bi) throw new Error(`Timeline: el cuerpo físico «${id}» ya no está disponible`)
      const B = this.phys.bodies, J = this.phys.J
      const saved = { id, node, body, pos: node.position.toArray(), quat: node.quaternion.toArray(),
        vel: B.velocityOf(body.item), angular: B.angularVelocityOf(body.item) }
      this.phys.bi.SetMotionType(body.item.id, J.EMotionType_Kinematic, J.EActivation_Activate)
      B.setVelocity(body.item, [0, 0, 0]); B.setAngularVelocity(body.item, [0, 0, 0])
      run.bakeNodes.push(saved); this._tlBakeOwners.set(id, run)
    }
  },
  /** Restituye pose, dinámica y velocidades al salir del intervalo o detener. */
  _tlBakeRestore(run, id) {
    if (this._tlBakeOwners.get(id) !== run) return
    const index = run.bakeNodes.findIndex(b => b.id === id)
    if (index < 0) return
    const [saved] = run.bakeNodes.splice(index, 1)
    this._tlBakeOwners.delete(id)
    const { node, body } = saved
    node.position.fromArray(saved.pos); node.quaternion.fromArray(saved.quat); node.updateMatrixWorld(true)
    if (this.phys?.bi && this._bodies?.includes(body)) {
      const B = this.phys.bodies, J = this.phys.J
      node.updateWorldMatrix(true, false)
      B.teleport(body.item, node.getWorldPosition(_p), node.getWorldQuaternion(_q))
      this.phys.bi.SetMotionType(body.item.id, J.EMotionType_Dynamic, J.EActivation_Activate)
      B.setVelocity(body.item, saved.vel); B.setAngularVelocity(body.item, saved.angular)
    }
  },
  _tlBakeRelease(run) {
    for (const saved of [...(run.bakeNodes || [])]) this._tlBakeRestore(run, saved.id)
    for (const tr of run.bakeTracks || []) if (this._tlBakeReservations.get(tr.node) === run) this._tlBakeReservations.delete(tr.node)
    run.bakeTracks = []; run.bakeNodes = []
  },
  /** Reafirma el resultado al final del frame: scripts externos no desplazan la toma horneada. */
  _tlBakeHold() {
    for (const r of this.tls || []) if (!r.finished) {
      for (const tr of r.tl.tracks) if (tr.kind === 'bake' && !tr.muted) {
        const pose = sampleBakeTrack(tr, r.time)
        if (pose) r.host.bake?.(tr.node, pose)
      }
    }
  },
  _tlRunner(name) { return name == null || name === '' ? this.tls.at(-1) : this.tls.find((r) => r.tl.id === this._tlFind(name)?.id) },
  timelineStop(name) { const r = this._tlRunner(name); if (r) r.stop(); return !!r },
  timelineSkip(name) { const r = this._tlRunner(name); if (r && r.skippable) { r.skip(); return true } return false },
  timelineControl(name, what, v) {
    const r = this._tlRunner(name); if (!r) return false
    if (what === 'pause') r.pause(); else if (what === 'resume') r.resume(); else if (what === 'seek') r.seek(v); else if (what === 'speed') {
      r.speed = Math.max(0.01, +v || 1)
      for (const rec of r._automationVoices || []) {
        const sourceTime = rec.voice.time
        rec.voice.offset = sourceTime
        rec.voice.t0 = rec.voice.engine.ctx.currentTime
        rec.voice.setPitch(rec.key.pitch * r.speed)
        rec.voice.setAutomationPosition(r.time - rec.key.t, r.speed)
      }
    }
    return true
  },
  timelineInfo(name) { const r = this._tlRunner(name); return r ? { name: r.tl.name, time: r.time, duration: r.tl.duration, paused: r.paused, speed: r.speed, blocked: r.blockers > 0 } : null },

  /** Cada fotograma: avanza los timelines y deja la cámara cinemática si hay alguna activa. */
  _tlUpdate(dt) { this._tlChannelSweep(); for (const r of [...this.tls]) r.update(dt) },
  _tlCamera(cam) {
    const r = [...this.tls].reverse().find((x) => x.cam)
    if (r) {
      const p = r.cam
      cam.position.set(p.pos[0], p.pos[1], p.pos[2]); cam.quaternion.copy(p.quat)
      setCameraFov(cam, p.fov, 'vertical')
      this._tlFov = true
      this._profCamera(p.profile)
    } // Sin pista activa la cámara base ya fijó su FOV; no sobrescribir el FOV de Camera3D principal.
  },
  _tlReset() {
    for (const r of [...(this.tls || [])]) { this._tlChannelRelease(r, { restore: false }); this._tlBakeRelease(r); this._tlAutomationStop(r); r.finished = true; r.host.camera?.(null) }
    if (this._tlLocks > 0) { this.control = this._tlCtl; this.lookControl = this._tlLookCtl }
    this.tls = []; this._tlChannels.clear(); this._tlWriting = null; this._tlCsgSig = null; this._tlCsgFault = false; this._tlBakeOwners.clear(); this._tlBakeReservations.clear(); this._tlLocks = 0; this.state.letterbox = 0; this.state.caption = null; this.state.timeline = null
  },

  _tlHost() {
    const self = this
    const warn = (k, msg) => { if (self._tlWarned.has(k)) return; self._tlWarned.add(k); self.rt.toast(msg, 'error', 5000) }
    return {
      camera: () => {},
      resolveCamera(k) {
        if (k.mode === 'camera3d') {
          const pose = resolveCamera3D(k, self.project.activeSceneId, self.project.objects, self.ed.nodes)
          const warningId = 'camera3d:' + JSON.stringify([k.sceneId, k.node])
          if (pose) self._tlWarned.delete(warningId)
          else warn(warningId, `Timeline: Camera3D vinculada no disponible (${k.node || 'sin asignar'})`)
          return pose
        }
        if (k.mode === 'player') {
          _e.set(self.pitch, self.yaw, 0, 'YXZ')
          return { pos: [self.pos.x, self.pos.y + self.body.eyeHeight, self.pos.z], quat: _q.setFromEuler(_e).clone(), fov: verticalFov(self.g.fov, self.cam.aspect) }
        }
        const o = self._find(k.node)
        if (!o) { warn('cam:' + k.node, `Timeline: no existe la cámara «${k.node || '(sin nombre)'}»`); return { pos: k.pos, quat: quatFromRot(k.rot), fov: k.fov } }
        const m = self.ed.worldMatrix(o.id); m.decompose(_p, _q, _s)
        return { pos: _p.toArray(), quat: _q.clone(), fov: o.type === 'camera' ? o.props?.fov || 70 : k.fov, profile: o.type === 'camera' ? o.props?.profile || '' : '' }
      },
      bake(id, pose) {
        // Identidad estricta: jamás resolver nombres en una pista importada por ID.
        if (!self._tlBakeOwners.has(id)) return
        const node = self.ed.nodes.get(id), body = self._bodies?.find(b => b.id === id)
        if (!node || !body) { warn('bake:' + id, `Timeline: falta cuerpo físico «${id}»`); return }
        node.position.fromArray(pose.pos); node.quaternion.fromArray(pose.quat); node.updateMatrixWorld(true)
        if (self.phys?.bodies) {
          node.updateWorldMatrix(true, false)
          self.phys.bodies.teleport(body.item, node.getWorldPosition(_p), node.getWorldQuaternion(_q))
        }
      },
      node(name, prop, v, { byId = false, sceneId = null } = {}) {
        const o = byId ? self.project.objects.find(n => n.id === name) : self._find(name), node = o && self.ed.nodes.get(o.id)
        if (!node) { warn('node:' + name, `Timeline: no existe el nodo «${name}»`); return }
        if (sceneId && (sceneId !== self.project.activeSceneId || o.id !== name)) return
        const custom = nodeAnimationProperty(o, prop)
        if (prop === 'active') {
          if (byId && sceneId === self.project.activeSceneId &&
              (node.userData._lfRuntimeActive ?? (o.active !== false)) !== !!v) self._nodeActive(o.id, !!v)
          return
        }
        if (custom?.ownerType) {
          if (byId && sceneId === self.project.activeSceneId) {
            custom.apply(node, v, o)
            if (o.type === 'canvas' || o.type === 'sprite2d') self.state.spriteRev++
          }
          return
        }
        if (prop === 'light.energy' || prop === 'light.color') { const light = self._lightHandle(o); if (light) light[prop.slice(6)] = v; return }
        if (prop === 'visible') { if ((node.userData._lfRuntimeVisible ?? (o.visible !== false)) !== v) self._nodeVisible(o.id, v); return }
        if (prop === 'position') { node.position.set(v[0], v[1], v[2]); node.updateMatrixWorld(true); self.phys?.syncNode(node) }
        else if (prop === 'rotation') { node.rotation.order = 'YXZ'; node.rotation.set(v[0] * DEG, v[1] * DEG, v[2] * DEG); node.updateMatrixWorld(true); self.phys?.syncNode(node) }
        else if (prop === 'scale') { (node.userData.visual || node).scale.set(v[0], v[1], v[2]); node.updateMatrixWorld(true) }
      },
      audio(k, run) {
        if (!self.game) return
        const destination = resolveAudioGroup(self.audio?.engine?.cfg || self.project?.audio, k.group)
        if (destination.missing) warn('bus:' + destination.reference, `Timeline: bus de audio ausente «${destination.reference}»; reproducción en SFX`)
        // Las paradas dirigidas a buses eliminados no pueden detener otras voces en SFX.
        if (k.action === 'stop' && destination.missing) return
        if (k.action === 'play' && k.volumeAutomation?.length && k.duration > 0 && run)
          return self._tlAutomationPlay(run, k, destination.id)
        if (k.action === 'play' && (k.offset > 0 || k.fadeIn > 0 || k.duration > 0)) { // clip de una pista de audio (Nether Film Maker): desde un segundo, con fundidos y duración
          const id = self.audio?.resolveClip(k.clip)
          if (!id) { warn('au:' + k.clip, `Timeline: no existe el clip de audio «${k.clip}»`); return }
          return self.audio.engine.play(id, { group: destination.id, mode: 'ui', volume: k.fadeIn > 0 ? 0 : k.volume, pitch: k.pitch, loop: k.loop, offset: k.offset, fx: k.fx }).then((v) => {
            if (!v) return
            if (k.fadeIn > 0) v.ramp(k.volume, k.fadeIn, 0)
            if (k.duration > 0) self.timers.push({ t: Math.max(0, k.duration - k.fadeOut), r: () => v.stop(k.fadeOut) })
          })
          return
        }
        const cmd = k.action === 'stop' ? { code: 'soundStop', p: { group: k.group === 'sfx' && !k.clip ? '' : destination.id, fade: k.fade } } : { code: 'sound', p: { clip: k.clip, group: destination.id, volume: k.volume, pitch: k.pitch, loop: k.loop, fx: k.fx, wait: false } }
        self.game.run([cmd], { name: 'Timeline' })
      },
      audioUpdate(run) { self._tlAutomationUpdate(run) },
      audioPause(run) { for (const rec of run._automationVoices || []) rec.voice.pause() },
      audioResume(run) { for (const rec of run._automationVoices || []) rec.voice.resume() },
      audioSeek(run) { self._tlAutomationStop(run); self._tlAutomationSync(run) },
      audioLoop(run) { self._tlAutomationStop(run) },
      audioStop(run) { self._tlAutomationStop(run) },
      commands(list, { name }) { return self.game.run(list, { name: 'Timeline: ' + name }) },
      method(nodeId, method, args) {
        // Identidad estricta: nunca buscar métodos por nombre de nodo, aunque coincida con un ID eliminado.
        const obj = self.project.objects.find(o => o.id === nodeId)
        if (!obj || !self.ed.nodes.has(nodeId)) throw new Error(`Timeline: nodo receptor no disponible: ${nodeId}`)
        if (!Array.isArray(args)) throw new Error('Timeline: los argumentos del método deben ser una lista')
        const handle = self._nodeHandle(nodeId)
        if (!handle) throw new Error(`Timeline: nodo receptor inactivo: ${nodeId}`)
        return handle.call(method, ...args) // NodeScriptRuntime valida instancia, método ambiguo y ciclo de vida.
      },
      letterbox(v) { self.state.letterbox = v },
      interrupt() {
        const pl = self.state
        pl.caption = null
        if (pl.dialog) { const d = pl.dialog; pl.dialog = null; d.resolve?.() }
        if (pl.choices) { const c = pl.choices; pl.choices = null; c.resolve?.(-1) }
      },
      error: (e) => self.game?.report(e),
    }
  },
}
