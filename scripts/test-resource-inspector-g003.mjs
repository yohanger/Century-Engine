// LF-RESOURCE-INSPECTOR-G003 — integración de recursos sin modificar producción.
// Las pruebas de interfaz inspeccionan conexiones; los casos de estado ejecutan funciones reales con dependencias sustituidas.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { normalizeMaterial, effectiveMaterialObject } from '../src/engine/runtime/render/material-resource.js'
import { newProfile, normalizeProfile, applyProfile } from '../src/engine/runtime/render/profiles.js'
import { normalizeGameManager, sceneGameConfig } from '../src/engine/runtime/game-manager.js'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const dock = read('src/components/InspectorDock.vue')
const projectPanel = read('src/components/ProjectPanel.vue')
const profileComponent = read('src/components/ProfileEditor.vue')
const materialComponent = read('src/components/MaterialResourceEditor.vue')
const managerComponent = read('src/components/GameManagerEditor.vue')
const scenePanel = read('src/components/ScenePanel.vue')
const objectOps = read('src/core/state/objects.js')
const historySource = read('src/core/state/history.js')

// Ejecuta el cuerpo auténtico del módulo, inyectando las dependencias que Vue/Electron proporcionan en producción.
function moduleFunctions(path, names, env) {
  const body = read(path)
    .replace(/^import\s+[^\n]+\n/gm, '')
    .replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/g, '')
  const source = `${body}\n;({ ${names.join(', ')} })`
  return runInNewContext(source, env, { filename: path, timeout: 2500 })
}
function fixture(mode = 'desktop') {
  const profile = newProfile('pr1', 'Interior.post')
  profile.fx.bloom.on = true
  profile.fx.bloom.bloom = 1.5
  const material = normalizeMaterial({ id: 'mt1', name: 'Piedra.material', color: '#8492a3', roughness: 0.4 })
  const manager = normalizeGameManager({ id: 'gm1', name: 'Juego.gamemanager', player: 'inherit', profile: 'pr1', camera: 'cam1' })
  const store = {
    project: {
      id: 'demo', activeSceneId: 's1', game: { player: 'fps' },
      scenes: [{ id: 's1', gameManagerId: 'gm1' }],
      profiles: [profile], materials: [material], gameManagers: [manager],
      objects: [
        { id: 'cam1', type: 'camera', props: { profile: 'pr1' } },
        { id: 'box1', type: 'box', materialId: 'mt1', color: '#ffffff', roughness: 1, metallic: 0, opacity: 1, mat: {} },
        { id: 'box2', type: 'box', materialId: 'mt1', color: '#ffffff', roughness: 1, metallic: 0, opacity: 1, mat: {} },
      ],
      prefabs: [], environment: {}, terrain: { enabled: false, layers: [], foliage: [] },
    },
    projSel: null, prefs: { rightTab: 'terrain', rightOpen: false }, ui: { mode, drawer: null },
    selectedId: null, selectedIds: [], edit: {},
    editor: {
      previews: [], synced: [], previewProfile(p) { this.previews.push(p?.id ?? null) },
      syncObject(id) { this.synced.push(id) }, syncAll() {}, setSelection() {},
      snapshotTerrain() { return { layers: [], foliage: [] } },
      restoreTerrain() {}, restoreEdit() {}, syncEnvironment() {}, afterUndo() {}, applyView() {},
    },
  }
  const commits = []
  const env = {
    store, uid: (prefix) => prefix + 'new', addFolderChain() {}, uniqueFileName: (_p, _folder, name) => name,
    normFolder: (folder) => folder,
    newProfile, normalizeProfile, isProfileName: () => true, PROFILE_EXT: '.post', PROFILE_FOLDER: 'Assets/Profiles',
    normalizeMaterial, materialFromObject: () => material, MATERIAL_FOLDER: 'Assets/Materials',
    MANAGER_FOLDER: 'Assets/GameManagers', MANAGER_EXT: '.gamemanager', normalizeGameManager,
    commit: (label) => commits.push(label), markDirty() {}, updateObject() {}, db: {},
  }
  const profiles = moduleFunctions('src/core/state/profiles.js', ['openProfileEditor', 'closeProfileEditor', 'touchProfile', 'dropProfile'], env)
  const materials = moduleFunctions('src/core/state/materials.js', ['openMaterialEditor', 'closeMaterialEditor', 'updateMaterial', 'dropMaterial'], env)
  const managers = moduleFunctions('src/core/state/game-managers.js', ['openGameManagerEditor', 'closeGameManagerEditor', 'touchGameManager', 'dropGameManager'], env)
  return { store, profiles, materials, managers, commits }
}
function historyFixture() {
  const { store } = fixture()
  const env = { store, toRaw: (v) => v, debounce: () => () => {}, JSON, Set, Object }
  const history = moduleFunctions('src/core/state/history.js', ['resetHistory', 'commit', 'undo', 'redo'], env)
  history.resetHistory()
  return { store, history }
}

test('RI3-01 · navegar .post → material → GameManager conserva una sola selección de recurso', () => {
  const { store, profiles, materials, managers } = fixture()
  profiles.openProfileEditor('pr1')
  assert.equal(store.projSel.kind, 'profile')
  materials.openMaterialEditor('mt1')
  assert.equal(store.projSel.kind, 'material')
  managers.openGameManagerEditor('gm1')
  assert.deepEqual({ ...store.projSel }, { kind: 'gamemanager', id: 'gm1' })
  assert.equal(store.prefs.rightTab, 'object')
  assert.equal(store.prefs.rightOpen, true)
})
test('RI3-02 · navegación interna GameManager → .post respeta ID sin duplicar datos', () => {
  const { store, profiles, managers } = fixture()
  managers.openGameManagerEditor('gm1')
  profiles.openProfileEditor(store.project.gameManagers[0].profile)
  assert.equal(store.projSel.id, 'pr1')
  assert.equal(store.project.gameManagers[0].profile, 'pr1')
  assert.equal(store.project.profiles.length, 1)
})
test('RI3-03 · los accesos desde Assets, ScenePanel y materiales llegan al dock existente', () => {
  assert.match(projectPanel, /\['profile', 'material', 'gamemanager', 'liquid', 'vfx'\]\.includes\(store\.projSel\?\.kind\)/)
  assert.match(scenePanel, /openGameManagerEditor\(assignedManager\(\)\.id\)/)
  assert.match(materialComponent, /<MaterialSection :resource-id="material\.id"/)
  assert.match(managerComponent, /openProfileEditor\(gm\.value\.profile\)/)
  for (const kind of ['profile', 'material', 'gamemanager']) assert.ok(dock.includes(`store.projSel?.kind === '${kind}'`))
})
test('RI3-04 · referencias inválidas no sustituyen la selección activa', () => {
  const { store, profiles, materials, managers } = fixture()
  profiles.openProfileEditor('pr1')
  materials.openMaterialEditor('ausente')
  managers.openGameManagerEditor('ausente')
  profiles.openProfileEditor('ausente')
  assert.deepEqual({ ...store.projSel }, { kind: 'profile', id: 'pr1' })
})
test('RI3-05 · editar material compartido sincroniza a todos sus consumidores sin cambiar IDs', () => {
  const { store, materials, commits } = fixture()
  assert.equal(materials.updateMaterial('mt1', { roughness: 0.27, color: '#112233' }), true)
  assert.deepEqual([...store.editor.synced].sort(), ['box1', 'box2'])
  assert.deepEqual(store.project.objects.slice(1).map((o) => o.materialId), ['mt1', 'mt1'])
  for (const o of store.project.objects.slice(1)) assert.equal(effectiveMaterialObject(o, store.project.materials).roughness, 0.27)
  assert.equal(commits.length, 1)
})
test('RI3-06 · eliminar material libera instancias y conserva apariencia heredada', () => {
  const { store, materials } = fixture()
  assert.equal(materials.dropMaterial('mt1'), true)
  assert.equal(store.project.materials.length, 0)
  for (const o of store.project.objects.slice(1)) {
    assert.equal(o.materialId, '')
    assert.equal(o.color, '#8492a3')
    assert.equal(o.roughness, 0.4)
  }
})
test('RI3-07 · actualizar GameManager afecta a la escena sin crear otro Player', () => {
  const { store, managers, commits } = fixture()
  assert.equal(managers.touchGameManager('gm1', { player: 'none', camera: 'cam1' }), true)
  assert.equal(sceneGameConfig(store.project).config.player, 'none')
  assert.equal(sceneGameConfig(store.project).manager.camera, 'cam1')
  assert.equal(store.project.objects.length, 3)
  assert.equal(commits.length, 1)
})
test('RI3-08 · GameManager con perfil borrado usa render del proyecto', () => {
  const { store, profiles } = fixture()
  store.projSel = { kind: 'profile', id: 'pr1' }
  profiles.dropProfile('pr1')
  assert.equal(store.project.gameManagers[0].profile, '')
  assert.equal(store.project.objects[0].props.profile, '')
  assert.equal(store.projSel, null)
  assert.equal(store.editor.previews.at(-1), null)
})
test('RI3-09 · eliminar GameManager libera la referencia de escena y limpia selección', () => {
  const { store, managers } = fixture()
  managers.openGameManagerEditor('gm1')
  assert.equal(managers.dropGameManager('gm1'), true)
  assert.equal(store.project.scenes[0].gameManagerId, '')
  assert.equal(sceneGameConfig(store.project).config.player, 'fps')
  assert.equal(store.projSel, null)
})
test('RI3-10 · cambios de selección de objeto y pestaña no dejan recurso en segundo plano', () => {
  assert.match(objectOps, /\['profile', 'material', 'gamemanager', 'vfx'\]\.includes\(store\.projSel\?\.kind\)\) store\.projSel = null/)
  assert.match(dock, /tab === 'object' && store\.projSel\?\.kind === 'profile'/)
  assert.match(dock, /tab === 'object' && store\.projSel\?\.kind === 'material'/)
  assert.match(dock, /tab === 'object' && store\.projSel\?\.kind === 'gamemanager'/)
  assert.match(projectPanel, /watch\(\(\) => store\.projSel/)
})
test('RI3-11 · la previsualización se desactiva al desmontar el perfil', () => {
  assert.match(profileComponent, /onBeforeUnmount\(\(\) => store\.editor\?\.previewProfile\?\.\(null\)\)/)
  assert.match(profileComponent, /data-testid="profile-inspector"/)
})
test('RI3-12 · recursos guardados preservan ID y propiedades al serializar y restaurar', () => {
  const { store, materials, managers } = fixture()
  materials.updateMaterial('mt1', { metallic: 0.65 })
  managers.touchGameManager('gm1', { player: 'none' })
  store.project.profiles[0].fx.bloom.bloom = 2
  const serialized = JSON.parse(JSON.stringify(store.project))
  const restored = {
    ...serialized,
    materials: serialized.materials.map(normalizeMaterial),
    profiles: serialized.profiles.map((p) => normalizeProfile(p)),
    gameManagers: serialized.gameManagers.map((g) => normalizeGameManager(g)),
  }
  assert.equal(restored.materials[0].id, 'mt1')
  assert.equal(restored.materials[0].metallic, 0.65)
  assert.equal(restored.profiles[0].id, 'pr1')
  assert.equal(applyProfile({}, restored.profiles[0]).bloom, 2)
  assert.equal(sceneGameConfig(restored).config.player, 'none')
})
test('RI3-13 · navegación funciona en el drawer móvil sin abrir ventanas', () => {
  const { store, materials, managers } = fixture('mobile')
  materials.openMaterialEditor('mt1')
  assert.equal(store.ui.drawer, 'inspector')
  store.ui.drawer = null
  managers.openGameManagerEditor('gm1')
  assert.equal(store.ui.drawer, 'inspector')
  assert.doesNotMatch(materialComponent, /<AppWindow/)
  assert.doesNotMatch(managerComponent, /<AppWindow/)
})
test('RI3-14 · Shader Graph continúa abriéndose desde controles del material y post', () => {
  assert.match(read('src/components/MaterialSection.vue'), /openShaderEditor\(doc\.id\)/)
  assert.match(profileComponent, /openShaderEditor\(selectedGraph\.id\)/)
})
test('RI3-15 · historial existente guarda y restaura materiales compartidos', () => {
  const { store, history } = historyFixture()
  const before = store.project.materials[0].roughness
  store.project.materials[0].roughness = 0.9
  history.commit('Editar material')
  history.undo()
  assert.equal(store.project.materials[0].roughness, before)
  history.redo()
  assert.equal(store.project.materials[0].roughness, 0.9)
})
test('RI3-16 · Undo/Redo de GameManager restaura la configuración editada', () => {
  const { store, history } = historyFixture()
  const before = store.project.gameManagers[0].player
  store.project.gameManagers[0].player = 'none'
  history.commit('Editar GameManager')
  history.undo()
  assert.equal(store.project.gameManagers[0].player, before, 'DEFECTO: history.js no restaura gameManagers')
})
test('RI3-17 · Undo/Redo de .post restaura las propiedades editadas', () => {
  const { store, history } = historyFixture()
  const before = store.project.profiles[0].fx.bloom.bloom
  store.project.profiles[0].fx.bloom.bloom = 2.4
  history.commit('Editar perfil')
  history.undo()
  assert.equal(store.project.profiles[0].fx.bloom.bloom, before, 'DEFECTO: history.js no restaura profiles')
})
