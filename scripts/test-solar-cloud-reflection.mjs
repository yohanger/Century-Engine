import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { World } from '../src/engine/runtime/world/world.js'
import { cloudBeamTransmission } from '../src/engine/runtime/world/weather.js'
import { SKY_FRAG } from '../src/engine/runtime/render/skylib.js'
import { envMethods } from '../src/engine/runtime/render/viewport-env.js'

test('la cubierta y la lluvia extinguen la mayor parte del haz sin forzar transmisión a cero', () => {
  const scene = { lightingMode: 'cycle', time: { hour: 12, flow: false }, weather: { on: true, cloudModel: 'classic', preset: 'clear' } }
  const world = new World().configure(scene)
  const clear = world.frame().sunDirectMul
  assert.ok(clear > 0.95)
  world.setWeather('cloudy', 1, 0)
  const cloudy = world.frame().sunDirectMul
  assert.ok(cloudy > 0 && cloudy < clear / 2)
  for (const weather of ['overcast', 'rain', 'storm']) {
    world.setWeather(weather, 1, 0)
    const frame = world.frame()
    assert.ok(frame.solarTransmission > 0 && frame.solarTransmission < 0.02)
    assert.ok(frame.sunDirectMul > 0 && frame.sunDirectMul < 0.02)
    assert.ok(frame.ambientMul > 0)
    assert.ok(frame.sunMul > 0) // dispersión que ilumina las nubes
  }
})

test('una capa espesa o un trayecto rasante atenúan más la luz', () => {
  const thick = cloudBeamTransmission(0.82, 1.1)
  assert.ok(thick > 0 && thick < 0.18)
  assert.equal(cloudBeamTransmission(0.25, 1.5), 1)
  assert.ok(cloudBeamTransmission(1, 0.1) > 0.6)
  assert.ok(cloudBeamTransmission(0.82, 1.1, 0.05) < thick)
  const world = new World().configure({ lightingMode: 'cycle', cloudsOn: true, cloudsCoverage: 0.82, cloudsDensity: 1.1 })
  assert.ok(world.frame().solarTransmission < 0.18)
  assert.match(SKY_FRAG, /beamTransmission = uClouds == 1 \? 1\.0 : uSolarTransmission/)
})

test('las capturas respetan las nubes sin modificar el sol manual ni las otras luces', () => {
  const sun = { visible: true, intensity: 7 }, fill = { visible: true, intensity: 3 }
  const vp = { _manualSunTransmission: 0, editorSun: { visible: false }, authoredSun: () => sun }
  // Viewport trae workers de Vite. Esta comprobación de estado ejecuta su método sin montar WebGL.
  const source = readFileSync(new URL('../src/engine/runtime/render/viewport.js', import.meta.url), 'utf8')
  const start = source.indexOf('  _drawWithSolarTransmission(draw)')
  const end = source.indexOf('\n  }', start) + 4
  const draw = Function(`return ({${source.slice(start, end)}})._drawWithSolarTransmission`)()
  assert.throws(() => draw.call(vp, () => {
    assert.deepEqual(sun, { visible: false, intensity: 0 })
    assert.equal(fill.intensity, 3)
    throw Error('fallo simulado de captura')
  }), /fallo simulado/)
  assert.deepEqual(sun, { visible: true, intensity: 7 })
  vp._manualSunTransmission = 0.5
  draw.call(vp, () => assert.equal(sun.intensity, 3.5))
  assert.equal(sun.intensity, 7)
})

test('la dirección manual se usa para medir la oclusión del haz en las nubes por celdas', () => {
  const world = new World().configure({ lightingMode: 'manual', weather: { on: true, cloudModel: 'cells', preset: 'clear' } })
  const direction = [0, 0.6, 0.8]
  let sampled
  world.field.opticalDepthAlongRay = (_origin, dir) => { sampled = [...dir]; return 4 }
  world.setAuthoredSunDirection(direction)
  const frame = world.frame()
  assert.deepEqual(sampled, direction)
  assert.ok(Math.abs(frame.solarTransmission - Math.exp(-4)) < 1e-8)
})

test('el campo mide la luna en su propio ángulo después de cambiar la hora', () => {
  const world = new World().configure({ lightingMode: 'cycle', time: { hour: 12 }, weather: { on: true, cloudModel: 'cells', preset: 'cloudy' } })
  const rays = []
  world.field.opticalDepthAlongRay = (_origin, dir) => { rays.push([...dir]); return 2 }
  let frame = world.frame()
  assert.deepEqual(rays.pop(), frame.sunDir)
  assert.equal(frame.moonMul, 0)
  world.setHour(0)
  world.update(0.016)
  frame = world.frame()
  assert.deepEqual(rays.pop(), frame.moonDir)
  assert.equal(frame.lunarTransmission, Math.exp(-2))
  assert.equal(frame.moonMul, frame.moonCloudMul * Math.exp(-2))
})

test('lluvia reduce luz lunar directa, conserva la fuente del volumen y toma su dirección para los haces', () => {
  const env = { lightingMode: 'cycle', time: { hour: 0 }, weather: { on: true, cloudModel: 'classic', preset: 'clear' } }
  const world = new World().configure(env)
  const clear = { ...world.frame() }
  world.setWeather('cloudy', 1)
  const cloudy = { ...world.frame() }
  world.setWeather('rain', 1)
  const rain = world.frame()
  assert.equal(rain.moonCloudMul, clear.moonCloudMul)
  assert.equal(rain.moonVis, clear.moonVis)
  assert.ok(rain.moonMul > 0 && rain.moonMul < cloudy.moonMul && cloudy.moonMul < clear.moonMul)
  assert.ok(rain.ambientMul < 0.08)
  const fog = envMethods._buildFogState.call({ _rawEnv: env, _wf: rain }, {
    fog: true, fogColor: rain.fog.color, fogDensity: rain.fog.density, cloudsOn: true,
  })
  assert.equal(fog.physical, true)
  assert.equal(fog.weatherHaze, true)
  assert.equal(fog.cloudShaftMask, true)
  assert.deepEqual(fog.sunDir, rain.moonDir)
  assert.equal(fog.sunIntensity, rain.moonMul)
})
