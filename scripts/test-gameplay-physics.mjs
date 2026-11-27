// LF-GP-OBJ-PHY-G001: prueba la transición física con las funciones reales y un host Jolt simulado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const file = new URL('../src/engine/runtime/events/play-gameplay-objects.js', import.meta.url)
const src = readFileSync(file, 'utf8')
const methods = runInNewContext(src.replace(/^import .+\n/gm, '').replace('export const gameplayObjectMethods', 'const gameplayObjectMethods') + '\ngameplayObjectMethods', {
  THREE: { Vector3: class {}, Quaternion: class {} }, gameplayRecord() {}, gameplayState() {}, gameplayProfile() {}, gameplayNext() {},
})

function context(type = 'static') {
  const calls = [], state = { status: 'world', inventory: false, flight: false }, node = {
    position: { toArray: () => [3, 4, 5] }, quaternion: { toArray: () => [0, 0, 0, 1] }, updateMatrixWorld() {}, visible: true,
  }
  const obj = { id: 'gp', name: 'Botella', props: { mode: 'direct' } }
  const g = { obj, node, state, info: { record: { id: 1, model: 'prim:box' }, kind: 'items' }, profile: type === 'legacy' ? null : { type, shape: 'box', mass: 2, friction: 0.7, bounce: 0.2 } }
  const body = { id: 'gp', age: 0.3, item: { inWater: false } }
  const ph = { bodies: { velocityOf: () => [2, 3, 4], angularVelocityOf: () => [0.1, 0.2, 0.3] }, setNodeEnabled: (_, on) => calls.push(['enabled', on]), makeKinematic: () => calls.push(['kinematic']), syncNode: () => calls.push(['sync']) }
  const pm = { ...methods, game: { rev: 0, party: { members: [], gain: () => {} } }, phys: ph, _bodies: [], _gpObjects: new Map([['gp', g]]), colliders: [],
    _bodyAdd: (_, cfg) => { calls.push(['add', cfg]); return { id: 'gp' } },
    _gpRemoveBody: () => { calls.push(['remove']) },
    _addColliders: (n, list) => { calls.push(['colliders']); list.push({ parent: n }) },
  }
  return { pm, g, obj, node, state, body, calls, ph }
}

test('GPPHY-01 · Static entra a Dynamic temporal cuando se suelta', () => {
  const { pm, state, calls } = context('static')
  state.status = 'hand'
  pm._gpDrop('gp'); pm._gpSettle('gp')
  assert.equal(state.status, 'world'); assert.equal(state.flight, true)
  assert.equal(calls.filter((c) => c[0] === 'add').length, 1)
  assert.equal(calls.find((c) => c[0] === 'add')[1].mass, 2)
})

test('GPPHY-02 · Dynamic sigue usando su cuerpo normal', () => {
  const { pm, calls } = context('dynamic')
  pm._gpCreateBody(pm._gpRecord('gp'))
  assert.equal(calls.filter(([c]) => c === 'add').length, 1)
})

test('GPPHY-03 · Kinematic también crea un cuerpo temporal durante el vuelo', () => {
  const { pm, state, calls } = context('kinematic')
  state.flight = true; pm._gpCreateBody(pm._gpRecord('gp'))
  assert.equal(calls.filter(([c]) => c === 'add').length, 1)
})

test('GPPHY-04 · None crea solamente el cuerpo temporal', () => {
  const { pm, state, calls } = context('none')
  state.flight = true; pm._gpCreateBody(pm._gpRecord('gp'))
  assert.equal(calls.filter(([c]) => c === 'add').length, 1)
})

test('GPPHY-05 · Static no recupera collider mientras sigue despierto', () => {
  const { pm, state, body, calls } = context('static')
  state.flight = true; pm._gpRest('gp', body, true)
  assert.equal(state.flight, true); assert.deepEqual(calls, [])
})

test('GPPHY-06 · recién creado no se restaura por una lectura temprana de sleep', () => {
  const { pm, state, body, calls } = context()
  state.flight = true; body.age = 0; pm._gpRest('gp', body, false)
  assert.equal(state.flight, true); assert.deepEqual(calls, [])
})

test('GPPHY-07 · Static dormido restaura colisión sin perder pose final', () => {
  const { pm, state, body, calls } = context()
  state.flight = true; pm._gpRest('gp', body, false)
  assert.equal(state.flight, false)
  assert.deepEqual(Array.from(state.position), [3, 4, 5])
  assert.deepEqual(calls.map(([c]) => c), ['remove', 'colliders', 'enabled', 'sync'])
})

test('GPPHY-08 · Dynamic dormido conserva el cuerpo en Jolt', () => {
  const { pm, state, body, calls } = context('dynamic')
  state.flight = true; pm._gpRest('gp', body, false)
  assert.equal(state.flight, false); assert.equal(calls.some(([c]) => c === 'remove'), false)
})

test('GPPHY-09 · Kinematic recupera su colisión y modo original', () => {
  const { pm, state, body, calls } = context('kinematic')
  state.flight = true; pm._gpRest('gp', body, false)
  assert.deepEqual(calls.map(([c]) => c), ['remove', 'colliders', 'kinematic', 'enabled', 'sync'])
})

test('GPPHY-10 · None retira el cuerpo y no activa colisión estática', () => {
  const { pm, state, body, calls } = context('none')
  state.flight = true; pm._gpRest('gp', body, false)
  assert.deepEqual(calls, [['remove'], ['enabled', false]])
})

test('GPPHY-11 · un objeto en el agua no restaura Static durante la flotación', () => {
  const { pm, state, body, calls } = context()
  state.flight = true; body.item.inWater = true
  pm._gpRest('gp', body, false)
  assert.equal(state.flight, true); assert.deepEqual(calls, [])
})

test('GPPHY-12 · guardar en pleno vuelo captura velocidad lineal y angular', () => {
  const { pm, state, body } = context()
  state.flight = true; pm._bodies.push(body); pm._gpCapture()
  assert.equal(state.flight, true)
  assert.deepEqual(Array.from(state.velocity), [2, 3, 4])
  assert.deepEqual(Array.from(state.angularVelocity), [0.1, 0.2, 0.3])
})

test('GPPHY-13 · restauración del vuelo utiliza ambas velocidades', () => {
  const { pm, state, calls } = context('static')
  state.flight = true; state.velocity = [2, 0, 0]; state.angularVelocity = [0, 1, 0]
  pm._gpCreateBody(pm._gpRecord('gp'))
  const opts = calls.find(([c]) => c === 'add')[1]
  assert.deepEqual(Array.from(opts.vel), [2, 0, 0]); assert.deepEqual(Array.from(opts.angularVel), [0, 1, 0])
  assert.equal(state.velocity, null); assert.equal(state.angularVelocity, null)
})

test('GPPHY-14 · volver a agarrar evita cualquier restauración pendiente', async () => {
  const { pm, state, body, calls, g } = context()
  state.flight = true; pm.vm = { slots: new Map([['right', { items: [] }]]), held: new Map() }; pm.player = { _vmNative() {} }
  pm.game.db = { player: {}, system: { maxItems: 99 } }
  pm.game._nativeSignal = () => {}
  pm.game.party.count = () => 0
  pm.viewModelAttach = async () => { pm.vm.held.set('gp', { id: 'gp' }) }
  assert.equal(await pm._gpPickup('gp'), true)
  assert.equal(state.flight, false)
  pm._gpRest('gp', body, false)
  assert.equal(calls.filter(([c]) => c === 'remove').length, 1)
  assert.equal(state.status, 'hand')
})

test('GPPHY-15 · una segunda soltada abre una fase física nueva', () => {
  const { pm, state, calls } = context()
  state.status = 'hand'; pm._gpDrop('gp'); pm._gpSettle('gp')
  const first = calls.filter(([c]) => c === 'add').length
  state.status = 'hand'; pm._gpDrop('gp'); pm._gpSettle('gp')
  assert.equal(first, 1); assert.equal(calls.filter(([c]) => c === 'add').length, 2)
})

test('GPPHY-16 · sin vuelo, un Static no ocupa un cuerpo Dynamic', () => {
  const { pm, calls } = context()
  assert.equal(pm._gpCreateBody(pm._gpRecord('gp')), null)
  assert.deepEqual(calls, [])
})

test('GPPHY-17 · los cuerpos transitorios se recrean al inicializar la escena', () => {
  const { pm, state, calls } = context('none')
  state.flight = true
  pm._gpBodiesInit()
  assert.equal(calls.filter(([c]) => c === 'add').length, 1)
})

test('GPPHY-18 · el sistema de manos no interpola Gameplay Object hacia el suelo', () => {
  const hands = readFileSync(new URL('../src/engine/runtime/player/viewmodel/hands.js', import.meta.url), 'utf8')
  const throwSrc = readFileSync(new URL('../src/engine/runtime/player/viewmodel/hands-throw.js', import.meta.url), 'utf8')
  assert.match(hands, /if \(pm\._gpRecord\?\.\(obj\.id\)\)/)
  assert.match(hands, /this\._vmFlightOrigin/)
  assert.match(throwSrc, /pm\._gpRecord\?\.\(obj\.id\)/)
  assert.match(throwSrc, /body\.push\(dir\.multiplyScalar\(v \* body\.mass\)/)
})

test('GPPHY-19 · los ángulos del vuelo se recuperan mediante el BodySet existente', () => {
  const bodies = readFileSync(new URL('../src/engine/runtime/physics/bodies.js', import.meta.url), 'utf8')
  assert.match(bodies, /GetAngularVelocity/)
  assert.match(bodies, /SetAngularVelocity/)
})
