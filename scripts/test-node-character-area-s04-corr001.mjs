// LF-NODE-CHARACTER-AREA-S04-G001_CORR-001 — regresión del paso físico único.
// Se ejecuta el método real de PlayMode con dobles de sus dependencias de interfaz.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const stub = 'data:text/javascript,' + encodeURIComponent(`
export const doc = {};
export const physicsStep = (g) => g.step ?? 1/60;
export const refreshCameraFov = () => {};
`)
const controlsSource = read('src/engine/runtime/events/play-controls.js')
  .replace("from '../platform.js'", `from '${stub}'`)
  .replace("from '../templates/gameParams.js'", `from '${stub}'`)
  .replace("from '../render/camera-fov.js'", `from '${stub}'`)
const { controlsMethods } = await import('data:text/javascript,' + encodeURIComponent(controlsSource))

function fixture({ hasPlayer = false, physical = true, bodyCount = 0 } = {}) {
  const calls = []
  const emit = (name) => calls.push(name)
  const p = {
    ...controlsMethods, on: true, paused: false, state: { focus: true },
    _stepN: 0, _pacc: 0, _alpha: 1, g: { step: 1/60 },
    film: null, hasPlayer, _bodies: Array.from({ length: bodyCount }, () => ({})),
    ed: { tickWorld: () => emit('world') },
    game: { update: () => emit('update'), fixedUpdate: () => emit('fixed'), lateUpdate: () => emit('late') },
    player: { snapshot: () => emit('snapshot'), update: () => emit('player'), late: () => emit('playerLate'), frame: () => emit('playerFrame') },
    phys: physical ? { step: () => { emit('jolt'); emit('spatial') } } : null,
    _timers: () => emit('timers'), _tlUpdate: () => emit('timeline'),
    _profTick: () => emit('profiles'), _lightTick: () => emit('lights'),
    _animTick: () => emit('animation'), _events: () => emit('events'),
    _inputTriggers: () => emit('inputs'), _bodiesTick: () => emit('bodies'),
    _waterFxTick: () => emit('waterFx'), _senseTick: () => emit('sense'),
    cam: { aspect: 1 }, vp: { container: { clientWidth: 800, clientHeight: 800 }, requestRender(){} },
    ui: { sync(){} }, _shakeRestore(){}, _inputFrame(){}, _viewCamera(){}, _tlCamera(){},
    _cameraFrame(){}, _profVolumesTick(){}, _thrownTick(){}, _vmFrame(){}, _updateInteractionIndicator(){},
    _updateHeldActions(){}, _shakeFrame(){},
  }
  return { p, calls, count: (name) => calls.filter(x => x === name).length }
}

for (const scenario of [
  { name: 'sin FPS ni cuerpos dinámicos (CharacterBody3D / Area3D)', hasPlayer: false, bodyCount: 0 },
  { name: 'solo FPS', hasPlayer: true, bodyCount: 0 },
  { name: 'solo RigidBody3D', hasPlayer: false, bodyCount: 1 },
  { name: 'FPS más cuerpos dinámicos', hasPlayer: true, bodyCount: 2 },
]) test(`CORR-PH-01 · ${scenario.name}: un paso por intervalo fijo`, () => {
  const { p, calls, count } = fixture(scenario)
  p._simStep(1/30, 2, 1/60)
  assert.equal(count('jolt'), 2)
  assert.equal(count('spatial'), 2)
  assert.equal(count('fixed'), 2)
  assert.equal(count('player'), scenario.hasPlayer ? 2 : 0)
  assert.equal(count('bodies'), 1)
  assert.equal(count('events'), 1)
  assert.deepEqual(calls.slice(0, 5), ['timers', 'timeline', 'update', 'world', 'snapshot'])
  assert.ok(calls.indexOf('fixed') < calls.indexOf('jolt'))
  assert.ok(calls.lastIndexOf('jolt') < calls.indexOf('events'))
  assert.ok(calls.indexOf('events') < calls.indexOf('inputs'))
  assert.ok(calls.indexOf('inputs') < calls.indexOf('bodies'))
  assert.ok(calls.indexOf('bodies') < calls.indexOf('late'))
})

test('CORR-PH-02 · sin pasos fijos, no se avanza Jolt', () => {
  const { p, count } = fixture()
  p._simStep(1/120, 0, 1/60)
  assert.equal(count('jolt'), 0)
  assert.equal(count('fixed'), 0)
  assert.equal(count('events'), 1)
})
test('CORR-PH-03 · no hay Jolt disponible: se conserva flujo sin fallback nuevo', () => {
  const { p, count } = fixture({ hasPlayer: true, physical: false })
  assert.doesNotThrow(() => p._simStep(1/60, 1, 1/60))
  assert.equal(count('player'), 1)
  assert.equal(count('events'), 1)
})
test('CORR-PH-04 · pausa: no hay simulación; step de depuración hace exactamente un paso', () => {
  const { p, count } = fixture({ hasPlayer: false })
  p.paused = true
  p.frame(1/30)
  assert.equal(count('jolt'), 0)
  p._stepN = 1
  p.frame(1/30)
  assert.equal(count('jolt'), 1)
  p.frame(1/30)
  assert.equal(count('jolt'), 1)
})
test('CORR-PH-05 · reanudar: acumulador fijo conserva sobrante de render', () => {
  const { p, count } = fixture({ hasPlayer: false })
  p.frame(1/120)
  assert.equal(count('jolt'), 0)
  p.frame(1/120)
  assert.equal(count('jolt'), 1)
  p.frame(1/60)
  assert.equal(count('jolt'), 2)
})
test('CORR-PH-06 · Film Maker: cada paso de 1/60 actualiza Jolt sin FPS', () => {
  const { p, count } = fixture()
  p.film = { acc: 0, time: 0, steps: 0 }
  p.frame(1/30)
  assert.equal(count('jolt'), 2)
  assert.equal(p.film.steps, 2)
  assert.equal(count('player'), 0)
})
test('CORR-PH-07 · FPS ya no tiene su propio paso de Jolt', () => {
  const movement = read('src/engine/runtime/player/fps/movement.js')
  assert.doesNotMatch(movement, /\bph\.step\s*\(/)
  assert.match(movement, /ph\.createCharacter\(/)
  assert.match(movement, /ph\.moveCharacter\(/)
})
test('CORR-PH-08 · bodiesTick solo sincroniza; no ejecuta Jolt como respaldo', () => {
  const bodies = read('src/engine/runtime/events/play-bodies.js')
  assert.doesNotMatch(bodies, /\bph\.step\s*\(/)
  assert.doesNotMatch(bodies, /\bph\.stepped\b/)
  assert.match(bodies, /ph\.bodies\.remove/)
})
test('CORR-PH-09 · único punto del avance de Jolt, sin temporizador paralelo', () => {
  assert.match(read('src/engine/runtime/events/play-controls.js'), /this\.phys\?\.step\(fdt\)/)
  assert.match(read('src/engine/runtime/physics/jolt.js'), /this\.nodeSpatial\?\.tick\(dt\)/)
  assert.doesNotMatch(read('src/engine/runtime/physics/jolt.js'), /this\.stepped\s*=/)
})
test('CORR-PH-10 · paso de escena sin jugador conserva sensores y efectos en orden', () => {
  const { p, calls } = fixture({ hasPlayer: false })
  p._simStep(1/60, 1, 1/60)
  assert.ok(calls.indexOf('spatial') < calls.indexOf('events'))
  assert.ok(calls.indexOf('events') < calls.indexOf('sense'))
  assert.ok(calls.indexOf('sense') < calls.indexOf('late'))
})
