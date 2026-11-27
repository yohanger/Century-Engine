// LF-NODE-SCRIPT-S05-G001_CORR-001: creación, asociación, arrastre y plantillas.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { draggedScriptId, nodeScriptFromDrop, hasAssetEntry } from '../src/core/editor/script-drop.js'

const read = (file) => readFileSync(new URL('../'+file, import.meta.url),'utf8')
const database = read('src/core/state/database.js')
const assets = read('src/components/ProjectPanel.vue')
const inspector = read('src/components/Inspector.vue')
const tree = read('src/components/SceneTree.vue')
const commands = read('src/core/commands.js')
const state = read('src/core/state/state.js')
const transfer = (entries) => ({
  types: ['application/x-lf-entry','application/x-lf-entries'],
  getData(type) { return type === 'application/x-lf-entries' ? JSON.stringify(entries) : JSON.stringify(entries[0]) },
})

function template(name) {
  const match = database.match(new RegExp('export const '+name+' = `([\\s\\S]*?)`'))
  assert.ok(match, name)
  return match[1]
}

test('CORR-01 · Script Global: plantilla limpia y solo callbacks principales', () => {
  const code = template('SCRIPT_TEMPLATE')
  assert.deepEqual([...code.matchAll(/game\.on\('([^']+)'/g)].map((x)=>x[1]), ['start','update','fixedUpdate'])
  assert.doesNotMatch(code, /game\.define|game\.say|console\.log|ejemplo/)
  const called = []
  vm.runInNewContext(code, {game:{on:(name,cb)=>{called.push(name);assert.equal(typeof cb,'function')}}})
  assert.deepEqual(called,['start','update','fixedUpdate'])
})
test('CORR-02 · Script Nodo: callbacks vacíos con sintaxis válida', () => {
  const code=template('NODE_SCRIPT_TEMPLATE')
  for(const fn of ['_ready','_process','_physics_process']) assert.match(code,new RegExp(`function ${fn}\\(`))
  assert.doesNotMatch(code,/console\.log|game\.say|Actualización/)
  assert.doesNotThrow(()=>new vm.Script(code))
})
test('CORR-03 · Assets crea el script y después activa renombrado, nunca editor', () => {
  const body=assets.slice(assets.indexOf('async function newScript'), assets.indexOf('// La paleta de comandos'))
  assert.match(body,/createScript\(parent/)
  assert.match(body,/startRename\(/)
  assert.doesNotMatch(body,/openInVSCode/)
  assert.match(assets,/Script de Nodo \(\.js\)/)
  assert.match(assets,/Script Global \(\.js\)/)
  assert.match(assets,/@dblclick\.stop="dblOpen\(it\)"/)
})
test('CORR-04 · comando de creación muestra Assets y solicita nombre', () => {
  const body=commands.slice(commands.indexOf("add('game.script'"),commands.indexOf('  // --- Ver ---'))
  assert.match(body,/createScript/)
  assert.match(body,/scriptRenameId = s.id/)
  assert.match(body,/bottomTab = 'project'/)
  assert.doesNotMatch(body,/openInVSCode/)
  assert.match(state,/scriptRenameId: null/)
  assert.match(assets,/watch\(\(\) => store\.scriptRenameId/)
})
test('CORR-05 · Inspector no crea recursos y asocia vía selector', () => {
  assert.doesNotMatch(inspector,/createNodeScript|createScript\(/)
  assert.match(inspector,/Agregar script/)
  assert.match(inspector,/Quitar script/)
  assert.match(inspector,/nodeScriptOptions/)
  assert.match(inspector,/@change="assignSelectedScript\(\$event\.target\.value\)"/)
  assert.match(inspector,/openInVSCode\(id\)/)
})
test('CORR-06 · arrastre de un Script de Nodo usa el formato de Assets', () => {
  const dt=transfer([{kind:'script',id:'s1'}]);
  assert.equal(hasAssetEntry(dt),true)
  assert.equal(draggedScriptId(dt),'s1')
  assert.equal(nodeScriptFromDrop(dt,[{id:'s1',execution:'node'}])?.id,'s1')
  assert.match(inspector,/@drop="onScriptDrop"/)
  assert.match(tree,/nodeScriptFromDrop\(e\.dataTransfer/)
})
test('CORR-07 · rechaza arrastres múltiples, falsos y corruptos', () => {
  assert.equal(draggedScriptId(transfer([{kind:'script',id:'a'},{kind:'script',id:'b'}])),null)
  assert.equal(draggedScriptId(transfer([{kind:'material',id:'m'}])),null)
  assert.equal(draggedScriptId({getData:()=>'{malformed'}),null)
  assert.equal(draggedScriptId({getData:()=>''}),null)
})
test('CORR-08 · Script Global no se puede vincular a un nodo', () => {
  assert.match(inspector,/script\.execution !== 'node'/)
  assert.match(tree,/script\.execution !== 'node'/)
  assert.match(inspector,/addNodeScript\(obj\.value\.id, script\.id\)/)
  assert.match(tree,/addNodeScript\(row\.o\.id, script\.id\)/)
})
test('CORR-09 · la creación respeta ID, nombre y modalidad sin ejecución prematura', () => {
  assert.match(database,/uniqueFileName\(p, dest, name\)/)
  assert.match(database,/execution === 'node' \? NODE_SCRIPT_TEMPLATE : SCRIPT_TEMPLATE/)
  assert.match(database,/commit\('Nuevo script'\)/)
})
test('CORR-10 · el portal y el manual explican el flujo actualizado', () => {
  const manual=read('docs/web-src/scripts-nodo.md')
  assert.match(manual,/arrastrarlos desde Assets/)
  assert.match(manual,/doble clic.*VS Code/)
  assert.match(read('docs/web-src/inspector.md'),/La creación y el renombrado/)
  assert.match(read('docs/web-src/scripts.md'),/activa su \*\*renombrado\*\*/)
})
test('CORR-11 · no se modifican ciclo de vida ni Event Order Flow', () => {
  assert.match(read('src/engine/runtime/scene/node-scripts.js'), /_physics_process/)
  assert.match(read('src/engine/runtime/events/play-controls.js'), /_simStep/)
})
