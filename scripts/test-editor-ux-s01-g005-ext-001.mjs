import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const primitive = read('src/engine/runtime/nodes/primitive.js')
const shaderlib = read('src/engine/runtime/render/shaderlib.js')
const editor = read('src/core/editor/meshedit.js')
const material = read('src/components/MaterialShader.vue')
const pbr = read('src/engine/runtime/render/pbr.js')
const mesh = read('src/engine/runtime/nodes/mesh.js')
const block = shaderlib.match(/const BLOCKOUT = \/\* glsl \*\/`([\s\S]*?)`\s*\n\n/)
assert.ok(block, 'shader blockout incluido')
const code = block[1]

function makePrimitive(kind, dims) {
  const src = primitive.match(/create\(kind\)\s*\{([\s\S]*?)\n  \},/)
  assert.ok(src, 'create se conserva en el registro de nodos')
  const catalog = { [kind]: { label: 'Prueba', defaults: { scale: dims, props: {} } } }
  return Function('PRIMITIVES', 'kind', src[1])(catalog, kind)
}

test('EXT001-01: blockout registrado como shader incluido y no reemplaza Realista por defecto', () => {
  assert.match(shaderlib, /id: BUILTIN_PREFIX \+ 'blockout', name:/)
  assert.match(shaderlib, /DEFAULT_SHADER_ID = BUILTIN_PREFIX \+ 'realista'/)
})
test('EXT001-02: primitivas nuevas reciben material propio en mapeo objeto', () => {
  for (const kind of ['box', 'ramp', 'stairs', 'plane', 'sphere', 'cone', 'cylinder']) {
    const p = makePrimitive(kind, [2, 3, 4])
    assert.equal(p.mat.shader, 'builtin:blockout')
    assert.equal(p.mat.mapping, 'object')
    assert.deepEqual(p.scale, [2, 3, 4])
    assert.equal(p.color, '#ffffff')
  }
})
test('EXT001-03: cada objeto nuevo recibe su propio contenedor editable', () => {
  const a = makePrimitive('box', [1, 1, 1])
  const b = makePrimitive('box', [1, 1, 1])
  a.mat.params.uTile = 5
  assert.deepEqual(b.mat.params, {})
})
test('EXT001-04: shader calcula cuadrados de 1 metro y antialias sin nuevas geometrías', () => {
  assert.match(code, /floor\(p \+ vec2\(0\.5\)\)/)
  assert.match(code, /fract\(p \+ vec2\(0\.5\)\)/)
  assert.match(code, /fwidth\(p\)/)
  assert.doesNotMatch(primitive, /subdivide|sliceGeometry/)
})
test('EXT001-05: patrón triplanar visible sin UV generadas o dependencias de imagen', () => {
  assert.match(code, /rtBlend\(n\)/)
  for (const face of ['p.zy', 'p.xz', 'p.xy']) assert.ok(code.includes('lfBlockColor(' + face + ')'))
  assert.doesNotMatch(code, /vLfUv|s\.uv/)
})
test('EXT001-06: textura Albedo seleccionada sustituye el patrón blockout', () => {
  assert.match(code, /uniform sampler2D uAlbedo;\s*\/\/ @param/)
  assert.match(code, /if \(uAlbedo_set\) \{/)
  assert.match(code, /rtTriplanar\(uAlbedo, p, n, 1\.0 \/ max\(uTile, 0\.05\)\)/)
  assert.match(code, /\} else \{\s*vec3 w = rtBlend/)
})
test('EXT001-07: tamaño de textura importada por defecto 1 metro; no altera grid', () => {
  assert.match(code, /uniform float uTile;[^\n]*default=1/)
  const surface = code.slice(code.indexOf('void surface(inout Surface s)'))
  const beforeElse = surface.split('} else {')[0]
  assert.doesNotMatch(beforeElse, /lfBlockColor\(/)
})
test('EXT001-08: el material continúa siendo PBR con sombras y estado normal', () => {
  assert.match(primitive, /syncPbrMaterial\(root\.userData\.mat, obj\)/)
  assert.match(primitive, /applyShadowMats\(root\)/)
  assert.match(mesh, /syncPbrMaterial\(root\.userData\.mat, obj\)/)
  assert.match(pbr, /applyPhysicalMaterial\(m, obj\.mat\?\.physical\)/)
})
test('EXT001-09: la conversión a malla editable conserva mat/color, sin duplicarlos en props', () => {
  const fn = editor.match(/_convertToMesh\(obj\)\s*\{([\s\S]*?)\n  \},/)
  assert.ok(fn)
  const poly = { toJSON: () => ({ v: [0, 0, 0], f: [], rev: 1 }) }
  const run = Function('fromPrimitive', 'fromCarved', 'obj', fn[1])
  const obj = { id: 'p', type: 'primitive', kind: 'box', scale: [4, 3, 2], props: {}, mat: { shader: 'builtin:blockout', mapping: 'object', params: {} }, color: '#ffffff' }
  const ctx = { nodes: new Map(), syncObject: () => {} }
  run.call(ctx, () => poly, () => poly, obj)
  assert.equal(obj.type, 'mesh')
  assert.deepEqual(obj.scale, [1, 1, 1])
  assert.equal(obj.mat.shader, 'builtin:blockout')
  assert.equal(obj.color, '#ffffff')
})
test('EXT001-10: el selector de shader actualiza el recurso o el material local sin perder ParamForm', () => {
  assert.match(material, /const setShader = \(id\) => patchMaterial\(\{ mat: \{ shader: id, params: \{\}/)
  assert.match(material, /<ParamForm v-if="params\.length"/)
  assert.match(material, /v-for="o in options\.filter/)
})
test('EXT001-11: no se impone el blockout a proyectos antiguos sin mat.shader', () => {
  assert.match(pbr, /const sel = obj\.mat\?\.shader \|\| ''/)
  assert.match(pbr, /const id = sel \|\| \(env\.look === 'clasico' \? ''/)
  assert.doesNotMatch(pbr, /builtin:blockout/)
})
test('EXT001-12: el renderer del Player usa los mismos nodos, no otro shader local', () => {
  const nodes = read('src/engine/runtime/nodes/index.js')
  assert.match(nodes, /import '\.\/primitive\.js'/)
  assert.match(nodes, /import '\.\/mesh\.js'/)
  assert.match(pbr, /BUILTIN_SHADERS\.find/)
})
test('EXT001-13: cara de malla se vuelve a dibujar con el shader tras edición', () => {
  const session = read('src/core/mesh/session.js')
  assert.match(session, /this\.body = this\.node\.userData\.meshBody/)
  assert.match(session, /this\.node\.userData\.liveEdit = true/)
  assert.match(session, /this\._rebuildBody\(\)/)
})
