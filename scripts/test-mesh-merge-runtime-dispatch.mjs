import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { grid, cube } from '../src/engine/runtime/mesh/generators.js'
import { PolyMesh } from '../src/engine/runtime/mesh/polymesh.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'
import * as operations from '../src/core/mesh/ops.js'

const selected = (mesh, faces, mode = 'face') => {
  const sel = new Sel()
  sel.f = new Set(faces)
  normalize(mesh, sel, mode)
  return sel
}

function editorDispatch() {
  const src = readFileSync(new URL('../src/core/mesh/session.js', import.meta.url), 'utf8')
  const match = src.match(/case 'mergeFaces':\s*return this\.run\('Fusionar caras',\s*\(p, s, mo\)\s*=>\s*O\.(\w+)\(p, s, mo\)\)/)
  assert.ok(match, 'La ruta EditSession.op(mergeFaces) debe mantenerse conectada a ops.js')
  assert.equal(typeof operations[match[1]], 'function', `Export real ausente: ops.${match[1]}`)
  return operations[match[1]]
}

test('FM-D01: EditSession.op resuelve el export real utilizado por Fusionar caras', () => {
  const fn = editorDispatch()
  assert.equal(fn, operations.mergeFaces)
  assert.equal(fn, operations.mergeSelectedFaces)
  assert.equal(fn, operations.OPS.mergeFaces)
})

test('FM-D02: dispatch real fusiona dos caras contiguas y conserva la selección', () => {
  const mesh = grid(2, 1, 2, 1)
  const sel = selected(mesh, [0, 1])
  assert.equal(editorDispatch()(mesh, sel, 'face'), undefined)
  assert.equal(mesh.f.length, 1)
  assert.equal(mesh.f[0].length, 6)
  assert.deepEqual([...sel.f], [0])
})

test('FM-D03: dispatch real rechaza caras desconectadas sin mutación', () => {
  const mesh = grid(3, 1, 3, 1)
  const sel = selected(mesh, [0, 2])
  const before = mesh.clone(), beforeSel = sel.toJSON()
  assert.match(editorDispatch()(mesh, sel, 'face'), /conectadas/)
  assert.deepEqual(mesh.v, before.v)
  assert.deepEqual(mesh.f, before.f)
  assert.deepEqual(sel.toJSON(), beforeSel)
})

test('FM-D04: dispatch real no modifica una esquina ni admite modo diferente a Caras', () => {
  const mesh = cube()
  const sel = selected(mesh, [0, 2])
  const before = mesh.clone()
  assert.match(editorDispatch()(mesh, sel, 'face'), /coplanar/)
  assert.deepEqual(mesh.v, before.v)
  assert.deepEqual(mesh.f, before.f)
  assert.match(editorDispatch()(mesh, sel, 'edge'), /modo Caras/)
  assert.deepEqual(mesh.v, before.v)
  assert.deepEqual(mesh.f, before.f)
})

test('FM-D05: cambios realizados por dispatch real son serializables para Undo/Redo', () => {
  const mesh = grid(2, 1, 2, 1)
  const sel = selected(mesh, [0, 1])
  const before = mesh.toJSON(), beforeSel = sel.toJSON()
  assert.equal(editorDispatch()(mesh, sel, 'face'), undefined)
  const after = mesh.toJSON(), afterSel = sel.toJSON()
  assert.equal(PolyMesh.fromJSON(before).f.length, 2)
  assert.equal(PolyMesh.fromJSON(after).f.length, 1)
  assert.deepEqual(Sel.from(beforeSel).f, new Set([0, 1]))
  assert.deepEqual(Sel.from(afterSel).f, new Set([0]))
})

function liveSessionBranch(mesh, sel, mode = 'face') {
  const src = readFileSync(new URL('../src/core/mesh/session.js', import.meta.url), 'utf8')
  const declaration = src.match(/  op\(name, arg\) \{[\s\S]*?\n  \}\n\n  focus\(\)/)
  assert.ok(declaration, 'La operación del editor debe poder evaluarse desde la implementación real')
  const method = declaration[0].slice(0, -'\n\n  focus()'.length).trim()
  const op = runInNewContext(`({${method}}).op`, { O: operations, store: { edit: {} } })
  const effects = { commits: 0, rejections: 0 }
  const instance = {
    poly: mesh, sel, mode,
    run(label, fn) {
      assert.equal(label, 'Fusionar caras')
      const previous = this.poly.clone(), selectedBefore = this.sel.clone()
      const result = fn(this.poly, this.sel, this.mode)
      if (typeof result === 'string') {
        this.poly = previous
        this.sel = selectedBefore
        effects.rejections++
        return false
      }
      effects.commits++
      return true
    },
  }
  return { execute: () => op.call(instance, 'mergeFaces'), instance, effects }
}

test('FM-D06: rama real EditSession.op ejecuta Fusionar caras sin excepción', () => {
  const mesh = grid(2, 1, 2, 1)
  const selection = selected(mesh, [0, 1])
  const { execute, instance, effects } = liveSessionBranch(mesh, selection)
  assert.equal(execute(), true)
  assert.equal(instance.poly.f.length, 1)
  assert.equal(instance.sel.f.size, 1)
  assert.equal(effects.commits, 1)
  assert.equal(effects.rejections, 0)
})

test('FM-D07: rama real EditSession.op rechaza y preserva selección y geometría', () => {
  const mesh = grid(3, 1, 3, 1)
  const selection = selected(mesh, [0, 2])
  const initial = mesh.clone(), selectedBefore = selection.toJSON()
  const { execute, instance, effects } = liveSessionBranch(mesh, selection)
  assert.equal(execute(), false)
  assert.deepEqual(instance.poly.v, initial.v)
  assert.deepEqual(instance.poly.f, initial.f)
  assert.deepEqual(instance.sel.toJSON(), selectedBefore)
  assert.equal(effects.commits, 0)
  assert.equal(effects.rejections, 1)
})
