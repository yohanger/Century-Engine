import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { normalizeSurfaceDetail, surfaceDetailFromLegacy, surfaceDetailSupport } from '../src/engine/runtime/render/surface-detail.js'
import { materialFromObject, normalizeMaterial, effectiveMaterialObject } from '../src/engine/runtime/render/material-resource.js'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const raw = { mode: 'height', texture: 'height-asset', strength: 2, micro: 0.4, microScale: 0.08 }

test('SD-01 · ausencia de detalle conserva el contrato heredado', () => {
  assert.equal(normalizeSurfaceDetail(), null)
  const mat = normalizeMaterial({ mat: { shader: 'builtin:realista', params: { uNormal: 'normal-old', uMicro: .7 } } })
  assert.equal(mat.mat.surfaceDetail, undefined)
  assert.equal(mat.mat.params.uNormal, 'normal-old')
  assert.equal(mat.mat.params.uMicro, .7)
})
test('SD-02 · normaliza intervalos y referencias sin compartir el objeto fuente', () => {
  const src = { ...raw, strength: 80, micro: -1, microScale: 0, mode: 'unknown' }
  const normalized = normalizeSurfaceDetail(src)
  assert.deepEqual(normalized, { mode: 'none', texture: 'height-asset', strength: 4, micro: 0, microScale: .01 })
  src.texture = 'changed'
  assert.equal(normalized.texture, 'height-asset')
})
test('SD-03 · recurso .material serializa detalle y conserva propiedades físicas', () => {
  const src = { color: '#aabbcc', mat: { shader: 'builtin:realista', surfaceDetail: raw, physical: { clearcoat: .8 }, params: { uTile: 2 } } }
  const resource = materialFromObject(src, 'mt', 'Piedra.material')
  assert.deepEqual(resource.mat.surfaceDetail, raw)
  assert.equal(resource.mat.physical.clearcoat, .8)
  assert.equal(resource.mat.params.uTile, 2)
  assert.deepEqual(normalizeMaterial(JSON.parse(JSON.stringify(resource))).mat.surfaceDetail, raw)
  assert.equal(effectiveMaterialObject({ materialId: 'mt' }, [resource]).mat.surfaceDetail.texture, 'height-asset')
})
test('SD-04 · legado Realista conserva ajustes de normal y microdetalle', () => {
  assert.deepEqual(surfaceDetailFromLegacy({ params: { uNormal: 'old', uNormalStrength: .6, uMicro: .8, uMicroScale: .25 } }),
    { mode: 'normal', texture: 'old', strength: .6, micro: .8, microScale: .25 })
})
test('SD-05 · shaders propios no reciben controles que no soportan', () => {
  assert.deepEqual(surfaceDetailSupport('custom:xyz'), { normal: false, height: false, procedural: false })
  assert.equal(surfaceDetailSupport('builtin:blockout').procedural, false)
  assert.equal(surfaceDetailSupport('builtin:realista').procedural, true)
})

test('SD-06 · shader Realista permite Bump triplanar y excluye normal al mismo tiempo', () => {
  const code = read('src/engine/runtime/render/shaderlib.js')
  assert.match(code, /uniform sampler2D uHeight;/)
  assert.match(code, /uHeight_set && !uNormal_set/)
  assert.match(code, /rtTriplanar\(uHeight, p, n, k\)/)
  assert.match(code, /uBumpStrength/)
  assert.match(code, /s\.normal = rtToView\(nm\)/)
})

test('SD-07 · Inspector único cubre objetos, recursos y superficies de carretera', () => {
  const panel = read('src/components/MaterialSurfaceDetail.vue')
  assert.match(panel, /data-testid="surface-detail-panel"/)
  assert.match(panel, /asset\.id/)
  assert.match(read('src/components/MaterialSection.vue'), /<MaterialSurfaceDetail/)
  assert.match(read('src/components/RoadPanel.vue'), /<MaterialSurfaceDetail/)
  assert.match(read('src/components/MaterialResourceEditor.vue'), /<MaterialSection :resource-id=/)
})

test('SD-08 · Shader Realista no duplica los parámetros delegados al Inspector', () => {
  const shader = read('src/components/MaterialShader.vue')
  assert.match(shader, /detailParams/)
  assert.match(shader, /detailParams\.has\(p\.key\)/)
  assert.match(shader, /\.\.\.mat\.value, shader: id/)
})

// Ejecuta la función real con un entorno Three mínimo para comprobar las transiciones.
function makeSyncHost() {
  const code = read('src/engine/runtime/render/pbr.js')
  const fragment = code.slice(code.indexOf('export function syncPbrMaterial'), code.indexOf('/** Asigna a las mallas'))
    .replace('export function syncPbrMaterial', 'function syncPbrMaterial')
  const info = { params: [
    { key: 'uNormal', uniform: 'uNormal', glsl: 'sampler2D' },
    { key: 'uHeight', uniform: 'uHeight', glsl: 'sampler2D' },
    { key: 'uNormalStrength', uniform: 'uNormalStrength', glsl: 'float', def: 1 },
    { key: 'uBumpStrength', uniform: 'uBumpStrength', glsl: 'float', def: 1 },
    { key: 'uMicro', uniform: 'uMicro', glsl: 'float', def: 0.35 },
    { key: 'uMicroScale', uniform: 'uMicroScale', glsl: 'float', def: 0.12 },
  ] }
  const runtime = { effectiveMaterialObject, normalizeSurfaceDetail,
    PBR_ENV: { look: 'clasico', materials: [] },
    THREE: { Material: class { onBeforeCompile() {} customProgramCacheKey() {} }, Vector3: class { copy(v) { return this } }, MeshDepthMaterial: class {}, MeshDistanceMaterial: class {}, RGBADepthPacking: 1 },
    applyPhysicalMaterial() {}, findShader: () => ({ id: 'builtin:realista', code: 'fake' }),
    infoOf: () => info, hashString: () => 'hash', blockoutFont: () => null,
    BUILTIN_SHADERS: [{ id: 'builtin:realista', code: 'fake' }], BUILTIN_PREFIX: 'builtin:', DEFAULT_SHADER_ID: 'builtin:realista',
    splitVertexStage: () => ({ vert: '', frag: 'void surface(inout Surface s) {}' }),
    injectProbes() {}, injectPsx() {}, setProbeArray() {}, iblDiffuse: () => false,
    PRELUDE_VERT: '', VERT_BODY: '', PRELUDE_FRAG: '', FRAG_BEGIN: '', FRAG_AO: '', LF_TIME: {},
    uniformDecls: () => '', stripParamUniforms: (s) => s, WHITE: 'white', toLinear: () => ({}),
  }
  vm.runInNewContext(fragment + '\nthis.sync = syncPbrMaterial', runtime)
  const m = { userData: {}, color: { set() {} }, normalScale: { set(x,y) { this.value=[x,y] } }, needsUpdate: false }
  const env = { look: 'clasico', materials: [], getMap(id,srgb) { return id ? `tex:${id}:${srgb}` : null } }
  const sync = (mat, mode = 'clasico') => runtime.sync(m, { color:'#ffffff', roughness:.5, metallic:0, opacity:1, mat }, { ...env, look: mode })
  return { m, sync }
}

test('SD-09 · clásico: normal y bump son mutuamente excluyentes y reversibles', () => {
  const { m, sync } = makeSyncHost()
  sync({ surfaceDetail: { mode:'normal', texture:'normal', strength:2 } })
  assert.equal(m.normalMap, 'tex:normal:false')
  assert.equal(m.bumpMap, null)
  assert.deepEqual(m.normalScale.value, [2,2])
  sync({ surfaceDetail: { mode:'height', texture:'height', strength:1 } })
  assert.equal(m.normalMap, null)
  assert.equal(m.bumpMap, 'tex:height:false')
  sync({ surfaceDetail: { mode:'none', texture:'height' } })
  assert.equal(m.bumpMap, null)
})

test('SD-10 · Realista triplanar: altura sin normalMap nativo; microdetalle independiente', () => {
  const { m, sync } = makeSyncHost()
  sync({ shader:'builtin:realista', surfaceDetail: raw }, 'realista')
  assert.equal(m.normalMap, null)
  assert.equal(m.bumpMap, null)
  assert.equal(m.userData.rt.uniforms.uHeight.value, 'tex:height-asset:undefined')
  assert.equal(m.userData.rt.uniforms.uHeight_set.value, true)
  assert.equal(m.userData.rt.uniforms.uNormal_set.value, false)
  assert.equal(m.userData.rt.uniforms.uMicro.value, .4)
})

test('SD-11 · Realista heredado: conserva normal map y micro originales', () => {
  const { m, sync } = makeSyncHost()
  sync({ shader:'builtin:realista', params: { uNormal:'legacy', uMicro:.75 } }, 'realista')
  assert.equal(m.userData.rt.uniforms.uNormal.value, 'tex:legacy:undefined')
  assert.equal(m.userData.rt.uniforms.uMicro.value, .75)
  assert.equal(m.userData.rt.uniforms.uHeight_set.value, false)
})
