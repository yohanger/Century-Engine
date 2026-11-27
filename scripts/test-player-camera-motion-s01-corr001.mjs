import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { stepsMethods } from '../src/engine/runtime/player/fps/steps.js'

// Evalúa la declaración REAL de FpsPlayer con dependencias inyectadas para verificar
// las rutas de pasos sin instalar Three/Jolt/Electron en el runner Node.
const src = readFileSync(new URL('../src/engine/runtime/player/fps/index.js', import.meta.url), 'utf8')
const PlayerController = class { constructor(play) { this.play = play; this.pos = { x: 0, y: 0, z: 0 }; this.body = {} } }
const empty = {}
const cameraMotionMethods = {
  _cameraMotionTick(dt) { this.motionTicks.push(dt) },
}
const scope = {
  PlayerController,
  PLAYER_DEFAULTS: { height: 1.7, radius: 0.3, eyeHeight: 1.55, stepHeight: 0.4, walk: 4 },
  movementMethods: { _resetMotion() {} },
  lookMethods: empty, cameraMethods: empty, stepsMethods, cameraMotionMethods,
  apiMethods: empty, handsMethods: empty, waterMethods: empty,
}
const js = src.replace(/^import .*$/gm, '').replace(/^export \{.*$/gm, '').replace('export class FpsPlayer', 'class FpsPlayer')
  + '\n;global_result.FpsPlayer = FpsPlayer'
const global_result = {}
runInNewContext(js, { ...scope, global_result })
const { FpsPlayer } = global_result

function scenario({ audio = true, surface = 'stone', cfg = {} } = {}) {
  const events = []
  const layer = { name: 'Stone', surface: 'stone', steps: { walk: ['foot.wav'], run: ['run.wav'], land: ['land.wav'], jump: ['jump.wav'] } }
  const play = {
    control: true,
    g: { walk: 4, run: 8 },
    game: { db: { player: { footsteps: true, footVolume: 0.6, ...cfg } }, emit(name, payload) { events.push({ name, payload }) } },
    project: { tagLayers: { layers: [layer] } },
    surfaceAt(_x, _y, _z, info) { info.layer = 0; return surface },
    audio: audio ? { script: { play(file) { events.push({ name: 'audio', file }) } } } : null,
  }
  const fps = new FpsPlayer(play)
  fps.motionTicks = []
  fps.grounded = true
  return { fps, events, play }
}

test('PCM-CORR-01: FpsPlayer expone footstep y jumpSound del módulo existente', () => {
  assert.equal(FpsPlayer.prototype.footstep, stepsMethods.footstep)
  assert.equal(FpsPlayer.prototype.jumpSound, stepsMethods.jumpSound)
  assert.equal(FpsPlayer.prototype.late.toString().includes('_cameraMotionTick'), true)
})
test('PCM-CORR-02: caminar emite un paso y no interrumpe late ni Camera Shake', () => {
  const { fps, events } = scenario()
  fps.late(0.1)
  fps.pos.x = 0.6
  assert.doesNotThrow(() => fps.late(0.1))
  fps.pos.x = 1.2
  assert.doesNotThrow(() => fps.late(0.1))
  assert.equal(events.some(e => e.name === 'footstep' && e.payload.action === 'walk'), true)
  assert.equal(events.some(e => e.name === 'audio' && e.file === 'foot.wav'), true)
  assert.deepEqual(fps.motionTicks, [0.1, 0.1, 0.1])
})
test('PCM-CORR-03: el salto reproduce el método existente sin romper la sesión', () => {
  const { fps, events } = scenario()
  fps.jumpSound()
  assert.equal(events.some(e => e.name === 'footstep' && e.payload.action === 'jump'), true)
})
test('PCM-CORR-04: aterrizar desde una caída emite el paso de aterrizaje', () => {
  const { fps, events } = scenario()
  fps.late(0.1)
  fps.grounded = false; fps.vy = -10
  fps.late(0.1)
  fps.grounded = true; fps.vy = 0
  assert.doesNotThrow(() => fps.late(0.1))
  assert.equal(events.some(e => e.name === 'footstep' && e.payload.landing === true), true)
})
test('PCM-CORR-05: sin audio de pasos, Camera Shake continúa ejecutándose', () => {
  const { fps, events } = scenario({ cfg: { footsteps: false }, audio: false })
  fps.late(0.1); fps.pos.x = 1.2; fps.late(0.1)
  assert.equal(events.length, 0)
  assert.deepEqual(fps.motionTicks, [0.1, 0.1])
})
test('PCM-CORR-06: sin clip ni audio no se rompe la señal de superficie reconocida', () => {
  const { fps, events } = scenario({ audio: false })
  fps.late(0.1); fps.pos.x = 0.6; fps.late(0.1); fps.pos.x = 1.2; fps.late(0.1)
  assert.equal(events.some(e => e.name === 'footstep'), true)
})
test('PCM-CORR-07: reinicio de escena descarta el estado de pasos sin cambiar el módulo', () => {
  const { fps } = scenario()
  fps.late(0.1)
  assert.notEqual(fps.steps, null)
  fps.sceneReset()
  assert.equal(fps.steps, null)
})
