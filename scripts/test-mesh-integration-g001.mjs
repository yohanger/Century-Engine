// LF-MESH-INTEGRATION-QA-G001: cadena integrada de datos geométricos, sin simular Electron/Jolt/GPU.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PolyMesh, ekey, checkClosed, signedVolume, triangulate } from '../src/engine/runtime/mesh/polymesh.js'
import { make } from '../src/engine/runtime/mesh/generators.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'
import * as ops from '../src/core/mesh/ops.js'
import { projectBox } from '../src/core/mesh/uv.js'
import { polyBuffers, trimeshPoints } from '../src/engine/runtime/mesh/buffers.js'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const selected = (poly, mode, values) => {
  const sel = new Sel()
  sel[mode === 'face' ? 'f' : mode === 'edge' ? 'e' : 'v'] = new Set(values)
  return normalize(poly, sel, mode)
}
const snapshot = (poly) => JSON.stringify({ v: poly.v, f: poly.f, we: poly.we, uv: poly.uv })
const closedSolid = (points, height = 1) => {
  const poly = make('vertex')
  const sel = selected(poly, 'vertex', [0])
  poly.v[0] = [...points[0]]
  for (let i = 1; i < points.length; i++) {
    assert.equal(ops.appendVertex(poly, sel, 'vertex', points[i], i - 1), undefined)
  }
  assert.equal(poly.f.length, 0)
  assert.equal(ops.closeContour(poly, sel, 'vertex'), undefined)
  assert.equal(ops.fill(poly, sel, 'vertex'), undefined)
  const before = poly.clone()
  poly.reconcileAttributes(before)
  const faceSelection = selected(poly, 'face', [0])
  const flat = poly.clone()
  assert.equal(ops.extrudeSolid(poly, faceSelection, 'face'), undefined)
  const firstNew = flat.v.length
  for (let i = firstNew; i < poly.v.length; i++) poly.v[i][2] += height
  poly.reconcileAttributes(flat)
  return { poly, sel: faceSelection, base: before }
}
const finite = (values) => [...values].every(Number.isFinite)

test('INT-01: Vértice -> cadena -> cierre -> Fill -> sólido reutiliza un PolyMesh', () => {
  const { poly } = closedSolid([[0,0,0],[2,0,0],[2,2,0],[0,2,0]])
  assert.equal(poly.v.length, 8)
  assert.equal(poly.f.length, 6)
  assert.deepEqual(checkClosed(poly), [])
  assert.ok(Math.abs(signedVolume(poly) - 4) < 1e-6)
})

test('INT-02: contorno cóncavo produce triángulos compatibles con colisión y buffers', () => {
  const { poly } = closedSolid([[0,0,0],[3,0,0],[3,1,0],[1,1,0],[1,3,0],[0,3,0]], 2)
  const { tris } = triangulate(poly)
  const b = polyBuffers(poly)
  const collision = trimeshPoints(poly)
  assert.deepEqual(checkClosed(poly), [])
  assert.ok(Math.abs(signedVolume(poly) - 10) < 1e-5)
  assert.equal(b.indices.length, tris.length * 3)
  assert.equal(collision.length, tris.length * 9)
  assert.ok(finite(b.positions) && finite(b.normals) && finite(collision))
})

test('INT-03: una operación inválida no altera ni la geometría ni la selección', () => {
  const poly = new PolyMesh([[0,0,0],[2,2,0],[0,2,0],[2,0,0]], [], [[0,1],[1,2],[2,3]])
  const sel = selected(poly, 'vertex', [0])
  const before = snapshot(poly), selectionBefore = sel.toJSON()
  assert.equal(typeof ops.closeContour(poly, sel, 'vertex'), 'string')
  assert.equal(snapshot(poly), before)
  assert.deepEqual(sel.toJSON(), selectionBefore)
})

test('INT-04: Undo/Redo de datos reproduce exactamente una transacción de edición', () => {
  const poly = make('vertex'), sel = selected(poly, 'vertex', [0])
  const initial = poly.toJSON(), firstSelection = sel.toJSON()
  ops.appendVertex(poly, sel, 'vertex', [1,0,0], 0)
  ops.appendVertex(poly, sel, 'vertex', [1,1,0], 1)
  const edited = poly.toJSON(), lastSelection = sel.toJSON()
  const undone = PolyMesh.fromJSON(initial), undoneSel = Sel.from(firstSelection)
  const redone = PolyMesh.fromJSON(edited), redoneSel = Sel.from(lastSelection)
  assert.equal(undone.v.length, 1)
  assert.equal(undoneSel.v.has(0), true)
  assert.deepEqual(redone.v, poly.v)
  assert.deepEqual(redone.we, poly.we)
  assert.deepEqual(redoneSel.toJSON(), lastSelection)
  // EditSession/History reales requieren Editor y se verifican localmente.
})

test('INT-05: atributos UV y colores sobreviven a la cadena y al guardado', () => {
  const { poly } = closedSolid([[0,0,0],[2,0,0],[2,2,0],[0,2,0]])
  projectBox(poly, null)
  poly.colors = poly.v.map((_, i) => i % 2 ? [1,0,0] : [0,1,0])
  poly.weights = poly.v.map(() => [1,0,0,0,0,0,0,0])
  const roundtrip = PolyMesh.fromJSON(poly.toJSON())
  assert.deepEqual(roundtrip.uv, poly.uv)
  assert.deepEqual(roundtrip.colors, poly.colors)
  assert.deepEqual(roundtrip.weights, poly.weights)
  assert.ok(roundtrip.uv.every((face, i) => face.length === roundtrip.f[i].length))
})

test('INT-06: Blockout genera métricas, normales y UV coherentes con escala', () => {
  const { poly } = closedSolid([[0,0,0],[3,0,0],[3,2,0],[0,2,0]])
  const b = polyBuffers(poly, { scale: [2,3,4], blockout: true })
  assert.equal(b.positions.length / 3, b.indices.length)
  assert.equal(b.normals.length, b.positions.length)
  assert.equal(b.uvs.length / 2, b.indices.length)
  assert.equal(b.blockUV.length, b.uvs.length)
  assert.equal(b.blockSize.length, b.uvs.length)
  assert.ok(finite(b.blockUV) && finite(b.blockSize))
})

test('INT-07: collider trimesh y visual comparten la misma triangulación y escala', () => {
  const { poly } = closedSolid([[0,0,0],[1,0,0],[1,2,0],[0,2,0]])
  const scale = [2,3,1], b = polyBuffers(poly, { scale }), collider = trimeshPoints(poly, scale)
  assert.deepEqual(collider.map((v) => +v.toFixed(5)), [...b.positions].map((v) => +v.toFixed(5)))
  assert.equal(b.faceOf.length, b.indices.length / 3)
  assert.ok(finite(collider))
})

test('INT-08: el modelo anterior (sin UV ni aristas sueltas) conserva serialización válida', () => {
  const old = { v: [0,0,0,1,0,0,1,1,0,0,1,0], f: [[0,1,2,3]], smooth: false, rev: 12 }
  const poly = PolyMesh.fromJSON(old)
  const copy = PolyMesh.fromJSON(poly.toJSON())
  assert.deepEqual(copy.f, [[0,1,2,3]])
  assert.deepEqual(copy.we, [])
  assert.equal(polyBuffers(copy).indices.length, 6)
})

test('INT-09: la extrusión antigua preserva el borde abierto y la nueva cierra la malla', () => {
  const points = [[0,0,0],[1,0,0],[1,1,0],[0,1,0]]
  const base = new PolyMesh(points, [[0,1,2,3]])
  const classic = base.clone(), solid = base.clone()
  assert.equal(ops.extrude(classic, selected(classic, 'face', [0]), 'face'), undefined)
  assert.equal(ops.extrudeSolid(solid, selected(solid, 'face', [0]), 'face'), undefined)
  assert.ok(checkClosed(classic).length > 0)
  assert.deepEqual(checkClosed(solid), [])
})

test('INT-10: guardar y reabrir no pierde la selección normalizada ni las caras', () => {
  const { poly, sel } = closedSolid([[0,0,0],[2,0,0],[2,2,0],[0,2,0]])
  const saved = JSON.parse(JSON.stringify({ id: 'scene-mesh-01', type: 'mesh', props: { mesh: poly.toJSON(), collider: 'trimesh' }, collision: true }))
  const restored = PolyMesh.fromJSON(saved.props.mesh)
  const faceSelection = normalize(restored, Sel.from(sel.toJSON()), 'face')
  assert.deepEqual(restored.f, poly.f)
  assert.deepEqual(restored.we, poly.we)
  assert.equal(faceSelection.f.size, 1)
  assert.deepEqual(checkClosed(restored), [])
})

test('INT-11: contrato de Editor/Player conserva la fuente mesh y los buffers compartidos', () => {
  const session = source('src/core/mesh/session.js')
  const meshNode = source('src/engine/runtime/nodes/mesh.js')
  const player = source('src/engine/runtime/physics/jolt.js')
  // G001 LINKED: la fuente ahora puede ser local o un recurso compartido.
  assert.match(session, /PolyMesh\.fromJSON\(meshDataOf\(o, store\.project\.meshes\)\)/)
  assert.match(session, /writeMesh\(store\.project, this\.obj, data\)/)
  assert.match(meshNode, /polyBuffers\(poly/)
  assert.match(meshNode, /geometryOf\(poly/)
  assert.match(player, /_meshShape\(pos, g\.index \? g\.index\.array : null/)
})

test('INT-12: exportación Godot consume buffers/trimesh originales, no una geometría PolyShape paralela', () => {
  const exporter = source('src/core/godot/nodes.js')
  assert.match(exporter, /const poly = polyOf\(o\)/)
  assert.match(exporter, /const b = polyBuffers\(poly, \{ scale: o\.scale \}\)/)
  assert.match(exporter, /trimeshPoints\(poly, o\.scale\)/)
  assert.match(exporter, /buildMeshGLB\(/)
})

test('INT-13: vertex/Fill/sólido no requiere un tipo de nodo adicional', () => {
  const meshNode = source('src/engine/runtime/nodes/mesh.js')
  const kinds = source('src/engine/runtime/mesh/generators.js')
  assert.match(meshNode, /type: 'mesh'/)
  assert.match(kinds, /vertex:/)
  assert.equal(make('vertex').f.length, 0)
})

test('INT-14: conserva caras antiguas independientes al añadir otro contorno', () => {
  const poly = new PolyMesh([[5,0,0],[6,0,0],[6,1,0],[5,1,0]], [[0,1,2,3]])
  const existing = JSON.stringify(poly.f[0])
  poly.v.push([0,0,0],[2,0,0],[2,2,0],[0,2,0])
  poly.we.push([4,5],[5,6],[6,7],[7,4])
  const sel = selected(poly, 'vertex', [4])
  assert.equal(ops.fill(poly, sel, 'vertex'), undefined)
  assert.equal(JSON.stringify(poly.f[0]), existing)
  assert.equal(poly.f.length, 2)
})

test('INT-15: selección de vértices sigue identificando aristas conectadas', () => {
  const poly = new PolyMesh([[0,0,0],[1,0,0],[1,1,0]], [], [[0,1],[1,2]])
  const sel = selected(poly, 'vertex', [0,1])
  assert.ok(sel.e.has(ekey(0,1)))
  assert.ok(!sel.e.has(ekey(1,2)))
})
