// Edición de malla · modales (extruir, mover, escalar, rotar…) con vista previa. Mixin de `EditSession` (session.js).
import { finiteMesh, usableRect } from '../../engine/runtime/numeric-integrity.js'
import * as THREE from 'three'
import { len as vlen } from '../../engine/runtime/mesh/polymesh.js'
import * as O from './ops.js'
import { cutSlideLimit, loopCutLines, validLoopCutRing, loopSlideFromScreen } from './cuts.js'
import { cameraFacingLoopEdge } from './camera-loopcut.js'
import { store, editorSettings, toast, undo } from '../store.js'
import { rayLineParam } from './session-shared.js'
import { snapEnabled, snapStep, snapModalValue } from '../editor/snap.js'
import { findDockPanel, focusDockPanel, restoreDockPanel } from '../editor/docking.js'

const FIELD_LABELS = {
  grab: 'Distancia (m)', rotate: 'Ángulo (°)', scale: 'Factor de escala',
  shrink: 'Distancia normal (m)', vertexSlide: 'Factor de deslizamiento', edgeSlide: 'Factor de deslizamiento',
  extrudeIndividual: 'Distancia de extrusión (m)', spin: 'Ángulo (°)', shear: 'Factor de inclinación',
  inset: 'Grosor (m)', bevel: 'Ancho del bisel (m)', bevelVertex: 'Ancho del bisel (m)',
}
const numberText = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/
const clampSlide = (value, limit) => Math.max(-limit, Math.min(limit, value))

export const modalMethods = {
  // ------------------------------------------------------------------ modales
  startExtrude(solid = false) {
    if (this.modal) return
    let source = null, sourceSel = null
    if (this.obj.type === 'subtract') {
      source = this.poly.clone(); sourceSel = this.sel.clone()
      const err = solid ? O.extrudeSolid(this.poly, this.sel, this.mode) : O.extrude(this.poly, this.sel, this.mode)
      if (typeof err === 'string') { this.poly = source; this.sel = sourceSel; return toast(err, 'error') }
      this.poly.reconcileAttributes(source)
      this.dirty = true
      this.refresh()
    } else {
      const ok = this.run(solid ? 'Extruir sólido' : 'Extruir', (p, s, mo) => solid ? O.extrudeSolid(p, s, mo) : O.extrude(p, s, mo))
      if (!ok) return
    }
    // normal de extrusión en espacio local → eje del arrastre
    const n = this.sel.f.size ? O.extrudeNormal(this.poly, this.sel) : null
    this.startModal('grab', { axisLocalDir: n && vlen(n) > 0 ? n : null, extruded: true, solid,
      ...(source ? { transientSubtract: true, extrudeSource: source, extrudeSel: sourceSel } : {}) })
  },

  startModal(kind, extra = {}) {
    this.numericCancel?.()
    if (this.modal) return
    const P = this.poly, S = this.sel
    if (!S.v.size && kind !== 'loopcut') return toast('Selecciona componentes de la malla', 'info', 1400)
    if (kind === 'inset' && !S.f.size) return toast('Inset trabaja sobre caras (modo cara)', 'info')
    if (['spin', 'extrudeIndividual'].includes(kind) && (this.mode !== 'face' || !S.f.size)) return toast('Selecciona caras para esta operación', 'info')
    if (kind === 'vertexSlide' && this.mode !== 'vertex') return toast('Vertex Slide funciona en modo vértice', 'info')
    if (kind === 'edgeSlide' && this.mode !== 'edge') return toast('Edge Slide funciona en modo arista', 'info')
    if (kind === 'bevel' && !(S.e.size || S.f.size)) return toast('Selecciona aristas para biselar', 'info')
    if (kind === 'bevelVertex' && (this.mode !== 'vertex' || !S.v.size)) return toast('Selecciona vértices en modo vértice', 'info')
    this._prepXform()
    const rect = this.dom.getBoundingClientRect()
    if (!usableRect(rect)) return false
    const last = this._localFromClient(this.lastClient)
    const l = last && last.x >= 1 && last.y >= 1 && last.x < rect.width - 1 && last.y < rect.height - 1
      ? last : { x: rect.width / 2, y: rect.height / 2 }
    const pw = this.pivotWorld()
    const ps = pw ? this._project(pw) : { x: l.x, y: l.y }
    this.modal = {
      shift: !!this._shiftSnapHeld, kind, previewValid: true, previewError: '', base: P.clone(), baseSel: S.clone(), baseV: P.v.map((p) => [...p]), start: l, pivot: pw, pivotScr: ps, axis: null, plane: false, local: false, text: '', cuts: store.edit.loopCuts || 1, segments: store.edit.bevel.segments, clampOverlap: true, sign: 1,
      ...extra,
      ...(kind === 'loopcut' ? { phase: 'select-ring', edge: null, slide: 0, slideStart: null, edgeScreen: null } : {}),
    }
    if (extra.axisLocalDir) { this.modal.axis = 'n' }
    if (kind === 'loopcut') this.preview.visible = true
    this.modalUpdate()
    if (store.edit.globalShortcuts) this._beginModalCapture(l)
  },

  _beginModalCapture(screen) {
    const m = this.modal
    const rect = this.dom.getBoundingClientRect()
    const origin = m.acc || m.start
    m.pointerReturn = m.continuous ? { origin, screen: null } : null
    this._continuousGrab?.begin({ x: rect.left + screen.x, y: rect.top + screen.y }, (point, e) => {
      if (this.modal !== m) return
      m.pointerReturn = null
      m.acc = { x: origin.x + point.x - screen.x, y: origin.y + point.y - screen.y }
      m.screen = point.screen
      m.cur = this._modalTargetsScreen() ? m.screen : m.acc
      m.ctrl = e.ctrlKey || e.metaKey
      this.setSnapShiftHeld?.(!!e.shiftKey)
      m.continuous = true
      this.modalUpdate()
    }, reason => { if (reason !== 'denied') this.modalCancel() }, { operation: `mesh:${m.kind}` })
  },

  focusModalInspector({ focusField = true } = {}) {
    const m = this.modal
    if (!m || (!focusField && m.inspecting)) return
    this._continuousGrab?.end()
    m.inspecting = true
    m.focus = focusField ? (m.focus || 0) + 1 : 0
    const { prefs, ui } = store
    prefs.rightTab = 'mesh'
    if (ui.mode === 'desktop') {
      const panel = findDockPanel(prefs.dockLayout, 'mesh')
      if (panel?.kind === 'dock') {
        if (!panel.active) prefs.dockLayout = focusDockPanel(prefs.dockLayout, 'mesh')
        prefs[panel.zone + 'Open'] = true
      } else if (panel?.kind === 'hidden') {
        prefs.dockLayout = restoreDockPanel(prefs.dockLayout, 'mesh')
        prefs.rightOpen = true
      }
    } else ui.drawer = 'inspector'
    this.modalUpdate()
  },

  resumeModalPointer() {
    const m = this.modal
    if (!m) return
    m.inspecting = false
    m.inputInvalid = false
    m.text = ''
    this.modalUpdate()
    if (store.edit.globalShortcuts) this._beginModalCapture(m.screen || m.start)
    else m.pointerReturn = { origin: m.acc || m.start, screen: null }
  },

  editModalValue(text) {
    const m = this.modal
    if (!m?.inspecting || !store.edit.modalControl?.label) return
    const draft = text.trim(), value = Number(draft.replace(',', '.'))
    const cuts = m.kind === 'loopcut' && m.phase === 'select-ring'
    const valid = numberText.test(draft) && Number.isFinite(value) &&
      (!cuts || Number.isInteger(value) && value >= 1 && value <= 32) &&
      (m.kind !== 'loopcut' || cuts || Math.abs(value) <= 1)
    m.inputInvalid = !valid
    if (valid) {
      if (cuts) m.cuts = value
      else m.text = draft.replace(',', '.')
    }
    this.modalUpdate()
  },

  setModalBevelSegments(segments) {
    const m = this.modal
    if (!m?.inspecting || !Number.isInteger(segments) || (m.kind !== 'bevel' && m.kind !== 'bevelVertex')) return
    m.segments = Math.max(1, Math.min(32, Math.round(segments)))
    this.modalUpdate()
  },

  _modalTargetsScreen() {
    const m = this.modal
    return m?.kind === 'knife' || (m?.kind === 'loopcut' && m.phase === 'select-ring')
  },

  _localFromClient(c) {
    if (!c) return null
    const r = this.dom.getBoundingClientRect()
    return { x: c.x - r.left, y: c.y - r.top }
  },

  modalMove(e) {
    const m = this.modal
    if (!m || m.inspecting || this._continuousGrab?.locked) return
    const { left, top, width, height } = this.dom.getBoundingClientRect()
    const x = e.clientX - left, y = e.clientY - top
    if (x < 0 || y < 0 || x >= width || y >= height) return
    m.screen = { x, y }
    const anchor = m.pointerReturn
    if (anchor) {
      anchor.screen ||= m.screen
      m.acc = { x: anchor.origin.x + x - anchor.screen.x, y: anchor.origin.y + y - anchor.screen.y }
    } else m.acc = m.screen
    m.cur = this._modalTargetsScreen() ? m.screen : m.acc
    m.ctrl = e.ctrlKey || e.metaKey
    m.shift = !!e.shiftKey
    this.modalUpdate()
  },

  _axisVec(m) {
    // devuelve el eje de restricción en espacio mundo (o null)
    if (!m.axis) return null
    if (m.axis === 'n') return new THREE.Vector3(...m.axisLocalDir).transformDirection(this.visual.matrixWorld).normalize()
    const base = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) }[m.axis].clone()
    if (m.local) base.applyQuaternion(this.visual.getWorldQuaternion(new THREE.Quaternion()))
    return base
  },

  /** Recalcula la vista previa según el ratón / el valor escrito. */
  modalUpdate() {
    const m = this.modal
    if (!m) return
    if (!usableRect(this.dom.getBoundingClientRect())) { m.previewValid = false; m.previewError = "Viewport sin superficie"; if (store.edit.modalControl) store.edit.modalControl.canConfirm = false; return }
    const P = this.poly
    const cur = m.cur || m.start
    const num = m.text !== '' && m.text !== '-' ? parseFloat(m.text) : null
    if (num !== null && !Number.isFinite(num)) { m.previewValid = false; m.previewError = "Valor numérico fuera de rango"; if (store.edit.modalControl) store.edit.modalControl.canConfirm = false; return }
    const settings = editorSettings()
    const grid = snapStep(settings, 'translate')
    const useSnap = (mode) => !m.shift && (m.ctrl || snapEnabled(settings, mode))
    let hud = ''
    let value = null
    const snapAmount = (raw, mode, step = snapStep(settings, mode)) =>
      snapModalValue(m, m.kind, raw, step, useSnap(mode))
    const restore = () => { P.v = m.baseV.map((p) => [...p]); }
    this._invalidXform = false
    if (["grab", "rotate", "scale", "shrink"].includes(m.kind)) m.previewValid = true
    switch (m.kind) {
      case 'grab': {
        restore(); this.xf.base = m.baseV
        const pivot = m.pivot
        const ray0 = this._ray(m.start.x, m.start.y), ray1 = this._ray(cur.x, cur.y)
        if (!ray0 || !ray1) { m.previewValid = false; m.previewError = "Rayo de edición inválido"; break }
        const cam = this.vp.camera
        const axis = this._axisVec(m)
        let d = new THREE.Vector3()
        if (axis && !m.plane) {
          if (num != null) d.copy(axis).multiplyScalar(num)
          else {
            const t0 = rayLineParam(ray0, pivot, axis), t1 = rayLineParam(ray1, pivot, axis)
            const t = snapModalValue(m, `grab:${m.axis}:${m.local}`, t1 - t0, grid, useSnap('translate'))
            d.copy(axis).multiplyScalar(t)
          }
        } else {
          const normal = m.axis && m.plane ? this._axisVec(m) : cam.getWorldDirection(new THREE.Vector3())
          const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, pivot)
          const p0 = new THREE.Vector3(), p1 = new THREE.Vector3()
          if (ray0.intersectPlane(plane, p0) && ray1.intersectPlane(plane, p1)) d.copy(p1).sub(p0)
          if (num != null) { const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0); d.copy(right).multiplyScalar(num) }
          if (num == null) {
            const v = snapModalValue(m, `grab:${m.axis}:${m.plane}`, d.toArray(), grid, useSnap('translate'))
            d.fromArray(v)
          }
        }
        value = axis && !m.plane ? d.dot(axis) : d.dot(new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0))
        this._xform({ t: d }, pivot)
        hud = `Mover${m.axis ? ' ' + (m.axis === 'n' ? 'normal' : (m.plane ? 'sin ' : '') + m.axis.toUpperCase() + (m.local ? ' local' : '')) : ''}  ·  Δ ${d.x.toFixed(2)}, ${d.y.toFixed(2)}, ${d.z.toFixed(2)}${num != null ? `  [${m.text}]` : ''}`
        m.result = { d }
        break
      }
      case 'rotate': {
        restore(); this.xf.base = m.baseV
        const ps = m.pivotScr
        const a0 = Math.atan2(-(m.start.y - ps.y), m.start.x - ps.x), a1 = Math.atan2(-(cur.y - ps.y), cur.x - ps.x)
        let ang = m.continuous ? (cur.x - m.start.x) * .012 : a1 - a0
        if (num != null) ang = (num * Math.PI) / 180
        else ang = snapModalValue(m, `rotate:${m.axis}:${m.local}`, ang, snapStep(settings, 'rotate') * Math.PI / 180, useSnap('rotate'))
        value = ang * 180 / Math.PI
        const cam = this.vp.camera
        let axis = this._axisVec(m) || cam.getWorldDirection(new THREE.Vector3()).negate()
        if (m.axis) { const toCam = cam.position.clone().sub(m.pivot); if (axis.dot(toCam) < 0) ang = -ang }
        const q = new THREE.Quaternion().setFromAxisAngle(axis.normalize(), ang)
        this._xform({ q }, m.pivot)
        hud = `Rotar${m.axis ? ' ' + m.axis.toUpperCase() : ''}  ·  ${((ang * 180) / Math.PI).toFixed(1)}°${num != null ? `  [${m.text}]` : ''}`
        break
      }
      case 'scale': {
        restore(); this.xf.base = m.baseV
        const ps = m.pivotScr
        const d0 = Math.max(10, Math.hypot(m.start.x - ps.x, m.start.y - ps.y)), d1 = Math.hypot(cur.x - ps.x, cur.y - ps.y)
        let f = d1 / d0
        if (num != null) f = num
        else f = 1 + snapModalValue(m, `scale:${m.axis}:${m.plane}`, f - 1, snapStep(settings, 'scale'), useSnap('scale'))
        value = f
        if (!Number.isFinite(f) || f <= 0 || f > 10000 || m.text === '-') {
          m.previewValid = false
          hud = 'Factor de escala inválido · usa un número positivo · Esc cancelar'
          break
        }
        m.previewValid = true
        const s = new THREE.Vector3(1, 1, 1)
        const axis = m.axis && m.axis !== 'n' ? m.axis : null
        if (!axis) s.set(f, f, f)
        else if (m.plane) { ['x', 'y', 'z'].forEach((a) => { if (a !== axis) s[a] = f }) }
        else s[axis] = f
        const basis = m.axis && m.local ? this.visual.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion()
        this._xform({ s, basis }, m.pivot)
        hud = `Escalar${axis ? ' ' + (m.plane ? 'sin ' : '') + axis.toUpperCase() : ''}  ·  ${f.toFixed(3)}${num != null ? `  [${m.text}]` : ''}`
        break
      }
      case 'shrink': {
        restore()
        const wpp = this._worldPerPx(m.pivot)
        const amt = num ?? snapAmount((cur.x - m.start.x) * wpp, 'translate')
        value = amt
        const vn = m.base.vertexNormals()
        for (const v of this.sel.v) { const n = vn[v]; P.v[v] = [m.baseV[v][0] + n[0] * amt, m.baseV[v][1] + n[1] * amt, m.baseV[v][2] + n[2] * amt] }
        hud = `Encoger / engordar  ·  ${amt.toFixed(3)}${num != null ? `  [${m.text}]` : ''}`
        break
      }
      case 'vertexSlide': case 'edgeSlide': {
        const delta = (cur.x - m.start.x) * 0.005
        const factor = clampSlide(num ?? store.edit.slide.factor + snapAmount(delta, 'scale'), 0.95)
        value = factor
        const op = m.kind === 'vertexSlide' ? O.vertexSlide : O.edgeSlide
        const ok = this._previewOp(() => op(this.poly, this.sel, this.mode,
          { factor, axis: store.edit.slide.axis }))
        m.amount = factor
        hud = ok ? `${m.kind === 'vertexSlide' ? 'Vertex' : 'Edge'} Slide  ·  ${factor.toFixed(3)}  ·  Enter confirmar / Esc cancelar`
          : `${m.kind === 'vertexSlide' ? 'Vertex' : 'Edge'} Slide  ·  ${m.previewError}`
        break
      }
      case 'extrudeIndividual': {
        const wpp = this._worldPerPx(m.pivot)
        const distance = num ?? store.edit.extrudeIndividual.distance + snapAmount((cur.x - m.start.x) * wpp, 'translate')
        value = distance
        const ok = this._previewOp(() => O.extrudeIndividual(this.poly, this.sel, this.mode, { distance }))
        m.amount = distance
        hud = ok ? `Extrusión individual  ·  ${distance.toFixed(3)} m  ·  Enter confirmar / Esc cancelar` : m.previewError
        break
      }
      case 'spin': {
        const angle = num ?? store.edit.spin.angle + snapAmount((cur.x - m.start.x) * 0.5, 'rotate')
        value = angle
        const ok = this._previewOp(() => O.spin(this.poly, this.sel, this.mode,
          { angle, steps: store.edit.spin.steps, axis: store.edit.spin.axis, center: [...store.edit.spin.center] }))
        m.amount = angle
        hud = ok ? `Spin  ·  ${angle.toFixed(1)}°  ·  ${store.edit.spin.steps} pasos  ·  eje ${store.edit.spin.axis.toUpperCase()}` : `Spin  ·  ${m.previewError}`
        break
      }
      case 'shear': {
        const factor = num ?? store.edit.shear.factor + snapAmount((cur.x - m.start.x) * 0.005, 'scale')
        value = factor
        const ok = this._previewOp(() => O.shear(this.poly, this.sel, this.mode,
          { factor, axis: store.edit.shear.axis, reference: store.edit.shear.reference }))
        m.amount = factor
        hud = ok ? `Shear  ·  ${factor.toFixed(3)}  ·  ${store.edit.shear.reference.toUpperCase()} → ${store.edit.shear.axis.toUpperCase()}` : `Shear  ·  ${m.previewError}`
        break
      }
      case 'inset': {
        const wpp = this._worldPerPx(m.pivot)
        const d0 = Math.hypot(m.start.x - m.pivotScr.x, m.start.y - m.pivotScr.y), d1 = Math.hypot(cur.x - m.pivotScr.x, cur.y - m.pivotScr.y)
        const t = num != null ? Math.abs(num) : Math.max(0, snapAmount((d0 - d1) * wpp, 'translate'))
        value = m.thickness = t
        this._previewOp(() => O.inset(this.poly, this.sel, this.mode, { thickness: t, depth: store.edit.inset.depth, individual: !!m.individual }))
        hud = `Inset  ·  grosor ${t.toFixed(3)}  ·  profundidad ${store.edit.inset.depth}${m.individual ? '  ·  individual' : ''}  [I = individual]`
        break
      }
      case 'bevel':
      case 'bevelVertex': {
        const wpp = this._worldPerPx(m.pivot)
        const d0 = Math.hypot(m.start.x - m.pivotScr.x, m.start.y - m.pivotScr.y), d1 = Math.hypot(cur.x - m.pivotScr.x, cur.y - m.pivotScr.y)
        const w = num != null ? Math.abs(num) : Math.max(0.001, snapAmount((d1 - d0) * wpp * 0.5, 'translate'))
        value = m.width = w
        const appliedWidth = m.kind === 'bevel' && m.clampOverlap ? O.bevelClampedWidth(m.base, [...m.baseSel.e], w) : w
        const fn = m.kind === 'bevelVertex' ? O.bevelVertexOp : O.bevelOp
        const ok = this._previewOp(() => fn(this.poly, this.sel, this.mode, { width: w, segments: m.segments, profile: store.edit.bevel.profile ?? 0.5, clampOverlap: m.clampOverlap }))
        hud = ok ? `${m.kind === 'bevelVertex' ? 'Bisel de vértices' : 'Bisel'}  ·  ancho ${appliedWidth.toFixed(3)}${appliedWidth < w - 1e-6 ? ' (limitado)' : ''}  ·  segmentos ${m.segments} (rueda)  ·  Clamp ${m.clampOverlap ? 'ON' : 'OFF'} (C)` : (m.previewError || 'La selección no se puede biselar')
        break
      }
      case 'loopcut': {
        if (m.phase === 'select-ring') {
          const face = typeof this._pickFace === 'function' ? this._pickFace(cur.x, cur.y) : null
          const world = this.visual.matrixWorld
          const k = typeof this._pickFace !== 'function' ? this._pickEdge(cur.x, cur.y, 40) : face == null ? null :
            cameraFacingLoopEdge(m.base, face, cur,
              (point) => this._project(new THREE.Vector3(...point).applyMatrix4(world)), m.cuts)
          m.edge = k
          m.previewValid = m.edge != null
          m.slide = 0
          hud = m.previewValid
            ? `Corte en bucle  ·  ${m.cuts} corte(s) (rueda)  ·  clic: fijar anillo  ·  Esc: cancelar`
            : 'Corte en bucle  ·  apunta la cámara a una cara quad visible  ·  Esc: cancelar'
        } else {
          if (num != null) m.slide = clampSlide(num, 1)
          else if (m.slideStart && m.edgeScreen) {
            const s = loopSlideFromScreen(m.slideStart, cur, m.edgeScreen.a, m.edgeScreen.b, m.cuts)
            const span = m.edgeLength * cutSlideLimit(m.cuts)
            if (s !== null) m.slide = span > 0 ? clampSlide(snapAmount(s, 'translate', grid / span), 1) : s
          }
          m.previewValid = !!validLoopCutRing(m.base, m.edge, m.cuts)
          hud = `Deslizar corte  ·  ${m.cuts} corte(s)  ·  posición ${m.slide.toFixed(2)}  ·  clic/Enter: confirmar  ·  C: centro  ·  Esc: cancelar`
        }
        const lines = m.previewValid ? loopCutLines(m.base, m.edge, m.cuts, m.slide) : []
        this.preview.geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines.flat(2), 3))
        this.preview.visible = lines.length > 0
        break
      }
      case 'knife': {
        if (m.p1) { this._drawLine(m.p1, cur); hud = 'Cuchillo  ·  clic para cortar a lo largo de la línea' }
        else hud = 'Cuchillo  ·  clic en el punto de inicio'
        break
      }
    }
    if (this._invalidXform || !finiteMesh(this.poly)) {
      this.poly = m.base.clone(); this.sel = m.baseSel.clone()
      m.previewValid = false; m.previewError = `Transformación no finita (${this.objId})`; hud = m.previewError
    }
    store.edit.hud = hud
    const ring = m.kind === 'loopcut' && m.phase === 'select-ring'
    const loop = m.kind === 'loopcut'
    store.edit.modalControl = {
      kind: m.kind,
      label: loop ? (ring ? 'Cantidad de cortes' : 'Posición del corte (−1 a 1)') : FIELD_LABELS[m.kind],
      value: loop ? (ring ? m.cuts : m.slide) : value,
      bevelSegments: m.kind === 'bevel' || m.kind === 'bevelVertex' ? m.segments : null,
      inspecting: !!m.inspecting, focus: m.focus || 0, invalid: !!m.inputInvalid,
      canConfirm: m.previewValid !== false && !m.inputInvalid && (m.kind !== 'knife' || !!m.p1),
      confirmLabel: ring ? 'Fijar anillo' : 'Aplicar',
    }
    if (m.kind !== 'loopcut' && m.kind !== 'knife') { this._liveRefresh() } else this.vp.requestRender()
  },

  _liveRefresh() { this.refresh({ geometry: true }) },

  /** Aplica `fn` sobre una copia limpia de la base para previsualizar. */
  _previewOp(fn) {
    const m = this.modal
    this.poly = m.base.clone()
    this.sel = m.baseSel.clone()
    const err = fn()
    m.previewValid = typeof err !== 'string'
    m.previewError = typeof err === 'string' ? err : ''
    if (!m.previewValid) { this.poly = m.base.clone(); this.sel = m.baseSel.clone(); return false }
    this.poly.reconcileAttributes(m.base)
    if (!finiteMesh(this.poly)) { this.poly = m.base.clone(); this.sel = m.baseSel.clone(); m.previewValid = false; m.previewError = "Geometría inválida"; return false }
    return true
  },

  modalKey(e) {
    const m = this.modal
    const k = e.key
    if (k === 'Escape') { this.modalCancel(); return true }
    if (k === 'Enter') { if (m.kind !== 'loopcut' || m.phase === 'slide') this.modalConfirm(); return true }
    if (k === ' ' && (m.kind === 'knife')) { this.modalConfirm(); return true }
    if (m.kind === 'loopcut' && k.toLowerCase() === 'c' && m.phase === 'slide') {
      m.text = ''; m.snapGesture = null
      m.slide = 0; m.slideStart = { ...(m.cur || m.start) }; this.modalUpdate(); return true
    }
    if (k === '+' && ['grab', 'rotate', 'scale'].includes(m.kind)) {
      if (m.text.startsWith('-')) m.text = m.text.slice(1)
      this.modalUpdate(); return true
    }
    if (/^[0-9.\-]$/.test(k) && ['grab', 'rotate', 'scale', 'shrink', 'inset', 'bevel', 'bevelVertex', 'vertexSlide', 'edgeSlide', 'extrudeIndividual', 'spin', 'shear'].includes(m.kind)) {
      if (k === '-' && m.text === '') m.text = '-'
      else if (k === '-') m.text = m.text.startsWith('-') ? m.text.slice(1) : '-' + m.text
      else m.text += k
      this.modalUpdate(); return true
    }
    if (k === 'Backspace' && m.text) { m.text = m.text.slice(0, -1); this.modalUpdate(); return true }
    const ax = k.toLowerCase()
    if (['x', 'y', 'z'].includes(ax) && ['grab', 'rotate', 'scale'].includes(m.kind)) {
      if (e.shiftKey) { m.axis = ax; m.plane = true }
      else if (m.axis === ax && !m.plane) m.local = !m.local
      else { m.axis = ax; m.plane = false; m.local = false }
      m.snapGesture = null
      this.modalUpdate(); return true
    }
    if (ax === 'c' && m.kind === 'bevel') { m.clampOverlap = !m.clampOverlap; this.modalUpdate(); return true }
    if (ax === 'i' && m.kind === 'inset') { m.individual = !m.individual; this.modalUpdate(); return true }
    if ((k === 'PageUp' || k === '+') && (['bevel', 'bevelVertex'].includes(m.kind))) { m.segments = Math.min(32, m.segments + 1); this.modalUpdate(); return true }
    if ((k === 'PageDown' || k === '-') && (['bevel', 'bevelVertex'].includes(m.kind))) { m.segments = Math.max(1, m.segments - 1); this.modalUpdate(); return true }
    if (ax === 'o') { store.edit.proportional = !store.edit.proportional; this._prepXform(); this.modalUpdate(); return true }
    if (k === 'PageUp' && store.edit.proportional) { store.edit.propSize *= 1.15; this._prepXform(); this.modalUpdate(); return true }
    if (k === 'PageDown' && store.edit.proportional) { store.edit.propSize /= 1.15; this._prepXform(); this.modalUpdate(); return true }
    return true // en modo modal se consumen todas las teclas
  },

  modalConfirm() {
    const m = this.modal
    if (!m || m.inputInvalid) return
    if (m.kind === 'loopcut') {
      if (!m.previewValid || m.edge == null || !validLoopCutRing(m.base, m.edge, m.cuts)) {
        return toast('Selecciona una arista de quads válida para cortar', 'info', 1400)
      }
      if (m.phase === 'select-ring') {
        // Primer clic: fijar anillo, todavía sin modificar PolyMesh ni Undo.
        const e = m.base.edges().get(m.edge)
        const projected = this._screenVerts()
        const a = projected[e.a], b = projected[e.b]
        if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) < 8) {
          return toast('La arista está demasiado de frente; cambia el ángulo de cámara', 'info', 1900)
        }
        m.phase = 'slide'
        m.text = ''
        // El anillo se eligió con el cursor dentro del visor. El deslizamiento
        // parte de la posición acumulada para conservar el delta al cruzar un borde.
        m.cur = m.acc || m.cur || m.start
        m.slideStart = { ...m.cur }
        m.edgeScreen = { a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } }
        const toWorld = (i) => new THREE.Vector3(...m.base.v[i]).applyMatrix4(this.visual.matrixWorld)
        m.edgeLength = toWorld(e.a).distanceTo(toWorld(e.b))
        m.slide = 0
        this.modalUpdate()
        return
      }
      const { edge: key, cuts, slide } = m
      this._continuousGrab?.end()
      this.modal = null
      this.preview.visible = false
      store.edit.hud = ''; store.edit.modalControl = null
      this.poly = m.base; this.sel = m.baseSel
      store.edit.loopCuts = cuts
      store.edit.loopSlide = slide
      this.run('Corte en bucle', (p, s, mo) => O.loopCutOp(p, s, mo, { key, cuts, slide }))
      return
    }
    if (m.kind === 'knife') {
      if (!m.p1) { m.p1 = { ...(m.cur || m.start) }; this.modalUpdate(); return }
      const p1 = m.p1, p2 = m.cur || m.start
      if (Math.hypot(p1.x - p2.x, p1.y - p2.y) < 4) return
      this._clearSvg()
      this._continuousGrab?.end()
      this.modal = null; store.edit.hud = ''; store.edit.modalControl = null
      this.poly = m.base; this.sel = m.baseSel
      const cam = this.vp.camera
      const r1 = this._ray(p1.x, p1.y), r2 = this._ray(p2.x, p2.y)
      if (!r1 || !r2) { this.refresh(); return toast("Rayo de corte inválido", "error") }
      const nW = new THREE.Vector3().crossVectors(r1.direction, r2.direction).normalize()
      const Mi = this.visual.matrixWorld.clone().invert()
      const origin = r1.origin.clone().applyMatrix4(Mi)
      const nL = nW.clone().transformDirection(new THREE.Matrix4().copy(this.visual.matrixWorld).transpose()).normalize()
      // transformDirection normaliza; usamos la traspuesta de la matriz mundo (normal de plano)
      const faces = [...O.knifeTargetFaces(this.poly, this.sel, this.mode)]
      this.run('Cuchillo', (p, s, mo) => O.knifeOp(p, s, mo, { point: [origin.x, origin.y, origin.z], normal: [nL.x, nL.y, nL.z], faces }))
      return
    }
    if (m.previewValid === false) return toast(m.previewError || 'La operación no es válida', 'error')
    if (m.solid) {
      const n = m.axisLocalDir || [0, 0, 1]
      const moved = m.result?.d
      if (!moved || !Number.isFinite(moved.length()) || moved.length() < 1e-5) return toast('El sólido necesita una extrusión con altura distinta de cero', 'error')
      const worldNormal = new THREE.Vector3(...n).transformDirection(this.visual.matrixWorld)
      if (moved.dot(worldNormal) <= 1e-5) return toast('Extruye hacia la normal; invierte la cara antes si necesitas el sentido contrario', 'error')
    }
    const label = { grab: 'Mover', rotate: 'Rotar', scale: 'Escalar', shrink: 'Encoger / engordar', inset: 'Inset', bevel: 'Bisel', bevelVertex: 'Bisel de vértices',
      vertexSlide: 'Vertex Slide', edgeSlide: 'Edge Slide', extrudeIndividual: 'Extrusión individual', spin: 'Spin', shear: 'Shear' }[m.kind] || 'Editar malla'
    if (m.kind === 'spin') store.edit.spin.angle = +m.amount.toFixed(4)
    if (m.kind === 'shear') store.edit.shear.factor = +m.amount.toFixed(4)
    if (m.kind === 'extrudeIndividual') store.edit.extrudeIndividual.distance = +m.amount.toFixed(4)
    if (['vertexSlide', 'edgeSlide'].includes(m.kind)) store.edit.slide.factor = +m.amount.toFixed(4)
    if (m.kind === 'inset') store.edit.inset.thickness = +(m.thickness || store.edit.inset.thickness).toFixed(4)
    if (['bevel', 'bevelVertex'].includes(m.kind)) { store.edit.bevel.width = +(m.width || store.edit.bevel.width).toFixed(4); store.edit.bevel.segments = m.segments }
    this.last = { label, base: m.base, baseSel: m.baseSel }
    this._continuousGrab?.end()
    this.modal = null
    store.edit.hud = ''; store.edit.modalControl = null
    this.dirty = true
    this.commit(label + (m.extruded ? ' (extruir)' : ''))
    this.refresh()
  },

  modalCancel() {
    const m = this.modal
    if (!m) return
    this._continuousGrab?.end()
    this.modal = null
    this._clearSvg()
    this.preview.visible = false
    store.edit.hud = ''; store.edit.modalControl = null
    if (m.transientSubtract) {
      this.poly = m.extrudeSource
      this.sel = m.extrudeSel
    } else {
      this.poly = m.base
      this.sel = m.baseSel
    }
    // si venía de una extrusión o duplicado, hay que deshacer la operación que la creó
    this.refresh()
    if (m.extruded) { this.dirty = false; if (!m.transientSubtract) undo() }
  },
}
