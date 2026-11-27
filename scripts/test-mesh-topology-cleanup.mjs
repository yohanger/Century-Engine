import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PolyMesh, ekey, checkClosed } from '../src/engine/runtime/mesh/polymesh.js'
import { cube, grid } from '../src/engine/runtime/mesh/generators.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'
import { inspectMeshCleanup, cleanMeshTopology } from '../src/core/mesh/ops-cleanup.js'
import { polyBuffers, trimeshPoints } from '../src/engine/runtime/mesh/buffers.js'

function selected(m, mode, values) {
  const sel = new Sel()
  if (mode === 'face') sel.f = new Set(values)
  else if (mode === 'edge') sel.e = new Set(values)
  else sel.v = new Set(values)
  return normalize(m, sel, mode)
}

function residue() {
  const m = cube()
  m.v.push([4, 0, 0], [6, 0, 0], [8, 0, 0])
  m.we.push([8, 9], [9, 8], [8, 8], [0, 1])
  return m
}

test('detectar aristas sueltas, repetidas, degeneradas y redundantes', () => {
  const m = residue(), r = inspectMeshCleanup(m)
  assert.equal(r.wireEdges, 2)
  assert.equal(r.duplicateWires, 1)
  assert.equal(r.invalidWires, 1)
  assert.equal(r.redundantWires, 1)
  assert.equal(r.looseVertices, 1)
  assert.equal(r.invalidFaces, 0)
  assert.equal(r.nonManifoldEdges, 0)
})

test('la limpieza explícita conserva la geometría y elimina residuos', () => {
  const m = residue(), faces = m.f.map((f) => [...f]), vertices = m.v.slice(0, 8).map((v) => [...v])
  const selectedFaces = selected(m, 'face', [0, 3])
  const result = cleanMeshTopology(m, selectedFaces, 'face', { removeLooseEdges: true, removeLooseVertices: true, removeDuplicateWires: true })
  assert.deepEqual(result, { wiresRemoved: 4, vertsRemoved: 3, welded: 0 })
  assert.deepEqual(m.v, vertices)
  assert.deepEqual(m.f, faces)
  assert.deepEqual([...selectedFaces.f], [0, 3])
  assert.equal(m.we.length, 0)
  assert.deepEqual(checkClosed(m), [])
})

test('conservar aristas constructivas cuando no se autorizó eliminarlas', () => {
  const m = residue()
  const s = selected(m, 'vertex', [8, 9])
  const result = cleanMeshTopology(m, s, 'vertex', { removeDuplicateWires: true })
  assert.equal(result.wiresRemoved, 3)
  assert.equal(result.vertsRemoved, 0)
  assert.equal(m.we.length, 1)
  assert.deepEqual(m.we[0], [8, 9])
  assert.deepEqual([...s.v], [8, 9])
})

test('un vértice aislado válido se mantiene sin autorización para eliminarlo', () => {
  const m = residue(), s = new Sel()
  const original = m.clone()
  assert.equal(cleanMeshTopology(m, s, 'vertex', { removeLooseEdges: true }).wiresRemoved, 3)
  assert.deepEqual(m.v, original.v)
})

test('limpieza con opciones vacías o sin residuos no crea cambios', () => {
  const m = cube(), s = new Sel(), before = m.toJSON()
  assert.match(cleanMeshTopology(m, s, 'face', {}), /Selecciona/)
  assert.match(cleanMeshTopology(m, s, 'face', { removeLooseEdges: true, removeLooseVertices: true }), /No se encontraron/)
  assert.deepEqual(m.f, before.f)
  assert.deepEqual(m.v.flat(), before.v)
})

test('aristas repetidas en sentido inverso se eliminan sin duplicar contorno', () => {
  const m = new PolyMesh([[0, 0, 0], [1, 0, 0], [2, 0, 0]], [], [[0, 1], [1, 0], [1, 2]])
  const s = selected(m, 'edge', [ekey(0, 1)])
  assert.equal(cleanMeshTopology(m, s, 'edge', { removeDuplicateWires: true }).wiresRemoved, 1)
  assert.deepEqual(m.we, [[0, 1], [1, 2]])
  assert.ok(s.e.has(ekey(0, 1)))
})

test('los índices y UV se conservan al retirar vértices aislados', () => {
  const m = grid(2, 2, 2, 2), s = selected(m, 'face', [0, 1])
  m.ensureUV()
  m.colors = m.v.map((_, i) => [i / m.v.length, 0, 1])
  m.weights = m.v.map(() => [1, 0, 0, 0, 0, 0, 0, 0])
  const faceUV = structuredClone(m.uv), oldColors = structuredClone(m.colors)
  m.v.push([30, 0, 0]); m.colors.push([1, 1, 0]); m.weights.push([1, 0, 0, 0, 0, 0, 0, 0])
  assert.equal(cleanMeshTopology(m, s, 'face', { removeLooseVertices: true }).vertsRemoved, 1)
  assert.deepEqual(m.uv, faceUV)
  assert.deepEqual(m.colors, oldColors)
  assert.deepEqual([...s.f], [0, 1])
  const restored = PolyMesh.fromJSON(m.toJSON())
  assert.deepEqual(restored.uv, faceUV)
  assert.equal(restored.weights.length, restored.v.length)
})

test('soldadura explícita conecta caras con vértices duplicados sin perder caras', () => {
  const m = grid(2, 1, 2, 1), s = new Sel()
  m.f[1] = m.f[1].map((v) => { m.v.push([...m.v[v]]); return m.v.length - 1 })
  assert.equal(inspectMeshCleanup(m).closePairs, 4)
  assert.equal(m.edges().get(ekey(m.f[0][1], m.f[0][2])).faces.length, 1)
  const result = cleanMeshTopology(m, s, 'face', { weldVertices: true, tolerance: 0.00001 })
  assert.equal(result.welded, 4)
  assert.equal(m.f.length, 2)
  assert.equal([...m.edges().values()].filter((e) => e.faces.length === 2).length, 1)
  assert.equal(inspectMeshCleanup(m).closePairs, 0)
})

test('una soldadura que elimina caras se rechaza de forma atómica', () => {
  const m = new PolyMesh([[0,0,0],[0,0,0],[0,1,0]], [[0,1,2]]), s = selected(m, 'face', [0])
  const before = m.clone(), selection = s.toJSON()
  const result = cleanMeshTopology(m, s, 'face', { weldVertices: true })
  assert.match(result, /eliminaría|invalidaría/)
  assert.deepEqual(m.v, before.v)
  assert.deepEqual(m.f, before.f)
  assert.deepEqual(s.toJSON(), selection)
})

test('atributos de pintura incompatibles impiden soldar vértices', () => {
  const m = new PolyMesh([[0,0,0],[0,0,0],[1,0,0],[0,1,0]], [[0,2,3]], [])
  m.colors = [[1,0,0],[0,1,0],[1,0,0],[1,0,0]]
  const before = m.clone()
  assert.match(cleanMeshTopology(m, new Sel(), 'vertex', { weldVertices: true }), /pintura/)
  assert.deepEqual(m.colors, before.colors)
})

test('las costuras UV impiden soldar automáticamente', () => {
  const m = new PolyMesh([[0,0,0],[0,0,0],[1,0,0],[0,1,0]], [[0,2,3]])
  m.seams = [[0,2]]
  assert.match(cleanMeshTopology(m, new Sel(), 'edge', { weldVertices: true }), /costuras UV/)
})

test('malla no manifold recibe diagnóstico, sin eliminación automática de caras', () => {
  const m = cube()
  m.f.push([...m.f[0]])
  const report = inspectMeshCleanup(m)
  assert.ok(report.nonManifoldEdges > 0)
  assert.equal(m.f.length, 7)
  assert.match(cleanMeshTopology(m, new Sel(), 'face', { removeLooseVertices: true }), /No se encontraron/)
})

test('una unión en T se detecta pero no se repara sin contrato explícito', () => {
  const m = new PolyMesh([[0,0,0],[2,0,0],[2,1,0],[0,1,0],[1,0,0],[1,-1,0],[0,-1,0]],[[0,1,2,3],[6,5,4,0]])
  assert.ok(inspectMeshCleanup(m).tJunctions >= 1)
  const original = m.clone()
  assert.match(cleanMeshTopology(m, new Sel(), 'face', { removeLooseVertices: true }), /No se encontraron/)
  assert.deepEqual(m.f, original.f)
})

test('la geometría limpiada permanece serializable para render y TriMesh', () => {
  const m = residue(), s = new Sel()
  cleanMeshTopology(m, s, 'face', { removeLooseEdges: true, removeLooseVertices: true })
  const restored = PolyMesh.fromJSON(m.toJSON())
  assert.equal(polyBuffers(restored).faceOf.length, 12)
  assert.equal(trimeshPoints(restored).length, 108)
})

test('el UI, el menú y la sesión utilizan la misma función central', () => {
  const panel = readFileSync(new URL('../src/components/MeshPanel.vue', import.meta.url), 'utf8')
  const commands = readFileSync(new URL('../src/core/commands.js', import.meta.url), 'utf8')
  const session = readFileSync(new URL('../src/core/mesh/session.js', import.meta.url), 'utf8')
  const context = readFileSync(new URL('../src/core/editor/meshedit.js', import.meta.url), 'utf8')
  assert.match(panel, /data-testid="mesh-topology-cleanup"/)
  assert.match(commands, /M\('mesh\.cleanup', 'Limpiar geometría'/)
  assert.match(commands, /MESH_MENU = \[[^\n]*'mesh\.cleanup'/)
  assert.match(context, /\.\.\.menuItems\(\['mesh\.cleanup'\]\)/)
  assert.match(session, /case 'cleanup': return this\.cleanTopology/)
  assert.match(session, /this\.run\('Limpiar geometría'/)
  assert.match(session, /\{ reconcile: false \}/)
})

test('la exportación usada por EditSession expone la operación funcional', async () => {
  const O = await import('../src/core/mesh/ops.js')
  assert.equal(O.OPS.cleanMeshTopology, O.cleanMeshTopology)
  assert.equal(typeof O.inspectMeshCleanup, 'function')
  const m = residue()
  assert.equal(O.cleanMeshTopology(m, new Sel(), 'vertex', { removeLooseEdges: true }).wiresRemoved, 3)
})

test('la sesión real solicita aprobación, aplica la limpieza una vez y respeta cancelación', async () => {
  const { runInNewContext } = await import('node:vm')
  const { meshGeometrySignature } = await import('../src/engine/runtime/mesh/polymesh.js')
  const O = await import('../src/core/mesh/ops.js')
  const source = readFileSync(new URL('../src/core/mesh/session.js', import.meta.url), 'utf8')
  const match = source.match(/  async cleanTopology\(options = \{\}\) \{[\s\S]*?\n  \}\n\n  \/\/ --/)
  assert.ok(match, 'El test debe ejecutar el método real de EditSession')
  let confirmation = false, prompts = 0, commits = 0, messages = []
  const store = { editor: {}, edit: { hud: '', paint: { active: false } }, project: { meshes: [], objects: [] } }
  const fn = runInNewContext(`({${match[0].slice(0, match[0].lastIndexOf('\n\n  // --'))}}).cleanTopology`, {
    O, store, meshGeometrySignature, meshConsumers: () => [],
    toast: (...args) => { messages.push(args) },
    askConfirm: async () => { prompts++; return confirmation },
  })
  const mesh = residue(), ctx = {
    obj: { props: {} }, poly: mesh, sel: new Sel(), mode: 'face', modal: null, paintStroke: null, dirty: false,
    inspectCleanup: (tolerance) => O.inspectMeshCleanup(mesh, tolerance),
    run: (label, apply, opts) => {
      assert.equal(label, 'Limpiar geometría')
      assert.equal(opts.reconcile, false)
      const result = apply(mesh, ctx.sel, 'face')
      assert.equal(result, undefined)
      commits++
      return true
    },
  }
  store.editor.edit = ctx
  assert.equal(await fn.call(ctx, { removeLooseEdges: true, removeDuplicateWires: false, removeLooseVertices: false }), false)
  assert.equal(mesh.we.length, 4)
  assert.equal(prompts, 1)
  assert.equal(commits, 0)
  confirmation = true
  assert.equal(await fn.call(ctx, { removeLooseEdges: true, removeDuplicateWires: false, removeLooseVertices: false }), true)
  assert.equal(commits, 1)
  assert.equal(mesh.we.length, 1)
  assert.equal(ctx._cleaningMesh, false)
  assert.ok(messages.some(([text]) => /Limpieza/.test(text)))
})


test('no reindexa vértices con aristas fuera del rango sin limpiarlas', () => {
  const m = cube(), selection = new Sel()
  m.v.push([4, 0, 0]); m.we.push([0, 5000])
  const original = m.clone()
  assert.match(cleanMeshTopology(m, selection, 'vertex', { removeLooseVertices: true }), /aristas inválidas/)
  assert.deepEqual(m.v, original.v)
  assert.deepEqual(m.we, original.we)
  const result = cleanMeshTopology(m, selection, 'vertex', { removeDuplicateWires: true, removeLooseVertices: true })
  assert.equal(result.wiresRemoved, 1)
  assert.equal(result.vertsRemoved, 1)
  assert.deepEqual(m.we, [])
})

test('el informe no confunde aristas redundantes con aristas realmente sueltas', () => {
  const m = cube()
  m.we.push([...m.f[0].slice(0, 2)])
  const r = inspectMeshCleanup(m)
  assert.equal(r.wireEdges, 0)
  assert.equal(r.redundantWires, 1)
})
