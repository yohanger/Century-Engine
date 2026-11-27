import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const file = relative => readFileSync(new URL('../' + relative, import.meta.url), 'utf8')
const observer = file('src/components/SceneRuntimeObserver.vue')
const compile = (name, injections, exports) => {
  const source = file(name).replace(/^import .*$/gm, '').replace(/^export /gm, '')
  const scope = vm.createContext(injections)
  vm.runInContext(`${source}\nglobalThis.exports = { ${exports.join(',')} }`, scope, { filename: name })
  return scope.exports
}

class Projection {
  multiplyMatrices(projection) { this.camera = projection.camera; return this }
}
class Frustum {
  setFromProjectionMatrix(matrix) { this.camera = matrix.camera; return this }
  intersectsObject(object) { return object.inFrame(this.camera) }
  intersectsSprite(object) { return object.inFrame(this.camera) }
}
const culling = compile('src/engine/runtime/render/observer-visibility.js', { Frustum, Matrix4: Projection }, [
  'playerCameraFrustum', 'outsidePlayerFrustum', 'occludedWithinFrustum', 'withTemporaryHidden', 'withTemporarilyVisible',
])
const camera = () => ({
  isPerspectiveCamera: true, layers: { test: () => true },
  projectionMatrix: {}, matrixWorldInverse: {}, coordinateSystem: 'webgl',
  heading: 0, updateWorldMatrix() { this.projectionMatrix.camera = this },
})
const object = (inFrame, extra = {}) => ({
  visible: true, isMesh: true, layers: { test: () => true }, userData: {},
  inFrame, ...extra,
})
const world = children => ({
  traverseVisible(fn) {
    for (const o of children) if (o.visible) fn(o)
  },
})

test('usa la cámara activa en cada muestreo sin cambiar la cámara editorial', () => {
  const cam = camera()
  const before = object(cam => cam.heading === 0)
  const after = object(cam => cam.heading === 1)
  const helper = object(() => false, { userData: { helper: true } })
  const scene = world([before, after, helper])
  assert.equal(culling.outsidePlayerFrustum(scene, cam, culling.playerCameraFrustum(cam)).length, 1)
  assert.equal(culling.outsidePlayerFrustum(scene, cam, culling.playerCameraFrustum(cam))[0], after)
  cam.heading = 1
  assert.equal(culling.outsidePlayerFrustum(scene, cam, culling.playerCameraFrustum(cam))[0], before)
  assert.equal(helper.visible, true)
})

test('ignora nodos sin render, helpers, capas distintas y jerarquías ocultas', () => {
  const cam = camera()
  const layer = object(() => false, { layers: { test: () => false } })
  const hidden = object(() => false, { visible: false })
  const inert = object(() => false, { isMesh: false })
  const sprite = object(() => false, { isMesh: false, isSprite: true })
  const filtered = culling.outsidePlayerFrustum(world([layer, hidden, inert, sprite]), cam, culling.playerCameraFrustum(cam))
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0], sprite)
})

test('la visibilidad temporal se restituye incluso en excepciones y no revela objetos originalmente ocultos', () => {
  const a = object(() => true), b = object(() => false, { visible: false })
  culling.withTemporaryHidden([a, a, b], () => {
    assert.equal(a.visible, false)
    assert.equal(b.visible, false)
  })
  assert.equal(a.visible, true)
  assert.equal(b.visible, false)
  assert.throws(() => culling.withTemporaryHidden([a], () => { throw Error('fallo') }), /fallo/)
  assert.equal(a.visible, true)
  culling.withTemporaryHidden([a], () => culling.withTemporarilyVisible([a], () => assert.equal(a.visible, true)))
  assert.equal(a.visible, true)
})

test('la oclusión cuenta solo drawables únicos dentro del frustum del jugador', () => {
  const cam = camera()
  const visible = object(() => true), outside = object(() => false)
  assert.equal(culling.occludedWithinFrustum([visible, visible, outside], cam, culling.playerCameraFrustum(cam)), 1)
  assert.equal(culling.occludedWithinFrustum([], cam, culling.playerCameraFrustum(cam)), 0)
  assert.equal(culling.occludedWithinFrustum([], cam, null), null)
})

class Box3 {}
const occlusion = compile('src/engine/runtime/render/camera-occlusion.js', {
  toRaw: v => v, Box3, OCCLUSION_BAKE_VERSION: 2,
  occluderMesh: () => true, occluderSide: () => 0, resolveStaticMesh: () => null,
  worldBounds: () => ({}), meshOcclusionSignature: () => '',
}, ['CameraOcclusion'])
const testOcclusion = () => {
  const vp = { scene: {}, renderer: { clippingPlanes: [] }, psxUniforms: { step: { value: 0 } } }
  const engine = new occlusion.CameraOcclusion(vp)
  const project = { render: { staticOcclusion: true }, environment: {} }
  engine.graph = { host: { project }, nodes: new Map(), vp }
  const player = camera()
  player.matrixWorld = { elements: new Array(16).fill(0) }
  player.matrixWorld.elements[12] = 0
  player.matrixWorld.elements[13] = 0
  player.matrixWorld.elements[14] = 0
  return { engine, project, player }
}
test('sin horneado no informa cero; celda vacía y cámara externa se distinguen', () => {
  const { engine, project, player } = testOcclusion()
  engine.draw(player, () => assert.equal(engine.lastReason, 'no-bake'))
  assert.equal(engine.lastCellPairs, null)
  project.environment.occlusionBake = {
    version: 2, grid: { origin: [-1, -1, -1], dimensions: [1, 1, 1], size: 2 }, cells: [[]],
  }
  engine.draw(player, () => { assert.equal(engine.lastReason, ''); assert.equal(engine.lastCellPairs, 0) })
  player.matrixWorld.elements[12] = 30
  engine.draw(player, () => assert.equal(engine.lastReason, 'outside-grid'))
  assert.equal(engine.lastCellPairs, null)
})

test('la interfaz muestra únicamente dos controles, abajo a la izquierda y apagados inicialmente', () => {
  assert.match(observer, /const showFrustum = ref\(false\)/)
  assert.match(observer, /const showOcclusion = ref\(false\)/)
  assert.match(observer, /v-model="showOcclusion" \/> Occlusion Culling/)
  assert.match(observer, /v-model="showFrustum" \/> Frustum/)
  assert.match(observer, /bottom:9px/)
  assert.doesNotMatch(observer, /CameraHelper|Box3Helper|sceneBoxes|runtime-observer-info/)
})

test('el render de Edit Mode utiliza máscaras temporales, la cámara Player y la oclusión nativa', () => {
  assert.match(observer, /outsidePlayerFrustum\(vp\.world, vpCamera, playerFrustum\)/)
  assert.match(observer, /vp\.occlusion\.draw\(vpCamera/)
  assert.match(observer, /selectObject, selectPiece, store, getObject/)
  assert.match(observer, /editor\.vp\.occlusion\.withShadows/)
  assert.match(observer, /withTemporaryHidden\(outside, \(\) => renderer\.render\(vp\.scene, camera\)\)/)
  assert.doesNotMatch(observer, /\.visible\s*=\s*false/)
})
