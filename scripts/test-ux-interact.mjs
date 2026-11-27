// LF-UX-INTERACT-G001: prueba el modelo y la presentación sin simular que Electron/Jolt están abiertos.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { newPage, normalizeEvent } from '../src/engine/runtime/events/model.js'
import { defaultInputMap, labelOf, findAction } from '../src/engine/runtime/input/inputmap.js'
import { normalizeIndicatorZones, insideIndicatorZone } from '../src/engine/runtime/interaction/volumes.js'

class Vec3 {
  constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }) }
  copy(v) { Object.assign(this, { x: v.x, y: v.y, z: v.z }); return this }
  clone() { return new Vec3(this.x, this.y, this.z) }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z }
  length() { return Math.hypot(this.x, this.y, this.z) }
  distanceTo(v) { return this.clone().sub(v).length() }
  normalize() { const l = this.length() || 1; this.x /= l; this.y /= l; this.z /= l; return this }
  toArray() { return [this.x, this.y, this.z] }
  multiplyScalar(n) { this.x *= n; this.y *= n; this.z *= n; return this }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this }
  project(cam) { const o = cam.projectAt || {}; return this.copy({ x: o.x ?? 0, y: o.y ?? 0, z: o.z ?? (this.z < 0 ? 2 : 0) }) }
}
class Box3 {
  makeEmpty() { this.empty = true; return this }
  setFromObject(node) { this.anchor = node.anchor || { x: 0, y: 0, z: 2 }; this.min = this.max = this.anchor; return this }
  isEmpty() { return false }
  getCenter(v) { return v.copy(this.anchor) }
}
const code = readFileSync(new URL('../src/engine/runtime/events/play-interaction-indicator.js', import.meta.url), 'utf8')
  .replace(/^import .+\n/gm, '').replace(/export (function|const) /g, '$1 ')
const api = runInNewContext(`${code}\n;({ indicatorEnabled, interactLabel, indicatorMethods })`, { THREE: { Vector3: Vec3, Box3 }, labelOf, findAction, normalizeIndicatorZones, insideIndicatorZone })
const { indicatorEnabled, interactLabel, indicatorMethods } = api
const node = (anchor = { x: 0, y: 0, z: 2 }) => ({ visible: true, anchor, updateWorldMatrix() {}, getWorldPosition(v) { return v.copy(anchor) }, worldToLocal(v) { return v.sub(anchor) }, localToWorld(v) { return v.add(anchor) }, userData: { visual: null } })
function fixture({ kind = 'gameplayObject', enabled, pg, at = { x: 0, y: 0, z: 2 } } = {}) {
  const obj = { id: 'obj1', type: kind, name: 'Botella', props: enabled === undefined ? {} : { showIndicator: enabled } }
  const target = { obj, node: node(at), props: { reach: 2, pages: [pg || newPage()] }, pageIdx: 0 }
  const cam = { position: new Vec3(0, 0, 0), getWorldDirection(v) { return v.copy({ x: 0, y: 0, z: 1 }) }, updateMatrixWorld() {} }
  const state = { interactionIndicator: null, dialog: null, choices: null }
  const pm = {
    ...indicatorMethods, on: true, hasPlayer: true, control: true, main: null, state,
    ui: { modalOpen: false, doc: () => null, canvases: () => [] }, project: { ui: { slots: {} } },
    input: { map: defaultInputMap() }, cam, events: [], body: { radius: 0.3 },
    cand: kind === 'event' ? target : null, gameplayCand: kind === 'gameplayObject' ? target : null,
    _raycast: () => null, _gpCandidate: () => null, _canAction: () => true,
  }
  if (kind === 'gameplayObject') { Object.assign(target, { state: { status: 'world' }, info: { record: { model: 'a' } }, busy: false }); pm._gpObjects = new Map([['obj1', target]]) }
  else pm.events = [target]
  return { pm, target, state, cam }
}

test('UX-01 · eventos nuevos quedan con indicador desactivado', () => assert.equal(newPage().showIndicator, false))
test('UX-02 · evento antiguo sin propiedad no muestra indicador después de normalizar', () => {
  const raw = { pages: [{ trigger: 'action', list: [] }] }
  normalizeEvent(raw)
  assert.equal(raw.pages[0].showIndicator, false)
})
test('UX-03 · cada página guarda su propio indicador sin afectar otra página', () => {
  const raw = { pages: [{ ...newPage(), showIndicator: true }, newPage()] }
  normalizeEvent(raw)
  assert.deepEqual(raw.pages.map((p) => p.showIndicator), [true, false])
})
test('UX-04 · solo action permite indicador en páginas', () => {
  const obj = { type: 'event' }
  for (const trigger of ['auto', 'parallel', 'signal', 'input', 'touch', 'look'])
    assert.equal(indicatorEnabled(obj, { showIndicator: true, trigger }), false)
  assert.equal(indicatorEnabled(obj, { showIndicator: true, trigger: 'action' }), true)
})
test('UX-05 · Gameplay Object antiguo tiene indicador ON salvo que lo apagues explícitamente', () => {
  assert.equal(indicatorEnabled({ type: 'gameplayObject', props: {} }), true)
  assert.equal(indicatorEnabled({ type: 'gameplayObject', props: { showIndicator: false } }), false)
})
test('UX-06 · el indicador usa la tecla realmente asignada en Input Map', () => {
  const map = defaultInputMap()
  assert.equal(interactLabel(map), 'E')
  findAction(map, 'interact').bindings = ['KeyF', 'Pad2']
  assert.equal(interactLabel(map), 'F')
  findAction(map, 'interact').bindings = ['Pad2']
  assert.equal(interactLabel(map), 'X')
})
test('UX-07 · las entradas largas se abrevian sin inventar otra tecla', () => {
  const map = defaultInputMap()
  findAction(map, 'interact').bindings = ['Mouse0']
  assert.equal(interactLabel(map), 'M1')
  findAction(map, 'interact').bindings = ['Space']
  assert.equal(interactLabel(map), '␣')
})
test('UX-07b · no se fija E si el usuario elimina todas las entradas', () => {
  const map = defaultInputMap(); findAction(map, 'interact').bindings = []
  assert.equal(interactLabel(map), '')
})
test('UX-08 · al estar dentro del alcance muestra anillo con tecla en la posición proyectada', () => {
  const { pm, state } = fixture()
  pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator.id, 'obj1')
  assert.equal(state.interactionIndicator.key, 'E')
  assert.equal(state.interactionIndicator.x, 50)
  assert.equal(state.interactionIndicator.y, 50)
})
test('UX-09 · fuera del alcance de acción muestra el anillo sin tecla', () => {
  const { pm, target, state } = fixture()
  pm.gameplayCand = null
  pm._gpCandidate = () => ({ item: target, distance: 2.7 })
  pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator.key, '')
})
test('UX-10 · una pared oculta el indicador', () => {
  const { pm, state } = fixture()
  pm._raycast = () => ({ distance: 0.6 })
  pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator, null)
})
test('UX-11 · fuera de cámara no se dibuja', () => {
  const { pm, state, cam } = fixture()
  cam.projectAt = { x: 1.3 }
  pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator, null)
})
test('UX-12 · objetivo detrás del jugador no se dibuja', () => {
  const { pm, state } = fixture({ at: { x: 0, y: 0, z: -2 } })
  pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator, null)
})
test('UX-13 · dialogo, bloqueo del jugador y cambio de objetivo limpian el indicador', () => {
  const { pm, state } = fixture()
  pm._updateInteractionIndicator()
  state.dialog = { text: 'Hola' }; pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator, null)
  state.dialog = null; pm._updateInteractionIndicator()
  assert.ok(state.interactionIndicator)
  pm.control = false; pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator, null)
})
test('UX-14 · la página de evento desactivada no presenta nada', () => {
  const { pm, state } = fixture({ kind: 'event' })
  pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator, null)
})
test('UX-15 · la página de evento activada presenta el anillo', () => {
  const pg = newPage(); pg.showIndicator = true; pg.indicatorZones.key.radius = 2.3
  const { pm, state } = fixture({ kind: 'event', pg })
  pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator.key, 'E')
})
test('UX-16 · Canvas personalizado tiene prioridad: no hay indicador nativo duplicado', () => {
  const { pm, state } = fixture()
  pm.ui.canvases = () => [{ role: 'prompt', shown: true, ui: 'personalizado' }]
  pm.ui.doc = (id) => id === 'personalizado' ? {} : null
  assert.equal(pm._customActionPrompt(), true)
  pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator, null)
})
test('UX-17 · una UI antigua asignada al rol prompt conserva la prioridad', () => {
  const { pm } = fixture()
  pm.project.ui.slots.prompt = 'anterior'
  pm.ui.doc = (id) => id === 'anterior' ? {} : null
  assert.equal(pm._customActionPrompt(), true)
})
test('UX-18 · se conserva la selección original aunque el indicador esté apagado', () => {
  const { pm, state } = fixture({ enabled: false })
  assert.ok(pm.gameplayCand)
  pm._updateInteractionIndicator()
  assert.equal(state.interactionIndicator, null)
  assert.ok(pm.gameplayCand)
})
test('UX-19 · el código de UiRoot usa la presentación espacial sin nuevos listeners', () => {
  const ui = readFileSync(new URL('../src/engine/runtime/ui/UiRoot.vue', import.meta.url), 'utf8')
  assert.match(ui, /rt-spatial-ring/)
  assert.match(ui, /left: spatial\.x/)
  assert.match(ui, /manager\.play\?\.interactionIndicator/)
})
