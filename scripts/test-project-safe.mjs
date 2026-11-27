import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const text = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const project = text('src/core/state/project.js')
const modal = text('src/components/ProjectsModal.vue')
const welcome = text('src/components/WelcomeScreen.vue')

// Ejecutamos las funciones reales con una base de datos controlada. No necesitamos Vue ni Electron.
function fixture({ id = 'p1', locked = false } = {}) {
  const store = { project: id ? { id } : null, locked }
  const deleted = []
  const notices = []
  const db = { async deleteProject(projectId) { deleted.push(projectId) } }
  const toast = (...args) => notices.push(args)
  const start = project.indexOf('export function isProjectOpen(id)')
  const end = project.indexOf('// ---------- escenas ----------', start)
  assert.ok(start > 0 && end > start, 'La declaración real de protección debe existir')
  const original = project.slice(start, end).replace(/^export /gm, '')
  const api = new Function('store', 'db', 'toast', original + '\nreturn { isProjectOpen, removeProject }')(store, db, toast)
  return { ...api, store, deleted, notices }
}

test('SAFE-01 · un proyecto abierto se identifica por id y estado desbloqueado', () => {
  const f = fixture()
  assert.equal(f.isProjectOpen('p1'), true)
  assert.equal(f.isProjectOpen('p2'), false)
  assert.equal(f.isProjectOpen(''), false)
})
test('SAFE-02 · se bloquea antes de llamar a la base de datos', async () => {
  const f = fixture()
  assert.equal(await f.removeProject('p1'), false)
  assert.deepEqual(f.deleted, [])
  assert.match(f.notices[0][0], /Primero cambia a otro proyecto/)
})
test('SAFE-03 · proyecto inactivo sí se puede borrar', async () => {
  const f = fixture()
  assert.equal(await f.removeProject('p2'), true)
  assert.deepEqual(f.deleted, ['p2'])
  assert.equal(f.notices.length, 0)
})
test('SAFE-04 · una vista bienvenida bloqueada no convierte el placeholder en proyecto abierto', async () => {
  const f = fixture({ id: 'placeholder', locked: true })
  assert.equal(f.isProjectOpen('placeholder'), false)
  assert.equal(await f.removeProject('p2'), true)
  assert.deepEqual(f.deleted, ['p2'])
})
test('SAFE-05 · un id vacío no desencadena eliminación accidental', async () => {
  const f = fixture()
  assert.equal(await f.removeProject(''), false)
  assert.deepEqual(f.deleted, [])
})
test('SAFE-06 · cambiar de proyecto tras la apertura actualiza cuál queda protegido', async () => {
  const f = fixture()
  assert.equal(await f.removeProject('p1'), false)
  f.store.project.id = 'p2'
  assert.equal(await f.removeProject('p1'), true)
  assert.equal(await f.removeProject('p2'), false)
  assert.deepEqual(f.deleted, ['p1'])
})
test('SAFE-07 · eliminar un inactivo no cambia ni reemplaza el proyecto activo', async () => {
  const f = fixture()
  await f.removeProject('p3')
  assert.equal(f.store.project.id, 'p1')
  assert.equal(f.store.locked, false)
  assert.doesNotMatch(project.slice(project.indexOf('export async function removeProject(id)')), /const list = await db\.listProjects\(\)/)
})
test('SAFE-08 · Proyectos muestra botón inhabilitado y etiqueta informativa', () => {
  assert.match(modal, /:disabled="isProjectOpen\(p\.id\)"/)
  assert.match(modal, /Primero cambia a otro proyecto/)
  assert.match(modal, /:aria-label="isProjectOpen\(p\.id\)/)
})
test('SAFE-09 · Proyectos protege antes y después de la confirmación', () => {
  assert.match(modal, /if \(isProjectOpen\(p\.id\)\) return toast/)
  assert.match(modal, /if \(await removeProject\(p\.id\)\) await refresh\(\)/)
})
test('SAFE-10 · bienvenida protege también el acceso mediante Supr', () => {
  assert.match(welcome, /else if \(e\.key === 'Delete'\) del\(\)/)
  assert.match(welcome, /if \(isProjectOpen\(p\.id\)\) return toast/)
  assert.match(welcome, /:disabled="busy \|\| !current \|\| isProjectOpen\(current\.id\)"/)
})
test('SAFE-11 · bienvenida conserva el proyecto seleccionado mientras confirma el borrado', () => {
  assert.match(welcome, /const p = current\.value/)
  assert.match(welcome, /if \(await removeProject\(p\.id\)\) await refresh\(\)/)
})
test('SAFE-12 · no afecta los flujos de duplicar, renombrar, abrir o guardar', () => {
  for (const method of ['duplicateProject', 'renameProject', 'openProject', 'saveNow']) {
    assert.match(project, new RegExp('(?:function|const) ' + method + '\\b'))
  }
  assert.match(modal, /async function dup\(p\)/)
  assert.match(welcome, /const dup = \(\)/)
})
