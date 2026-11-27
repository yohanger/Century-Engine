// LF-STAIRS-SIDES-G001: parapetos sobre la malla y puntos de integración existentes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stairs, fromPrimitive, stairSideOptions, validStairSidesTurn } from '../src/engine/runtime/mesh/generators.js'
import { checkClosed, signedVolume, triangulate } from '../src/engine/runtime/mesh/polymesh.js'
import { polyBuffers, trimeshPoints } from '../src/engine/runtime/mesh/buffers.js'
import { buildMeshGLB } from '../src/core/godot/glb.js'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const options = (sides, sideHeight = 1, sideThickness = 0.15) => ({ sides, sideHeight, sideThickness })
const get = (sides, turn = 0, count = 8, scale = [3, 3, 6], height = 1, thick = 0.15) => stairs(...scale, count, turn, options(sides, height, thick))
const eps = (a, b, tol = 1e-5) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`)
const maxY = (m) => Math.max(...m.v.map((v) => v[1]))
const area = (v, a, b, c) => {
  const p = v[a], q = v[b], r = v[c]
  const u = q.map((x, i) => x - p[i]), w = r.map((x, i) => x - p[i])
  return Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2
}

test('SIDES-01: default y proyectos antiguos preservan exactamente la escalera previa', () => {
  for (const angle of [0, 45, -45]) {
    const orig = stairs(3, 3, 6, 8, angle), now = get('none', angle)
    assert.deepEqual(now.v, orig.v); assert.deepEqual(now.f, orig.f)
    assert.deepEqual(fromPrimitive('stairs', [3, 3, 6], { steps: 8, turn: angle }).f, orig.f)
  }
})
test('SIDES-02: normalización de modo rechaza valores desconocidos', () => {
  for (const mode of ['', null, 'all', 6, undefined]) assert.equal(stairSideOptions({ sides: mode }).sides, 'none')
  for (const mode of ['none', 'left', 'right', 'both']) assert.equal(stairSideOptions({ sides: mode }).sides, mode)
})
test('SIDES-03: altura y grosor tienen valores métricos y límites finitos', () => {
  assert.deepEqual(stairSideOptions({}), options('none'))
  for (const data of [{ sideHeight: NaN, sideThickness: Infinity }, { sideHeight: null, sideThickness: null }]) {
    assert.deepEqual(stairSideOptions(data), options('none'))
  }
  assert.deepEqual(stairSideOptions({ sideHeight: -5, sideThickness: -5 }), options('none', 0.1, 0.05))
  assert.deepEqual(stairSideOptions({ sideHeight: 99, sideThickness: 99 }), options('none', 5, 2))
})
test('SIDES-04: modo izquierdo añade un único parapeto', () => {
  const base = get('none'), left = get('left'), both = get('both')
  assert.ok(left.f.length > base.f.length)
  assert.equal(left.f.length - base.f.length, both.f.length - left.f.length)
})
test('SIDES-05: modo derecho añade un único parapeto', () => {
  const base = get('none'), right = get('right')
  assert.ok(right.v.length > base.v.length)
  assert.ok(right.f.length > base.f.length)
})
test('SIDES-06: ambos parapetos se añaden sin duplicar la malla base', () => {
  for (const turn of [0, 45, -45]) {
    const base = get('none', turn), one = get('left', turn), two = get('both', turn)
    assert.deepEqual(two.v.slice(0, base.v.length), base.v)
    assert.deepEqual(two.f.slice(0, base.f.length), base.f)
    assert.equal(two.v.length - base.v.length, 2 * (one.v.length - base.v.length))
  }
})
test('SIDES-07: topología cerrada con los cuatro modos y giros rectos o curvos', () => {
  for (const mode of ['none', 'left', 'right', 'both']) for (const turn of [0, 45, -45, 90, -90]) for (const n of [2, 8, 64]) {
    assert.deepEqual(checkClosed(get(mode, turn, n)), [], `${mode}/${turn}/${n}`)
  }
})
test('SIDES-08: todos los volúmenes mantienen orientación positiva', () => {
  for (const mode of ['left', 'right', 'both']) for (const angle of [0, 45, -45, 90]) {
    assert.ok(signedVolume(get(mode, angle)) > 0, `${mode}/${angle}`)
  }
})
test('SIDES-09: no aparecen triángulos degenerados al triangular las paredes', () => {
  for (const mode of ['left', 'right', 'both']) for (const turn of [0, 45, -45]) {
    const m = get(mode, turn), { tris } = triangulate(m)
    assert.ok(tris.length > 0 && tris.every(([a, b, c]) => area(m.v, a, b, c) > 1e-9))
  }
})
test('SIDES-10: altura lateral aumenta la altura real y mantiene suelo', () => {
  for (const angle of [0, 45]) {
    const wall = get('both', angle, 8, [3, 3, 6], 1.4)
    eps(maxY(wall), 3 / 2 + 1.4)
    eps(Math.min(...wall.v.map(v => v[1])), -1.5)
  }
})
test('SIDES-11: aumento del grosor no cambia las dimensiones de la escalera base', () => {
  const original = get('none')
  const thick = get('both', 0, 8, [3, 3, 6], 1, 0.5)
  assert.deepEqual(thick.v.slice(0, original.v.length), original.v)
  eps(Math.max(...thick.v.map(v => v[0])), 3 / 2 + 0.5)
  eps(Math.min(...thick.v.map(v => v[0])), -3 / 2 - 0.5)
})
test('SIDES-12: parapetos siguen la curva y no quedan como cajas rectas', () => {
  const straight = get('both', 0), curved = get('both', 45)
  assert.notDeepEqual(curved.v, straight.v)
  assert.ok(new Set(curved.v.map(v => v[0].toFixed(5))).size > new Set(straight.v.map(v => v[0].toFixed(5))).size)
})
test('SIDES-13: giro invertido genera perfiles equivalentes por espejo', () => {
  const points = (m) => m.v.map((p) => p.map((v) => v.toFixed(5)).join(',')).sort()
  const pos = get('both', 45), neg = get('both', -45)
  assert.deepEqual(points(pos), points({ v: neg.v.map(([x, y, z]) => [-x, y, z]) }))
})
test('SIDES-14: el parapeto interior reduce el radio disponible', () => {
  assert.equal(validStairSidesTurn(90, 3, 3, options('none')), true)
  assert.equal(validStairSidesTurn(90, 3, 3, options('left', 1, 0.6)), false)
  assert.equal(validStairSidesTurn(-90, 3, 3, options('right', 1, 0.6)), false)
})
test('SIDES-15: un parapeto exterior no consume radio interior', () => {
  assert.equal(validStairSidesTurn(90, 3, 3, options('right', 1, 0.6)), true)
  assert.equal(validStairSidesTurn(-90, 3, 3, options('left', 1, 0.6)), true)
})
test('SIDES-16: combinaciones incompatibles se degradan a recta sin NaN', () => {
  const m = get('both', 90, 8, [3, 3, 3], 1, 0.6)
  const ref = get('both', 0, 8, [3, 3, 3], 1, 0.6)
  assert.deepEqual(m.v, ref.v); assert.deepEqual(m.f, ref.f)
})
test('SIDES-17: Edit Mesh recibe exactamente el PolyMesh con parapetos', () => {
  for (const side of ['left', 'right', 'both']) for (const turn of [0, 60]) {
    const props = { steps: 8, turn, ...options(side) }
    const mesh = fromPrimitive('stairs', [3, 3, 6], props)
    assert.deepEqual(mesh.v, stairs(3, 3, 6, 8, turn, props).v)
    assert.deepEqual(mesh.f, stairs(3, 3, 6, 8, turn, props).f)
  }
})
test('SIDES-18: serialización conserva la malla, incluido el volumen lateral', () => {
  const m = get('both', 40), copy = m.constructor.fromJSON(m.toJSON())
  copy.v.forEach((p, i) => p.forEach((x, j) => eps(x, m.v[i][j])))
  assert.deepEqual(copy.f, m.f)
  assert.deepEqual(checkClosed(copy), [])
})
test('SIDES-19: colisión trimesh y buffers representan los mismos triángulos', () => {
  const m = get('both', 45), b = polyBuffers(m), t = trimeshPoints(m)
  assert.equal(t.length, b.positions.length)
  t.forEach((x, i) => eps(x, b.positions[i]))
})
test('SIDES-20: Blockout, UV y normales son datos finitos', () => {
  for (const mode of ['left', 'both']) for (const turn of [0, 90]) {
    const b = polyBuffers(get(mode, turn), { blockout: true })
    for (const field of ['positions', 'normals', 'uvs', 'blockUV', 'blockSize']) assert.ok(b[field].length > 0 && [...b[field]].every(Number.isFinite))
  }
})
test('SIDES-21: GLB conserva índices y coordenadas UV de los parapetos', () => {
  const b = polyBuffers(get('both', 45))
  const glb = buildMeshGLB({ name: 'EscaleraLaterales', positions: b.positions, normals: b.normals, indices: b.indices, uvs: b.uvs })
  const dv = new DataView(glb.buffer, glb.byteOffset, glb.byteLength)
  assert.equal(dv.getUint32(0, true), 0x46546c67)
  const len = dv.getUint32(12, true)
  const json = JSON.parse(new TextDecoder().decode(glb.slice(20, 20 + len)).trim())
  assert.equal(json.accessors[0].count, b.indices.length)
  assert.ok(json.meshes[0].primitives[0].attributes.TEXCOORD_0)
})
test('SIDES-22: Inspector edita modo, altura y grosor sin controles XYZ paralelos', () => {
  const file = source('src/components/Inspector.vue')
  for (const label of ['Laterales', 'Altura lateral (m)', 'Grosor lateral (m)']) assert.ok(file.includes(`<label>${label}</label>`))
  assert.match(file, /setStairSide\('sides'/)
  assert.match(file, /validStairSidesTurn\(turn/)
})
test('SIDES-23: Editor reconstruye si cambian dimensiones o props de paredes', () => {
  const sig = source('src/engine/runtime/nodes/three-helpers.js')
  for (const field of ['sides', 'sideHeight', 'sideThickness']) assert.ok(sig.includes(`obj.props?.${field}`))
  assert.match(source('src/engine/runtime/nodes/primitive.js'), /stairsGeometry\(obj\.props\?\.steps/)
})
test('SIDES-24: CSG usa la geometría con laterales y actualiza su firma', () => {
  const text = source('src/engine/runtime/scene/brushes.js')
  assert.match(text, /stairsGeometry\(o\.props\?\.steps/)
  for (const field of ['sides', 'sideHeight', 'sideThickness']) assert.ok(text.includes(`c.o.props?.${field}`))
})
test('SIDES-25: exportación Godot conserva las cajas legadas y usa GLB para paredes', () => {
  const godot = source('src/core/godot/nodes.js')
  assert.match(godot, /if \(turn !== 0 \|\| stairSideOptions\(o\.props\)\.sides !== 'none'\)/)
  assert.match(godot, /stairs\(sx, sy, sz, o\.props\?\.steps \?\? 8, turn, o\.props\)/)
  assert.match(godot, /stairSteps\(o\.props\?\.steps \?\? 8\)/)
  assert.match(godot, /ConcavePolygonShape3D/)
})
test('SIDES-26: event graphics conserva la escalera recta, sin regresión', () => {
  assert.match(source('src/engine/runtime/nodes/event.js'), /stairsGeometry\(gr\.steps \?\? 8\)/)
})
