// QA de contrato S01. Con npm ci instalado también ejecuta pruebas reales de Three.js sin GPU.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')

for (const path of [
  'src/engine/runtime/render/pbr.js', 'src/engine/runtime/scene/models.js',
  'src/engine/runtime/nodes/decal.js', 'src/engine/runtime/scene/objects.js',
  'src/components/Inspector.vue', 'vite.config.js',
]) {
  test(`S01: fuente presente ${path}`, () => assert.ok(source(path).length > 100))
}

test('S01: recursos WASM locales servidos en ambas compilaciones', () => {
  const cfg = source('vite.config.js')
  assert.match(cfg, /plugins: \[vue\(\), threeDecoderAssets\(\)/)
  assert.match(cfg, /three-decoders\/\$\{folder\}\/\$\{name\}/)
  assert.match(cfg, /decoderFiles/)
  assert.doesNotMatch(source('src/engine/runtime/scene/models.js'), /gstatic|cdn\./)
})

test('S01: registro único de decal y gestión de recursos', () => {
  assert.match(source('src/engine/runtime/nodes/index.js'), /import '\.\/decal\.js'/)
  assert.match(source('src/engine/runtime/scene/objects.js'), /disposeDecal/)
  assert.match(source('src/engine/runtime/scene-graph.js'), /_disposeModelDecoders\(\)/)
  assert.match(source('src/engine/runtime/scene/models.js'), /\.setDRACOLoader\(this\._draco\)/)
  assert.match(source('src/engine/runtime/scene/models.js'), /\.setKTX2Loader\(this\._ktx2\)/)
  assert.match(source('src/engine/runtime/scene/models.js'), /\.setMeshoptDecoder\(MeshoptDecoder\)/)
})

let three
try { three = await import('three') } catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e
}
if (!three) {
  test('S01: pruebas dinámicas requieren npm ci (sin dependencias aquí)', { skip: true }, () => {})
} else {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const { normalizePhysical, applyPhysicalMaterial } = await import('../src/engine/runtime/render/pbr.js')
  const { normalizeDecal } = await import('../src/engine/runtime/nodes/decal.js')
  const { makeObject } = await import('../src/engine/runtime/nodes/index.js')
  const { getDef } = await import('../src/engine/runtime/nodes/registry.js')
  test('S01: fixture GLB autocontenido se decodifica sin modificar el cargador', async () => {
    const fixture = readFileSync(resolve(root, 'scripts/fixtures/three-s01/plain-triangle.glb'))
    const binary = fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength)
    const parsed = await new Promise((resolve, reject) => new GLTFLoader().parse(binary, '', resolve, reject))
    assert.ok(parsed.scene.children.length)
  })
  test('S01: materiales antiguos conservan los valores físicos por defecto', () => {
    const m = new three.MeshPhysicalMaterial()
    applyPhysicalMaterial(m)
    assert.equal(m.clearcoat, 0)
    assert.equal(m.transmission, 0)
    assert.equal(m.ior, 1.5)
    assert.equal(m.sheen, 0)
    assert.equal(m.iridescence, 0)
    assert.equal(m.anisotropy, 0)
    m.dispose()
  })
  test('S01: valores físicos acotados y activación de features', () => {
    const p = normalizePhysical({ clearcoat: 2, ior: 0, anisotropy: 0.5, sheenColor: '#aabbcc' })
    assert.equal(p.clearcoat, 1)
    assert.equal(p.ior, 1)
    assert.equal(p.anisotropy, 0.5)
    const m = new three.MeshPhysicalMaterial()
    applyPhysicalMaterial(m, p)
    assert.equal(m.clearcoat, 1)
    assert.equal(m.anisotropy, 0.5)
    assert.equal(m.sheenColor.getHexString(), 'aabbcc')
    applyPhysicalMaterial(m, {})
    assert.equal(m.clearcoat, 0)
    assert.equal(m.anisotropy, 0)
    m.dispose()
  })
  test('S01: decal se proyecta y limpia sus geometrías sin alterar el objetivo', async () => {
    const scene = new three.Scene()
    const target = new three.Mesh(new three.BoxGeometry(2, 2, 2), new three.MeshBasicMaterial())
    scene.add(target)
    const obj = makeObject('decal', 'decal', { id: 'd', position: [0, 0, 1], props: { targetId: 't', image: 'tex', size: [1, 1, 0.5] } })
    const texture = new three.Texture()
    const def = getDef('decal')
    const node = def.build(obj, { getDecalTarget: () => target, getSpriteTexture: () => texture })
    scene.add(node)
    def.update(node, obj)
    assert.ok(node.userData.projections.length > 0)
    assert.ok(node.userData.projections[0].geometry.getAttribute('position').count > 0)
    const count = node.userData.projections.length
    def.update(node, obj)
    assert.equal(node.userData.projections.length, count)
    assert.equal(target.geometry.getAttribute('position').count, 24)
    const { disposeDecal } = await import('../src/engine/runtime/nodes/decal.js')
    disposeDecal(node)
    assert.equal(node.userData.projections.length, 0)
    target.geometry.dispose(); target.material.dispose(); texture.dispose()
  })
  test('S01: librerías WASM oficiales presentes después de npm ci', () => {
    const files = [
      'draco/gltf/draco_decoder.js', 'draco/gltf/draco_wasm_wrapper.js', 'draco/gltf/draco_decoder.wasm',
      'basis/basis_transcoder.js', 'basis/basis_transcoder.wasm',
    ]
    for (const f of files) assert.ok(existsSync(resolve(root, 'node_modules/three/examples/jsm/libs', f)), f)
  })
  test('S01: propiedades y referencias del decal serializan en JSON', () => {
    const p = normalizeDecal({ targetId: 'mesh-1', image: 'asset-1', size: [1, 2, 0.6], opacity: 0.5 })
    assert.deepEqual(JSON.parse(JSON.stringify(p)), p)
  })
}

// CORR-001: los tres controles reutilizan el mismo valor y la misma ruta de cambios.
test('CORR-001: campos numéricos editables se mantienen en el recurso Material', () => {
  const panel = source('src/components/MaterialSection.vue')
  const inspector = source('src/components/Inspector.vue')
  for (const field of ['roughness', 'metallic', 'opacity']) assert.ok(panel.includes(field), `${field}: campo perdido`)
  assert.match(panel, /<NumberField :model-value="effective\[f\.key\]/)
  assert.match(panel, /@update:model-value="setField\(f\.key,\$event\)"/)
  assert.match(inspector, /<MaterialSection v-if="obj\.type === 'primitive' \|\| obj\.type === 'mesh'"/)
})

test('CORR-001: decal y propiedades físicas avanzadas permanecen disponibles', () => {
  const inspector = source('src/components/Inspector.vue')
  const panel = source('src/components/MaterialSection.vue')
  assert.match(inspector, /obj\.props\.opacity \?\? 1.*@input="upd\(\{ props: \{ opacity: \+\$event\.target\.value \} \}, false\)"/)
  assert.match(panel, /v-for="f in fields"[\s\S]*?<NumberField :model-value="physical\[f\.key\]"/)
  assert.match(panel, /<summary>Propiedades físicas avanzadas<\/summary>/)
})
