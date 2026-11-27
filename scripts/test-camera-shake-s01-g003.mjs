// G003 — API pública y reproducción transitoria de Camera Shake Base.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cameraShakeMethods, sampleShake } from '../src/engine/runtime/events/play-camera-shake.js'

const props = (patch = {}) => ({ camera: 'player', enabled: true, autoPlay: false, loop: true, pattern: 'sine', position: [0.2, 0, 0], rotation: [0, 0, 1], frequency: 1, blendIn: 0, blendOut: 0, ...patch })
const node = (id, p = props()) => ({ id, name: id, type: 'cameraShake', visible: true, props: p })
function world(nodes = [node('idle')], extra = {}) {
  const ctx = Object.assign(Object.create(cameraShakeMethods), {
    project: { objects: nodes, animations: [] }, state: { focus: true }, hasPlayer: true, paused: false, film: null, tls: [],
    _mainCameraNode: () => null,
    _nodeEnabled: node => node.active !== false && node.visible !== false,
    _find: (ref, type) => nodes.find((n) => (!type || n.type === type) && (n.id === ref || n.name.toLowerCase() === String(ref).toLowerCase())) ?? null,
    ...extra,
  })
  return ctx
}
function frame(ctx, dt = 0.05, stepping = false) {
  // La autoridad activa procede de Camera Orchestration, no de Shake.
  const main = ctx._mainCameraNode()
  ctx._cameraActive = ctx.film?.camera ? { kind: 'film' }
    : ctx.tls?.some(r => r.cam) ? { kind: 'timeline' }
      : main?.node ? { kind: 'camera3d', id: main.obj.id }
        : ctx.hasPlayer ? { kind: 'player' } : null
  const out = { position: [0, 0, 0], rotation: [0, 0, 0] }
  const cam = { translateX: (v) => out.position[0] += v, translateY: (v) => out.position[1] += v, translateZ: (v) => out.position[2] += v,
    rotateX: (v) => out.rotation[0] += v, rotateY: (v) => out.rotation[1] += v, rotateZ: (v) => out.rotation[2] += v }
  ctx._shakeFrame(cam, dt, stepping)
  return out
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} no es ${b}`)
const code = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('G003-01 AutoPlay desactivado no arranca solo', () => { const w = world(); assert.equal(w._shakeIsPlaying('idle'), false); assert.deepEqual(frame(w).position, [0, 0, 0]) })
test('G003-02 play acepta ID y arranca el reloj desde cero', () => { const w = world(); assert.equal(w._shakePlay('idle'), true); assert.equal(w._shakeIsPlaying('idle'), true); frame(w); near(frame(w).position[0], sampleShake(props({ autoPlay: true }), 0.05).position[0]) })
test('G003-03 play acepta nombre del nodo o identificador de handle', () => { const w = world([node('id1')]); w.project.objects[0].name = 'Movimiento'; assert.equal(w._shakePlay('Movimiento'), true); assert.equal(w._shakePlay({ id: 'id1' }), true) })
test('G003-04 play repetido reinicia el tiempo', () => { const w = world(); w._shakePlay('idle'); frame(w); frame(w); assert.ok(w._shakeClocks.get('idle').t > 0); w._shakePlay('idle'); near(w._shakeClocks.get('idle').t, 0) })
test('G003-05 stop detiene sin Blend Out', () => { const w = world(); w._shakePlay('idle'); frame(w); assert.equal(w._shakeStop('idle'), true); assert.equal(w._shakeIsPlaying('idle'), false); assert.deepEqual(frame(w).position, [0, 0, 0]) })
test('G003-06 stop respeta Blend Out y permanece detenido', () => {
  const w = world([node('idle', props({ blendOut: 0.15 }))]); w._shakePlay('idle'); frame(w)
  const first = frame(w).position[0]; assert.ok(first > 0); assert.equal(w._shakeStop('idle'), true)
  const fading = frame(w).position[0]; assert.equal(w._shakeIsPlaying('idle'), false)
  assert.ok(fading !== 0); frame(w); frame(w); frame(w)
  assert.deepEqual(frame(w).position, [0, 0, 0]); assert.equal(w._shakeIsPlaying('idle'), false)
})
test('G003-07 stop impide reinicio de un nodo AutoPlay', () => { const w = world([node('idle', props({ autoPlay: true }))]); frame(w); assert.equal(w._shakeStop('idle'), true); assert.deepEqual(frame(w).position, [0, 0, 0]); assert.equal(w._shakeIsPlaying('idle'), false) })
test('G003-08 intensidad manual reduce offsets sin mutar la receta', () => {
  const n = node('idle'); const old = structuredClone(n.props), w = world([n]); w._shakePlay('idle'); frame(w); const full = frame(w).position[0]
  w._shakeSetIntensity('idle', 0.5); const half = frame(w).position[0]
  near(half, sampleShake({ ...old, autoPlay: true }, 0.1).position[0] * 0.5)
  assert.ok(full > 0); assert.deepEqual(n.props, old)
})
test('G003-09 setIntensity acota 0..1 y rechaza NaN', () => {
  const w = world(); w._shakePlay('idle')
  assert.equal(w._shakeSetIntensity('idle', 10), true); assert.equal(w._shakeClocks.get('idle').intensity, 1)
  assert.equal(w._shakeSetIntensity('idle', -5), true); assert.equal(w._shakeClocks.get('idle').intensity, 0)
  assert.equal(w._shakeSetIntensity('idle', NaN), false); assert.equal(w._shakeClocks.get('idle').intensity, 0)
})
test('G003-10 intensidad establecida antes de play manual se conserva', () => { const w = world(); w._shakeSetIntensity('idle', 0.2); assert.equal(w._shakeIsPlaying('idle'), false); w._shakePlay('idle'); near(w._shakeClocks.get('idle').intensity, 0.2) })
test('G003-11 Enabled=false bloquea reproducción manual', () => { const w = world([node('idle', props({ enabled: false }))]); assert.equal(w._shakePlay('idle'), false); assert.equal(w._shakeIsPlaying('idle'), false) })
test('G003-12 referencia inexistente o de otro tipo falla de forma controlada', () => { const w = world([node('idle'), { id: 'box', name: 'box', type: 'primitive' }]); assert.equal(w._shakePlay('box'), false); assert.equal(w._shakeStop('invalid'), false); assert.equal(w._shakeSetIntensity('invalid', 1), false); assert.equal(w._shakeIsPlaying('invalid'), false) })
test('G003-13 pausa congela reloj, permite frame de paso explícito', () => { const w = world(); w._shakePlay('idle'); w.paused = true; frame(w); frame(w); near(w._shakeClocks.get('idle').t, 0); frame(w, 0.05, true); near(w._shakeClocks.get('idle').t, 0.05) })
test('G003-14 dos efectos independientes suman sus movimientos', () => { const w = world([node('one'), node('two')]); w._shakePlay('one'); w._shakePlay('two', { intensity: 0.5 }); frame(w); const a = frame(w); near(a.position[0], sampleShake(props({ autoPlay: true }), 0.05).position[0] * 1.5); assert.equal(w._shakeStop('one'), true); assert.equal(w._shakeIsPlaying('two'), true) })
test('G003-15 los efectos de cámara inactiva conservan el reloj', () => { const w = world([node('other', props({ camera: 'another' }))]); w._shakePlay('other'); frame(w); near(w._shakeClocks.get('other').t, 0); w._mainCameraNode = () => ({ node: true, obj: { id: 'another' } }); frame(w); near(w._shakeClocks.get('other').t, 0.05) })
test('G003-16 Timeline y Film Maker no reciben offsets', () => { const w = world(); w._shakePlay('idle'); w.film = { camera: {} }; assert.deepEqual(frame(w).position, [0, 0, 0]); w.film = null; w.tls = [{ cam: true }]; assert.deepEqual(frame(w).position, [0, 0, 0]) })
test('G003-17 sin Loop finaliza y isPlaying pasa a false', () => { const w = world([node('idle', props({ loop: false, frequency: 10 }))]); w._shakePlay('idle'); for (let i = 0; i < 4; i++) frame(w); assert.equal(w._shakeIsPlaying('idle'), false) })
test('G003-18 un clip ausente no puede iniciar manualmente', () => { const w = world([node('clip', props({ pattern: 'clip', clip: 'inexistente' }))]); assert.equal(w._shakePlay('clip'), false); assert.equal(w._shakeIsPlaying('clip'), false) })
test('G003-19 API y enlace del host apuntan al evaluador existente', () => {
  const w = world(), api = w._shakeApi()
  assert.equal(api.play('idle', { intensity: 0.25 }), true)
  assert.equal(api.isPlaying('idle'), true)
  assert.equal(w._shakeClocks.get('idle').intensity, 0.25)
  assert.equal(api.setIntensity('idle', 0.5), true)
  assert.equal(api.stop('idle'), true)
  assert.match(code('src/engine/runtime/events/play-host.js'), /get cameraShake\(\) \{ return self\._shakeApi\(\) \}/)
  assert.match(code('src/engine/runtime/events/interpreter.js'), /get cameraShake\(\) \{ return h\(\)\.cameraShake \}/)
})
test('G003-20 los archivos de tipos de editor y VS Code coinciden', () => {
  const a = code('src/core/events/game-api.d.ts'), b = code('vscode-extension/media/game-api.d.ts')
  assert.equal(a.split('  interface CameraShakeApi {')[1].split('\n  }')[0], b.split('  interface CameraShakeApi {')[1].split('\n  }')[0])
  for (const text of ['interface CameraShakeApi', 'readonly cameraShake: CameraShakeApi', 'setIntensity(node: NodeLike', 'isPlaying(node: NodeLike']) assert.ok(a.includes(text) && b.includes(text))
})
test('G003-21 se reinician relojes al empezar, parar y cargar otra escena', () => {
  const src = code('src/engine/runtime/events/play.js')
  assert.ok((src.match(/this\._shakeClocks\.clear\(\)/g) || []).length >= 3)
  assert.match(src, /_setupScene\(tag, here = false\) \{[\s\S]{0,250}this\._shakeClocks\.clear\(\)/)
})
test('G003-22 el runtime mantiene base, física y FOV intactos', () => {
  const w = world(); w._shakePlay('idle'); const input = structuredClone(w.project.objects[0].props)
  frame(w); frame(w); assert.deepEqual(w.project.objects[0].props, input)
  assert.doesNotMatch(code('src/engine/runtime/events/play-camera-shake.js'), /makeKinematic|syncNode|\.phys\.|\.body\.|\.fov\s*=/)
})
