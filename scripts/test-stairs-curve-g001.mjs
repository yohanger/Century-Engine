// LF-STAIRS-CURVE-G001: geometría curvada, equivalencia y puntos de integración existentes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stairs, fromPrimitive, normalizeStairTurn, validStairTurn, effectiveStairTurn } from '../src/engine/runtime/mesh/generators.js'
import { checkClosed, signedVolume, triangulate } from '../src/engine/runtime/mesh/polymesh.js'
import { polyBuffers, trimeshPoints } from '../src/engine/runtime/mesh/buffers.js'
import { buildMeshGLB } from '../src/core/godot/glb.js'

const src = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const near = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`)
const samples = [-90, -45, 30, 90]
const shape = (m) => ({v:m.v, f:m.f})
const get = (n = 8, t = 45, scale = [3, 3, 6]) => stairs(...scale, n, t)
const triAreas = (m) => triangulate(m).tris.map(([a,b,c]) => {
  const A = m.v[a], B = m.v[b], C = m.v[c]
  const u = B.map((v,i) => v - A[i]), v = C.map((x,i) => x - A[i])
  return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2
})

test('CURVE-01: 0 grados conserva exactamente los vértices y caras anteriores', () => {
  for (const n of [2, 8, 40, 64]) assert.deepEqual(shape(get(n, 0)), shape(stairs(3, 3, 6, n)))
})
test('CURVE-02: grados normalizados sin NaN ni límites fuera de 90', () => {
  for (const [v, expected] of [[-200,-90],[120,90],[12.5,12.5],[null,0],[NaN,0],[Infinity,0],['12',12]]) assert.equal(normalizeStairTurn(v),expected)
})
test('CURVE-03: radio interior debe ser positivo, sin geometría autointersecada', () => {
  assert.equal(validStairTurn(90,3,6),true)
  assert.equal(validStairTurn(90,50,1),false)
  assert.equal(validStairTurn(0,50,1),true)
  assert.equal(validStairTurn(-90,3,6),true)
  assert.equal(validStairTurn(110,3,6),false)
  assert.equal(validStairTurn(20,0,6),false)
  assert.equal(validStairTurn(20,NaN,6),false)
})
test('CURVE-04: datos inválidos se degradan de forma segura a recta', () => {
  assert.equal(effectiveStairTurn(90,50,1),0)
  assert.deepEqual(stairs(50,3,1,8,90).f,stairs(50,3,1,8,0).f)
})
test('CURVE-05: contornos cerrados con giros positivos y negativos y 2–64 escalones', () => {
  for (const n of [2,8,40,64]) for (const a of samples) assert.deepEqual(checkClosed(get(n,a)),[],`Abierto: ${n}, ${a}`)
})
test('CURVE-06: todas las mallas tienen volumen positivo', () => {
  for (const n of [2,8,40,64]) for (const a of samples) assert.ok(signedVolume(get(n,a)) > 0)
})
test('CURVE-07: número de huellas y contrahuellas conserva los escalones', () => {
  for (const n of [2,8,64]) for (const a of samples) {
    const m=get(n,a)
    const up=m.f.filter((_,i) => m.faceNormal(i)[1] > 0.99)
    assert.equal(up.length,n)
    assert.equal(m.f.length,5*n+1)
  }
})
test('CURVE-08: triangulación completa de caras, incluidas las paredes de 5 vértices', () => {
  for (const n of [2,8,64]) for (const a of samples) {
    const m=get(n,a), tr=triangulate(m)
    assert.equal(tr.tris.length,12*n)
    assert.ok(tr.tris.every((t) => t.length===3 && t.every((v)=>v>=0&&v<m.v.length)))
  }
})
test('CURVE-09: no hay triángulos con área nula o inválida', () => {
  for (const n of [2,8,64]) for (const a of samples) assert.ok(triAreas(get(n,a)).every((area)=>Number.isFinite(area)&&area>1e-9))
})
test('CURVE-10: el sentido del giro invierte la dirección lateral sin alterar altura', () => {
  const plus=get(8,45),minus=get(8,-45)
  near(signedVolume(plus),signedVolume(minus))
  const points = (v) => v.map((p)=>p.map((x)=>+x.toFixed(5)).join(',' )).sort()
  assert.deepEqual(points(plus.v),points(minus.v.map(([x,y,z])=>[-x,y,z])))
})
test('CURVE-11: altura máxima igual a sy y ancho de sección igual a sx', () => {
  for(const [sx,sy,sz] of [[3,3,6],[2,2.5,6],[1,8,10]]) {
    const m=get(8,60,[sx,sy,sz]);const ys=m.v.map(v=>v[1]);near(Math.max(...ys),sy/2);near(Math.min(...ys),-sy/2)
  }
})
test('CURVE-12: Edit Mesh recibe exactamente el mismo PolyMesh con giro', () => {
  for(const a of samples) assert.deepEqual(shape(fromPrimitive('stairs',[3,3,6],{steps:8,turn:a})),shape(get(8,a)))
})
test('CURVE-13: escenas antiguas sin propiedad turn mantienen geometría idéntica', () => {
  assert.deepEqual(shape(fromPrimitive('stairs',[3,3,6],{steps:8})),shape(get(8,0)))
})
test('CURVE-14: serialización preserva topología y los parámetros no requieren formato nuevo', () => {
  const m=get(8,45),copy=m.constructor.fromJSON(m.toJSON())
  copy.v.forEach((p,i)=>p.forEach((v,j)=>near(v,m.v[i][j])));assert.deepEqual(copy.f,m.f);assert.deepEqual(checkClosed(copy),[])
  assert.equal(JSON.parse(JSON.stringify({props:{steps:8,turn:45}})).props.turn,45)
})
test('CURVE-15: buffers y colisión trimesh triangulan la misma superficie', () => {
  for (const a of samples) {
    const m=get(8,a),b=polyBuffers(m),t=trimeshPoints(m)
    assert.equal(b.indices.length*3,b.positions.length)
    assert.equal(t.length,b.positions.length)
    t.forEach((x,i)=>near(x,b.positions[i]))
  }
})
test('CURVE-16: UV y métricas Blockout son finitas', () => {
  const b=polyBuffers(get(64,90),{blockout:true})
  for (const arr of [b.positions,b.normals,b.uvs,b.blockUV,b.blockSize]) assert.ok(arr.length&&[...arr].every(Number.isFinite))
})
test('CURVE-17: GLB exporta todos los triángulos e índices de la forma curvada', () => {
  const b=polyBuffers(get(8,60))
  const bytes=buildMeshGLB({name:'EscaleraCurva',positions:b.positions,normals:b.normals,indices:b.indices,uvs:b.uvs})
  const buf=new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  assert.equal(buf.getUint32(0,true),0x46546c67)
  const jsonLen=buf.getUint32(12,true)
  const json=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+jsonLen)).trim())
  assert.equal(json.meshes[0].primitives[0].indices,0)
  assert.equal(json.accessors[0].count,b.indices.length)
  assert.equal(json.accessors[1].count,b.positions.length/3)
  assert.ok(json.meshes[0].primitives[0].attributes.TEXCOORD_0)
})
test('CURVE-18: Inspector dispone de control Giro y rechazo de radio inválido', () => {
  const s=src('src/components/Inspector.vue');assert.match(s,/<label>Giro °<\/label>/);assert.match(s,/:min="-90" :max="90"/);assert.match(s,/validStairSidesTurn\(turn/)
})
test('CURVE-19: cambio de giro y dimensiones reconstruye el nodo existente', () => {
  const s=src('src/engine/runtime/nodes/three-helpers.js');assert.match(s,/obj\.props\?\.turn/);assert.match(s,/obj\.scale\?\.\[0\]/)
  assert.match(src('src/engine/runtime/nodes/primitive.js'),/stairsGeometry\(obj\.props\?\.steps/)
})
test('CURVE-20: el brush usa la misma geometría y reconoce cambios de giro', () => {
  const s=src('src/engine/runtime/scene/brushes.js');assert.match(s,/stairsGeometry\(o\.props\?\.steps/);assert.match(s,/c\.o\.props\?\.turn/)
  assert.match(s,/carveGeometries\(ud\.baseGeo, hits\)/)
})
test('CURVE-21: Godot conserva cajas si giro es cero y GLB trimesh si es curvo', () => {
  const s=src('src/core/godot/nodes.js');assert.match(s,/if \(turn !== 0 \|\| stairSideOptions\(o\.props\)\.sides !== 'none'\)/);assert.match(s,/stairSteps\(o\.props\?\.steps \?\? 8\)/)
  assert.match(s,/buildMeshGLB\(\{/);assert.match(s,/ConcavePolygonShape3D/);assert.match(s,/trimeshPoints\(poly\)/)
})
test('CURVE-22: el archivo de evento conserva su escalera recta de siempre', () => {
  assert.match(src('src/engine/runtime/nodes/event.js'),/stairsGeometry\(gr\.steps \?\? 8\)/)
})
