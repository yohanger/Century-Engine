import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const text = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const moduleCode = (file) => text(file).replace(/^import .+\n/gm, '').replaceAll('export const ', 'const ').replaceAll('export function ', 'function ')
const geomEnv = {}
vm.runInNewContext(moduleCode('src/engine/runtime/geometry/road.js') + '\nthis.api={normalizeRoad,ROAD_DEFAULTS,ROAD_SLOTS,roadSurfaceColor,roadGeoKey}', geomEnv)
const { normalizeRoad, ROAD_DEFAULTS, ROAD_SLOTS, roadSurfaceColor } = geomEnv.api
const resEnv = {}
vm.runInNewContext(moduleCode('src/engine/runtime/render/material-resource.js') + '\nthis.api={effectiveMaterialObject,materialFromObject}', resEnv)
const renderEnv = { effectiveMaterialObject: resEnv.api.effectiveMaterialObject, roadSurfaceColor }
vm.runInNewContext(moduleCode('src/engine/runtime/render/road-material.js') + '\nthis.api={roadSlotMaterial,defaultNewRoadAsphalt}', renderEnv)
const { roadSlotMaterial, defaultNewRoadAsphalt } = renderEnv.api
const plain = (v) => JSON.parse(JSON.stringify(v))

class BufferAttribute { constructor(array, size) { this.array = array; this.itemSize = size } }
class BufferGeometry {
  attributes = {}; disposed = false
  setAttribute(k, v) { this.attributes[k] = v; return this }
  setIndex(v) { this.index = v; return this }
  computeBoundingSphere() { this.bounded = true }
  dispose() { this.disposed = true }
}
class Mesh {
  constructor(geometry, material) { this.geometry = geometry; this.material = material; this.userData = {} }
}
const syncs = []
const env = {
  THREE: { DoubleSide: 2, BufferGeometry, BufferAttribute, Mesh },
  normalizeRoad, ROAD_SLOTS, roadGeoKey: () => 'geom',
  registerNode: (v) => v, roadSlotMaterial, defaultNewRoadAsphalt,
  PBR_ENV: { look: 'realista', materials: [], shaders: [], getMap() {} },
  makePbrMaterial: () => ({ userData: {}, map: null, emissive: { set(v) { this.value = v } } }),
  syncPbrMaterial(m, data, opts) {
    syncs.push({ mat: m, data, look: opts.look })
    m.data = data
    m.userData.rt = data.mat?.shader ? { depthMat: 'depth', distMat: 'dist' } : null
  },
  makeRoot() {
    const root = { userData: {}, add(obj) { (this.children ||= []).push(obj) },
      updateWorldMatrix() {}, matrixWorld: { elements: [1, 0, 0, 1] } }
    return { root }
  },
  applyBase() {},
  buildRoad() {
    const b = { positions: new Float32Array([0, 0, 0, 4, 0, 0, 0, 0, 12]),
      normals: new Float32Array(9), uvs: new Float32Array([0, 0, 2, 0, 0, 6]), indices: new Uint16Array([0, 1, 2]) }
    return { length: 12, asphalt: b, center: b, lanes: b, side: b }
  },
}
vm.runInNewContext(text('src/engine/runtime/nodes/road.js').replace(/^import .+\n/gm, '').replace('export default registerNode(', 'this.def = registerNode('), env)
const def = env.def
const build = (obj) => { const root = def.build(obj); def.update(root, obj); return root }

test('ROAD-S02-01 · carretera nueva utiliza el mismo builtin:blockout que la primitiva', () => {
  const road = def.create()
  assert.equal(road.props.slots.asphalt.mat.shader, 'builtin:blockout')
  assert.equal(road.props.slots.asphalt.mat.mapping, 'object')
  assert.equal(road.props.slots.asphalt.color, '#ffffff')
  assert.equal(road.props.slots.center.color, ROAD_DEFAULTS.slots.center.color)
})
test('ROAD-S02-02 · normalizar un proyecto anterior no inyecta Blockout ni recursos', () => {
  const old = normalizeRoad({ slots: { asphalt: { color: '#232323', roughness: 0.41, texture: 'old' } } })
  assert.equal(old.slots.asphalt.color, '#232323')
  assert.equal(old.slots.asphalt.mat, undefined)
  assert.equal(old.slots.asphalt.materialId, undefined)
  assert.equal(old.slots.asphalt.texture, 'old')
})
test('ROAD-S02-03 · un recurso compartido sobrescribe el slot sin mutarlo', () => {
  const slot = { color: '#ff1111', roughness: .9, texture: 'local', materialId: 'mt1' }
  const resource = { id: 'mt1', color: '#abcdef', roughness: .16, metallic: .4, opacity: .7,
    mat: { shader: 'builtin:realista', params: { uMicro: .4, uAlbedo: 'asset' } } }
  const before = JSON.stringify(slot)
  const r = roadSlotMaterial(slot, 'asphalt', [resource], .5)
  assert.equal(r.color, '#abcdef')
  assert.equal(r.roughness, .16)
  assert.equal(r.metallic, .4)
  assert.ok(Math.abs(r.opacity - .35) < 1e-6)
  assert.equal(r.mat.params.uAlbedo, 'asset')
  assert.equal(r.directTexture, null)
  assert.equal(r.materialId, '') // no repetir resolución del recurso dentro de syncPbrMaterial
  assert.equal(JSON.stringify(slot), before)
})
test('ROAD-S02-04 · material no encontrado conserva sus valores locales', () => {
  const s = { color: '#badcfe', roughness: .6, materialId: 'missing', mat: { shader: 'builtin:blockout', params: {} } }
  const r = roadSlotMaterial(s, 'asphalt', [])
  assert.equal(r.color, '#badcfe')
  assert.equal(r.mat.shader, 'builtin:blockout')
  assert.equal(r.shared, false)
})
test('ROAD-S02-05 · la textura local se vincula a uAlbedo con escala métrica en PBR', () => {
  const s = { color: '#ffffff', texture: 'tex', tile: 3, roughness: .8,
    mat: { shader: 'builtin:blockout', params: {} } }
  const r = roadSlotMaterial(s, 'asphalt', [])
  assert.equal(r.mat.params.uAlbedo, 'tex')
  assert.equal(r.mat.params.uTile, 3)
})
test('ROAD-S02-06 · el material creado se puede convertir a recurso estándar .material', () => {
  const data = roadSlotMaterial({ color: '#ffffff', roughness: .8, mat: defaultNewRoadAsphalt().mat }, 'asphalt')
  const resource = resEnv.api.materialFromObject(data, 'mt2', 'Calzada.material')
  assert.equal(resource.mat.shader, 'builtin:blockout')
  assert.equal(resource.mat.mapping, 'object')
})
test('ROAD-S02-07 · los cuatro submeshes utilizan MeshPhysicalMaterial sin duplicar shaders', () => {
  const obj = { ...def.create(), opacity: 1 }
  const root = build(obj)
  assert.equal(root.children.length, 4)
  assert.equal(Object.keys(root.userData.mats).length, 4)
  assert.equal(syncs.at(-4).data.mat.shader, 'builtin:blockout')
  assert.equal(root.userData.parts.asphalt.material, root.userData.mats.asphalt)
})
test('ROAD-S02-08 · los atributos blockout están en metros, independientes de UV artísticas', () => {
  const obj = { ...def.create(), opacity: 1 }
  const root = build(obj)
  const g = root.userData.parts.asphalt.geometry
  assert.deepEqual(Array.from(g.attributes.uv.array), [0, 0, 2, 0, 0, 6])
  assert.deepEqual(Array.from(g.attributes.lfBlockUV.array), [0, 0, 12, 0, 0, 36])
  assert.equal(g.attributes.lfBlockSize.array.length, 6)
  assert.equal(g.attributes.lfBlockSize.array[1], 12)
  assert.equal(root.userData.mats.asphalt.userData.lfBlockFaces, true)
})
test('ROAD-S02-09 · un cambio de recurso no regenera la geometría', () => {
  const obj = { ...def.create(), opacity: 1 }
  const root = build(obj), geo = root.userData.parts.asphalt.geometry
  obj.props.slots.asphalt.materialId = 'a'
  env.PBR_ENV.materials = [{ id: 'a', color: '#abcdef', roughness: .5, metallic: 0, opacity: 1,
    mat: { shader: 'builtin:realista', params: {} } }]
  def.update(root, obj)
  assert.equal(root.userData.parts.asphalt.geometry, geo)
  assert.equal(root.userData.parts.asphalt.material.data.color, '#abcdef')
  env.PBR_ENV.materials = []
})
test('ROAD-S02-10 · carretera antigua conserva material clásico aun con look realista', () => {
  const obj = { props: normalizeRoad({slots:{asphalt:{color:'#343434'}}}), opacity: 1 }
  const root = build(obj)
  assert.equal(root.userData.mats.asphalt.data.color, '#343434')
  assert.equal(syncs.at(-4).look, 'clasico')
})
test('ROAD-S02-11 · al elegir imagen antigua se mantiene el mapa UV clásico', () => {
  const image={id:'tex'}
  const obj = { props: normalizeRoad({slots:{asphalt:{texture:'tex'}}}), opacity: 1 }
  const root = def.build(obj,{getTexture:(id)=>id==='tex'?image:null})
  def.update(root,obj)
  assert.equal(root.userData.mats.asphalt.map, image)
})
test('ROAD-S02-12 · pantalla ofrece material por superficie, crear, hacer local y editor del recurso', () => {
  const panel = text('src/components/RoadPanel.vue')
  assert.match(panel, /v-for="\[k, label\] in slotList"/)
  assert.match(panel, /selectMaterial\(k,/)
  assert.match(panel, /makeResource\(k\)/)
  assert.match(panel, /makeLocal\(k\)/)
  assert.match(panel, /MaterialShader/)
  assert.match(text('src/components/MaterialShader.vue'), /x\[0\]\.startsWith\('builtin:'\)/)
})
test('ROAD-S02-13 · cambios de recursos y de texturas vuelven a sincronizar las carreteras', () => {
  assert.match(text('src/core/state/materials.js'), /obj\.type === 'road'.*Object\.values\(obj\.props\?\.slots/)
  assert.match(text('src/engine/runtime/scene/environment.js'), /Object\.values\(n\.userData\.mats \|\| \{\}\)/)
  assert.match(text('src/engine/runtime/scene/environment.js'), /this\.refreshMaterials\(\)/)
})
test('ROAD-S02-14 · exportador Godot usa los valores de recurso como PBR estático', () => {
  const code = text('src/core/godot/nodes.js')
  assert.match(code, /roadSlotMaterial\(s, k, ex\.project\?\.materials/)
  assert.match(code, /effective\.metallic/)
  assert.match(code, /effective\.mat\?\.params\?\.uAlbedo/)
})
