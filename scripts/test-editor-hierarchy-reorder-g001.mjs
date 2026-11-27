// LF-EDITOR-HIERARCHY-REORDER-G001: recorrido real de reorderSiblings sin cargar Electron.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const read=path=>readFileSync(new URL(`../src/${path}`, import.meta.url),'utf8')
const stateCode=read('core/state/tree.js'), ui=read('components/SceneTree.vue')
const reorderStart=stateCode.indexOf('export function reorderSiblings(')
const reorderEnd=stateCode.indexOf('\nfunction reorder(',reorderStart)
assert.ok(reorderStart>=0&&reorderEnd>reorderStart)
const func=stateCode.slice(reorderStart,reorderEnd).replace('export function','function')
const base=()=>[
 {id:'a',name:'A',parentId:null,position:[1,2,3],rotation:[10,20,30],scale:[2,2,2],locked:false},
 {id:'nested',name:'Child A',parentId:'a',position:[2,3,4],rotation:[1,2,3],scale:[1,1,1],locked:false},
 {id:'b',name:'B',parentId:null,position:[4,5,6],rotation:[0,0,0],scale:[1,1,1],locked:false},
 {id:'c',name:'C',parentId:null,position:[7,8,9],rotation:[0,0,0],scale:[1,1,1],locked:false},
 {id:'d',name:'D',parentId:null,position:[10,11,12],rotation:[0,0,0],scale:[1,1,1],locked:false},
 {id:'inner1',name:'E',parentId:'b',position:[13,14,15],rotation:[0,0,0],scale:[1,1,1],locked:false},
 {id:'inner2',name:'F',parentId:'b',position:[16,17,18],rotation:[0,0,0],scale:[1,1,1],locked:false},
]
function setup(objects=base()) {
 const commits=[],toasts=[],sync=[]
 const store={project:{objects},editor:{syncObject:id=>sync.push(id)}}
 const context=vm.createContext({store,commit:label=>commits.push(label),toast:(...args)=>toasts.push(args),getObject:id=>objects.find(o=>o.id===id)})
 vm.runInContext(func+'\nglobalThis.reorderSiblings=reorderSiblings',context)
 return {reorder:context.reorderSiblings,store,commits,toasts,sync}
}
const siblings=(s,p=null)=>s.store.project.objects.filter(o=>(o.parentId||null)===p).map(o=>o.id)
test('HR-01: coloca un nodo inmediatamente antes de otro hermano',()=>{
 const x=setup();assert.equal(x.reorder(['d'],null,'b'),true);assert.deepEqual(siblings(x),['a','d','b','c']);assert.equal(x.commits.length,1)
})
test('HR-02: mover al final del padre no altera el parentId',()=>{
 const x=setup();assert.equal(x.reorder(['a'],null,null),true);assert.deepEqual(siblings(x),['b','c','d','a']);assert.equal(x.store.project.objects.find(o=>o.id==='a').parentId,null)
})
test('HR-03: ordena hijos dentro de un grupo sin deshacer la jerarquía',()=>{
 const x=setup();assert.equal(x.reorder(['inner2'],'b','inner1'),true);assert.deepEqual(siblings(x,'b'),['inner2','inner1']);assert.equal(x.store.project.objects.find(o=>o.id==='inner2').parentId,'b')
})
test('HR-04: preserva byte a byte transformaciones y datos ajenos al orden',()=>{
 const x=setup(), before=Object.fromEntries(x.store.project.objects.map(o=>[o.id,JSON.stringify(o)]));
 x.reorder(['d'],null,'a');
 assert.ok(x.store.project.objects.every(o=>JSON.stringify(o)===before[o.id])); assert.deepEqual(x.sync,[])
})
test('HR-05: selección múltiple conserva orden relativo aunque los IDs lleguen invertidos',()=>{
 const x=setup();assert.equal(x.reorder(['c','a'],null,null),true);assert.deepEqual(siblings(x),['b','d','a','c']);assert.equal(x.commits.length,1)
})
test('HR-06: no registra Undo para una operación que no cambia orden',()=>{
 const x=setup();assert.equal(x.reorder(['b'],null,'c'),false);assert.equal(x.commits.length,0)
})
test('HR-07: rechaza una selección cuyo miembro pertenece a otro padre',()=>{
 const x=setup();assert.equal(x.reorder(['a','inner1'],null,'b'),false);assert.equal(x.commits.length,0)
})
test('HR-08: bloquea antes de o después de sí mismo y referencias ajenas',()=>{
 const x=setup();assert.equal(x.reorder(['a'],null,'a'),false);assert.equal(x.reorder(['a'],null,'inner2'),false)
})
test('HR-09: protege nodos bloqueados y sus ancestros',()=>{
 const x=setup();x.store.project.objects.find(o=>o.id==='b').locked=true
 assert.equal(x.reorder(['inner2'],'b','inner1'),false)
 assert.equal(x.reorder(['b'],null,'a'),false);assert.equal(x.commits.length,0)
})
test('HR-10: Terrain se ordena en la raíz sin mutar su ID o datos físicos',()=>{
 const x=setup();x.store.project.objects.push({id:'terrain1',type:'terrain',parentId:null,name:'Terreno',props:{terrainId:'terrain1'},visible:true})
 assert.equal(x.reorder(['terrain1'],null,'a'),true);assert.equal(siblings(x)[0],'terrain1');assert.equal(x.store.project.objects.find(o=>o.id==='terrain1').props.terrainId,'terrain1')
})
test('HR-11: reordenamiento sin commit permite un historial único en el gestor de drag',()=>{
 const x=setup();assert.equal(x.reorder(['c'],null,'a',{commit:false}),true);assert.equal(x.commits.length,0)
})
test('HR-12: DnD utiliza una línea de inserción antes/después e indica operación en el UI',()=>{
 for (const token of ['d-before','d-after','onDragOverRoot','zoneOf(e, el)',"e.altKey) return 'inside'",'reorderSiblings(dragIds','@dragend="endDragging"']) assert.ok(ui.includes(token),token)
})
test('HR-13: arriba/centro/abajo insertan antes/dentro/después; Alt fuerza dentro',()=>{
 const code=ui.slice(ui.indexOf('function zoneOf('),ui.indexOf('\nfunction onDragOver('))
 const zone=vm.runInNewContext(code+'\nzoneOf')
 const el={getBoundingClientRect:()=>({top:100,height:24})}
 assert.equal(zone({altKey:false,clientY:102},el),'before');assert.equal(zone({altKey:false,clientY:112},el),'inside');assert.equal(zone({altKey:false,clientY:122},el),'after');assert.equal(zone({altKey:true,clientY:102},el),'inside')
})
test('HR-14: el arrastre de Terrain funciona, pero no puede recibir otros nodos como hijos',()=>{
 assert.match(ui,/draggable="true"/);assert.match(ui,/row\.o\.type === 'terrain'/);assert.match(ui,/getObject\(id\)\?\.type === 'terrain'/)
})
test('HR-15: la lista virtualizada recibe autoscroll y limpia el gesto al terminar',()=>{
 for(const tok of ['requestAnimationFrame(dragScrollFrame)','stopDragScroll()','scrollDragRaf','endDragging()','@scroll.passive="onScroll"']) assert.ok(ui.includes(tok),tok)
})
test('HR-16: se mantienen rutas de Script desde Assets, filtro, teclado y raíz de escena',()=>{
 for(const tok of ['nodeScriptFromDrop','filter.value','onDropRoot','role="tree"','role="treeitem"']) assert.ok(ui.includes(tok),tok)
})
