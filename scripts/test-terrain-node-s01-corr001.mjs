// LF-TERRAIN-NODE-S01-G001_CORR-001: nodo registrado, sin terreno fantasma, sin geometría duplicada.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const read = f => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
const scene = read('components/SceneTree.vue')
const project = read('core/project.js')
const terrain = read('core/state/terrain.js')
const commands = read('core/commands.js')
const registry = read('engine/runtime/nodes/terrain.js')
const nodeIndex = read('engine/runtime/nodes/index.js')

function migration() {
  // S07 incorporó validación de señales y migración Multiscript antes de migrar Terreno.
  // Usar los validadores reales evita un falso fallo por dependencias omitidas del harness S01.
  const signalCode = project.slice(project.indexOf('export function validateSignalConnections('), project.indexOf('/** Copia solo enlaces'))
  const scriptCode = project.slice(project.indexOf('export function migrateNodeScripts('), project.indexOf('export function migrateScene('))
  const code = signalCode + scriptCode + project.slice(project.indexOf('export function migrateScene('), project.indexOf('export function createSceneContent('))
  const source = code.replace(/^export /gm, '')
  let sequence = 0
  const context = vm.createContext({
    uid:()=>`t${++sequence}`, normalizeWorld:()=>({}),
    makeObject: (type,kind,extra)=>({type,kind,position:undefined,...extra}),
    migrateObjectGroups:()=>{},
  })
  vm.runInContext(`${source}\nglobalThis.migrate = migrateScene`,context)
  return context.migrate
}
const mk = (id,enabled=true)=>({id,name:'Terreno',enabled,visible:true,size:64,segments:128,heights:'data',splat:'paint',foliage:[]})

function contextOf(pieces) {
  const changes=[]
  const editor = {
    terrains: pieces, _activeId:pieces[0]?.id,
    get terrain(){return this.terrains.find(t=>t.id===this._activeId)||this.terrains[0]},
    syncObject(id){changes.push(`sync:${id}`)},removeObject(id){changes.push(`remove:${id}`)},
    setActivePiece(id){this._activeId=id}, afterPiecesChanged(){}, applyView(){},
  }
  const store = { editor, project:{terrain:{enabled:true},objects:[]},pieces:[],activePieceId:null,terrainSel:false,selectedId:null,sceneSel:false,prefs:{rightTab:'object'},tool:'select' }
  const ctx = vm.createContext({store,commit:(label,opt)=>changes.push([label,opt]),selectObject:id=>{store.selectedId=id}, filmBlocked:()=>null, toast:()=>null, hooks:{}, makeFoliageType:()=>({}),clone:x=>structuredClone(x)})
  const snippet = terrain.split('// ---------- vegetación ----------')[0].replace(/^import .*\n/gm,'').replace(/^export /gm,'')
  vm.runInContext(`${snippet}\nglobalThis.fn={syncPieces,terrainOn,addTerrain,removeTerrain,setPieceVisible,renamePiece,selectPiece}`,ctx)
  return {store,editor,changes,...ctx.fn}
}

test('TNC-01: tipo Terrain registrado en el sistema real de nodos, sin nueva malla',()=>{
  assert.match(nodeIndex,/import '\.\/terrain\.js'/)
  assert.match(registry,/registerNode\(\{/)
  assert.match(registry,/type: 'terrain', base: 'Node'/)
  assert.match(registry,/category: 'Naturaleza'/)
  assert.doesNotMatch(registry,/new THREE\.Mesh\(/)
})
test('TNC-02: Shift+A y comandos ordinarios crean pieza física, no un proxy sin Terrain',()=>{
  assert.match(commands,/spec\.type === 'terrain' \? \(terrainOn\(\) \? addTerrainPiece\(\) : addTerrain\(\)\)/)
  assert.match(commands,/def\.type === 'terrain' \? \(terrainOn\(\) \? addTerrainPiece\(\) : addTerrain\(\)\)/)
  assert.match(read('core/state/objects.js'),/if \(partial\?\.type === 'terrain'\)/)
})
test('TNC-03: SceneTree recorre solamente project.objects y no fabrica filas',()=>{
  assert.match(scene,/for \(const o of store\.project\.objects\)/)
  assert.doesNotMatch(scene,/terrainTreeNodes|terrainRows/)
  assert.match(scene,/const total = computed\(\(\) => store\.project\.objects\.length\)/)
})
test('TNC-04: migración activa crea nodo con mismo ID y conserva el dato físico',()=>{
  const m=migration(), d=mk('t42'); const sc={objects:[],terrain:d};m(sc)
  assert.equal(sc.objects.length,1);assert.equal(sc.objects[0].id,'t42')
  assert.equal(sc.objects[0].props.terrainId,'t42'); assert.equal(sc.terrain.heights,'data')
  m(sc);assert.equal(sc.objects.length,1)
})
test('TNC-05: terreno desactivado jamás crea nodo fantasma, pero conserva sus mapas',()=>{
  const m=migration(),d=mk('t1',false),sc={objects:[],terrain:d};m(sc)
  assert.equal(sc.objects.length,0);assert.equal(sc.terrain.heights,'data');assert.equal(sc.terrain.splat,'paint')
})
test('TNC-06: migración filtra proxies de terreno inactivos y huérfanos',()=>{
  const m=migration(),sc={objects:[{id:'orphan',type:'terrain'},{id:'t1',type:'terrain'}],terrain:mk('t1',false)};m(sc)
  assert.equal(sc.objects.length,0)
})
test('TNC-07: varias piezas activas son nodos distintos, sin geometría duplicada',()=>{
  const m=migration(),sc={objects:[],terrain:{...mk('t1'),extra:[mk('t2'),mk('t3',false)]}};m(sc)
  assert.deepEqual(Array.from(sc.objects,o=>o.id),['t1','t2']);assert.equal(sc.terrain.extra.length,2)
})
test('TNC-08: identificador antiguo ausente se estabiliza en el terreno y nodo',()=>{
  const m=migration(),d=mk(undefined),sc={objects:[],terrain:d};m(sc)
  assert.ok(d.id);assert.equal(sc.objects[0].id,d.id)
})
test('TNC-09: sincronizar piezas no crea nodo fantasma si no están activas',()=>{
  const s=contextOf([mk('t1',false)]);s.store.project.terrain.enabled=false;s.syncPieces()
  assert.equal(s.store.project.objects.length,0);assert.equal(s.terrainOn(),false)
})
test('TNC-10: sincronizar el terreno activado crea un nodo de identidad única',()=>{
  const s=contextOf([mk('t1')]);s.syncPieces();s.syncPieces()
  assert.equal(s.store.project.objects.length,1);assert.equal(s.store.project.objects[0].id,'t1');assert.equal(s.changes.filter(c=>c==='sync:t1').length,1)
})
test('TNC-11: ocultar conserva colisiones y sincroniza visibilidad de nodo',()=>{
  const s=contextOf([mk('t1')]);s.syncPieces();s.setPieceVisible('t1',false)
  assert.equal(s.store.project.objects[0].visible,false);assert.equal(s.editor.terrains[0].enabled,true)
})
test('TNC-12: eliminar y reactivar no pierde alturas ni duplica nodos',()=>{
  const s=contextOf([{...mk('t1'),version:0,flat(){},resetPaint(){},foliage:{types:new Map()}}]);s.syncPieces()
  s.removeTerrain();assert.equal(s.store.project.objects.length,0)
  assert.equal(s.editor.terrains[0].heights,'data')
  // reactivación desde el comando de escena crea un nodo nuevo sobre la misma pieza.
  s.editor.terrains[0].enabled=true;s.syncPieces();assert.equal(s.store.project.objects.length,1)
})
test('TNC-13: renombrar Terrain actualiza nodo y guarda una transacción',()=>{
  const s=contextOf([mk('t1')]);s.syncPieces();s.renamePiece('t1','Bosque')
  assert.equal(s.store.project.objects[0].name,'Bosque');assert.equal(s.changes.filter(Array.isArray).length,1)
})
test('TNC-14: escenas nuevas pasan por la migración y cambio de escenas también',()=>{
  const p=read('core/state/project.js')
  assert.match(p,/db\.saveScene\(p\.id, scene\.id, migrateScene\(/)
  assert.match(p,/const r = migrateScene\(await db\.loadScene\(p\.id, id\)\)/)
  assert.match(p,/migrateScene\(sceneData\)/)
})
test('TNC-15: S04 conserva posición vertical sin reencuadre del resize',()=>{
  assert.match(read('engine/runtime/geometry/terrain.js'),/setOffset\(x, z, y = this.oy\)/)
  assert.doesNotMatch(registry,/scale:|position:|new THREE\.PlaneGeometry/)
  assert.doesNotMatch(read('components/TerrainPanel.vue'),/store\.editor\.frameAll\(\)/)
})
