import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { effectiveTriangleSpan, faceColorBuffers } from '../src/engine/runtime/render/face-topology.js'

const source = readFileSync(new URL('../src/engine/runtime/render/view-diagnostics.js', import.meta.url), 'utf8')
const viewport = readFileSync(new URL('../src/engine/runtime/render/viewport.js', import.meta.url), 'utf8')
const clusters = readFileSync(new URL('../src/engine/runtime/render/cluster-mesh.js', import.meta.url), 'utf8')
let nextGeometry = 0

class BufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize; this.version = 0 }
  getX(i) { return this.array[i * this.itemSize] }
  getY(i) { return this.array[i * this.itemSize + 1] }
  getZ(i) { return this.array[i * this.itemSize + 2] }
}
class BufferGeometry {
  constructor() { this.uuid = `geometry-${++nextGeometry}`; this.attributes = {}; this.index = null; this.drawRange = { start: 0, count: Infinity }; this.disposed = false }
  setAttribute(name, value) { this.attributes[name] = value; return this }
  setIndex(value) { this.index = value; return this }
  computeBoundingSphere() { this.boundingSphere = sphere(); return this }
  dispose() { this.disposed = true }
}
class MeshBasicMaterial {
  constructor(options) { Object.assign(this, options); this.disposed = false }
  dispose() { this.disposed = true }
}
class Mesh {
  constructor(geometry, material) {
    this.isMesh = true; this.geometry = geometry; this.material = material; this.visible = true
    this.matrix = { copy: () => {} }; this.matrixWorld = {}; this.layers = { mask: 1 }
    this.renderOrder = 0; this.userData = {}; this.frustumCulled = true
  }
  updateWorldMatrix() {}
  removeFromParent() { this.parent?.remove(this) }
}
class Color {
  constructor(value) { this.value = value }
}
class Frustum {
  setFromProjectionMatrix() { return this }
  intersectsSphere() { return true }
}
class Matrix4 {
  multiplyMatrices() { return this }
}
const THREE = { BufferAttribute, BufferGeometry, MeshBasicMaterial, Mesh, Color, Frustum, Matrix4, DoubleSide: 2 }
const compiledSource = source.replace(/^import .*$/gm, '').replace(/^export \{ .*$/gm, '')
  .replace(/^export (const|class|function) /gm, '$1 ')
const ViewDiagnostics = new Function('THREE', 'effectiveTriangleSpan', 'faceColorBuffers',
  'VIEW_MODES', 'modeCapability', 'geometryTriangles', 'DIAGNOSTIC_HEAT_COLORS', 'DIAGNOSTIC_LOD_COLORS',
  `${compiledSource}\nreturn ViewDiagnostics`)(THREE, effectiveTriangleSpan, faceColorBuffers,
    [], () => ({ supported: true }), () => 0, [], [])

const sphere = () => ({ clone() { return this }, applyMatrix4() { return this } })
const vertexData = [0, 0, 0, 2, 0, 0, 2, 0, 2, 0, 0, 2, 3, 0, 3]
const geometry = (indices = [0, 1, 2, 0, 2, 3]) => new BufferGeometry()
  .setAttribute('position', new BufferAttribute(new Float32Array(vertexData), 3))
  .setIndex(new BufferAttribute(new Uint32Array(indices), 1))
const frame = (mesh, clusterEntry = null, { throwRender = false } = {}) => {
  const objects = [mesh]
  const frames = []
  const scene = {
    background: 'author-background',
    add(obj) { objects.push(obj); obj.parent = this },
    remove(obj) { const i = objects.indexOf(obj); if (i >= 0) objects.splice(i, 1); obj.parent = null },
    traverseVisible(callback) { for (const obj of [...objects]) if (obj.visible) callback(obj) },
  }
  const renderer = {
    shadowMap: { enabled: true },
    render() {
      frames.push(objects.filter(obj => obj.visible && obj.isMesh).map(obj => ({
        positions: Array.from(obj.geometry.attributes.position.array),
        colors: Array.from(obj.geometry.attributes.color?.array || []),
        wireframe: !!obj.material.wireframe,
        object: obj,
      })))
      if (throwRender) throw Error('render failure')
    },
  }
  const byMesh = new Map()
  if (clusterEntry) byMesh.set(clusterEntry.mesh || mesh, clusterEntry)
  const vp = {
    scene, renderer, camera: { projectionMatrix: {}, matrixWorldInverse: {} },
    lodManager: { clusters: { byMesh } },
    occlusion: { draw: (_camera, fn) => fn() },
    perf: { time: (_label, fn) => fn() },
  }
  const diag = new ViewDiagnostics(vp)
  return { diag, frames, objects, scene, renderer, mesh }
}

function assertParity(f, expected) {
  assert.equal(f.diag.draw('wireframe'), true)
  const wireframe = f.frames.at(-1)
  const wireCount = f.diag.last.triangles
  assert.equal(f.diag.draw('triangles'), true)
  const triangles = f.frames.at(-1)
  const triangleCount = f.diag.last.triangles
  assert.equal(wireCount, expected)
  assert.equal(triangleCount, expected)
  assert.deepEqual(wireframe.map(x => x.positions), triangles.map(x => x.positions))
  assert.ok(wireframe.every(x => x.wireframe))
  assert.ok(triangles.every(x => !x.wireframe && x.colors.length === x.positions.length))
  assert.ok(!wireframe.some(x => x.object === f.mesh))
  assert.ok(f.mesh.visible)
  assert.equal(f.scene.background, 'author-background')
  assert.equal(f.renderer.shadowMap.enabled, true)
  return wireframe
}

test('paridad de Wireframe y Triangles en una malla indexada', () => {
  const mesh = new Mesh(geometry(), {})
  const f = frame(mesh)
  assertParity(f, 2)
  assert.equal(f.objects.length, 1)
  assert.equal(mesh.geometry.index.count, 6)
})

test('paridad de geometría no indexada y drawRange efectivo', () => {
  const geo = geometry(); geo.index = null
  const points = [...vertexData, 4, 0, 4]
  geo.setAttribute('position', new BufferAttribute(new Float32Array(points), 3))
  geo.drawRange = { start: 3, count: 3 }
  const mesh = new Mesh(geo, {})
  const f = frame(mesh)
  const wire = assertParity(f, 1)
  assert.deepEqual(wire[0].positions, points.slice(9, 18))
})

test('cambios de índice de TriangHor actualizan ambas vistas sin modificar el recurso', () => {
  const geo = geometry()
  const f = frame(new Mesh(geo, {}))
  assertParity(f, 2)
  geo.setIndex(new BufferAttribute(new Uint32Array([0, 1, 3]), 1))
  const wire = assertParity(f, 1)
  assert.deepEqual(wire[0].positions, vertexData.slice(0, 6).concat(vertexData.slice(9, 12)))
  assert.deepEqual(Array.from(geo.index.array), [0, 1, 3])
})

test('sustitución de índice con la misma cantidad de caras invalida la caché', () => {
  const geo = geometry()
  const f = frame(new Mesh(geo, {}))
  const old = assertParity(f, 2).map(x => x.positions)
  geo.setIndex(new BufferAttribute(new Uint32Array([0, 1, 3, 1, 2, 3]), 1))
  const next = assertParity(f, 2).map(x => x.positions)
  assert.notDeepEqual(old, next)
  assert.deepEqual(f.frames.at(-2).map(x => x.positions), f.frames.at(-1).map(x => x.positions))
})

test('cambio del buffer de posiciones invalida la caché aunque tenga la misma versión', () => {
  const geo = geometry()
  const f = frame(new Mesh(geo, {}))
  const before = assertParity(f, 2).map(x => x.positions)
  const moved = [...vertexData]; moved[0] = 5
  geo.setAttribute('position', new BufferAttribute(new Float32Array(moved), 3))
  const after = assertParity(f, 2).map(x => x.positions)
  assert.notDeepEqual(before, after)
})

test('Wireframe y Triangles comparten caché geométrica con materiales independientes', () => {
  const f = frame(new Mesh(geometry(), {}))
  const a = f.diag._topology(f.mesh.geometry, 'triangles', 0)
  const b = f.diag._topology(f.mesh.geometry, 'wireframe', 0)
  assert.equal(a, b)
  assert.equal(f.diag._topologyCache.size, 1)
  assert.notEqual(f.diag._topologyMaterial, f.diag._wireframeMaterial)
  assert.equal(f.diag._wireframeMaterial.wireframe, true)
  assert.equal(f.diag._topologyMaterial.wireframe || false, false)
})

test('terreno usa índices horneados y páginas activas de TriangHor en ambas vistas', () => {
  const mesh = new Mesh(geometry([0, 1, 2, 0, 2, 3, 1, 3, 4]), {})
  const originalIndex = mesh.geometry.index
  const pages = [{ id: 0, index: new Uint32Array([0, 1, 3]), sphere: sphere() },
    { id: 1, index: new Uint32Array([1, 2, 4]), sphere: sphere() }]
  const f = frame(mesh, { mesh, terrain: {}, terrainActive: pages })
  const drawn = assertParity(f, 2)
  assert.equal(drawn.length, 2)
  assert.deepEqual(drawn[0].positions, [0, 0, 0, 2, 0, 0, 0, 0, 2])
  assert.equal(mesh.geometry.index, originalIndex)
  assert.equal(pages.length, 2)
})

test('cambio de páginas activas y nivel de detalle conserva la paridad', () => {
  const mesh = new Mesh(geometry(), {})
  const pageA = { id: 0, index: new Uint32Array([0, 1, 2]), sphere: sphere() }
  const pageB = { id: 1, index: new Uint32Array([0, 2, 3]), sphere: sphere() }
  const entry = { mesh, terrain: {}, terrainActive: [pageA, pageB] }
  const f = frame(mesh, entry)
  assertParity(f, 2)
  entry.terrainActive = [pageB]
  const drawn = assertParity(f, 1)
  assert.deepEqual(drawn[0].positions, [0, 0, 0, 2, 0, 2, 0, 0, 2])
})

test('mallas de dibujo directo usan las mismas páginas activas que los clústeres', () => {
  const mesh = new Mesh(geometry([0, 1, 2, 0, 2, 3, 1, 3, 4]), {})
  const entry = { mesh, directActive: [{ id: 0, index: new Uint32Array([0, 1, 2]), bounds: sphere() },
    { id: 1, index: new Uint32Array([1, 3, 4]), bounds: sphere() }] }
  const f = frame(mesh, entry)
  const drawn = assertParity(f, 2)
  assert.equal(drawn.length, 2)
  assert.deepEqual(drawn[1].positions, [2, 0, 0, 0, 0, 2, 3, 0, 3])
})

test('si cambia la selección de particiones directas se actualizan las dos vistas', () => {
  const mesh = new Mesh(geometry(), {})
  const page = { id: 0, index: new Uint32Array([0, 2, 3]), bounds: sphere() }
  const entry = { mesh, directActive: [page] }
  const f = frame(mesh, entry)
  assertParity(f, 1)
  entry.directActive = [{ id: 1, index: new Uint32Array([0, 1, 2]), bounds: sphere() }]
  const drawn = assertParity(f, 1)
  assert.deepEqual(drawn[0].positions, [0, 0, 0, 2, 0, 0, 2, 0, 2])
})

test('sin páginas utilizables recae en los índices reales del objeto', () => {
  const mesh = new Mesh(geometry(), {})
  const entry = { mesh, directActive: [{ id: 0, index: null, bounds: sphere() }] }
  const f = frame(mesh, entry)
  assertParity(f, 2)
})

test('un lote de clústeres usa la geometría LOD residente, no la fuente original', () => {
  const owner = new Mesh(geometry([0, 1, 2, 0, 2, 3, 1, 3, 4]), {})
  owner.visible = false
  const batch = new Mesh(geometry(), {})
  batch.isBatchedMesh = true
  batch._lfClusterSource = owner
  const resident = geometry([0, 1, 3]); resident.computeBoundingSphere()
  const entry = { mesh: owner, batch, ids: [{ level: 0 }], shared: { pages: [[{ geo: resident }]] } }
  const f = frame(batch, entry)
  f.diag.vp.lodManager.clusters.byMesh.set(owner, entry)
  const drawn = assertParity(f, 1)
  assert.deepEqual(drawn[0].positions, [0, 0, 0, 2, 0, 0, 0, 0, 2])
})

test('una excepción del renderer restaura escena, visibilidad y buffers fuente', () => {
  const mesh = new Mesh(geometry(), {})
  const original = mesh.geometry.index
  const f = frame(mesh, null, { throwRender: true })
  assert.throws(() => f.diag.draw('wireframe'), /render failure/)
  assert.equal(mesh.visible, true)
  assert.equal(mesh.geometry.index, original)
  assert.equal(f.objects.length, 1)
  assert.equal(f.scene.background, 'author-background')
  assert.equal(f.renderer.shadowMap.enabled, true)
})

test('la liberación de recursos alcanza ambos materiales sin afectar la geometría de autoría', () => {
  const mesh = new Mesh(geometry(), {})
  const f = frame(mesh)
  assertParity(f, 2)
  const debug = f.diag._topology(mesh.geometry, 'wireframe', 0)
  f.diag.dispose()
  assert.ok(f.diag._wireframeMaterial.disposed)
  assert.ok(f.diag._topologyMaterial.disposed)
  assert.ok(debug.disposed)
  assert.ok(!mesh.geometry.disposed)
})

test('el viewport conserva los diagnósticos previos y la pasada de gizmos', () => {
  assert.match(viewport, /this\.viewDiagnostics\.draw\(this\.viewMode\)/)
  assert.match(viewport, /this\.drawEditorOverlay\(\)/)
  assert.match(clusters, /entry\.bakePlan\?\.index/)
  assert.match(clusters, /entry\.terrainActive/)
  assert.match(source, /entry\.directActive/)
})
