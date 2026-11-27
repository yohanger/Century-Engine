// Naturaleza S01: el registro real y su lógica ejecutados con recursos Three simulados, sin recrear un renderer.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { shiftANodeCatalog } from '../src/core/add-menu-catalog.js'
const read = p => readFileSync(new URL(`../src/${p}`,import.meta.url),'utf8')
const original=read('engine/runtime/nodes/nature.js')
const source=original.replace(/^import .*$/gm,'').replace('export default registerNode({','globalThis.NATURE = registerNode({')
const kinds=['grass','tallgrass','flowers','bush','pine','tree','rock']
function harness(){
  const calls={build:[],disposed:[],wind:[],updates:[],merged:0}
  const originals=kinds.map(k=>[k,{name:({grass:'Hierba',tallgrass:'Hierba alta',flowers:'Flores',bush:'Arbusto',pine:'Pino',tree:'Árbol',rock:'Roca'})[k],icon:k,castShadow:!['grass','tallgrass','flowers'].includes(k),wind:k==='rock'?null:{bend:.25,flutter:.4},build:()=>{calls.build.push(k);return [0,1].map(i=>({id:`${k}-${i}`,dispose(){calls.disposed.push(this.id)}}))}}])
  const builtins=Object.fromEntries(originals)
  class Material {constructor(opts){this.opts=opts;this.color={set:value=>this.colorValue=value};this.userData={};this.disposed=false}dispose(){this.disposed=true}}
  class Mesh {constructor(geometry,material){this.geometry=geometry;this.material=material}}
  const ctx=vm.createContext({
    THREE:{MeshStandardMaterial:Material,Mesh,DoubleSide:2},BUILTIN_FOLIAGE:builtins,
    mergeGeometries:(parts)=>{calls.merged++;return {id:parts[0].id,kind:parts[0].id.split('-')[0],boundingBox:null}},
    geometryHeight:()=>4,
    applyWind:(material,params)=>{material.wind=params;calls.wind.push(params)},
    registerNode:def=>def,
    makeRoot:obj=>{const visual={children:[],add(mesh){this.children.push(mesh)}};return {root:{userData:{id:obj.id,visual},visible:true},visual}},
    applyBase:(root,obj,scalable)=>{root.transform={position:[...obj.position],rotation:[...obj.rotation],scale:scalable?[...obj.scale]:[1,1,1]};root.visible=obj.visible !== false},
  })
  vm.runInContext(source,ctx)
  return {def:ctx.NATURE,calls,builtins}
}
const defs=()=>[{type:'terrain',label:'Terreno',category:'Naturaleza',icon:'terrain'},
 {type:'nature',category:'Naturaleza',kinds:Object.fromEntries(kinds.map(k=>[k,{label:k,icon:k}]))}]
const node=(def,kind='tree')=>({id:'n1',type:'nature',kind,position:[2,3,4],rotation:[5,6,7],scale:[1.5,1.5,1.5],visible:true,...def.create(kind)})
test('NN-01: Naturaleza contiene todas las variantes existentes, sin inventar especies',()=>assert.deepEqual(Object.keys(harness().def.kinds),kinds))
test('NN-02: categoría Nature y tipo independiente de Terrain',()=>{const def=harness().def;assert.equal(def.type,'nature');assert.equal(def.category,'Naturaleza');assert.equal(def.scalable,true)})
test('NN-03: Terrain y Nature aparecen en el mismo catálogo',()=>{const a=shiftANodeCatalog(defs());assert.equal(a.filter(x=>x.category==='Naturaleza').length,8);assert.ok(a.some(x=>x.type==='terrain'));assert.equal(a.filter(x=>x.type==='nature').length,7)})
test('NN-04: crear un árbol no necesita estado de Terrain',()=>{const {def}=harness();const o=node(def);assert.equal(o.props.windSway,1);assert.ok(!('terrainId' in o.props));assert.equal(o.collision,false)})
test('NN-05: creación reutiliza colores, sombras y nombre de la especie',()=>{const {def}=harness();assert.equal(def.create('grass').castShadow,false);assert.equal(def.create('pine').castShadow,true);assert.equal(def.create('tree').name,'Árbol')})
test('NN-06: la variante inválida se rechaza',()=>assert.throws(()=>harness().def.create('other'),/desconocida/))
test('NN-07: build usa geometría generada de la variante y material con colores por vértice',()=>{const h=harness(),root=h.def.build(node(h.def));assert.equal(h.calls.build[0],'tree');assert.equal(root.userData.natureMesh.material.opts.vertexColors,true)})
test('NN-08: se reutiliza la geometría para dos árboles, pero nunca el material',()=>{const h=harness();const a=h.def.build(node(h.def)),b=h.def.build({...node(h.def),id:'n2'});assert.equal(a.userData.natureMesh.geometry,b.userData.natureMesh.geometry);assert.notEqual(a.userData.natureMesh.material,b.userData.natureMesh.material);assert.equal(h.calls.merged,1)})
test('NN-09: el catálogo no recrea geometría por actualización de Transform',()=>{const h=harness(),o=node(h.def),root=h.def.build(o);for(let i=0;i<5;i++)h.def.update(root,{...o,position:[i,3,4]});assert.equal(h.calls.build.length,1)})
test('NN-10: los objetos mantienen su propia posición, rotación y escala',()=>{const h=harness(),o=node(h.def),root=h.def.build(o);h.def.update(root,o);assert.deepEqual(root.transform.position,[2,3,4]);assert.deepEqual(root.transform.rotation,[5,6,7]);assert.deepEqual(root.transform.scale,[1.5,1.5,1.5])})
test('NN-11: color editable por nodo no modifica el material de su vecino',()=>{const h=harness(),o=node(h.def),a=h.def.build(o),b=h.def.build({...o,id:'n2'});h.def.update(a,{...o,color:'#ffaa00'});h.def.update(b,{...o,color:'#ffffff'});assert.equal(a.userData.natureMesh.material.colorValue,'#ffaa00');assert.equal(b.userData.natureMesh.material.colorValue,'#ffffff')})
test('NN-12: sombra independiente, conserva opción propia',()=>{const h=harness(),o=node(h.def),root=h.def.build(o);h.def.update(root,{...o,castShadow:false});assert.equal(root.userData.natureMesh.castShadow,false);h.def.update(root,{...o,castShadow:true});assert.equal(root.userData.natureMesh.castShadow,true)})
test('NN-13: naturaleza utiliza applyWind compartido',()=>{const h=harness(),o=node(h.def),root=h.def.build(o);h.def.update(root,o);assert.equal(h.calls.wind.length,1);assert.equal(h.calls.wind[0].bend,.25)})
test('NN-14: WindSway 0 anula flexión sin desactivar World',()=>{const h=harness(),o=node(h.def),root=h.def.build(o);h.def.update(root,{...o,props:{windSway:0}});assert.equal(h.calls.wind.at(-1).bend,0);assert.equal(h.calls.wind.at(-1).flutter,0)})
test('NN-15: rocas no se mecen',()=>{const h=harness(),o=node(h.def,'rock'),root=h.def.build(o);h.def.update(root,o);assert.equal(h.calls.wind.at(-1).bend,0)})
test('NN-16: apagar visibilidad oculta solo ese nodo',()=>{const h=harness(),o=node(h.def),a=h.def.build(o),b=h.def.build({...o,id:'n2'});h.def.update(a,{...o,visible:false});h.def.update(b,o);assert.equal(a.visible,false);assert.equal(b.visible,true)})
test('NN-17: dispose libera material propio y nunca geometría compartida',()=>{const h=harness(),a=h.def.build(node(h.def)),b=h.def.build({...node(h.def),id:'n2'});a.userData.disposeNature();assert.equal(a.userData.natureMesh.material.disposed,true);assert.equal(b.userData.natureMesh.material.disposed,false);assert.equal(h.calls.disposed.length,2)})
test('NN-18: la geometría procedural se genera una vez por variante y libera partes originales',()=>{const h=harness(),a=h.def.build(node(h.def,'grass')),b=h.def.build(node(h.def,'tree')),c=h.def.build(node(h.def,'grass'));assert.equal(h.calls.merged,2);assert.equal(h.calls.disposed.length,4)})
test('NN-19: Inspector ofrece color, sombra, viento y Transform original',()=>{const t=read('components/Inspector.vue');for(const txt of ['nature-node-inspector','Influencia del viento',"obj.type === 'nature'",'Transformación','Vec3Field'])assert.ok(t.includes(txt),txt)})
test('NN-20: SceneGraph destruye recursos en borrado y reconstrucción',()=>{const s=read('engine/runtime/scene/objects.js');assert.match(s,/old\.userData\.disposeNature\?\.\(\)/);assert.match(s,/node\.userData\.disposeNature\?\.\(\)/)})
test('NN-21: ghost de colocación libera material al cancelar',()=>assert.match(read('core/editor/placement.js'),/this\.ghost\.userData\.disposeNature\?\.\(\)/))
test('NN-22: Terrain conserva su ciclo de vida físico sin convertirse en malla duplicada',()=>{const s=read('engine/runtime/nodes/terrain.js');assert.match(s,/base: 'Node'/);assert.match(s,/makeRoot\(obj\)\.root/);assert.match(s,/category: 'Naturaleza'/)})
test('NN-23: persistencia sigue utilizando project.objects y registro compartido',()=>{const s=read('core/state/objects.js');assert.match(s,/makeObject\(partial.type, partial.kind, partial\)/);assert.match(s,/store\.project\.objects\.push\(obj\)/);assert.match(read('engine/runtime/nodes/index.js'),/import '\.\/nature\.js'/)})
test('NN-24: las instancias pintadas heredadas no se modifican en S01',()=>{const s=read('engine/runtime/geometry/foliage.js');assert.match(s,/constructor\(terrain\)/);assert.match(s,/class Foliage/);assert.doesNotMatch(original,/project\.terrain\.foliage|heightAt\(/)})
test('NN-25: no se crea sistema paralelo de viento ni de geometrías',()=>{assert.match(original,/BUILTIN_FOLIAGE/);assert.match(original,/applyWind/);assert.doesNotMatch(original,/class Foliage|class World|new Terrain/)})
test('NN-26: el antiguo sistema Nature y la categorización siguen siendo compatibles',()=>{const s=read('core/commands.js');assert.match(s,/'Naturaleza': 'tree'/);assert.match(read('core/state/objects.js'),/Usa Naturaleza → Terreno/)})
