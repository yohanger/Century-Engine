// LF-STAIRS-PARAM-G001: pruebas del generador geométrico y contratos de consumo.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeStairSteps, stairs, fromPrimitive } from '../src/engine/runtime/mesh/generators.js'
import { checkClosed, signedVolume, triangulate } from '../src/engine/runtime/mesh/polymesh.js'
import { polyBuffers, trimeshPoints } from '../src/engine/runtime/mesh/buffers.js'

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const almost = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`)
const bounds = (m) => [0, 1, 2].map((axis) => [Math.min(...m.v.map((p) => p[axis])), Math.max(...m.v.map((p) => p[axis]))])
const stepTop = (m, i, n, sy, sz) => {
  const z = -sz / 2 + (i + 0.5) * sz / n
  const horizontal = m.f.some((face) => face.length === 4 && face.every((v) => Math.abs(m.v[v][1] - (-sy / 2 + (i + 1) * sy / n)) < 1e-6) &&
    face.some((v) => Math.abs(m.v[v][2] - (z - sz / (2 * n))) < 1e-6) &&
    face.some((v) => Math.abs(m.v[v][2] - (z + sz / (2 * n))) < 1e-6))
  assert.equal(horizontal, true, `Falta huella ${i + 1}/${n}`)
}

test('STAIR-01: límites comunes de 2 a 64 y valores decimales', () => {
  for (const [value, expected] of [[2,2],[8,8],[40,40],[64,64],[1,2],[0,2],[-3,2],[65,64],[999999,64],[7.9,7]]) {
    assert.equal(normalizeStairSteps(value), expected)
  }
})

test('STAIR-02: faltantes y valores no finitos usan el predeterminado seguro', () => {
  for (const value of [undefined,null,NaN,Infinity,-Infinity,'abc']) assert.equal(normalizeStairSteps(value), 8)
  assert.equal(normalizeStairSteps('12'), 12)
})

test('STAIR-03: entradas fuera de rango no generan geometría desmedida', () => {
  assert.equal(stairs(3,3,6,999999).f.length, stairs(3,3,6,64).f.length)
  assert.equal(stairs(3,3,6,-100).f.length, stairs(3,3,6,2).f.length)
  assert.equal(stairs(3,3,6,Infinity).f.length, stairs(3,3,6,8).f.length)
})

test('STAIR-04: predeterminado de escenas anteriores permanece en ocho escalones', () => {
  assert.deepEqual(stairs(3,3,6).f, stairs(3,3,6,8).f)
  assert.deepEqual(fromPrimitive('stairs',[3,3,6],{}).f, stairs(3,3,6,8).f)
})

test('STAIR-05: topología sin bordes abiertos para 2, 8, 40 y 64', () => {
  for (const n of [2,8,40,64]) {
    const m = stairs(3,3,6,n)
    assert.deepEqual(checkClosed(m), [], `Aristas abiertas: ${n}`)
    assert.equal(m.f.length, 2*n + 4)
    assert.ok(signedVolume(m) > 0)
  }
})

test('STAIR-06: límites físicos de ancho, altura y profundidad (XYZ)', () => {
  for (const [sx,sy,sz] of [[3,3,6],[1.25,2.5,9],[5,1,2]]) {
    const m = stairs(sx,sy,sz,8)
    for (const [axis,dimension] of [sx,sy,sz].entries()) {
      almost(bounds(m)[axis][0],-dimension/2)
      almost(bounds(m)[axis][1],dimension/2)
    }
  }
})

test('STAIR-07: una huella horizontal por escalón, incluidos los extremos', () => {
  for (const n of [2,8,40,64]) {
    const m = stairs(3,3,6,n)
    for (let i=0;i<n;i++) stepTop(m,i,n,3,6)
  }
})

test('STAIR-08: volumen de escalera y peldaños sin huecos', () => {
  for (const n of [2,8,40,64]) {
    const [sx,sy,sz] = [3,3,6], m = stairs(sx,sy,sz,n)
    almost(signedVolume(m),sx*sy*sz*(n+1)/(2*n))
  }
})

test('STAIR-09: triangulación de 64 escalones completa y finita', () => {
  const m=stairs(3,3,6,64), { tris }=triangulate(m)
  assert.ok(tris.length>0)
  assert.ok(tris.every((f)=>f.length===3 && f.every((v)=>v>=0 && v<m.v.length)))
  assert.equal(tris.length, polyBuffers(m).indices.length/3)
})

test('STAIR-10: las normales de superficies horizontales apuntan hacia arriba', () => {
  const m=stairs(3,3,6,64)
  const tops = m.f.map((face,fi)=>({face,normal:m.faceNormal(fi)})).filter(({face,normal})=>face.length===4 && normal[1]>0.99 && face.every((v)=>Math.abs(m.v[v][1]-m.v[face[0]][1])<1e-6))
  assert.equal(tops.length,64)
  assert.ok(tops.every(({normal})=>normal[1]>0.99))
})

test('STAIR-11: UV y Blockout no producen valores inválidos', () => {
  const b=polyBuffers(stairs(3,3,6,64),{blockout:true})
  for (const attr of [b.positions,b.normals,b.uvs,b.blockUV,b.blockSize]) {
    assert.ok(attr.length>0)
    assert.ok([...attr].every(Number.isFinite))
  }
  assert.equal(b.uvs.length,b.blockUV.length)
  assert.equal(b.blockUV.length,b.blockSize.length)
})

test('STAIR-12: colisión trimesh y buffers de render comparten triángulos', () => {
  const m=stairs(1,1,1,40), b=polyBuffers(m), t=trimeshPoints(m)
  assert.equal(t.length,b.positions.length)
  t.forEach((v,i)=>almost(v,b.positions[i]))
})

test('STAIR-13: conversión a Edit Mesh mantiene dimensiones y forma', () => {
  const converted=fromPrimitive('stairs',[2.5,4,7],{steps:64})
  const original=stairs(2.5,4,7,64)
  assert.deepEqual(converted.v,original.v)
  assert.deepEqual(converted.f,original.f)
  assert.deepEqual(checkClosed(converted),[])
})

test('STAIR-14: guardar y reabrir mantiene topología', () => {
  const m=fromPrimitive('stairs',[3,3,6],{steps:8})
  const copy=m.constructor.fromJSON(m.toJSON())
  assert.deepEqual(copy.v,m.v)
  assert.deepEqual(copy.f,m.f)
  assert.deepEqual(checkClosed(copy),[])
})

test('STAIR-15: Vista Three.js consume PolyMesh y buffers, sin cajas solapadas', () => {
  const code=source('src/engine/runtime/geometry/primitives.js')
  assert.match(code,/polyBuffers\(stairs\(1, 1, 1, n\)\)/)
  assert.doesNotMatch(code,/mergeGeometries|new THREE\.BoxGeometry\(1, 1, 1\)\s*\n\s*b\.scale/)
  assert.match(code,/const n = normalizeStairSteps\(steps\)/)
})

test('STAIR-16: Editor reconstruye al modificar steps, sin estado paralelo', () => {
  assert.match(source('src/engine/runtime/nodes/three-helpers.js'),/obj\.props\?\.steps/)
  assert.match(source('src/engine/runtime/nodes/primitive.js'),/stairsGeometry\(obj\.props\?\.steps \?\? 8,/)
  assert.match(source('src/core/editor/meshedit.js'),/fromPrimitive\(obj\.kind, obj\.scale, obj\.props\)/)
})

test('STAIR-17: Inspector ofrece 2–64 sin duplicar dimensiones XYZ', () => {
  const ui=source('src/components/Inspector.vue')
  assert.match(ui,/<label>Escalones<\/label><NumberField[^\n]+:min="2" :max="64"/)
  assert.match(source('src/engine/runtime/geometry/primitives.js'),/stairs:\s*\{[^\n]+scale: \[3, 3, 6\]/)
})

test('STAIR-18: Event Page usa el mismo rango y la misma geometría', () => {
  assert.match(source('src/engine/runtime/events/model.js'),/key: 'steps'[^\n]+min: 2, max: 64/)
  assert.match(source('src/engine/runtime/nodes/event.js'),/stairsGeometry\(gr\.steps \?\? 8\)/)
})

test('STAIR-19: CSG reutiliza la envolvente sin generar otra primitiva', () => {
  assert.match(source('src/engine/runtime/scene/brushes.js'),/stairsGeometry\(o\.props\?\.steps \?\? 8,/)
  assert.match(source('src/engine/runtime/scene/brushes.js'),/carveGeometries\(ud\.baseGeo, hits\)/)
})

test('STAIR-20: Godot exporta peldaños y colisiones desde stairSteps', () => {
  const code=source('src/core/godot/nodes.js')
  assert.match(code,/stairSteps\(o\.props\?\.steps \?\? 8\)\.forEach/)
  assert.match(code,/BoxShape3D/)
  assert.match(code,/Step_\$\{i \+ 1\}/)
})
