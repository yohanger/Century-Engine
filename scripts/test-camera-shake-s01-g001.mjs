// LF-CAMERA-SHAKE-S01-G001: nodos, referencia de cámara y composición sin física.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { shakeConfig, sampleShake, cameraShakeMethods } from '../src/engine/runtime/events/play-camera-shake.js'

const code = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const source = () => ({ enabled: true, autoPlay: true, loop: true, camera: 'player', position: [0.1, 0, 0], rotation: [0, 0, 1], frequency: 1, blendIn: 0, blendOut: 0 })
const camera = () => {
  const applied = { position: [0, 0, 0], rotation: [0, 0, 0] }
  return {
    applied,
    translateX: (v) => { applied.position[0] += v }, translateY: (v) => { applied.position[1] += v }, translateZ: (v) => { applied.position[2] += v },
    rotateX: (v) => { applied.rotation[0] += v }, rotateY: (v) => { applied.rotation[1] += v }, rotateZ: (v) => { applied.rotation[2] += v },
  }
}
const world = (objects, options = {}) => ({ project: { objects }, hasPlayer: true, paused: false, state: { focus: true }, tls: [], film: null, _mainCameraNode: () => null, _nodeEnabled: node => node.active !== false && node.visible !== false, ...options })
const run = (ctx, dt = 0.25, stepping = false) => {
  const main = ctx._mainCameraNode()
  ctx._cameraActive = ctx.film?.camera ? { kind: 'film' }
    : ctx.tls?.some(r => r.cam) ? { kind: 'timeline' }
      : main?.node ? { kind: 'camera3d', id: main.obj.id }
        : ctx.hasPlayer ? { kind: 'player' } : null
  const c = camera(); cameraShakeMethods._shakeFrame.call(ctx, c, dt, stepping); return c.applied
}
const node = (id = 's1', props = source()) => ({ id, type: 'cameraShake', visible: true, props })
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} frente a ${b}`)

test('SHAKE-01 normaliza parámetros no finitos sin NaN', () => {
  const cfg = shakeConfig({ ...source(), position: [NaN, 1e9, null], rotation: [Infinity, 20, -40], frequency: 0, blendIn: -12, blendOut: Infinity })
  assert.deepEqual(cfg.position, [0, 1, 0]); assert.deepEqual(cfg.rotation, [0, 15, -15]); assert.equal(cfg.frequency, 0.05); assert.equal(cfg.blendIn, 0); assert.equal(cfg.blendOut, 0)
})
test('SHAKE-02 oscilación determinista vuelve a cero tras un ciclo', () => {
  near(sampleShake(source(), 0.25).position[0], 0.1)
  near(sampleShake(source(), 1).position[0], 0)
  assert.deepEqual(sampleShake(source(), 0.25), sampleShake(source(), 0.25))
})
test('SHAKE-03 rotación se convierte de grados a radianes', () => near(sampleShake(source(), 0.25).rotation[2], Math.PI / 180))
test('SHAKE-04 Blend In controla inicio progresivo', () => {
  const p = { ...source(), blendIn: 1 }
  near(sampleShake(p, 0).position[0], 0)
  near(sampleShake(p, 0.25).position[0], 0.025)
})
test('SHAKE-05 efecto no repetido termina al completar ciclo', () => {
  const p = { ...source(), loop: false, blendOut: 0.5 }
  assert.equal(sampleShake(p, 1), null)
  near(sampleShake(p, 0.75).position[0], -0.05)
})
test('SHAKE-06 sin autoPlay o desactivado no produce offset', () => {
  assert.equal(sampleShake({ ...source(), enabled: false }, 0.25), null)
  assert.equal(sampleShake({ ...source(), autoPlay: false }, 0.25), null)
})
test('SHAKE-07 objetivo FPS activo recibe únicamente su efecto', () => {
  const ctx = world([node()])
  run(ctx); near(run(ctx).position[0], sampleShake(source(), 0.05).position[0])
  assert.equal(ctx._shakeClocks.get('s1'), 0.1)
})
test('SHAKE-08 objetivo de cámara de escena usa ID estable', () => {
  const ctx = world([node('s1', { ...source(), camera: 'cam-52' })], { _mainCameraNode: () => ({ obj: { id: 'cam-52' }, node: {} }) })
  run(ctx); near(run(ctx).position[0], sampleShake(source(), 0.05).position[0])
  ctx._mainCameraNode = () => ({ obj: { id: 'cam-53' }, node: {} })
  near(run(ctx).position[0], 0)
})
test('SHAKE-09 referencia inexistente no se aplica a otra cámara', () => {
  const ctx = world([node('s1', { ...source(), camera: 'missing-camera' })])
  assert.deepEqual(run(ctx).position, [0, 0, 0]); assert.equal(ctx._shakeClocks.has('s1'), false)
})
test('SHAKE-10 cámara principal desactiva shakes asociados al FPS', () => {
  const ctx = world([node()], { _mainCameraNode: () => ({ obj: { id: 'main' }, node: {} }) })
  near(run(ctx).position[0], 0)
})
test('SHAKE-11 cámara de Film Maker o Timeline permanece intacta', () => {
  const ctx = world([node()]); ctx.tls = [{ cam: { pos: [] } }]
  near(run(ctx).position[0], 0)
  ctx.tls = []; ctx.film = { camera: {} }; near(run(ctx).position[0], 0)
})
test('SHAKE-12 suma de nodos sin duplicar estado de cámara', () => {
  const ctx = world([node('a'), node('b')]); run(ctx)
  near(run(ctx).position[0], 2 * sampleShake(source(), 0.05).position[0])
  assert.equal(ctx._shakeClocks.size, 2)
})
test('SHAKE-13 pausa congela fase y fotograma de paso avanza una vez', () => {
  const ctx = world([node()]); run(ctx)
  ctx.paused = true
  near(run(ctx).position[0], sampleShake(source(), 0.05).position[0])
  near(run(ctx).position[0], sampleShake(source(), 0.05).position[0])
  assert.equal(ctx._shakeClocks.get('s1'), 0.05)
  run(ctx, 0.25, true)
  assert.equal(ctx._shakeClocks.get('s1'), 0.1) // delta acotado al fotograma
})
test('SHAKE-14 foco ausente congela simulación de oscilación', () => {
  const ctx = world([node()], { state: { focus: false } })
  run(ctx); assert.equal(ctx._shakeClocks.has('s1'), false)
})
test('SHAKE-15 nodo oculto no altera cámara ni acumula fase', () => {
  const ctx = world([{ ...node(), visible: false }]); near(run(ctx).position[0], 0)
  assert.equal(ctx._shakeClocks.has('s1'), false)
})
test('SHAKE-16 registro y default del nodo están declarados en los módulos nativos', () => {
  assert.match(code('src/engine/runtime/nodes/index.js'), /import '\.\/camera-shake\.js'/)
  const s = code('src/engine/runtime/nodes/camera-shake.js')
  assert.match(s, /type: 'cameraShake'/)
  assert.match(s, /camera: 'player'/)
  assert.match(s, /scalable: false/)
})
test('SHAKE-17 el Inspector permite elegir cámara y editar la receta', () => {
  const s = code('src/components/Inspector.vue')
  for (const key of ['camera', 'enabled', 'autoPlay', 'loop', 'position', 'rotation', 'frequency', 'blendIn', 'blendOut']) assert.ok(s.includes(`'${key}'`) || s.includes(`props.${key}`), key)
  assert.match(s, /cam\.id/)
})
test('SHAKE-18 composición al final de frame, posterior a Timeline/Film Maker/indicadores', () => {
  const s = code('src/engine/runtime/events/play-controls.js')
  assert.ok(s.indexOf('this._shakeFrame(cam, dt, stepping)') > s.indexOf('this._updateHeldActions()'))
  assert.ok(s.indexOf('this._shakeRestore(cam)') < s.indexOf('this._inputFrame(dt)'))
  assert.ok(s.indexOf('this._shakeFrame(cam, dt, stepping)') > s.indexOf('this.film.camera(cam)'))
})
test('SHAKE-19 Player mezcla mecanismo nativo y reinicia al comenzar o detener', () => {
  const s = code('src/engine/runtime/events/play.js')
  assert.match(s, /mixin\(PlayMode, cameraShakeMethods\)/)
  assert.match(s, /this\._shakeClocks\.clear\(\)/)
  assert.match(s, /o\.type === 'cameraShake'/)
  assert.match(s, /v\.visible = false; this\.hidden\.push\(v\)/)
})
test('SHAKE-20 no hay nuevo estado físico ni cambios de jerarquía', () => {
  const s = code('src/engine/runtime/events/play-camera-shake.js')
  assert.doesNotMatch(s, /phys\.syncNode|position\.set\(|player\.pos|body\.eyeHeight|project\.objects\s*=/)
})

test('SHAKE-21 restaura la pose base antes de interacción, audio y raycasts', () => {
  const pose = { position: { x: 5 }, quaternion: { y: 2 } }
  const ctx = { _shakeBase: { position: { x: 0 }, quaternion: { y: 0 } } }
  const cam = {
    position: { copy(v) { pose.position.x = v.x } },
    quaternion: { copy(v) { pose.quaternion.y = v.y } },
  }
  cameraShakeMethods._shakeRestore.call(ctx, cam)
  assert.deepEqual(pose, { position: { x: 0 }, quaternion: { y: 0 } })
  assert.equal(ctx._shakeBase, null)
})
