// Gate S04 — prueba de funciones extraídas de los archivos productivos, sin simular Vue/Electron.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { Quaternion, Vector3 } from 'three'
const same=(actual,expected)=>assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected)
const read = (path) => readFileSync(new URL('../'+path, import.meta.url),'utf8')
const src=read('src/core/state/objects.js')
const parse=(start,end)=>{const a=src.indexOf(start),b=src.indexOf(end,a);assert.ok(a>=0&&b>a);return src.slice(a,b)}
class Vec3 {
  constructor(x=0,y=0,z=0) {this.x=x;this.y=y;this.z=z}
  setFromMatrixPosition(m){this.x=m.pos[0];this.y=m.pos[1];this.z=m.pos[2];return this}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this}
  multiplyScalar(v){this.x*=v;this.y*=v;this.z*=v;return this}
  clone(){return new Vec3(this.x,this.y,this.z)}
  toArray(){return [this.x,this.y,this.z]}
  applyMatrix4(m){return this.add(new Vec3(...m.pos))}
}
const matrices=(objects,id)=>{
 const o=objects.find(v=>v.id===id)
 if(!o) return {pos:[0,0,0],determinant:()=>1,invert:()=>({pos:[0,0,0]})}
 const parent=matrices(objects,o.parentId)
 const pos=(o.position || [0,0,0]).map((v,i)=>v+parent.pos[i])
 return {pos,determinant:()=>1,invert:()=>({pos:parent.pos.map(n=>-n)})}
}
const original=(o)=>({...o,position:[...o.position],scale:[...o.scale]})
function harness(objects) {
 const msgs=[], commits=[],calls=[]
 const store={project:{objects}}
 const getObject=id=>objects.find(o=>o.id===id)
 const PRIMITIVES={sphere:{link:'xyz'},cylinder:{link:'xz'},cone:{link:'xz'}}
 const validateNodeTree=(candidate)=>{
  if(candidate.some(o=>o.type==='node3d'&&o.scale?.[0]>5&&o.containsPhysics))throw Error('Physics tree invalid')
  return true
 }
 const updateObject=(id,patch)=>{
  const o=getObject(id); calls.push(id)
  if(patch.scale){const old=o.scale.slice();o.scale=patch.scale.slice(); enforce(o,old)}
  if(patch.position) o.position=patch.position.slice()
 }
 const enforce=(obj,oldScale)=>{
  const link=obj.type==='primitive' ? PRIMITIVES[obj.kind]?.link : null
  if(!link)return
  if(link==='xz') {if(obj.scale[0]!==oldScale[0])obj.scale[2]=obj.scale[0];else if(obj.scale[2]!==oldScale[2])obj.scale[0]=obj.scale[2]}
  else if(link==='xyz') {const i=[0,1,2].find(i=>obj.scale[i]!==oldScale[i]);if(i!==undefined)obj.scale[0]=obj.scale[1]=obj.scale[2]=obj.scale[i]}
 }
 const ctx={THREE:{Vector3:Vec3},getObject,getDef:(type)=>({scalable:!['group','node','staticbody3d'].includes(type)}),store,
  worldMatrix:id=>matrices(objects,id),validateNodeTree,updateObject,
  enforceLink:enforce,commit:l=>commits.push(l),toast:m=>msgs.push(m)}
 const content=parse('/** Congela una selección','/** Acción manual del Inspector').replaceAll('export function','function')
 vm.runInNewContext(content+'\nglobalThis.exports={beginUniformScale,applyUniformScale,finishUniformScale,cancelUniformScale}',ctx)
 return {...ctx.exports,objects,calls,commits,msgs,store}
}
const cube=(id,scale=[2,3,4],position=[0,0,0],extra={})=>({id,type:'primitive',kind:'box',scale:[...scale],position:[...position],parentId:null,...extra})
test('S04-01 multiplica XYZ sin igualarlos',()=>{
 const h=harness([cube('a')]),draft=h.beginUniformScale(['a']);assert.equal(h.applyUniformScale(draft,2),true)
 same(h.objects[0].scale,[4,6,8]); assert.equal(h.finishUniformScale(draft),true);assert.equal(h.commits.length,1)
})
test('S04-02 factor 1 sin mutación ni historial',()=>{
 const h=harness([cube('a')]),draft=h.beginUniformScale(['a']);h.applyUniformScale(draft,1)
 assert.equal(h.finishUniformScale(draft),false);assert.equal(h.commits.length,0);same(h.objects[0].scale,[2,3,4])
})
test('S04-03 preview reevalúa la base; no acumula factor',()=>{
 const h=harness([cube('a')]),d=h.beginUniformScale(['a']);h.applyUniformScale(d,3);h.applyUniformScale(d,2)
 same(h.objects[0].scale,[4,6,8]);h.finishUniformScale(d);assert.equal(h.commits.length,1)
})
test('S04-04 Escape restaura escala y posición',()=>{
 const h=harness([cube('a'),cube('b',[1,1,1],[10,0,0])]),d=h.beginUniformScale(['a','b']);h.applyUniformScale(d,2)
 assert.notDeepEqual(h.objects[1].position,[10,0,0]);h.cancelUniformScale(d)
 same(h.objects.map(o=>o.position),[[0,0,0],[10,0,0]]);same(h.objects[0].scale,[2,3,4]);assert.equal(h.commits.length,0)
})
test('S04-05 pivote de selección múltiple reproduce posiciones relativas',()=>{
 const h=harness([cube('a',[1,2,3],[0,0,0]),cube('b',[2,3,4],[10,0,0])]),d=h.beginUniformScale(['a','b']);h.applyUniformScale(d,2)
 same(h.objects.map(o=>o.position),[[-5,0,0],[15,0,0]]); same(h.objects[1].scale,[4,6,8])
 h.finishUniformScale(d);assert.equal(h.commits.length,1)
})
test('S04-06 padre-hijo seleccionado no escala doble el descendiente',()=>{
 const h=harness([cube('a',[2,2,2],[0,0,0],{type:'node3d'}),cube('b',[3,3,3],[2,0,0],{parentId:'a'})])
 const d=h.beginUniformScale(['a','b']);assert.equal(d.entries.length,1);h.applyUniformScale(d,2)
 same(h.objects[0].scale,[4,4,4]);same(h.objects[1].scale,[3,3,3])
})
test('S04-07 primitivas esfera y cilindro respetan sus ejes',()=>{
 const h=harness([{...cube('s',[2,2,2]),kind:'sphere'},{...cube('c',[2,3,2]),id:'c',kind:'cylinder'}])
 const d=h.beginUniformScale(['s','c']);h.applyUniformScale(d,2)
 same(h.objects[0].scale,[4,4,4]);same(h.objects[1].scale,[4,6,4])
})
test('S04-08 raíz escalada preserva posición local al escalar individualmente',()=>{
 const h=harness([cube('a',[1,1,1],[2,3,4])]),d=h.beginUniformScale(['a']);h.applyUniformScale(d,4)
 same(h.objects[0].position,[2,3,4])
})
test('S04-09 factor negativo, cero e infinito se rechazan sin mutación',()=>{
 const h=harness([cube('a')]),d=h.beginUniformScale(['a'])
 for(const f of [-1,0,NaN,Infinity,-Infinity])assert.equal(h.applyUniformScale(d,f),false)
 same(h.objects[0].scale,[2,3,4]);assert.equal(h.commits.length,0)
})
test('S04-10 tamaño demasiado pequeño se rechaza',()=>{
 const h=harness([cube('a',[0.01,0.2,0.5])]),d=h.beginUniformScale(['a']);assert.equal(h.applyUniformScale(d,0.5),false)
 same(h.objects[0].scale,[0.01,0.2,0.5])
})
test('S04-11 validación física agregada impide cambios parciales',()=>{
 const h=harness([cube('a',[2,2,2],[0,0,0],{type:'node3d',containsPhysics:true}),cube('b',[1,1,1],[5,0,0])]);const d=h.beginUniformScale(['a','b'])
 assert.equal(h.applyUniformScale(d,3),false);same(h.objects.map(o=>o.scale),[[2,2,2],[1,1,1]])
 assert.equal(h.calls.length,0);assert.equal(h.commits.length,0)
})
test('S04-12 selección no escalable bloqueada',()=>{
 const h=harness([cube('a',[1,1,1],[0,0,0],{type:'group'})]);assert.equal(h.beginUniformScale(['a']),null)
})
test('S04-13 Inspector conserva XYZ absoluto y añade factor independiente',()=>{
 const s=read('src/components/Inspector.vue');assert.match(s,/data-testid="uniform-scale-inspector"/)
 assert.match(s,/:model-value="obj.scale"/);assert.match(s,/@change="vec\('scale', \$event\)"/)
 assert.match(s,/beginUniformScale\(\[obj\.value\?\.id\]/);assert.match(s,/finishUniformScale\(uniformDraft\)/)
})
test('S04-14 · CA-TRANSFORM-S-OBJECTMODE-001 conserva R y Ctrl+S sin escala modal en Object Mode',()=>{
 const source=read('src/core/editor/keys.js')
 assert.match(source,/case 'r': store\.tool = 'select'; store\.gizmo = 'scale'/)
 assert.match(source,/if \(mod && k === 's'\).*?saveAll\(\)/)
 assert.doesNotMatch(source,/case 's':|_uniformScaleDraft|_uniformScaleKey|_endUniformScale/)
})
test('S04-15 HUD temporal sin cambio en Player',()=>{
 const t=read('src/components/Toolbar.vue'),overlay=read('src/components/ViewportOverlay.vue'),state=read('src/core/state/state.js')
 assert.doesNotMatch(t,/uniformScaleHud/);assert.match(overlay,/uniformScaleHud/);assert.match(state,/uniformScaleHud: ''/)
 assert.doesNotMatch(read('src/components/Inspector.vue'),/scale\s*:\s*\[factor, factor, factor\]/)
})
test('S04-16 Edit Mesh usa numericTransform y pivote existentes',()=>{
 const s=read('src/core/mesh/session-xform.js'),m=read('src/components/MeshPanel.vue')
 assert.match(s,/kind === 'uniformScale'/);assert.match(s,/this\._xform\(\{ s: new THREE\.Vector3\(value, value, value\) \}, n\.pivot\)/)
 assert.match(m,/@update:model-value="uniformMeshScale" @commit="numericCommit"/)
})
test('S04-17 modal Edit Mesh rechaza factor nulo o negativo',()=>{
 const s=read('src/core/mesh/session-modal.js');assert.match(s,/f <= 0 \|\| f > 10000/)
 assert.match(s,/m\.previewValid = false/);assert.match(s,/Factor de escala inválido/)
})
test('S04-18 dos factores diferentes no crean más de un Undo',()=>{
 const h=harness([cube('a')]),d=h.beginUniformScale(['a']);h.applyUniformScale(d,2);h.applyUniformScale(d,3);h.applyUniformScale(d,1.5);h.finishUniformScale(d)
 assert.equal(h.commits.length,1);same(h.objects[0].scale,[3,4.5,6])
})
test('S04-19 descendiente de padre bloqueado no inicia escala',()=>{
 const h=harness([cube('p',[1,1,1],[0,0,0],{type:'node3d',locked:true}),cube('c',[1,1,1],[1,0,0],{parentId:'p'})])
 assert.equal(h.beginUniformScale(['c']),null)
})
test('S04-20 repetir factor idéntico evita sincronizaciones redundantes',()=>{
 const h=harness([cube('a')]),d=h.beginUniformScale(['a']);h.applyUniformScale(d,2);h.applyUniformScale(d,2)
 assert.equal(h.calls.length,1)
})
test('S04-21 · CA-001 suprime el flujo modal en Object Mode sin alterar el estado de Edit Mesh',()=>{
 const source=read('src/core/editor/keys.js')
 assert.doesNotMatch(source,/_uniformScaleKey|_endUniformScale|uniformScaleHud|beginUniformScale/)
 const edit=read('src/core/mesh/session-modal.js')
 assert.match(edit,/Factor de escala inválido/)
})
test('S04-22 · Ctrl+S y el gizmo de escala conservan sus rutas originales',()=>{
 const source=read('src/core/editor/keys.js')
 assert.match(source,/if \(mod && k === 's'\).*?saveAll\(\)/)
 assert.match(source,/case 'r': store\.tool = 'select'; store\.gizmo = 'scale'/)
})
test('S04-23 factor numérico de malla comparte _xform y restaura base inicial',()=>{
 const src=read('src/core/mesh/session-xform.js');const a=src.indexOf('  numericTransform(kind, axis, value) {'),b=src.indexOf('  /** Confirma el último valor',a)
 const body=src.slice(a,b)
 let calls=[]
 const ctx={THREE:{Vector3,Quaternion},store:{space:'world'}}
 const f=vm.runInNewContext('({'+body+'})',ctx).numericTransform
 const edit={modal:null,gz:null,paintStroke:null,sel:{v:new Set([0,1])},mode:'vertex',numericDraft:null,
  poly:{v:[[1,1,1],[3,3,3]]},visual:{updateWorldMatrix(){},getWorldQuaternion(){return{}}},
  numericPosition(){return null},numericCancel(){},_prepXform(){this.xf={base:this.poly.v.map(v=>[...v])}},
  pivotWorld(){return new Vector3()},_restoreBase(v){this.poly.v=v.map(p=>[...p])},_xform(t,p){calls.push(t.s);},_liveUpdate(){}}
 assert.equal(f.call(edit,'uniformScale',-1,2),true)
 assert.equal(f.call(edit,'uniformScale',-1,3),true)
 assert.equal(calls.length,2)
 assert.deepEqual([calls[1].x,calls[1].y,calls[1].z],[3,3,3])
 assert.equal(f.call(edit,'uniformScale',-1,-1),false)
})
