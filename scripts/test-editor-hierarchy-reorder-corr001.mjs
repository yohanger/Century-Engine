// LF-EDITOR-HIERARCHY-REORDER-G001_CORR-001 — recorrido de eventos reales del componente (sin redefinir la lógica).
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
const tree=readFileSync(new URL('../src/components/SceneTree.vue',import.meta.url),'utf8')
const script=tree.slice(tree.indexOf('// ---------- arrastrar y soltar ----------'),tree.indexOf('\nconst toggle =',tree.indexOf('// ---------- arrastrar y soltar ----------')))
const base=()=>[
 {id:'a',type:'group',name:'A',parentId:null,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],open:true},
 {id:'b',type:'primitive',name:'B',parentId:null,position:[3,0,0],rotation:[0,0,0],scale:[1,1,1]},
 {id:'c',type:'primitive',name:'C',parentId:null,position:[6,0,0],rotation:[0,0,0],scale:[1,1,1]},
 {id:'d',type:'group',name:'D',parentId:null,position:[10,0,0],rotation:[0,0,0],scale:[1,1,1],open:true},
 {id:'inner',type:'primitive',name:'Inner',parentId:'a',position:[1,0,0],rotation:[0,0,0],scale:[1,1,1]},
 {id:'terrain',type:'terrain',name:'Terrain',parentId:null},
]
function setup(items=base()) {
 const commits=[], calls=[], events=[],toasts=[]
 const store={project:{objects:items},selectedIds:[],editor:{syncObject:id=>events.push(['sync',id])}}
 const getObject=id=>items.find(x=>x.id===id)
 const rows={value:items.map(o=>({o}))},rowIndex={value:new Map(rows.value.map((x,i)=>[x.o.id,i]))}
 const isDescendant=(id,ancestor)=>{let o=getObject(id);while(o?.parentId){if(o.parentId===ancestor)return true;o=getObject(o.parentId)}return false}
 let dragIds=[],scrollDragRaf=0,dragY=null
 const drop={value:null},listEl={value:{scrollTop:0,clientHeight:180,getBoundingClientRect:()=>({top:90,bottom:270,height:180})}}
 const context={store,getObject,isDescendant,rows,rowIndex,drop,listEl,dragY,scrollDragRaf,
  hasAssetEntry:()=>false,nodeScriptFromDrop:()=>null,toast:(...v)=>toasts.push(v),updateObject(){},
  requestAnimationFrame:()=>1,cancelAnimationFrame(){},commit:label=>commits.push(label),
  selectionRoots:()=>store.selectedIds,dragIds,toasts,events,
  descendantsOf:()=>[],reparent(id,parent,before,opts){calls.push({id,parent,before,opts});getObject(id).parentId=parent;return true},
  reorderSiblings(ids,parent,before){calls.push({ids:[...ids],parent,before});let siblings=items.filter(x=>(x.parentId||null)===(parent||null)),selected=new Set(ids);const moving=siblings.filter(o=>selected.has(o.id));const rest=siblings.filter(o=>!selected.has(o.id));const at=before?rest.findIndex(o=>o.id===before):rest.length;rest.splice(at,0,...moving);let i=0;const output=items.map(o=>(o.parentId||null)===(parent||null)?rest[i++]:o);items.splice(0,items.length,...output);return true},
 }
 const vmContext=vm.createContext(context)
 // Las variables de `<script setup>` son locales, como en la instancia Vue.
 vm.runInContext('let dragIds = []; let scrollDragRaf=0, dragY=null;\n'+script+'\nglobalThis.actions={onDragStart,onDragOver,onDragOverRoot,onDrop,onDropRoot,zoneOf,endDragging,moveDragged}',vmContext)
 const actions=vmContext.actions
 function ev({y=110,alt=false,target=null,types=[]}={}) {
  const transfer={types,effectAllowed:null,dropEffect:null,data:{},setData(k,v){this.data[k]=v}}
  const row={getBoundingClientRect:()=>({top:100,height:24})}
  const event={clientY:y,altKey:alt,dataTransfer:transfer,currentTarget:row,target:target||{closest:()=>null},prevented:false,stopped:false,
   preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}}
  return event
 }
 const all=()=>items.filter(o=>!o.parentId).map(o=>o.id)
 return {actions,store,items,calls,commits,toasts,ev,all,row:id=>({o:getObject(id)}),drop}
}
test('HRC-01: el arrastre no inserta elementos reactivos que cambien altura de la lista',()=>{
 assert.doesNotMatch(tree,/<div v-if="dragging" class="drag-hint"/)
 assert.doesNotMatch(tree,/dragging\.value\s*=\s*true/)
 assert.match(tree,/@dragstart="onDragStart\(\$event, row\)"/)
})
test('HRC-02: la fila tiene tres zonas de destino sin exigir Alt',()=>{
 const h=setup(),e=h.ev();assert.equal(h.actions.zoneOf(e,e.currentTarget),'inside')
 assert.equal(h.actions.zoneOf(h.ev({y:102}),e.currentTarget),'before')
 assert.equal(h.actions.zoneOf(h.ev({y:122}),e.currentTarget),'after')
 assert.equal(h.actions.zoneOf(h.ev({y:101,alt:true}),e.currentTarget),'inside')
})
test('HRC-03: drop reordena antes aunque no exista dragover previo',()=>{
 const h=setup();h.actions.onDragStart(h.ev(),h.row('c'))
 const d=h.ev({y:102});h.actions.onDrop(d,h.row('b'))
 assert.deepEqual(h.all(),['a','c','b','d','terrain']);assert.equal(d.prevented,true);assert.equal(h.commits.length,1)
})
test('HRC-04: drop reordena después de una fila y no cambia Transform',()=>{
 const h=setup(),before=Object.fromEntries(h.items.map(o=>[o.id,JSON.stringify(o)]))
 h.actions.onDragStart(h.ev(),h.row('b'));h.actions.onDrop(h.ev({y:122}),h.row('d'))
 assert.deepEqual(h.all(),['a','c','d','b','terrain']);assert.ok(h.items.every(o=>before[o.id]===JSON.stringify(o)))
})
test('HRC-05: el centro de la fila cambia de padre por la ruta reparent existente',()=>{
 const h=setup();h.actions.onDragStart(h.ev(),h.row('c'));h.actions.onDrop(h.ev({y:112}),h.row('d'))
 assert.equal(h.row('c').o.parentId,'d');assert.equal(h.calls.at(-1)?.id,'c');assert.equal(h.commits.at(-1),'Mover nodo')
})
test('HRC-06: arrastre sobre espacio libre permite mover de vuelta a raíz',()=>{
 const h=setup();h.actions.onDragStart(h.ev(),h.row('inner'))
 const e=h.ev({target:{closest:()=>null}});h.actions.onDragOverRoot(e)
 assert.equal(e.prevented,true);assert.equal(h.drop.value.zone,'root')
 h.actions.onDropRoot(e);assert.equal(h.row('inner').o.parentId,null);assert.ok(h.commits.includes('Mover a la raíz'))
})
test('HRC-07: los hijos no propagan drop como si fuera espacio libre',()=>{
 const h=setup();h.actions.onDragStart(h.ev(),h.row('c'))
 const e=h.ev({target:{closest:()=>({dataset:{id:'b'}})}});h.actions.onDropRoot(e)
 assert.equal(h.commits.length,0);assert.equal(e.prevented,false)
})
test('HRC-08: dragover sobre nodo genera marcador y autoriza drop',()=>{
 const h=setup();h.actions.onDragStart(h.ev(),h.row('c'))
 const e=h.ev({y:102});h.actions.onDragOver(e,h.row('b'))
 assert.equal(h.drop.value.id,'b');assert.equal(h.drop.value.zone,'before');assert.equal(e.prevented,true);assert.equal(e.dataTransfer.dropEffect,'move')
})
test('HRC-09: drop recalcula zona, no usa marcador anterior posiblemente obsoleto',()=>{
 const h=setup();h.actions.onDragStart(h.ev(),h.row('c'))
 h.actions.onDragOver(h.ev({y:102}),h.row('b'))
 h.actions.onDrop(h.ev({y:122}),h.row('b'))
 assert.deepEqual(h.all(),['a','b','c','d','terrain']);assert.equal(h.calls.at(-1)?.before,'d')
})
test('HRC-10: se rechaza crear ciclos sin cambios en jerarquía',()=>{
 const h=setup();h.actions.onDragStart(h.ev(),h.row('a'))
 h.actions.onDrop(h.ev({y:112}),h.row('inner'))
 assert.equal(h.commits.length,0);assert.equal(h.row('a').o.parentId,null)
})
test('HRC-11: el nodo Terrain solo se reordena en raíz y no como hijo',()=>{
 const h=setup();h.actions.onDragStart(h.ev(),h.row('terrain'))
 h.actions.onDrop(h.ev({y:102}),h.row('a'));assert.equal(h.all()[0],'terrain')
 h.actions.onDragStart(h.ev(),h.row('terrain'));h.actions.onDrop(h.ev({y:112}),h.row('d'))
 assert.equal(h.row('terrain').o.parentId,null)
})
test('HRC-12: conserva el formato de DnD requerido por Assets/Prefab',()=>{
 const h=setup();const e=h.ev();h.actions.onDragStart(e,h.row('b'))
 assert.deepEqual(Object.keys(e.dataTransfer.data).sort(),['application/x-lf-node','text/plain'])
 assert.equal(e.dataTransfer.effectAllowed,'copyMove')
})
test('HRC-13: impide arrastrar nodos bloqueados',()=>{
 const h=setup();h.row('b').o.locked=true;const e=h.ev();h.actions.onDragStart(e,h.row('b'));assert.equal(e.prevented,true);assert.equal(h.commits.length,0)
})
test('HRC-14: selección múltiple usa orden visual, una sola operación',()=>{
 const h=setup();h.store.selectedIds=['c','b'];h.actions.onDragStart(h.ev(),h.row('c'))
 h.actions.onDrop(h.ev({y:102}),h.row('a'))
 assert.deepEqual(h.all(),['b','c','a','d','terrain']);assert.equal(h.commits.length,1)
})
test('HRC-15: root de escena acepta soltar sin crear padre artificial',()=>{
 assert.match(tree, /@drop="onDropRoot"/)
 assert.match(tree, /@dragover="onDragOverRoot" @drop="onDropRoot"/)
})
test('HRC-16: no desaparecen los destinos ni el autoscroll de listas virtualizadas',()=>{
 for(const t of ['scrollDragRaf','dragScrollFrame','@scroll.passive="onScroll"','d-before','d-after','d-in','onDragOverRoot'])assert.ok(tree.includes(t),t)
})
test('HRC-17: la entrada desde Assets sigue conectada al nodo correcto',()=>{
 assert.match(tree,/nodeScriptFromDrop\(e\.dataTransfer, store\.project\?\.scripts\)/)
 assert.match(tree,/updateObject\(row\.o\.id, \{ scriptId: script\.id \}\)/)
})
test('HRC-18: el árbol y el nodo usan un solo store y no crean estados persistentes adicionales',()=>{
 assert.match(tree,/import \{[\s\S]*reorderSiblings[\s\S]*\} from '\.\.\/core\/store\.js'/)
 assert.doesNotMatch(tree,/localStorage\.setItem|sessionStorage|new SceneGraph|createApp\(/)
})
