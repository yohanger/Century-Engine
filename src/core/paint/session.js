// Pintar en la imagen de un Sprite (Tab con el nodo elegido). Se pinta en el visor, directamente sobre el sprite: el clic izquierdo
// usa la herramienta (core/paint/tools.js); la rueda pulsada / Alt / Espacio siguen navegando. Lo pintado se ve al momento (textura
// viva) y se guarda en el PNG del proyecto al salir (Tab) o con «Guardar imagen». Ctrl+Z / Ctrl+Y deshacen dentro de la sesión.
//
// CAPAS (como LibreSprite): se pinta en la capa activa; el sprite muestra todas las visibles, de abajo arriba, con su opacidad.
// Con más de una capa, cada una se guarda como PNG propio (Assets/Textures/Capas) y su lista en props.paintLayers
// ([{ name, image, visible, opacity }]); la imagen del sprite (props.image) es siempre la composición, así el juego no cambia.
import { acquirePointer } from '../../engine/runtime/input/pointer-capture.js'
import * as THREE from 'three'
import { store, assetImage, updateObject, newBlankImage, replaceImageBytes, removeEntry, toast } from '../store.js'
import { rgba, hexOf, getPx, inside, copyImage, restore, drawStroke, drawRect, drawEllipse, drawLine, floodFill, spray, TRANSPARENT, TOOLS } from './tools.js'
import { makeCanvas } from '../../engine/runtime/platform.js'

const KEYS = Object.fromEntries(TOOLS.map(([k, , key]) => [key.toLowerCase(), k]))
const MAX_UNDO = 60
/** Copia real (ImageData) de una imagen de capa: se puede dibujar con putImageData. */
const cloneImg = (img) => new ImageData(new Uint8ClampedArray(img.data), img.width, img.height)

export class PaintSession {
  constructor(ed, obj) {
    this.ed = ed
    this.id = obj.id
    this.canvas = makeCanvas()
    this.g = this.canvas.getContext('2d', { willReadFrequently: true })
    this.undoStack = []; this.redoStack = []
    this.dirty = false
    this.layers = [] // [{ id, name, visible, opacity, img (ImageData), image (id del PNG o '') }]
    this.active = 0
    this.removedAssets = []
    this.op = null
    this.ready = this._load(obj)
  }

  async _load(obj) {
    const p = obj.props || {}
    let imageId = p.image
    if (!imageId) {
      // un sprite sin imagen recibe un lienzo en blanco del tamaño indicado
      imageId = newBlankImage(`${obj.name || 'Lienzo'}.png`, Math.max(1, +p.paintW || 64), Math.max(1, +p.paintH || 64))
      updateObject(this.id, { props: { image: imageId } }, { label: 'Lienzo en blanco' })
    }
    this.imageId = imageId
    const img = await assetImage(imageId).catch(() => null)
    const w = img?.naturalWidth || +p.paintW || 64, h = img?.naturalHeight || +p.paintH || 64
    this.canvas.width = w; this.canvas.height = h
    // capas guardadas (si están todas y del mismo tamaño); si no, una sola capa con la imagen del sprite
    const saved = Array.isArray(p.paintLayers) ? p.paintLayers : []
    const loaded = []
    for (const L of saved) {
      const im = L?.image ? await assetImage(L.image).catch(() => null) : null
      if (!im || im.naturalWidth !== w || im.naturalHeight !== h) { loaded.length = 0; break }
      loaded.push({ name: String(L.name || 'Capa'), visible: L.visible !== false, opacity: Number.isFinite(+L.opacity) ? Math.min(1, Math.max(0, +L.opacity)) : 1, img: this._imgFrom(im, w, h), image: L.image })
    }
    if (loaded.length) this.layers = loaded.map((L, i) => ({ id: i + 1, ...L }))
    else this.layers = [{ id: 1, name: 'Capa 1', visible: true, opacity: 1, img: this._imgFrom(img, w, h), image: '' }]
    this._seq = this.layers.length
    this.active = this.layers.length - 1
    this._composite()
    const tex = (this.tex = new THREE.CanvasTexture(this.canvas))
    tex.colorSpace = THREE.SRGBColorSpace
    const node = this.ed.nodes.get(this.id)
    if (node) { node.userData.liveTex = tex; this.ed.syncObject(this.id) }
    Object.assign(store.paint, { w, h, canUndo: false, canRedo: false, px: null })
    this._syncLayers()
  }

  // ---------- capas ----------
  _imgFrom(im, w, h) {
    const c = makeCanvas(); c.width = w; c.height = h
    const g = c.getContext('2d', { willReadFrequently: true })
    if (im) g.drawImage(im, 0, 0)
    return g.getImageData(0, 0, w, h)
  }
  /** La capa activa es la que pintan las herramientas. */
  get img() { return this.layers[this.active]?.img || null }
  set img(v) { if (this.layers[this.active]) this.layers[this.active].img = v }
  /** Dibuja las capas visibles (de abajo arriba, con su opacidad) en el lienzo que ve el sprite. */
  _composite() {
    const w = this.canvas.width, h = this.canvas.height
    this.g.clearRect(0, 0, w, h)
    const tmp = this._tmp || (this._tmp = makeCanvas())
    if (tmp.width !== w || tmp.height !== h) { tmp.width = w; tmp.height = h }
    const tg = tmp.getContext('2d')
    for (const L of this.layers) {
      if (!L.visible || L.opacity <= 0) continue
      tg.putImageData(L.img, 0, 0)
      this.g.globalAlpha = L.opacity
      this.g.drawImage(tmp, 0, 0)
    }
    this.g.globalAlpha = 1
  }
  /** Copia para el panel (store.paint.layers, de arriba abajo como en LibreSprite). */
  _syncLayers() {
    store.paint.layers = this.layers.map((L, i) => ({ id: L.id, name: L.name, visible: L.visible, opacity: L.opacity, index: i })).reverse()
    store.paint.activeLayer = this.layers[this.active]?.id ?? null
  }
  _state() { return { layers: this.layers.map((L) => ({ ...L, img: cloneImg(L.img) })), active: this.active } }
  _setState(st) { this.layers = st.layers.map((L) => ({ ...L, img: cloneImg(L.img) })); this.active = Math.min(st.active, this.layers.length - 1) }
  /** Cambios de capas (añadir, borrar, mover…): se deshacen como un paso más. */
  _layerOp(fn) {
    this.undoStack.push({ all: this._state() }); if (this.undoStack.length > MAX_UNDO) this.undoStack.shift()
    this.redoStack = []
    fn()
    this.dirty = true
    store.paint.canUndo = true; store.paint.canRedo = false
    this._syncLayers(); this._flush()
  }
  _layerIndex(id) { return this.layers.findIndex((L) => L.id === id) }
  selectLayer(id) { const i = this._layerIndex(id); if (i >= 0) { this.active = i; this._syncLayers() } }
  addLayer() {
    this._layerOp(() => {
      const w = this.canvas.width, h = this.canvas.height
      const L = { id: ++this._seq, name: `Capa ${this._seq}`, visible: true, opacity: 1, img: new ImageData(w, h), image: '' }
      this.layers.splice(this.active + 1, 0, L); this.active += 1
    })
  }
  duplicateLayer() {
    const src = this.layers[this.active]; if (!src) return
    this._layerOp(() => { this.layers.splice(this.active + 1, 0, { ...src, id: ++this._seq, name: `${src.name} copia`, img: cloneImg(src.img), image: '' }); this.active += 1 })
  }
  deleteLayer() {
    if (this.layers.length <= 1) return
    this._layerOp(() => { const [L] = this.layers.splice(this.active, 1); if (L.image) this.removedAssets.push(L.image); this.active = Math.max(0, this.active - 1) })
  }
  /** dir +1 = hacia arriba (delante), -1 = hacia abajo. */
  moveLayer(dir) {
    const i = this.active, j = i + dir
    if (j < 0 || j >= this.layers.length) return
    this._layerOp(() => { const t = this.layers[i]; this.layers[i] = this.layers[j]; this.layers[j] = t; this.active = j })
  }
  /** Fusiona la capa activa con la de debajo. */
  mergeDown() {
    const i = this.active
    if (i <= 0) return
    this._layerOp(() => {
      const top = this.layers[i], bot = this.layers[i - 1], w = this.canvas.width, h = this.canvas.height
      const a = makeCanvas(); a.width = w; a.height = h
      const ga = a.getContext('2d', { willReadFrequently: true }), t = makeCanvas(); t.width = w; t.height = h
      ga.putImageData(bot.img, 0, 0)
      if (top.visible) { t.getContext('2d').putImageData(top.img, 0, 0); ga.globalAlpha = top.opacity; ga.drawImage(t, 0, 0); ga.globalAlpha = 1 }
      bot.img = ga.getImageData(0, 0, w, h)
      this.layers.splice(i, 1); if (top.image) this.removedAssets.push(top.image)
      this.active = i - 1
    })
  }
  setLayer(id, patch) {
    const i = this._layerIndex(id); if (i < 0) return
    const L = this.layers[i]
    if ('name' in patch) L.name = String(patch.name || '').trim().slice(0, 40) || L.name
    if ('visible' in patch) L.visible = !!patch.visible
    if ('opacity' in patch) L.opacity = Math.min(1, Math.max(0, +patch.opacity || 0))
    this.dirty = true
    this._syncLayers(); this._flush()
  }

  get mesh() { return this.ed.nodes.get(this.id)?.userData.body || null }
  /** Píxel de la imagen bajo el puntero (o null). */
  _hit() {
    const m = this.mesh
    if (!m || !this.img) return null
    m.updateMatrixWorld(true)
    const h = this.ed.raycaster.intersectObject(m, false)[0]
    if (!h?.uv) return null
    const x = Math.floor(h.uv.x * this.img.width), y = Math.floor((1 - h.uv.y) * this.img.height)
    return inside(this.img, x, y) ? [x, y] : null
  }
  _opts() {
    const P = store.paint
    return { size: P.size, perfect: P.pixelPerfect, sym: { symX: P.symX, symY: P.symY }, fill: P.fill, tolerance: P.tolerance, contiguous: P.contiguous }
  }
  _color(e) { const P = store.paint; return rgba(e?.button === 2 || e?.ctrlKey ? P.color2 : P.color) }
  _flush() { this._composite(); if (this.tex) this.tex.needsUpdate = true; this.ed.vp.requestRender() }
  _pushUndo() {
    this.undoStack.push({ li: this.active, snap: copyImage(this.img) })
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift()
    this.redoStack = []
    store.paint.canUndo = true; store.paint.canRedo = false
  }

  down(e) {
    const pt = this._hit()
    if (!pt) return
    const P = store.paint, o = this._opts()
    let tool = P.tool
    if (e.altKey && tool !== 'picker') tool = 'picker' // Alt: cuentagotas momentáneo (como LibreSprite)
    if (tool === 'picker') { this._pick(pt, e); return }
    if (tool !== 'bucket' && !acquirePointer(this.ed.dom, e, 'Pintura')) return
    this._pushUndo()
    this.dirty = true
    const color = tool === 'eraser' ? TRANSPARENT : this._color(e)
    if (tool === 'bucket') { floodFill(this.img, pt[0], pt[1], color, o); this._flush(); return }
    this.op = { tool, color, start: pt, pts: [pt], snap: copyImage(this.img), shift: e.shiftKey }
    this._apply(pt)
  }
  move(e) {
    const pt = this._hit()
    store.paint.px = pt
    if (!this.op || !pt) return
    this.op.shift = e.shiftKey
    this._apply(pt)
  }
  up() { if (this.op) { this.op = null; store.paint.px = store.paint.px } }

  _apply(pt) {
    const op = this.op, o = this._opts(), img = this.img
    const last = op.pts.at(-1)
    if (op.tool === 'spray') { spray(img, pt[0], pt[1], { color: op.color, size: o.size, sym: o.sym }); this._flush(); return }
    if (op.tool === 'pencil' || op.tool === 'eraser') {
      if (last[0] !== pt[0] || last[1] !== pt[1]) op.pts.push(pt)
      restore(img, op.snap)
      drawStroke(img, op.pts, { size: o.size, color: op.color, perfect: o.perfect, sym: o.sym })
      this._flush(); return
    }
    // formas: se redibujan desde la copia del principio en cada movimiento. Mayús: proporción 1:1 (y línea a 45°)
    let [x1, y1] = pt
    const [x0, y0] = op.start
    if (op.shift) {
      const dx = x1 - x0, dy = y1 - y0
      if (op.tool === 'line') { if (Math.abs(dx) > 2 * Math.abs(dy)) y1 = y0; else if (Math.abs(dy) > 2 * Math.abs(dx)) x1 = x0; else { const m = Math.max(Math.abs(dx), Math.abs(dy)); x1 = x0 + Math.sign(dx) * m; y1 = y0 + Math.sign(dy) * m } } else { const m = Math.max(Math.abs(dx), Math.abs(dy)); x1 = x0 + Math.sign(dx || 1) * m; y1 = y0 + Math.sign(dy || 1) * m }
    }
    restore(img, op.snap)
    if (op.tool === 'line') drawLine(img, x0, y0, x1, y1, { color: op.color, size: o.size, sym: o.sym })
    else if (op.tool === 'rect') drawRect(img, x0, y0, x1, y1, { color: op.color, fill: o.fill, size: o.size, sym: o.sym })
    else if (op.tool === 'ellipse') drawEllipse(img, x0, y0, x1, y1, { color: op.color, fill: o.fill, sym: o.sym })
    this._flush()
  }
  _pick(pt, e) {
    // el cuentagotas toma el color que se ve (todas las capas)
    const c = getPx(this.g.getImageData(0, 0, this.canvas.width, this.canvas.height), pt[0], pt[1])
    if (c[3] === 0) return
    if (e?.button === 2 || e?.ctrlKey) store.paint.color2 = hexOf(c); else store.paint.color = hexOf(c)
  }

  /** Una entrada de deshacer es un trazo en una capa ({ li, snap }) o un cambio de capas ({ all }). */
  _swap(entry) {
    if (entry.all) { const back = { all: this._state() }; this._setState(entry.all); return back }
    const L = this.layers[entry.li]
    if (!L) return null
    const back = { li: entry.li, snap: copyImage(L.img) }
    restore(L.img, entry.snap); this.active = entry.li
    return back
  }
  undo() {
    if (!this.undoStack.length) return
    const back = this._swap(this.undoStack.pop()); if (back) this.redoStack.push(back)
    this.dirty = true
    store.paint.canUndo = this.undoStack.length > 0; store.paint.canRedo = this.redoStack.length > 0
    this._syncLayers(); this._flush()
  }
  redo() {
    if (!this.redoStack.length) return
    const back = this._swap(this.redoStack.pop()); if (back) this.undoStack.push(back)
    this.dirty = true
    store.paint.canUndo = this.undoStack.length > 0; store.paint.canRedo = this.redoStack.length > 0
    this._syncLayers(); this._flush()
  }
  /** Borra toda la imagen (transparente). */
  clear() { this._pushUndo(); this.img.data.fill(0); this.dirty = true; this._flush() } // borra la capa activa

  /** Atajos (como LibreSprite): B lápiz, E borrador, G cubo, I cuentagotas, L línea, U rectángulo, O elipse, S spray, X intercambia colores, [ ] tamaño. */
  onKey(e) {
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey
    if (mod && k === 'z') { if (e.shiftKey) this.redo(); else this.undo(); return true }
    if (mod && k === 'y') { this.redo(); return true }
    if (mod) return false
    if (KEYS[k]) { store.paint.tool = KEYS[k]; return true }
    if (k === 'x') { const P = store.paint; [P.color, P.color2] = [P.color2, P.color]; return true }
    if (k === '[') { store.paint.size = Math.max(1, store.paint.size - 1); return true }
    if (k === ']') { store.paint.size = Math.min(64, store.paint.size + 1); return true }
    if (k === 'escape') { this.ed.exitPaint(); return true }
    return false
  }

  async _pngOf(img) {
    const c = makeCanvas(); c.width = img.width; c.height = img.height
    c.getContext('2d').putImageData(img, 0, 0)
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null
  }
  /** Guarda lo pintado: la composición en la imagen del sprite y, con varias capas, cada capa en su PNG. */
  async save() {
    if (!this.dirty) return true
    this._flush()
    const blob = await new Promise((r) => this.canvas.toBlob(r, 'image/png'))
    if (!blob) return false
    let ok = await replaceImageBytes(this.imageId, new Uint8Array(await blob.arrayBuffer()))
    const obj = store.project.objects.find((o) => o.id === this.id)
    if (this.layers.length > 1) {
      const base = (obj?.name || 'Lienzo').replace(/[^\w\- áéíóúñÁÉÍÓÚÑ]+/g, '_')
      for (const L of this.layers) {
        if (!L.image || !store.project.assets.some((a) => a.id === L.image)) L.image = newBlankImage(`${base} · ${L.name}.png`, L.img.width, L.img.height, 'Assets/Textures/Capas')
        const bytes = await this._pngOf(L.img)
        if (!bytes || !(await replaceImageBytes(L.image, bytes))) ok = false
      }
      updateObject(this.id, { props: { paintLayers: this.layers.map((L) => ({ name: L.name, image: L.image, visible: L.visible, opacity: L.opacity })) } }, { label: 'Capas del lienzo' })
    } else if (obj?.props?.paintLayers) {
      // vuelve a una sola capa: la imagen del sprite basta
      for (const L of this.layers) if (L.image) this.removedAssets.push(L.image)
      updateObject(this.id, { props: { paintLayers: null } }, { label: 'Capas del lienzo' })
      for (const L of this.layers) L.image = ''
    }
    for (const id of this.removedAssets.splice(0)) if (id !== this.imageId && !this.layers.some((L) => L.image === id)) await removeEntry('texture', id).catch(() => {})
    if (ok) this.dirty = false
    else toast('No se pudo guardar la imagen pintada', 'error')
    return ok
  }
  async close() {
    await this.save()
    const node = this.ed.nodes.get(this.id)
    if (node) node.userData.liveTex = null
    this.tex?.dispose()
    this.ed.syncObject(this.id)
  }
}
