// Gate LF-NODE-COLLISION-TRIMESH-G001: fuentes, persistencia y malla triangulada.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {newPhysicsShape,validatePhysicsShape,validatePhysicsTree} from '../src/engine/runtime/physics/shapes.js'
import {isTriMeshSource,triMeshSources,resolveTriMeshSource} from '../src/engine/runtime/physics/trimesh-source.js'
import {physicsNodePlan} from '../src/engine/runtime/physics/node-body-plan.js'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const body=(id='b',type='staticbody3d',parentId=null)=>({id,type,parentId,scale:[1,1,1],props:type==='staticbody3d'?{friction:0.5,restitution:0}:{mass:1,gravityScale:1,linearDamping:0.2,angularDamping:0.2,friction:0.5,restitution:0,canSleep:true}})
const mesh=(id='m',parentId='b',type='mesh')=>({id,type,parentId,scale:[2,1,4],visible:true})
const shape=(id='s',sourceId='m',parentId='b')=>({id,type:'collisionshape3d',parentId,scale:[1,1,1],visible:true,props:{shape:{type:'TriMeshShape3D',sourceId},disabled:false}})

test('TM-01: recurso sin vértices duplicados y validación de ID',()=>{
 assert.deepEqual(newPhysicsShape('mesh'),{type:'TriMeshShape3D',sourceId:''})
 assert.equal(validatePhysicsShape(newPhysicsShape('mesh')),true)
 assert.throws(()=>validatePhysicsShape({type:'TriMeshShape3D',sourceId:123}),/ID/)
 assert.throws(()=>validatePhysicsShape({type:'TriMeshShape3D',sourceId:'x'.repeat(140)}),/ID/)
})
test('TM-02: fuente de primitiva bajo StaticBody3D',()=>{
 const a=[body(),mesh('m','b','primitive'),shape()]
 assert.equal(triMeshSources(a,a[2]).length,1)
 assert.equal(resolveTriMeshSource(a,a[2]).type,'primitive')
 assert.equal(physicsNodePlan(a).length,1)
})
test('TM-03: fuente de Mesh editada bajo un Node3D intermedio',()=>{
 const a=[body(),{id:'folder',type:'node3d',parentId:'b',scale:[1,1,1]},mesh('m','folder'),shape()]
 assert(isTriMeshSource(a,a[3],a[2]));assert.equal(validatePhysicsTree(new Map(a.map(x=>[x.id,x]))),true)
})
test('TM-04: nunca toma fuente de otro StaticBody3D o padre físico anidado',()=>{
 const a=[body(),body('other','staticbody3d','b'),mesh('m','other'),shape()]
 assert.equal(isTriMeshSource(a,a[3],a[2]),false)
 assert.throws(()=>validatePhysicsTree(new Map(a.map(x=>[x.id,x]))),/origen/)
})
test('TM-05: la forma no se admite en cuerpo dinámico',()=>{
 const a=[body('b','rigidbody3d'),mesh(),shape()]
 assert.throws(()=>validatePhysicsTree(new Map(a.map(x=>[x.id,x]))),/solo se admite/)
})
test('TM-06: sin fuente no fabrica un colisionador invisible',()=>{
 const a=[body(),shape('s','')]
 assert.equal(physicsNodePlan(a).length,1)
 assert.throws(()=>resolveTriMeshSource(a,a[1]),/selecciona/)
})
test('TM-07: fuente eliminada se rechaza con error claro',()=>{
 const a=[body(),shape()]
 assert.throws(()=>resolveTriMeshSource(a,a[1]),/no pertenece/)
})
test('TM-08: malla oculta o padre oculto rechazada',()=>{
 const a=[body(),{id:'folder',type:'node3d',parentId:'b',visible:false,scale:[1,1,1]},mesh('m','folder'),shape()]
 assert.throws(()=>resolveTriMeshSource(a,a[3]),/oculto/)
})
test('TM-09: recurso serializable y persistente por ID sin copiar geometría',()=>{
 const src=[body(),mesh(),shape()]
 const back=JSON.parse(JSON.stringify(src))
 assert.deepEqual(back[2].props.shape,{type:'TriMeshShape3D',sourceId:'m'})
 assert.equal(resolveTriMeshSource(back,back[2]).id,'m')
})
test('TM-10: cada body solo usa sus CollisionShape3D habilitadas',()=>{
 const a=[body(),mesh(),shape(),{...shape('s2','m'),props:{shape:newPhysicsShape('mesh'),disabled:true}}]
 assert.deepEqual(physicsNodePlan(a)[0].shapes.map(s=>s.id),['s'])
})
test('TM-11: declaración de Inspector, menú y Player',()=>{
 assert.match(read('src/components/Inspector.vue'),/TriMeshShape3D \(vértices\)/)
 assert.match(read('src/components/Inspector.vue'),/triMeshCandidates/)
 assert.match(read('src/core/commands.js'),/newPhysicsShape\('mesh'\)/)
 assert.match(read('src/engine/runtime/physics/node-bodies.js'),/world\._meshShape\(positions, indices, 1, 1, 1\)/)
 assert.match(read('src/engine/runtime/package/game.js'),/PlayMode/)
})
test('TM-12: límites, giro por escala negativa y geometría de preview usan la misma extracción',()=>{
 const geo=read('src/engine/runtime/physics/trimesh-geometry.js')
 assert.match(geo,/LIMIT_TRIANGLES/);assert.match(geo,/LIMIT_VERTICES/)
 assert.match(geo,/M\.determinant\(\) < 0/)
 assert.match(read('src/engine/runtime/nodes/physics.js'),/triMeshGeometry\(sourceRoot,root\)/)
})

const fakeThree = `
class Matrix4 {
 constructor(tx=0,ty=0,tz=0,sx=1,sy=1,sz=1){Object.assign(this,{tx,ty,tz,sx,sy,sz})}
 clone(){return new Matrix4(this.tx,this.ty,this.tz,this.sx,this.sy,this.sz)}
 invert(){const x=this.tx,y=this.ty,z=this.tz;this.tx=-x/this.sx;this.ty=-y/this.sy;this.tz=-z/this.sz;this.sx=1/this.sx;this.sy=1/this.sy;this.sz=1/this.sz;return this}
 copy(m){Object.assign(this,m);return this}
 multiply(b){this.tx+=this.sx*b.tx;this.ty+=this.sy*b.ty;this.tz+=this.sz*b.tz;this.sx*=b.sx;this.sy*=b.sy;this.sz*=b.sz;return this}
 determinant(){return this.sx*this.sy*this.sz}
}
class Vector3 {
 fromBufferAttribute(a,i){this.x=a.getX(i);this.y=a.getY(i);this.z=a.getZ(i);return this}
 applyMatrix4(m){this.x=this.x*m.sx+m.tx;this.y=this.y*m.sy+m.ty;this.z=this.z*m.sz+m.tz;return this}
}
export {Matrix4,Vector3}
`
const geoSrc = read('src/engine/runtime/physics/trimesh-geometry.js').replace("from 'three'",`from 'data:text/javascript,${encodeURIComponent(fakeThree)}'`)
const {triMeshGeometry}=await import('data:text/javascript,'+encodeURIComponent(geoSrc))
const {Matrix4}=await import('data:text/javascript,'+encodeURIComponent(fakeThree))
function geometryFixture(sx=10, tx=5) {
 const arr=[[0,0,0],[1,0,0],[0,0,1]]
 const attr={itemSize:3,count:3,getX:i=>arr[i][0],getY:i=>arr[i][1],getZ:i=>arr[i][2]}
 const mesh3d={isMesh:true,visible:true,userData:{},matrixWorld:new Matrix4(tx,0,0,sx,1,sx),updateWorldMatrix(){},geometry:{index:null,getAttribute:n=>n==='position'?attr:null}}
 const source={userData:{visual:{traverse(fn){fn(mesh3d)}}},updateWorldMatrix(){}}
 const collider={matrixWorld:new Matrix4(1,0,0),updateWorldMatrix(){}}
 return {source,collider,mesh3d}
}
test('TM-13: escala y desplazamiento de primitiva traducidos a coordenadas locales del collider',()=>{
 const {source,collider}=geometryFixture()
 const result=triMeshGeometry(source,collider)
 assert.deepEqual([...result.positions],[4,0,0,14,0,0,4,0,10])
 assert.deepEqual([...result.indices],[0,1,2])
})
test('TM-14: escala espejada revierte winding de triángulos',()=>{
 const {source,collider,mesh3d}=geometryFixture(-2)
 mesh3d.matrixWorld.sz=1
 const result=triMeshGeometry(source,collider)
 assert.deepEqual([...result.indices],[0,2,1])
})
test('TM-15: malla con vértices no finitos falla sin crear forma física',()=>{
 const f=geometryFixture()
 f.mesh3d.geometry.getAttribute=()=>({itemSize:3,count:3,getX:()=>NaN,getY:()=>0,getZ:()=>0})
 assert.throws(()=>triMeshGeometry(f.source,f.collider),/no finito/)
})
test('TM-16: geometría sin triángulos debe rechazarse',()=>{
 const f=geometryFixture()
 f.mesh3d.geometry.getAttribute=()=>({itemSize:3,count:0})
 assert.throws(()=>triMeshGeometry(f.source,f.collider),/no contiene triángulos/)
})
test('TM-17: tras sincronizar toda la escena se reconstruye la previsualización',()=>{
 assert.match(read('src/engine/runtime/scene-graph.js'),/this\._refreshTriMeshShapes\(\)/)
})
