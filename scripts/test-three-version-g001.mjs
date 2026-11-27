// LF-THREE-VERSION-G001 · verificación previa a una migración de Three.js.
// Desde la adopción, el baseline principal debe resolver r186.1 de forma exacta.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const pkg = JSON.parse(read('package.json'))
const lock = JSON.parse(read('package-lock.json'))
const threeLock = lock.packages['node_modules/three']
const bvhLock = lock.packages['node_modules/three-mesh-bvh']
const files = {
  shaders: read('src/engine/runtime/render/chunks.js'),
  pbr: read('src/engine/runtime/render/pbr.js'),
  terrain: read('src/engine/runtime/geometry/terrain.js'),
  water: read('src/engine/runtime/geometry/watershader.js'),
  pipeline: read('src/engine/runtime/render/look.js'),
  batch: read('src/engine/runtime/render/static-batch.js'),
  hdr: read('src/engine/runtime/scene/environment.js'),
}

// No actualizar solo package.json: npm ci necesita coincidencia exacta con package-lock.json.
test('VERSION-01 · manifiesto y lockfile conservan la misma dependencia', () => {
  assert.equal(lock.packages[''].dependencies.three, pkg.dependencies.three)
  assert.equal(lock.packages[''].dependencies['three-mesh-bvh'], pkg.dependencies['three-mesh-bvh'])
  assert.equal(pkg.dependencies.three, '0.186.1', 'Versiones de producción sin fijar a r186.1')
  assert.equal(threeLock.version, '0.186.1', 'El lockfile no coincide con r186.1')
  assert.equal(threeLock.resolved, 'https://registry.npmjs.org/three/-/three-0.186.1.tgz')
  assert.ok(threeLock.integrity?.startsWith('sha512-'))
  assert.ok(bvhLock.integrity?.startsWith('sha512-'))
})
test('VERSION-02 · el proyecto no ha cambiado WebGLRenderer por WebGPU', () => {
  const viewport = read('src/engine/runtime/render/viewport.js')
  assert.match(viewport, /new THREE\.WebGLRenderer\(/)
  assert.doesNotMatch(viewport, /new (?:THREE\.)?WebGPURenderer\(/)
})
test('VERSION-03 · declarar todos los puntos de riesgo de los shaders originales', () => {
  assert.match(files.shaders, /THREE\.ShaderChunk\.lights_fragment_maps/)
  assert.match(files.shaders, /getIBLIrradiance\( geometryNormal \)/)
  assert.match(files.shaders, /inverseTransformDirection/)
  assert.match(files.pbr, /\.onBeforeCompile/)
  assert.match(files.terrain, /\.onBeforeCompile/)
  assert.match(files.water, /\.onBeforeCompile/)
})
test('VERSION-04 · HDRLoader requiere migración del import obsoleto', () => {
  // Durante r170 sigue RGBELoader; en r186 admite HDRLoader. Cualquier alternativa debe existir.
  assert.match(files.hdr, /loaders\/(RGBELoader|HDRLoader)\.js/)
})
test('VERSION-05 · los tres pases nuevos mantienen una sola ruta de compositor', () => {
  for (const name of ['SSRPass', 'OutlinePass']) assert.match(files.pipeline, new RegExp(name))
  assert.match(files.pipeline, /EffectComposer/)
  assert.match(files.batch, /THREE\.BatchedMesh/)
})
test('VERSION-06 · las fases no activan funcionalidades costosas por defecto', () => {
  const config = read('src/engine/runtime/render/config.js')
  assert.match(config, /ssr: false/)
  assert.match(config, /batchStatic: false/)
  const lights = read('src/engine/runtime/nodes/light.js')
  assert.match(lights, /flareOn: false/)
})

let THREE
try { THREE = await import('three') } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e }
if (!THREE) {
  test('VERSION-07 · resolución real de la dependencia (requiere npm ci)', { skip: true }, () => {})
  test('VERSION-08 · addons y shaders reales (requiere npm ci)', { skip: true }, () => {})
  test('VERSION-09 · compatibilidad BVH real (requiere npm ci)', { skip: true }, () => {})
} else {
  test('VERSION-07 · revisión instalada coincide con package-lock', () => {
    const installed = Number(THREE.REVISION)
    assert.equal(installed, Number(threeLock.version.split('.')[1]))
  })
  test('VERSION-08 · addons, ShaderChunk y geometría siguen disponibles', async () => {
    const addons = [
      ['three/addons/lights/RectAreaLightUniformsLib.js', 'RectAreaLightUniformsLib'],
      ['three/addons/objects/Lensflare.js', 'Lensflare'],
      ['three/addons/postprocessing/OutlinePass.js', 'OutlinePass'],
      ['three/addons/postprocessing/SSRPass.js', 'SSRPass'],
      ['three/addons/loaders/EXRLoader.js', 'EXRLoader'],
      [Number(THREE.REVISION) >= 180 ? 'three/addons/loaders/HDRLoader.js' : 'three/addons/loaders/RGBELoader.js', Number(THREE.REVISION) >= 180 ? 'HDRLoader' : 'RGBELoader'],
    ]
    for (const [spec, symbol] of addons) {
      const mod = await import(spec)
      assert.equal(typeof mod[symbol], 'function', `${spec} carece de ${symbol}`)
    }
    assert.match(THREE.ShaderChunk.lights_fragment_maps, /getIBLIrradiance\( geometryNormal \)/)
    const batch = new THREE.BatchedMesh(1, 24, 36, new THREE.MeshStandardMaterial())
    assert.equal(typeof batch.addGeometry, 'function')
    batch.dispose()
    batch.material.dispose()
  })
  test('VERSION-09 · API mínima de three-mesh-bvh', async t => {
    let bvh
    try { bvh = await import('three-mesh-bvh') } catch (e) {
      if (e.code === 'ERR_MODULE_NOT_FOUND') return t.skip('Instalar dependencias antes de ejecutar esta prueba')
      throw e
    }
    for (const symbol of ['MeshBVH', 'MeshBVHUniformStruct', 'FloatVertexAttributeTexture', 'BVHShaderGLSL']) {
      assert.ok(bvh[symbol], `Falta export ${symbol}`)
    }
  })
}
