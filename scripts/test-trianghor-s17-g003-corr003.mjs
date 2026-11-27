import test from 'node:test'
import assert from 'node:assert/strict'
import { Worker } from 'node:worker_threads'
import { readFileSync } from 'node:fs'
import { terrainBakePlan } from '../src/engine/runtime/render/terrain-bake.js'
import { triangleShapeQuality, triangulatePatchRing } from '../src/engine/runtime/render/trianghor/triangulate.js'
import { terrainFragmentCost } from '../src/engine/runtime/render/trianghor/terrain-shader-cost.js'
import { buildPageTree, queryPageTree } from '../src/engine/runtime/render/trianghor/spatial.js'
import { requestTriangHorBake } from '../src/engine/runtime/render/trianghor/job.js'
import { computeTriangHor } from '../src/engine/runtime/render/trianghor/core.js'
const source=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8')
const fixtures=(nx,nz=nx)=>{
  const heights=new Float32Array((nx+1)*(nz+1)),splat=new Uint8Array(heights.length*8)
  for(let i=0;i<heights.length;i++)splat[i*8]=255
  return {heights,splat,nx,nz,settings:{heightError:0.08,paintError:0.06}}
}
function topology(index,nx,nz){
  const w=nx+1,edge=new Map(),seen=new Set(index)
  for(let i=0;i<index.length;i+=3){
    const ids=Array.from(index.slice(i,i+3)),pts=ids.map(k=>[k%w,Math.floor(k/w)])
    const cross=(pts[1][0]-pts[0][0])*(pts[2][1]-pts[0][1])-(pts[2][0]-pts[0][0])*(pts[1][1]-pts[0][1])
    assert.ok(cross<0,'winding consistente en Terrain');assert.ok(ids.every(k=>k>=0&&k<=(nx+1)*(nz+1)-1))
    for(const [a,b] of [[0,1],[1,2],[2,0]]){const key=[Math.min(ids[a],ids[b]),Math.max(ids[a],ids[b])].join(':');edge.set(key,(edge.get(key)||0)+1)}
  }
  for(const count of edge.values())assert.ok(count===1||count===2)
  for(let x=0;x<=nx;x++)assert.ok(seen.has(x)&&seen.has(nz*w+x))
  for(let z=0;z<=nz;z++)assert.ok(seen.has(z*w)&&seen.has(z*w+nx))
  // Prohibir aristas que atraviesan un vértice conservado sin soldarlo.
  for(const k of edge.keys()){
    const [a,b]=k.split(':').map(Number),ax=a%w,az=Math.floor(a/w),bx=b%w,bz=Math.floor(b/w)
    if(ax===bx&&Math.abs(az-bz)>1)for(let z=Math.min(az,bz)+1;z<Math.max(az,bz);z++)assert.ok(!seen.has(z*w+ax),'T junction vertical')
    if(az===bz&&Math.abs(ax-bx)>1)for(let x=Math.min(ax,bx)+1;x<Math.max(ax,bx);x++)assert.ok(!seen.has(az*w+x),'T junction horizontal')
  }
}
test('TH-01: triangulación convexa optimiza abanicos sin romper winding',()=>{
 const nx=8,w=nx+1,ring=[]
 for(let x=0;x<=nx;x++)ring.push(x)
 for(let z=1;z<=nx;z++)ring.push(z*w+nx)
 for(let x=nx-1;x>=0;x--)ring.push(nx*w+x)
 for(let z=nx-1;z>=1;z--)ring.push(z*w)
 const ix=triangulatePatchRing(ring,w)
 assert.equal(ix.length/3,ring.length-2)
 topology(Uint32Array.from(ix),nx,nx)
 assert.ok(triangleShapeQuality(ix,w).worst>0)
})
test('TH-02: terreno plano 128x128 → reducción local con mejores formas',()=>{
 const f=fixtures(128),result=computeTriangHor(f)
 assert.equal(result.sourceTriangles,32768)
 assert.ok(result.triangles < 1024)
 assert.ok(result.reduction > 0.975)
 assert.ok(result.shape.worst > 0.05)
 for (let i=0;i<result.index.length;i+=3) {
   const ids=Array.from(result.index.slice(i,i+3))
   const xs=ids.map(k=>k%129),zs=ids.map(k=>Math.floor(k/129))
   assert.ok(Math.max(...xs)-Math.min(...xs)<=16)
   assert.ok(Math.max(...zs)-Math.min(...zs)<=16)
 }
 topology(result.index,128,128)
 assert.deepEqual(result.algorithm,'TriangHor · adaptativo')
})
test('TH-03: relieve y pintura mantienen error y reducen ≥90% en escenario controlado',()=>{
 const f=fixtures(64)
 for(let z=0;z<=64;z++)for(let x=0;x<=64;x++){
   const i=z*65+x;f.heights[i]=2.8*Math.exp(-((x-19)**2+(z-24)**2)/10)
 }
 const h=f.heights.slice(),s=f.splat.slice(),p=terrainBakePlan(f.heights,f.splat,64,64,f.settings)
 assert.ok(p.reduction>=0.90,`fixture ${(p.reduction*100).toFixed(2)}%`)
 assert.ok(p.height<=f.settings.heightError+1e-6)
 assert.ok(p.paint<=f.settings.paintError+1e-6)
 assert.deepEqual(f.heights,h);assert.deepEqual(f.splat,s)
 topology(p.index,64,64)
})
test('TH-04: un pico local conserva altura y permite detalle desigual',()=>{
 const f=fixtures(32);f.heights[16*33+16]=6
 const p=terrainBakePlan(f.heights,f.splat,32,32,f.settings)
 assert.ok(p.index&&p.triangles<2048&&p.height<=f.settings.heightError+1e-6)
 topology(p.index,32,32)
})
test('TH-05: trazo de pintura impide simplificación que destruye pesos',()=>{
 const f=fixtures(32);const k=12*33+13;f.splat[k*8]=0;f.splat[k*8+1]=255
 const p=terrainBakePlan(f.heights,f.splat,32,32,f.settings)
 assert.ok(p.paint<=f.settings.paintError+1e-6)
 assert.ok(p.index.includes(k))
 topology(p.index,32,32)
})
test('TH-06: spatial BVH consulta menos páginas sin perder las visibles',()=>{
 const pages=[]
 for(let z=0;z<16;z++)for(let x=0;x<16;x++)pages.push({id:z*16+x,sphere:{center:{x:x*10,y:0,z:z*10},radius:1}})
 const tree=buildPageTree(pages)
 const cnt={nodes:0,pages:0}
 const near=(center,r)=>center[0]-r<31&&center[2]-r<31
 const selected=queryPageTree(tree,near,[],cnt)
 assert.ok(selected.length>0&&selected.length<pages.length)
 assert.ok(cnt.pages<pages.length,'árbol debe podar subárboles')
 for(const page of pages)if(near([page.sphere.center.x,0,page.sphere.center.z],page.sphere.radius))
   assert.ok(selected.includes(page))
})
test('TH-07: union conservadora de cámara/sombra no pierde páginas',()=>{
 const pages=[0,20,40,60,80].map((x,id)=>({id,sphere:{center:{x,y:0,z:0},radius:1}}))
 const tree=buildPageTree(pages,1)
 const cam=(c,r)=>c[0]-r<22
 const shadow=(c,r)=>c[0]+r>59
 const union=(c,r)=>cam(c,r)||shadow(c,r)
 const selected=queryPageTree(tree,union)
 assert.deepEqual(new Set(selected.map(p=>p.id)),new Set([0,1,3,4]))
})
test('TH-08: clasificación de pintura usa capas efectivas y texturas activas',()=>{
 const slots=new Array(8).fill(-1),weights=new Array(8).fill(0);weights[0]=1
 assert.deepEqual(terrainFragmentCost(weights,slots),{layers:1,textured:0,score:0.35})
 slots[0]=0;weights[1]=0.5;slots[1]=1
 const score=terrainFragmentCost(weights,slots)
 assert.equal(score.layers,2);assert.equal(score.textured,2);assert.ok(score.score>2)
 assert.match(source('src/engine/runtime/render/trianghor/terrain-shader-cost.js'),/if\(w<0\.003\) continue/)
})
test('TH-09: Worker real produce resultado sin ejecutar el solver en hilo principal',async()=>{
 class NodeBridge{
   constructor(){this.worker=new Worker(new URL('./fixtures/trianghor/node-worker.mjs',import.meta.url),{type:'module'})
     this.worker.on('message',data=>this.onmessage?.({data}))
     this.worker.on('error',error=>this.onerror?.(error))
   }
   postMessage(v){this.worker.postMessage(v)}
   terminate(){this.worker.terminate()}
 }
 const f=fixtures(64),plan=await requestTriangHorBake(f,{makeWorker:()=>new NodeBridge()})
 assert.ok(plan.index instanceof Uint32Array)
 assert.equal(plan.sourceTriangles,8192)
 assert.ok(plan.triangles<8192)
})
test('TH-10: cancelar termina Worker y descarta resultados retrasados',async()=>{
 let worker,stops=0
 class Fake {constructor(){worker=this}postMessage(){}terminate(){stops++}}
 const ctl=new AbortController()
 const promise=requestTriangHorBake(fixtures(8),{makeWorker:()=>new Fake(),signal:ctl.signal})
 ctl.abort()
 await assert.rejects(promise,/cancelado/)
 worker.onmessage?.({data:{id:1,type:'done',plan:{triangles:0}}})
 assert.equal(stops,1)
})
test('TH-11: integración conserva autoridad de Clusters y sin duplicar alturas',()=>{
 const cluster=source('src/engine/runtime/render/cluster-mesh.js')
 const terrain=source('src/core/state/terrain.js')
 assert.match(cluster,/buildPageTree|queryPageTree/)
 assert.match(cluster,/partitionTriangles\(/)
 assert.match(cluster,/terrainVariants/)
 assert.match(cluster,/_terrainShadowFrusta/)
 assert.match(terrain,/bakeTerrainOffThread/)
 assert.match(terrain,/controller\.signal\.aborted/)
 assert.doesNotMatch(terrain,/bakeInfo: t\.bakeInfo \? \{ \.\.\.t\.bakeInfo \}/)
})
test('TH-12: shaders de Terrain se clasifican por píxel, no por todas las texturas potenciales',()=>{
 const view=source('src/engine/runtime/render/view-diagnostics.js')
 assert.match(view,/TERRAIN_COMPLEXITY_FRAGMENT/)
 assert.match(view,/uLTex: m\.userData\._lfTerrainSplatUniforms\.uLTex/)
 const contract=source('src/engine/runtime/render/view-diagnostics-contract.js')
 assert.match(contract,/overdraw/)
 assert.match(source('src/components/PerfPanel.vue'),/TriangHor · páginas/)
})
