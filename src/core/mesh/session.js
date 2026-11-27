// Sesión de edición de malla en el visor (three.js): resaltado, selección, transformaciones modales y operaciones.
import { finiteMesh } from '../../engine/runtime/numeric-integrity.js'
import { C_EDGE, C_SEL, C_VERT, MODES, overlayMats } from './session-shared.js'
import * as THREE from 'three'
import { PolyMesh, meshGeometrySignature, ekey, triangulateFace, norm as vnorm, add as vadd, sub as vsub, mul as vmul, len as vlen, dist as vdist, cross as vcross, dot as vdot } from '../../engine/runtime/mesh/polymesh.js'
import { Sel, normalize, selectAll, invert, grow, shrink, linked, edgeLoop } from './sel.js'
import * as O from './ops.js'
import * as UV from './uv.js'
import { meshPaintConfig, ensurePaintWeights, removePaintLayer, swapPaintLayers, BASE_PAINT_LAYER, NEW_PAINT_LAYER } from '../../engine/runtime/mesh/vertex-paint.js'
import { normalizeLayers, MAX_LAYERS } from '../../engine/runtime/geometry/terrain-splat.js'
import { paintInputMethods } from './session-paint.js'
import { ringOf } from './cuts.js'
import { meshDataOf, writeMesh, meshConsumers } from '../../engine/runtime/mesh/shared-mesh.js'
import { polyBuffers } from '../../engine/runtime/mesh/buffers.js'
import { make, makeParametric, GENERATOR_FIELDS } from '../../engine/runtime/mesh/generators.js'
import { validateSubtractPoly } from '../../engine/runtime/mesh/subtract-edit.js'
import { store, editorSettings, toast, commit, getObject, addObject, updateObject } from '../store.js'
import { askConfirm } from '../dialogs.js'
import { makeSvg } from '../../engine/runtime/platform.js'
import { pickMethods } from './session-pick.js'
import { inputMethods } from './session-input.js'
import { modalMethods } from './session-modal.js'
import { xformMethods } from './session-xform.js'
import { ContinuousGrab } from '../editor/continuous-grab.js'

export class EditSession {
  constructor(ed, obj, snap = null) {
    this.ed = ed
    this.vp = ed.vp
    this.dom = ed.dom
    this.objId = obj.id
    this.obj = obj
    this.node = ed.nodes.get(obj.id)
    this.visual = this.node.userData.visual
    this.body = this.node.userData.meshBody
    this.node.userData.liveEdit = true
    this.poly = PolyMesh.fromJSON(meshDataOf(obj, store.project.meshes))
    this.sel = new Sel()
    this.modal = null
    this.paintStroke = null
    this.down = null
    this.last = null
    this.rc = new THREE.Raycaster()
    this.dirty = false
    this.mode = snap?.mode || store.edit.mode || 'vertex'
    store.edit.vertexDraw = false
    store.edit.mode = this.mode
    store.edit.on = true
    store.edit.id = obj.id

    this._buildOverlay()
    this._continuousGrab = new ContinuousGrab(this.dom, { owner: 'Edit Mesh', canOwnLock: () => !this.ed.player?.on && !store.gameView.on })
    this._shiftSnapHeld = false
    this._bind()
    if (snap?.sel) this.sel = Sel.from(snap.sel)
    else if (obj.kind === 'vertex' && this.poly.v.length === 1 && this.poly.f.length === 0) { this.mode = 'vertex'; store.edit.mode = 'vertex'; this.sel.v.add(0) }
    normalize(this.poly, this.sel, this.mode)
    this._applyXray()
    this.refresh()
  }

  generatorState() {
    const source = this.poly.generator
    const fields = GENERATOR_FIELDS[source?.kind]
    if (!fields || !source?.signature || !source.params || fields.some(({ key, min, max }) => !Number.isInteger(source.params[key]) || source.params[key] < min || source.params[key] > max)) return null
    return {
      kind: source.kind, params: { ...source.params }, fields,
      modified: meshGeometrySignature(this.poly) !== source.signature,
    }
  }

  async changeGeneratorCount(key, value) {
    if (this.modal || this.paintStroke || store.edit.hud || store.edit.paint.active || this.dirty) return false
    const state = this.generatorState()
    const field = state?.fields.find((item) => item.key === key)
    const n = Number(value)
    if (!field || !Number.isInteger(n) || n < field.min || n > field.max) return false
    if (state.params[key] === n) return true
    if (this._generatorChanging) return false
    this._generatorChanging = true
    try {
      const original = meshGeometrySignature(this.poly)
      const consumers = this.obj.props?.meshRef ? meshConsumers(store.project, this.obj.props.meshRef).length : 1
      if (state.modified || consumers > 1) {
        const reason = [
          state.modified ? 'La malla tiene ediciones manuales, UV o pintura que se perderán al regenerar su geometría.' : '',
          consumers > 1 ? `Este recurso está vinculado a ${consumers} objetos; cambiarán todos.` : '',
        ].filter(Boolean).join('\n')
        if (!await askConfirm(`${reason}\nPuedes deshacer la operación con Ctrl+Z. ¿Continuar?`, { title: 'Cambiar resolución de primitiva', ok: 'Regenerar', danger: state.modified })) return false
      }
      if (store.editor?.edit !== this || meshGeometrySignature(this.poly) !== original || this.modal || this.paintStroke) return false
      const updated = makeParametric(state.kind, { ...state.params, [key]: n })
      if (!updated) return false
      updated.smooth = this.poly.smooth
      const previous = this.poly, previousSelection = this.sel.clone()
      this.poly = updated
      this.sel.clear()
      this.dirty = true
      const ok = this.commit('Cambiar resolución de primitiva')
      if (!ok) { this.poly = previous; this.sel = previousSelection; this.dirty = false }
      this.refresh()
      return ok
    } finally {
      this._generatorChanging = false
    }
  }

  async reduceFaceCount(target) {
    const count = Number(target)
    if (this.modal || this.paintStroke || this.dirty || this._generatorChanging || !Number.isInteger(count) || count < 1 || count >= this.poly.f.length) return false
    const initial = meshGeometrySignature(this.poly)
    const consumers = this.obj.props?.meshRef ? meshConsumers(store.project, this.obj.props.meshRef).length : 1
    const shared = consumers > 1 ? ` Este recurso está vinculado a ${consumers} objetos.` : ''
    if (!await askConfirm(`La reducción cambia la topología y puede alterar la silueta, las UV y la pintura.${shared} Puedes deshacer con Ctrl+Z. ¿Continuar?`, { title: 'Reducir polígonos', ok: 'Reducir', danger: true })) return false
    if (store.editor?.edit !== this || meshGeometrySignature(this.poly) !== initial || this.modal || this.paintStroke) return false
    const ok = this.run('Reducir polígonos', (p, s, mo) => O.reduceFaces(p, s, mo, count))
    if (ok && this.poly.f.length > count) toast(`Reducción parcial: ${this.poly.f.length} caras. No se encontraron más aristas compatibles.`, 'info')
    return ok
  }

  inspectCleanup(tolerance = 0.0001) {
    return O.inspectMeshCleanup(this.poly, Number(tolerance))
  }

  async cleanTopology(options = {}) {
    if (this.modal || this.paintStroke || store.edit.hud || store.edit.paint.active || this.dirty || this._cleaningMesh) return false
    const settings = {
      removeLooseEdges: options.removeLooseEdges ?? true,
      removeLooseVertices: options.removeLooseVertices ?? true,
      removeDuplicateWires: options.removeDuplicateWires ?? true,
      weldVertices: options.weldVertices ?? false,
      tolerance: Number(options.tolerance ?? 0.0001),
    }
    if (settings.weldVertices && this.poly.v.length > 4096) { toast('La unión por distancia admite hasta 4096 vértices por operación', 'info'); return false }
    const report = this.inspectCleanup(settings.tolerance)
    if (!report) { toast('La tolerancia debe estar entre 0 y 0.01 metros', 'error'); return false }
    const available = (settings.removeLooseEdges && (report.wireEdges || report.invalidWires)) ||
      (settings.removeDuplicateWires && (report.duplicateWires || report.invalidWires || report.redundantWires)) ||
      (settings.removeLooseVertices && report.looseVertices) ||
      (settings.weldVertices && report.closePairs)
    if (!available) { toast('No hay residuos del tipo seleccionado', 'info'); return false }
    this._cleaningMesh = true
    try {
      const signature = meshGeometrySignature(this.poly)
      const consumers = this.obj.props?.meshRef ? meshConsumers(store.project, this.obj.props.meshRef).length : 1
      const linked = consumers > 1 ? ` El recurso está compartido por ${consumers} objetos.` : ''
      const weld = settings.weldVertices ? ' También se intentará unir vértices próximos, sin eliminar caras válidas.' : ''
      const message = `Limpiar esta malla puede eliminar aristas sueltas, duplicadas y vértices aislados seleccionados en las opciones.${weld}${linked} Los datos que no puedan conservarse impedirán la operación. ¿Continuar?`
      if (!await askConfirm(message, { title: 'Limpiar geometría', ok: 'Limpiar', danger: true })) return false
      if (store.editor?.edit !== this || meshGeometrySignature(this.poly) !== signature || this.modal || this.paintStroke) return false
      let result = null
      const success = this.run('Limpiar geometría', (poly, sel, mode) => {
        result = O.cleanMeshTopology(poly, sel, mode, settings)
        return typeof result === 'string' ? result : undefined
      }, { reconcile: false })
      if (success && result) toast(`Limpieza: ${result.wiresRemoved} aristas, ${result.vertsRemoved} vértices aislados, ${result.welded} vértices unidos`, 'ok')
      return success
    } finally { this._cleaningMesh = false }
  }

  // ------------------------------------------------------------------ overlay
  _buildOverlay() {
    this.g = new THREE.Group()
    this.g.renderOrder = 10
    this.visual.add(this.g)
    const M = overlayMats()
    const mk = (obj) => { obj.frustumCulled = false; obj.renderOrder = 10; this.g.add(obj); return obj }
    this.lines = mk(new THREE.LineSegments(new THREE.BufferGeometry(), M.lines))
    this.points = mk(new THREE.Points(new THREE.BufferGeometry(), M.points))
    this.fdots = mk(new THREE.Points(new THREE.BufferGeometry(), M.fdots))
    this.fsel = mk(new THREE.Mesh(new THREE.BufferGeometry(), M.fsel))
    this.nlines = mk(new THREE.LineSegments(new THREE.BufferGeometry(), M.nlines))
    this.preview = mk(new THREE.LineSegments(new THREE.BufferGeometry(), M.preview))
    // Segmento hasta el vértice siguiente y cruz de posición: buffer temporal, sin tocar PolyMesh.
    this.preview.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3))
    this.preview.visible = false
    // la malla sólida se acerca un poco hacia atrás para que las líneas no parpadeen
    const mat = this.body.material
    this._matSave = { pof: mat.polygonOffset, pf: mat.polygonOffsetFactor, pu: mat.polygonOffsetUnits, tr: mat.transparent, op: mat.opacity, dw: mat.depthWrite }
    mat.polygonOffset = true; mat.polygonOffsetFactor = 1; mat.polygonOffsetUnits = 1

    // SVG para el rectángulo de selección y la línea del cuchillo
    const parent = this.dom.parentElement
    this.svg = makeSvg('svg')
    this.svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:4')
    parent.appendChild(this.svg)
  }

  // Edit Mesh utiliza G/R/S modales. Los gizmos siguen perteneciendo a Object Mode.
  syncGizmoMode() { this.vp.requestRender() }

  // ------------------------------------------------------------------ modos / estado
  setMode(m) {
    if (!MODES.includes(m) || m === this.mode) return
    this.numericCancel?.()
    const s = this.sel
    this.mode = m
    store.edit.vertexDraw = false
    this._hideVertexPreview()
    store.edit.mode = m
    // la selección se convierte: los conjuntos derivados ya contienen lo equivalente en el modo nuevo
    if (m === 'vertex') { s.e = new Set(); s.f = new Set() } else if (m === 'edge') s.f = new Set()
    normalize(this.poly, s, m)
    this.refresh()
  }

  snapshot() { return { id: this.objId, mode: this.mode, sel: this.sel.toJSON() } }

  /** Tras un deshacer/rehacer: relee la malla del objeto y la selección guardada. */
  reload(snap) {
    this.numericDraft = null
    const o = getObject(this.objId)
    if (!o || (o.type !== 'mesh' && o.type !== 'subtract') || !meshDataOf(o, store.project.meshes)) return false
    this.obj = o
    this.node = this.ed.nodes.get(o.id)
    this.visual = this.node.userData.visual
    this.body = this.node.userData.meshBody
    this.node.userData.liveEdit = true
    if (this.g.parent !== this.visual) this.visual.add(this.g)
    this.poly = PolyMesh.fromJSON(meshDataOf(o, store.project.meshes))
    if (!meshPaintConfig(o.props?.meshPaint)) store.edit.paint.active = false
    this._continuousGrab?.end()
    this.down = null
    this._clearSvg()
    this.modal = null
    store.edit.hud = ''
    store.edit.modalControl = null
    this.paintStroke = null
    this.mode = snap?.mode || this.mode
    store.edit.vertexDraw = false
    this._hideVertexPreview()
    store.edit.mode = this.mode
    this.sel = snap?.sel ? Sel.from(snap.sel) : new Sel()
    normalize(this.poly, this.sel, this.mode)
    this._applyXray()
    this.refresh()
    return true
  }

  commit(label) {
    if (!finiteMesh(this.poly)) {
      this.poly = PolyMesh.fromJSON(meshDataOf(this.obj, store.project.meshes))
      this.sel.clear(); this.dirty = false
      toast(`${label}: geometría inválida (${this.objId}); se restauró la última malla guardada`, "error")
      this.refresh(); return false
    }
    if (this.obj.type === 'subtract') {
      const invalid = validateSubtractPoly(this.poly)
      if (invalid) {
        this.poly = PolyMesh.fromJSON(meshDataOf(this.obj, store.project.meshes))
        this.sel.clear()
        this.dirty = false
        toast(invalid, 'error')
        this.refresh()
        return false
      }
    }
    const data = this.poly.toJSON()
    if (!writeMesh(store.project, this.obj, data)) return false
    this.dirty = false
    this.node.userData.rev = data.rev
    this.ed.syncObject(this.objId)
    if (this.obj.props.meshRef) {
      // Todos los consumidores ven la misma geometría; cada nodo conserva su transform y material.
      for (const c of meshConsumers(store.project, this.obj.props.meshRef)) if (c.id !== this.objId) this.ed.syncObject(c.id)
    }
    if (label === 'Pivote') for (const c of store.project.objects) if (c.parentId === this.objId) this.ed.syncObject(c.id)
    commit(label)
    return true
  }
  flush() {
    if (this.dirty && !this.modal && this.obj.type === 'subtract' && validateSubtractPoly(this.poly)) {
      this.poly = PolyMesh.fromJSON(meshDataOf(this.obj, store.project.meshes))
      this.dirty = false
      toast('Substract: volumen inválido; se restauró la última geometría válida', 'error')
      return
    }
    if (this.dirty && !this.modal) {
      if (!finiteMesh(this.poly)) throw new Error(`No se puede guardar geometría inválida: ${this.objId}`)
      if (writeMesh(store.project, this.obj, this.poly.toJSON())) {
        this.dirty = false
        if (this.obj.props.meshRef) for (const c of meshConsumers(store.project, this.obj.props.meshRef)) if (c.id !== this.objId) this.ed.syncObject(c.id)
      }
    }
  }

  dispose() {
    this.ed.clearMeshLocalView?.()
    this._cancelPaintStroke()
    this._continuousGrab.dispose()
    store.edit.modalControl = null
    store.edit.paint.active = false
    this._unbind()
    this.visual.remove(this.g)
    this.g.traverse((o) => { o.geometry?.dispose() }) // los materiales del overlay son compartidos
    this.svg.remove()
    if (this.body) {
      const m = this.body.material, s = this._matSave
      m.polygonOffset = s.pof; m.polygonOffsetFactor = s.pf; m.polygonOffsetUnits = s.pu; m.transparent = s.tr; m.opacity = s.op; m.depthWrite = s.dw
      m.needsUpdate = true
    }
    this.node.userData.liveEdit = false
    this.node.userData.rev = -1
    store.edit.on = false
    store.edit.vertexDraw = false
    this._hideVertexPreview()
    store.edit.id = null
    store.edit.hud = ''
    this.vp.controls.enabled = true
  }

  _applyXray() {
    const m = this.body.material
    const x = store.edit.xray
    m.transparent = x || this._matSave.tr
    m.opacity = x ? 0.35 : this._matSave.op
    m.depthWrite = x ? false : this._matSave.dw
    m.needsUpdate = true
    for (const o of [this.lines, this.points, this.fdots]) o.material.depthTest = !x
    this.vp.requestRender()
  }

  // ------------------------------------------------------------------ refresco visual
  refresh({ geometry = true } = {}) {
    const P = this.poly, S = this.sel
    if (!finiteMesh(P)) {
      if (!this._numericGeometryError) toast(`Geometría inválida en ${this.objId}; se conserva la última vista válida`, "error")
      this._numericGeometryError = true
      return
    }
    this._numericGeometryError = false
    if (geometry) this._rebuildBody()
    // aristas
    const E = P.edges()
    const lp = [], lc = []
    const sc = C_SEL, ec = C_EDGE
    for (const [k, e] of E) {
      if (P.hidden.has(e.a) || P.hidden.has(e.b)) continue
      const c = S.e.has(k) ? sc : ec
      lp.push(...P.v[e.a], ...P.v[e.b]); lc.push(c.r, c.g, c.b, c.r, c.g, c.b)
    }
    this._setAttr(this.lines.geometry, lp, lc)
    // vértices
    const pp = [], pc = []
    if (this.mode === 'vertex') P.v.forEach((p, i) => { if (P.hidden.has(i)) return; pp.push(...p); const c = S.v.has(i) ? sc : C_VERT; pc.push(c.r, c.g, c.b) })
    else for (const i of S.v) { pp.push(...P.v[i]); pc.push(sc.r, sc.g, sc.b) }
    this._setAttr(this.points.geometry, pp, pc)
    // puntos de cara
    const fp = [], fc = []
    if (this.mode === 'face') P.f.forEach((f, i) => { if (P.faceHidden(i)) return; fp.push(...P.faceCenter(i)); const c = S.f.has(i) ? sc : C_VERT; fc.push(c.r, c.g, c.b) })
    this._setAttr(this.fdots.geometry, fp, fc)
    // caras seleccionadas
    const tp = []
    for (const fi of S.f) for (const t of triangulateFace(P, fi)) for (const v of t) tp.push(...P.v[v])
    this.fsel.geometry.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3))
    this.fsel.geometry.computeBoundingSphere()
    // normales
    const np = []
    if (store.edit.showNormals) { const len = this._normalLen(); P.f.forEach((f, i) => { const c = P.faceCenter(i), n = P.faceNormal(i); np.push(...c, ...vadd(c, vmul(n, len))) }) }
    this.nlines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(np, 3))
    this.nlines.visible = np.length > 0
    this._stats(E)
    this.updateSelectionMatrix()
    this.vp.requestRender()
  }

  _normalLen() { const b = this.poly.bounds(); return Math.max(0.05, vlen(vsub(b.max, b.min)) * 0.06) }
  _setAttr(g, pos, col) {
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.computeBoundingSphere()
  }
  _rebuildBody() {
    if (this.obj.type === 'subtract' && validateSubtractPoly(this.poly)) return
    const previewSignature = this.obj.type === 'subtract' ? meshGeometrySignature(this.poly) : null
    if (previewSignature && this._subtractPreviewSignature === previewSignature &&
      this.node.userData.subtractOwnedGeometry === this.body.geometry) return
    const b = polyBuffers(this.poly, { includeHidden: false, blockout: this.obj.mat?.shader === 'builtin:blockout' && !this.obj.mat?.params?.uAlbedo, scale: this.obj.type === 'subtract' ? [1, 1, 1] : this.obj.scale })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(b.positions, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(b.normals, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(b.uvs, 2))
    if (b.blockUV) {
      g.setAttribute('lfBlockUV', new THREE.BufferAttribute(b.blockUV, 2))
      g.setAttribute('lfBlockSize', new THREE.BufferAttribute(b.blockSize, 2))
    }
    if (b.colors) g.setAttribute('lfColor', new THREE.BufferAttribute(b.colors, 3))
    if (b.weights0) g.setAttribute('lfWeights0', new THREE.BufferAttribute(b.weights0, 4))
    if (b.weights1) g.setAttribute('lfWeights1', new THREE.BufferAttribute(b.weights1, 4))
    if (meshPaintConfig(this.obj.props?.meshPaint)) g.setAttribute('lfPaintUV', new THREE.BufferAttribute(b.uvs, 2))
    g.setIndex(new THREE.BufferAttribute(b.indices, 1))
    g.computeBoundingSphere()
    g.userData.faceOf = b.faceOf
    const oldGeometry = this.obj.type === 'subtract' ? this.node.userData.subtractOwnedGeometry : this.body.geometry
    this.body.geometry = g
    if (this.obj.type === 'subtract') this.node.userData.subtractOwnedGeometry = g
    oldGeometry?.dispose()
    if (this.obj.type === 'subtract' && this.node.userData.edges) {
      const edges = this.node.userData.edges
      edges.geometry.dispose()
      edges.geometry = new THREE.EdgesGeometry(g)
    }
    this.body.material.userData.lfBlockFaces = !!b.blockUV
    const u = this.body.material.userData.rt?.uniforms?.uLfBlockFaces
    if (u) u.value = !!b.blockUV
    if (this.obj.type === 'subtract' && this._subtractPreviewSignature !== previewSignature) {
      this._subtractPreviewSignature = previewSignature
      this.node.userData.subtractPreviewVersion = (this.node.userData.subtractPreviewVersion || 0) + 1
      this.ed?._scheduleBrushes?.(120)
    }
  }
  _stats(E = this.poly.edges()) {
    const P = this.poly, S = this.sel
    store.edit.count = { v: P.v.length, e: E.size, f: P.f.length, sv: S.v.size, se: S.e.size, sf: S.f.size }
  }

  // ------------------------------------------------------------------ cámara / ray / proyección
  _clientToLocal(e) { const r = this.dom.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height } }
  _drawLine(a, b) { this.svg.innerHTML = `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#ffd479" stroke-width="1.5" stroke-dasharray="5 4"/><circle cx="${a.x}" cy="${a.y}" r="3.5" fill="#ffd479"/><circle cx="${b.x}" cy="${b.y}" r="3.5" fill="#ffd479"/>` }
  _clearSvg() { this.svg.innerHTML = '' }

  contextMenu(x, y) { store.editor.openEditContext?.({ x, y }) }

  // ------------------------------------------------------------------ operaciones (no modales)
  /** Ejecuta fn(poly, sel, mode) con deshacer en caso de error y registra el cambio. */
  // ------------------------------------------------------------------ pivote normalizado (origen del objeto)
  /**
   * Posición del origen respecto a los límites de la malla, por eje: -1 = mínimo, 0 = centro, 1 = máximo (puede valer otra cosa
   * si el origen está en otro sitio; null si la malla no tiene grosor en ese eje).
   */
  pivotNormalized() {
    const b = this.poly.bounds()
    if (!Number.isFinite(b.min[0])) return [0, 0, 0]
    return [0, 1, 2].map((k) => { const half = (b.max[k] - b.min[k]) / 2; return half > 1e-9 ? (0 - (b.min[k] + half)) / half : null })
  }
  /**
   * Mueve el ORIGEN del objeto a un punto de los límites de la malla sin mover la malla en el mundo: n = [nx, ny, nz] con -1 · 0 · 1
   * (null = el eje no cambia). Se desplazan los vértices y se compensa la posición del nodo (y la de sus hijos directos).
   */
  setPivot(n) {
    const cur = this.pivotNormalized()
    const want = [0, 1, 2].map((k) => (n[k] == null || !Number.isFinite(+n[k]) ? null : Math.max(-1, Math.min(1, +n[k]))))
    return this.run('Pivote', (P) => {
      const b = P.bounds()
      if (!Number.isFinite(b.min[0])) return 'La malla no tiene vértices'
      const p = [0, 1, 2].map((k) => {
        if (want[k] == null || cur[k] == null) return 0
        const half = (b.max[k] - b.min[k]) / 2
        return b.min[k] + half + want[k] * half
      })
      if (p.every((v) => Math.abs(v) < 1e-9)) return undefined
      for (const v of P.v) { v[0] -= p[0]; v[1] -= p[1]; v[2] -= p[2] }
      const o = this.obj, sc = o.scale || [1, 1, 1]
      const sp = new THREE.Vector3(p[0] * sc[0], p[1] * sc[1], p[2] * sc[2])
      const d = sp.clone().applyEuler(new THREE.Euler(...(o.rotation || [0, 0, 0]).map((r) => r * Math.PI / 180), 'YXZ'))
      o.position = [o.position[0] + d.x, o.position[1] + d.y, o.position[2] + d.z]
      // los hijos directos cuelgan del nodo (no de la malla escalada): se compensan para que no se muevan en el mundo
      for (const c of store.project.objects) if (c.parentId === o.id) c.position = [c.position[0] - sp.x, c.position[1] - sp.y, c.position[2] - sp.z]
      return undefined
    })
  }

  run(label, fn, { keepSel = false, reconcile = true } = {}) {
    const base = this.poly.clone(), bs = this.sel.clone()
    let err
    try { err = fn(this.poly, this.sel, this.mode) } catch (ex) { console.error(ex); err = 'La operación falló: ' + ex.message }
    if (typeof err === 'string') { this.poly = base; this.sel = bs; toast(err, 'error'); this.refresh(); return false }
    if (!finiteMesh(this.poly)) { this.poly = base; this.sel = bs; toast(`${label}: geometría inválida (${this.objId})`, "error"); this.refresh(); return false }
    if (reconcile) this.poly.reconcileAttributes(base)
    else this.poly.validateAttributes()
    if (!finiteMesh(this.poly)) { this.poly = base; this.sel = bs; toast(`${label}: atributos inválidos (${this.objId})`, "error"); this.refresh(); return false }
    if (this.obj.type === 'subtract') {
      const invalid = validateSubtractPoly(this.poly)
      if (invalid) { this.poly = base; this.sel = bs; toast(invalid, 'error'); this.refresh(); return false }
    }
    this.last = { label, base, baseSel: bs }
    this.dirty = true
    this.commit(label)
    this.refresh()
    void keepSel
    return true
  }

  /** Capas y pesos comparten el mismo historial que geometría y UV. */
  paintConfig() { return meshPaintConfig(this.obj.props?.meshPaint) }

  paintEnable() {
    if (this.modal) return false
    if (store.edit.paint.active) { store.edit.paint.active = false; this._clearSvg(); return true }
    if (!this.paintConfig()) {
      this.obj.props.meshPaint = { enabled: true, layers: normalizeLayers([
        BASE_PAINT_LAYER, { ...NEW_PAINT_LAYER, name: 'Capa 2' },
      ]) }
      this.poly.weights = []
      ensurePaintWeights(this.poly)
      this.dirty = true
      this.commit('Activar pintura de malla')
      this.refresh()
    }
    store.edit.paint.layer = Math.min(store.edit.paint.layer, this.paintConfig().layers.length - 1)
    store.edit.paint.active = true
    return true
  }

  paintLayerAction(kind, index, data = {}) {
    if (this.modal || this.paintStroke) return false
    const cfg = this.paintConfig()
    if (!cfg) return false
    const layers = cfg.layers.map((l) => ({ ...l }))
    if (kind === 'add') {
      if (layers.length >= MAX_LAYERS) return false
      layers.push({ ...NEW_PAINT_LAYER, name: `Capa ${layers.length + 1}` })
      store.edit.paint.layer = layers.length - 1
    } else if (kind === 'update') {
      if (!layers[index]) return false
      Object.assign(layers[index], data)
    } else if (kind === 'remove') {
      if (!removePaintLayer(this.poly, index, layers.length)) return false
      layers.splice(index, 1)
      store.edit.paint.layer = Math.min(store.edit.paint.layer, layers.length - 1)
    } else if (kind === 'up' || kind === 'down') {
      const other = index + (kind === 'up' ? -1 : 1)
      if (!swapPaintLayers(this.poly, index, other, layers.length)) return false
      ;[layers[index], layers[other]] = [layers[other], layers[index]]
      store.edit.paint.layer = other
    } else return false
    this.obj.props.meshPaint = { enabled: true, layers: normalizeLayers(layers) }
    this.dirty = true
    this.commit('Editar capas de Vertex Paint')
    this.refresh()
    return true
  }

  /** Acciones UV comparten la misma transacción de Edit Mesh y su Undo/Redo. */
  uvAction(kind, options = {}) {
    const actions = {
      planar: (p, s) => UV.projectPlanar(p, s, options.axis || 'z'),
      box: (p, s) => UV.projectBox(p, s),
      move: (p, s) => UV.transformUV(p, s, { translate: options.translate }),
      rotate: (p, s) => UV.transformUV(p, s, { rotate: options.angle }),
      scale: (p, s) => UV.transformUV(p, s, { scale: [options.factor, options.factor] }),
      seam: (p, s) => UV.setSeams(p, s, true),
      clearSeam: (p, s) => UV.setSeams(p, s, false),
    }
    if (!actions[kind] || this.modal) return false
    return this.run('UV: ' + kind, actions[kind])
  }

  op(name, arg) {
    const P = this.poly, S = this.sel, m = this.mode
    const E = store.edit
    switch (name) {
      case 'selectAll': selectAll(P, S, m); return this._selChanged()
      case 'selectNone': S.clear(); return this._selChanged()
      case 'invert': invert(P, S, m); return this._selChanged()
      case 'linked': linked(P, S, m); return this._selChanged()
      case 'more': grow(P, S, m); return this._selChanged()
      case 'less': shrink(P, S, m); return this._selChanged()
      case 'selectLoop': case 'selectRing': {
        if (m === 'vertex') return toast('Alt+clic sobre una arista selecciona su bucle', 'info')
        const keys = new Set(S.e)
        for (const k of [...keys]) (name === 'selectLoop' ? edgeLoop(P, k) : new Set((ringOf(P, k)?.edges || []).map((q) => q.key))).forEach((q) => S.e.add(q))
        normalize(P, S, m); return this._selChanged()
      }
      case 'extrude': return this.startExtrude()
      case 'extrudeSolid': return this.startExtrude(true)
      case 'extrudeIndividual': return this.startModal('extrudeIndividual')
      case 'vertexSlide': case 'edgeSlide': return this.startModal(name)
      case 'spin': case 'shear': return this.startModal(name)
      case 'inset': return this.startModal('inset')
      case 'bevel': return this.startModal('bevel')
      case 'bevelVertex': return this.startModal('bevelVertex')
      case 'loopcut': return this.startModal('loopcut')
      case 'knife': return this.startModal('knife')
      case 'grab': case 'rotate': case 'scale': case 'shrink': return this.startModal(name)
      case 'closeContour': return this.run('Cerrar contorno', (p, s, mo) => O.closeContour(p, s, mo))
      case 'fill': {
        const ok = this.run('Rellenar', (p, s, mo) => O.fill(p, s, mo))
        if (ok && this.sel.f.size && this.mode !== 'face') this.setMode('face')
        return ok
      }
      case 'bridge': return this.run('Puente', (p, s, mo) => O.bridge(p, s, mo))
      case 'subdivide': return this.run('Subdividir', (p, s, mo) => O.subdivide(p, s, mo, { cuts: E.subdivide.cuts }))
      case 'mergeFaces': return this.run('Fusionar caras', (p, s, mo) => O.mergeFaces(p, s, mo))
      case 'cleanup': return this.cleanTopology(arg || {})
      case 'merge': {
        if (arg === 'collapse') return this.run('Colapsar', (p, s, mo) => O.collapseEdges(p, s, mo))
        if (arg === 'dist') return this.run('Fusionar por distancia', (p, s, mo) => { const n = O.mergeByDistance(p, s, mo, E.mergeDist, s.v.size > 0); if (!n) return 'Ningún vértice para fusionar'; toast(`${n} vértice(s) eliminados`, 'ok') })
        return this.run('Fusionar', (p, s, mo) => O.mergeSelected(p, s, mo, arg || 'center'))
      }
      case 'split': return this.run('Dividir', (p, s, mo) => O.split(p, s, mo))
      case 'rip': return this.run('Abrir', (p, s, mo) => O.rip(p, s, mo))
      case 'duplicate': { if (!this.run('Duplicar geometría', (p, s, mo) => O.duplicate(p, s, mo))) return; return this.startModal('grab', { extruded: true }) }
      case 'deleteMenu': return this.deleteMenu()
      case 'delete': return this.run('Eliminar', (p, s, mo) => O.del(p, s, mo, arg))
      case 'dissolve': return this.run('Disolver', (p, s, mo) => (mo === 'face' ? O.dissolveFaces(p, s, mo) : mo === 'edge' ? O.dissolveEdges(p, s, mo) : O.dissolveVerts(p, s, mo)))
      case 'flip': return this.run('Invertir normales', (p, s, mo) => O.flipNormals(p, s, mo))
      case 'recalc': return this.run('Recalcular normales', (p, s, mo) => O.recalcNormals(p, s, mo, false))
      case 'triangulate': return this.run('Triangular', (p, s, mo) => O.triangulateSel(p, s, mo))
      case 'smooth': case 'flat': P.smooth = name === 'smooth'; this.dirty = true; this.commit(name === 'smooth' ? 'Sombreado suave' : 'Sombreado plano'); return this.refresh()
      case 'hide': return this.run('Ocultar', (p, s, mo) => O.hide(p, s, mo, false))
      case 'hideOthers': return this.run('Ocultar el resto', (p, s, mo) => O.hide(p, s, mo, true))
      case 'reveal': return this.run('Mostrar', (p, s, mo) => O.reveal(p, s, mo))
      case 'separate': return this.separateMenu()
      case 'xray': E.xray = !E.xray; this._applyXray(); return this.refresh({ geometry: false })
      case 'proportional': E.proportional = !E.proportional; return toast(E.proportional ? 'Edición proporcional activada' : 'Edición proporcional desactivada', 'info', 1200)
      case 'mirror': E.mirrorX = !E.mirrorX; return toast(E.mirrorX ? 'Simetría X activada' : 'Simetría X desactivada', 'info', 1200)
      case 'showNormals': E.showNormals = !E.showNormals; return this.refresh({ geometry: false })
      case 'focus': return this.focus()
    }
  }

  focus() {
    const pw = this.pivotWorld()
    if (!pw) return this.ed.focus(this.objId)
    const box = new THREE.Box3()
    for (const v of this.sel.v) box.expandByPoint(new THREE.Vector3(...this.poly.v[v]).applyMatrix4(this.visual.matrixWorld))
    if (box.getSize(new THREE.Vector3()).length() < 0.5) box.expandByVector(new THREE.Vector3(1, 1, 1))
    this.vp.frameBox(box)
  }

  deleteMenu() {
    const at = this.lastClient || { x: 200, y: 200 }
    store.menu = { x: at.x, y: at.y, items: [
      { label: 'Vértices', run: () => this.op('delete', 'verts') }, { label: 'Aristas', run: () => this.op('delete', 'edges') },
      { label: 'Caras', run: () => this.op('delete', 'faces') }, { sep: true },
      { label: 'Solo aristas y caras (conserva vértices)', run: () => this.op('delete', 'onlyfaces') },
    ] }
  }
  separateMenu() {
    const at = this.lastClient || { x: 200, y: 200 }
    store.menu = { x: at.x, y: at.y, items: [
      { label: 'Selección', run: () => this.separate('selection') }, { label: 'Partes sueltas', run: () => this.separate('loose') },
    ] }
  }
  /** Separa caras en objetos nuevos (P). */
  separate(how) {
    const P = this.poly
    let groups
    if (how === 'loose') { groups = O.looseParts(P); if (!groups) return toast('La malla es una sola pieza', 'info'); groups = groups.slice(1) }
    else { if (!this.sel.f.size) return toast('Selecciona caras para separar', 'info'); groups = [[...this.sel.f]] }
    const parts = []
    // las caras se extraen de mayor a menor índice para no invalidar los grupos
    const idx = groups.map((g) => g.map((f) => P.f[f]))
    const base = P.clone()
    for (const faces of groups) {
      const refs = new Set(faces.map((f) => P.f[f]))
      const cur = P.f.map((f, i) => (refs.has(f) ? i : -1)).filter((i) => i >= 0)
      parts.push(O.extractFaces(P, cur))
    }
    void idx; void base
    const src = this.obj
    const parent = src.parentId
    for (const part of parts) {
      const o = addObject({ type: 'mesh', kind: 'cube', name: src.name + ' parte', color: src.color, roughness: src.roughness, metallic: src.metallic, opacity: src.opacity, collision: src.collision, position: [...src.position], rotation: [...src.rotation], scale: [...src.scale], props: { mesh: part.toJSON(), collider: src.props.collider || 'trimesh' } }, { select: false, parentId: parent, label: 'Separar malla' })
      void o
    }
    this.sel.clear()
    this.dirty = true
    this.commit('Separar malla')
    this.refresh()
    toast(`${parts.length} objeto(s) nuevo(s)`, 'ok')
  }

  /** Cambia el plano del trazado, sin modificar geometría ni el proyecto. */
  setVertexPlane(plane) {
    if (!['XZ', 'XY', 'YZ'].includes(plane)) return false
    store.edit.vertexPlane = plane
    this._hideVertexPreview()
    this.vp.requestRender()
    return true
  }

  /** Activa el trazado solo en modo Vértices; selección y gizmos siguen siendo los existentes. */
  toggleVertexDraw() {
    if (this.modal || this.paintStroke) return false
    if (this.mode !== 'vertex') this.setMode('vertex')
    if (store.edit.paint.active) store.edit.paint.active = false
    store.edit.vertexDraw = !store.edit.vertexDraw
    this._hideVertexPreview()
    this.vp.requestRender()
    return store.edit.vertexDraw
  }

  _hideVertexPreview() {
    if (this.preview?.visible) { this.preview.visible = false; this.vp.requestRender() }
  }

  /** Intersección con el plano elegido a través del vértice activo, en espacio global o local. */
  _vertexPlacement(x, y) {
    const from = this.sel.v.size === 1 ? [...this.sel.v][0] : null
    const base = from == null ? [0, 0, 0] : this.poly.v[from]
    if (!base) return null
    this.visual.updateWorldMatrix(true, false)
    const axis = { XZ: 1, XY: 2, YZ: 0 }[store.edit.vertexPlane] ?? 1
    const normal = new THREE.Vector3().setComponent(axis, 1)
    if (store.space === 'local') normal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(this.visual.matrixWorld)).normalize()
    const world = new THREE.Vector3(...base).applyMatrix4(this.visual.matrixWorld)
    const ray = this._ray(x, y), point = new THREE.Vector3()
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, world)
    if (!ray?.intersectPlane(plane, point)) return null
    // Se ajustan únicamente los dos ejes del plano, nunca su profundidad respecto al vértice activo.
    const local = this.visual.worldToLocal(point.clone())
    const settings = editorSettings()
    if (!this._shiftSnapHeld && snapEnabled(settings, 'translate')) {
      const step = snapStep(settings, 'translate')
      if (store.space === 'local') {
        for (let i = 0; i < 3; i++) if (i !== axis) local.setComponent(i, Math.round(local.getComponent(i) / step) * step)
      } else {
        for (let i = 0; i < 3; i++) if (i !== axis) point.setComponent(i, Math.round(point.getComponent(i) / step) * step)
        local.copy(this.visual.worldToLocal(point))
      }
    }
    // La componente perpendicular debe permanecer EXACTAMENTE en el plano elegido.
    if (store.space === 'local') local.setComponent(axis, base[axis])
    else {
      const snappedWorld = local.clone().applyMatrix4(this.visual.matrixWorld)
      snappedWorld.setComponent(axis, world.getComponent(axis))
      local.copy(this.visual.worldToLocal(snappedWorld))
    }
    if (![local.x, local.y, local.z].every(Number.isFinite)) return null
    return { from, local }
  }

  /** Dibuja una línea prospectiva y un marcador en el overlay existente. No registra Undo. */
  _previewVertexFromScreen(x, y) {
    if (!store.edit.vertexDraw || this.mode !== 'vertex' || this.modal || this.paintStroke || this.vp.isNavigating) { this._hideVertexPreview(); return }
    const placement = this._vertexPlacement(x, y)
    if (!placement) { this._hideVertexPreview(); return }
    const to = placement.local
    const base = placement.from == null ? to : new THREE.Vector3(...this.poly.v[placement.from])
    const axis = { XZ: 1, XY: 2, YZ: 0 }[store.edit.vertexPlane] ?? 1
    const axes = [0, 1, 2].filter(i => i !== axis)
    const half = 0.07
    const points = [base, to]
    for (const i of axes) {
      const before = to.clone(), after = to.clone()
      before.setComponent(i, before.getComponent(i) - half)
      after.setComponent(i, after.getComponent(i) + half)
      points.push(before, after)
    }
    const attribute = this.preview.geometry.getAttribute('position')
    points.forEach((p, i) => attribute.setXYZ(i, p.x, p.y, p.z))
    attribute.needsUpdate = true
    this.preview.visible = true
    this.vp.requestRender()
  }

  /** Proyecta el clic con el mismo plano y Snap usados por la previsualización. */
  _placeVertexFromScreen(x, y) {
    const placement = this._vertexPlacement(x, y)
    if (!placement) { toast('El rayo es paralelo al plano: cambia de vista o selecciona otro plano', 'info'); return false }
    const { from, local } = placement
    const result = this.run('Colocar vértice', (p, s, mode) => O.appendVertex(p, s, mode, local.toArray(), from))
    this._hideVertexPreview()
    return result
  }

  /** Enlaza dos puntos ya creados, sin generar una superficie. */
  connectSelectedVertices() {
    if (this.mode !== 'vertex') return toast('Selecciona el modo Vértices', 'info')
    return this.run('Conectar vértices', (p, s, mode) => O.connectVertices(p, s, mode))
  }

  /** Añade una primitiva como geometría dentro de la malla en edición (Shift+A en modo edición). */
  addPrimitive(kind) {
    if (kind === 'vertex') { if (!store.edit.vertexDraw) this.toggleVertexDraw(); return }
    const piece = make(kind)
    // se coloca en el cursor 3D implícito: el centro de la selección o el origen local
    const c = this.pivotLocal() || [0, 0, 0]
    for (const p of piece.v) { p[0] += c[0]; p[1] += c[1]; p[2] += c[2] }
    this.run('Añadir ' + kind, (p, s, mo) => O.addMesh(p, piece, s, mo))
  }

  mergeMenu() {
    const at = this.lastClient || { x: 200, y: 200 }
    store.menu = { x: at.x, y: at.y, items: [
      { label: 'En el centro', run: () => this.op('merge', 'center') }, { label: 'En el primero', run: () => this.op('merge', 'first') },
      { label: 'En el último', run: () => this.op('merge', 'last') }, { label: 'Colapsar', run: () => this.op('merge', 'collapse') },
      { sep: true }, { label: 'Por distancia', run: () => this.op('merge', 'dist') },
    ] }
    return true
  }

  /** Re-ejecuta la última operación con parámetros nuevos (panel «Última operación»). */
  redoParams() { /* se implementa vía deshacer + repetir en el editor */ }
}
export { updateObject, vcross, vdot, vdist, vnorm, ekey }
Object.assign(EditSession.prototype, pickMethods) // pickMethods: ./session-pick.js
Object.assign(EditSession.prototype, inputMethods) // inputMethods: ./session-input.js
Object.assign(EditSession.prototype, modalMethods) // modalMethods: ./session-modal.js
Object.assign(EditSession.prototype, xformMethods) // xformMethods: ./session-xform.js
Object.assign(EditSession.prototype, paintInputMethods) // paintInputMethods: ./session-paint.js
