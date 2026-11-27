// Navegación de la vista del editor: órbita, desplazamiento, zoom, vistas ortográficas, vuelo libre (WASD + ratón) y mando.
// Es un mixin de `Viewport` (viewport.js): usa su cámara, sus controles y sus campos `_fly*`.
import { acquirePointer } from '../input/pointer-capture.js'
import { finiteVector, finiteQuaternion, usableRect } from '../numeric-integrity.js'
import * as THREE from 'three'
import { clamp } from '../util.js'

export const navMethods = {
  /** El objetivo de la órbita procede del Editor y nunca fuerza el encuadre al cambiar de selección. */
  _prepareSelectionOrbit() {
    if (!this.orbitAroundSelection || this.playing || !this.orbitSelectionPoint) return
    const center = this.orbitSelectionPoint()
    if (!finiteVector(center) || this.controls.target.distanceToSquared(center) < 1e-8) return
    this.controls.target.copy(center)
    this.controls.update()
    this.requestRender()
  },

  _orbitBy(dx, dy, fullOrbit = false) {
    if (![dx, dy].every(Number.isFinite)) return
    this._prepareSelectionOrbit()
    const t = this.controls.target
    const off = this.camera.position.clone().sub(t)
    const sph = new THREE.Spherical().setFromVector3(off)
    sph.theta -= dx * 0.0055
    const lim = fullOrbit
      ? this.controls.maxPolarAngle - 0.001
      : (this.currentView === 'bottom' ? Math.PI - 0.001 : Math.max(Math.PI * 0.5, sph.phi)) // las vistas rápidas conservan su límite
    sph.phi = clamp(sph.phi - dy * 0.0055, 0.001, lim)
    off.setFromSpherical(sph)
    this.camera.position.copy(t).add(off)
    this.camera.lookAt(t)
    this.controls.update()
    this.requestRender()
  },

  _panBy(dx, dy) {
    if (![dx, dy].every(Number.isFinite)) return
    const t = this.controls.target
    const k = this.isOrtho ? (2 * this._orthoH / this.camera.zoom) / Math.max(1, this.container.clientHeight) : this.camera.position.distanceTo(t) * 0.0016
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1)
    const d = right.multiplyScalar(-dx * k).add(up.multiplyScalar(dy * k))
    const nextPosition = this.camera.position.clone().add(d), nextTarget = t.clone().add(d)
    if (!finiteVector(nextPosition) || !finiteVector(nextTarget)) return
    this.camera.position.copy(nextPosition)
    t.copy(nextTarget)
    this.controls.update()
    this.requestRender()
  },

  _zoomBy(delta) {
    if (!Number.isFinite(delta)) return
    if (this.isOrtho) {
      this.camera.zoom = clamp(this.camera.zoom * Math.exp(-delta * 0.012), 0.02, 400)
      this.camera.updateProjectionMatrix()
      this.controls.update()
      this.requestRender()
      return
    }
    const t = this.controls.target
    const off = this.camera.position.clone().sub(t)
    const len = clamp(off.length() * Math.exp(delta * 0.012), 0.6, this.persp.far * 0.3)
    this.camera.position.copy(t).add(off.setLength(len))
    this.controls.update()
    this.requestRender()
  },

  /**
   * Vistas rápidas. Las de eje (front/back/right/left/top/bottom) pasan a ortográfica como en Blender;
   * 'persp' vuelve a perspectiva. Nombres: front = mirando hacia -Z, right = desde +X, top = desde +Y.
   */
  setView(name) {
    const axis = { top: [0, 1, 0.0001], bottom: [0, -1, 0.0001], front: [0, 0, 1], back: [0, 0, -1], right: [1, 0, 0], left: [-1, 0, 0] }
    if (name === 'persp') this.setOrtho(false)
    else if (axis[name]) this.setOrtho(true)
    const t = this.controls.target
    const dist = Math.max(8, this.camera.position.distanceTo(t))
    const dirs = { ...axis, persp: [0.7, 0.55, 0.85] }
    const d = new THREE.Vector3(...(dirs[name] || dirs.persp)).normalize()
    this.controls.minPolarAngle = 0
    this.camera.position.copy(t).addScaledVector(d, dist)
    this.camera.lookAt(t)
    // la vista inferior necesita poder mirar desde debajo del suelo; el resto del tiempo se mantiene sobre el horizonte
    this.controls.maxPolarAngle = Math.PI
    this.controls.update()
    this.currentView = name
    this._viewChanged()
    this.requestRender()
  },

  /** Gira 180° alrededor del objetivo (Numpad 9). */
  flipView() {
    const t = this.controls.target
    const off = this.camera.position.clone().sub(t)
    off.x = -off.x; off.z = -off.z
    this.camera.position.copy(t).add(off)
    this.camera.lookAt(t)
    this.controls.update()
    this.requestRender()
  },

  /** Teclado numérico: giro en pasos, desplazamiento y zoom. */
  stepOrbit(dx, dy) { this._orbitBy(dx * 47.6, dy * 47.6) },

 // ≈ 15° por pulsación
  stepPan(dx, dy) { this._panBy(dx * 60, dy * 60) },

  stepZoom(dir) { this._zoomBy(-dir * 14) },

  // ---------- cámara ----------
  frameBox(box) {
    if (!finiteVector(box?.min) || !finiteVector(box?.max) || box.isEmpty()) return
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3())
    const radius = Math.max(size.length() * 0.5, 0.8)
    const keep = this.camera.position.clone().sub(this.controls.target)
    const dir = keep.lengthSq() > 1e-6 ? keep.normalize() : this.camera.getWorldDirection(new THREE.Vector3()).negate()
    if (this.isOrtho) {
      this.camera.position.copy(c).addScaledVector(dir, Math.max(radius * 3, 12))
      this.camera.zoom = clamp(this._orthoH / (radius * 1.25), 0.02, 400)
      this.camera.updateProjectionMatrix()
    } else {
      const fov = THREE.MathUtils.degToRad(this.persp.fov)
      const vfov = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * this.persp.aspect))
      const dist = clamp(radius * 1.2 / Math.sin(vfov / 2), 1, this.persp.far * 0.8)
      this.camera.position.copy(c).addScaledVector(dir, dist)
    }
    this.controls.target.copy(c)
    this.controls.update()
    this.requestRender()
  },

  /** Reutiliza el cursor de Editor en Object Mode y Edit Mode; fuera del gesto no captura el ratón. */
  setEditNavigation(source, grab) {
    this._editNavigationSource = source
    this._editNavigationGrab = grab
  },

  _continuousNavKind(e) {
    if (this.playing || !this._editNavigationSource?.() || !this._editNavigationGrab) return null
    if (e.button === 2) return e.shiftKey
      ? (this.controls.enabled && !this._flying ? 'pan' : null)
      : (this._flying ? 'fly' : null)
    if (!this.controls.enabled || this._flying) return null
    if (e.button === 1) return e.shiftKey ? 'pan' : 'orbit'
    if (e.button === 0 && (this._space || e.altKey)) return (this._space || e.shiftKey) ? 'pan' : 'orbit'
    return null
  },

  /** Se registra después de los controles oficiales para conservar su fallback nativo. */
  _bindContinuousNavigation() {
    const dom = this.dom
    const down = (e) => {
      const kind = this._continuousNavKind(e)
      if (!kind || this._continuousNavigation) return
      const start = { x: e.clientX, y: e.clientY }
      const accepted = this._editNavigationGrab.begin(start, (_p, move) => {
        const dx = Number.isFinite(move.movementX) ? move.movementX : 0
        const dy = Number.isFinite(move.movementY) ? move.movementY : 0
        if (!this._continuousNavigation || (!dx && !dy)) return
        this._continuousNavigation.travel += Math.abs(dx) + Math.abs(dy)
        if (kind === 'fly') this._flyRotate(dx, dy)
        else if (kind === 'pan') this._panBy(dx * this.controls.panSpeed, dy * this.controls.panSpeed)
        else {
          // Velocidad angular proporcional a la altura de la vista, como OrbitControls.
          const h = Math.max(1, dom.clientHeight || dom.getBoundingClientRect().height)
          const gain = (2 * Math.PI / h) * this.controls.rotateSpeed / 0.0055
          this._orbitBy(dx * gain, dy * gain, true)
        }
      }, reason => {
        // Una denegación de Pointer Lock no cancela el vuelo que ya tiene captura nativa.
        const fallback = kind === 'fly' && (reason === 'denied' || reason === 'timeout') && this._flying
        this._stopContinuousNavigation(!fallback)
        if (fallback && this.dom.hasPointerCapture && !this.dom.hasPointerCapture(this._flyPointerId)) {
          this._flyAwaitingCapture = true
          this._resumeFlyCapture()
        }
      }, { operation: `navigation:${kind}`, pointerId: e.pointerId })
      if (!accepted) return // Pointer Lock denegado: OrbitControls/vuelo continúan nativos.
      this._continuousNavigation = { kind, button: e.button, pointerId: e.pointerId, travel: 0, controlsEnabled: this.controls.enabled }
      if (kind !== 'fly') this.controls.enabled = false
      // El gesto ya tiene propietario. Los listeners posteriores no deben volver a capturar.
      e.stopImmediatePropagation?.()
    }
    const up = (e) => {
      const gesture = this._continuousNavigation
      if (!gesture || e.button !== gesture.button || (Number.isInteger(e.pointerId) && Number.isInteger(gesture.pointerId) && e.pointerId !== gesture.pointerId)) return
      this._lastContinuousNavigationMoved = gesture.travel > 5 || (gesture.kind === 'fly' && !!this._flyMoved)
      this._stopContinuousNavigation(false)
    }
    const cancel = () => this._stopContinuousNavigation(true)
    let ownerWin = dom.ownerDocument?.defaultView
    dom.addEventListener('pointerdown', down)
    dom.addEventListener('pointerup', up)
    dom.addEventListener('pointercancel', cancel)
    ownerWin?.addEventListener('pointerup', up)
    ownerWin?.addEventListener('blur', cancel)
    this._syncContinuousNavigationWindow = () => {
      const next = dom.ownerDocument?.defaultView
      if (next === ownerWin) return
      cancel()
      ownerWin?.removeEventListener('pointerup', up)
      ownerWin?.removeEventListener('blur', cancel)
      ownerWin = next
      ownerWin?.addEventListener('pointerup', up)
      ownerWin?.addEventListener('blur', cancel)
    }
    this._continuousNavigationCleanup = () => {
      dom.removeEventListener('pointerdown', down)
      dom.removeEventListener('pointerup', up)
      dom.removeEventListener('pointercancel', cancel)
      ownerWin?.removeEventListener('pointerup', up)
      ownerWin?.removeEventListener('blur', cancel)
      this._syncContinuousNavigationWindow = null
    }
  },

  _stopContinuousNavigation(cancelled = false) {
    if (!this._continuousNavigation) {
      if (cancelled && this._flying) this._endFlyNavigation()
      return
    }
    const gesture = this._continuousNavigation
    this._continuousNavigation = null
    this._editNavigationGrab?.end()
    if (gesture.kind !== 'fly') this.controls.enabled = gesture.controlsEnabled
    if (cancelled && gesture.kind === 'fly' && this._flying) this._endFlyNavigation()
    if (cancelled && gesture.kind !== 'fly') this.isNavigating = false
  },

  _flyRotate(dx, dy) {
    if (![dx, dy].every(Number.isFinite) || !finiteQuaternion(this.camera.quaternion)) return
    const eu = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ')
    eu.y -= dx * 0.0032 * (this._flyLook ?? 1)
    eu.x = clamp(eu.x - dy * 0.0032 * (this._flyLook ?? 1), -1.5, 1.5)
    this.camera.quaternion.setFromEuler(eu)
    this.requestRender()
  },

  _resumeFlyCapture() {
    if (!this._flying || !this._flyAwaitingCapture || this._editNavigationGrab?.releasing || this.dom.ownerDocument.pointerLockElement) return
    this._flyAwaitingCapture = false
    if (!acquirePointer(this.dom, {pointerId:this._flyPointerId}, 'Navegación de vuelo')) this._endFlyNavigation()
  },

  _endFlyNavigation() {
    if (!this._flying) return
    this._flying = false
    this._flyAwaitingCapture = false
    const gesture = this._continuousNavigation
    this._lastContinuousNavigationMoved = !!this._flyMoved || (gesture?.kind === 'fly' && gesture.travel > 5)
    if (gesture?.kind === 'fly') this._stopContinuousNavigation(false)
    const pointerId = this._flyPointerId
    this._flyPointerId = null
    if (Number.isInteger(pointerId) && this.dom.hasPointerCapture?.(pointerId)) {
      try { this.dom.releasePointerCapture(pointerId) }
      catch (error) { console.warn('[Century/Pointer] native-release-error', { owner: 'Editor viewport', operation: 'navigation:fly', pointerId, error }) }
    }
    this._keys.clear()
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
    this.controls.target.copy(this.camera.position).addScaledVector(fwd, this._flyDist)
    this.controls.enabled = true
    this.controls.update()
    this._onFlyInput?.(false)
    this.requestRender()
  },

  _beginFlyNavigation(e) {
    if (e.button !== 2 || this.playing || e.shiftKey || this._flying || this._continuousNavigation ||
        (this._editNavigationSource && !this._editNavigationSource()) || this._editNavigationGrab?.active || this._canStartFly?.() === false) return false
    const releasing = !!this._editNavigationGrab?.releasing
    if (this.dom.ownerDocument.pointerLockElement && (!releasing || this.dom.ownerDocument.pointerLockElement !== this.dom)) return false
    // El bloqueo propio de un gesto anterior puede estar liberándose de forma asíncrona.
    if (!releasing && !acquirePointer(this.dom, e, 'Navegación de vuelo')) return false
    this._flyAwaitingCapture = releasing
    this._flyPointerId = e.pointerId
    this._flying = true
    this._flyMoved = false
    this._flyTravel = 0
    this._lastContinuousNavigationMoved = false
    this._keys.clear()
    this._flyDist = clamp(this.camera.position.distanceTo(this.controls.target), 4, 80)
    this.controls.enabled = false
    // Desactivar únicamente la entrada de los gizmos antes de solicitar Pointer Lock.
    this._onFlyInput?.(true)
    this.dom.focus()
    return true
  },

  /** Impide que los addons soliciten Pointer Capture sobre un bloqueo previo o pendiente. */
  _guardEditorPointerDown(e) {
    if (this.playing || !this._editNavigationSource?.()) return false
    if (this._consumeMeshModalPointerDown?.(e)) return true
    const grab = this._editNavigationGrab
    const locked = this.dom.ownerDocument.pointerLockElement
    if (!locked && !grab?.active && !grab?.releasing && !grab?.documentBusy) return false
    // Un nuevo vuelo durante la liberación propia conserva el gesto y recupera la captura al terminar.
    if (e.button === 2 && !e.shiftKey && grab?.releasing && (!locked || locked === this.dom)) this._beginFlyNavigation(e)
    e.preventDefault()
    e.stopImmediatePropagation()
    return true
  },

  // ---------- modo vuelo (clic derecho + WASD) ----------
  _bindFly() {
    const dom = this.dom
    dom.addEventListener('contextmenu', (e) => e.preventDefault())
    let ownerDoc = dom.ownerDocument
    let ownerWin = ownerDoc.defaultView || window
    dom.addEventListener('pointerdown', e => this._beginFlyNavigation(e))
    dom.addEventListener('pointermove', (e) => {
      if (!this._flying) return
      this._resumeFlyCapture()
      if (!this._flying) return
      if (Number.isFinite(e.movementX) && Number.isFinite(e.movementY)) {
        this._flyTravel += Math.abs(e.movementX) + Math.abs(e.movementY)
        if (this._flyTravel > 5) this._flyMoved = true
      }
      this._flyRotate(e.movementX, e.movementY)
    })
    const end = (e) => {
      if (!this._flying || (e && (e.pointerId !== this._flyPointerId || e.button !== 2))) return
      this._endFlyNavigation()
    }
    dom.addEventListener('pointerup', end)
    const cancel = e => { if (e.pointerId === this._flyPointerId) this._endFlyNavigation() }
    dom.addEventListener('pointercancel', cancel)
    dom.addEventListener('lostpointercapture', e => {
      if (e.pointerId !== this._flyPointerId) return
      // Pointer Capture se pierde al pasar a Pointer Lock; sigue siendo el mismo gesto.
      if ((this._continuousNavigation?.kind === 'fly' && this._editNavigationGrab?.active) || this._flyAwaitingCapture) return
      cancel(e)
    })
    const lockSettled = () => queueMicrotask(() => this._resumeFlyCapture())
    const visibility = () => { if (ownerDoc.hidden) this._endFlyNavigation() }
    dom.addEventListener('wheel', (e) => {
      if (!this._flying) return
      e.preventDefault()
      this._flySpeed = clamp(this._flySpeed * (e.deltaY < 0 ? 1.15 : 0.87), 2, 120)
    }, { passive: false })
    dom.addEventListener('wheel', (e) => {
      if (this.nav !== 'trackpad' || this._flying) return
      e.preventDefault()
      const now = e.timeStamp || performance.now()
      const st = this._padState
      // unidades de la rueda → píxeles
      const u = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.container.clientHeight : 1
      let dx = e.deltaX * u, dy = e.deltaY * u
      if (e.ctrlKey) { // pellizco (el navegador lo manda como rueda + Ctrl): zoom, y anula cualquier orbitar que haya empezado por error
        st.z += clamp(dy, -80, 80)
        st.zx = e.clientX; st.zy = e.clientY
        st.zoomUntil = now + 280
        st.ox = st.oy = st.px = st.py = 0
        st.lastEv = now
        return
      }
      if (now < st.zoomUntil) { st.lastEv = now; return } // restos/inercia justo después de un pellizco: no deben orbitar
      // gesto nuevo (hubo una pausa): espera un instante por si en realidad era un pellizco que aún no trae Ctrl
      if (now - st.lastEv > 180) st.holdUntil = now + 45
      st.lastEv = now
      // si el movimiento es casi todo vertical (u horizontal), se descarta el otro eje: evita derivas al desplazar con dos dedos
      if (Math.abs(dx) < Math.abs(dy) * 0.25) dx = 0
      else if (Math.abs(dy) < Math.abs(dx) * 0.25) dy = 0
      if (e.shiftKey) { st.px += dx; st.py += dy } else { st.ox += dx; st.oy += dy }
    }, { passive: false })
    const typing = (e) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable
    const keyDown = (e) => {
      if (this._flying) {
        this._keys.add(e.code); e.preventDefault()
        if (['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space'].includes(e.code)) e.stopPropagation?.()
        if (e.code === 'Escape' && !this._editNavigationGrab?.active) this._endFlyNavigation()
        return
      }
      if (e.code === 'Space' && !typing(e) && !e.repeat) { this._space = true; if (e.target === dom || dom.matches(':hover')) e.preventDefault() }
    }
    const keyUp = (e) => {
      this._keys.delete(e.code)
      if (e.code === 'Space') this._space = false
    }
    const blur = () => { this._space = false; this._keys.clear(); this._endFlyNavigation() }
    const attach = () => {
      ownerWin.addEventListener('keydown', keyDown, true)
      ownerWin.addEventListener('keyup', keyUp, true)
      ownerWin.addEventListener('blur', blur)
      ownerWin.addEventListener('pointerup', end)
      ownerWin.addEventListener('pointercancel', cancel)
      ownerDoc.addEventListener('pointerlockchange', lockSettled)
      ownerDoc.addEventListener('pointerlockerror', lockSettled)
      ownerDoc.addEventListener('visibilitychange', visibility)
    }
    const detach = () => {
      ownerWin.removeEventListener('keydown', keyDown, true)
      ownerWin.removeEventListener('keyup', keyUp, true)
      ownerWin.removeEventListener('blur', blur)
      ownerWin.removeEventListener('pointerup', end)
      ownerWin.removeEventListener('pointercancel', cancel)
      ownerDoc.removeEventListener('pointerlockchange', lockSettled)
      ownerDoc.removeEventListener('pointerlockerror', lockSettled)
      ownerDoc.removeEventListener('visibilitychange', visibility)
    }
    attach()
    this._syncFlyDocument = () => {
      if (ownerDoc === dom.ownerDocument) return
      blur()
      detach()
      ownerDoc = dom.ownerDocument
      ownerWin = ownerDoc.defaultView || window
      attach()
    }
    this._flyCleanup = () => {
      this._endFlyNavigation()
      detach()
      this._syncFlyDocument = null
    }
  },

  /** Aplica los gestos acumulados del trackpad, suavizados (≈50 ms) y como máximo una vez por fotograma. */
  _padStep(dt, now) {
    const st = this._padState
    if (!st || (!st.ox && !st.oy && !st.px && !st.py && !st.z)) return
    const pd = this._pad || { orbit: 1, pan: 1, zoom: 1, sx: -1, sy: -1, zoomCursor: true }
    const a = 1 - Math.exp(-dt * 24)
    const take = (k) => { const v = st[k]; const d = Math.abs(v) < 0.04 ? v : v * a; st[k] = Math.abs(v - d) < 0.0005 ? 0 : v - d; return d }
    if (st.z) {
      const z = take('z') * pd.zoom
      if (pd.zoomCursor && !this.isOrtho) this._zoomAt(z, st.zx, st.zy); else this._zoomBy(z)
    }
    if (now < st.holdUntil) { this._needs = true; return }
    if (st.ox || st.oy) {
      const x = take('ox'), y = take('oy')
      this._orbitBy(x * pd.orbit * pd.sx, y * pd.orbit * pd.sy, !this.playing && this.controls.enabled)
    }
    if (st.px || st.py) { const x = take('px'), y = take('py'); this._panBy(x * pd.pan * pd.sx, y * pd.pan * pd.sy) }
    this._needs = true
  },

  /** Zoom que acerca/aleja hacia el punto bajo el cursor (el punto sigue bajo el cursor). */
  _zoomAt(delta, cx, cy) {
    if (![delta, cx, cy].every(Number.isFinite)) return
    const cam = this.camera, t = this.controls.target
    const off = cam.position.clone().sub(t)
    const d = off.length()
    const nd = clamp(d * Math.exp(delta * 0.012), 0.6, this.persp.far * 0.3)
    if (Math.abs(nd - d) < 1e-6) return
    const r = this.dom.getBoundingClientRect()
    if (!usableRect(r)) return
    const ndc = new THREE.Vector3(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1), 0.5)
    const dir = ndc.unproject(cam).sub(cam.position).normalize()
    const fwd = cam.getWorldDirection(new THREE.Vector3())
    const along = Math.max(0.2, dir.dot(fwd)) // evita saltos en los bordes de un gran angular
    const nextPosition = cam.position.clone().addScaledVector(dir, (d - nd) / along)
    const nextTarget = nextPosition.clone().addScaledVector(fwd, nd)
    if (!finiteVector(nextPosition) || !finiteVector(nextTarget)) return
    cam.position.copy(nextPosition)
    t.copy(nextTarget)
    this.controls.update()
    this.requestRender()
  },

  _flyStep(dt) {
    const k = this._keys
    if (!k.size) return
    const v = new THREE.Vector3()
    if (k.has('KeyW')) v.z -= 1
    if (k.has('KeyS')) v.z += 1
    if (k.has('KeyA')) v.x -= 1
    if (k.has('KeyD')) v.x += 1
    if (k.has('KeyE') || k.has('Space')) v.y += 1
    if (k.has('KeyQ')) v.y -= 1
    if (!v.lengthSq()) return
    v.normalize().multiplyScalar(this._flySpeed * dt * (k.has('ShiftLeft') || k.has('ShiftRight') ? (this._flySprint ?? 3) : 1))
    v.applyQuaternion(this.camera.quaternion)
    this.camera.position.add(v)
    this._flyMoved = true
    this.requestRender()
  },
}
