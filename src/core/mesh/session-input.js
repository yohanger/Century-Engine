// Edición de malla · ratón y teclado: eventos del lienzo y atajos. Mixin de `EditSession` (session.js).
import { ekeyA, ekeyB } from '../../engine/runtime/mesh/polymesh.js'
import { linked } from './sel.js'
import { store } from '../store.js'
import { win } from '../../engine/runtime/platform.js'

export const inputMethods = {
  toggleGlobalShortcuts() {
    store.edit.globalShortcuts = !store.edit.globalShortcuts
    if (!store.edit.globalShortcuts) this.focusModalInspector({ focusField: false })
  },

  setSnapShiftHeld(held) {
    this._shiftSnapHeld = held
    if (this.modal) this.modal.shift = held
  },
  // ------------------------------------------------------------------ eventos
  _bind() {
    this._h = {
      down: (e) => this._onDown(e),
      move: (e) => this._onMove(e),
      up: (e) => this._onUp(e),
      cancel: () => { if (this.paintStroke) this._cancelPaintStroke(); if (this.down) this._cancelBox(); if (this.modal) this.modalCancel(); if (this.numericDraft) this.numericCancel() },
      wheel: (e) => this._onWheel(e),
      ctx: (e) => { if (this.modal) { e.preventDefault(); e.stopImmediatePropagation() } },
    }
    this.dom.addEventListener('pointerdown', this._h.down, true)
    win.addEventListener('pointermove', this._h.move)
    win.addEventListener('pointerup', this._h.up)
    win.addEventListener('pointercancel', this._h.cancel)
    win.addEventListener('blur', this._h.cancel)
    this.dom.addEventListener('wheel', this._h.wheel, { capture: true, passive: false })
    this.dom.addEventListener('contextmenu', this._h.ctx, true)
    this._stops = []
  },

  _unbind() {
    this.dom.removeEventListener('pointerdown', this._h.down, true)
    win.removeEventListener('pointermove', this._h.move)
    win.removeEventListener('pointerup', this._h.up)
    win.removeEventListener('pointercancel', this._h.cancel)
    win.removeEventListener('blur', this._h.cancel)
    this.dom.removeEventListener('wheel', this._h.wheel, true)
    this.dom.removeEventListener('contextmenu', this._h.ctx, true)
  },

  consumeModalPointerDown(e) {
    if (!this.modal || this.vp.isFlying || !this._continuousGrab?.canReceiveModalInput()) return false
    this._onDown(e)
    return true
  },

  _onDown(e) {
    if (!this._continuousGrab?.locked) this.lastClient = { x: e.clientX, y: e.clientY }
    this.vp._lastContinuousNavigationMoved = false
    this.setSnapShiftHeld?.(!!e.shiftKey)
    if (this.vp.isFlying) return
    if (this.modal) {
      e.stopImmediatePropagation(); e.preventDefault()
      if (e.button === 0) {
        if (this._modalTargetsScreen() && !this._continuousGrab?.locked) this.modalMove(e)
        this.modalConfirm()
      } else if (e.button === 2) this.modalCancel()
      return
    }
    if (store.edit.paint.active && e.button === 0) { this._startPaintStroke(e); return }
    if (e.button === 2) { this.down = { x: e.clientX, y: e.clientY, right: true }; return }
    if (e.button !== 0) return
    const l = this._clientToLocal(e)
    this.down = { x: e.clientX, y: e.clientY, l, e: { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey || e.metaKey, altKey: e.altKey }, box: false }
    if (this.vp.wantsNav(e) && !e.altKey) this.down = null
  },

  _onMove(e) {
    if (this._continuousGrab?.locked) return
    this.lastClient = { x: e.clientX, y: e.clientY }
    this.setSnapShiftHeld?.(!!e.shiftKey)
    if (this.modal) { this.modalMove(e); return }
    if (this.paintStroke) { this._hideVertexPreview(); if (e.buttons & 1) this._paintDab(e); this._paintCursor(e); return }
    if (store.edit.paint.active) { this._hideVertexPreview(); this._paintCursor(e); return }
    if (store.edit.vertexDraw && this.mode === 'vertex' && !e.altKey && !e.ctrlKey && !e.metaKey && !this.down?.box) {
      const p = this._clientToLocal(e)
      this._previewVertexFromScreen(p.x, p.y)
    } else this._hideVertexPreview()
    const d = this.down
    if (d && !d.right && !d.e.altKey && !this.vp.isNavigating) {
      if (!d.box && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) {
        d.box = true
        if (e.pointerType === 'mouse') {
          this._continuousGrab?.begin(this.lastClient, (point) => {
            d.tip = point.screen
            this._drawRect(d.l, d.tip)
          }, reason => { if (reason !== 'denied') this._cancelBox() }, { clampCursor: true, operation: 'mesh:box', pointerId: e.pointerId })
        }
      }
      if (d.box) {
        d.tip = this._clientToLocal(e)
        this._drawRect(d.l, d.tip)
      }
    }
  },

  _onUp(e) {
    if (this.paintStroke) { this._finishPaintStroke(); return }
    if (this.modal) return
    const d = this.down
    const tip = this._continuousGrab?.locked ? d?.tip : null
    this._cancelBox()
    if (!d || this.vp._lastContinuousNavigationMoved) return
    if (d.right) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5 && !this.vp.isFlying && !this.vp._lastContinuousNavigationMoved) this.contextMenu(e.clientX, e.clientY)
      return
    }
    if (this.vp.isNavigating) return
    const l = tip || this._clientToLocal(e)
    if (d.box) { this._boxSelect({ x0: Math.min(d.l.x, l.x), x1: Math.max(d.l.x, l.x), y0: Math.min(d.l.y, l.y), y1: Math.max(d.l.y, l.y) }, d.e); return }
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return
    if (store.edit.vertexDraw && this.mode === 'vertex' && !d.e.altKey && !d.e.shiftKey && !d.e.ctrlKey) { this._placeVertexFromScreen(d.l.x, d.l.y); return }
    if (d.e.altKey) this._loopSelect(d.l.x, d.l.y, d.e)
    else this._clickSelect(d.l.x, d.l.y, d.e)
  },

  _onWheel(e) {
    const m = this.modal
    if (!m || m.inspecting) return
    if (m.kind === 'loopcut' || m.kind === 'bevel' || m.kind === 'bevelVertex') {
      e.preventDefault(); e.stopImmediatePropagation()
      const dir = e.deltaY < 0 ? 1 : -1
      if (m.kind === 'loopcut' && m.phase === 'select-ring') m.cuts = Math.max(1, Math.min(32, m.cuts + dir))
      else m.segments = Math.max(1, Math.min(32, m.segments + dir))
      this.modalUpdate()
    }
  },

  _cancelBox() {
    if (this.down?.box) this._continuousGrab?.end()
    this.down = null
    this._clearSvg()
  },

  _drawRect(a, b) {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y)
    this.svg.innerHTML = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(255,181,71,.10)" stroke="#ffb547" stroke-dasharray="4 3"/>`
  },

  // ------------------------------------------------------------------ teclado
  /** Reconoce los atajos de malla incluso cuando el foco impide ejecutarlos. */
  onKey(e, execute = true) {
    const act = (fn) => { if (execute) fn(); return true }
    if (this.paintStroke && e.key === 'Escape') return act(() => this._cancelPaintStroke())
    if (this.down?.box && e.key === 'Escape') return act(() => this._cancelBox())
    if (this.modal) return !execute || this.modalKey(e)
    if (e.key === 'Escape' && store.edit.vertexDraw) return act(() => {
      store.edit.vertexDraw = false
      this._hideVertexPreview()
      this.vp.requestRender()
    })
    const mod = e.ctrlKey || e.metaKey
    const k = e.key
    const kl = k.toLowerCase()
    const op = (n, a) => act(() => this.op(n, a))
    if (!mod && !e.altKey && !e.shiftKey) {
      switch (kl) {
        case '1': return act(() => this.setMode('vertex'))
        case '2': return act(() => this.setMode('edge'))
        case '3': return act(() => this.setMode('face'))
        case 'a': return op('selectAll')
        case 'g': return op('grab')
        case 'r': return op('rotate')
        case 's': return op('scale')
        case 'e': return op('extrude')
        case 'i': return op('inset')
        case 'k': return op('knife')
        case 'f': return op('fill')
        case 'm': return act(() => this.mergeMenu())
        case 'x': case 'delete': case 'backspace': return op('deleteMenu')
        case 'y': return op('split')
        case 'v': return op('rip')
        case 'p': return op('separate')
        case 'h': return op('hide')
        case 'l': return act(() => this.hoverLinked())
        case 'o': return op('proportional')
        case '.': case ',': return op('focus')
        case 'b': case 'escape': return kl === 'b'
      }
    }
    if (mod && !e.altKey) {
      switch (kl) {
        case 'b': return op(e.shiftKey ? 'bevelVertex' : 'bevel')
        case 'r': return op('loopcut')
        case 'i': return op('invert')
        case 'l': return op('linked')
        case 'x': return op('dissolve')
        case 't': return op('triangulate')
        case '+': case '=': return op('more')
        case '-': return op('less')
      }
    }
    if (e.shiftKey && !mod && !e.altKey) {
      switch (kl) {
        case 'd': return op('duplicate')
        case 'h': return op('hideOthers')
        case 'n': return op('recalc')
      }
    }
    if (e.altKey && !mod) {
      switch (kl) {
        case 'a': return op('selectNone')
        case 'h': return op('reveal')
        case 'n': return op('flip')
        case 's': return op('shrink')
        case 'z': return op('xray')
        case 'm': return act(() => this.mergeMenu())
      }
    }
    return false
  },

  hoverLinked() {
    const l = this._localFromClient(this.lastClient)
    if (!l) return true
    const hit = this._pick(l.x, l.y)
    if (hit == null) return true
    const seed = new Set()
    if (this.mode === 'vertex') seed.add(hit)
    else if (this.mode === 'edge') { seed.add(ekeyA(hit)); seed.add(ekeyB(hit)) }
    else this.poly.f[hit].forEach((v) => seed.add(v))
    linked(this.poly, this.sel, this.mode, seed)
    this._selChanged()
    return true
  },
}
