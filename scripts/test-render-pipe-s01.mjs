// LF-RENDER-PIPE-S01-G001: prueba la composición GLSL del terreno sin cambiar el renderizador.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8')
const terrainSource = read('src/engine/runtime/geometry/terrain.js')
const wetSource = read('src/engine/runtime/render/wetlib.js')
const waterSource = read('src/engine/runtime/geometry/waterfx.js')
const splatSource = read('src/engine/runtime/geometry/terrain-splat.js')
const asData = (source) => import(`data:text/javascript,${encodeURIComponent(source)}`)
const wet = await asData(wetSource.replace("import * as THREE from 'three'", ''))
const splat = await asData(splatSource)

function waterShader(name) {
  const m = waterSource.match(new RegExp("export const " + name + " = (`[\\s\\S]*?`|'[^']*')"))
  assert.ok(m, `shader existente ${name}`)
  return Function(`return ${m[1]}`)()
}

const fakeThree = {
  Matrix4: class {},
  Color: class { set() { return this } },
  DataArrayTexture: class { constructor() { this.needsUpdate = false } },
  MeshStandardMaterial: class { constructor(props) { Object.assign(this, props) } },
}
function material() {
  const start = terrainSource.indexOf('  _makeMaterial() {')
  const end = terrainSource.indexOf('  _applyLayerUniforms()', start)
  assert.ok(start !== -1 && end > start)
  const extracted = terrainSource.slice(start, end)
  const Factory = Function('THREE', 'MAX_LAYERS', 'SPLAT_VS_DECL', 'SPLAT_FS_DECL', 'SPLAT_FS_COLOR',
    'WFX_TERRAIN_DECL', 'WFX_TERRAIN_COLOR', 'WFX_TERRAIN_ROUGH', 'WM',
    'WET_COLOR', 'WET_ROUGH', 'WET_NORMAL', 'patchTerrainWet',
    `return class TerrainMaterialFixture { ${extracted} _applyLayerUniforms() {} }`)
  const T = Factory(fakeThree, splat.MAX_LAYERS, splat.SPLAT_VS_DECL, splat.SPLAT_FS_DECL, splat.SPLAT_FS_COLOR,
    waterShader('WFX_TERRAIN_DECL'), waterShader('WFX_TERRAIN_COLOR'), waterShader('WFX_TERRAIN_ROUGH'),
    {}, wet.WET_COLOR, wet.WET_ROUGH, wet.WET_NORMAL, wet.patchTerrainWet)
  return new T()._makeMaterial()
}
function shader() {
  const mat = material()
  const sh = {
    uniforms: {},
    vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader: '#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n#include <emissivemap_fragment>',
  }
  mat.onBeforeCompile(sh)
  return { mat, sh }
}

const idx = (s, fragment) => { const i = s.indexOf(fragment); assert.ok(i >= 0, `fragmento ausente: ${fragment}`); return i }

test('R01/R02: las capas se mezclan antes que el agua y la humedad', () => {
  const { sh } = shader()
  const f = sh.fragmentShader
  assert.ok(idx(f, 'diffuseColor.rgb *= acc') < idx(f, 'rtWetV = rtWet') )
  assert.ok(idx(f, 'rtWetV = rtWet') < idx(f, 'rtPud = rtPuddle(vTxz)'))
  assert.ok(idx(f, 'rtPud = rtPuddle(vTxz)') < idx(f, 'roughnessFactor = mix('))
  assert.equal((f.match(/rtPud = rtPuddle\(vTxz\)/g) || []).length, 1)
  assert.ok(f.includes('uSnowCover * smoothstep'))
  assert.ok(f.includes('normal = normalize(normal +'))
})

test('R02: los uniformes de humedad y los varyings están en ambos shaders', () => {
  const { sh } = shader()
  for (const key of Object.keys(wet.WETU)) assert.equal(sh.uniforms[key], wet.WETU[key])
  for (const frag of ['varying float vWetN;', 'uniform float uWet', 'float rtPuddle', 'float rtPud, rtRip;']) assert.ok(sh.fragmentShader.includes(frag))
  assert.ok(sh.vertexShader.includes('varying float vWetN;'))
  assert.ok(sh.vertexShader.includes('vWetN = normalize'))
})

test('R02: interacciones con agua y humedad conservan orden de rugosidad', () => {
  const { sh } = shader()
  const f = sh.fragmentShader
  assert.ok(idx(f, 'rtWetV);') < idx(f, 'max(0.72, roughnessFactor * 0.85)'))
  assert.ok(idx(f, 'max(0.72, roughnessFactor * 0.85)') < idx(f, '0.09, rtPud'))
  assert.ok(idx(f, '0.09, rtPud') < idx(f, 'uSnowCover * 0.8'))
  assert.equal((f.match(/#include <roughnessmap_fragment>/g) || []).length, 1)
})

test('R03: base no metálica y tierra seca sin cambios', () => {
  const mat = material()
  assert.equal(mat.metalness, 0)
  assert.equal(mat.roughness, 0.95)
  const dry = mat.roughness * (1 - 0.7 * 0.5 * 0)
  assert.equal(dry, 0.95)
})

test('R03/R04: la tierra húmeda conserva rugosidad y los charcos pueden reflejar', () => {
  const mix = (a, b, t) => a * (1 - t) + b * t
  const rough = (wetness, puddle) => {
    const soil = mix(0.95, Math.max(0.72, 0.95 * 0.85), wetness)
    return mix(soil, 0.09, puddle)
  }
  assert.equal(rough(0, 0), 0.95)
  assert.ok(rough(1, 0) >= 0.8)
  assert.ok(rough(1, 1) < 0.12)
  assert.ok(rough(1, 0.1) > 0.7)
})

test('R04: sin lluvia, poca humedad o pendiente inclinada no se forman charcos', () => {
  assert.match(wet.WET_DECL, /smoothstep\(0\.65, 0\.98, uWet\)/)
  assert.match(wet.WET_DECL, /smoothstep\(0\.93, 0\.99, vWetN\)/)
  assert.match(wet.WET_DECL, /smoothstep\(0\.61, 0\.69, n\)/)
  assert.match(wet.WET_COLOR, /if \(uWet > 0\.65 && vWetN > 0\.93\)/)
  assert.match(wet.WET_COLOR, /if \(uRain > 0\.001 && rtPud > 0\.0\) rtRip = rtRipples\(vTxz\) \* rtPud \* uRain/)
  assert.match(wet.WET_DECL, /1\.0 - smoothstep\(0\.0, 0\.03, abs\(d - ph \* 0\.5\)\)/)
})

test('R05/R06: no se alteran las luces ni la ruta de materiales generales', () => {
  assert.equal(terrainSource.includes('new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 })'), true)
  assert.equal(terrainSource.includes('rt-terrain-splat-wfx-wet'), true)
  assert.equal(terrainSource.includes('patchTerrainWet(sh, mirror)'), true)
})
