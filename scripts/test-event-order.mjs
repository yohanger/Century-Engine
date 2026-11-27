// LF-EV-ORDER-G001: prueba los métodos reales del PlayMode sin arrancar Three/Electron.
// El host simula presentación/colisiones; Game e intérprete sí son los del motor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { Game } from '../src/engine/runtime/events/interpreter.js'
import { newCommand } from '../src/engine/runtime/events/commandDefs.js'

const source = (file, exportName, stubs = {}) => {
  const path = new URL(`../src/engine/runtime/events/${file}`, import.meta.url)
  const js = readFileSync(path, 'utf8').replace(/^import .*\n/gm, '').replace(`export const ${exportName}`, `const ${exportName}`)
  return runInNewContext(`${js}\n${exportName}`, {
    THREE: { Vector3: class { constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }) } } },
    LAYER: 1, doc: {}, physicsStep: () => 1 / 60, graphicPhysics: () => null, ...stubs,
  })
}
const eventsMethods = source('play-events.js', 'eventsMethods')
const signalMethods = source('play-signals.js', 'signalMethods')
const controlsMethods = source('play-controls.js', 'controlsMethods')
const inputMethods = source('play-input.js', 'inputMethods')
const page = (trigger = 'action', cond = {}, list = [], graphic = 'none') => ({
  graphic: { kind: graphic }, trigger, cond, list, options: { during: 'free' },
  signal: { name: 'object.dropped', var: 0 }, move: { type: 'fixed' }, gaze: { on: false },
})
const self = (value) => newCommand('selfSwitch', { ch: 'A', value: value ? 'on' : 'off' })
const say = (text) => newCommand('text', { text })
const emit = (name) => newCommand('signal', { name, wait: false })
const wait = (name) => newCommand('waitSignal', { name, timeout: 0 })
const next = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

function fixture(pages = [page()]) {
  const messages = [], visuals = [], errors = []
  let pm
  const g = new Game({ database: { items: [{ id: 1, name: 'Poción' }] }, host: {
    say: async ({ text }) => { messages.push(text) },
    signalEvents: (name, data) => pm._signalEvents(name, data),
    eventHandle: (id) => ({ id, name: 'Prueba' }),
  } })
  const node = {
    position: { x: 0, z: 0 }, rotation: { y: 0 },
    getWorldPosition(v) { v.x = 0; v.y = 0; v.z = 0; return v },
    add() {}, remove() {}, updateMatrixWorld() {},
  }
  const e = { id: 'ev1', obj: { id: 'ev1', name: 'Prueba', scale: [1, 1, 1] },
    props: { reach: 1.2, pages }, node, pageIdx: -2, gfx: null, gfxColl: [],
    erased: false, inside: false, par: null, off: false, quick: 0 }
  pm = {
    ...eventsMethods, ...signalMethods, ...controlsMethods, ...inputMethods,
    _nodeEnabled: () => true, game: g, events: [e], main: null, control: true, ui: { modalOpen: false }, state: { prompt: '', dialog: null },
    body: { radius: 0.3, height: 1.8 }, pos: { x: 0, z: 0 }, hasPlayer: true,
    _lastRev: -1, _dtEv: 0, on: true, phys: null, actors: null,
    colliders: [], project: { database: {} },
    _zone: () => true, _gazeHit: () => true, _lookTick() {},
    _eventPhysicsStop() {}, _eventPhysicsResume() {}, _startAuto() {},
    _buildGfx: () => ({ name: 'Graphic' }), _disposeGfx() {},
    _vmAdopt: (...args) => visuals.push(['held', ...args]),
    _vmStashAdopt: (...args) => visuals.push(['stored', ...args]),
    _addColliders() {}, viewModelStash() {}, viewModelAttach() {},
  }
  g.report = (err, name) => errors.push([name, err.message])
  pm._reconcilePages()
  return { pm, g, e, messages, visuals, errors }
}

// 01 y 02: reconciliación al cambiar un auto-interruptor; antes de una señal en la misma lista.
test('EV-ORDER-01 · self-switch elige la última página válida sin sustituir identidad', () => {
  const { pm, g, e } = fixture([page(), page('action', { self: 'A' })])
  assert.equal(e.pageIdx, 0)
  g.setSelf(e.id, 'A', true)
  pm._reconcilePages()
  assert.equal(e.pageIdx, 1)
  assert.equal(e.id, 'ev1')
})

test('EV-ORDER-02 · emitir tras self-switch alcanza página nueva en la misma ejecución', async () => {
  const p1 = page('action', {}, [self(true), emit('object.dropped')])
  const p2 = page('signal', { self: 'A' }, [say('Recibida')]); p2.signal.name = 'object.dropped'
  const { pm, g, e, messages } = fixture([p1, p2])
  pm._startMain(e)
  await pm.main.done
  await next()
  assert.equal(e.pageIdx, 1)
  assert.deepEqual(messages, ['Recibida'])
})

test('EV-ORDER-03 · señal lógica llega al evento en la mano, E no lo reactiva', async () => {
  const p = page('signal', {}, [say('En mano')]); p.signal.name = 'object.dropped'
  const { pm, g, e, messages } = fixture([p])
  e.held = true
  await g.signal('object.dropped', { objectId: e.id })
  await next()
  assert.deepEqual(messages, ['En mano'])
  pm.cand = e; pm._press()
  assert.equal(pm.main, null)
})

test('EV-ORDER-04 · una página action no comienza waitSignal solo por activarse', async () => {
  const p = page('action', { self: 'A' }, [wait('object.dropped')])
  const { pm, g, e } = fixture([page(), p])
  g.setSelf(e.id, 'A', true)
  pm._events()
  assert.equal(e.pageIdx, 1)
  assert.equal(g.waiters.size, 0)
  assert.equal(pm.main, null)
})

test('EV-ORDER-05 · señal cambia página y termina los comandos de su rama', async () => {
  const p = page('signal', { self: 'A' }, [self(false), say('Después del cambio')])
  const { pm, g, e, messages } = fixture([page(), p])
  g.setSelf(e.id, 'A', true); pm._reconcilePages()
  await g.signal('object.dropped'); await next(); pm._reconcilePages()
  assert.equal(e.pageIdx, 0)
  assert.deepEqual(messages, ['Después del cambio'])
})

test('EV-ORDER-06 · paralelo anterior se cancela y su cierre no borra el nuevo', async () => {
  const { pm, g, e } = fixture([page('parallel', {}, [wait('a')]), page('parallel', { self: 'A' }, [wait('b')])])
  pm._events()
  const old = e.par; assert.ok(old)
  g.setSelf(e.id, 'A', true); pm._events()
  const newer = e.par; assert.ok(newer); assert.notEqual(old, newer)
  await old.done
  assert.equal(e.par, newer)
  assert.equal(old.ctx.cancelled, true)
  newer.cancel(); await newer.done
})

test('EV-ORDER-07 · principal mantiene comandos originales al cambiar página', async () => {
  const { pm, e, messages } = fixture([page('action', {}, [self(true), say('Original')]), page('action', { self: 'A' }, [say('Nueva')])])
  pm._startMain(e)
  await pm.main.done
  assert.deepEqual(messages, ['Original'])
})

test('EV-ORDER-08 · cancelar principal locked libera el control y limpia la espera', async () => {
  const p = page('action', {}, [wait('never')]); p.options.during = 'locked'
  const { pm, e, g } = fixture([p])
  pm._startMain(e)
  assert.equal(pm._playerMode(), 'locked')
  pm._eventStop(e.id)
  await next()
  assert.equal(pm.main, null)
  assert.equal(pm._playerMode(), 'free')
  assert.equal(g.waiters.size, 0)
})

test('EV-ORDER-09 · principal free permite moverse aunque espere, sin duplicarlo', async () => {
  const { pm, e } = fixture([page('action', {}, [wait('never')])])
  pm._startMain(e)
  const run = pm.main
  assert.equal(pm._playerMode(), 'free')
  pm._startMain(e)
  assert.equal(pm.main, run)
  run.cancel(); await run.done
})

test('EV-ORDER-10 · E no ejecuta candidato obsoleto tras cambiar de página', async () => {
  const { pm, g, e, messages } = fixture([page('action', {}, [say('No')]), page('signal', { self: 'A' }, [say('Tampoco')])])
  pm.cand = e
  g.setSelf(e.id, 'A', true)
  pm._press(); await next()
  assert.equal(e.pageIdx, 1)
  assert.deepEqual(messages, [])
  assert.equal(pm.main, null)
})

test('EV-ORDER-11 · cambiar gráficos sostenidos no altera el inventario', () => {
  const { pm, g, e, visuals } = fixture([page('action', {}, [], 'box'), page('action', { self: 'A' }, [], 'sphere'), page('action', { self: 'B' })])
  e.held = true
  g.party.gain('items', 1, 1)
  g.setSelf(e.id, 'A', true); pm._reconcilePages()
  assert.equal(e.pageIdx, 1)
  g.setSelf(e.id, 'B', true); pm._reconcilePages()
  assert.equal(e.pageIdx, 2)
  assert.equal(e.held, true)
  assert.equal(g.party.count('items', 1), 1)
  assert.equal(visuals.length, 1)
})

test('EV-ORDER-12 · señales repetidas no superponen receptor activo', async () => {
  const p = page('signal', {}, [wait('release'), say('Una')]); p.signal.name = 'object.dropped'
  const { pm, g, e, messages } = fixture([p])
  await g.signal('object.dropped'); await g.signal('object.dropped')
  assert.equal(e.runs.size, 1)
  await g.signal('release'); await next()
  assert.deepEqual(messages, ['Una'])
})

test('EV-ORDER-13 · dos receptores; held recibe, stashed y off no', async () => {
  const p = page('signal', {}, [say('Señal')]); p.signal.name = 'object.dropped'
  const { pm, g, e, messages } = fixture([p])
  const second = { ...e, id: 'ev2', obj: { ...e.obj, id: 'ev2' }, props: { ...e.props, pages: [p] }, pageIdx: -2, runs: undefined }
  pm.events.push(second)
  e.held = true; second.stashed = true
  pm._reconcilePages()
  await g.signal('object.dropped'); await next()
  assert.deepEqual(messages, ['Señal'])
  e.off = true
  await g.signal('object.dropped'); await next()
  assert.deepEqual(messages, ['Señal'])
})

test('EV-ORDER-14 · estado nuevo se reconcilia antes de que E evalúe la página', () => {
  const { pm, g, e } = fixture([page('action'), page('action', { self: 'A' })])
  pm.cand = e
  g.setSelf(e.id, 'A', true)
  // No hay cambio automático de página hasta el próximo punto de despacho.
  assert.equal(e.pageIdx, 0)
  pm._press()
  assert.equal(e.pageIdx, 1)
})

test('EV-ORDER-15 · señal emitida durante la aplicación de página se entrega tras estabilizarla', async () => {
  const p = page('signal', { self: 'A' }, [say('Al recibir')]); p.signal.name = 'custom.ready'
  const { pm, g, e, messages } = fixture([page(), p])
  const apply = pm._applyPage
  pm._applyPage = function (inst, idx) {
    apply.call(this, inst, idx)
    if (idx === 1) void g.signal('custom.ready')
  }
  g.setSelf(e.id, 'A', true)
  pm._reconcilePages()
  await next()
  assert.deepEqual(messages, ['Al recibir'])
})

test('EV-ORDER-16 · revisiones circulares se notifican y no bloquean el frame', () => {
  const { pm, g, e, errors } = fixture([page(), page('action', { self: 'A' })])
  const apply = pm._applyPage
  pm._applyPage = function (inst, idx) {
    apply.call(this, inst, idx)
    g.setSelf(e.id, 'A', idx === 0)
  }
  g.setSelf(e.id, 'A', true)
  assert.equal(pm._reconcilePages(), false)
  assert.ok(errors.some(([, msg]) => msg.includes('siguen cambiando')))
})


test('EV-ORDER-17 · disparador Input Map usa la página nueva del mismo frame', async () => {
  const p1 = page('input', {}, [say('Obsoleta')]); p1.input = { action: 'interact' }
  const p2 = page('input', { self: 'A' }, [say('Actual')]); p2.input = { action: 'interact' }
  const { pm, g, e, messages } = fixture([p1, p2])
  pm.input = { anyJustPressed: () => true, anyJustReleased: () => false }
  g.setSelf(e.id, 'A', true)
  pm._inputTriggers(); await next()
  assert.equal(e.pageIdx, 1)
  assert.deepEqual(messages, ['Actual'])
})

test('EV-ORDER-18 · un automático cambia A y el paralelo de la página nueva arranca en ese ciclo', async () => {
  const { pm, g, e } = fixture([page('auto', {}, [self(true)]), page('parallel', { self: 'A' }, [wait('release')])])
  pm._events()
  assert.equal(e.pageIdx, 1)
  assert.ok(e.par)
  const first = e.par
  pm._events()
  assert.equal(e.par, first)
  first.cancel(); await first.done
  assert.equal(g.getSelf(e.id, 'A'), true)
})
