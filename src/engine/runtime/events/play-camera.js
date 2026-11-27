// Cámara del juego (principal / vista de Cámara)
import * as THREE from 'three'

import { setCameraFov } from '../render/camera-fov.js'
import { resolveCamera3D } from '../timeline/eval.js'

// Las opciones son por operación; nunca se interpretan como prioridad entre propietarios.
const cameraScale = new THREE.Vector3()
const cameraTransition = ({ seconds = 0, ease = 'inOut' } = {}) =>
  Number.isFinite(seconds) && seconds >= 0 && ['linear', 'inOut'].includes(ease) ? { seconds, ease } : null
const cameraPoseValid = p => p && Array.isArray(p.pos) && p.pos.length === 3 && p.pos.every(Number.isFinite) &&
  Number.isFinite(p.fov) && p.fov > 0 && p.fov < 179 && p.quat &&
  ['x', 'y', 'z', 'w'].every(k => p.quat[k] === undefined || Number.isFinite(p.quat[k]))
const cameraSnapshot = (cam, profile = '') => ({
  pos: [cam.position.x, cam.position.y, cam.position.z],
  quat: cam.quaternion.clone?.() || { ...cam.quaternion },
  fov: cam.fov, profile,
})
const cameraBlendPose = (blend, to, u) => {
  const t = blend.ease === 'linear' ? u : u * u * (3 - 2 * u)
  return { pos: blend.from.pos.map((v, i) => v + (to.pos[i] - v) * t),
    quat: blend.from.quat.clone().slerp(to.quat, t).normalize(),
    fov: blend.from.fov + (to.fov - blend.from.fov) * t,
    profile: t < 0.5 ? blend.from.profile : to.profile }
}


/** Selección de la cámara base, compartida por Play y la vista previa editorial. */
export function resolveMainCamera(objects, nodes, enabled, selected) {
  const cameras = objects.filter(o => o.type === 'camera' && nodes.has(o.id) && enabled(o))
  // Una clave de Camera3D.main modifica solo la fuente base.
  const temporary = cameras.some(o => typeof nodes.get(o.id)?.userData?.timelineMain === 'boolean')
  if (temporary) {
    const active = cameras.filter(o => (nodes.get(o.id)?.userData?.timelineMain ?? o.props?.main) === true)
    return active.length === 1 ? { obj: active[0], node: nodes.get(active[0].id) } : null
  }
  const obj = (selected && cameras.find(o => o.id === selected)) || cameras.find(o => o.props?.main)
  return obj ? { obj, node: nodes.get(obj.id) } : null
}

export function placeCameraNode(cam, { node, obj }, playerFov) {
  node.updateWorldMatrix(true, false)
  node.matrixWorld.decompose(cam.position, cam.quaternion, cameraScale)
  cam.quaternion.normalize()
  const timelineFov = node.userData?.timelineFov
  if (playerFov != null && timelineFov == null) setCameraFov(cam, playerFov)
  else setCameraFov(cam, Number(timelineFov ?? obj.props.fov) || 70, 'vertical')
}

export const cameraMethods = {
  _mainCameraNode() {
    return resolveMainCamera(this.project.objects, this.ed.nodes, (o) => this._nodeEnabled(o), this._gm?.camera)
  },

  _viewCamera(cam) {
    const mc = this._mainCameraNode()
    if (mc?.node) {
      const playerCamera = this._nativePlayerId && this._nativePitchCamera()?.id === mc.obj.id
      placeCameraNode(cam, mc, playerCamera ? this.g.fov : undefined)
      this._fovOverride = true
    } else {
      setCameraFov(cam, this.g.fov)
      this._fovOverride = false
      this.player.viewPose(cam)
    }
  },

  /** La autoridad pertenece a PlayMode, no a Camera3D ni a Timeline. Una sesión no sobrevive al cambio de escena. */
  _cameraReset() {
    this._cameraSource = null
    this._cameraActive = null
    this._cameraBlend = null
    this._cameraLastRaw = null
    this._cameraDelta = 0
    this._cameraWarned = new Set()
  },
  _cameraWarn(key, message) {
    if (this._cameraWarned?.has(key)) return
    ;(this._cameraWarned ??= new Set()).add(key)
    this.rt.log?.(message, 'warn', 'Camera Orchestration')
    console.warn(message)
  },
  /** Las solicitudes nuevas solo aceptan ID de Camera3D de la escena activa. No modifican datos persistentes. */
  _cameraResolve(source) {
    if (!source || source.sceneId !== this.project.activeSceneId) return null
    const obj = this.project.objects.find(o => o.id === source.id && o.type === 'camera' && this._nodeEnabled(o))
    if (!obj) return null
    const pose = resolveCamera3D({ mode: 'camera3d', sceneId: source.sceneId, node: source.id },
      this.project.activeSceneId, this.project.objects, this.ed.nodes)
    return cameraPoseValid(pose) ? pose : null
  },
  /** Inicia una transición desde la última salida dibujada sin Shake, no desde gameplay. */
  _cameraBeginBlend(options) {
    const transition = cameraTransition(options)
    if (!transition) return false
    const from = this._cameraLastRaw
    this._cameraBlend = transition.seconds > 0 && cameraPoseValid(from) && typeof from.quat.clone === 'function'
      ? { ...transition, from: { ...from, pos: [...from.pos], quat: from.quat.clone() }, elapsed: 0 }
      : null
    return true
  },
  /** Una solicitud puede adquirir la salida cuando no existe otro propietario activo incompatible. */
  _cameraAcquire(id, options = {}) {
    if (!this.on || !cameraTransition(options)) return null
    const source = { sceneId: this.project.activeSceneId, id: String(id ?? '') }
    if (!this._cameraResolve(source)) { this._cameraWarn('invalid:' + source.id, `Camera Orchestration: Camera3D no disponible (${source.id || 'sin ID'})`); return null }
    const occupied = this._cameraSource?.kind === 'request' || !!this.film?.camera || this.tls?.some(r => !r.finished && r.cam)
    if (occupied) { this._cameraWarn('occupied:' + source.id, `Camera Orchestration: solicitud rechazada para ${source.id}; otra fuente conserva la autoridad`); return null }
    const previous = this._cameraSource?.kind === 'held' ? { ...this._cameraSource } :
      this._cameraSource?.kind === 'player' ? { kind: 'player' } :
      this._cameraSource?.kind === 'pose' ? { ...this._cameraSource } : { kind: 'base' }
    const token = {}
    this._cameraBeginBlend(options)
    this._cameraSource = { kind: 'request', source, token }
    const self = this
    return Object.freeze({
      /** Solo el propietario puede cortar o transicionar a una Camera3D válida de la misma escena. */
      use(nextId, transition = {}) {
        if (self._cameraSource?.token !== token || !self.on || !cameraTransition(transition)) return false
        const next = { sceneId: self.project.activeSceneId, id: String(nextId ?? '') }
        if (!self._cameraResolve(next)) return false
        self._cameraBeginBlend(transition)
        self._cameraSource.source = next
        return true
      },
      /** keep conserva fuente viva; base devuelve control explícitamente; las demás salidas son opt-in. */
      release({ to = 'keep', cameraId, seconds = 0, ease = 'inOut' } = {}) {
        if (self._cameraSource?.token !== token || !self.on) return false
        if (!['keep', 'base', 'camera3d', 'previous', 'player', 'pose'].includes(to)) throw new Error('game.camera: salida no válida')
        if (!cameraTransition({ seconds, ease })) return false
        const current = self._cameraSource
        let next = null
        if (to === 'keep') next = { kind: 'held', source: current.source }
        if (to === 'camera3d') {
          const source = { sceneId: self.project.activeSceneId, id: String(cameraId ?? '') }
          if (!self._cameraResolve(source)) return false
          next = { kind: 'held', source }
        }
        if (to === 'previous') {
          next = previous
          if (next?.kind === 'held' && !self._cameraResolve(next.source)) return false
        }
        if (to === 'player') {
          if (!self.hasPlayer) return false
          next = { kind: 'player' }
        }
        if (to === 'pose') {
          if (!cameraPoseValid(self._cameraLastRaw)) return false
          next = { kind: 'pose', pose: self._cameraLastRaw }
        }
        // keep durante un blend conserva su progreso a la Camera3D viva.
        if (to !== 'keep' || !self._cameraBlend) self._cameraBeginBlend({ seconds, ease })
        self._cameraSource = next
        return true
      },
    })
  },
  /** Los comandos de evento usan el lease G002, sin registrar otra autoridad ni crear estados paralelos. */
  _cameraEventControl({ action, id, to = 'keep', cameraId, seconds = 0, ease = 'inOut', eventId, cameraOwner } = {}) {
    const owner = eventId != null && eventId !== '' ? `event:${eventId}` : typeof cameraOwner === 'string' && cameraOwner.startsWith('common:') ? cameraOwner : null
    if (!owner || !this.on || !cameraTransition({ seconds, ease })) return false
    const current = this._cameraSource
    const ownLease = current?.kind === 'request' && current.owner === owner ? current.lease : null
    if (action === 'release') {
      if (!ownLease) return false
      return ownLease.release({ to, cameraId, seconds, ease })
    }
    if ((action !== 'activate' && action !== 'change') || !id) return false
    if (ownLease) return ownLease.use(id, { seconds, ease })
    if (action === 'change') return false
    const lease = this._cameraAcquire(id, { seconds, ease })
    if (!lease) return false
    this._cameraSource.owner = owner
    this._cameraSource.lease = lease
    return true
  },
  _cameraApi() {
    const self = this
    return {
      acquire: (cameraId, options = {}) => self._cameraAcquire(cameraId, options),
      get active() { return self._cameraActive ? { ...self._cameraActive } : null },
    }
  },

  /** Una decisión única; los blends se resuelven antes de audio, DOF, agua y Shake. */
  _cameraFrame(cam) {
    const base = this._mainCameraNode()
    let active = base?.node ? { kind: 'camera3d', id: base.obj.id } : this.hasPlayer ? { kind: 'player' } : null
    let profile = base?.obj?.props?.profile || null
    const timeline = [...(this.tls || [])].reverse().find(r => !r.finished && r.cam)
    const source = this._cameraSource
    const pose = source?.source ? this._cameraResolve(source.source) : null
    if (source?.source && !pose) {
      this._cameraWarn('lost:' + source.source.id, `Camera Orchestration: se perdió Camera3D ${source.source.id}; se utiliza una fuente disponible`)
      this._cameraSource = null
      this._cameraBlend = null
    }
    if (this.film?.camera) {
      if (timeline) this._cameraWarn('film:timeline', 'Camera Orchestration: FilmMaker conserva la vista frente a Timeline durante su sesión')
      this.film.camera(cam)
      active = { kind: 'film' }
      this._tlFov = true
    } else if (source?.kind === 'request' && pose) {
      if (timeline) this._cameraWarn('request:timeline', 'Camera Orchestration: Timeline no puede desplazar una solicitud de cámara activa')
      this._cameraApply(cam, pose)
      active = { kind: 'camera3d', id: source.source.id, requested: true }
      profile = pose.profile || null
      this._tlFov = true
    } else if (timeline) {
      this._tlCamera(cam)
      active = { kind: 'timeline', id: timeline.tl.id }
      profile = timeline.cam?.profile || null
    } else if (source?.kind === 'held' && pose) {
      this._cameraApply(cam, pose)
      active = { kind: 'camera3d', id: source.source.id, held: true }
      profile = pose.profile || null
      this._tlFov = true
    } else if (source?.kind === 'pose' && source.pose) {
      this._cameraApply(cam, source.pose)
      active = { kind: 'pose' }
      profile = source.pose.profile || null
      this._tlFov = true
    } else if (source?.kind === 'player' && this.hasPlayer) {
      this.player.viewPose(cam)
      setCameraFov(cam, this.g.fov)
      active = { kind: 'player' }
      profile = null
      this._tlFov = false
    } else if (source?.kind === 'empty') {
      active = null
      this._tlFov = false
    } else {
      this._viewCamera(cam)
      this._tlFov = false
    }
    const dest = cameraSnapshot(cam, profile || '')
    const blend = this._cameraBlend
    if (blend && active && cameraPoseValid(dest)) {
      blend.elapsed = Math.min(blend.seconds, blend.elapsed + Math.max(0, this._cameraDelta || 0))
      const u = blend.elapsed / blend.seconds
      if (typeof dest.quat?.clone === 'function') {
        const effective = cameraBlendPose(blend, dest, u)
        this._cameraApply(cam, effective)
        profile = effective.profile
      } else this._cameraBlend = null // solo hay mezcla real con quaternion válido
      if (u >= 1) this._cameraBlend = null
    } else if (blend) this._cameraBlend = null
    this._profCamera(profile, blend ? 0 : undefined)
    this._cameraLastRaw = active ? cameraSnapshot(cam, profile || '') : null
    this._cameraActive = active
    const none = !active
    if (this.state.noCamera !== none) {
      this.state.noCamera = none
      this.dom.style.opacity = none ? '0' : ''
    }
    this._waterFx(cam)
    this._dofFocus(cam)
  },
  _cameraApply(cam, pose) {
    cam.position.set(pose.pos[0], pose.pos[1], pose.pos[2])
    cam.quaternion.copy(pose.quat)
    setCameraFov(cam, pose.fov, 'vertical')
    this._fovOverride = true
  },

  /** Enfoque automático de la profundidad de campo: un rayo al centro de la pantalla cada 3 fotogramas (lo que se mira queda nítido). */
  _dofFocus(cam) {
    const look = this.ed.vp.look
    if (!look?.dofPass || !look.cfg.dofAuto) return
    if ((this._dofN = ((this._dofN || 0) + 1) % 3) !== 1) return
    const o = cam.getWorldPosition(this._dofO ??= new THREE.Vector3()), d = cam.getWorldDirection(this._dofD ??= new THREE.Vector3())
    const hit = this._raycast(o.toArray(), d.toArray(), 200)
    look.setFocusTarget(hit ? hit.distance : 200)
  },

  /** Efecto bajo el agua según la CÁMARA (sea la del jugador, la de un evento o una cámara de escena): niebla y color del agua, sonido amortiguado. */
  _waterFx(cam) {
    const W = this.water, g = this.g
    let s = null
    if (W && !W.empty && g.uwEffect !== false) {
      s = W.at(cam.position.x, cam.position.z)
      if (s && cam.position.y >= s.surface - 0.01) s = null
    }
    if (!s) {
      if (this._uwOn) { this._uwOn = false; this.ed.vp.setUnderwater(null); this.audio?.engine?.setMuffle(0) }
      return
    }
    const below = s.surface - cam.position.y, clarity = Math.max(0.5, s.clarity || 6)
    const k = Math.min(1, below / clarity)
    const color = (this._uwA ??= new THREE.Color()).set(s.color) // más hondo → más oscuro
    color.lerp((this._uwB ??= new THREE.Color()).set(s.deepColor), k)
    // la luz de la escena (noche, tormenta, interior con poca luz ambiente) oscurece el agua vista desde dentro; algo queda siempre (la vista se adapta)
    const wf = this.ed.vp._wf, amb = Number(this._sceneEnv().ambient)
    const light = (wf?.light ?? 1) * Math.min(1, Math.max(0.3, (Number.isFinite(amb) ? amb : 0.55) / 0.55))
    color.multiplyScalar(g.uwLight === false ? 1 : 0.1 + 0.9 * light)
    this._uwOn = true
    this.ed.vp.setUnderwater({ color: '#' + color.getHexString(), density: (0.7 / clarity) * (g.uwDensity ?? 1) })
    this.audio?.engine?.setMuffle(g.uwMuffle ?? 0.75)
  },
}
