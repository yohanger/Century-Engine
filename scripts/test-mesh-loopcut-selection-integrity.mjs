import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { make, grid } from '../src/engine/runtime/mesh/generators.js'
import { PolyMesh, checkClosed, signedVolume, ekey } from '../src/engine/runtime/mesh/polymesh.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'
import { loopCut, loopCutLines, ringOf, validLoopCutRing, loopSlideFromScreen, cutSlideLimit } from '../src/core/mesh/cuts.js'
import { loopCutOp } from '../src/core/mesh/ops.js'

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`)
const key = (m) => [...m.edges().keys()][0]
const cube = () => make('cube')

function modalFixture(selected = [], geometry = cube(), pickedEdge = null) {
  const poly = geometry, startKey = pickedEdge ?? key(poly), sel = new Sel()
  sel.f = new Set(selected)
  normalize(poly, sel, 'face')
  const store = { edit: { loopCuts: 1, loopSlide: 0, hud: '', bevel: { segments: 1 }, globalShortcuts: false }, project: { settings: { gridSize: 1 } } }
  const calls = [], notices = []
  const THREE = {
    Float32BufferAttribute: class { constructor(array) { this.array = array } },
    Vector3: class {
      constructor(x, y, z) { this.x = x; this.y = y; this.z = z }
      applyMatrix4() { return this }
      distanceTo(p) { return Math.hypot(this.x - p.x, this.y - p.y, this.z - p.z) }
    },
  }
  const source = readFileSync(new URL('../src/core/mesh/session-modal.js', import.meta.url), 'utf8')
    .replace(/^import\s+[^\n]+\n/gm, '')
    .replace(/^export\s+const\s+/gm, 'const ')
  const methods = runInNewContext(`${source}\nmodalMethods`, {
    THREE, vlen: () => 1, O: { loopCutOp }, loopCutLines, validLoopCutRing, loopSlideFromScreen, cutSlideLimit,
    store, toast: (message) => notices.push(message), snapStep: () => 1,
    snapEnabled: () => false, snapModalValue: (_modal, _kind, amount) => amount,
    rayLineParam: () => 0,
  })
  const session = {
    poly, sel, mode: 'face', lastClient: { x: 0, y: 0 }, modal: null,
    tc: { enabled: true, getHelper: () => ({ visible: true }) },
    preview: { visible: false, geometry: { positions: [], setAttribute(_name, attr) { this.positions = attr.array } } },
    dom: { getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 } } },
    vp: { requestRender() {} }, visual: { matrixWorld: {} },
    _prepXform() {}, pivotWorld: () => null, _project: () => ({ x: 0, y: 0 }),
    _pickEdge: () => startKey, _screenVerts() { return this.poly.v.map((v) => ({ x: v[0] * 100, y: v[1] * 100, z: v[2] })) },
    _continuousGrab: { end() {} },
    run(label, fn) {
      const before = this.poly.clone()
      const result = fn(this.poly, this.sel, this.mode)
      if (typeof result === 'string') { this.poly = before; return false }
      this.poly.reconcileAttributes(before)
      calls.push(label)
      return true
    },
    _clearSvg() {}, refresh() {},
  }
  Object.assign(session, methods)
  return { session, store, calls, notices, startKey }
}


test('LS-01 sin selección en modo Cara se conserva el anillo global', () => {
  const m = cube(), start = key(m)
  assert.equal(ringOf(m, start).faces.length, 4)
  assert.equal(loopCutLines(m, start).length, 4)
  const v = signedVolume(m)
  assert.ok(loopCut(m, start))
  assert.equal(m.f.length, 10)
  assert.deepEqual(checkClosed(m), [])
  close(signedVolume(m), v)
})

test('LS-02 una cara seleccionada no limita el recorrido ni el preview', () => {
  const m = cube(), start = key(m), before = m.f.length
  const sel = new Sel()
  sel.f.add(0); normalize(m, sel, 'face')
  const preview = loopCutLines(m, start, 2, .45)
  assert.equal(preview.length, 8)
  assert.equal(loopCutOp(m, sel, 'face', { key: start, cuts: 2, slide: .45 }), undefined)
  assert.equal(m.f.length, before + 8)
  assert.ok(sel.e.size > 0)
  assert.deepEqual(checkClosed(m), [])
})

test('LS-03 seleccionar dos caras no altera cortes múltiples ni slide', () => {
  const m = cube(), start = key(m), volume = signedVolume(m)
  const sel = new Sel()
  sel.f = new Set([0, 2]); normalize(m, sel, 'face')
  assert.equal(loopCutLines(m, start, 3, -.6).length, 12)
  assert.equal(loopCutOp(m, sel, 'face', { key: start, cuts: 3, slide: -.6 }), undefined)
  assert.equal(m.f.length, 18)
  assert.deepEqual(checkClosed(m), [])
  close(signedVolume(m), volume)
})

test('LS-04 la arista de inicio puede ser externa a la selección', () => {
  const m = cube(), sel = new Sel()
  sel.f.add(0); normalize(m, sel, 'face')
  const edgeOutside = [...m.edges()].find(([, e]) => e.faces.every((fi) => !sel.f.has(fi)))?.[0]
  assert.notEqual(edgeOutside, undefined)
  assert.ok(validLoopCutRing(m, edgeOutside))
  assert.ok(loopCutLines(m, edgeOutside).length > 0)
  assert.equal(loopCutOp(m, sel, 'face', { key: edgeOutside }), undefined)
  assert.equal(m.f.length, 10)
})

test('LS-05 las caras seleccionadas desconectadas no amplían el anillo', () => {
  const m = grid(4, 4, 4, 2), start = key(m), disconnected = new Set([0, m.f.length - 1])
  assert.equal(disconnected.size, 2)
  const global = ringOf(m, start)
  assert.ok(global.faces.length >= 1)
  assert.equal(loopCutLines(m, start, 1, .25).length, global.faces.length)
  const before = m.f.length
  assert.ok(loopCut(m, start, 1, .25))
  assert.equal(m.f.length, before + global.faces.length)
})

test('LS-06 cara no quad interrumpe el anillo cuando es parte del recorrido', () => {
  const m = cube(), k = key(m)
  m.f[0] = m.f[0].slice(0, 3)
  const original = JSON.stringify({ v: m.v, f: m.f })
  assert.ok(ringOf(m, k)?.faces.length < 4)
  const preview = loopCutLines(m, k)
  assert.equal(preview.length, ringOf(m, k).faces.length)
  assert.equal(JSON.stringify({ v: m.v, f: m.f }), original)
})

test('LS-07 la operación y la serialización no dependen de la selección', () => {
  const m = cube(), sel = new Sel(), start = key(m), original = m.toJSON()
  sel.f.add(0); normalize(m, sel, 'face')
  assert.equal(loopCutOp(m, sel, 'face', { key: start, cuts: 2, slide: .2 }), undefined)
  assert.equal(m.f.length, 14)
  const reopened = PolyMesh.fromJSON(JSON.parse(JSON.stringify(m.toJSON())))
  assert.deepEqual(reopened.f, m.f)
  assert.deepEqual(checkClosed(reopened), [])
  assert.equal(PolyMesh.fromJSON(original).f.length, 6)
})

test('LS-08 el modal conserva selección de edición pero muestra el anillo global', () => {
  const { session, calls, startKey } = modalFixture([0])
  session.startModal('loopcut')
  assert.equal(session.modal.edge, startKey)
  assert.equal(session.modal.baseSel.f.size, 1)
  assert.equal('allowedFaces' in session.modal, false)
  assert.equal(session.preview.geometry.positions.length, 4 * 6)
  session.sel.f.clear()
  assert.deepEqual([...session.modal.baseSel.f], [0])
  assert.equal(calls.length, 0)
})

test('LS-09 el modal confirma una sola transacción con el anillo global', () => {
  const { session, calls } = modalFixture([0])
  const before = session.poly.clone()
  session.startModal('loopcut'); session.modalConfirm()
  assert.equal(session.modal.phase, 'slide')
  assert.deepEqual(session.poly.f, before.f)
  session.modalConfirm()
  assert.equal(session.modal, null)
  assert.equal(session.poly.f.length, before.f.length + 4)
  assert.equal(session.preview.visible, false)
  assert.deepEqual(calls, ['Corte en bucle'])
})

test('LS-10 una cara seleccionada fuera del anillo no impide el hover', () => {
  const { session } = modalFixture([1])
  session.startModal('loopcut')
  assert.notEqual(session.modal.edge, null)
  assert.equal(session.preview.visible, true)
  assert.equal(session.preview.geometry.positions.length, 4 * 6)
})

test('LS-11 cancelar no altera geometría ni historial', () => {
  const { session, calls } = modalFixture([0])
  const before = JSON.stringify({ v: session.poly.v, f: session.poly.f })
  session.startModal('loopcut')
  session.modalCancel()
  assert.equal(JSON.stringify({ v: session.poly.v, f: session.poly.f }), before)
  assert.equal(session.modal, null)
  assert.equal(calls.length, 0)
})

test('LS-12 treinta y dos cortes atraviesan los cuatro quads del cubo', () => {
  const m = cube(), count = 32, volume = signedVolume(m)
  assert.equal(loopCutLines(m, key(m), count, .95).length, 4 * count)
  const result = loopCut(m, key(m), count, .95)
  assert.equal(result.verts.length, 4 * count)
  assert.equal(m.f.length, 6 + 4 * count)
  assert.deepEqual(checkClosed(m), [])
  close(signedVolume(m), volume)
})

test('LS-13 el modo Arista conserva la misma previsualización global', () => {
  const { session } = modalFixture([0])
  session.mode = 'edge'
  normalize(session.poly, session.sel, 'edge')
  session.startModal('loopcut')
  assert.equal('allowedFaces' in session.modal, false)
  assert.equal(session.preview.geometry.positions.length, 4 * 6)
})

test('LS-14 todas las caras seleccionadas y ninguna producen iguales resultados', () => {
  const a = cube(), b = cube(), start = key(a)
  assert.deepEqual(loopCutLines(a, start, 3, .25), loopCutLines(b, start, 3, .25))
  loopCut(a, start, 3, .25)
  const selection = new Sel(); selection.f = new Set(b.f.map((_, fi) => fi)); normalize(b, selection, 'face')
  loopCutOp(b, selection, 'face', { key: start, cuts: 3, slide: .25 })
  assert.deepEqual(a.f, b.f)
  assert.deepEqual(a.v, b.v)
})

test('LS-15 UV, pintura, pesos y serialización sobreviven al anillo global', () => {
  const m = cube(), start = key(m)
  m.ensureUV()
  m.colors = m.v.map((_, i) => [i / m.v.length, .5, .75])
  m.weights = m.v.map(() => [1, 0, 0, 0, 0, 0, 0, 0])
  const before = m.clone()
  assert.ok(loopCut(m, start, 4, .7))
  m.reconcileAttributes(before)
  assert.equal(m.uv.length, m.f.length)
  assert.ok(m.uv.every((uv, fi) => uv.length === m.f[fi].length && uv.every((point) => point.every(Number.isFinite))))
  assert.equal(m.colors.length, m.v.length)
  assert.equal(m.weights.length, m.v.length)
  const saved = PolyMesh.fromJSON(JSON.parse(JSON.stringify(m.toJSON())))
  assert.deepEqual(saved.f, m.f)
  assert.deepEqual(checkClosed(saved), [])
  close(signedVolume(saved), signedVolume(before))
})

test('LS-16 el modal en una rejilla ejecuta el anillo del cursor, no todas las caras seleccionadas', () => {
  const poly = grid(4, 2, 4, 2)
  const first = poly.f[0], pickedEdge = ekey(first[1], first[2])
  const expected = ringOf(poly, pickedEdge).faces.length
  const { session, calls } = modalFixture([0, 1, 2], poly, pickedEdge)
  const oldFaces = session.poly.f.length
  session.startModal('loopcut')
  assert.equal(session.modal.baseSel.f.size, 3)
  assert.equal(session.preview.geometry.positions.length, expected * 6)
  session._screenVerts = () => session.poly.v.map((v) => ({ x: v[0] * 100, y: v[2] * 100, z: v[1] }))
  session.modalConfirm()
  assert.equal(session.modal.phase, 'slide')
  assert.equal(session.poly.f.length, oldFaces)
  session.modalConfirm()
  assert.equal(session.modal, null)
  assert.equal(session.poly.f.length, oldFaces + expected)
  assert.deepEqual(calls, ['Corte en bucle'])
})
