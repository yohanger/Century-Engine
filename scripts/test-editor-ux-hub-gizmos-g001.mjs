// Gate LF-EDITOR-UX-G001: pruebas de contrato y ejecución sin renderizador ni Electron.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GIZMO_CATEGORIES, gizmoCategory, gizmosEnabled } from '../src/core/editor/gizmo-visibility.js'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const commands = read('src/core/commands.js')
const project = read('src/core/state/project.js')
const view = read('src/components/ViewBar.vue')
const selection = read('src/core/editor/selection.js')
const editor = read('src/core/editor.js')
const watchers = read('src/core/editor/keys.js')
const state = read('src/core/state/state.js')

function createMenu(store) {
  const snippet = view.match(/function gizmoItems\(\) \{[\s\S]*?\n\}\nfunction openGizmos\(e\) \{[\s\S]*?\n\}/)?.[0]
  assert.ok(snippet, 'las acciones del menú deben existir')
  return new Function('store', 'GIZMO_CATEGORIES', `const p = store.prefs; ${snippet}; return { gizmoItems, openGizmos }`)(store, GIZMO_CATEGORIES)
}
function selectionOwner(store, objects) {
  const block = selection.match(/export const selectionMethods = \{([\s\S]*?)\n  setSelection\(/)?.[1]
  assert.ok(block, 'propietario de la visibilidad en selectionMethods')
  return new Function('store', 'getObject', 'gizmoCategory', 'gizmosEnabled', `return {${block}}`)(store, id => objects[id], gizmoCategory, gizmosEnabled)
}
function node(id, { icon = false, eventGem = false, zones = false } = {}) {
  return { userData: { id, editorGizmos: [{ userData: { editorGizmoEnabled: true }, visible: false }],
    ...(icon ? { editorOnlyVisual: { visible: true } } : {}),
    ...(eventGem ? { gem: { visible: true } } : {}),
    ...(zones ? { indicatorZonesGizmo: { visible: true }, cells: { visible: true } } : {}),
  } }
}

test('UX-01 · el comando ya existente cierra el proyecto y vuelve al Hub', () => {
  assert.match(commands, /add\('file\.close', 'Volver al Hub',[^\n]*run: \(\) => lockEditor\(\)/)
  assert.match(commands, /label: 'Archivo', ids: \['file\.projects', 'file\.save', 'file\.close'/)
  assert.match(project, /export async function lockEditor\(\)/)
  const body = project.split('export async function lockEditor()')[1].split('export async function createProject')[0]
  assert.match(body, /projLoc \? await saveAll\(\) : await saveNow\(\{ thumb: true \}\)/, 'guardar disco sin forzar carpeta para proyectos IndexedDB')
  assert.match(body, /if \(!\(projLoc \? await saveAll\(\) : await saveNow\(\{ thumb: true \}\)\)\) return false/, 'sin volver al Hub tras fallo de guardado')
  assert.match(body, /store\.locked = true/)
  assert.match(body, /store\.project = null/)
  assert.match(body, /editorWorkspace\?\.unmount\(\)/)
})

test('UX-02 · categorías reflejan los nodos que ya existen', () => {
  assert.deepEqual(GIZMO_CATEGORIES.map(c => c.id), ['cameras','lights','audio','colliders','volumes','other'])
  for (const [type, expected] of Object.entries({ camera:'cameras', light:'lights', audio:'audio',
    collisionshape3d:'colliders', rigidbody3d:'colliders', characterbody3d:'colliders', area3d:'colliders',
    trigger:'volumes', navigation:'volumes', atmovolume:'volumes', postvolume:'volumes', event:'other', spawn:'other' })) {
    assert.equal(gizmoCategory({type}), expected, type)
  }
  assert.equal(gizmoCategory(null),'other')
})

test('UX-03 · el interruptor general prevalece sin borrar opciones por categoría', () => {
  const p = { showGizmos:true, gizmoCategories:{lights:false} }
  assert.equal(gizmosEnabled(p,'lights'),false)
  assert.equal(gizmosEnabled(p,'cameras'),true)
  p.showGizmos = false
  assert.equal(gizmosEnabled(p,'cameras'),false)
  p.showGizmos = true
  assert.equal(gizmosEnabled(p,'lights'),false)
  assert.equal(gizmosEnabled({},'other'),true)
})

test('UX-04 · el menú reutiliza store.menu y reconstruye comprobaciones sin cerrarse', () => {
  const store = { prefs: { showGizmos:true, gizmoCategories:{} }, menu:null, addModal:{open:true} }
  const m = createMenu(store)
  const target = { getBoundingClientRect: () => ({left:600,bottom:72}) }
  m.openGizmos({ currentTarget:target })
  assert.equal(store.menu.gizmos,true)
  assert.equal(store.menu.returnFocus,target)
  assert.equal(store.addModal,null)
  assert.equal(store.menu.x,600)
  const toggle = store.menu.items.find(it => it.label === 'Mostrar gizmos')
  assert.equal(toggle.checked,true)
  assert.equal(toggle.keep,true)
  toggle.run()
  assert.equal(store.prefs.showGizmos,false)
  assert.equal(store.menu.rebuild().find(it=>it.label==='Mostrar gizmos').checked,false)
  m.openGizmos({currentTarget:target})
  assert.equal(store.menu,null)
})

test('UX-05 · el menú cambia cada categoría y restaura estados anteriores', () => {
  const store = {prefs:{ showGizmos:true, gizmoCategories:{} },menu:null,addModal:null}
  const {gizmoItems} = createMenu(store)
  for (const category of GIZMO_CATEGORIES) {
    const item = gizmoItems().find(it => it.label === category.label)
    assert.equal(item.checked,true)
    item.run()
    assert.equal(store.prefs.gizmoCategories[category.id],false)
    assert.equal(gizmoItems().find(it => it.label === category.label).checked,false)
    item.run()
    assert.equal(store.prefs.gizmoCategories[category.id],true)
  }
})

test('UX-06 · el botón solo se muestra en la barra de escena y tiene control accesible', () => {
  const scene = view.split('<template v-if="tab === \'scene\'">')[1].split('<template v-else>')[0]
  assert.match(scene, /Configurar gizmos/)
  assert.match(scene, /@click="openGizmos"/)
  assert.match(scene, /aria-haspopup="menu"/)
  assert.match(scene, /aria-expanded=/)
  assert.doesNotMatch(view.split('<template v-else>')[1], /@click="openGizmos"/)
})

test('UX-07 · configuración independiente de selección no afecta los controles de transformación', () => {
  const store = { play:{on:false}, prefs:{showGizmos:true,gizmoCategories:{}},selectedIds:['cam','light','mesh','event'] }
  const objects = {cam:{type:'camera'},light:{type:'light'},mesh:{type:'primitive'},event:{type:'event'}}
  const owner = selectionOwner(store,objects)
  const nodes = new Map([['cam',node('cam',{icon:true})],['light',node('light',{icon:true})],
    ['mesh',node('mesh',{zones:true})],['event',node('event',{eventGem:true})]])
  nodes.get('cam').userData.visual = { visible:true }
  const colliders = []
  const ctx = {...owner, nodes, edit:null, _colliderSync:(n,selected,enabled)=>colliders.push([n.userData.id,selected,enabled])}
  ctx._refreshNodeGizmos()
  assert.equal(nodes.get('cam').userData.visual.visible,true)
  store.prefs.gizmoCategories.cameras = false
  ctx._refreshNodeGizmos()
  assert.equal(nodes.get('cam').userData.visual.visible,false)
  assert.equal(nodes.get('cam').userData.editorGizmos[0].visible,false)
  assert.equal(nodes.get('light').userData.editorGizmos[0].visible,true)
  store.prefs.gizmoCategories.colliders = false
  ctx._refreshNodeGizmos()
  assert.equal(colliders.at(-2)[2],false, 'no crea colisiones si su categoría está oculta')
  assert.equal(nodes.get('mesh').userData.editorGizmos[0].visible,true, 'mantiene otras ayudas de una malla')
  store.prefs.showGizmos = false
  ctx._refreshNodeGizmos()
  assert.equal(nodes.get('event').userData.gem.visible,false)
  assert.equal(nodes.get('mesh').userData.indicatorZonesGizmo.visible,false)
  store.prefs.showGizmos = true
  store.prefs.gizmoCategories.cameras = true
  ctx._refreshNodeGizmos()
  assert.equal(nodes.get('cam').userData.visual.visible,true)
  assert.match(selection, /this\._colliderSync\?\.\(node, active, editing && gizmosEnabled\(store\.prefs, 'colliders'\)\)/)
  assert.doesNotMatch(selection.split('_syncNodeGizmos(node, selected)')[1].split('_refreshNodeGizmos')[0], /_updateGizmoMode|_detachAll\(/)
})

test('UX-08 · preferencias repintan por el watcher existente del Editor', () => {
  assert.match(watchers, /watch\(\(\) => \[store\.prefs\.showGizmos, \.\.\.GIZMO_CATEGORIES/)
  assert.match(watchers, /this\._refreshNodeGizmos\(\)/)
  assert.match(watchers, /this\.vp\.requestRender\(\)/)
  assert.match(editor, /_applyViewToNode\(node\) \{\s*super\._applyViewToNode\(node\)\s*this\._syncNodeGizmos/)
})

test('UX-09 · el estado es local, persistente y se restablece en Preferencias', () => {
  assert.match(state,/showGizmos: true/)
  assert.match(state,/gizmoCategories: \{\}/)
  assert.match(state,/localStorage\.setItem\(PREFS_KEY, JSON\.stringify\(p\)\)/)
  const preferences = read('src/components/PreferencesModal.vue')
  assert.match(preferences,/const defaults = defaultPrefs\(\)/)
  assert.match(preferences,/\['showGizmos',/)
  assert.match(preferences,/concat\('gizmoCategories'\)/)
  assert.match(preferences,/keys\.forEach\(resetOne\)/)
  assert.match(selection, /obj\?\.type === 'camera' && u\.visual/)
})

test('UX-10 · el gizmo del Runtime y Play permanecen independientes', () => {
  assert.match(selection,/if \(u\.editorOnlyVisual && \['light', 'audio'\]\.includes/)
  assert.match(selection,/const editing = !store\.play\.on && !this\.edit/)
  assert.match(view,/store\.play\.on \|\| store\.gameView\.on \? 'game' : 'scene'/)
})
