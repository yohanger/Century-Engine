import { setWorkspaceTreeOpen } from '../src/core/state/editor-workspace.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { validateNodeParent, validateNodeTree } from '../src/engine/runtime/nodes/hierarchy.js'
import { normalizeAddSearch } from '../src/components/add-menu-model.js'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const tree = read('src/core/state/tree.js').replace(/^import .*\n/gm, '').replace(/^export /gm, '')
const commands = read('src/core/commands.js')
const menu = read('src/components/MenuList.vue')
const node = (id, type = 'group', parentId = null, x = 0, extra = {}) => ({id, name:id, type, parentId, position:[x,0,0], rotation:[0,0,0], scale:[1,1,1], ...extra})
function setup() {
  const objects = [node('source','group',null,5),node('a','primitive','source',2),node('child','group','a',3),node('b','model',null,9),node('target','node3d',null,20),node('nested','group','target',4),node('logical','node'),node('locked','group',null,0,{locked:true}),node('lockedChild','group','locked'),node('light','light'),node('linked','sceneInstance'),node('linkedGroup','group','linked',0,{sceneInstanceOwner:'linked'}),node('terrain','terrain')]
  const commits=[],sync=[],toasts=[]
  const store={treeState:{open:{}},project:{id:'project',activeSceneId:'scene',objects},selectedIds:['a','b'],editor:{syncObject:id=>sync.push(id)},play:{on:false},gameView:{on:false},edit:{on:false}}
  const context=vm.createContext({store,setTreeNodeOpen:(node,open)=>setWorkspaceTreeOpen(store,node,open),toRaw:v=>v,validateNodeParent,validateNodeTree,shouldAlignMeshSubtractToParent:(o,_,p)=>o.type==='meshSubtract'&&p==='target',toast:(...v)=>toasts.push(v),commit:l=>commits.push(l),getDef:type=>({icon:type}),worldMatrixOf(get,id){let x=0;for(let o=get(id);o;o=get(o.parentId))x+=o.position?.[0]||0;const elements=Array(16).fill(0);elements[12]=x;return {elements}}})
  // El cálculo espacial real se prueba en Electron; aquí se inyecta solo la compensación de traslación.
  vm.runInContext(tree+`\nsetLocalFromWorld=(obj,parentId,world)=>{if(getObject(parentId)?.rejectTransform)throw Error('Transform incompatible');obj.position=[world.elements[12]-worldMatrix(parentId).elements[12],0,0]};\n${commands.slice(commands.indexOf('function moveToGroupMenu()'),commands.indexOf('/** Menú contextual de un nodo del árbol. */'))}\nglobalThis.api={collectionGroupTargets,moveToCollectionGroup,selectionRoots,reparent,moveToGroupMenu,worldMatrix}`,context)
  const get=id=>objects.find(o=>o.id===id)
  return {objects,store,commits,sync,toasts,get,api:context.api,targets:ids=>Array.from(context.api.collectionGroupTargets(ids),o=>o.id)}
}
test('solo Node, Node3D y Grupo vacío compatibles; excluye descendientes, bloqueos e instancias',()=>{const x=setup();assert.deepEqual(x.targets(['a','b']),['source','target','nested','logical'])})
test('no ofrece el padre actual cuando todos ya pertenecen a él',()=>{const x=setup();assert.ok(!x.targets(['a']).includes('source'))})
test('descarta selección sin raíces o ids inexistentes',()=>{const x=setup();assert.deepEqual(x.targets([]),[]);assert.deepEqual(x.targets(['missing']),[])})
test('excluye Terrain y nodos de escena vinculada como origen',()=>{const x=setup();for(const id of ['terrain','linkedGroup']) assert.deepEqual(x.targets([id]),[])})
test('rechaza origen bloqueado por su ancestro',()=>{const x=setup();x.get('source').locked=true;assert.deepEqual(x.targets(['a','b']),[])})
test('rechaza destino que es uno de los seleccionados',()=>{const x=setup();assert.ok(!x.targets(['source']).includes('source'));assert.ok(!x.targets(['source']).includes('child'))})
test('descarta padre e hijo duplicados en una selección explícita',()=>{const x=setup();assert.deepEqual(x.targets(['source','a']),[]);x.store.selectedIds=['source','a','b'];assert.deepEqual(Array.from(x.api.selectionRoots()),['source','b'])})
test('preflight no altera árbol, selección, avisos ni historial',()=>{const x=setup(),before=JSON.stringify(x.objects);x.targets(['a','b']);assert.equal(JSON.stringify(x.objects),before);assert.deepEqual(x.commits,[]);assert.deepEqual(x.sync,[]);assert.deepEqual(x.toasts,[])})
test('mueve dos raíces en una transacción, conserva posición y sincroniza descendientes',()=>{const x=setup();assert.equal(x.api.moveToCollectionGroup(['b','a'],'target'),true);assert.equal(x.get('a').parentId,'target');assert.equal(x.get('b').parentId,'target');assert.equal(x.get('child').parentId,'a');assert.equal(x.api.worldMatrix('a').elements[12],7);assert.equal(x.api.worldMatrix('child').elements[12],10);assert.equal(x.api.worldMatrix('b').elements[12],9);assert.deepEqual(x.sync,['a','child','b']);assert.equal(x.commits.length,1);assert.deepEqual(x.store.selectedIds,['a','b']);assert.deepEqual(x.objects.filter(o=>o.parentId==='target').map(o=>o.id),['nested','a','b'])})
test('si falla la compensación de cualquier raíz no hay movimiento parcial',()=>{const x=setup();x.get('target').rejectTransform=true;const before=JSON.stringify(x.objects);assert.equal(x.api.moveToCollectionGroup(['a','b'],'target'),false);assert.equal(JSON.stringify(x.objects),before);assert.deepEqual(x.commits,[]);assert.deepEqual(x.sync,[])})
test('Node sin Transform no puede cambiar a un espacio distinto',()=>{const x=setup();assert.ok(!x.targets(['logical']).includes('target'));assert.equal(x.api.moveToCollectionGroup(['logical'],'target'),false)})
test('no reordena nodos ya presentes al mover otros al mismo destino',()=>{const x=setup();const before=JSON.stringify(x.get('a'));assert.equal(x.api.moveToCollectionGroup(['a','b'],'source'),true);assert.equal(JSON.stringify(x.get('a')),before);assert.equal(x.commits.length,1)})
test('revalida bloqueos al ejecutar una acción del menú',()=>{const x=setup(),item=x.api.moveToGroupMenu().children.find(o=>o.label==='target');x.get('target').locked=true;item.run();assert.equal(x.get('a').parentId,'source');assert.deepEqual(x.commits,[])})
test('la acción capturada no cambia otra escena o proyecto',()=>{const x=setup(),item=x.api.moveToGroupMenu().children.find(o=>o.label==='target');x.store.project.activeSceneId='other';item.run();assert.equal(x.get('a').parentId,'source');assert.deepEqual(x.commits,[])})
test('nombres repetidos muestran rutas y mantienen iconos nativos',()=>{const x=setup();x.get('nested').name='target';const items=x.api.moveToGroupMenu().children;assert.ok(items.some(o=>o.label==='target / target'&&o.icon==='group'));assert.ok(items.some(o=>o.label==='target'&&o.icon==='node3d'))})
test('la búsqueda evalúa acentos, mayúsculas y rutas sin limitar el conjunto',()=>{const query={value:'SALA decoracion'};const props={searchPlaceholder:'Buscar grupo…',items:[{label:'Decoración',searchText:'Casa / Sala / Decoración'},{label:'Sala'}]};const source=menu.slice(menu.indexOf('const visibleItems ='),menu.indexOf('watch(query'));const found=vm.runInNewContext(source+'\nvisibleItems.value',{props,query,normalizeAddSearch,computed:fn=>({get value(){return fn()}})});assert.equal(found.length,1);assert.equal(found[0].label,'Decoración')})
test('la búsqueda es optativa, el menú mantiene sus filas directas, y el CSS limita a diez filas',()=>{assert.match(menu,/searchPlaceholder: String/);assert.match(menu,/max-height: min\(324px, 78vh/);assert.match(menu,/\.searchable-menu > \.item \{ height: 28px/);assert.match(menu,/position: sticky; top: 0/);assert.match(menu,/v-for="\(it, i\) in visibleItems"/);assert.match(menu,/@keydown="searchKey"/);assert.match(menu,/@click.stop/);assert.match(commands,/moveToGroupMenu\(\),/);assert.match(menu,/window\.innerWidth - 4/)})
test('el reparentado individual conserva el mecanismo de commit y sincronización',()=>{const x=setup();assert.equal(x.api.reparent('a','target'),true);assert.equal(x.get('a').parentId,'target');assert.equal(x.commits.length,1);assert.deepEqual(x.sync,['a','child'])})
