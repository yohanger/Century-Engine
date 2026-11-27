// G004 — Integración de las recetas, reproducción y cámaras existentes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cameraShakeMethods, sampleShake } from '../src/engine/runtime/events/play-camera-shake.js'

const EPS = 1e-8
const near = (a, b, eps = EPS) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`)
const code = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const recipe = (changes = {}) => ({ camera: 'player', enabled: true, autoPlay: true, loop: true,
  pattern: 'sine', clip: '', position: [0.2, 0.08, -0.04], rotation: [0, 2, 1],
  frequency: 1, blendIn: 0, blendOut: 0, ...changes })
const shake = (id, changes = {}) => ({ id, name: `Shake ${id}`, type: 'cameraShake', visible: true, props: recipe(changes) })
const cameraNode = (id) => ({ id, name: `Camera ${id}`, type: 'camera', visible: true, props: { main: true } })
const clip = () => ({ id: 'curve-a', name: 'Move', duration: 1, speed: 1, tracks: [
  { path: '', prop: 'position', keys: [ { t: 0, v: [0, 0, 0], ease: 'linear' }, { t: 0.5, v: [0.08, 0.03, -0.05], ease: 'linear' }, { t: 1, v: [0, 0, 0], ease: 'linear' } ] },
  { path: '', prop: 'rotation', keys: [ { t: 0, v: [0, 0, 0], ease: 'linear' }, { t: 0.5, v: [3, 1, 0], ease: 'linear' }, { t: 1, v: [0, 0, 0], ease: 'linear' } ] },
], events: [{ t: 0.5, name: 'NO_EJECUTAR', list: [] }] })
function scene(nodes, options = {}) {
  const project = { objects: nodes, animations: [clip()] }
  return Object.assign(Object.create(cameraShakeMethods), {
    project, _shakeClocks: new Map(), hasPlayer: true, state: { focus: true }, paused: false, tls: [], film: null,
    _mainCameraNode: () => null,
    // El host real aporta esta política de NodeLifecycle desde PlayMode.
    _nodeEnabled: node => node.active !== false && node.visible !== false,
    _find(ref, kind) { return this.project.objects.find((o) => (!kind || o.type === kind) && (o.id === ref || o.name.toLowerCase() === String(ref).toLowerCase())) ?? null },
    ...options,
  })
}
function render(w, seconds = 0.05, stepping = false) {
  // Camera Orchestration escribe _cameraActive antes de _shakeFrame. Este harness
  // inyecta su resolución de fuente para probar Shake sin crear otro orquestador.
  const main = w._mainCameraNode()
  w._cameraActive = w.film?.camera ? { kind: 'film' }
    : w.tls?.some(r => r.cam) ? { kind: 'timeline' }
      : main?.node ? { kind: 'camera3d', id: main.obj.id }
        : w.hasPlayer ? { kind: 'player' } : null
  const out = { position: [0, 0, 0], rotation: [0, 0, 0] }
  const cam = {
    translateX: (v) => { out.position[0] += v }, translateY: (v) => { out.position[1] += v }, translateZ: (v) => { out.position[2] += v },
    rotateX: (v) => { out.rotation[0] += v }, rotateY: (v) => { out.rotation[1] += v }, rotateZ: (v) => { out.rotation[2] += v },
  }
  w._shakeFrame(cam, seconds, stepping)
  return out
}
function physicalCamera(x = 7) {
  const vector = (value) => ({ value, clone() { return vector(this.value) }, copy(other) { this.value = other.value } })
  return {
    position: vector(x), quaternion: vector(4),
    translateX(v) { this.position.value += v }, translateY(v) { this.position.value += v }, translateZ(v) { this.position.value += v },
    rotateX(v) { this.quaternion.value += v }, rotateY(v) { this.quaternion.value += v }, rotateZ(v) { this.quaternion.value += v },
  }
}

test('G004-01 AutoPlay FPS: receta → muestreo → composición del fotograma', () => {
  const p = recipe(), w = scene([shake('idle')])
  render(w)
  const frame = render(w)
  const expected = sampleShake(p, 0.05)
  expected.position.forEach((v, i) => near(frame.position[i], v))
  expected.rotation.forEach((v, i) => near(frame.rotation[i], v))
})
test('G004-02 cámara de escena: referencia estable por ID, sin desviar efecto al FPS', () => {
  const n = shake('scene', { camera: 'cam-01' }), w = scene([n, cameraNode('cam-01')])
  assert.deepEqual(render(w).position, [0, 0, 0])
  assert.equal(w._shakeClocks.has('scene'), false)
  w._mainCameraNode = () => ({ node: {}, obj: cameraNode('cam-01') })
  render(w); assert.notDeepEqual(render(w).position, [0, 0, 0])
  w._mainCameraNode = () => ({ node: {}, obj: cameraNode('cam-02') })
  assert.deepEqual(render(w).position, [0, 0, 0])
})
test('G004-03 seno, ruido y curvas se combinan en una cámara sin doble reloj', () => {
  const nodes = [shake('s'), shake('n', { pattern: 'noise' }), shake('c', { pattern: 'clip', clip: 'curve-a' })]
  const w = scene(nodes)
  render(w); const actual = render(w)
  const samples = nodes.map((n) => sampleShake(n.props, 0.05, w.project.animations))
  for (let i = 0; i < 3; i++) {
    near(actual.position[i], samples.reduce((sum, r) => sum + r.position[i], 0))
    near(actual.rotation[i], samples.reduce((sum, r) => sum + r.rotation[i], 0))
  }
  assert.equal(w._shakeClocks.size, 3)
})
test('G004-04 API manual inicia nodo AutoPlay=false usando los mismos patrones', () => {
  const w = scene([shake('manual', { autoPlay: false, pattern: 'noise' })])
  assert.deepEqual(render(w).position, [0, 0, 0])
  assert.equal(w._shakeApi().play('manual'), true)
  render(w); assert.notDeepEqual(render(w).position, [0, 0, 0])
})
test('G004-05 stop con salida suave termina sin reactivar AutoPlay', () => {
  const w = scene([shake('x', { blendOut: 0.15 })]); render(w); render(w)
  assert.equal(w._shakeApi().stop('x'), true)
  assert.equal(w._shakeApi().isPlaying('x'), false)
  assert.notDeepEqual(render(w).position, [0, 0, 0])
  for (let i = 0; i < 6; i++) render(w)
  assert.deepEqual(render(w).position, [0, 0, 0])
  assert.equal(w._shakeApi().isPlaying('x'), false)
})
test('G004-06 intensidad se aplica durante reproducción sin cambiar props', () => {
  const n = shake('x', { autoPlay: false }), saved = structuredClone(n.props), w = scene([n])
  w._shakeApi().play('x')
  render(w); w._shakeApi().setIntensity('x', 0.3)
  const p = render(w).position[0]
  near(p, sampleShake({ ...saved, autoPlay: true }, 0.05).position[0] * 0.3)
  assert.deepEqual(n.props, saved)
})
test('G004-07 dos nodos con control manual son independientes al detener uno', () => {
  const w = scene([shake('a', { autoPlay: false }), shake('b', { autoPlay: false, pattern: 'noise' })]);
  assert.equal(w._shakeApi().play('a'), true); assert.equal(w._shakeApi().play('b'), true)
  render(w)
  w._shakeApi().stop('a')
  assert.equal(w._shakeApi().isPlaying('a'), false)
  assert.equal(w._shakeApi().isPlaying('b'), true)
  assert.notDeepEqual(render(w).position, [0, 0, 0])
})
test('G004-08 la pausa congela los relojes y stepping explícito avanza', () => {
  const w = scene([shake('x', { autoPlay: false })]); w._shakeApi().play('x')
  w.paused = true; render(w); render(w)
  near(w._shakeClocks.get('x').t, 0)
  render(w, 0.05, true)
  near(w._shakeClocks.get('x').t, 0.05)
})
test('G004-09 cambio de cámara congela reloj de efecto de cámara no activa', () => {
  const w = scene([shake('x', { camera: 'c-01', autoPlay: false })]); w._shakeApi().play('x')
  w._mainCameraNode = () => ({ obj: { id: 'c-01' }, node: {} }); render(w)
  const t = w._shakeClocks.get('x').t
  w._mainCameraNode = () => ({ obj: { id: 'c-02' }, node: {} }); render(w)
  near(w._shakeClocks.get('x').t, t)
  w._mainCameraNode = () => ({ obj: { id: 'c-01' }, node: {} }); render(w)
  assert.ok(w._shakeClocks.get('x').t > t)
})
test('G004-10 Timeline y Film Maker mantienen prioridad sin avanzar efectos', () => {
  const w = scene([shake('x')])
  w.film = { camera() {} }; assert.deepEqual(render(w).position, [0, 0, 0]); assert.equal(w._shakeClocks.size, 0)
  w.film = null; w.tls = [{ cam: true }]; assert.deepEqual(render(w).position, [0, 0, 0]); assert.equal(w._shakeClocks.size, 0)
  w.tls = []; render(w); assert.equal(w._shakeClocks.size, 1)
})
test('G004-11 pose de render restaurada antes de siguiente lógica, sin acumulación', () => {
  const w = scene([shake('x')]), cam = physicalCamera()
  render(w); w._shakeFrame(cam, 0.05)
  assert.ok(cam.position.value !== 7 && cam.quaternion.value !== 4)
  assert.ok(w._shakeBase)
  w._shakeRestore(cam)
  near(cam.position.value, 7); near(cam.quaternion.value, 4)
  assert.equal(w._shakeBase, null)
  w._shakeFrame(cam, 0.05); w._shakeRestore(cam)
  near(cam.position.value, 7); near(cam.quaternion.value, 4)
})
test('G004-12 guardar/reabrir recetas: las propiedades siguen siendo datos de proyecto', () => {
  const original = [shake('n', { pattern: 'noise', camera: 'cam-01' }), shake('c', { pattern: 'clip', clip: 'curve-a', autoPlay: false })]
  const restored = JSON.parse(JSON.stringify(original)); const w = scene(restored)
  assert.deepEqual(restored, original)
  assert.equal(w._shakeApi().play('c'), true)
  assert.deepEqual(restored, original)
  assert.ok(w._shakeClocks instanceof Map)
  assert.equal(JSON.stringify(restored).includes('fadeTime'), false)
})
test('G004-13 escena nueva limpia relojes y conserva receta', () => {
  const n = shake('x'), w = scene([n]); w._shakeApi().play('x'); assert.equal(w._shakeClocks.size, 1)
  const source = code('src/engine/runtime/events/play.js')
  assert.match(source, /_setupScene\(tag, here = false\)\s*\{[^}]*?this\._shakeClocks\.clear\(\)/)
  w._shakeClocks.clear() // misma operación de entrada a escena, sin crear una escena de producción.
  assert.equal(w._shakeClocks.size, 0)
  assert.equal(w._shakeApi().isPlaying('x'), true) // AutoPlay de la receta sigue activo.
  assert.deepEqual(n.props, recipe())
})
test('G004-14 clip ausente y referencia inválida fallan sin redirecciones', () => {
  const w = scene([shake('broken', { pattern: 'clip', clip: 'not-found', autoPlay: false })])
  assert.equal(w._shakeApi().play('broken'), false)
  assert.deepEqual(render(w).position, [0, 0, 0])
  assert.equal(w._shakeApi().play('unknown'), false)
  assert.equal(w._shakeApi().setIntensity('unknown', 0.7), false)
  assert.equal(w._shakeApi().isPlaying('unknown'), false)
})
test('G004-15 escena sin cámara y sin FPS no acumula offset ni relojes', () => {
  const w = scene([shake('x')], { hasPlayer: false })
  assert.deepEqual(render(w).position, [0, 0, 0]); assert.equal(w._shakeClocks.size, 0)
})
test('G004-16 contratos del host/API y orden real del fotograma siguen conectados', () => {
  const controls = code('src/engine/runtime/events/play-controls.js')
  const host = code('src/engine/runtime/events/play-host.js')
  const interpreter = code('src/engine/runtime/events/interpreter.js')
  assert.ok(controls.indexOf('_shakeRestore(cam)') < controls.indexOf('this._inputFrame(dt)'))
  assert.ok(controls.indexOf('_shakeFrame(cam, dt, stepping)') > controls.indexOf('this._updateHeldActions()'))
  assert.match(host, /get cameraShake\(\) \{ return self\._shakeApi\(\) \}/)
  assert.match(interpreter, /get cameraShake\(\) \{ return h\(\)\.cameraShake \}/)
  const a = code('src/core/events/game-api.d.ts')
  const b = code('vscode-extension/media/game-api.d.ts')
  assert.equal(a.split('  interface CameraShakeApi {')[1].split('\n  }')[0], b.split('  interface CameraShakeApi {')[1].split('\n  }')[0])
})
