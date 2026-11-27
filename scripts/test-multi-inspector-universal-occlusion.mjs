import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = name => fs.readFileSync(new URL('../src/' + name, import.meta.url), 'utf8')
const run = (code, context, exports) => {
  const stripped = code.replace(/^import .*$/gm, '').replace(/^export\s+(?=(const|function|class|async))/gm,'')
  return vm.runInNewContext(`${stripped}\n({${exports.join(',')}})`,context)
}

function inspector(nodes) {
  const graph = new Map(nodes.map(n => [n.id,n]))
  const calls = [], history = []
  const store = { project: {objects:nodes,environment:{occlusionBake:{version:1}}}, locked:false, play:{on:false}, edit:{on:false},
    editor:{syncObject(id) {calls.push(id)}} }
  const context = {
    store, getObject: id => graph.get(id),
    commit:label => history.push(label),
    validateNodeTree:(entries) => { if (entries.some(n => n.type==='invalid')) throw new Error('invalid') },
    getDef:type => ({base:type==='node'?'Node':'Node3D',scalable:!['group','node'].includes(type)}),
    OCCLUSION_NODE_TYPES:['primitive','mesh','model','terrain','road','nature'],
    PRIMITIVES:{sphere:{link:'xyz'},cylinder:{link:'xz'},box:{link:null}},
  }
  const api=run(source('core/state/multi-inspector.js'),context,['sharedValue','canEditShared','updateSharedSelection'])
  return {nodes,store,history,calls,...api}
}
const meshes=()=>['a','b','c'].map((id,i)=>({id,type:'mesh',kind:'box',props:{static:i===0},
  active:true,visible:true,locked:false,position:[i,i+1,i+2],rotation:[0,0,0],scale:[1,1,1],
  color:'#ffffff', roughness:0.8, metallic:0.2, opacity:1,castShadow:true}))

test('estado mixto y Estático aplicado a toda la selección en un único historial',()=>{
  const f=inspector(meshes())
  assert.equal(f.sharedValue(f.nodes,'static').mixed,true)
  assert.equal(f.updateSharedSelection(['a','b','c'],'static',true),true)
  assert.ok(f.nodes.every(n=>n.props.static===true))
  assert.equal(f.history.length,1)
  assert.equal(f.calls.length,3)
  assert.equal(f.store.project.environment.occlusionBake,null)
})
test('los valores coincidentes no crean operaciones de historial',()=>{
  const f=inspector(meshes());assert.equal(f.updateSharedSelection(['a','b','c'],'active',true),false)
  assert.equal(f.history.length,0)
})
test('los nodos bloqueados impiden cambios parciales',()=>{
  const f=inspector(meshes());f.nodes[1].locked=true
  assert.equal(f.updateSharedSelection(['a','b','c'],'static',true),false)
  assert.equal(f.nodes[2].props.static,false);assert.equal(f.history.length,0)
})
test('los nodos vinculados no se alteran',()=>{
  const f=inspector(meshes());f.nodes[1].sceneInstanceOwner='prefab'
  assert.equal(f.updateSharedSelection(['a','b','c'],'visible',false),false)
  assert.ok(f.nodes.every(n=>n.visible===true))
})
test('edición de un eje conserva los otros dos ejes de cada nodo',()=>{
  const f=inspector(meshes())
  assert.equal(f.updateSharedSelection(['a','b','c'],'position',4,{axis:1}),true)
  assert.deepEqual([...f.nodes[1].position],[1,4,3]);assert.equal(f.history.length,1)
})
test('escala inválida o valor numérico no finito se rechazan antes de mutar',()=>{
  const f=inspector(meshes());assert.equal(f.updateSharedSelection(['a','b','c'],'scale',0,{axis:0}),false)
  assert.equal(f.updateSharedSelection(['a','b','c'],'position',NaN,{axis:2}),false)
  assert.ok(f.nodes.every(n=>n.scale[0]===1));assert.equal(f.history.length,0)
})
test('las primitivas enlazadas respetan escala uniforme y vínculo XZ',()=>{
  const f=inspector([0,1].map(i=>({...meshes()[i],type:'primitive',kind:'sphere'})))
  assert.equal(f.updateSharedSelection(['a','b'],'scale',2,{axis:0}),true)
  assert.ok(f.nodes.every(n=>n.scale.every(v=>v===2)))
  f.nodes.forEach(n=>{n.kind='cylinder'})
  assert.equal(f.updateSharedSelection(['a','b'],'scale',3,{axis:2}),true)
  assert.ok(f.nodes.every(n=>n.scale[0]===3 && n.scale[2]===3 && n.scale[1]===2))
})
test('fallo de sincronización revierte todos los nodos sin registrar Undo',()=>{
  const f=inspector(meshes());let n=0
  f.store.editor.syncObject=()=>{if(++n===2)throw Error('sync')}
  assert.equal(f.updateSharedSelection(['a','b','c'],'active',false),false)
  assert.ok(f.nodes.every(node=>node.active===true));assert.equal(f.history.length,0)
})
test('las selecciones inválidas y los campos no compartidos se rechazan',()=>{
  const f=inspector(meshes())
  assert.equal(f.updateSharedSelection(['a','a'],'visible',false),false)
  assert.equal(f.updateSharedSelection(['a','b'],'props.mesh',false),false)
  f.nodes[1].type='node'
  assert.equal(f.canEditShared(f.nodes,'static'),false)
})
test('apariencia compartida acepta valores válidos y preserva las diferencias ajenas',()=>{
  const f=inspector(meshes())
  assert.equal(f.updateSharedSelection(['a','b','c'],'roughness',0.5),true)
  assert.ok(f.nodes.every(n=>n.roughness===0.5))
  assert.equal(f.updateSharedSelection(['a','b','c'],'color','#ff0000'),true)
  assert.ok(f.nodes.every(n=>n.color==='#ff0000'))
  assert.equal(f.updateSharedSelection(['a','b','c'],'opacity',2),false)
})

test('los escalones compartidos de varias escaleras cambian juntos sin afectar otras primitivas',()=>{
  const nodes=meshes().slice(0,2).map(n=>({...n,type:'primitive',kind:'stairs',props:{steps:8,static:false}}))
  const f=inspector(nodes)
  assert.equal(f.canEditShared(nodes,'steps'),true)
  assert.equal(f.updateSharedSelection(['a','b'],'steps',16),true)
  assert.ok(nodes.every(n=>n.props.steps===16))
  assert.equal(f.history.length,1)
  assert.equal(f.updateSharedSelection(['a','b'],'steps',0),false)
})
test('Recibe cortes conserva el estado mixto y aplica el mismo valor a primitivas compatibles',()=>{
  const nodes=meshes().slice(0,2).map((n,i)=>({...n,type:'primitive',kind:'box',props:{carve:i===0}}))
  const f=inspector(nodes)
  assert.equal(f.sharedValue(nodes,'carve').mixed,true)
  assert.equal(f.updateSharedSelection(['a','b'],'carve',false),true)
  assert.ok(nodes.every(n=>n.props.carve===false))
  assert.equal(f.history.length,1)
})

class Vec3 {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
  clone(){return new Vec3(this.x,this.y,this.z)}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this}
  multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this}
  cross(v){return new Vec3(this.y*v.z-this.z*v.y,this.z*v.x-this.x*v.z,this.x*v.y-this.y*v.x)}
  lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}
  length(){return Math.sqrt(this.lengthSq())}
  normalize(){const d=this.length()||1;return this.multiplyScalar(1/d)}
  distanceToSquared(v){return this.clone().sub(v).lengthSq()}
  fromBufferAttribute(a,i){this.x=a.getX(i);this.y=a.getY(i);this.z=a.getZ(i);return this}
  applyMatrix4(m){const e=m.elements;const {x,y,z}=this;this.x=e[0]*x+e[4]*y+e[8]*z+e[12];this.y=e[1]*x+e[5]*y+e[9]*z+e[13];this.z=e[2]*x+e[6]*y+e[10]*z+e[14];return this}
}
class Mat4 {
  constructor(){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}
  makeBasis(u,v,n){this.elements=[u.x,u.y,u.z,0,v.x,v.y,v.z,0,n.x,n.y,n.z,0,0,0,0,1];return this}
  setPosition(c){this.elements[12]=c.x;this.elements[13]=c.y;this.elements[14]=c.z;return this}
  toArray(){return [...this.elements]}
}
const occlusion=run(source('engine/runtime/render/occlusion-patches.js'),{Vector3:Vec3,Matrix4:Mat4},['meshOcclusionPatches','meshOcclusionSignature'])
function geometry(vertices,indices=null){
  const array=vertices.flat(),p={count:vertices.length,itemSize:3,getX:i=>array[i*3],getY:i=>array[i*3+1],getZ:i=>array[i*3+2],array}
  return {position:p,index:indices&&{count:indices.length,getX:i=>indices[i]},mesh:{
    geometry:{attributes:{position:p},index:indices&&{count:indices.length,getX:i=>indices[i]},drawRange:{start:0,count:Infinity},groups:[]},
    matrixWorld:new Mat4(),updateWorldMatrix(){},
  }}
}
const quad=(x0,y0,x1,y1,z=-3)=>[[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y0,z],[x1,y1,z],[x0,y1,z]]
test('los triángulos no indexados de un cuadrilátero forman una superficie completa',()=>{
  const f=geometry(quad(-2,-2,2,2));const p=occlusion.meshOcclusionPatches(f.mesh)
  assert.equal(p.length,1);assert.ok(Math.abs(p[0][12])<1e-6);assert.ok(Math.abs(p[0][13])<1e-6)
})
test('las mallas editadas con dos paredes y un hueco no producen un oclusor dentro del hueco',()=>{
  const f=geometry([...quad(-2,-1,-1,1),...quad(1,-1,2,1)])
  const matrices=occlusion.meshOcclusionPatches(f.mesh)
  assert.equal(matrices.length,2)
  assert.ok(matrices.every(m=>Math.abs(m[12])>1))
})
test('geometría indexada y no indexada producen geometría de oclusión equivalente',()=>{
  const nonindexed=geometry(quad(-1,-1,1,1))
  const indexed=geometry([[-1,-1,-3],[1,-1,-3],[1,1,-3],[-1,1,-3]],[0,1,2,0,2,3])
  assert.equal(occlusion.meshOcclusionPatches(nonindexed.mesh).length,occlusion.meshOcclusionPatches(indexed.mesh).length)
})
test('triángulo aislado produce una superficie interna conservadora',()=>{
  const f=geometry([[0,0,-3],[4,0,-3],[0,4,-3]])
  const p=occlusion.meshOcclusionPatches(f.mesh);assert.equal(p.length,1)
  const m=p[0];for(const a of [-0.5,0.5])for(const b of [-0.5,0.5]) {
    const x=m[12]+a*m[0]+b*m[4],y=m[13]+a*m[1]+b*m[5]
    assert.ok(x>0 && y>0 && x+y<4)
  }
})
test('triángulos degenerados no pueden probar oclusión',()=>{
  const f=geometry([[0,0,0],[1,1,0],[2,2,0]]);assert.equal(occlusion.meshOcclusionPatches(f.mesh).length,0)
})
test('la firma geométrica detecta cambios de coordenadas sin modificar versiones de atributos',()=>{
  const f=geometry(quad(-1,-1,1,1)),first=occlusion.meshOcclusionSignature(f.mesh)
  f.position.array[0]+=0.2
  assert.notEqual(first,occlusion.meshOcclusionSignature(f.mesh))
})
test('los límites GPU se procesan por lotes sin truncar las superficies candidatas',()=>{
  const src=source('engine/runtime/render/occlusion-bake.js')
  assert.match(src,/patchStart\s*\+=\s*patchSize/)
  assert.match(src,/meshStart\s*\+=\s*meshSize/)
  assert.doesNotMatch(src,/\.slice\(0,\s*MAX_OCCLUDERS\)/)
  assert.match(src,/int axis = 2;/)
})
test('la versión invalida horneados anteriores y la cámara verifica firma y límites',()=>{
  const s=source('engine/runtime/render/occlusion-static.js')
  const c=source('engine/runtime/render/camera-occlusion.js')
  assert.match(s,/OCCLUSION_BAKE_VERSION = 2/)
  assert.match(c,/meshOcclusionSignature\(mesh\)/)
  assert.match(c,/inFrontOfNear\(mesh, camera\)/)
})
