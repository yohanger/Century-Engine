import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initialSubtractPoly, validateSubtractPoly } from '../src/engine/runtime/mesh/subtract-edit.js'
import { meshGeometrySignature } from '../src/engine/runtime/mesh/polymesh.js'
import { polyBuffers } from '../src/engine/runtime/mesh/buffers.js'
import { scene, volume, Geo, Attr } from './fixtures/csg-fixture.mjs'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const boxObject = () => ({ type: 'subtract', kind: 'box', scale: [1, 1, 1], props: {} })

class Geometry {
  constructor() { this.attributes = {}; this.userData = {}; this.disposals = 0 }
  setAttribute(name, value) { this.attributes[name] = value; return this }
  getAttribute(name) { return this.attributes[name] }
  setIndex(index) { this.index = index; return this }
  computeBoundingSphere() {}
  dispose() { this.disposals++ }
}
class Attribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize } }
const THREE = { BufferGeometry: Geometry, BufferAttribute: Attribute, EdgesGeometry: Geometry }

const sessionMethod = (name, next, deps = {}) => {
  const text = source('src/core/mesh/session.js')
  const start = text.indexOf(`  ${name}() {`)
  const end = text.indexOf(`\n  ${next}(`, start)
  assert.ok(start >= 0 && end > start)
  return new Function(...Object.keys(deps), `return ({${text.slice(start, end)}}).${name}`)(...Object.values(deps))
}
const rebuild = () => sessionMethod('_rebuildBody', '_stats', { THREE, polyBuffers, meshPaintConfig: () => null, validateSubtractPoly, meshGeometrySignature })
const syncNodeGizmos = () => {
  const text = source('src/core/editor/selection.js')
  const start = text.indexOf('  _syncNodeGizmos(node, selected) {')
  const end = text.indexOf('\n\n  _refreshNodeGizmos(', start)
  assert.ok(start >= 0 && end > start)
  return new Function('store', 'getObject', 'gizmoCategory', 'gizmosEnabled',
    `return ({${text.slice(start, end)}})._syncNodeGizmos`)
}
const bodyOf = (poly, opts = {}) => {
  const body = { geometry: new Geometry(), material: { userData: {}, depthWrite: false } }
  const node = { userData: { liveEdit: true, subtractOwnedGeometry: null, edges: { geometry: new Geometry() }, fill: body } }
  const scheduled = []
  const session = { poly, obj: boxObject(), body, node, ed: { _scheduleBrushes(delay) { scheduled.push(delay) } }, ...opts }
  return { session, scheduled, node, body }
}

const cutterGeometry = poly => {
  const b = polyBuffers(poly)
  const geo = new Geo()
  geo.setAttribute('position', new Attr(b.positions, 3))
  geo.setAttribute('normal', new Attr(b.normals, 3))
  geo.setAttribute('uv', new Attr(b.uvs, 2))
  geo.index = { count: b.indices.length, getX(i) { return b.indices[i] } }
  return geo
}

test('El material transparente de Substract conserva depthWrite desactivado en Edit Mesh', () => {
  const sourceText = source('src/core/mesh/session.js')
  const start = sourceText.indexOf('  _applyXray() {')
  const end = sourceText.indexOf('\n  // ------------------------------------------------------------------ refresco visual', start)
  assert.ok(start >= 0 && end > start)
  const apply = new Function('store', `return ({${sourceText.slice(start, end)}})._applyXray`)({ edit: { xray: false } })
  const material = { transparent: true, opacity: .18, depthWrite: false, needsUpdate: false }
  const session = { body: { material }, _matSave: { tr: true, op: .18, dw: false }, lines: { material: {} }, points: { material: {} }, fdots: { material: {} }, vp: { requestRender() {} } }
  apply.call(session)
  assert.equal(material.depthWrite, false)
  assert.equal(material.opacity, .18)
  assert.equal(material.transparent, true)
})

test('Substract restaurando X-Ray mantiene la política de profundidad original', () => {
  const text = source('src/core/mesh/session.js')
  const start = text.indexOf('  _applyXray() {')
  const end = text.indexOf('\n  // ------------------------------------------------------------------ refresco visual', start)
  const store = { edit: { xray: true } }
  const apply = new Function('store', `return ({${text.slice(start, end)}})._applyXray`)(store)
  const material = { transparent: true, opacity: .18, depthWrite: false, needsUpdate: false }
  const session = { body: { material }, _matSave: { tr: true, op: .18, dw: false }, lines: { material: {} }, points: { material: {} }, fdots: { material: {} }, vp: { requestRender() {} } }
  apply.call(session)
  assert.equal(material.depthWrite, false)
  assert.equal(material.opacity, .35)
  store.edit.xray = false
  apply.call(session)
  assert.equal(material.depthWrite, false)
  assert.equal(material.opacity, .18)
})

test('Sincronizar Substract durante Edit Mesh mantiene visible su geometría activa', () => {
  const obj = { id: 'cut', type: 'subtract' }
  const visual = { visible: true, userData: {} }
  const node = { userData: { id: obj.id, visual, editMeshVisual: visual, editorGizmos: [visual] } }
  const store = { play: { on: false }, prefs: {} }
  const apply = syncNodeGizmos()(store, () => obj, () => 'other', () => true)
  const editor = { edit: { objId: obj.id }, _colliderSync() {} }

  apply.call(editor, node, false)

  assert.equal(visual.visible, true)
  assert.equal(visual.userData.editorGizmoAllowed, false)
})

test('Un Substract inválido en arrastre no sustituye ni libera la última geometría válida', () => {
  const { session, body, node, scheduled } = bodyOf(initialSubtractPoly(boxObject()))
  const update = rebuild()
  update.call(session)
  const previous = body.geometry, version = node.userData.subtractPreviewVersion
  session.poly = session.poly.clone()
  session.poly.f.pop()
  assert.ok(validateSubtractPoly(session.poly))
  update.call(session)
  assert.equal(body.geometry, previous)
  assert.equal(previous.disposals, 0)
  assert.equal(node.userData.subtractPreviewVersion, version)
  assert.equal(scheduled.length, 1)
})

test('La reconstrucción válida publica una versión nueva al BSP sin modificar la malla persistida', () => {
  const poly = initialSubtractPoly(boxObject())
  const { session, body, node, scheduled } = bodyOf(poly)
  const update = rebuild()
  update.call(session)
  const first = body.geometry, version = node.userData.subtractPreviewVersion
  assert.ok(version > 0)
  assert.equal(scheduled.length, 1)
  session.poly = poly.clone()
  for (const v of session.poly.v) if (v[0] < 0) v[0] -= .2
  update.call(session)
  assert.ok(node.userData.subtractPreviewVersion > version)
  assert.notEqual(first, body.geometry)
  assert.equal(first.disposals, 1)
  assert.deepEqual(scheduled, [120, 120])
})

test('Repetir un refresco sin cambios de topología no recalcula el BSP', () => {
  const { session, node, scheduled } = bodyOf(initialSubtractPoly(boxObject()))
  const update = rebuild()
  update.call(session)
  const version = node.userData.subtractPreviewVersion
  const visibleGeometry = session.body.geometry
  update.call(session)
  assert.equal(node.userData.subtractPreviewVersion, version)
  assert.equal(session.body.geometry, visibleGeometry)
  assert.equal(visibleGeometry.disposals, 0)
  assert.deepEqual(scheduled, [120])
})

test('El BSP consume los vértices modificados durante Edit Mesh antes de confirmar', () => {
  const { context, cutter, c, r } = scene()
  const initial = initialSubtractPoly(cutter)
  cutter.props.mesh = initial.toJSON()
  context.refreshBrushes()
  const first = volume(r.userData.carvedPolys)
  const saved = JSON.stringify(cutter.props.mesh)
  const modified = initial.clone()
  for (const v of modified.v) if (v[0] < 0) v[0] -= .4
  assert.equal(validateSubtractPoly(modified), null)
  const preview = cutterGeometry(modified)
  c.userData.liveEdit = true
  c.userData.fill = { geometry: preview }
  c.userData.subtractOwnedGeometry = preview
  c.userData.subtractPreviewVersion = 1
  context.refreshBrushes()
  const changed = volume(r.userData.carvedPolys)
  assert.ok(changed < first, `La vista previa BSP no respondió: ${first} -> ${changed}`)
  assert.equal(JSON.stringify(cutter.props.mesh), saved)
})

test('Dos cambios de geometría en el mismo modal invalidan la caché BSP', () => {
  const { context, cutter, c, r } = scene()
  const initial = initialSubtractPoly(cutter)
  cutter.props.mesh = initial.toJSON()
  c.userData.liveEdit = true
  const grow = (amount, revision) => {
    const edited = initial.clone()
    for (const v of edited.v) if (v[0] < 0) v[0] -= amount
    const geo = cutterGeometry(edited)
    c.userData.fill = { geometry: geo }
    c.userData.subtractOwnedGeometry = geo
    c.userData.subtractPreviewVersion = revision
    context.refreshBrushes()
    return volume(r.userData.carvedPolys)
  }
  const first = grow(.2, 1)
  const second = grow(.5, 2)
  assert.ok(second < first, `La caché BSP ignoró la edición: ${first} -> ${second}`)
})

test('Cancelar una edición restaura el resultado BSP de la geometría persistida', () => {
  const { context, cutter, c, r } = scene()
  const initial = initialSubtractPoly(cutter)
  cutter.props.mesh = initial.toJSON()
  const originalGeo = cutterGeometry(initial)
  c.userData.liveEdit = true
  const edited = initial.clone()
  for (const v of edited.v) if (v[0] < 0) v[0] -= .4
  c.userData.fill = { geometry: cutterGeometry(edited) }
  c.userData.subtractOwnedGeometry = c.userData.fill.geometry
  c.userData.subtractPreviewVersion = 1
  context.refreshBrushes()
  const changed = volume(r.userData.carvedPolys)
  c.userData.fill.geometry = originalGeo
  c.userData.subtractOwnedGeometry = originalGeo
  c.userData.subtractPreviewVersion = 2
  context.refreshBrushes()
  const back = volume(r.userData.carvedPolys)
  assert.ok(back > changed)
  assert.equal(JSON.stringify(cutter.props.mesh), JSON.stringify(initial.toJSON()).replace(/"rev":\d+/, `"rev":${cutter.props.mesh.rev}`))
})


test('Al retirar el cortador de la pared, el receptor recupera su geometría y visibilidad', () => {
  const { context, cutter, c, r } = scene()
  const initial = initialSubtractPoly(cutter)
  cutter.props.mesh = initial.toJSON()
  const original = r.m.geometry
  const preview = cutterGeometry(initial)
  c.userData.liveEdit = true
  c.userData.fill = { geometry: preview }
  c.userData.subtractOwnedGeometry = preview
  c.userData.subtractPreviewVersion = 1
  context.refreshBrushes()
  assert.ok(r.userData.carvedPolys?.length)
  cutter.position = [100, 0, 0]
  context.refreshBrushes()
  assert.equal(r.m.visible, true)
  assert.equal(r.m.geometry, original)
  assert.equal(r.userData.carvedPolys, null)
})
