// LF-TERRAIN-TRANSFORM-S02-G001 — evidencia de traslado Y y conservación del mapa local.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL(`../src/${p}`,import.meta.url),'utf8')
const terrainSrc=read('engine/runtime/geometry/terrain.js')
const ioSrc=read('engine/runtime/geometry/terrain-io.js')
const allSrc=read('engine/runtime/geometry/terrains.js')
const state=read('core/state/terrain.js')
const gizmo=read('core/editor/gizmo.js')
const panel=read('components/TerrainPanel.vue')
const THREE={Vector3:class Vector3{constructor(x,y,z){Object.assign(this,{x,y,z})}},Ray:class Ray{constructor(origin,direction){Object.assign(this,{origin,direction})}}}
const ctx=vm.createContext({THREE,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),lerp:(a,b,t)=>a+(b-a)*t,Float32Array,Uint8Array,Math,Number,Infinity,Map,Set,storedTerrainGeneratorParams:x=>x,normalizeLayers:x=>x,bytesToB64:x=>String(x.length),STRIDE:8})
const classCode=terrainSrc.slice(terrainSrc.indexOf('export class Terrain {'),terrainSrc.indexOf('Object.assign(Terrain.prototype')).replace('export class Terrain {','class Terrain {')
const ioCode=ioSrc.replace(/^import .+\n/gm,'').replace('export const ioMethods','const ioMethods')
vm.runInContext(`${classCode}\n${ioCode}\nObject.assign(Terrain.prototype, ioMethods);globalThis.Terrain=Terrain`,ctx)
function mock({oy=0,ox=0,oz=0}={}){
 const t=Object.create(ctx.Terrain.prototype)
 Object.assign(t,{id:'pieza',name:'Terreno',ox,oy,oz,size:16,depth:16,segments:2,segmentsZ:2,enabled:true,visible:true,version:0,heights:new Float32Array(9).fill(3),splat:new Uint8Array(72),layers:[],_cache:null,mesh:{position:{set(x,y,z){this.xyz=[x,y,z]}},updateMatrixWorld(){}},foliage:{group:{position:{set(x,y,z){this.xyz=[x,y,z]}},updateMatrixWorld(){}},snapshot:()=>[],serialize:()=>[],restore(){}},generator:null})
 t._applyLayerUniforms=()=>{};t._syncTextures=()=>{};t.refreshAll=()=>{};t._buildMesh=()=>{};t._ib={array:null,needsUpdate:false}
 return t
}
const t=mock()
test('TT2-01: desplazamiento Y conserva alturas locales y posiciona malla/vegetación',()=>{
 const before=t.heights.slice();t.setOffset(10,20,6)
 assert.equal(t.oy,6);assert.deepEqual(t.mesh.position.xyz,[10,6,20]);assert.deepEqual(t.foliage.group.position.xyz,[10,6,20]);assert.deepEqual(t.heights,before)
})
test('TT2-02: suelo reporta altura mundial y conserva NaN fuera de superficie',()=>{
 assert.equal(t.groundAt(10,20),9);assert.ok(Number.isNaN(t.groundAt(300,300)))
})
test('TT2-03: raycast localiza el origen Y y devuelve impacto mundial',()=>{
 let localY
 t.raycast=r=>{localY=r.origin.y;return {point:{x:1,y:3,z:2},distance:7}}
 const hit=t.raycastW({origin:{x:13,y:50,z:21},direction:{x:0,y:-1,z:0}})
 assert.equal(localY,44); assert.deepEqual([hit.point.x,hit.point.y,hit.point.z],[11,9,22]);assert.equal(hit.distance,7)
})
test('TT2-04: las coordenadas X/Z de llamadas antiguas conservan Y',()=>{t.setOffset(1,2);assert.equal(t.oy,6)})
test('TT2-05: estado serializado/snapshot contienen oy, cero es compatible',()=>{
 const s=t.serialize();assert.equal(s.oy,6);const snap=t.snapshot();assert.equal(snap.oy,6)
 t.setOffset(0,0,0);t.restore(snap);assert.equal(t.oy,6)
 const old={...snap,oy:undefined};t.restore(old);assert.equal(t.oy,0)
})
test('TT2-06: ninguna traslación de terreno altera altura local original',()=>{assert.equal(t.heightAt(0,0),3)})
const MockTerrain=class {
 constructor(size=16,seg=2,layers=[]){Object.assign(this,{id:'merged',ox:0,oy:0,oz:0,size,segments:seg,layers,enabled:true,heights:new Float32Array((seg+1)**2),splat:new Uint8Array((seg+1)**2*8),_ib:{needsUpdate:false},foliage:{load(x){this.saved=x},serialize(){return []}},generator:null})}
 get n1(){return this.segments+1}get step(){return this.size/this.segments}
 get bounds(){return {x0:this.ox-this.size/2,x1:this.ox+this.size/2,z0:this.oz-this.size/2,z1:this.oz+this.size/2}}
 contains(x,z,pad=0){return Math.abs(x-this.ox)<=this.size/2+pad && Math.abs(z-this.oz)<=this.size/2+pad}
 groundAt(x,z){return this.enabled&&this.contains(x,z)?this.oy+this.heightAt(x-this.ox,z-this.oz):NaN}
 heightAt(){return 3}
 heightRange(){return [3,3]}
 refreshAll(){}
}
const allContext=vm.createContext({Terrain:MockTerrain,Float32Array,Uint8Array,Math,Number,Infinity,Map,Set,b64ToBytes:()=>new Uint8Array(),bytesToB64:()=>''})
vm.runInContext(allSrc.replace(/^import .+\n/gm,'').replace(/^export /gm,'')+'\nglobalThis.geo={groundAtAll,heightAtAll,rangeAll,stitchPieces,mergePieces}',allContext)
const geo=allContext.geo
const a=new MockTerrain();a.oy=5
test('TT2-07: consultas combinadas devuelven elevación mundial',()=>{assert.equal(geo.groundAtAll([a],0,0),8);assert.equal(geo.heightAtAll([a],100,100),8)})
test('TT2-08: rango mundial incluye offset Y',()=>{assert.deepEqual(Array.from(geo.rangeAll([a])),[8,8])})
test('TT2-09: fusión para exportar hornea oy sin duplicar una malla desplazada',()=>{
 const out=geo.mergePieces([a]);assert.notEqual(out,a);assert.equal(out.heights[(out.n1*out.n1-1)>>1],8);assert.equal(out.oy,0)
})
test('TT2-10: piezas a distintas cotas no se sueldan automáticamente',()=>{
 const b=new MockTerrain();b.oy=25;b.ox=16;b.heights.fill(33)
 const changes=geo.stitchPieces([a,b]);assert.equal(changes.length,0);assert.equal(b.heights[0],33)
})
test('TT2-11: el gizmo permite Y y representa su posición real',()=>{
 assert.match(gizmo,/t\.showY = true/);assert.match(gizmo,/t\.oy/);assert.match(gizmo,/t\.setOffset\(x, z, y\)/)
})
test('TT2-12: Inspector expone X, Y, Z y restablece persistencia',()=>{
 assert.match(panel,/Posición Y/);assert.match(panel,/active\.oy/);assert.match(state,/oy: t\.oy/);assert.match(state,/movePiece\(id, x, z, y\)/)
})
test('TT2-13: Jolt ubica el cuerpo en la misma altura que el mesh',()=>{
 assert.match(read('engine/runtime/physics/jolt.js'),/x: t\.ox, y: t\.oy, z: t\.oz/)
})
test('TT2-14: rampa y aplanado convierten cotas mundiales a locales',()=>{
 assert.match(read('core/editor/ramp.js'),/y: ay - t\.oy/);assert.match(read('core/editor.js'),/flattenHeight: this\.stroke\.flatten - t\.oy/)
})
test('TT2-15: no se desplazan físicamente cuerpos de agua al elevar terreno',()=>{
 assert.match(read('engine/runtime/scene/water.js'),/groundAtAll\(live, x, z\)/)
})
test('TT2-16: vegetación desprendida, hojas y tornado reciben alturas mundiales',()=>{
 assert.match(read('engine/runtime/geometry/foliage.js'),/y\+this\.terrain\.oy/)
 assert.match(read('engine/runtime/world/leaves.js'),/t\.oy \+ t\.heightAt/)
 assert.match(read('engine/runtime/events/play-tornado-destruction.js'),/\(terrain\.oy \?\? 0\)\+terrain\.heightAt/)
})
test('TT2-17: S04 conserva dimensionado y no recuadra la cámara',()=>{
 assert.doesNotMatch(panel,/store\.editor\.frameAll\(\)/)
 assert.match(read('engine/runtime/geometry/terrain.js'),/resize\(size, segments\)/)
})
