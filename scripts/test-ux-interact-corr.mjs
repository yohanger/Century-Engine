// UX-CORR-001: zonas reales y contrato visual. Electron/Jolt se verifican aparte.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { defaultIndicatorZones, normalizeIndicatorZones, insideIndicatorZone } from '../src/engine/runtime/interaction/volumes.js'
import { newPage, normalizeEvent } from '../src/engine/runtime/events/model.js'
import { defaultInputMap, findAction, labelOf } from '../src/engine/runtime/input/inputmap.js'

const xyz = (x, y, z) => ({ x, y, z })
test('UX-C01 · las zonas tienen radios independientes', () => {
  const z = defaultIndicatorZones(2)
  assert.equal(z.ring.radius, 3.5)
  assert.equal(z.key.radius, 2)
})
test('UX-C02 · la esfera considera la distancia real en 3D', () => {
  const z = defaultIndicatorZones(2).key
  assert.equal(insideIndicatorZone(xyz(1, 1, 0), z), true)
  assert.equal(insideIndicatorZone(xyz(1.9, 1.9, 0), z), false)
})
test('UX-C03 · la esfera usa su offset local', () => {
  const z = { ...defaultIndicatorZones().ring, radius: 1, offset: [4, 0, 0] }
  assert.equal(insideIndicatorZone(xyz(4.5, 0, 0), z), true)
  assert.equal(insideIndicatorZone(xyz(0, 0, 0), z), false)
})
test('UX-C04 · la caja evalúa X/Y/Z con tamaños independientes', () => {
  const z = { ...defaultIndicatorZones().key, shape: 'box', size: [4, 2, 1] }
  assert.equal(insideIndicatorZone(xyz(1.9, 0.9, 0.45), z), true)
  assert.equal(insideIndicatorZone(xyz(0, 0, 0.75), z), false)
})
test('UX-C05 · girar la caja 90° sobre Y cambia el eje largo', () => {
  const z = { ...defaultIndicatorZones().key, shape: 'box', size: [4, 2, 1], rotation: [0, 90, 0] }
  assert.equal(insideIndicatorZone(xyz(0, 0, 1.5), z), true)
  assert.equal(insideIndicatorZone(xyz(1.5, 0, 0), z), false)
})
test('UX-C06 · girar la caja 90° sobre Z respeta X/Y', () => {
  const z = { ...defaultIndicatorZones().key, shape: 'box', size: [4, 1, 1], rotation: [0, 0, 90] }
  assert.equal(insideIndicatorZone(xyz(0, 1.5, 0), z), true)
  assert.equal(insideIndicatorZone(xyz(1.5, 0, 0), z), false)
})
test('UX-C07 · tolerancia de borde evita parpadeo milimétrico', () => {
  const z = defaultIndicatorZones(2).key
  assert.equal(insideIndicatorZone(xyz(2.02, 0, 0), z), false)
  assert.equal(insideIndicatorZone(xyz(2.02, 0, 0), z, 0.04), true)
})
test('UX-C08 · la tolerancia no prolonga un indicador fuera del campo', () => {
  assert.equal(insideIndicatorZone(xyz(2.2, 0, 0), defaultIndicatorZones(2).key, 0.04), false)
})
test('UX-C09 · el modelo preserva formas y offsets de un proyecto guardado', () => {
  const src = { ring: { shape: 'box', size: [2, 3, 4], offset: [1, 0, 0], rotation: [0, 35, 0] },
    key: { radius: 0.7 }, visual: { automatic: false, offset: [0, 1, 0], keyOffset: [0.2, 0, 0], scale: 1.4 } }
  const z = normalizeIndicatorZones(JSON.parse(JSON.stringify(src)), 2)
  assert.deepEqual(z.ring.size, [2, 3, 4])
  assert.deepEqual(z.ring.rotation, [0, 35, 0])
  assert.deepEqual(z.visual.keyOffset, [0.2, 0, 0])
  assert.equal(z.visual.automatic, false)
})
test('UX-C10 · configuraciones antiguas reciben valores compatibles', () => {
  const z = normalizeIndicatorZones(undefined, 1.7)
  assert.equal(z.ring.radius, 3.2)
  assert.equal(z.key.radius, 1.7)
})
test('UX-C11 · valores inválidos de geometría se normalizan de forma segura', () => {
  const z = normalizeIndicatorZones({ ring: { shape: 'pyramid', radius: -3 }, key: { shape: 'box', size: [-2, 0, 1] }, visual: { scale: 999 } })
  assert.equal(z.ring.shape, 'sphere'); assert.equal(z.ring.radius, 0.05)
  assert.deepEqual(z.key.size, [2, 0.05, 1]); assert.equal(z.visual.scale, 3)
})
test('UX-C12 · una página nueva sigue desactivada y guarda las dos zonas', () => {
  const pg = newPage()
  assert.equal(pg.showIndicator, false)
  assert.equal(pg.indicatorZones.ring.shape, 'sphere')
  assert.ok(pg.indicatorZones.key)
})
test('UX-C13 · cada página de evento conserva sus propias zonas', () => {
  const a = newPage(), b = newPage(); a.showIndicator = true; a.indicatorZones.ring.shape = 'box'
  const ev = normalizeEvent({ reach: 2, pages: [a, b] })
  assert.equal(ev.pages[0].indicatorZones.ring.shape, 'box')
  assert.equal(ev.pages[1].indicatorZones.ring.shape, 'sphere')
  assert.equal(ev.pages[1].showIndicator, false)
})
test('UX-C14 · cambiar una zona no cambia el radio físico de interacción antiguo', () => {
  const ev = normalizeEvent({ reach: 1.2, pages: [{ trigger: 'action', list: [], showIndicator: false }] })
  assert.equal(ev.reach, 1.2)
  assert.equal(ev.pages[0].showIndicator, false)
})

// El resto prueba los métodos reales de presentación con una cámara y geometría controladas.
class V {
  constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }) }
  clone() { return new V(this.x, this.y, this.z) }
  copy(o) { this.x = o.x; this.y = o.y; this.z = o.z; return this }
  sub(o) { this.x -= o.x; this.y -= o.y; this.z -= o.z; return this }
  add(o) { this.x += o.x; this.y += o.y; this.z += o.z; return this }
  toArray() { return [this.x, this.y, this.z] }
  length() { return Math.hypot(this.x, this.y, this.z) }
  distanceTo(o) { return this.clone().sub(o).length() }
  multiplyScalar(n) { this.x *= n; this.y *= n; this.z *= n; return this }
  project() { return new V(this.x / 2, this.y / 2, this.z < 0 ? 2 : 0) }
}
class B {
  makeEmpty() { this.empty = true; return this }
  setFromObject(node) { this.min = node.min || new V(); this.max = node.max || new V(); return this }
  isEmpty() { return false }
  getCenter(out) { return out.copy(this.min.clone().add(this.max).multiplyScalar(0.5)) }
}
const source = readFileSync(new URL('../src/engine/runtime/events/play-interaction-indicator.js', import.meta.url), 'utf8')
  .replace(/^import .+\n/gm, '').replace(/export (function|const) /g, '$1 ')
const { indicatorMethods } = runInNewContext(`${source}\n;({indicatorMethods})`, {
  THREE: { Vector3: V, Box3: B }, normalizeIndicatorZones, insideIndicatorZone, labelOf, findAction,
})
function context(center = new V(2.2, 0, 2)) {
  const node = { visible: true, anchor: center, min: new V(center.x - 1, center.y - 1, center.z - 0.5),
    max: new V(center.x + 1, center.y + 1, center.z + 0.5),
    updateWorldMatrix() {}, worldToLocal(v) { return v.sub(center) },
    localToWorld(v) { return v.add(center) }, getWorldPosition(v) { return v.copy(center) }, userData: {} }
  const obj = { id: 'o', type: 'gameplayObject', props: { reach: 4, indicatorZones: defaultIndicatorZones(4) } }
  const target = { node, obj, state: { status: 'world' }, info: { record: { model: 'a' } }, busy: false }
  const state = { interactionIndicator: null }
  const pm = { ...indicatorMethods, state, on: true, hasPlayer: true, control: true, cam: {
    position: new V(), updateMatrixWorld() {},
  }, body: { radius: 0.3 }, project: { ui: { slots: {} } },
  input: { map: defaultInputMap() }, ui: { modalOpen: false, canvases: () => [], doc: () => null },
  gameplayCand: null, cand: null, events: [], _gpObjects: new Map([['o', target]]), _raycast: () => null }
  return { pm, state, target }
}
test('UX-C15 · una parte del modelo en cámara mantiene el anillo, aunque el centro salga', () => {
  const { pm, state } = context(new V(2.2, 0, 2))
  pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator?.id, 'o')
  assert.ok(state.interactionIndicator.x <= 100)
})
test('UX-C16 · si el volumen del anillo no contiene al jugador no aparece', () => {
  const { pm, state, target } = context()
  target.obj.props.indicatorZones.ring.radius = 0.5
  pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator, null)
})
test('UX-C17 · estar dentro del anillo no obliga a mostrar la tecla', () => {
  const { pm, state } = context()
  pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator?.key, '')
})
test('UX-C18 · oclusión completa oculta el anillo incluso dentro de la zona', () => {
  const { pm, state } = context()
  pm._raycast = () => ({ distance: 0.1 })
  pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator, null)
})
test('UX-C19 · un Canvas personalizado conserva prioridad', () => {
  const { pm, state } = context()
  pm.ui.canvases = () => [{ role: 'prompt', shown: true, ui: 'a' }]
  pm.ui.doc = () => ({})
  pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator, null)
})
test('UX-C20 · el runtime y el Inspector consumen la misma zona de acción', () => {
  const gp = readFileSync(new URL('../src/engine/runtime/events/play-gameplay-objects.js', import.meta.url), 'utf8')
  const ev = readFileSync(new URL('../src/engine/runtime/events/play-events.js', import.meta.url), 'utf8')
  assert.match(gp, /_inIndicatorZone\?\.\(g, 'key'\)/)
  assert.match(ev, /_inIndicatorZone\(e, 'key'\)/)
  assert.match(ev, /_inIndicatorZone\(inst, 'key'\)/)
})
