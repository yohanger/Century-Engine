// G002: patrones configurables y clips existentes, sin añadir física ni control manual.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { shakeConfig, sampleShake, cameraShakeMethods } from '../src/engine/runtime/events/play-camera-shake.js'
import { sampleTrack } from '../src/engine/runtime/anim/eval.js'

const src = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const near = (a, b, tol = 1e-8) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`)
const props = (patch = {}) => ({ camera: 'player', autoPlay: true, enabled: true, loop: true,
  position: [0.2, 0.1, 0.05], rotation: [1, 2, 3], frequency: 2, blendIn: 0, blendOut: 0, ...patch })
const clip = (patch = {}) => ({ id: 'idle-clip', name: 'Camera Idle', duration: 2, speed: 1, loop: false, additive: false,
  events: [{ id: 'event', t: 0.5, name: 'NO EJECUTAR', list: [] }], tracks: [
    { id: 'p', path: '', prop: 'position', keys: [{ t: 0, v: [0, 0, 0], ease: 'linear' }, { t: 1, v: [0.2, 0.1, -0.05], ease: 'inOut' }, { t: 2, v: [0, 0, 0], ease: 'linear' }] },
    { id: 'r', path: '', prop: 'rotation', keys: [{ t: 0, v: [0, 0, 0], ease: 'linear' }, { t: 1, v: [2, 0, 4], ease: 'linear' }, { t: 2, v: [0, 0, 0], ease: 'linear' }] },
  ], ...patch })
const curve = (patch = {}) => props({ pattern: 'clip', clip: 'idle-clip', ...patch })
const objects = (shakes) => ({ project: { objects: shakes, animations: [clip()] }, hasPlayer: true, paused: false, state: { focus: true }, tls: [], film: null, _mainCameraNode: () => null, _nodeEnabled: node => node.active !== false && node.visible !== false })
const node = (id, p) => ({ id, type: 'cameraShake', props: p, visible: true })
const frame = (ctx, dt = 0.25) => {
  const main = ctx._mainCameraNode()
  ctx._cameraActive = ctx.film?.camera ? { kind: 'film' }
    : ctx.tls?.some(r => r.cam) ? { kind: 'timeline' }
      : main?.node ? { kind: 'camera3d', id: main.obj.id }
        : ctx.hasPlayer ? { kind: 'player' } : null
  const output = { position: [0, 0, 0], rotation: [0, 0, 0] }
  const camera = { translateX: (x) => output.position[0] += x, translateY: (y) => output.position[1] += y, translateZ: (z) => output.position[2] += z,
    rotateX: (x) => output.rotation[0] += x, rotateY: (y) => output.rotation[1] += y, rotateZ: (z) => output.rotation[2] += z }
  cameraShakeMethods._shakeFrame.call(ctx, camera, dt)
  return output
}

test('G002-01 patrón de escenas anteriores conserva la oscilación de G001', () => {
  const old = props(); const configured = { ...old, pattern: 'sine' }
  for (const t of [0, 0.07, 0.125, 0.25, 0.7]) assert.deepEqual(sampleShake(old, t), sampleShake(configured, t))
})
test('G002-02 patrones desconocidos vuelven a sine; referencia de clip se guarda por ID', () => {
  assert.equal(shakeConfig(props({ pattern: 'invalid' })).pattern, 'sine')
  assert.equal(shakeConfig(props({ pattern: 'clip', clip: 'stable-ID' })).clip, 'stable-ID')
  assert.equal(shakeConfig(props({ pattern: 'clip', clip: 17 })).clip, '')
})
test('G002-03 ruido determinista, no usa aleatoriedad por fotograma', () => {
  const p = props({ pattern: 'noise' })
  assert.deepEqual(sampleShake(p, 0.157), sampleShake(p, 0.157))
  assert.notDeepEqual(sampleShake(p, 0.157), sampleShake(p, 0.23))
  assert.doesNotMatch(src('src/engine/runtime/events/play-camera-shake.js'), /Math\.random/)
})
test('G002-04 ruido continuo al cruzar muestras enteras', () => {
  const p = props({ pattern: 'noise' })
  for (const t of [0.5, 1, 1.5]) for (let i = 0; i < 3; i++) {
    const a = sampleShake(p, t - 1e-5).position[i]
    const b = sampleShake(p, t + 1e-5).position[i]
    assert.ok(Math.abs(a - b) < 0.0005)
  }
})
test('G002-05 ruido tiene canales independientes', () => {
  const p = props({ pattern: 'noise', position: [1, 1, 1], rotation: [1, 1, 1] })
  const s = sampleShake(p, 0.19)
  assert.notEqual(s.position[0], s.position[1]); assert.notEqual(s.position[0], s.rotation[0] * 180 / Math.PI)
})
test('G002-06 ruido respeta los límites de amplitud del sistema anterior', () => {
  const p = props({ pattern: 'noise', position: [1e5, 1e5, 1e5], rotation: [1e5, 1e5, 1e5] })
  for (const t of [0.1, 0.3, 1, 3.5]) {
    const x = sampleShake(p, t)
    for (const v of x.position) assert.ok(Math.abs(v) <= 1)
    for (const v of x.rotation) assert.ok(Math.abs(v) <= Math.PI / 12 + 1e-10)
  }
})
test('G002-07 ruido no loop finaliza un ciclo y aplica Blend Out', () => {
  const p = props({ pattern: 'noise', loop: false, blendOut: 0.2 })
  assert.equal(sampleShake(p, 0.5), null)
  const a = sampleShake(p, 0.3); const b = sampleShake(p, 0.45)
  assert.ok(a && b && b.position.every(Number.isFinite))
})
test('G002-08 clip de animación usa sampleTrack existente e interpola', () => {
  const c = clip(); const s = sampleShake(curve({ loop: false }), 0.5, [c])
  near(s.position[0], sampleTrack(c.tracks[0], 0.5)[0]); near(s.rotation[0], sampleTrack(c.tracks[1], 0.5)[0] * Math.PI / 180)
})
test('G002-09 Bézier y curvas de animación conservan interpolador original', () => {
  const c = clip({ tracks: [{ id: 'bz', path: '', prop: 'position', keys: [
    { t: 0, v: [0, 0, 0], ease: 'bezier', bz: [0.2, 0, 0.8, 1] }, { t: 2, v: [0.6, 0, 0], ease: 'linear' },
  ] }] })
  near(sampleShake(curve(), 0.7, [c]).position[0], sampleTrack(c.tracks[0], 0.7)[0])
})
test('G002-10 solo la pista raíz actúa; pistas hijas y eventos se ignoran', () => {
  const c = clip({ tracks: [{ id: 'child', path: 'Player/Camera', prop: 'position', keys: [{ t: 0, v: [1, 1, 1] }] }, ...clip().tracks] })
  assert.deepEqual(sampleShake(curve(), 0.5, [c]), sampleShake(curve(), 0.5, [clip()]))
  assert.doesNotMatch(src('src/engine/runtime/events/play-camera-shake.js'), /new AnimRunner|fireFrom\(/)
})
test('G002-11 referencia inexistente no aplica movimientos ni activa otros clips', () => {
  assert.equal(sampleShake(curve({ clip: 'deleted' }), 1, [clip()]), null)
  assert.equal(sampleShake(curve({ clip: '' }), 1, [clip()]), null)
})
test('G002-12 no ejecuta clip sin pistas raíz válidas', () => {
  assert.equal(sampleShake(curve(), 0.2, [clip({ tracks: [{ path: 'Child', prop: 'rotation', keys: [{ t: 0, v: [1, 2, 3] }] }] })]), null)
})
test('G002-13 un clip puede definir solo posición o solo rotación', () => {
  const c = clip({ tracks: [clip().tracks[0]] }); assert.deepEqual(sampleShake(curve(), 0.5, [c]).rotation, [0, 0, 0])
  const r = clip({ tracks: [clip().tracks[1]] }); assert.deepEqual(sampleShake(curve(), 0.5, [r]).position, [0, 0, 0])
})
test('G002-14 velocidad del clip determina la duración real', () => {
  const c = clip({ speed: 2 })
  near(sampleShake(curve({ loop: false }), 0.25, [c]).position[0], sampleTrack(c.tracks[0], 0.5)[0])
  assert.equal(sampleShake(curve({ loop: false }), 1, [c]), null)
})
test('G002-15 bucle de clip produce unión continua', () => {
  const c = clip({ tracks: [{ id: 'p', path: '', prop: 'position', keys: [
    { t: 0, v: [0.1, 0, 0], ease: 'linear' }, { t: 1.5, v: [0.5, 0, 0], ease: 'linear' }, { t: 2, v: [0.4, 0, 0], ease: 'linear' },
  ] }] })
  near(sampleShake(curve(), 2 - 1e-6, [c]).position[0], sampleShake(curve(), 2 + 1e-6, [c]).position[0], 1e-4)
})
test('G002-16 el clip no repetido finaliza y respeta Blend Out', () => {
  const c = clip(); assert.equal(sampleShake(curve({ loop: false }), 2, [c]), null)
  const q = sampleShake(curve({ loop: false, blendOut: 0.5 }), 1.8, [c])
  near(q.position[0], sampleTrack(c.tracks[0], 1.8)[0] * 0.4)
})
test('G002-17 Blend In de curvas influye en todos los ejes', () => {
  const c = clip(); const q = sampleShake(curve({ blendIn: 1 }), 0.5, [c])
  near(q.position[0], sampleTrack(c.tracks[0], 0.5)[0] / 2)
  near(q.rotation[2], sampleTrack(c.tracks[1], 0.5)[2] / 2 * Math.PI / 180)
})
test('G002-18 clips inválidos se rechazan sin offsets NaN', () => {
  const c = clip({ tracks: [{ id: 'broken', path: '', prop: 'position', keys: [{ t: 0, v: [NaN, 0, 0] }] }] })
  assert.equal(sampleShake(curve(), 0.1, [c]), null)
  assert.equal(sampleShake(curve(), 0.1, [clip({ duration: 0 })]), null)
})
test('G002-19 suma de ruido y curva en el mismo Player', () => {
  const ctx = objects([node('noise', props({ pattern: 'noise' })), node('curve', curve())])
  frame(ctx)
  const r = frame(ctx)
  const n = sampleShake(props({ pattern: 'noise' }), 0.05)
  const c = sampleShake(curve(), 0.05, ctx.project.animations)
  for (let i = 0; i < 3; i++) near(r.position[i], n.position[i] + c.position[i])
})
test('G002-20 pausa congela tiempo del clip y excluye cámaras inactivas', () => {
  const ctx = objects([node('curve', curve())])
  frame(ctx); ctx.paused = true
  const a = frame(ctx), b = frame(ctx)
  assert.deepEqual(a, b); near(ctx._shakeClocks.get('curve'), 0.05)
  ctx._mainCameraNode = () => ({ obj: { id: 'other' }, node: {} })
  assert.deepEqual(frame(ctx).position, [0, 0, 0])
})
test('G002-21 Inspector selecciona por ID y abre el editor existente', () => {
  const s = src('src/components/Inspector.vue')
  assert.match(s, /obj\.props\.pattern/)
  assert.match(s, /store\.project\.animations/)
  assert.match(s, /:value="c\.id"/)
  assert.match(s, /@change="sp\('clip', \$event\.target\.value, true\)"/)
})
test('G002-22 por defecto se conserva el nodo existente sin romper escenas anteriores', () => {
  const s = src('src/engine/runtime/nodes/camera-shake.js')
  assert.match(s, /pattern: 'sine'/); assert.match(s, /clip: ''/)
  assert.match(s, /camera: 'player'/)
})
test('G002-23 G003 continúa pendiente: no se añade API de scripting', () => {
  const s = src('src/engine/runtime/events/play-camera-shake.js')
  assert.doesNotMatch(s, /game\.player|game\.cameraShake/)
})
test('G002-24 integración mantiene evaluación al final del fotograma y la restauración', () => {
  const s = src('src/engine/runtime/events/play-controls.js')
  assert.ok(s.indexOf('_shakeRestore(cam)') < s.indexOf('_inputFrame(dt)'))
  assert.ok(s.indexOf('_shakeFrame(cam, dt, stepping)') > s.indexOf('this.film.camera(cam)'))
})
test('G002-25 clip eliminado no acumula reloj mientras falta el recurso', () => {
  const ctx = objects([node('missing', curve({ clip: 'absent' }))])
  frame(ctx)
  assert.equal(ctx._shakeClocks.has('missing'), false)
  ctx.project.objects[0].props.clip = 'idle-clip'
  frame(ctx)
  near(ctx._shakeClocks.get('missing'), 0.05)
})
