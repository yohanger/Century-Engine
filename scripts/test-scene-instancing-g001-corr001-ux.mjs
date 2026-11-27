// LF-SCENE-INSTANCING-G001-CORR-001: UX contractual y controlador real, sin Electron.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const tree = read('src/components/SceneTree.vue')
const picker = read('src/components/SceneInstancePicker.vue')
const commands = read('src/core/commands.js')
const project = read('src/components/ProjectPanel.vue')
const assets = read('src/core/editor/asset-drop.js')
const doc = read('docs/web-src/escenas.md')
const app = read('src/App.vue')

function pickerController(scenes, activeSceneId) {
  const script = picker.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  const clean = script.replace(/^import[^\n]+\n/gm, '')
  const events = []
  const props = { scenes, activeSceneId, parentName: '', busy: false }
  const ref = value => ({ value })
  const computed = fn => ({ get value() { return fn() } })
  const watch = (_, fn, opt) => { if (opt?.immediate) fn(_.value) }
  const ctx = { ref, computed, watch, props, events, nextTick: () => {},
    defineProps: () => props, defineEmits: () => (...args) => events.push(args), onMounted: () => {} }
  vm.runInNewContext(`${clean}\n;this.api = { search, chosen, candidates, selected, confirm, keydown }`, ctx)
  return { ...ctx.api, events, props }
}

function treeActions() {
  const start = commands.indexOf('/** Una escena vinculada')
  const end = commands.indexOf('/** CollisionShape3D', start)
  assert.ok(start > 0 && end > start)
  const panel = { projectId: 'p1', activeSceneId: 'mundo' }
  const store = { project: { id: panel.projectId, activeSceneId: panel.activeSceneId, scenes: [
    { id:'mundo', name:'Mundo' }, { id:'casa', name:'Casa' } ] },
    editor: { edit: false }, play: { on: false }, filmMode: false, locked: false,
    gameView: {on:false}, modal:null, palette:false, addModal:null, menu:{}, sceneInstanceTarget:null }
  const obj = { id:'n1', name:'Node3D', type:'node3d', locked:false }
  const notices = []
  const ctx = {
    store, getObject: id => id === obj.id ? obj : null,
    toast: msg => notices.push(msg),
  }
  const code = commands.slice(start,end).replaceAll('export function', 'function')
  vm.runInNewContext(`${code}\n;this.api = { openSceneInstancePicker, canParentSceneInstance }`,ctx)
  return { ...ctx, ...ctx.api, notices, obj }
}

test('CORR001-01 · jerarquía separa Añadir nodo de Instanciar escena', () => {
  assert.match(tree, /data-testid="scene-tree-add-node"[\s\S]*?@click="openAdd"/)
  assert.match(tree, /data-testid="scene-tree-instance-scene"[\s\S]*?@click="openInstancePicker\(\)"/)
  assert.match(app, /<SceneInstancePicker v-if="store.modal === 'sceneInstance'/)
  assert.doesNotMatch(tree, /<SceneInstancePicker v-if=/)
  assert.doesNotMatch(commands, /function sceneInstanceItems\(/)
  assert.doesNotMatch(commands, /const scenes = sceneInstanceItems/)
})

test('CORR001-02 · selector muestra escenas existentes excepto la activa, ordenadas y buscables', () => {
  const p = pickerController([
    { id:'mundo', name:'Mundo', folder:'Assets/Scenes' },
    { id:'sol', name:'Sol', folder:'Assets/Scenes/Cielo' },
    { id:'casa', name:'Casa', folder:'Assets/Scenes/Casas' },
  ], 'mundo')
  assert.deepEqual(Array.from(p.candidates.value, x=>x.id), ['casa','sol'])
  assert.equal(p.chosen.value, 'casa')
  p.search.value='cielo'
  assert.deepEqual(Array.from(p.candidates.value, x=>x.id), ['sol'])
  p.chosen.value='sol'
  p.confirm()
  assert.deepEqual(p.events[0], ['choose','sol'])
  p.props.busy=true
  p.confirm()
  assert.equal(p.events.length,1)
})

test('CORR001-03 · el selector admite flechas, Enter y bloqueo mientras instancia', () => {
  const p = pickerController([{id:'b',name:'B'}, {id:'a',name:'A'}], 'mundo')
  const ev=()=>({key:'ArrowDown',preventDefault(){}})
  p.keydown(ev())
  assert.equal(p.chosen.value,'b')
  p.keydown({key:'Enter',preventDefault(){}})
  assert.deepEqual(p.events.at(-1),['choose','b'])
  assert.match(picker,/role="listbox"/)
  assert.match(picker,/aria-label="Buscar escena por nombre o carpeta"/)
  assert.match(picker,/data-testid="scene-instance-confirm"/)
})

test('CORR001-04 · botón crea en raíz; contexto crea dentro de padre editable', () => {
  const c=treeActions()
  assert.match(tree,/function openInstancePicker\(parentId = null\) \{ return openSceneInstancePicker\(parentId\) \}/)
  c.openSceneInstancePicker()
  assert.equal(c.store.sceneInstanceTarget.parentId,null)
  assert.equal(c.store.sceneInstanceTarget.sceneId,'mundo')
  assert.equal(c.store.modal, 'sceneInstance')
  c.store.modal=null; c.store.sceneInstanceTarget=null
  c.openSceneInstancePicker('n1')
  assert.equal(c.store.sceneInstanceTarget.parentName,'Node3D')
  assert.equal(c.store.sceneInstanceTarget.parentId,'n1')
  assert.match(app,/S\.instantiateScene\(sceneId, \{ parentId: request.parentId \}\)/)
  assert.match(tree,/Instanciar escena hija…/)
})

test('CORR001-05 · bloquea padres derivados, instancias, terreno y bloqueo editorial', () => {
  const c=treeActions()
  for(const bad of [{type:'sceneInstance'},{type:'terrain'},{type:'node3d',sceneInstanceOwner:'other'}])
    assert.equal(c.canParentSceneInstance(bad),false)
  c.obj.locked=true
  c.openSceneInstancePicker('n1')
  assert.equal(c.store.sceneInstanceTarget,null)
  assert.equal(c.notices.length,1)
  c.obj.locked=false
  c.store.play.on=true
  c.openSceneInstancePicker('n1')
  assert.equal(c.store.sceneInstanceTarget,null)
})

test('CORR001-06 · acceso a fuente en doble clic de instancia; mantiene hijos derivados', () => {
  assert.match(tree,/row\.o\.type === 'sceneInstance' \? openInstanceSource\(row\.o\)/)
  assert.match(tree,/row\.o\.sceneInstanceOwner \? openLinkedSource\(row\.o\)/)
  assert.match(tree,/v-if="row\.o\.sceneInstanceOwner \|\| row\.o\.type === 'sceneInstance'"/)
})

test('CORR001-07 · arrastre conserva contrato de Assets y no altera Prefabs ni scripts', () => {
  assert.match(tree,/resolveAssetDrop\(e\.dataTransfer, allEntries\(store\.project\), \{ kinds: \['scene'\] \}\)/)
  assert.match(tree,/if \(!canParentInstance\(row\.o\)\) return/)
  assert.match(tree,/nodeScriptFromDrop\(e\.dataTransfer/)
  assert.match(project,/Instanciar en la escena/)
  assert.match(assets,/export function resolveAssetDrop/)
  assert.match(doc,/separado de \*\*\+ Añadir nodo\*\*/)
})
