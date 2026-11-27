import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { grid, cube } from '../src/engine/runtime/mesh/generators.js'
import { PolyMesh, signedVolume, checkClosed, ekey } from '../src/engine/runtime/mesh/polymesh.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'
import { mergeSelectedFaces } from '../src/core/mesh/ops-edit.js'
import { OPS } from '../src/core/mesh/ops.js'

function picked(mesh, ids, mode = 'face') {
  const sel = new Sel()
  if (mode === 'face') sel.f = new Set(ids)
  else sel.v = new Set(ids)
  return normalize(mesh, sel, mode)
}
function unchanged(mesh, selection, mode = 'face') {
  const json = mesh.clone(), original = selection.toJSON()
  const err = mergeSelectedFaces(mesh, selection, mode)
  assert.equal(typeof err, 'string')
  assert.deepEqual(mesh.v, json.v)
  assert.deepEqual(mesh.f, json.f)
  assert.deepEqual(selection.toJSON(), original)
  return err
}

test('FM-01: fusionar dos caras contiguas produce una sola cara', () => {
  const mesh = grid(2, 2, 2, 1), selection = picked(mesh, [0, 1])
  assert.equal(mergeSelectedFaces(mesh, selection, 'face'), undefined)
  assert.equal(mesh.f.length, 1)
  assert.equal(mesh.f[0].length, 6)
  assert.deepEqual([...selection.f], [0])
})

test('FM-02: tres caras contiguas se convierten en una región y preservan otras caras', () => {
  const mesh = grid(4, 2, 4, 1), before = mesh.f[3].map((i) => mesh.v[i]), selection = picked(mesh, [0, 1, 2])
  assert.equal(OPS.mergeFaces(mesh, selection, 'face'), undefined)
  assert.equal(mesh.f.length, 2)
  assert.equal(selection.f.size, 1)
  assert.deepEqual(mesh.f[1].map((i) => mesh.v[i]), before)
})

test('FM-03: selección desconectada no modifica malla ni selección', () => {
  const mesh = grid(3, 1, 3, 1)
  assert.match(unchanged(mesh, picked(mesh, [0, 2])), /conectadas/)
})

test('FM-04: dos caras de distintas orientaciones no se fusionan', () => {
  const mesh = cube(), before = signedVolume(mesh)
  assert.match(unchanged(mesh, picked(mesh, [0, 2])), /coplanar/)
  assert.deepEqual(checkClosed(mesh), [])
  assert.equal(signedVolume(mesh), before)
})

test('FM-05: una sola cara no crea un cambio falso', () => {
  const mesh = cube()
  assert.match(unchanged(mesh, picked(mesh, [0])), /al menos dos/)
})

test('FM-06: la función requiere modo Caras', () => {
  const mesh = grid(2, 1, 2, 1)
  assert.match(unchanged(mesh, picked(mesh, [0, 1], 'vertex'), 'vertex'), /modo Caras/)
})

test('FM-07: un parche con agujero no crea una cara inválida', () => {
  const mesh = grid(3, 3, 3, 3), selected = [0, 1, 2, 3, 5, 6, 7, 8]
  assert.match(unchanged(mesh, picked(mesh, selected)), /contorno/)
})

test('FM-08: una arista no manifold impide fusionar', () => {
  const mesh = grid(2, 2, 2, 1)
  mesh.f.push([...mesh.f[0]])
  assert.match(unchanged(mesh, picked(mesh, [0, 1])), /no manifold/)
})

test('FM-09: pintura y UV conservan datos compatibles tras la fusión', () => {
  const mesh = grid(2, 2, 2, 1)
  mesh.ensureUV()
  mesh.colors = mesh.v.map((_, i) => [i / mesh.v.length, 0.2, 0.3])
  mesh.weights = mesh.v.map(() => [1, 0, 0, 0, 0, 0, 0, 0])
  const base = mesh.clone(), selection = picked(mesh, [0, 1])
  assert.equal(mergeSelectedFaces(mesh, selection, 'face'), undefined)
  mesh.reconcileAttributes(base)
  assert.equal(mesh.uv.length, mesh.f.length)
  assert.equal(mesh.uv[0].length, mesh.f[0].length)
  assert.ok(mesh.uv[0].every(([u, v]) => Number.isFinite(u) && Number.isFinite(v)))
  assert.equal(mesh.colors.length, mesh.v.length)
  assert.equal(mesh.weights.length, mesh.v.length)
  for (let i = 0; i < mesh.v.length; i++) assert.deepEqual(mesh.weights[i], [1, 0, 0, 0, 0, 0, 0, 0])
})

test('FM-10: JSON anterior y posterior reproduce Undo/Redo', () => {
  const mesh = grid(2, 1, 2, 1), selection = picked(mesh, [0, 1])
  const initial = mesh.toJSON(), initialSel = selection.toJSON()
  mergeSelectedFaces(mesh, selection, 'face')
  const edited = mesh.toJSON(), editedSel = selection.toJSON()
  const undone = PolyMesh.fromJSON(initial), redone = PolyMesh.fromJSON(edited)
  assert.equal(undone.f.length, 2)
  assert.equal(redone.f.length, 1)
  assert.deepEqual(Sel.from(initialSel).f, new Set([0, 1]))
  assert.deepEqual(Sel.from(editedSel).f, new Set([0]))
})

test('FM-11: se registra una única acción accesible en panel, menú Malla y contexto', () => {
  const source = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
  const commands = source('src/core/commands.js')
  const panel = source('src/components/MeshPanel.vue')
  const context = source('src/core/editor/meshedit.js')
  const session = source('src/core/mesh/session.js')
  assert.match(commands, /M\('mesh\.merge\.faces', 'Fusionar caras'/)
  assert.match(commands, /store\.edit\.mode !== 'face'/)
  assert.match(commands, /MESH_MENU = \[.*'mesh\.merge\.faces'/)
  assert.match(panel, /\['mesh\.merge\.faces', 'Fusionar caras'/)
  assert.match(panel, /command\(id\)\?\.disabled\?\.\(\)/)
  assert.match(context, /menuItems\(\['mesh\.merge\.faces'\]\)/)
  assert.match(session, /case 'mergeFaces': return this\.run\('Fusionar caras'/)
})

test('FM-12: malla fusionada mantiene índices válidos para render y TriMesh', async () => {
  const { polyBuffers, trimeshPoints } = await import('../src/engine/runtime/mesh/buffers.js')
  const mesh = grid(2, 2, 2, 1), selection = picked(mesh, [0, 1])
  assert.equal(mergeSelectedFaces(mesh, selection, 'face'), undefined)
  const render = polyBuffers(mesh), physics = trimeshPoints(mesh)
  assert.equal(render.indices.length, 12)
  assert.equal(physics.length, 36)
  assert.ok(physics.every(Number.isFinite))
  assert.ok(render.positions.every(Number.isFinite))
})

test('FM-13: sin selección o con caras ocultas no genera ninguna transacción', () => {
  const mesh = grid(2, 2, 2, 1)
  assert.match(unchanged(mesh, picked(mesh, [])), /al menos dos/)
  const selection = picked(mesh, [0, 1])
  mesh.hidden.add(mesh.f[0][0])
  assert.match(unchanged(mesh, selection), /ocultas/)
})
