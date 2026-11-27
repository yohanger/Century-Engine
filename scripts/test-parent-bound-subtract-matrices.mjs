import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cube } from '../src/engine/runtime/mesh/generators.js'
import { polyBuffers } from '../src/engine/runtime/mesh/buffers.js'
import { meshSubtractSourcePoly, meshSubtractSourceSignature, resolveMeshSubtractSource } from '../src/engine/runtime/mesh/mesh-subtract-source.js'
import { nearestMeshParent, nodeEffectiveActive } from '../src/engine/runtime/nodes/hierarchy.js'
import { source, THREE as fixtureThree, Geo, Attr, box, nodeFor } from './fixtures/csg-fixture.mjs'

class Matrix4 {
  constructor() { this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1] }
  clone() { const m=new Matrix4();m.elements=[...this.elements];return m }
  makeScale(x,y,z) { this.elements=[x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1];return this }
  multiply(b) {
    const a=this.elements,c=b.elements,out=new Array(16).fill(0)
    for(let j=0;j<4;j++) for(let i=0;i<4;i++) for(let k=0;k<4;k++) out[j*4+i]+=a[k*4+i]*c[j*4+k]
    this.elements=out;return this
  }
  determinant() {
    const a=this.elements
    const [a00,a01,a02,a10,a11,a12,a20,a21,a22]=[a[0],a[4],a[8],a[1],a[5],a[9],a[2],a[6],a[10]]
    return a00*(a11*a22-a12*a21)-a01*(a10*a22-a12*a20)+a02*(a10*a21-a11*a20)
  }
  invert() {
    const a=this.elements,det=this.determinant()
    if (Math.abs(det)<1e-12) throw new Error('Matriz singular')
    const b=new Matrix4().elements
    const A=[[a[0],a[4],a[8]],[a[1],a[5],a[9]],[a[2],a[6],a[10]]]
    const inv=[
      [(A[1][1]*A[2][2]-A[1][2]*A[2][1])/det,(A[0][2]*A[2][1]-A[0][1]*A[2][2])/det,(A[0][1]*A[1][2]-A[0][2]*A[1][1])/det],
      [(A[1][2]*A[2][0]-A[1][0]*A[2][2])/det,(A[0][0]*A[2][2]-A[0][2]*A[2][0])/det,(A[0][2]*A[1][0]-A[0][0]*A[1][2])/det],
      [(A[1][0]*A[2][1]-A[1][1]*A[2][0])/det,(A[0][1]*A[2][0]-A[0][0]*A[2][1])/det,(A[0][0]*A[1][1]-A[0][1]*A[1][0])/det],
    ]
    const t=[a[12],a[13],a[14]]
    for(let i=0;i<3;i++) {
      for(let j=0;j<3;j++) b[j*4+i]=inv[i][j]
      b[12+i]=-inv[i].reduce((sum,value,j)=>sum+value*t[j],0)
    }
    this.elements=b;return this
  }
}
const point=(m,[x,y,z])=>{
  const a=m.elements
  return [a[0]*x+a[4]*y+a[8]*z+a[12],a[1]*x+a[5]*y+a[9]*z+a[13],a[2]*x+a[6]*y+a[10]*z+a[14]]
}
function local(o) {
  const radians=(o.rotation?.[1] || 0)*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians)
  const [x,y,z]=o.position || [0,0,0]
  const m=new Matrix4()
  m.elements=[c,0,-s,0,0,1,0,0,s,0,c,0,x,y,z,1]
  if(o.type==='node3d') m.multiply(new Matrix4().makeScale(...o.scale))
  return m
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`)

function setup(yaw) {
  const objects=[
    {id:'stairs',type:'primitive',kind:'stairs',position:[8,2,-5],rotation:[0,yaw,0],scale:[4,2,4],props:{steps:8}},
    {id:'source',type:'mesh',parentId:'stairs',position:[.2,0,.1],rotation:[0,0,0],scale:[1,1,1],props:{mesh:cube(.4,.4,.4).toJSON()}},
    {id:'hollow',type:'meshSubtract',parentId:'stairs',position:[.3,0,0],rotation:[0,0,0],scale:[1,1,1],props:{sourceId:'source'}},
    {id:'door',type:'subtract',parentId:'stairs',kind:'box',position:[.3,0,0],rotation:[0,0,0],scale:[.4,.5,.4],props:{}},
  ]
  const nodes=new Map(objects.map(o=>[o.id,nodeFor(box([1,1,1]))]))
  const cutter=nodes.get('hollow')
  cutter.userData.fill=cutter.m
  cutter.userData.edges={geometry:{dispose(){}},visible:true}
  const THREE={...fixtureThree,Matrix4,EdgesGeometry:class { dispose(){} }}
  const code=source('src/engine/runtime/scene/brushes.js').replace(/^import.*$/gm,'').replace('export const brushesMethods =','const brushesMethods =')
  let lastHits=[]
  const toGeo=poly=>{
    const b=polyBuffers(poly)
    const geo=new Geo().setAttribute('position',new Attr(b.positions,3)).setAttribute('normal',new Attr(b.normals,3)).setAttribute('uv',new Attr(b.uvs,2))
    geo.index={count:b.indices.length,getX:i=>b.indices[i]}
    geo.applyMatrix4=function(matrix){
      const a=this.attributes.position
      for(let i=0;i<a.count;i++) {
        const v=point(matrix,[a.getX(i),a.getY(i),a.getZ(i)])
        for(let k=0;k<3;k++) a.array[i*3+k]=v[k]
      }
      this.computeBoundingBox();return this
    }
    return geo
  }
  const names=['THREE','nodeEffectiveActive','carveGeometries','cutterTouches','isCutter','applyShadowMats','primitiveMetricAttributes','unitGeometry','stairsGeometry','geometryOf','subtractPolyOf','meshSubtractSourcePoly','meshSubtractSourceSignature','resolveMeshSubtractSource','nearestMeshParent']
  const args=[THREE,nodeEffectiveActive,(base,hits)=>{lastHits=hits;return {geos:new Map([[0,base]]),polys:[]}},()=>true,o=>o.type==='subtract'||o.type==='meshSubtract',()=>{},()=>({uv:new Float32Array(),size:new Float32Array()}),()=>box([1,1,1]),()=>box([1,1,1]),toGeo,()=>null,meshSubtractSourcePoly,meshSubtractSourceSignature,resolveMeshSubtractSource,nearestMeshParent]
  const brushes=new Function(...names,`${code}\nreturn brushesMethods`)(...args)
  const context={...brushes,host:{project:{objects,meshes:[]}},nodes,
    vp:{requestRender(){},invalidateShadows(){}},worldMatrix(id){
      const byId=new Map(objects.map(o=>[o.id,o])),chain=[]
      for(let node=byId.get(id);node;node=byId.get(node.parentId)) chain.unshift(node)
      const m=new Matrix4()
      for(const o of chain) m.multiply(local(o))
      return m
    },_brTimer:0}
  return {context,objects,nodes,hits:()=>lastHits}
}

test('PB-01: la fuente dentro de una escalera rotada mantiene su forma relativa al pivote',()=>{
  for(const yaw of [0,90,180,270]) {
    const {context,nodes,hits}=setup(yaw)
    context.refreshBrushes()
    const cutter=nodes.get('hollow').userData.fill.geometry
    const a=cutter.boundingBox
    near((a.min[0]+a.max[0])/2,.2)
    near((a.min[1]+a.max[1])/2,0)
    near((a.min[2]+a.max[2])/2,.1)
    const receiverHits=hits()
    assert.equal(receiverHits.length,2)
    const mesh=receiverHits.find(hit=>hit.obj.type==='meshSubtract')
    assert.ok(mesh)
    const result=point(mesh.matrix,[.2,0,.1])
    near(result[0],(.3+.2)/4)
    near(result[2],.1/4)
  }
})

test('PB-02: la vista previa y el CSG comparten la posición del cuadrado cortador con el padre rotado',()=>{
  const {context,nodes,objects,hits}=setup(90)
  context.refreshBrushes()
  const mesh=hits().find(hit=>hit.obj.type==='meshSubtract')
  const center=[.2,0,.1]
  const worldShape=point(context.worldMatrix('hollow'),center)
  const worldCSG=point(context.worldMatrix('stairs').multiply(new Matrix4().makeScale(...objects[0].scale)),point(mesh.matrix,center))
  worldShape.forEach((value,i)=>near(value,worldCSG[i]))
  near(worldShape[0],8+.1)
  near(worldShape[2],-5-.5)
  assert.equal(nearestMeshParent(objects,objects[2]).id,'stairs')
  assert.equal(nodes.get('hollow').userData.meshSubtractError,'')
})

test('PB-03: el Inspector conserva la fuente independiente y declara receptor automático',()=>{
  const inspector=readFileSync(new URL('../src/components/Inspector.vue',import.meta.url),'utf8')
  assert.match(inspector,/const subtractReceiver = computed\(\(\) => subtractExplicitReceiver\.value \|\| nearestMeshParent\(store\.project\?\.objects, obj\.value\)\)/)
  assert.match(inspector,/Receptor específico/)
  assert.match(inspector,/<label>Receptor<\/label>/)
  assert.match(inspector,/obj\.props\?\.sourceId/)
  assert.match(readFileSync(new URL('../src/engine/runtime/scene/objects.js',import.meta.url),'utf8'),/node3d[\s\S]*meshSubtract[\s\S]*_scheduleBrushes\(\)/)
})
