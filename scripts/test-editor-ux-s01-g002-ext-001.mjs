// QA de selección múltiple: prueba la lógica real con dobles matemáticos mínimos, sin WebGL.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const src = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
const load = (name, symbol, deps) => {
  const code = src(name).replace(/^import .*$/gm, '').replace(`export const ${symbol} =`, `const ${symbol} =`)
  const ctx = { ...deps }
  vm.runInNewContext(`${code}\nglobalThis.loaded = ${symbol}`, ctx, { filename: name })
  return ctx.loaded
}
const helperSource = src('engine/runtime/nodes/three-helpers.js')
const nodeScaleTarget = new Function(helperSource.replace(/^import .*$/gm, '').replace(/^export /gm, '') + '\nreturn nodeScaleTarget')()
class V {
  constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z }
  clone() { return new V(this.x,this.y,this.z) }
  copy(a) { this.x=a.x; this.y=a.y; this.z=a.z; return this }
  add(a) { this.x+=a.x;this.y+=a.y;this.z+=a.z;return this }
  sub(a) { this.x-=a.x;this.y-=a.y;this.z-=a.z;return this }
  multiply(a) { this.x*=a.x;this.y*=a.y;this.z*=a.z;return this }
  multiplyScalar(n) { this.x*=n;this.y*=n;this.z*=n;return this }
  applyQuaternion(q) { const x=this.x,y=this.y,z=this.z; const u=new V(q.x,q.y,q.z); const c1=cross(u,new V(x,y,z)).multiplyScalar(2); const c2=cross(u,c1);this.x=x+c1.x*q.w+c2.x;this.y=y+c1.y*q.w+c2.y;this.z=z+c1.z*q.w+c2.z;return this }
  toArray() { return [this.x,this.y,this.z] }
  equals(v) { return Math.abs(this.x-v.x)<1e-8&&Math.abs(this.y-v.y)<1e-8&&Math.abs(this.z-v.z)<1e-8 }
}
function cross(a,b) { return new V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x) }
class Q {
  constructor(x=0,y=0,z=0,w=1) { this.x=x;this.y=y;this.z=z;this.w=w }
  clone() { return new Q(this.x,this.y,this.z,this.w) }
  copy(a) { Object.assign(this,{x:a.x,y:a.y,z:a.z,w:a.w});return this }
  identity() { Object.assign(this,{x:0,y:0,z:0,w:1});return this }
  invert() { this.x=-this.x;this.y=-this.y;this.z=-this.z;return this }
  multiply(b) { const a=this.clone();this.x=a.x*b.w+a.w*b.x+a.y*b.z-a.z*b.y;this.y=a.y*b.w+a.w*b.y+a.z*b.x-a.x*b.z;this.z=a.z*b.w+a.w*b.z+a.x*b.y-a.y*b.x;this.w=a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z;return this }
  normalize() { const n=Math.hypot(this.x,this.y,this.z,this.w);this.x/=n;this.y/=n;this.z/=n;this.w/=n;return this }
  equals(q) { return ['x','y','z','w'].every(k=>Math.abs(this[k]-q[k])<1e-8) }
  setZ(rad) { this.z=Math.sin(rad/2);this.w=Math.cos(rad/2);return this }
}
class Obj { constructor() { this.position=new V();this.quaternion=new Q();this.scale=new V(1,1,1);this.userData={};this.parent=null }
  getWorldPosition(v) { return v.copy(this.position) }
  getWorldQuaternion(q) { return q.copy(this.quaternion) }
  removeFromParent() { this.parent?.remove(this);this.parent=null }
}
const THREE={ Vector3:V, Quaternion:Q, Object3D:Obj, LineBasicMaterial:class{} }
const approxim=(a,b) => assert.ok(a.every((x,i)=>Math.abs(x-b[i])<1e-7),`${a} != ${b}`)
function scenario({parentChild=false,locked=false}={}) {
  const store={selectedIds:['a','b'],selectedId:'b',gizmo:'translate',space:'world',tool:'select',prefs:{},play:{on:false}}
  const models=new Map([['a',{id:'a',name:'A',type:'primitive',parentId:null,locked:false}],['b',{id:'b',name:'B',type:'primitive',parentId:parentChild?'a':null,locked}]] )
  const parents=new Map()
  const fakeParent={worldToLocal(v){return v},getWorldQuaternion(q){return q.identity()}}
  const nodes=new Map(['a','b'].map((id,i)=> {
    const n=new Obj();n.position.x=i*2;n.userData={visual:{scale:new V(1,1,1)}}
    n.parent=fakeParent
    Object.defineProperty(n,'rotation',{get(){return {x:0,y:0,z:2*Math.atan2(n.quaternion.z,n.quaternion.w)}}})
    return [id,n]
  }))
  const patches=[],commits=[]
  const deps={THREE,nodeScaleTarget,enforceLink:()=>{},DEG:Math.PI/180,store,getObject:id=>models.get(id),getDef:()=>({scalable:true}),
    selectionRoots:()=>parentChild?['a']:['a','b'],
    updateObject:(id,patch,opt)=>{patches.push({id,patch,opt});Object.assign(models.get(id),patch)},
    commit:label=>commits.push(label)}
  const gizmo=load('core/editor/gizmo.js','gizmoMethods',deps)
  const selection=load('core/editor/selection.js','selectionMethods',deps)
  const overlay={add(obj){obj.parent=this},remove(obj){obj.parent=null}}
  const editor={...gizmo,...selection,nodes,vp:{overlay,requestRender(){}},_lockedChain(id){return !!models.get(id)?.locked}, _updateBoxes(){},edit:null}
  editor.setSelection=()=>editor._detachAll() // El refresco visual está cubierto por las suites de selección.
  const tc=(mode)=>({mode,object:null,enabled:false,helper:{visible:false},getHelper(){return this.helper},setSpace(x){this.space=x},detach(){this.object=null},attach(o){this.object=o}})
  editor.tc=tc('translate');editor.tcRot=tc('rotate');editor.tcScl=tc('scale')
  editor._tcs=()=>[editor.tcScl,editor.tc,editor.tcRot]
  return {editor,store,nodes,patches,commits,models}
}
test('EXT-01 · Shift/Ctrl conserva lista de ids y Ctrl tiene prioridad en Jerarquía',()=>{
  const tree=src('components/SceneTree.vue'), pointer=src('core/editor/pointer.js'), state=src('core/state/objects.js')
  assert.match(tree,/e\.shiftKey && !e\.ctrlKey && !e\.metaKey && anchor/)
  assert.match(tree,/toggle: true/)
  assert.match(tree,/additive: e\.shiftKey/)
  assert.match(pointer,/object \|\| !\(e\.shiftKey \|\| e\.ctrlKey \|\| e\.metaKey\)/)
  assert.match(state,/else if \(toggle\)/)
  assert.match(state,/else if \(additive\)/)
})
test('EXT-02 · pivote común en centro de dos posiciones',()=>{
  const {editor}=scenario()
  const pivot=editor._makeMultiPivot(['a','b'])
  approxim(pivot.position.toArray(),[1,0,0])
  assert.equal(pivot.parent,editor.vp.overlay)
})
test('EXT-03 · trasladar dos raíces actualiza las dos y confirma una vez',()=>{
  const {editor,nodes,patches,commits}=scenario()
  editor._makeMultiPivot(['a','b']);editor._beginMultiDrag()
  editor._multiPivot.position.x+=3
  editor._applyMultiDrag('translate')
  approxim(nodes.get('a').position.toArray(),[3,0,0]);approxim(nodes.get('b').position.toArray(),[5,0,0])
  assert.equal(patches.length,0,'no guarda por frame')
  editor._finishMultiDrag('translate')
  assert.equal(patches.length,2);assert.equal(commits.length,1)
  assert.ok(patches.every(x=>x.opt.commit===false))
})
test('EXT-04 · rotar 90 grados mantiene distancias al pivote',()=>{
  const {editor,nodes,patches,commits}=scenario()
  editor._makeMultiPivot(['a','b']);editor._beginMultiDrag()
  editor._multiPivot.quaternion.setZ(Math.PI/2)
  editor._applyMultiDrag('rotate')
  approxim(nodes.get('a').position.toArray(),[1,-1,0]);approxim(nodes.get('b').position.toArray(),[1,1,0])
  editor._finishMultiDrag('rotate')
  assert.equal(commits.length,1);assert.ok(patches.every(p=>p.patch.rotation))
})
test('EXT-05 · escalar conjuntamente cambia distancias y escalas visuales, no escala de padres',()=>{
  const {editor,nodes,patches,commits}=scenario()
  editor._makeMultiPivot(['a','b']);editor._beginMultiDrag()
  editor._multiPivot.scale.x=2
  editor._applyMultiDrag('scale')
  approxim(nodes.get('a').position.toArray(),[-1,0,0]);approxim(nodes.get('b').position.toArray(),[3,0,0])
  approxim(nodes.get('a').userData.visual.scale.toArray(),[2,1,1])
  editor._finishMultiDrag('scale')
  assert.equal(patches.length,2);assert.equal(commits.length,1)
  assert.ok(patches.every(p=>p.patch.position&&p.patch.scale))
})
test('EXT-06 · padre e hijo seleccionados producen una sola raíz transformable',()=>{
  const {editor}=scenario({parentChild:true})
  assert.deepEqual([...editor._multiTargets()],['a'])
})
test('EXT-07 · selección mixta con nodo bloqueado no afecta al bloqueado',()=>{
  const {editor}=scenario({locked:true})
  assert.deepEqual([...editor._multiTargets()],['a'])
})
test('EXT-08 · gesto sin desplazamiento no produce una entrada de historial',()=>{
  const {editor,patches,commits}=scenario()
  editor._makeMultiPivot(['a','b']);editor._beginMultiDrag();editor._finishMultiDrag('translate')
  assert.equal(commits.length,0);assert.equal(patches.length,0)
})
test('EXT-09 · pivote provisional se libera al cambiar selección',()=>{
  const {editor}=scenario();const p=editor._makeMultiPivot(['a','b'])
  editor._detachAll();assert.equal(p.parent,null);assert.equal(editor._multiPivot,null)
})
test('EXT-10 · un único TransformControls por modo; snap y modo universal conservados',()=>{
  const gizmo=src('core/editor/gizmo.js'), select=src('core/editor/selection.js'), editor=src('core/editor.js')
  assert.match(gizmo,/this\.tcScl = new TransformControls/)
  assert.match(gizmo,/this\.tc = new TransformControls/)
  assert.match(gizmo,/this\.tcRot = new TransformControls/)
  assert.match(select,/g === 'universal'/)
  assert.match(editor,/setTranslationSnap/);assert.match(editor,/setRotationSnap/);assert.match(editor,/setScaleSnap/)
})
test('EXT-11 · historial conserva selección y aplica operaciones como un solo commit',()=>{
  const history=src('core/state/history.js'), gizmo=src('core/editor/gizmo.js')
  assert.match(history,/selectedIds: \[\.\.\.store\.selectedIds\]/)
  assert.match(gizmo,/commit\(`\$\{mode/)
})
test('EXT-12 · mover y modo universal usan el mismo pivote, sin crear gizmos nuevos',()=>{
  const {editor,store}=scenario()
  editor._updateGizmoMode()
  const pivot=editor._multiPivot
  assert.equal(editor.tc.object,pivot)
  assert.equal(editor.tcScl.object,null)
  store.gizmo='universal';editor._updateGizmoMode()
  assert.equal(editor.tc.object,pivot)
  assert.equal(editor.tcRot.object,pivot)
  assert.equal(editor.tcScl.object,pivot)
  assert.equal(editor.tcScl.space,'local')
  editor._detachAll()
})
test('EXT-13 · si se selecciona padre e hijo, el gizmo se ancla solo al padre',()=>{
  const {editor}=scenario({parentChild:true})
  editor._updateGizmoMode()
  assert.equal(editor._multiPivot,undefined)
  assert.equal(editor.tc.object,editor.nodes.get('a'))
})
test('EXT-14 · el seleccionado bloqueado no impide mover otros nodos editables',()=>{
  const {editor}=scenario({locked:true})
  editor._updateGizmoMode()
  assert.equal(editor.tc.object,editor.nodes.get('a'))
})
test('EXT-15 · mover raíces con padre rotado conserva coordenadas locales correctas',()=>{
  const {editor,nodes,patches,commits}=scenario()
  const b=nodes.get('b')
  const base=new V(5,0,0), angle=new Q().setZ(Math.PI/2)
  b.parent={
    worldToLocal(v){return v.sub(base).applyQuaternion(angle.clone().invert())},
    getWorldQuaternion(q){return q.copy(angle)},
  }
  b.getWorldPosition=v=>v.copy(b.position).applyQuaternion(angle).add(base)
  b.getWorldQuaternion=q=>q.copy(angle).multiply(b.quaternion)
  editor._makeMultiPivot(['a','b']);editor._beginMultiDrag()
  editor._multiPivot.position.x+=3
  editor._applyMultiDrag('translate')
  approxim(b.position.toArray(),[2,-3,0]) // +X global equivale a -Y local.
  editor._finishMultiDrag('translate')
  assert.equal(patches.length,2);assert.equal(commits.length,1)
})
