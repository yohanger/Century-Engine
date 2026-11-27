// LF-TERRAIN-INSPECTOR-CONTEXT-S04A-G001 — selección real y propiedad contextual.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const read = p => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')
const selectSource = read('core/state/objects.js').split('export function selectObject(')[1].split('/** Selecciona la escena abierta')[0]
const terrainSource = read('core/state/terrain.js')
const terrainSnippet = terrainSource.slice(terrainSource.indexOf('export const terrainOn'), terrainSource.indexOf('export function removeTerrain()')).replace(/^export /gm,'')
const selectionSnippet = `function selectObject(${selectSource.replace(/^export /gm,'')}`
const dock = read('components/InspectorDock.vue'), inspector = read('components/Inspector.vue')
const panel = read('components/TerrainPanel.vue'), app = read('App.vue'), gizmo = read('core/editor/gizmo.js'), play = read('core/editor/play-session.js'), commands = read('core/commands.js')
const piece = (id,enabled=true) => ({id,name:id,ox:2,oy:3,oz:4,size:64,depth:32,segments:128,segmentsZ:64,step:.5,visible:true,enabled})
function fixture(pieces=[piece('t1'),piece('t2')]) {
 const actions=[]
 const ed={terrains:pieces,_activeId:pieces[0]?.id,
  get terrain(){return this.terrains.find(x=>x.id===this._activeId)||this.terrains[0]},
  setActivePiece(id){this._activeId=id;actions.push(['active',id])},
  setSelection(id,ids){actions.push(['selection',id,[...ids]])},
  _syncTerrainGizmo(){actions.push(['terrain-gizmo'])},
  syncObject(){},removeObject(){},
 }
 const store={editor:ed,project:{objects:[{id:'cube',name:'Cubo',type:'primitive'},...pieces.filter(x=>x.enabled).map(t=>({id:t.id,name:t.name,type:'terrain',scriptIds:['script1']}))],terrain:{enabled:true}},selectedId:null,selectedIds:[],sceneSel:false,terrainSel:false,activePieceId:ed._activeId,pieces:[],audioInspector:null,projSel:null,prefs:{rightTab:'object'},tool:'select'}
 const ctx=vm.createContext({store,getObject:id=>store.project.objects.find(o=>o.id===id),clone:x=>structuredClone(x),commit:()=>{},markDirty:()=>{},toast:()=>{},filmBlocked:()=>false,hooks:{},makeFoliageType:()=>({})})
 vm.runInContext(`${selectionSnippet}\n${terrainSnippet}\nglobalThis.api={selectObject,selectTerrain,selectPiece,syncPieces,terrainOn}`,ctx)
 return {store,ed,actions,api:ctx.api}
}
test('TER-INSP-01: seleccionar Terreno usa selectedId/selectedIds únicos',()=>{
 const {store,api}=fixture();api.selectTerrain();assert.equal(store.selectedId,'t1');assert.deepEqual(Array.from(store.selectedIds),['t1']);assert.equal(store.activePieceId,'t1');assert.equal(store.terrainSel,true)
})
test('TER-INSP-02: selecciona pieza distinta con su mismo nodo real',()=>{
 const {store,ed,api}=fixture();api.selectPiece('t2');assert.equal(store.selectedId,'t2');assert.equal(store.activePieceId,'t2');assert.equal(ed.terrain.id,'t2')
})
test('TER-INSP-03: al cambiar a otro tipo se desactiva el estado de terreno',()=>{
 const {store,api}=fixture();api.selectPiece('t2');api.selectObject('cube');assert.equal(store.terrainSel,false);assert.equal(store.selectedId,'cube');assert.equal(store.activePieceId,'t2')
})
test('TER-INSP-04: deselección deja escena y nodos sin selección fantasma',()=>{
 const {store,api}=fixture();api.selectTerrain();api.selectObject(null);assert.equal(store.selectedId,null);assert.equal(store.terrainSel,false);assert.equal(store.selectedIds.length,0)
})
test('TER-INSP-05: selección directa por ID del nodo sincroniza pieza física',()=>{
 const {store,ed,api}=fixture();api.selectObject('t2');assert.equal(ed.terrain.id,'t2');assert.equal(store.terrainSel,true)
})
test('TER-INSP-06: solo una pieza aislada activa el gizmo especial',()=>{
 const {store,api}=fixture();api.selectObject(null,{range:['t1','cube']});assert.equal(store.terrainSel,false);assert.equal(store.selectedId,'cube')
})
test('TER-INSP-07: selección usa gizmo terreno y no adjunta el gizmo normal al nodo espejo',()=>{
 const {api,actions}=fixture();api.selectTerrain();assert.ok(actions.some(x=>x[0]==='selection'&&x[1]===null));assert.ok(actions.some(x=>x[0]==='terrain-gizmo'))
})
test('TER-INSP-08: sin pieza activa real no se inventa selección',()=>{
 const {api,store}=fixture([piece('x',false)]);api.selectTerrain();assert.equal(store.selectedId,null);assert.equal(store.terrainSel,false)
})
test('TER-INSP-09: al quitar la pieza seleccionada se limpia su identidad',()=>{
 const {store,ed,api}=fixture();api.selectPiece('t2');ed.terrains[1].enabled=false;api.syncPieces();assert.equal(store.selectedId,null);assert.equal(store.terrainSel,false)
})
test('TER-INSP-10: syncPieces preserva datos de terreno y no crea geometrías duplicadas',()=>{
 const {store,ed,api}=fixture();const before=ed.terrains.map(x=>({...x}));api.syncPieces();assert.deepEqual(ed.terrains,before);assert.equal(store.project.objects.filter(x=>x.type==='terrain').length,2);assert.equal(store.pieces.length,2)
})
test('TER-INSP-11: preferencias antiguas migran a Inspector sin pestaña paralela',()=>{
 assert.doesNotMatch(dock,/\['terrain',\s*'Terreno'/);assert.match(dock,/tab === 'terrain'\) store\.prefs\.rightTab = 'object'/);assert.doesNotMatch(dock,/<TerrainPanel/)
})
test('TER-INSP-12: panel original se reutiliza una sola vez en Inspector del nodo Terrain',()=>{
 assert.match(inspector,/<TerrainPanel v-if="obj\.type === 'terrain'"/);assert.equal((inspector.match(/<TerrainPanel/g)||[]).length,1);assert.match(panel,/<section class="sect terrain-sect" data-fold-id="terrain-pieces">\s*<header>Piezas de terreno/)
})
test('TER-INSP-13: Inspector no escribe nombre y visibilidad de la pieza solo en el nodo espejo',()=>{
 assert.match(inspector,/setPieceVisible\(obj\.id, \$event\.target\.checked\)/);assert.match(inspector,/renamePiece\(obj\.id, terrainName\)/);assert.match(inspector,/v-if="obj\.type !== 'terrain'" class="field"><label>DontDestroyOnLoad/)
})
test('TER-INSP-14: acciones de Terreno y pincel abren Inspector, sin crear pieza de forma implícita',()=>{
 assert.match(app,/S\.terrainOn\(\)\) S\.selectTerrain\(\)/);assert.match(commands,/disabled: \(\) => !terrainOn\(\)/);assert.doesNotMatch(commands,/rightTab = 'terrain'/)
})
test('TER-INSP-15: restaurar Play/Stop preserva selección Terrain, incluso formato antiguo',()=>{
 assert.match(play,/store\.terrainSel = ids\.length === 1/);assert.match(play,/oldTerrainId = sel\?\.terrain/);assert.match(play,/this\.ed\.setActivePiece\(oldTerrainId\)/)
})
test('TER-INSP-16: Undo/Redo reconcilia la selección restaurada desde nodos, no estado paralelo',()=>{
 assert.match(gizmo,/const terrainSelected = store\.selectedIds\.length === 1/);assert.match(gizmo,/store\.terrainSel = !!terrainSelected/);assert.match(gizmo,/this\.setActivePiece\(store\.selectedId\)/);assert.match(gizmo,/this\._tcs\(\)\.some\(control => control\.object\)/);assert.match(gizmo,/this\.boxes\?\.length/)
})
test('TER-INSP-17: no se reescriben recursos de alturas, pintura, hidrología ni física',()=>{
 for(const segment of ['Capas de pintura','Agua física','Vegetación','Terrain Generator','Tamaño'])assert.ok(panel.includes(segment),segment)
})
test('TER-INSP-18: Signals recibe identidad normal de Terrain sin tener que consultar terrainSel',()=>{
 assert.match(read('components/SignalConnectionsPanel.vue'),/store\.selectedId/);assert.match(read('engine/runtime/nodes/terrain.js'),/type: 'terrain'/)
})
test('TER-INSP-19: el compilador Vue real valida componentes, cuando está instalado', async t=>{
 let compiler;try{compiler=await import('@vue/compiler-sfc')}catch{t.skip('Compilador Vue ausente; npm ci para verificar localmente');return}
 for(const name of ['InspectorDock','Inspector','TerrainPanel']){
  const text=read(`components/${name}.vue`);const parsed=compiler.parse(text,{filename:`${name}.vue`});assert.deepEqual(parsed.errors,[])
  const compiled=compiler.compileTemplate({id:`lf-${name}`,source:parsed.descriptor.template.content,filename:`${name}.vue`});assert.deepEqual(compiled.errors,[])
 }
})
