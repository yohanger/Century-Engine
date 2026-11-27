import test from 'node:test'
import assert from 'node:assert/strict'
import { Worker } from 'node:worker_threads'
import { readFileSync } from 'node:fs'
import { computeTriangHor, terrainBakePlan, buildPageTree, queryPageTree, terrainIndex } from 'trianghor'
import { terrainBakePlan as centuryBake, normalizeTerrainBake } from '../src/engine/runtime/render/terrain-bake.js'
import { computeTriangHor as centuryCompute } from '../src/engine/runtime/render/trianghor/core.js'
import { buildPageTree as centuryBuild, queryPageTree as centuryQuery } from '../src/engine/runtime/render/trianghor/spatial.js'
import { terrainIndex as centuryIndex } from '../src/engine/runtime/render/lod.js'
import { runTerrainBake, releaseTerrainBakeWorker } from '../src/engine/runtime/render/trianghor/worker-service.js'

const source = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const makeTerrain = (nx=32,nz=nx) => {
  const heights=new Float32Array((nx+1)*(nz+1)),splat=new Uint8Array(heights.length*8)
  for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
    const i=z*(nx+1)+x
    heights[i]=Math.sin(x*0.25)*Math.cos(z*0.16)*0.12
    splat[i*8]=255
  }
  return { heights,splat,segments:nx,segmentsZ:nz }
}
const config={heightError:0.08,paintError:0.06}
class NodeBridge {
  constructor(){
    this.worker=new Worker(new URL('../vendor/trianghor/src/worker/node-worker.mjs',import.meta.url),{type:'module'})
    this.worker.on('message',data=>this.onmessage?.({data}))
    this.worker.on('error',error=>this.onerror?.(error))
    this.worker.on('messageerror',error=>this.onmessageerror?.(error))
  }
  postMessage(data){this.worker.postMessage(data)}
  terminate(){return this.worker.terminate()}
}
const producer=()=>new NodeBridge()
const input=(t,settings=config)=>({heights:t.heights,splat:t.splat,nx:t.segments,nz:t.segmentsZ,settings})

test('contrato: Century consume TriangHor como paquete local versionado',()=>{
  const pkg=JSON.parse(source('package.json'))
  const lock=JSON.parse(source('package-lock.json'))
  assert.equal(pkg.dependencies.trianghor,'file:vendor/trianghor')
  assert.equal(lock.packages['node_modules/trianghor'].resolved,'vendor/trianghor')
  assert.equal(lock.packages['node_modules/trianghor'].link,true)
  assert.equal(lock.packages['vendor/trianghor'].version,'0.0.1')
  assert.equal(JSON.parse(source('vendor/trianghor/package.json')).version,'0.0.1')
  assert.match(source('vendor/trianghor/package.json'), /"\.": "\.\/src\/index\.js"/)
})

test('los puntos antiguos se delegan a la biblioteca, sin solvers duplicados',()=>{
  for(const name of [
    'src/engine/runtime/render/terrain-bake.js',
    'src/engine/runtime/render/terrain-adaptive.js',
    'src/engine/runtime/render/trianghor/core.js',
    'src/engine/runtime/render/trianghor/job.js',
    'src/engine/runtime/render/trianghor/spatial.js',
    'src/engine/runtime/render/trianghor/triangulate.js',
  ]) {
    const text=source(name)
    assert.match(text,/from 'trianghor'/)
    assert.doesNotMatch(text,/function\s+(computeTriangHor|terrainBakePlan|adaptiveTerrainIndex|triangulatePatchRing|queryPageTree)/)
  }
  assert.match(source('src/engine/runtime/render/trianghor/worker-client.js'),/trianghor\/worker\?worker&inline/)
  assert.match(source('src/engine/runtime/geometry/terrain.js'),/releaseTerrainBakeWorker\(this\)/)
})

test('la misma función pública alimenta los consumidores antiguos',()=>{
  assert.equal(centuryBake,terrainBakePlan)
  assert.equal(centuryCompute,computeTriangHor)
  assert.equal(centuryBuild,buildPageTree)
  assert.equal(centuryQuery,queryPageTree)
  assert.equal(centuryIndex,terrainIndex)
  assert.deepEqual(normalizeTerrainBake(config),config)
})

test('paridad de índices y calidad para superficies planas, relieve y pintura',()=>{
  for(const nx of [16,32,64]) for(const paint of [false,true]) {
    const t=makeTerrain(nx)
    if(paint){ t.splat[(nx/2*(nx+1)+nx/2)*8]=0;t.splat[(nx/2*(nx+1)+nx/2)*8+1]=255 }
    const a=centuryBake(t.heights,t.splat,nx,nx,config)
    const b=computeTriangHor(input(t))
    assert.deepEqual(a.index,b.index)
    assert.equal(a.triangles,b.triangles)
    assert.equal(a.reduction,b.reduction)
    assert.equal(a.height,b.height)
    assert.equal(a.paint,b.paint)
    assert.equal(a.shape?.worst,b.shape?.worst)
  }
})

test('los índices LOD y la consulta espacial comparten proveedor',()=>{
  assert.deepEqual(centuryIndex(16,2,16),terrainIndex(16,2,16))
  const pages=[0,10,20,30].map((x,id)=>({id,sphere:{center:{x,y:0,z:0},radius:2}}))
  const tree=centuryBuild(pages)
  assert.deepEqual(centuryQuery(tree,(center,r)=>center[0]-r<15).map(p=>p.id),[0,1])
})

test('Worker Node real: horneado y actualización incremental no alteran entradas',async()=>{
  const t=makeTerrain(32),original=t.heights.slice(),paint=t.splat.slice()
  try {
    const a=await runTerrainBake(t,config,null,null,producer)
    assert.deepEqual(a.index,computeTriangHor(input(t)).index)
    t.heights[17*33+17]+=0.4
    const b=await runTerrainBake(t,config,null,null,producer)
    assert.deepEqual(b.index,computeTriangHor(input(t)).index)
    assert.notDeepEqual(t.heights,original)
    assert.deepEqual(t.splat,paint)
  } finally {releaseTerrainBakeWorker(t)}
})

test('Worker: cancelación evita publicar un resultado de geometría obsoleta',async()=>{
  const t=makeTerrain(128), controller=new AbortController()
  try {
    const pending=runTerrainBake(t,config,controller.signal,null,producer)
    controller.abort()
    await assert.rejects(pending,/cancelado/)
    const ok=await runTerrainBake(t,config,null,null,producer)
    assert.deepEqual(ok.index,computeTriangHor(input(t)).index)
  } finally {releaseTerrainBakeWorker(t)}
})

test('Worker: petición fallida no invalida la fuente ni bloquea nuevos trabajos',async()=>{
  const t=makeTerrain(16),before=t.heights.slice()
  try {
    await assert.rejects(runTerrainBake(t,config,null,null,()=>{throw new Error('worker unavailable')}),/worker unavailable/)
    assert.deepEqual(t.heights,before)
    const plan=await runTerrainBake(t,config,null,null,producer)
    assert.deepEqual(plan.index,computeTriangHor(input(t)).index)
  } finally {releaseTerrainBakeWorker(t)}
})

test('se descartan los resultados de un terreno antiguo y la caché permanece acotada',async()=>{
  const a=makeTerrain(16),b=makeTerrain(32)
  try {
    const first=await runTerrainBake(a,config,null,null,producer)
    assert.deepEqual(first.index,computeTriangHor(input(a)).index)
    const second=await runTerrainBake(b,config,null,null,producer)
    assert.deepEqual(second.index,computeTriangHor(input(b)).index)
    const third=await runTerrainBake(a,config,null,null,producer)
    assert.deepEqual(third.index,computeTriangHor(input(a)).index)
  } finally {releaseTerrainBakeWorker(a);releaseTerrainBakeWorker(b)}
})

test('protocolo público de petición única preserva el contrato de progreso',async()=>{
  const t=makeTerrain(16)
  const result=await runTerrainBake(t,config,null,()=>{},producer)
  assert.deepEqual(result.index,computeTriangHor(input(t)).index)
})

test('un Worker con plan incompatible nunca reemplaza el último índice válido', async()=>{
  const t=makeTerrain(16), previous=computeTriangHor(input(t)).index.slice()
  const fake=()=>({
    postMessage(data) {
      queueMicrotask(()=>this.onmessage?.({data:{id:data.id,type:'done',
        plan:{sourceTriangles:512,triangles:2,index:new Uint32Array([0,1,2])}}}))
    },
    terminate(){},
  })
  try {
    await assert.rejects(runTerrainBake(t,config,null,null,fake),/plan incompatible/)
    assert.deepEqual(computeTriangHor(input(t)).index,previous)
    const valid=await runTerrainBake(t,config,null,null,producer)
    assert.deepEqual(valid.index,previous)
  } finally {releaseTerrainBakeWorker(t)}
})

test('índices fuera de rango son rechazados antes del consumidor',async()=>{
  const t=makeTerrain(16), prior=computeTriangHor(input(t))
  const fake=()=>({
    postMessage(data) {
      queueMicrotask(()=>this.onmessage?.({data:{id:data.id,type:'done',
        plan:{...prior,index:Uint32Array.from([...prior.index.slice(0,-1),999999])}}}))
    },
    terminate(){},
  })
  try { await assert.rejects(runTerrainBake(t,config,null,null,fake),/índice fuera/) }
  finally {releaseTerrainBakeWorker(t)}
})
