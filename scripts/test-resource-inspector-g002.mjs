// LF-RESOURCE-INSPECTOR-G002: rutas de edición de Material y GameManager sin ventanas duplicadas.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeMaterial, effectiveMaterialObject } from '../src/engine/runtime/render/material-resource.js'
import { normalizeGameManager, sceneGameConfig } from '../src/engine/runtime/game-manager.js'
const source = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const dock = source('src/components/InspectorDock.vue')
const mat = source('src/components/MaterialResourceEditor.vue')
const gm = source('src/components/GameManagerEditor.vue')
const ms = source('src/components/MaterialSection.vue')
const assets = source('src/components/ProjectPanel.vue')
const app = source('src/App.vue')
const state = source('src/core/state/state.js')
const materialOps = source('src/core/state/materials.js')
const managerOps = source('src/core/state/game-managers.js')
const profileOps = source('src/core/state/profiles.js')
const objects = source('src/core/state/objects.js')
const scenes = source('src/components/ScenePanel.vue')
const historical = source('scripts/test-resource-inspector-g001.mjs')

test('RI2-01 · Inspector reutiliza el editor real de materiales por ID', () => {
  assert.match(dock, /import MaterialResourceEditor from '\.\/MaterialResourceEditor\.vue'/)
  assert.match(dock, /store\.projSel\?\.kind === 'material'/)
  assert.match(dock, /store\.project\?\.materials\?\.some/)
  assert.match(dock, /:material-id="store\.projSel\.id"/)
})
test('RI2-02 · Inspector reutiliza el editor real de GameManager por ID', () => {
  assert.match(dock, /import GameManagerEditor from '\.\/GameManagerEditor\.vue'/)
  assert.match(dock, /store\.projSel\?\.kind === 'gamemanager'/)
  assert.match(dock, /store\.project\?\.gameManagers\?\.some/)
  assert.match(dock, /:manager-id="store\.projSel\.id"/)
})
test('RI2-03 · ambos usan formularios embebidos, sin AppWindow ni ventanas en App', () => {
  for (const s of [mat,gm]) assert.doesNotMatch(s, /AppWindow|#footer|persist="/)
  assert.doesNotMatch(app, /<MaterialResourceEditor|<GameManagerEditor/)
  assert.doesNotMatch(app, /import MaterialResourceEditor|import GameManagerEditor/)
})
test('RI2-04 · no se crean IDs alternativos ni estado modal de recursos', () => {
  assert.doesNotMatch(state, /materialEditId:|gameManagerEditId:/)
  assert.doesNotMatch(materialOps, /store\.modal\s*=\s*'material'/)
  assert.doesNotMatch(managerOps, /store\.modal\s*=\s*'gamemanager'/)
  assert.match(state, /projSel: null/)
})
test('RI2-05 · entrar desde material compartido lleva al Inspector y conserva el ID', () => {
  assert.match(materialOps, /store\.projSel = \{ kind: 'material', id \}/)
  assert.match(materialOps, /store\.prefs\.rightTab = 'object'/)
  assert.match(ms, /openMaterialEditor\(resource\.id\)/)
  assert.match(mat, /m\.id === props\.materialId/)
})
test('RI2-06 · abrir GameManager desde jerarquía conserva la referencia al recurso', () => {
  assert.match(scenes, /openGameManagerEditor\(assignedManager\(\)\.id\)/)
  assert.match(scenes, /assignSceneGameManager\(g\.id\); openGameManagerEditor\(g\.id\)/)
  assert.match(managerOps, /store\.projSel = \{ kind: 'gamemanager', id \}/)
  assert.match(gm, /g\.id === props\.managerId/)
})
test('RI2-07 · selección de Assets abre los tres recursos con un clic', () => {
  assert.match(assets, /\['profile', 'material', 'gamemanager', 'liquid', 'vfx'\]\.includes\(store\.projSel\?\.kind\)/)
  assert.match(assets, /store\.prefs\.rightTab = 'object'/)
  assert.match(assets, /store\.prefs\.rightOpen = true/)
  assert.match(assets, /store\.ui\.drawer = 'inspector'/)
})
test('RI2-08 · doble clic y creación siguen el mismo punto de entrada de material', () => {
  assert.match(assets, /it\.kind === 'material'\) openMaterialEditor\(it\.id\)/)
  assert.match(assets, /function newMaterial\([\s\S]*?openMaterialEditor\(d\.id\)/)
})
test('RI2-09 · doble clic y creación siguen el mismo punto de entrada de GameManager', () => {
  assert.match(assets, /it\.kind === 'gamemanager'\) openGameManagerEditor\(it\.id\)/)
  assert.match(assets, /function newGameManager\([\s\S]*?openGameManagerEditor\(d\.id\)/)
})
test('RI2-10 · nombre del material utiliza el renombrado original', () => {
  assert.match(mat, /renameEntry\('material', material\.value\.id/)
  assert.match(mat, /<MaterialSection :resource-id="material\.id"/)
  assert.match(ms, /Propiedades del material/)
})
test('RI2-11 · material compartido mantiene PBR, shader y sincronización de usuarios', () => {
  assert.match(ms, /Propiedades físicas avanzadas/)
  assert.match(ms, /<MaterialShader/)
  assert.match(ms, /openShaderEditor\(doc\.id\)/)
  assert.match(materialOps, /store\.editor\?\.syncObject\?\.\(obj\.id\)/)
  assert.match(materialOps, /commit\(`Editar material/)
})
test('RI2-12 · el modelo de material compartido continúa dominando los valores locales', () => {
  const m = normalizeMaterial({ id:'m1', name:'M.material', color:'#8090ab', roughness:0.37 })
  assert.equal(effectiveMaterialObject({id:'obj1', materialId:'m1', roughness:0.1},[m]).roughness, 0.37)
  assert.equal(effectiveMaterialObject({id:'obj2', materialId:'m1', roughness:0.99},[m]).roughness, 0.37)
})
test('RI2-13 · GameManager mantiene controles de Player, cámara y perfil', () => {
  for (const s of ['Tipo de Player','Cámara inicial','Perfil de post-proceso predeterminado']) assert.ok(gm.includes(s))
  assert.match(gm, /playerTypes\(\)/)
  assert.match(gm, /store\.project\?\.objects[\s\S]*?o\.type === 'camera'/)
  assert.match(gm, /touchGameManager\(gm\.value\.id/)
})
test('RI2-14 · navegar al perfil .post desde GameManager reutiliza el Inspector', () => {
  assert.match(gm, /openProfileEditor\(gm\.value\.profile\)/)
  assert.match(gm, /const pr = createProfile\(\); patch\('profile', pr\.id\); openProfileEditor\(pr\.id\)/)
  assert.match(profileOps, /store\.projSel = \{ kind: 'profile', id \}/)
  assert.doesNotMatch(profileOps, /store\.modal === 'gamemanager'/)
})
test('RI2-15 · GameManager conserva la semántica de datos en escenas guardadas', () => {
  const p={ game:{player:'fps'},activeSceneId:'s1',scenes:[{id:'s1',gameManagerId:'gm1'}],gameManagers:[normalizeGameManager({id:'gm1',player:'none',camera:'c1',profile:'p1'})],profiles:[{id:'p1'}] }
  const restored=sceneGameConfig(JSON.parse(JSON.stringify(p)))
  assert.equal(restored.config.player,'none')
  assert.equal(restored.manager.camera,'c1')
  assert.equal(restored.manager.profile,'p1')
})
test('RI2-16 · selección de un objeto desmonta el inspector de recursos', () => {
  assert.match(objects, /\['profile', 'material', 'gamemanager', 'vfx'\]\.includes\(store\.projSel\?\.kind\)\) store\.projSel = null/)
  assert.match(dock, /<Inspector v-else v-show="tab === 'object'"/)
  assert.match(assets, /if \(!v\) \{ if \(sel\.value\.length\) sel\.value = \[\]; return \}/)
})
test('RI2-17 · cambio de pestaña no deja un recurso abierto en segundo plano', () => {
  assert.match(dock, /tab === 'object' && store\.projSel\?\.kind === 'material'/)
  assert.match(dock, /tab === 'object' && store\.projSel\?\.kind === 'gamemanager'/)
  assert.match(dock, /:key="store\.projSel\.id"/)
})
test('RI2-18 · eliminación del recurso limpia únicamente su selección activa', () => {
  assert.match(materialOps, /store\.projSel\?\.kind === 'material' && store\.projSel\.id === id/)
  assert.match(managerOps, /store\.projSel\?\.kind === 'gamemanager' && store\.projSel\.id === id/)
  assert.match(managerOps, /for \(const scene of p\.scenes\)/)
})
test('RI2-19 · interfaces de ancho reducido conservan formularios verticales', () => {
  assert.match(mat, /min-width:0/)
  assert.match(gm, /flex-direction:column/)
  assert.match(gm, /flex-wrap:wrap/)
  assert.match(materialOps, /store\.ui\.drawer = 'inspector'/)
  assert.match(managerOps, /store\.ui\.drawer = 'inspector'/)
})
test('RI2-20 · selección de .post conserva preview y la prueba del Gate anterior', () => {
  assert.match(dock, /<ProfileEditor v-if=/)
  assert.match(historical, /onBeforeUnmount/)
  assert.match(profileOps, /store\.editor\?\.previewProfile\?\.\(null\)/)
})
