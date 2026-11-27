// S01: ejecutar el cuerpo real de los mixins sin cargar UI/Vite/Three.js durante Node QA.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { resolveNodePath } from '../src/engine/runtime/scene/node-scripts.js'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
function mixin(file, symbol, env = {}) {
  const code = source(file).replace(/^import .*\n/gm, '').replace(new RegExp(`export const ${symbol}`), `const ${symbol}`)
  const context = vm.createContext({ ...env })
  return vm.runInContext(`${code}\n${symbol}`, context, { filename: file })
}
class V {
  constructor(x=0,y=0,z=0) { this.x=x;this.y=y;this.z=z }
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
  clone(){return new V(this.x,this.y,this.z)}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
  toArray(){return [this.x,this.y,this.z]}
  distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z)}
  lerpVectors(a,b,k){this.x=a.x+(b.x-a.x)*k;this.y=a.y+(b.y-a.y)*k;this.z=a.z+(b.z-a.z)*k;return this}
  copy(v){return this.set(v.x,v.y,v.z)}
}
function mesh(){return {position:new V(),rotation:new V(),scale:new V(1,1,1),visible:true,userData:{},updateMatrixWorld(){},getWorldPosition(v){return v.copy(this.position)}}}
const methods = mixin('src/engine/runtime/events/play-nodes.js','nodesMethods',{ THREE:{Vector3:V},DEG:Math.PI/180,resolveNodePath })
const lights = mixin('src/engine/runtime/events/play-light.js','lightMethods',{ THREE:{Color:class {constructor(v){this.v=v}getHexString(){return 'ffffff'}lerp(){return this} }},tagOf:(o)=>o.tag||'' })
function world(objects){
  const project={objects,tagLayers:{}},ed={nodes:new Map(objects.map(o=>[o.id,mesh()]))}
  const p={on:true,_referenceSession:{},project,ed,tweens:[],vm:{held:new Map()},pos:new V(),vp:{requestRender(){}},
    _animMethodsFor:()=>({playAnimation(){return true},get animations(){return []}}),
    _tagLayerApi:(o)=>({add_to_group(n){o.groups||=[];o.groups.push(n);return true},get_groups(){return [...(o.groups||[])]},get tag(){return o.tag||''}}),
    _persistMarked:(o)=>!!o.dontDestroyOnLoad,_persistSet(id,v){this._find(id).dontDestroyOnLoad=v;return true},
    _nodeVisible(id,v){this.ed.nodes.get(id).visible=v},_lightsShown:()=>true }
  Object.assign(p,methods,lights);p._lightInit();return p
}
const obj=(id,name=id,parentId=null,type='primitive')=>({id,name,parentId,type,groups:[],light:{type:'omni',energy:2,range:10}})

test('REF-01 · resolución por ID y nombre mantiene prioridad y contrato undefined',()=>{
  const a=obj('node-1','Igual'),b=obj('node-2','Igual'),p=world([a,b]);assert.equal(p._nodeHandle('node-2').id,'node-2');assert.equal(p._nodeHandle('iGuAl').id,'node-1');assert.equal(p._nodeHandle('perdido'),undefined)
})
test('REF-02 · rutas absolutas y relativas usan el árbol lógico',()=>{
  const a=obj('a','Raiz'),b=obj('b','Hijo','a'),c=obj('c','Hermano','a'),p=world([a,b,c]);const h=p._nodeHandle('b')
  assert.equal(p._nodeHandle('/Raiz/Hijo').id,'b');assert.equal(h.get_node('../Hermano').id,'c');assert.equal(h.get_node('.').id,'b');assert.equal(h.get_node('/Raiz').id,'a');assert.equal(h.parent.id,'a');assert.equal(p._nodeHandle('a').children.length,2)
  assert.equal(h.get_node('/Raiz/Fallo'),null);assert.equal(h.get_node('../../../Raiz'),null)
})
test('REF-03 · misma identidad sobrevive renombrado y reparent, no rutas viejas',()=>{
  const a=obj('a','Raiz'),b=obj('b','Hijo','a'),c=obj('c','Otra'),p=world([a,b,c]);const h=p._nodeHandle('b');b.name='Nuevo';b.parentId='c'
  assert.equal(h.is_valid(),true);assert.equal(h.name,'Nuevo');assert.equal(h.parent.id,'c');assert.equal(p._nodeHandle('/Otra/Nuevo').id,'b');assert.equal(p._nodeHandle('/Raiz/Hijo'),undefined)
})
test('REF-04 · reconstrucción de Three.js del mismo objeto mantiene handle y usa mesh vigente',()=>{
  const p=world([obj('a')]),h=p._nodeHandle('a'),old=h.object3D;const replacement=mesh();p.ed.nodes.set('a',replacement);h.position=[3,4,5]
  assert.equal(h.is_valid(),true);assert.equal(h.object3D,replacement);assert.deepEqual(h.position,[3,4,5]);assert.deepEqual(old.position.toArray(),[0,0,0])
})
test('REF-05 · destrucción invalida todas las capacidades excepto id/is_valid',()=>{
  const a=obj('a'),p=world([a]),h=p._nodeHandle('a');p.project.objects=[];p.ed.nodes.delete('a');assert.equal(h.is_valid(),false);assert.equal(h.id,'a')
  for(const access of [()=>h.position,()=>h.children,()=>h.get_node('.'),()=>h.add_to_group('x'),()=>h.playAnimation('anim'),()=>h.animations,()=>h.move([1,2,3]),()=>h.light]) assert.throws(access,/inválida/)
})
test('REF-06 · nuevo objeto mismo ID no reactiva referencia anterior',()=>{
  const original=obj('a'),p=world([original]),old=p._nodeHandle('a');p.project.objects=[obj('a')];p.ed.nodes.set('a',mesh());const fresh=p._nodeHandle('a');assert.equal(old.is_valid(),false);assert.equal(fresh.is_valid(),true);assert.throws(()=>old.position=[4,5,6],/inválida/);assert.deepEqual(fresh.position,[0,0,0])
})
test('REF-07 · escena nueva invalida excepto los registros efectivamente retenidos',()=>{
  const persistent=obj('keep'),gone=obj('gone'),p=world([persistent,gone]),keep=p._nodeHandle('keep'),old=p._nodeHandle('gone');p.project.objects=[obj('another'),persistent];p.ed.nodes=new Map([['keep',mesh()],['another',mesh()]])
  assert.equal(keep.is_valid(),true);assert.equal(old.is_valid(),false)
})
test('REF-08 · Stop y siguiente Play no reviven handles capturados',()=>{
  const p=world([obj('a')]),old=p._nodeHandle('a');p.on=false;p._referenceSession=null;assert.equal(old.is_valid(),false);p.on=true;p._referenceSession={};assert.equal(old.is_valid(),false);assert.equal(p._nodeHandle('a').is_valid(),true)
})
test('REF-09 · handles por objeto y salida sin parent devuelven valores compatibles',()=>{
  const a=obj('a','Casa'),p=world([a]),h=p._nodeHandle({id:'a'});assert.equal(h.parent,null);assert.equal(h.get_node('...'),null);assert.equal(p._nodeHandle({name:'Casa'}).id,'a')
})
test('REF-10 · tween capturado no acciona representación diferente y se resuelve al desmontar',async()=>{
  const original=obj('a'),p=world([original]),h=p._nodeHandle('a'),old=h.object3D;const promise=h.move([7,0,0],1);assert.equal(p.tweens.length,1);p.project.objects=[obj('a')];p.ed.nodes.set('a',mesh());assert.equal(p.tweens[0].valid(),false)
  const timer=mixin('src/engine/runtime/events/play-dialog.js','dialogMethods',{});p._timers=timer._timers;p.frameWait=[];p.timers=[];p._timers(.5);await promise;assert.deepEqual(old.position.toArray(),[0,0,0]);assert.deepEqual(p.ed.nodes.get('a').position.toArray(),[0,0,0])
})
test('REF-11 · cache de luz por objeto y protección contra reutilización de ID',()=>{
 const a=obj('l','Luz',null,'light'),p=world([a]);const n=p.ed.nodes.get('l');n.userData.light={visible:true,intensity:1,color:{set(){}},distance:2,castShadow:false};const h=p._nodeHandle('l').light
 assert.equal(h.on,true);p.project.objects=[obj('l','Nueva',null,'light')];p.ed.nodes.set('l',mesh());assert.throws(()=>h.on,/inválida/);assert.throws(()=>{h.on=false},/inválida/)
 const replacement=p._nodeHandle('l').light;assert.notEqual(h,replacement)
})
test('REF-12 · introspección de tipos y puntos de montaje sin nuevo bucle periódico',()=>{
  assert.match(source('src/core/events/game-api.d.ts'),/is_valid\(\): boolean/)
  assert.match(source('src/engine/runtime/events/play.js'),/this\._referenceSession = \{\}/)
  assert.match(source('src/engine/runtime/events/play-level.js'),/for \(const t of this\.tweens \|\| \[\]\) t\.r\(\)/)
  const lifecycle=source('src/engine/runtime/scene/node-lifecycle.js');assert.match(lifecycle,/this\.processEntries/);assert.doesNotMatch(lifecycle,/for \(const.*this\.entered\.values\(\).*process\(/)
})
test('REF-13 · SceneGraph marca propietario y el handle evita búsqueda O(N) por acceso',()=>{
  const o=obj('fast'),p=world([o]),n=p.ed.nodes.get('fast')
  Object.defineProperty(n,'_lfNodeOwner',{value:o,writable:true,configurable:true})
  const h=p._nodeHandle('fast')
  p.project.objects.includes=()=>{throw Error('Búsqueda lineal prohibida en acceso periódico')}
  for(let i=0;i<5000;i++){assert.equal(h.is_valid(),true);h.position=[i,0,0]}
  assert.equal(h.position[0],4999)
})
test('REF-14 · game.node no usa un handle obsoleto como NodeLike para otro nodo',()=>{
  const o=obj('a'),p=world([o]),old=p._nodeHandle('a');p.project.objects=[obj('a')];p.ed.nodes.set('a',mesh())
  assert.equal(p._nodeHandle(old),undefined);assert.equal(p._nodeHandle('a').is_valid(),true)
})
