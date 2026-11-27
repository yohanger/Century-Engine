// LF-THREE-S05-G001: contratos y pruebas de ejecución del batching estático.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeRender, rendererPreset } from '../src/engine/runtime/render/config.js'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const source = read('src/engine/runtime/render/static-batch.js')
const lod = read('src/engine/runtime/render/lodmgr.js')
const play = read('src/engine/runtime/events/play.js')
const teardown = read('src/engine/runtime/events/play-level.js')
const inspector = read('src/components/Inspector.vue')
const controls = read('src/core/templates/renderParams.js')

test('S05: opción global opt-in: proyectos antiguos y presets desactivados', () => {
  assert.equal(normalizeRender(null).batchStatic, false)
  assert.equal(normalizeRender({ look: 'realista' }).batchStatic, false)
  for (const kind of ['forward', 'mobile', 'compat']) assert.equal(rendererPreset(kind).batchStatic, false)
  assert.equal(normalizeRender({ batchStatic: 1 }).batchStatic, false)
  assert.equal(normalizeRender({ look: 'clasico', batchStatic: true, lod: false }).batchStatic, true)
})
test('S05: control global y bandera por objeto sin segundo gestor de autoría', () => {
  assert.match(controls, /key: 'batchStatic', label: 'Batching de decoración'/)
  assert.match(inspector, /props\?\.batchStatic === true/)
  assert.match(inspector, /batchStatic: \$event\.target\.checked/)
  assert.match(source, /obj\.props\?\.batchStatic !== true/)
})
test('S05: se integra al LodManager, y funciona con LOD desactivado', () => {
  assert.match(lod, /new StaticBatcher\(this\.ed\)/)
  assert.match(lod, /if \(!this\.enableLod\) return/)
  assert.match(lod, /this\.batcher\?\.detach\(\)/)
  assert.match(lod, /if \(!m\.visible \|\| !m\.isMesh/)
  assert.match(play, /rc\.lod \|\| rc\.batchStatic/)
  assert.match(teardown, /this\.lod\?\.detach\(\)/)
})
test('S05: GPU no compatible conserva render original; no fallback costoso', () => {
  assert.match(source, /extensions\?\.has\?\.\('WEBGL_multi_draw'\)/)
  assert.match(source, /WEBGL_multi_draw no disponible/)
})
test('S05: evita efectos y geometría incompatibles sin reemplazar shaders ni lightmaps', () => {
  assert.match(source, /obj\.gi === 'lightmap'/)
  assert.match(source, /m\.userData\?\.rt/)
  assert.match(source, /m\.isSkinnedMesh \|\| m\.isInstancedMesh/)
  assert.match(source, /mesh\.matrixWorld\.determinant\(\) > 0/)
  assert.match(source, /if \(mesh \|\|/)
})
test('S05: mantendrá selección, referencias, colisiones y ciclo de Play', () => {
  assert.match(source, /c\.mesh\.visible = false/)
  assert.match(source, /mesh\.visible = wasVisible/)
  assert.match(source, /batch\.parent\?\.remove\(batch\); batch\.dispose\(\)/)
  assert.doesNotMatch(source, /\.nodes\.delete|\.phys\.removeMesh/)
  assert.match(play, /this\.lod\?\.detach\(\)/)
})

// Ejecuta las funciones reales con sustitutos de Three.js, sin declarar un PASS de WebGL.
let batchId = 0
class FakeBatch {
  constructor(instances, verts, indices, material) {
    this.id = ++batchId; this.instances = instances; this.verts = verts; this.indices = indices; this.material = material
    this.added = []; this.matrices = []; this.disposed = false; this.parent = null
  }
  addGeometry(g) { this.added.push(g); return this.added.length - 1 }
  addInstance(gid) { return gid * 100 + this.matrices.length }
  setMatrixAt(id, mat) { this.matrices.push([id, mat]) }
  dispose() { this.disposed = true }
}
const fakeThree = { BatchedMesh: FakeBatch, Material: class { onBeforeCompile() {} } }
const cleaned = source.replace(/^import \* as THREE from 'three'\s*/m, '').replace(/^export (function|class) /gm, '$1 ')
const { batchCandidate, StaticBatcher } = new Function('THREE', `${cleaned}\nreturn {batchCandidate, StaticBatcher}`)(fakeThree)

function fixture(count = 3, { supported = true, sharedGeometry = false } = {}) {
  const material = () => ({ isMaterial: true, isMeshPhysicalMaterial: true, opacity: 1, color: { getHexString: () => 'bbbbbb' }, emissive: { getHexString: () => '000000' }, metalness: 0.2, roughness: 0.8, side: 0, userData: { rtLfEffects: true } })
  const mkGeometry = () => ({ isBufferGeometry: true, groups: [], morphAttributes: {}, attributes: { position: { count: 24, itemSize: 3, normalized: false, array: new Float32Array(72) }, normal: { count: 24, itemSize: 3, normalized: false, array: new Float32Array(72) } }, index: { count: 36 } })
  const geo = mkGeometry()
  const nodes = new Map(), objs = [], meshes = []
  for (let i = 0; i < count; i++) {
    const obj = { id: 'p' + i, type: i % 2 ? 'mesh' : 'primitive', visible: true, castShadow: true, props: { batchStatic: true } }
    const mesh = { isMesh: true, visible: true, geometry: sharedGeometry ? geo : mkGeometry(), material: material(), castShadow: true, receiveShadow: true, userData: {}, updateWorldMatrix() {}, matrixWorld: { determinant: () => 1 } }
    meshes.push(mesh)
    nodes.set(obj.id, { children: [], traverse(fn) { fn(mesh) } }); objs.push(obj)
  }
  const scene = { children: [], add(batch) { this.children.push(batch); batch.parent = this }, remove(batch) { this.children.splice(this.children.indexOf(batch), 1); batch.parent = null } }
  let renders = 0
  const ed = { host: { project: { objects: objs } }, nodes, vp: { scene, renderer: { extensions: { has(name) { assert.equal(name, 'WEBGL_multi_draw'); return supported } } }, perf: { stats: { extra: {} } }, requestRender() { renders++ } } }
  return { ed, meshes, objs, nodes, scene, renders: () => renders }
}
test('S05: tres objetos compatibles pasan a un batch único con identidad intacta', () => {
  const f = fixture(3), b = new StaticBatcher(f.ed)
  const stat = b.attach()
  assert.equal(stat.batches, 1)
  assert.equal(stat.objects, 3)
  assert.equal(f.scene.children.length, 1)
  assert.equal(f.scene.children[0].matrices.length, 3)
  assert.ok(f.meshes.every(m => m.visible === false))
  assert.equal(f.scene.children[0].raycast.length, 0) // el batch no captura game.raycast
  assert.strictEqual(f.nodes.get('p0').children.length, 0)
  assert.equal(f.ed.vp.perf.stats.extra.batchedObjects, 3)
  b.detach()
  assert.ok(f.meshes.every(m => m.visible === true))
  assert.equal(f.scene.children.length, 0)
  assert.equal(f.ed.vp.perf.stats.extra.batchedObjects, 0)
})
test('S05: geometría compartida se carga una vez, sin duplicar vértices', () => {
  const f = fixture(4, { sharedGeometry: true }), b = new StaticBatcher(f.ed)
  b.attach()
  assert.equal(f.scene.children[0].added.length, 1)
  assert.equal(f.scene.children[0].verts, 24)
  b.detach()
})
test('S05: extensión ausente retorna sin cambiar ni una malla', () => {
  const f = fixture(4, { supported: false }), b = new StaticBatcher(f.ed)
  b.attach()
  assert.equal(f.scene.children.length, 0)
  assert.ok(f.meshes.every(m => m.visible))
  assert.match(b.stats.reason, /WEBGL_multi_draw/)
})
test('S05: con menos de tres candidatos no crea batches', () => {
  const f = fixture(2), b = new StaticBatcher(f.ed)
  b.attach()
  assert.equal(b.stats.batches, 0)
  assert.ok(f.meshes.every(m => m.visible))
})
test('S05: descarta shaders, escala invertida, colisiones no cambian', () => {
  const f = fixture(3)
  f.objs[0].mat = { shader: 'custom' }
  assert.equal(batchCandidate(f.objs[0], f.nodes.get('p0')), null)
  delete f.objs[0].mat
  f.meshes[0].matrixWorld.determinant = () => -1
  assert.equal(batchCandidate(f.objs[0], f.nodes.get('p0')), null)
  f.meshes[0].matrixWorld.determinant = () => 1
  f.objs[0].gi = 'lightmap'
  assert.equal(batchCandidate(f.objs[0], f.nodes.get('p0')), null)
})
test('S05: varias agrupaciones y desmontaje no destruyen materiales originales', () => {
  const f = fixture(6)
  for (let i = 3; i < 6; i++) f.meshes[i].material.color.getHexString = () => 'aa0000'
  const originals = f.meshes.map(m => m.material)
  const b = new StaticBatcher(f.ed)
  b.attach()
  assert.equal(b.stats.batches, 2)
  const batches = [...f.scene.children]
  b.detach()
  assert.ok(batches.every(o => o.disposed))
  assert.ok(f.meshes.every((m,i) => m.material === originals[i] && m.visible))
})
test('S05: flags solo de decoración; no se agrupan objetos no autorizados', () => {
  const f = fixture(3)
  f.objs[1].props.batchStatic = false
  const b = new StaticBatcher(f.ed)
  b.attach()
  assert.equal(f.scene.children.length, 0)
  assert.ok(f.meshes.every(m => m.visible))
})
let Three
try { Three = await import('three') } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e }
if (!Three) test('S05: integración GPU real pendiente de npm ci en usuario', { skip: 'Three.js no instalado' }, () => {})
else test('S05: Three.js r170 BatchedMesh acepta distintas geometrías y libera recursos', () => {
  const a = new Three.BoxGeometry(), b = new Three.SphereGeometry(1, 8, 6)
  const batch = new Three.BatchedMesh(2, a.attributes.position.count + b.attributes.position.count, a.index.count + b.index.count, new Three.MeshPhysicalMaterial())
  const ai = batch.addGeometry(a), bi = batch.addGeometry(b)
  batch.setMatrixAt(batch.addInstance(ai), new Three.Matrix4())
  batch.setMatrixAt(batch.addInstance(bi), new Three.Matrix4().makeTranslation(2, 0, 0))
  assert.equal(batch.instanceCount, 2)
  batch.dispose(); a.dispose(); b.dispose(); batch.material.dispose()
})
