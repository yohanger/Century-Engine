// LF-RESOURCE-HISTORY-CORR-G001: regresión real del historial de .post y GameManager.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { newProfile } from '../src/engine/runtime/render/profiles.js'
import { normalizeGameManager } from '../src/engine/runtime/game-manager.js'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
function functions(path, names, env) {
  const body = read(path).replace(/^import\s+[^\n]+\n/gm, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/g, '')
  return runInNewContext(`${body}\n;({${names.join(',')}})`, env, { filename: path, timeout: 2000 })
}
function setup() {
  const profile = newProfile('pr1', 'Prueba.post')
  profile.fx.bloom.on = true
  profile.fx.bloom.bloom = 1.5
  const manager = normalizeGameManager({ id: 'gm1', name: 'Prueba.gamemanager', player: 'inherit', profile: 'pr1', camera: 'cam1' })
  const preview = []
  const editor = {
    _postPreviewProfile: null,
    previewProfile(p) { this._postPreviewProfile = p; preview.push(p?.id ?? null) },
    snapshotTerrain: () => ({ layers: [], foliage: [] }),
    restoreTerrain() {}, syncAll() {}, syncEnvironment() {}, setSelection() {}, restoreEdit() {}, afterUndo() {}, applyView() {},
  }
  const store = { project: {
    id: 'test', objects: [{ id: 'cam1', type: 'camera', props: { profile: 'pr1' } }],
    profiles: [profile], gameManagers: [manager], materials: [{ id: 'mt1', roughness: 0.3 }],
    environment: {}, terrain: { enabled: false, layers: [], foliage: [] },
  }, editor, selectedId: null, selectedIds: [], projSel: { kind: 'profile', id: 'pr1' },
    prefs: { rightTab: 'object' }, ui: { mode: 'desktop' }, disk: { state: 'saved' }, saveState: 'saved' }
  const history = functions('src/core/state/history.js', ['resetHistory', 'commit', 'undo', 'redo', 'markDirty'], {
    store, toRaw: (v) => v, debounce: () => () => {}, JSON, Set, Object,
  })
  const profiles = functions('src/core/state/profiles.js', ['touchProfile'], {
    store, commit: history.commit, markDirty: history.markDirty, normalizeProfile: (p) => {
      // Usa el normalizador real para mantener el mismo contrato de propiedades.
      return normalizeProfile(p)
    },
  })
  history.resetHistory()
  return { store, history, profiles, preview }
}
import { normalizeProfile } from '../src/engine/runtime/render/profiles.js'

test('HC-01 · Undo de GameManager restaura Player, cámara y perfil por ID', () => {
  const { store, history } = setup()
  Object.assign(store.project.gameManagers[0], { player: 'none', camera: '', profile: '' })
  history.commit('Editar GameManager')
  history.undo()
  assert.deepEqual([store.project.gameManagers[0].player,store.project.gameManagers[0].camera,store.project.gameManagers[0].profile], ['inherit', 'cam1', 'pr1'])
})
test('HC-02 · Redo de GameManager restaura la edición posterior', () => {
  const { store, history } = setup()
  store.project.gameManagers[0].player = 'none'
  history.commit('Editar GameManager')
  history.undo(); history.redo()
  assert.equal(store.project.gameManagers[0].player, 'none')
})
test('HC-03 · Undo y Redo de .post restauran números y flags', () => {
  const { store, history } = setup()
  store.project.profiles[0].fx.bloom.bloom = 2.4
  store.project.profiles[0].fx.bloom.on = false
  history.commit('Editar perfil')
  history.undo()
  assert.equal(store.project.profiles[0].fx.bloom.bloom, 1.5)
  assert.equal(store.project.profiles[0].fx.bloom.on, true)
  history.redo()
  assert.equal(store.project.profiles[0].fx.bloom.bloom, 2.4)
  assert.equal(store.project.profiles[0].fx.bloom.on, false)
})
test('HC-04 · Los cambios de materiales y objetos conservan Undo y Redo', () => {
  const { store, history } = setup()
  store.project.materials[0].roughness = 0.8
  store.project.objects[0].name = 'Cámara editada'
  history.commit('Editar material')
  history.undo()
  assert.equal(store.project.materials[0].roughness, 0.3)
  assert.equal(store.project.objects[0].name, undefined)
  history.redo()
  assert.equal(store.project.materials[0].roughness, 0.8)
  assert.equal(store.project.objects[0].name, 'Cámara editada')
})
test('HC-05 · Undo elimina recursos recién creados y Redo los recupera', () => {
  const { store, history } = setup()
  store.project.profiles.push(newProfile('pr2', 'Otra.post'))
  store.project.gameManagers.push(normalizeGameManager({ id:'gm2', name:'Otro.gamemanager' }))
  history.commit('Crear recursos')
  history.undo()
  assert.deepEqual(store.project.profiles.map(p => p.id), ['pr1'])
  assert.deepEqual(store.project.gameManagers.map(g => g.id), ['gm1'])
  history.redo()
  assert.deepEqual(store.project.profiles.map(p => p.id), ['pr1','pr2'])
  assert.deepEqual(store.project.gameManagers.map(g => g.id), ['gm1','gm2'])
})
test('HC-06 · El historial no altera IDs ni referencias de escenas/cámaras', () => {
  const { store, history } = setup()
  store.project.profiles[0].fx.bloom.bloom = 2
  history.commit('Editar perfil')
  history.undo()
  assert.equal(store.project.profiles[0].id, 'pr1')
  assert.equal(store.project.gameManagers[0].profile, 'pr1')
  assert.equal(store.project.objects[0].props.profile, 'pr1')
})
test('HC-07 · Deshacer renueva la referencia de vista previa activa', () => {
  const { store, history, preview } = setup()
  store.editor.previewProfile(store.project.profiles[0])
  store.project.profiles[0].fx.bloom.bloom = 2.1
  history.commit('Editar perfil')
  history.undo()
  assert.equal(store.editor._postPreviewProfile, store.project.profiles[0])
  assert.equal(store.editor._postPreviewProfile.fx.bloom.bloom, 1.5)
  assert.deepEqual(preview, ['pr1', 'pr1'])
})
test('HC-08 · Modo Antes no vuelve a activar la vista previa tras Undo', () => {
  const { store, history, preview } = setup()
  store.project.profiles[0].fx.bloom.bloom = 2.1
  history.commit('Editar perfil')
  history.undo()
  assert.equal(store.editor._postPreviewProfile, null)
  assert.deepEqual(preview, [])
})
test('HC-09 · Eliminar perfil activo limpia su previsualización al deshacer', () => {
  const { store, history, preview } = setup()
  store.project.profiles[0].fx.bloom.bloom = 2
  history.commit('Cambiar perfil')
  store.editor.previewProfile(store.project.profiles[0])
  store.project.profiles = []
  history.commit('Eliminar perfil')
  history.redo()
  assert.equal(store.project.profiles.length, 0)
  // La restauración previa de un estado sin perfil debe anular el recurso pendiente.
  history.undo(); history.redo()
  assert.equal(store.editor._postPreviewProfile, null)
  assert.equal(preview.at(-1), null)
})
test('HC-10 · touchProfile registra solo la confirmación de una edición continua', () => {
  const { store, history, profiles } = setup()
  for (const v of [1.6,1.8,2.1]) {
    store.project.profiles[0].fx.bloom.bloom = v
    profiles.touchProfile('pr1', { record: false })
  }
  assert.equal(store.canUndo, false)
  profiles.touchProfile('pr1')
  assert.equal(store.canUndo, true)
  history.undo()
  assert.equal(store.project.profiles[0].fx.bloom.bloom, 1.5)
  assert.equal(store.canUndo, false)
})
test('HC-11 · Confirmaciones independientes conservan Undo por operación', () => {
  const { store, history, profiles } = setup()
  store.project.profiles[0].fx.bloom.bloom = 2
  profiles.touchProfile('pr1')
  store.project.profiles[0].fx.bloom.bloom = 2.5
  profiles.touchProfile('pr1')
  history.undo()
  assert.equal(store.project.profiles[0].fx.bloom.bloom, 2)
  history.undo()
  assert.equal(store.project.profiles[0].fx.bloom.bloom, 1.5)
})
test('HC-12 · Referencia de perfil inexistente no registra una edición', () => {
  const { store, profiles } = setup()
  profiles.touchProfile('no-existe')
  assert.equal(store.canUndo, false)
})
test('HC-13 · El Inspector separa cambios continuos y confirmación', () => {
  const src = read('src/components/ProfileEditor.vue')
  assert.match(src, /record:\s*false/)
  assert.match(src, /@change="modified" @commit="finished"/)
  assert.match(src, /const toggle = .*finished\(\)/)
  assert.match(src, /postShader" @change="finished"/)
  assert.match(src, /@input="shaderParam\(p, \$event.target.value, false\)" @change="finished"/)
})
test('HC-14 · ParamForm confirma NumberField y ColorInput al terminar el gesto', () => {
  const src = read('src/components/ParamForm.vue')
  assert.match(src, /defineEmits\(\['change', 'commit'\]\)/)
  assert.match(src, /NumberField v-else-if="p.type === 'number'"[^\n]+@commit="emit\('commit'\)"/)
  assert.match(src, /ColorInput v-else-if="p.type === 'color'"[^\n]+@change="emit\('commit'\)"/)
})
test('HC-15 · La estructura serializada sigue siendo compatible con los recursos actuales', () => {
  const { store, history } = setup()
  const before = JSON.stringify(store.project)
  store.project.profiles[0].fx.bloom.bloom = 2.3
  history.commit('Perfil')
  history.undo()
  assert.equal(JSON.stringify(store.project), before)
})
