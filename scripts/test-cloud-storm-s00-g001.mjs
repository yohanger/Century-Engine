// LF-CLOUD-STORM-S00-G001: contrato de World, transición y fuente física compartida.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { World } from '../src/engine/runtime/world/world.js'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const make = weather => new World(72).configure({ weather: {
  on: true, preset: 'partly', cloudModel: 'classic', lightning: true,
  lightningModel: 'physical', maxStrikes: 0, director: false, ...weather,
} })

test('CS-01: sin transición no hay frente de tormenta ni destello artificial', () => {
  const w = make()
  const f = w.frame()
  assert.equal(f.stormFront.strength, 0)
  assert.equal(f.cloudLightning.intensity, 0)
  assert.equal(f.cloudLightning.radius, 0)
})

test('CS-02: la llegada de tormenta usa el mismo tiempo interpolado por World', () => {
  const w = make()
  w.setWeather('storm', 1, 20)
  const f0 = w.frame()
  assert.ok(f0.stormFront.strength > 0)
  assert.equal(f0.stormFront.progress, 0)
  const same = f0.stormFront
  w.update(5, { clock: false })
  const progress = w.frame().stormFront.progress
  assert.equal(w.frame().stormFront, same, 'sin objeto nuevo cada frame')
  assert.ok(progress > 0.1 && progress < 0.3, progress)
  assert.ok(w.cur.coverage > 0.12 && w.cur.coverage < 1)
  assert.ok(Math.abs(Math.hypot(same.x, same.z) - 1) < 1e-9)
  w.update(20, { clock: false })
  assert.equal(w.frame().stormFront.strength, 0, 'no queda frente al terminar')
})

test('CS-03: otros cambios meteorológicos no generan un frente falso', () => {
  const w = make()
  w.setWeather('overcast', 1, 20)
  w.update(5)
  assert.equal(w.frame().stormFront.strength, 0)
  w.setWeather('storm', 1, 20)
  w.update(3)
  assert.ok(w.frame().stormFront.strength > 0)
  w.setWeather('partly', 1, 20)
  assert.equal(w.frame().stormFront.strength, 0)
})

test('CS-04: el origen del flash sigue a la descarga física y queda anclado al mundo', () => {
  const w = make({ preset: 'storm' })
  w.setObserver(12, 3, 35)
  const messages = []
  w.on('lightning', e => messages.push(e))
  w.strike(1200, 90)
  const s = w.frame().strike, light = w.frame().cloudLightning
  assert.equal(messages.length, 1)
  assert.equal(s.id, 1)
  assert.ok(Math.abs(s.cloud[0] - 1212) < 1e-7)
  assert.ok(Math.abs(s.cloud[2] - 35) < 1e-7)
  assert.ok(light.intensity > 0)
  assert.ok(light.radius >= 350)
  const source = [...s.cloud]
  w.setObserver(-6000, 20, 9000)
  w.update(0.02)
  assert.deepEqual(w.frame().strike.cloud, source)
  assert.deepEqual([light.x, light.y, light.z], source)
  assert.equal(messages.length, 1, 'no se emite un segundo evento por iluminar las nubes')
})

test('CS-05: la luz en la nube se apaga al finalizar la descarga', () => {
  const w = make({ preset: 'storm' })
  w.strike(800, 0)
  assert.ok(w.frame().cloudLightning.intensity > 0)
  w.update(1.0)
  assert.equal(w.frame().cloudLightning.intensity, 0)
  assert.equal(w.frame().cloudLightning.radius, 0)
})

test('CS-06: el modo simple y clima desactivado no inventan una fuente localizada', () => {
  const simple = make({ preset: 'storm', lightningModel: 'simple' })
  simple.strike(700, 0)
  assert.equal(simple.frame().cloudLightning.intensity, 0)
  const off = make({ on: false, preset: 'storm' })
  off.strike(700, 0)
  assert.equal(off.frame().cloudLightning.intensity, 0)
  assert.equal(off.frame().stormFront.strength, 0)
})

test('CS-07: la integración utiliza el raymarch y los uniformes existentes', () => {
  const sky = read('src/engine/runtime/render/skylib.js')
  const env = read('src/engine/runtime/render/viewport-env.js')
  const viewport = read('src/engine/runtime/render/viewport.js')
  assert.match(sky, /float stormFrontMask\(vec3 p\)/)
  assert.match(sky, /vec3 internalFlash = vec3\(0\.0\)/)
  assert.match(sky, /acc\+=T\*alpha\*internalFlash\*uCTint/)
  for (const uniform of ['uStormFront', 'uLightningCloud', 'uLightningEnergy']) {
    assert.ok(sky.includes(uniform))
    assert.ok(viewport.includes(uniform))
    assert.ok(env.includes(uniform))
  }
  assert.match(env, /u\.uFlash\.value = 0; u\.uLightningEnergy\.value = 0/)
  assert.doesNotMatch(env, /vecteezy|PlaneGeometry\(/)
})

test('CS-08: Edición conserva cielo estático y el mismo mecanismo de Runtime', () => {
  const viewport = read('src/engine/runtime/render/viewport.js')
  const scene = read('src/engine/runtime/scene-graph.js')
  assert.match(viewport, /uTime\.value = this\.playing \?/)
  assert.doesNotMatch(scene, /this\.world\.update\(dt, \{ clock: false \}\)/)
  assert.match(viewport, /new LightningFX\(this\.scene\)/)
  assert.match(viewport, /SKY_FRAG/)
})
