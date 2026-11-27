import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { nodeEffectiveActive } from '../src/engine/runtime/nodes/hierarchy.js'

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const projectSource = read('src/core/project.js')
const stateSource = read('src/core/state/project.js')
const uiSource = read('src/components/ScenePanel.vue')
const packageSource = read('src/engine/runtime/package/format.js')
const resolverCode = projectSource.slice(projectSource.indexOf('export function resolveScenePlayerNode('), projectSource.indexOf('/** Separa un proyecto en memoria'))
  .replace('export function ', 'function ')
const resolveScenePlayerNode = new Function('nodeEffectiveActive', `${resolverCode}\nreturn resolveScenePlayerNode`)(nodeEffectiveActive)
const nodes = [
  { id: 'prefab-root', name: 'Prefab FPS', type: 'node3d', parentId: null, active: true },
  { id: 'body-a', name: 'Personaje A', type: 'characterbody3d', parentId: 'prefab-root', active: true },
  { id: 'body-b', name: 'Personaje B', type: 'characterbody3d', parentId: null, active: true },
  { id: 'camera-a', name: 'Vista', type: 'camera', parentId: 'body-a', active: true },
]
const scene = playerNodeId => ({ id: 'scene-a', playerNodeId })
const getSetter = (project, extra = {}) => {
  const state = { project, locked: false, play: { on: false }, filmMode: false, ...extra }
  const commits = []
  const activeScene = () => project.scenes.find(s => s.id === project.activeSceneId)
  const source = stateSource.slice(stateSource.indexOf('export function assignScenePlayerNode('), stateSource.indexOf('export function assignScenePlayerSpawnMode('))
    .replace('export function ', 'function ')
  const assign = new Function('store','activeScene','resolveScenePlayerNode','commit', `${source}\nreturn assignScenePlayerNode`)(state,activeScene,resolveScenePlayerNode,label=>commits.push(label))
  return { assign, commits, store: state }
}

test('IDENT-01 · sin identidad explícita no elige un CharacterBody3D automáticamente', () => {
  assert.equal(resolveScenePlayerNode({ id: 's' }, nodes).status, 'unassigned')
  assert.equal(resolveScenePlayerNode({ id: 's', playerNodeId: '' }, nodes).status, 'unassigned')
})
test('IDENT-02 · asigna un cuerpo hijo de Prefab usando su ID real', () => {
  const result = resolveScenePlayerNode(scene('body-a'), nodes)
  assert.equal(result.status, 'valid')
  assert.strictEqual(result.node, nodes[1])
})
test('IDENT-03 · dos cuerpos no generan elección automática ni ambigüedad', () => {
  assert.equal(resolveScenePlayerNode(scene('body-b'), nodes).node.id, 'body-b')
  assert.equal(resolveScenePlayerNode(scene('body-a'), nodes).node.id, 'body-a')
})
test('IDENT-04 · duplicar Prefab no cambia la identidad elegida', () => {
  const copied = [...nodes, { ...nodes[1], id:'body-copy', parentId:'prefab-copy' }, { ...nodes[0], id:'prefab-copy' }]
  assert.equal(resolveScenePlayerNode(scene('body-a'),copied).node.id,'body-a')
})
test('IDENT-05 · actualización de Prefab con IDs nuevos deja referencia rota visible, sin redirigir', () => {
  const updated = nodes.map(n=>n.id==='body-a'?{...n,id:'body-new'}:n)
  assert.deepEqual(resolveScenePlayerNode(scene('body-a'),updated),{status:'missing',id:'body-a',node:null})
})
test('IDENT-06 · cuerpo inactivo no es elegible, tampoco si el padre está inactivo', () => {
  assert.equal(resolveScenePlayerNode(scene('body-a'), nodes.map(n=>n.id==='body-a'?{...n,active:false}:n)).status,'inactive')
  assert.equal(resolveScenePlayerNode(scene('body-a'), nodes.map(n=>n.id==='prefab-root'?{...n,active:false}:n)).status,'inactive')
})
test('IDENT-07 · ID asociado a un nodo no físico se informa como tipo incorrecto', () => {
  assert.equal(resolveScenePlayerNode(scene('camera-a'),nodes).status,'wrong-type')
})
test('IDENT-08 · ID duplicado no se resuelve arbitrariamente', () => {
  assert.equal(resolveScenePlayerNode(scene('body-a'), [...nodes, { ...nodes[1] }]).status,'ambiguous')
})
test('IDENT-09 · setter valida antes del commit y nunca elige por selección', () => {
  const project = {activeSceneId:'scene-a', scenes:[scene('')], objects:nodes}
  const {assign, commits} = getSetter(project)
  assert.equal(assign('camera-a'),false)
  assert.equal(assign('missing'),false)
  assert.equal(assign('body-a'),true)
  assert.equal(project.scenes[0].playerNodeId,'body-a')
  assert.equal(assign('body-a'),true)
  assert.equal(commits.length,1)
  assert.equal(assign(''),true)
  assert.equal(project.scenes[0].playerNodeId,'')
  assert.equal(commits.length,2)
})
test('IDENT-10 · identidad pertenece a la escena activa, nunca al GameManager compartido', () => {
  const p={activeSceneId:'scene-a', scenes:[scene(''), {id:'scene-b',playerNodeId:'body-b'}],objects:nodes,gameManagers:[{id:'gm',player:'fps'}]}
  const {assign}=getSetter(p)
  assert.equal(assign('body-a'),true)
  assert.equal(p.scenes[1].playerNodeId,'body-b')
  assert.deepEqual(p.gameManagers,[{id:'gm',player:'fps'}])
})
test('IDENT-11 · no cambia identidad durante Play ni con proyecto bloqueado o FilmMaker', () => {
  for(const extra of [{play:{on:true}},{locked:true},{filmMode:true}]) {
    const p={activeSceneId:'scene-a',scenes:[scene('')],objects:nodes}
    const {assign,commits}=getSetter(p,extra)
    assert.equal(assign('body-a'),false)
    assert.equal(commits.length,0)
  }
})
test('IDENT-12 · duplicación de escena conserva referencia local, sin compartir estado de escena', () => {
  assert.match(stateSource, /\.\.\.\(src\.playerNodeId \? \{ playerNodeId: src\.playerNodeId \} : \{\}\)/)
  const original=scene('body-a'), copy={...original,id:'copy'}
  copy.playerNodeId='body-b'
  assert.equal(original.playerNodeId,'body-a')
})
test('IDENT-13 · la UI usa el registro de escena, no la selección del Inspector', () => {
  assert.match(uiSource, /activeScene\(\)\?\.playerNodeId/)
  assert.match(uiSource, /assignScenePlayerNode\(\$event\.target\.value\)/)
  assert.match(uiSource, /role="status"/)
  assert.doesNotMatch(uiSource.slice(uiSource.indexOf('const playerStatus'),uiSource.indexOf('const transitions')), /selectedId/)
})
test('IDENT-14 · la identidad viaja al paquete sin alterar el controlador de Play', () => {
  assert.match(packageSource,/source\?\.playerNodeId \? \{ playerNodeId: source\.playerNodeId \}/)
  assert.doesNotMatch(stateSource.slice(stateSource.indexOf('export function assignScenePlayerNode'),stateSource.indexOf('export function assignScenePlayerSpawnMode(')), /createPlayer|game\.player|FpsPlayer/)
})
test('IDENT-15 · escenas heredadas sin campo preservan su formato y no requieren migración', () => {
  assert.doesNotMatch(projectSource.slice(projectSource.indexOf('export function ensureFs(')),/playerNodeId\s*=/)
  assert.equal(resolveScenePlayerNode({id:'legacy'},nodes).status,'unassigned')
})
