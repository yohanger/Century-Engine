import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const view = read('src/components/ViewBar.vue')
const prefs = read('src/components/PreferencesModal.vue')
const commands = read('src/core/commands.js')
const state = read('src/core/state/state.js')
const viewport = read('src/engine/runtime/render/viewport.js')
const menu = read('src/components/MenuBar.vue')
const config = read('src/engine/runtime/render/config.js')

test('VIEWBAR-01: barra escena conserva los grupos de visualización y encuadrado', () => {
  for (const id of ['view.grid', 'view.wire', 'view.lights', 'view.terrain', 'view.persp', 'view.top', 'view.front', 'view.right', 'view.frame']) {
    assert.ok(view.includes(id), id)
  }
  assert.match(view, /tab === 'scene'/)
  assert.match(view, /store\.play\.on \|\| store\.gameView\.on \? 'game' : 'scene'/)
  assert.match(view, /<template v-else>/)
  assert.doesNotMatch(view, /role=\"tablist\"|role=\"tab\"/)
})
test('VIEWBAR-02: CA-002 permite solo el icono de navegación y elimina el selector erróneo de render', () => {
  assert.doesNotMatch(view, /editorFov|gizmoSize|camera\.orbitSelection|camera\.toSelected|camera\.alignSpawn|camera\.pilot|renderMethod|RENDERERS/)
  assert.match(view, /gameAspect/)
  assert.match(view, /gameScale/)
  assert.match(view, /gameMute/)
  assert.match(view, /gameMaximize/)
})
test('VIEWBAR-03: FOV se gestiona únicamente desde Preferencias del editor', () => {
  assert.match(prefs, /Cámara del editor/)
  assert.match(prefs, /editor-camera-fov/)
  assert.match(prefs, /type="number" min="40" max="120"/)
  assert.match(prefs, /setEditorFov\(\$event\.target\.value\)/)
  assert.match(state, /editorFov: 90/)
  assert.match(viewport, /setCameraFov\(this\.persp, p\.editorFov \?\? 90\)/)
})
test('VIEWBAR-04: FOV inválido se restaura y valores finitos quedan entre 40 y 120', () => {
  const fn = prefs.match(/const setEditorFov = \(value\) => \{[\s\S]*?\n\}/)?.[0]
  assert.ok(fn)
  const p = { editorFov: 90 }
  const set = new Function('p', `${fn}\nreturn setEditorFov`)(p)
  for (const [input, expected] of [['80', 80], ['20', 40], ['121', 120], ['90.5', 90.5], ['', 90], ['abc', 90]]) {
    set(input)
    assert.equal(p.editorFov, expected, input)
  }
})
test('VIEWBAR-05: Restablecer en preferencias recupera FOV 90 y otros valores ya existentes', () => {
  assert.match(state, /editorFov: 90/)
  assert.match(state, /gizmoSize: 1/)
  assert.match(prefs, /const defaults = defaultPrefs\(\)/)
  assert.match(prefs, /keys\.forEach\(resetOne\)/)
  for (const key of ['editorFov','gizmoSize','navigation']) assert.ok(prefs.includes(`['${key}',`))
  assert.match(state, /navigation: 'mouse'/)
  assert.match(prefs, /Tamaño de los gizmos/)
})
test('VIEWBAR-06: se conserva estado y persistencia; no migra datos de proyecto', () => {
  assert.match(state, /PREFS_KEY = 'levelforge:prefs'/)
  assert.match(state, /renderMethod: ''/)
  assert.match(state, /localStorage\.setItem\(PREFS_KEY/)
  assert.doesNotMatch(prefs, /project\.render\s*=/)
})
test('VIEWBAR-07: CA-002 devuelve Render exclusivamente al menú Ver; el icono navega en Escena', () => {
  assert.match(commands, /add\('view\.renderOptions', 'Render del viewport'[\s\S]*?hidden: true/)
  assert.match(commands, /'view\.renderOptions', '-', 'camera\.orbitSelection'/)
  assert.doesNotMatch(view, /RENDERERS|render-choice|rendererLabels|Método de render del viewport/)
  assert.match(view, /@click="run\(p\.navigation === 'trackpad' \? 'nav\.mouse' : 'nav\.trackpad'\)"/)
  assert.doesNotMatch(read('src/core/commands.js').split('export const MESH_MENU = ')[1].split('\n')[0], /renderOptions/)
})
test('VIEWBAR-08: menú real usa el catálogo de render existente, sin tocar render persistente', () => {
  const block = commands.match(/  add\('view\.renderOptions',[\s\S]*?\n  \]\s*\}\)/)?.[0]
  assert.ok(block, 'comando del submenú')
  const RENDERERS = [{id:'forward',name:'Forward+'},{id:'mobile',name:'Mobile'},{id:'compat',name:'Compatibility'}]
  const viewState = { view: { renderMethod: '' }, project: { render: {look:'realista',profile:'alto'} } }
  const actions = []
  const create = new Function('store', 'RENDERERS', 'methodOf', 'add', block)
  const build = () => { actions.length = 0; create(viewState, RENDERERS, (r) => r.profile === 'alto' ? 'forward' : 'compat', (...args) => actions.push(args)); return actions[0][2].children }
  let children = build()
  assert.equal(children.length,4)
  assert.equal(children[0].checked,true)
  assert.match(children[0].label,/Forward\+/)
  children[2].run()
  assert.equal(viewState.view.renderMethod,'mobile')
  assert.equal(viewState.project.render.profile,'alto')
  children = build()
  assert.equal(children[2].checked,true)
  children[0].run()
  assert.equal(viewState.view.renderMethod,'')
  assert.equal(viewState.project.render.profile,'alto')
  assert.match(config,/export const RENDERERS/)
})
test('VIEWBAR-09: conservar acciones de cámara y navegación existentes', () => {
  for (const id of ['camera.orbitSelection','camera.toSelected','camera.alignSelected','camera.alignSpawn','camera.pilot','camera.stopPilot','nav.mouse','nav.trackpad']) {
    assert.ok(commands.includes(`'${id}'`), id)
  }
  assert.match(menu, /ids: MENUS\[2\]\.ids/)
})
test('VIEWBAR-10: el Player y preferencias del proyecto no cambian por esta UX', () => {
  assert.match(read('src/components/GameSettingsModal.vue'), /render/)
  assert.match(view, /gameScale|gameAspect/)
  assert.match(commands, /add\('game\.settings'/)
})
test('VIEWBAR-11: el submenú no aparece como comando sin acción en la paleta', () => {
  assert.match(commands, /'view.renderOptions', 'Render del viewport', \{ group: 'Ver', icon: 'light', hidden: true/ )
  assert.match(read('src/components/CommandPalette.vue'), /!c.hidden/)
})
test('VIEWBAR-12: sin nuevas ventanas o estados duplicados de render', () => {
  assert.doesNotMatch(prefs, /renderMethod/)
  assert.doesNotMatch(view, /new.*(WebGLRenderer|Window)/)
})
