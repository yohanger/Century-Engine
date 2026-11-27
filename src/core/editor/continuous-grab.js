// Cursor virtual de transformación: una sola captura temporal por gesto, sin mover el cursor del sistema.
const wrap = (value, size) => {
  if (!(size > 2)) return 1
  const range = size - 2
  return ((value - 1) % range + range) % range + 1
}

// Solo una petición pendiente por documento. Una captura tardía se libera
// aunque el gesto haya terminado antes de que el navegador la conceda.
const pendingLocks = new WeakMap()
const ownedLocks = new WeakMap()
const latestRequests = new WeakMap()
const lateRequests = new WeakMap()
const REQUEST_TIMEOUT = 1000
const LATE_EVENT_WINDOW = 2000
const RELEASE_TIMEOUT = 250

export class ContinuousGrab {
  constructor(dom, { owner = 'Editor', canOwnLock = () => true } = {}) {
    this.dom = dom
    this.doc = dom.ownerDocument
    this.owner = owner
    this.canOwnLock = canOwnLock
    this.disposed = false
    this.active = false
    this.locked = false
    this._moving = (e) => this._pointerMove(e)
    this._lockChanged = () => this._pointerLockChanged()
    this._blur = () => this.cancel('blur')
    this._escape = (e) => {
      if (this.canOwnLock() && (this.active || this.releasing) && e.key === 'Escape') {
        e.preventDefault?.(); e.stopImmediatePropagation?.(); this.cancel('escape')
      }
    }
    this._pointerCancelled = (e) => {
      if (this.active && (this._request?.pointerId == null || this._request.pointerId === e.pointerId)) this._cancel('pointercancel')
    }
    this._hidden = () => { if (this.doc.hidden) this.cancel('hidden') }
    this._attachDocument()
    this.dom.addEventListener('pointercancel', this._pointerCancelled, true)
    // Capture es indispensable: Three procesa pointermove con coordenadas (0,0) bajo Pointer Lock.
    this.dom.addEventListener('pointermove', this._moving, true)
    this.cursor = this.doc.createElement('div')
    this.cursor.setAttribute('data-lf-continuous-cursor', '')
    Object.assign(this.cursor.style, {
      position: 'absolute', width: '10px', height: '10px', border: '1px solid #ffffff',
      borderRadius: '50%', boxShadow: '0 0 0 1px #142438', background: '#e2aa50',
      pointerEvents: 'none', zIndex: '15', display: 'none', transform: 'translate(-50%,-50%)',
    })
    this.dom.parentElement?.appendChild(this.cursor)
  }

  _attachDocument() {
    this.doc.addEventListener('pointerlockchange', this._lockChanged)
    this.doc.addEventListener('keydown', this._escape, true)
    this.doc.addEventListener('visibilitychange', this._hidden)
    this.doc.defaultView?.addEventListener('blur', this._blur)
  }

  _detachDocument() {
    this.doc.removeEventListener('pointerlockchange', this._lockChanged)
    this.doc.removeEventListener('keydown', this._escape, true)
    this.doc.removeEventListener('visibilitychange', this._hidden)
    this.doc.defaultView?.removeEventListener('blur', this._blur)
  }

  syncDocument() {
    if (this.disposed || this.dom.ownerDocument === this.doc) return
    this.cancel('document-change')
    this._detachDocument()
    this.doc = this.dom.ownerDocument
    this._attachDocument()
    this.dom.parentElement?.appendChild(this.cursor)
  }

  get releasing() {
    return !this.active && (pendingLocks.get(this.doc)?.owner === this ||
      (ownedLocks.get(this.doc)?.owner === this && this.doc.pointerLockElement === this.dom))
  }

  get documentBusy() {
    const owned = ownedLocks.get(this.doc)
    if (owned && this.doc.pointerLockElement !== owned.owner.dom) {
      owned.releaseListener?.()
      if (ownedLocks.get(this.doc) === owned) ownedLocks.delete(this.doc)
    }
    return pendingLocks.has(this.doc) || ownedLocks.has(this.doc)
  }

  /** A modal owner may receive input before addons without admitting foreign captures. */
  canReceiveModalInput() {
    if (this.disposed || !this.canOwnLock() || this.dom.ownerDocument !== this.doc) return false
    const pending = pendingLocks.get(this.doc), owned = ownedLocks.get(this.doc)
    if (this.doc.pointerLockElement) return this.active && this.doc.pointerLockElement === this.dom && (owned === this._request || pending === this._request)
    if (pending) return this.active && pending === this._request
    return !this.documentBusy
  }

  _report(request, reason, previous, error = null) {
    if (!request || request.reported.has(reason)) return
    request.reported.add(reason)
    const doc = request.doc
    const locked = doc.pointerLockElement
    console.warn('[Century/Pointer] ' + reason, {
      owner: this.owner, operation: request.operation, previous,
      state: this.active ? (this.locked ? 'locked' : 'pending') : this.releasing ? 'releasing' : 'idle',
      pointerLock: locked === this.dom ? 'viewport' : locked ? 'other' : 'none',
      pointerCapture: Number.isInteger(request.pointerId) ? this.dom.hasPointerCapture?.(request.pointerId) ?? null : null,
      focused: doc.hasFocus?.() ?? null, hidden: !!doc.hidden,
      window: doc.defaultView?.location?.href?.split(/[?#]/)[0] ?? null,
      connected: this.dom.isConnected !== false,
      recovery: this.active ? 'gesture-active' : locked === this.dom ? 'release-not-confirmed' : this.releasing ? 'local-cursor-restored-request-pending' : 'local-cursor-restored',
      error: error ? { name: error.name, message: error.message, stack: typeof error.stack === 'string' ? error.stack.replace(/data:text\/javascript[^\n]*?(?=:\d+:\d+\)?(?:\n|$)|\n|$)/g, 'data:text/javascript[omitted]').slice(0, 2048) : error.stack } : null,
    })
  }

  _releaseLock(request = ownedLocks.get(this.doc)) {
    if (request?.owner !== this) return
    const doc = request.doc
    if (ownedLocks.get(doc) !== request) return
    if (doc.pointerLockElement !== this.dom) {
      ownedLocks.delete(doc)
      clearTimeout(request.releaseTimer)
      request.releaseListener?.()
      return
    }
    clearTimeout(request.releaseTimer)
    if (!request.releaseListener) {
      request.releaseListener = () => {
        if (doc.pointerLockElement === this.dom) return
        if (ownedLocks.get(doc) === request) ownedLocks.delete(doc)
        clearTimeout(request.releaseTimer)
        doc.removeEventListener('pointerlockchange', request.releaseListener)
        request.releaseListener = null
      }
      doc.addEventListener('pointerlockchange', request.releaseListener)
    }
    const attempt = () => {
      if (ownedLocks.get(doc) !== request || doc.pointerLockElement !== this.dom) return
      if (!this.canOwnLock()) {
        this._report(request, 'release-authority-changed', 'releasing')
        return
      }
      try { doc.exitPointerLock?.() }
      catch (error) { this._report(request, 'release-error', 'releasing', error) }
    }
    attempt()
    if (doc.pointerLockElement !== this.dom) { request.releaseListener?.(); return }
    if (ownedLocks.get(doc) !== request) return
    request.releaseTimer = setTimeout(() => {
      attempt()
      if (doc.pointerLockElement !== this.dom) { request.releaseListener?.(); return }
      if (ownedLocks.get(doc) === request && doc.pointerLockElement === this.dom) {
        this._report(request, 'release-timeout', 'releasing')
      }
    }, RELEASE_TIMEOUT)
  }

  begin(client, onMove, onCancel, { clampCursor = false, operation = 'continuous', pointerId = null } = {}) {
    this.syncDocument()
    if (this.disposed || this.active || !this.canOwnLock() || this.dom.ownerDocument !== this.doc ||
        !this.dom.requestPointerLock || this.doc.pointerLockElement || this.documentBusy) return false
    const r = this.dom.getBoundingClientRect()
    if (!r.width || !r.height) return false
    const x = Number.isFinite(client?.x) ? client.x - r.left : r.width / 2
    const y = Number.isFinite(client?.y) ? client.y - r.top : r.height / 2
    this.previousCursor = this.dom.style.cursor
    this.active = true
    this.locked = false
    this.acc = { x, y }
    this.clampCursor = clampCursor
    this.visual = { x: this._bound(x, r.width), y: this._bound(y, r.height) }
    this.onMove = onMove
    this.onCancel = onCancel
    const doc = this.doc
    const request = { owner: this, doc, token: {}, operation, pointerId, reported: new Set() }
    this._request = request
    lateRequests.get(doc)?.detach?.()
    latestRequests.set(doc, request.token)
    pendingLocks.set(doc, request)
    const detach = () => {
      clearTimeout(request.timer)
      clearTimeout(request.lateTimer)
      if (lateRequests.get(doc) === request) lateRequests.delete(doc)
      doc.removeEventListener('pointerlockchange', acquired)
      doc.removeEventListener('pointerlockerror', rejected)
    }
    request.detach = detach
    const clearRequest = () => {
      if (pendingLocks.get(doc) !== request) return false
      pendingLocks.delete(doc)
      detach()
      return true
    }
    const acquired = () => {
      if (doc.pointerLockElement !== this.dom || latestRequests.get(doc) !== request.token || !this.canOwnLock()) return
      const pending = clearRequest()
      if (!pending && !request.expired) return
      if (!pending && (pendingLocks.has(doc) || ownedLocks.has(doc))) return
      detach()
      request.expired = false
      latestRequests.delete(doc)
      ownedLocks.set(doc, request)
      if (this.active && this._request === request && this.doc === doc) this._pointerLockChanged()
      else {
        this._releaseLock(request)
        this._report(request, 'late-lock', 'cancelled')
      }
    }
    const rejected = (error) => {
      if (clearRequest()) {
        request.denied = true
        request.deniedWithError = !!error?.message
        if (latestRequests.get(doc) === request.token) latestRequests.delete(doc)
        if (this._request === request && this.active) this._cancel('denied', error)
        else this._report(request, 'denied', 'cancelled', error)
      } else if (request.expired) { request.expired = false; detach() }
      else if (request.denied && !request.deniedWithError && error?.message) {
        request.deniedWithError = true
        this._report(request, 'denied-detail', 'pending', error)
      }
    }
    doc.addEventListener('pointerlockchange', acquired)
    doc.addEventListener('pointerlockerror', rejected)
    request.timer = setTimeout(() => {
      if (!clearRequest()) return
      request.expired = true
      // Las implementaciones que solo emiten eventos necesitan una vigilancia acotada.
      doc.addEventListener('pointerlockchange', acquired)
      doc.addEventListener('pointerlockerror', rejected)
      lateRequests.set(doc, request)
      request.lateTimer = setTimeout(detach, LATE_EVENT_WINDOW)
      if (this._request === request && this.active) this._cancel('timeout')
      else this._report(request, 'timeout', 'cancelled')
    }, REQUEST_TIMEOUT)
    try {
      const result = this.dom.requestPointerLock()
      result?.then?.(acquired, rejected)
    } catch (error) { rejected(error); return false }
    return this.active
  }

  _bound(value, size) {
    return this.clampCursor ? Math.max(0, Math.min(size, value)) : wrap(value, size)
  }

  _pointerLockChanged() {
    const request = ownedLocks.get(this.doc)
    if (request?.owner === this && this.doc.pointerLockElement !== this.dom) {
      ownedLocks.delete(this.doc)
      clearTimeout(request.releaseTimer)
    }
    if (!this.active) return
    if (this.doc.pointerLockElement === this.dom && ownedLocks.get(this.doc) === this._request) {
      this.locked = true
      this.dom.style.cursor = 'none'
      this._showCursor()
    } else if (this.locked) this._cancel('lock-lost')
  }

  _showCursor() {
    if (!this.active || !this.locked) return
    const a = this.dom.getBoundingClientRect(), b = this.cursor.parentElement?.getBoundingClientRect()
    if (!b) return
    this.cursor.style.left = `${a.left - b.left + this.visual.x}px`
    this.cursor.style.top = `${a.top - b.top + this.visual.y}px`
    this.cursor.style.display = 'block'
  }

  _pointerMove(e) {
    if (!this.active) return
    if (this.dom.ownerDocument !== this.doc || this.dom.isConnected === false) { this._cancel('viewport-detached'); return }
    if (this.locked && this.doc.pointerLockElement !== this.dom) { this._cancel('lock-lost'); return }
    if (!this.locked) {
      // Si el navegador aún procesa la solicitud, la captura arranca en el cursor actual.
      const r = this.dom.getBoundingClientRect()
      if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return
      this.acc.x = e.clientX - r.left; this.acc.y = e.clientY - r.top
      this.visual.x = this._bound(this.acc.x, r.width); this.visual.y = this._bound(this.acc.y, r.height)
      return
    }
    e.preventDefault?.()
    e.stopImmediatePropagation?.()
    const dx = Number.isFinite(e.movementX) ? e.movementX : 0
    const dy = Number.isFinite(e.movementY) ? e.movementY : 0
    const r = this.dom.getBoundingClientRect()
    this.acc.x += dx; this.acc.y += dy
    this.visual.x = this._bound(this.visual.x + dx, r.width)
    this.visual.y = this._bound(this.visual.y + dy, r.height)
    this._showCursor()
    try {
      this.onMove?.({
        x: this.acc.x, y: this.acc.y, width: r.width, height: r.height,
        screen: { ...this.visual },
      }, e)
    } catch (error) {
      this._cancel('move-error', error)
      throw error
    }
  }

  cancel(reason = 'cancelled') {
    if (this.active) this._cancel(reason)
    else if (this.releasing) this._releaseLock()
  }

  _cancel(reason, error = null) {
    if (!this.active) return
    const cb = this.onCancel, request = this._request
    const previous = this.locked ? 'locked' : 'pending'
    this.end()
    try { cb?.(reason) }
    finally { this._report(request, reason, previous, error) }
  }

  end() {
    if (!this.active) return
    this.active = false
    this.locked = false
    this.onMove = null
    this.onCancel = null
    this.cursor.style.display = 'none'
    this.dom.style.cursor = this.previousCursor || ''
    this._releaseLock()
  }

  dispose() {
    this.disposed = true
    this.cancel('dispose')
    this.dom.removeEventListener('pointermove', this._moving, true)
    this._detachDocument()
    this.dom.removeEventListener('pointercancel', this._pointerCancelled, true)
    this.cursor.remove()
  }
}
