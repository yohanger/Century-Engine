// LF-INPUT-MOUSE-G001: comprobamos el Input Map real y los métodos de manos sin arrancar Three.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { defaultInputMap, normalizeInputMap, findAction, InputState, resetAction, setBindings } from '../src/engine/runtime/input/inputmap.js'
import { heldObjectActions } from '../src/engine/runtime/events/play-held-actions.js'
import { systemText } from '../src/engine/runtime/i18n/system-texts.js'
import { PLAYER_PARAMS, PLAYER_DEFAULTS, normalizePlayer } from '../src/engine/runtime/database/player.js'

const bindings = (map, name) => findAction(map, name)?.bindings || []
const oldMap = () => ({ actions: [
  { name: 'interact', bindings: ['KeyE', 'Mouse0', 'Mouse2', 'Pad2'] },
  { name: 'drop', bindings: ['Mouse0', 'Mouse2', 'KeyG', 'Pad1'] },
  { name: 'custom_aim', bindings: ['Mouse2'] },
  { name: 'gp_store', bindings: ['KeyZ'] },
] })

function handRunner() {
  // Carga el método original. En esta prueba no hay Three.js porque solo ejecutamos _dropInput.
  const text = readFileSync(new URL('../src/engine/runtime/player/viewmodel/hands-throw.js', import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '').replace('export const throwMethods =', 'globalThis.throwMethods =')
  const vm = { held: new Map(), slots: new Map([['right', { items: [] }]]) }
  const input = new InputState(defaultInputMap())
  const actions = []
  const pm = { input, game: { db: { player: { dropEnabled: true, throwMax: 17 } } }, state: { focus: true }, ui: { modalOpen: false } }
  const context = { THREE: {}, _q: () => {}, _v: () => {} }
  runInNewContext(text, context, { filename: 'hands-throw.js' })
  const p = { ...context.throwMethods, play: pm, vm,
    viewModelRelease: (args) => { actions.push(['drop', args.target]); return Promise.resolve(true) },
    viewModelThrow: (args) => { actions.push(['throw', args.target, args.speed]); return Promise.resolve(true) },
  }
  const h = { id: 'botella' }
  vm.held.set('botella', h); vm.slots.get('right').items.push(h)
  return { input, pm, p, actions, vm }
}

function press(i, key) { i.set(key, 1); i.step() }
function release(i, key) { i.set(key, 0); i.step() }

test('INPUT-01 · E, G y T tienen acciones independientes, sin clic izquierdo ni derecho', () => {
  const map = defaultInputMap()
  assert.deepEqual(bindings(map, 'interact'), ['KeyE', 'Enter', 'NumpadEnter', 'Space', 'Pad2'])
  assert.deepEqual(bindings(map, 'drop'), ['KeyG', 'Pad1'])
  assert.deepEqual(bindings(map, 'throw'), ['KeyT'])
  for (const a of map.actions) assert.equal(a.bindings.includes('Mouse0') || a.bindings.includes('Mouse2'), false, a.name)
})
test('INPUT-02 · el mapa antiguo deja libres los clics integrados sin borrar las acciones propias', () => {
  const map = normalizeInputMap(oldMap())
  assert.deepEqual(bindings(map, 'interact'), ['KeyE', 'Pad2'])
  assert.deepEqual(bindings(map, 'drop'), ['KeyG', 'Pad1'])
  assert.deepEqual(bindings(map, 'throw'), ['KeyT'])
  assert.deepEqual(bindings(map, 'custom_aim'), ['Mouse2'])
  assert.deepEqual(bindings(map, 'gp_store'), ['KeyZ'])
})
test('INPUT-03 · las acciones sin asignación explícita toman la fábrica, las vaciadas permanecen vacías', () => {
  const map = normalizeInputMap({ actions: [{ name: 'drop', bindings: [] }] })
  assert.deepEqual(bindings(map, 'drop'), [])
  assert.deepEqual(bindings(map, 'throw'), ['KeyT'])
  assert.deepEqual(bindings(map, 'interact'), ['KeyE','Enter','NumpadEnter','Space','Pad2'])
})
test('INPUT-04 · reset recupera G y T independientes, y nunca añade clics de ratón', () => {
  const map = normalizeInputMap(oldMap())
  setBindings(map, 'throw', ['KeyZ'])
  resetAction(map, 'throw'); resetAction(map, 'interact'); resetAction(map, 'drop')
  assert.deepEqual(bindings(map, 'throw'), ['KeyT'])
  assert.deepEqual(bindings(map, 'drop'), ['KeyG','Pad1'])
  assert.equal(bindings(map, 'interact').includes('Mouse0'), false)
})
test('INPUT-05 · clic izquierdo y derecho no disparan acciones nativas en un proyecto antiguo', () => {
  const i = new InputState(normalizeInputMap(oldMap()))
  i.set('Mouse0', 1); i.set('Mouse2', 1); i.step()
  assert.equal(i.justPressed('interact'), false)
  assert.equal(i.justPressed('drop'), false)
  assert.equal(i.justPressed('throw'), false)
})
test('INPUT-06 · al pulsar G suelta inmediatamente, sin esperar a liberarla', () => {
  const { input, p, actions } = handRunner()
  press(input, 'KeyG'); p._dropInput()
  assert.deepEqual(actions, [['drop', 'botella']])
  input.step(); p._dropInput()
  assert.equal(actions.length, 1)
  release(input, 'KeyG'); p._dropInput()
  assert.equal(actions.length, 1)
})
test('INPUT-07 · mantener G no lanza, aunque pasen más fotogramas', () => {
  const { input, p, actions } = handRunner()
  press(input, 'KeyG'); p._dropInput()
  for (let n = 0; n < 40; n++) { input.step(); p._dropInput() }
  release(input, 'KeyG'); p._dropInput()
  assert.deepEqual(actions, [['drop', 'botella']])
})
test('INPUT-08 · T lanza al pulsar y utiliza la velocidad configurada en Database', () => {
  const { input, p, actions } = handRunner()
  press(input, 'KeyT'); p._dropInput()
  assert.deepEqual(actions, [['throw', 'botella', 17]])
  input.step(); p._dropInput()
  assert.equal(actions.length, 1)
})
test('INPUT-09 · con soltar desactivado, T y G no manipulan el objeto', () => {
  const { input, p, pm, actions } = handRunner()
  pm.game.db.player.dropEnabled = false
  press(input, 'KeyT'); p._dropInput()
  release(input, 'KeyT'); press(input, 'KeyG'); p._dropInput()
  assert.deepEqual(actions, [])
})
test('INPUT-10 · diálogo, pérdida de foco y modal bloquean G y T', () => {
  const { input, p, pm, actions } = handRunner()
  pm.state.focus = false; press(input, 'KeyT'); p._dropInput()
  pm.state.focus = true; pm.state.dialog = {}; release(input, 'KeyT'); press(input, 'KeyG'); p._dropInput()
  pm.state.dialog = null; pm.ui.modalOpen = true; release(input, 'KeyG'); press(input, 'KeyT'); p._dropInput()
  assert.deepEqual(actions, [])
})
test('INPUT-11 · si se queda sin objeto no ejecuta nada', () => {
  const { input, p, vm, actions } = handRunner()
  vm.held.clear(); vm.slots.get('right').items = []
  press(input, 'KeyG'); p._dropInput()
  assert.deepEqual(actions, [])
})
test('INPUT-12 · si G y T se configuran iguales, una pulsación ejecuta solo Soltar', () => {
  const { input, p, actions } = handRunner()
  setBindings(input.map, 'throw', ['KeyG'])
  press(input, 'KeyG'); p._dropInput()
  assert.deepEqual(actions, [['drop', 'botella']])
})
test('INPUT-13 · la UI usa G y T, y el texto nativo ya no dice mantener', () => {
  const held = { id: 'obj', slot: 'right' }
  const game = { lang: 'es', translate: () => null, db: { player: { dropEnabled: true } } }
  const result = heldObjectActions({ held, input: new InputState(defaultInputMap()), game })
  assert.deepEqual(result.map((x) => [x.id, x.key, x.label]), [['drop','G','Soltar'], ['throw','T','Lanzar']])
  assert.equal(systemText('ui.held.throw', 'en'), 'Throw')
})
test('INPUT-14 · al quitar T no se anuncia Lanzar y Soltar permanece', () => {
  const i = new InputState(defaultInputMap()); setBindings(i.map, 'throw', [])
  const rows = heldObjectActions({ held: { id: 'obj' }, input: i, game: { lang: 'es', translate: () => null } })
  assert.deepEqual(rows.map((r) => r.id), ['drop'])
})
test('INPUT-15 · Database conserva la velocidad antigua, sin controles de tiempo de pulsación', () => {
  const normalized = normalizePlayer({ dropTap: 0.25, throwHold: 1, throwMin: 3, throwMax: 21 })
  assert.equal(normalized.throwMax, 21)
  assert.equal(normalized.dropTap, undefined)
  assert.equal(normalized.throwHold, undefined)
  assert.equal(PLAYER_DEFAULTS.throwMax, 14)
  assert.equal(PLAYER_PARAMS.some((p) => ['dropTap', 'throwHold', 'throwMin'].includes(p.key)), false)
})
