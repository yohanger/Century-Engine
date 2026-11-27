import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z }
  clone() { return new Vec3(this.x, this.y, this.z) }
  toArray() { return [this.x, this.y, this.z] }
  *[Symbol.iterator]() { yield this.x; yield this.y; yield this.z }
  cross(v) { return new Vec3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x) }
  length() { return Math.hypot(this.x, this.y, this.z) }
}

class Matrix4 {
  constructor(tx = 0, ty = 0, tz = 0) {
    this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1]
  }
  toArray() { return [...this.elements] }
  fromArray(values) { this.elements = [...values]; return this }
  determinant() { return 1 }
  invert() { return this }
}

class Box3 {
  static scans = 0
  constructor() { this.makeEmpty() }
  makeEmpty() {
    this.min = new Vec3(Infinity, Infinity, Infinity)
    this.max = new Vec3(-Infinity, -Infinity, -Infinity)
    return this
  }
  isEmpty() { return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z }
  setFromBufferAttribute(attr) {
    Box3.scans++
    this.makeEmpty()
    for (let i = 0; i < attr.count; i++) {
      const p = [attr.getX(i), attr.getY(i), attr.getZ(i)]
      for (let j = 0; j < 3; j++) {
        const k = ['x', 'y', 'z'][j]
        this.min[k] = Math.min(this.min[k], p[j])
        this.max[k] = Math.max(this.max[k], p[j])
      }
    }
    return this
  }
  copy(b) { this.min = b.min.clone(); this.max = b.max.clone(); return this }
  applyMatrix4(m) {
    if (this.isEmpty()) return this
    const e = m.elements
    for (const [key, index] of [['x', 12], ['y', 13], ['z', 14]]) {
      this.min[key] += e[index]
      this.max[key] += e[index]
    }
    return this
  }
  union(b) {
    if (b.isEmpty()) return this
    if (this.isEmpty()) return this.copy(b)
    for (const k of ['x', 'y', 'z']) {
      this.min[k] = Math.min(this.min[k], b.min[k])
      this.max[k] = Math.max(this.max[k], b.max[k])
    }
    return this
  }
  getSize(out) {
    out.x = this.max.x - this.min.x
    out.y = this.max.y - this.min.y
    out.z = this.max.z - this.min.z
    return out
  }
}
const compile = (relative, context, exports) => {
  const source = readFileSync(new URL(`../src/engine/runtime/render/${relative}`, import.meta.url), 'utf8')
  const script = source.replace(/^import .*$/gm, '').replace(/^export /gm, '')
  const scope = vm.createContext(context)
  vm.runInContext(`${script}\nglobalThis.api = { ${exports.join(',')} }`, scope, { filename: relative })
  return scope.api
}
const staticApi = compile('occlusion-static.js', { Box3 }, [
  'OCCLUSION_BAKE_VERSION', 'candidateMesh', 'occluderMesh', 'occluderSide',
  'visitStaticMeshes', 'worldBounds',
])
class Resource { dispose() {} }
class DataTexture extends Resource {
  constructor(data, width, height) { super(); this.image = { data, width, height } }
}
class RenderTarget extends Resource {
  constructor(width, height) { super(); this.width = width; this.height = height }
}
class Material extends Resource {
  constructor(config) { super(); Object.assign(this, config) }
}
class Scene { add() {} }
const fakeThree = {
  Box3, Vector3: Vec3, Matrix4, DataTexture, WebGLRenderTarget: RenderTarget,
  PlaneGeometry: Resource, RawShaderMaterial: Material, Scene, Mesh: class {}, Camera: class {},
  Color: class {}, RGBAFormat: 1, FloatType: 1, GLSL3: 1,
}
const bakeApi = compile('occlusion-bake.js', {
  THREE: fakeThree,
  ...staticApi,
  meshOcclusionSignature(mesh) { return Array.from(mesh.geometry.attributes.position.array).join(',') },
  meshOcclusionPatches(mesh) { return mesh.material.transparent ? [] : [new Matrix4().toArray()] },
}, ['sceneOcclusionInputs', 'bakeStaticOcclusion'])

function fixture(vertices = [[-2, -1, 0], [3, -1, 0], [-2, 5, 0]]) {
  const data = new Float32Array(vertices.flat())
  const attr = {
    array: data, itemSize: 3, count: vertices.length, version: 0,
    getX(i) { return this.array[i * 3] }, getY(i) { return this.array[i * 3 + 1] }, getZ(i) { return this.array[i * 3 + 2] },
  }
  const geometry = { attributes: { position: attr } }
  const scene = { visible: true, userData: {}, updateMatrixWorld() {} }
  const root = { visible: true, userData: {}, _lfNodeOwner: { props: { static: true } }, children: [], parent: scene }
  const material = { isMaterial: true, visible: true, transparent: true, opacity: 0.5 }
  const mesh = {
    isMesh: true, visible: true, userData: {}, geometry, material, children: [], parent: root,
    matrixWorld: new Matrix4(),
  }
  root.children.push(mesh)
  const graph = { vp: { scene }, nodes: new Map([['wall', root]]) }
  return { attr, geometry, mesh, graph }
}

const limits = b => [...b.min.toArray(), ...b.max.toArray()]

test('worldBounds calcula límites de una malla editada sin depender de una caja primitiva', () => {
  const f = fixture()
  assert.equal(limits(staticApi.worldBounds(f.mesh, new Box3())).join(','), '-2,-1,0,3,5,0')
})

test('la caché reutiliza bounds sin modificar y se invalida al subir la versión de posición', () => {
  const f = fixture()
  const first = Box3.scans
  staticApi.worldBounds(f.mesh, new Box3())
  staticApi.worldBounds(f.mesh, new Box3())
  assert.equal(Box3.scans - first, 1)
  f.attr.array[0] = -10
  f.attr.version++
  assert.equal(staticApi.worldBounds(f.mesh, new Box3()).min.x, -10)
  assert.equal(Box3.scans - first, 2)
})

test('cambiar el atributo position o su buffer interleaved invalida la caché', () => {
  const f = fixture()
  staticApi.worldBounds(f.mesh, new Box3())
  const attr = { ...f.attr, array: new Float32Array([-20, -1, 0, 3, -1, 0, 0, 5, 0]), version: 0 }
  f.geometry.attributes.position = attr
  assert.equal(staticApi.worldBounds(f.mesh, new Box3()).min.x, -20)
  attr.version = undefined
  attr.data = { version: 1 }
  attr.array[0] = -30
  assert.equal(staticApi.worldBounds(f.mesh, new Box3()).min.x, -30)
})

test('una geometría compartida conserva límites separados por transformación mundial', () => {
  const f = fixture()
  const other = { ...f.mesh, matrixWorld: new Matrix4(12, 3, -4) }
  const a = staticApi.worldBounds(f.mesh, new Box3())
  const b = staticApi.worldBounds(other, new Box3())
  assert.equal(a.min.x, -2)
  assert.equal(b.min.x, 10)
  assert.equal(b.max.y, 8)
  assert.equal(b.min.z, -4)
})

test('sceneOcclusionInputs recopila límites reales y mantiene el nodo aunque no sea oclusor opaco', () => {
  const f = fixture()
  const found = bakeApi.sceneOcclusionInputs(f.graph)
  assert.equal(found.meshes.length, 1)
  assert.equal(found.occluders.length, 0)
  assert.equal(found.meshes[0].limits.join(','), '-2,-1,0,3,5,0')
})

test('rehornéa tras editar vértices directamente aunque el atributo no incremente versión', () => {
  const f = fixture()
  const first = bakeApi.sceneOcclusionInputs(f.graph)
  assert.equal(first.meshes[0].limits[0], -2)
  f.attr.array[0] = -7
  const second = bakeApi.sceneOcclusionInputs(f.graph)
  assert.equal(second.meshes[0].limits[0], -7)
  assert.equal(second.bounds.min.x, -7)
})

test('el horneado sin oclusores termina sin descartes y admite un segundo horneado', async () => {
  const f = fixture()
  const progress = []
  const first = await bakeApi.bakeStaticOcclusion(f.graph, { onProgress: p => progress.push(p) })
  assert.equal(first.version, 2)
  assert.equal(first.covered, 0)
  assert.equal(first.meshes.length, 1)
  assert.equal(progress.at(-1), 1)
  f.attr.array[1] = -9
  const second = await bakeApi.bakeStaticOcclusion(f.graph)
  assert.equal(second.meshes[0].limits[1], -9)
  assert.equal(second.covered, 0)
})

test('malla de límites no finitos no contamina el volumen de horneado', () => {
  const f = fixture()
  f.attr.array[0] = Infinity
  const result = bakeApi.sceneOcclusionInputs(f.graph)
  assert.equal(result.meshes.length, 0)
  assert.equal(result.occluders.length, 0)
  assert.equal(result.bounds.isEmpty(), true)
})

function enableOpaque(f) {
  Object.assign(f.mesh.material, {
    transparent: false, opacity: 1, side: 0, depthTest: true, depthWrite: true,
    colorWrite: true, depthFunc: 3, blending: 1, userData: {},
  })
  f.mesh.updateWorldMatrix = () => {}
  return f
}

test('sceneOcclusionInputs admite malla opaca editada como oclusor y captura su superficie', () => {
  const f = enableOpaque(fixture())
  const data = bakeApi.sceneOcclusionInputs(f.graph)
  assert.equal(data.meshes.length, 1)
  assert.equal(data.occluders.length, 1)
  assert.equal(data.occluders[0].mesh, 0)
  assert.equal(data.occluders[0].side, 0)
})

test('ruta GPU simulada recopila la malla estática, ejecuta readback y finaliza sin ocultar falsamente', async () => {
  const f = enableOpaque(fixture())
  const state = { readbacks: 0, currentTarget: null }
  const renderer = {
    capabilities: { maxTextureSize: 512 },
    getContext() { return { isContextLost: () => false } },
    getRenderTarget() { return state.currentTarget },
    getActiveCubeFace() { return 0 },
    getActiveMipmapLevel() { return 0 },
    getClearColor() { return new fakeThree.Color() },
    getClearAlpha() { return 1 },
    setRenderTarget(value) { state.currentTarget = value },
    setClearColor() {}, clear() {}, render() {},
    async readRenderTargetPixelsAsync(_target, _x, _y, width, height, pixels) {
      state.readbacks++
      for (let i = 0; i < width * height; i++) pixels[i * 4 + 3] = 255
    },
  }
  f.graph.vp.renderer = renderer
  const result = await bakeApi.bakeStaticOcclusion(f.graph)
  assert.equal(result.version, 2)
  assert.equal(result.meshes.length, 1)
  assert.equal(result.occluders.length, 1)
  assert.equal(result.covered, 0)
  assert.ok(state.readbacks > 0)
  assert.equal(state.currentTarget, null)
})
