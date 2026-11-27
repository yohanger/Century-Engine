// LF-RESOURCE-INSPECTOR-G001: contrato de rutas y datos de .post (sin entorno DOM).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { newProfile, normalizeProfile, applyProfile, PROFILE_EFFECTS } from '../src/engine/runtime/render/profiles.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = (p) => readFileSync(resolve(root, p), 'utf8')
const dock = src('src/components/InspectorDock.vue')
const editor = src('src/components/ProfileEditor.vue')
const project = src('src/components/ProjectPanel.vue')
const state = src('src/core/state/profiles.js')
const scene = src('src/core/state/objects.js')
const app = src('src/App.vue')

test('RI-01 · el Inspector renderiza el editor real de perfiles', () => {
  assert.match(dock, /import ProfileEditor from '\.\/ProfileEditor\.vue'/)
  assert.match(dock, /<ProfileEditor v-if=/)
  assert.match(dock, /:profile-id="store\.projSel\.id"/)
})
test('RI-02 · selecciona perfil por ID, no por nombre', () => {
  assert.match(dock, /store\.projSel\?\.kind === 'profile'/)
  assert.match(dock, /store\.project\?\.profiles\?\.some/)
  assert.match(editor, /p\.id === props\.profileId/)
})
test('RI-03 · no abre una segunda ventana para .post', () => {
  assert.doesNotMatch(editor, /<AppWindow/)
  assert.doesNotMatch(app, /<ProfileEditor/)
  assert.doesNotMatch(state, /store\.modal = 'profile'/)
})
test('RI-04 · reutiliza ParamForm y el catálogo de efectos', () => {
  assert.match(editor, /<ParamForm/)
  assert.match(editor, /PROFILE_EFFECTS/)
  assert.match(editor, /fx\(current\)/)
})
test('RI-05 · selección simple de .post en Assets muestra Inspector', () => {
  assert.match(project, /function setSel\(list\)/)
  assert.match(project, /store\.projSel = list\.at\(-1\) \|\| null/)
  assert.match(project, /\['profile', 'material', 'gamemanager', 'liquid', 'vfx'\]\.includes\(store\.projSel\?\.kind\)/)
  assert.match(project, /store\.prefs\.rightTab = 'object'/)
})
test('RI-06 · doble clic en .post y nuevo recurso usan la misma ruta', () => {
  assert.match(project, /it\.kind === 'profile'\) openProfileEditor\(it\.id\)/)
  assert.match(project, /function newProfile\([\s\S]*?openProfileEditor\(d\.id\)/)
})
test('RI-07 · apertura desde el slot de cámara y Spawn no se pierde', () => {
  const slot = src('src/components/ProfileSlot.vue')
  assert.match(slot, /openProfileEditor\(cur\.id\)/)
  assert.match(slot, /openProfileEditor\(d\.id\)/)
})
test('RI-08 · GameManager conserva edición de perfil', () => {
  const gm = src('src/components/GameManagerEditor.vue')
  assert.match(gm, /openProfileEditor\(gm\.value\.profile\)/)
  assert.match(state, /store\.projSel = \{ kind: 'profile', id \}/)
  assert.doesNotMatch(state, /store\.modal = 'gamemanager'/)
})
test('RI-09 · seleccionar nodo de escena devuelve el Inspector de escena', () => {
  assert.match(scene, /\['profile', 'material', 'gamemanager', 'vfx'\]\.includes\(store\.projSel\?\.kind\)/)
  assert.match(project, /if \(!v\) \{ if \(sel\.value\.length\) sel\.value = \[\]; return \}/)
  assert.match(dock, /<Inspector v-else v-show="tab === 'object'"/)
})
test('RI-10 · preview Antes/Después reutiliza el renderer', () => {
  assert.match(editor, /before\.value \? null : pr\.value/)
  assert.match(editor, /onMounted\(preview\)/)
  assert.match(editor, /onBeforeUnmount\(\(\) => store\.editor\?\.previewProfile\?\.\(null\)\)/)
  assert.match(editor, /data-testid="pf-before-after"/)
})
test('RI-11 · Inspector desmonta la previsualización al cambiar de pestaña o perfil', () => {
  assert.match(dock, /tab === 'object'/)
  assert.match(dock, /:key="store\.projSel\.id"/)
  assert.match(editor, /onBeforeUnmount/)
})
test('RI-12 · cambios en valores usan persistencia original', () => {
  assert.match(editor, /touchProfile\(pr\.value\.id\)/)
  assert.match(state, /markDirty\(\)/)
  assert.match(state, /normalizeProfile\(pr\)/)
})
test('RI-13 · sigue disponible el gráfico de postprocesado', () => {
  assert.match(editor, /Shader Graph \(Post Processing\)/)
  assert.match(editor, /openShaderEditor\(selectedGraph\.id\)/)
  assert.match(editor, /shaderVectorParam/)
})
test('RI-14 · no introduce otra autoridad de selección', () => {
  assert.doesNotMatch(src('src/core/state/state.js'), /profileEditId:/)
  assert.match(state, /store\.projSel = \{ kind: 'profile', id \}/)
  assert.match(state, /store\.prefs\.rightTab = 'object'/)
})
test('RI-15 · perfiles .profile antiguos conservan la extensión al renombrar', () => {
  assert.match(editor, /endsWith\('\.profile'\)/)
  const legacy = normalizeProfile({ id: 'legacy1', name: 'Original.profile', fx: {} })
  assert.equal(legacy.name, 'Original.profile')
})
test('RI-16 · editabilidad no cambia el formato ni los límites de los perfiles', () => {
  const p = newProfile('p1', 'Preview.post', {})
  assert.equal(p.id, 'p1')
  assert.equal(p.name, 'Preview.post')
  assert.ok(PROFILE_EFFECTS.length >= 10)
  p.fx.bloom.on = true
  p.fx.bloom.bloom = 99
  const normalized = normalizeProfile(p)
  assert.equal(normalized.fx.bloom.bloom, 3)
  assert.equal(applyProfile({ bloom: 0.2 }, normalized).bloom, 3)
  assert.equal(applyProfile({ bloom: 0.2 }, null).bloom, 0.2)
})
test('RI-17 · UI estrecha conserva formulario y layout vertical', () => {
  assert.match(editor, /container:insp \/ inline-size/)
  assert.match(editor, /\.post-columns \{ display:flex; flex-direction:column/)
  assert.match(editor, /\.post-name input \{ flex:1; min-width:0;/)
})
test('RI-18 · la selección muestra el Inspector en escritorio o drawer', () => {
  assert.match(state, /store\.prefs\.rightOpen = true/)
  assert.match(state, /store\.ui\.drawer = 'inspector'/)
})
