// G008: cobertura de contrato, creación de proyecto, consumidores y compatibilidad de datos.
// La ejecución física de Jolt y la visualización Electron/NGM quedan para QA local.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { getTemplate } from '../src/core/templates/index.js'
import { sceneGameConfig } from '../src/engine/runtime/game-manager.js'
import { shiftANodeCatalog } from '../src/core/add-menu-catalog.js'

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const playSource = source('src/engine/runtime/events/play.js')
const decisionCode = playSource.slice(playSource.indexOf('  _scenePlayerDecision() {'), playSource.indexOf('  // Una sola resolución por escena:'))
const resolveScenePlayerNode = (scene, objects) => {
  if (!scene?.playerNodeId) return {status:'unassigned',id:null}
  const obj=objects.find(o=>o.id===scene.playerNodeId)
  return obj?.type==='characterbody3d' ? {status:'valid',id:obj.id}
    : {status:obj?'wrong-type':'missing',id:scene.playerNodeId}
}
const decision = new Function('resolveScenePlayerNode',`return ({${decisionCode.replace('\n  _scenePlayerSelect()',',\n  _scenePlayerSelect()')}})`)(resolveScenePlayerNode)
function rig(scene={id:'s'},objects=[],player='native',film=null){
  return Object.assign(Object.create(decision),{g:{player},film,project:{scenes:[scene],activeSceneId:'s',objects}})
}
const defPlayer={id:'player',type:'characterbody3d',active:true}
const legacyMarker={id:'old-spawn',type:'spawn',name:'Spawn',active:true,props:{tag:'player'},parentId:null}
const sun={id:'sun',type:'light',active:true,name:'Sol'}

// Contrato G008 y plantilla sin spawn implícito.
test('G008-01: First Person mantiene el recurso Prefab nativo y no crea Spawn',()=>{
  const tpl=getTemplate('empty')
  assert.ok(tpl.createResources)
  assert.deepEqual(tpl.scene.map(o=>o[0]),['light'])
  assert.equal(tpl.game.player,'native')
})
test('G008-02: Empty conserva una escena sin personaje',()=>{
  const tpl=getTemplate('empty-project');assert.equal(tpl.game.player,'none');assert.deepEqual(tpl.scene,[])
})
test('G008-03: Vacío clásico no recibe jugador ni Spawn',()=>{
  const tpl=getTemplate('blank');assert.equal(tpl.game.player,'none');assert.equal(tpl.scene.some(s=>s[0]==='spawn'),false)
})
test('G008-04: sin playerNodeId no se activa FPS implícito ni con GameManager antiguo',()=>{
  for(const g of ['native','fps']) assert.deepEqual(rig({id:'s'},[legacyMarker],g)._scenePlayerDecision(),{kind:'none',id:null})
})
test('G008-05: nodo Spawn histórico no reemplaza la identidad del jugador',()=>{
  assert.deepEqual(rig({id:'s'},[legacyMarker])._scenePlayerDecision(),{kind:'none',id:null})
})
test('G008-06: CharacterBody3D asignado sigue siendo jugador nativo',()=>{
  assert.deepEqual(rig({id:'s',playerNodeId:'player'},[defPlayer])._scenePlayerDecision(),{kind:'native',id:'player'})
})
test('G008-07: referencia rota no provoca fallback',()=>{
  assert.equal(rig({id:'s',playerNodeId:'ausente'},[legacyMarker])._scenePlayerDecision().kind,'invalid')
})
test('G008-08: GameManager Sin jugador impide usar el CharacterBody3D asignado',()=>{
  assert.deepEqual(rig({id:'s',playerNodeId:'player'},[defPlayer],'none')._scenePlayerDecision(),
    {kind:'disabled',id:'player',reason:'game-manager-none'})
})
test('G008-09: aparición por API continúa habilitada solo con GameManager de gameplay',()=>{
  assert.deepEqual(rig({id:'s',playerSpawnMode:'api'})._scenePlayerDecision(),{kind:'deferred',id:null})
  assert.equal(rig({id:'s',playerSpawnMode:'api'},[],'none')._scenePlayerDecision().kind,'invalid')
})
test('G008-10: FilmMaker no activa jugador',()=>{
  assert.equal(rig({id:'s',playerNodeId:'player'},[defPlayer],'native',{})._scenePlayerDecision().kind,'disabled')
  assert.equal(rig({id:'s',playerSpawnMode:'api'},[],'native',{})._scenePlayerDecision().kind,'disabled')
})
test('G008-11: modo de aparición desconocido no reabre fallback',()=>{
  assert.equal(rig({id:'s',playerSpawnMode:'legacy'},[legacyMarker])._scenePlayerDecision().kind,'invalid')
})
test('G008-12: GameManager histórico conserva sus datos, sin exigir migración',()=>{
  const project={activeSceneId:'s',scenes:[{id:'s'}],game:{player:'fps'},objects:[]}
  const {config}=sceneGameConfig(project)
  assert.equal(config.player,'fps')
  assert.equal(rig(project.scenes[0],[],config.player)._scenePlayerDecision().kind,'none')
})
test('G008-13: Spawn se conserva como tipo registrado, pero no es creable',()=>{
  const text=source('src/engine/runtime/nodes/spawn.js')
  assert.match(text,/type: 'spawn'/)
  assert.match(text,/creatable: false/)
  const catalog=shiftANodeCatalog([
    {type:'spawn',label:'Spawn',category:'Gameplay',creatable:false},
    {type:'characterbody3d',label:'CharacterBody3D',category:'Física'},
  ])
  assert.equal(catalog.some(c=>c.type==='spawn'),false)
  assert.equal(catalog.some(c=>c.type==='characterbody3d'),true)
})
test('G008-14: ningún módulo de FpsPlayer permanece dentro del runtime',()=>{
  assert.equal(existsSync(new URL('../src/engine/runtime/player/fps/',import.meta.url)),false)
  assert.doesNotMatch(source('src/engine/runtime/player/index.js'),/import.*FpsPlayer|\bfps\/index\.js\b/)
  assert.doesNotMatch(playSource,/new FpsPlayer\(|createPlayer\('fps'/)
})
test('G008-15: manos y stash se conservan en el propietario común',()=>{
  for(const f of ['hands.js','hands-stash.js','hands-throw.js','hands-util.js'])
    assert.equal(existsSync(new URL(`../src/engine/runtime/player/viewmodel/${f}`,import.meta.url)),true)
  assert.match(source('src/engine/runtime/player/controller.js'),/\.\/viewmodel\/hands\.js/)
})
test('G008-16: el tipo de jugador inerte no crea un nuevo controlador paralelo',()=>{
  const js=source('src/engine/runtime/player/index.js')
  assert.match(js,/export function createPlayer\(id, play\) \{ void id; return new NoPlayer\(play\) \}/)
  assert.match(playSource,/createPlayer\('none', this\)/)
})
test('G008-17: rutas al jugador requieren identidad CharacterBody3D',()=>{
  const js=source('src/engine/runtime/events/play-route.js')
  const methods=new Function(`return (${js.slice(js.indexOf('export const routeMethods =')+'export const routeMethods ='.length)})`)()
  assert.throws(()=>methods._routeActor.call({_nativePlayerId:null},'player'),/no existe CharacterBody3D/)
  const obj={_nativePlayerId:'player',pos:{x:2},yaw:0}
  const handle=methods._routeActor.call(obj,'player')
  assert.equal(handle.id,'player');assert.equal(handle.player,true);assert.equal(handle.pos().x,2)
})
test('G008-18: teletransporte sin jugador falla antes de alterar la escena',()=>{
  const js=source('src/engine/runtime/events/play-nodes.js')
  const snippet=js.slice(js.indexOf('  _teleport({'),js.indexOf('\n  async _gotoScene(',js.indexOf('  _teleport({')))
  const fn=new Function('DEG','THREE',`return ({${snippet}})._teleport`)(Math.PI/180,{})
  assert.throws(()=>fn.call({_nativePlayerId:null},{mode:'pos',pos:[3,4,5]}),/no existe un jugador nativo/)
})
test('G008-19: marcador Spawn histórico sigue siendo legible para la llegada',()=>{
  const js=source('src/engine/runtime/events/play-level.js')
  const methods=new Function(`return (${js.slice(js.indexOf('export const levelMethods =')+'export const levelMethods ='.length)})`)()
  const nodes=new Map([[legacyMarker.id,{userData:{}}],[sun.id,{userData:{}}]])
  const ctx={project:{objects:[sun,legacyMarker]},_nodeEnabled:()=>true,ed:{nodes}}
  assert.equal(methods._spawnFor.call(ctx,'player'),legacyMarker)
  assert.equal(methods._spawnFor.call(ctx,'Sol'),sun)
  nodes.get(legacyMarker.id).userData.timelineSpawnTag='puerta'
  assert.equal(methods._spawnFor.call(ctx,'puerta'),legacyMarker)
})
test('G008-20: marcador desactivado o ausente no se utiliza',()=>{
  const js=source('src/engine/runtime/events/play-level.js')
  const methods=new Function(`return (${js.slice(js.indexOf('export const levelMethods =')+'export const levelMethods ='.length)})`)()
  const ctx={project:{objects:[{...legacyMarker,active:false}]},_nodeEnabled:o=>o.active!==false,ed:{nodes:new Map([[legacyMarker.id,{}]])}}
  assert.equal(methods._spawnFor.call(ctx,'player'),null)
})
test('G008-21: Inspector y menús no ofrecen crear Spawn, pero conservan compatibilidad visual',()=>{
  assert.match(source('src/core/commands.js'),/creatable === false/)
  assert.match(source('src/components/ScenePanel.vue'),/playerSpawnMode/)
  assert.match(source('src/core/templates/index.js'),/Prefab Personaje FPS/)
})
test('G008-22: Spawn Player por API permanece exportado al host y a scripts',()=>{
  assert.match(source('src/engine/runtime/events/play-host.js'),/spawnPlayer: alive/)
  assert.match(source('src/engine/runtime/events/interpreter.js'),/spawnPlayer: \(prefab, options/)
  assert.match(source('src/core/events/game-api.d.ts'),/spawnPlayer\(/)
})
test('G008-23: el guardado ya no genera un snapshot legacy automático',()=>{
  const js=source('src/engine/runtime/events/play-saves.js')
  assert.match(js,/return \{ mode: 'none' \}/)
  assert.match(js,/mode === 'legacy'/) // partida histórica: lectura sin reactivar FPS
})
test('G008-24: exportación y Vista del Editor validan CharacterBody3D, no Spawn',()=>{
  assert.match(source('src/components/ExportModal.vue'),/playerNodeId|CharacterBody3D|characterbody3d/)
  assert.match(source('src/core/state/game.js'),/playerNodeId|CharacterBody3D|characterbody3d/)
})
test('G008-25: tipos de API de Editor y VS Code siguen idénticos',()=>{
  assert.equal(source('src/core/events/game-api.d.ts'),source('vscode-extension/media/game-api.d.ts'))
})
test('G008-26: el Input Map del mando orienta el jugador nativo, no otro Player',()=>{
  const js=source('src/engine/runtime/events/play-input.js')
  assert.match(js,/this\._nativePlayerId/)
  assert.match(js,/this\._nativePitchCamera\(\)/)
  assert.doesNotMatch(js,/this\.player\.turn\(/)
})
