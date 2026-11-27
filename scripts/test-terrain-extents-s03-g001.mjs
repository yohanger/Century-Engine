// LF-TERRAIN-EXTENTS-S03-G001. Reproduce extensiones/reducciones sobre la implementación real.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const src=path=>readFileSync(new URL(`../src/${path}`,import.meta.url),'utf8')
const code=src('engine/runtime/geometry/terrain.js')
const js=code.slice(code.indexOf('export class Terrain {'),code.indexOf('Object.assign(Terrain.prototype')).replace('export class Terrain {','class Terrain {')
const root=vm.createContext({Math,Number,Float32Array,Uint8Array,STRIDE:8,clamp:(v,a,b)=>Math.max(a,Math.min(v,b)),lerp:(a,b,t)=>a+(b-a)*t})
vm.runInContext(`${js}\nglobalThis.Terrain=Terrain`,root)
const {Terrain}=root
const make=()=>{
 const t=Object.create(Terrain.prototype)
 Object.assign(t,{id:'t1',name:'Terreno',size:16,depth:16,segments:8,segmentsZ:8,ox:3,oy:4,oz:-7,enabled:true,visible:true,version:1,
  heights:new Float32Array(81),splat:new Uint8Array(81*8),layers:[{color:'#ffffff'}],_cache:null,
  mesh:{position:{set(x,y,z){this.xyz=[x,y,z]}},updateMatrixWorld(){}},
  foliage:{types:new Map(),group:{position:{set(x,y,z){this.xyz=[x,y,z]}},updateMatrixWorld(){}},clipToTerrain(){this.clipped=true}}
 })
 for(let j=0;j<9;j++)for(let i=0;i<9;i++){
  const k=j*9+i;t.heights[k]=1+i*0.1+j*0.02;t.splat[k*8]=255-(i%3);t.splat[k*8+1]=i%3
 }
 t._buildMesh=()=>{t._buildCount=(t._buildCount||0)+1};t._syncTextures=()=>{};t.refreshAll=()=>{}
 return t
}
const original=(t)=>{
 const p=[];for(let j=0;j<t.nz1;j++)for(let i=0;i<t.n1;i++)p.push([t.ox-t.size/2+i*t.step,t.oz-t.depth/2+j*t.step,t.heights[j*t.n1+i],...t.splat.slice((j*t.n1+i)*8,(j*t.n1+i+1)*8)])
 return p
}
const assertPreserved=(t,data)=>{
 for(const [x,z,h,...color] of data){
  const i=Math.round((x-t.ox+t.size/2)/t.step),j=Math.round((z-t.oz+t.depth/2)/t.step)
  if(i<0||i>t.segments||j<0||j>t.segmentsZ)continue
  assert.equal(t.heights[j*t.n1+i],h,`height at ${x},${z}`)
  assert.deepEqual([...t.splat.slice((j*t.n1+i)*8,(j*t.n1+i+1)*8)],color,`splat at ${x},${z}`)
 }
}
for(const side of ['nx','px','nz','pz']){
 test(`TE3-EXT-${side}: ampliar dos celdas conserva exactamente mundo, altura y pintura`,()=>{
  const t=make(),before=original(t), oldStep=t.step
  assert.equal(t.extendEdge(side,2),true)
  assertPreserved(t,before)
  assert.equal(t.step,oldStep)
  assert.equal(t._buildCount,1)
  assert.equal(t.oy,4)
  assert.equal(t.heights.length,(t.segments+1)*(t.segmentsZ+1))
  assert.equal(t.splat.length,t.heights.length*8)
  assert.equal(t.groundAt(3,-7),before[4*9+4][2]+4)
 })
 test(`TE3-SHRINK-${side}: reducir una celda conserva la zona interna`,()=>{
  const t=make(), before=original(t)
  assert.equal(t.extendEdge(side,2),true)
  assert.equal(t.extendEdge(side,-1),true)
  assertPreserved(t,before)
  assert.equal(side.endsWith('x') ? t.segments : t.segmentsZ,9)
 })
}
test('TE3-09: sin desplazamiento de relieve ni pintura al ampliar dos lados consecutivos',()=>{
 const t=make(),before=original(t)
 assert.ok(t.extendEdge('nx',3));assert.ok(t.extendEdge('pz',4));assertPreserved(t,before)
 assert.equal(t.size,22);assert.equal(t.depth,24)
})
test('TE3-10: nueva superficie hereda cota y pintura del borde más cercano',()=>{
 const t=make(),leftH=t.heights[4*9], leftC=t.splat.slice((4*9)*8,(4*9+1)*8)
 t.extendEdge('nx',2)
 const pos=(4*(t.n1)) // row 4, new first column
 assert.equal(t.heights[pos],leftH)
 assert.deepEqual(t.splat.slice(pos*8,(pos+1)*8),leftC)
})
test('TE3-11: límites y consultas son rectangulares y raycast usa cajas diferentes',()=>{
 const t=make();t.extendEdge('pz',4)
 const b=t.bounds
 assert.equal(b.x1-b.x0,16);assert.equal(b.z1-b.z0,24)
 assert.equal(t.contains(3,-7+11),true)
 assert.equal(t.contains(3+9,-7),false)
 assert.ok(Number.isNaN(t.groundAt(3+20,-7)))
})
test('TE3-12: una extensión conserva posición mundial y contenido de vegetación',()=>{
 const t=make(), data=new Float32Array([1,2,0,1, 0,-2,0,1]);const cfg={data,count:2,hash:new Map()}
 t.foliage.types.set('trees',cfg)
 const world=()=>[...Array(2)].map((_,i)=>[data[i*4]+t.ox,data[i*4+1]+t.oz])
 const before=world();t.extendEdge('nx',2); assert.deepEqual(world(),before)
 assert.equal(cfg.hash,null);assert.equal(t.foliage.clipped,true)
})
test('TE3-13: rechazar costes excesivos y reducción inválida sin modificar datos',()=>{
 const t=make(),before=original(t)
 for(const [side,n] of [['nx',-2],['px',9999],['pz',1.6],['xx',1]])assert.equal(t.extendEdge(side,n),false)
 assertPreserved(t,before);assert.equal(t._buildCount,undefined)
})
test('TE3-14: geometría, pinceles y normales usan ambos ejes',()=>{
 assert.match(code,/new Uint32Array\(n \* nz \* 6\)/)
 assert.match(code,/this\.nz1 \* 3/)
 assert.match(code,/j1 = this\.segmentsZ/)
 const brush=src('engine/runtime/geometry/terrain-brush.js')
 assert.match(brush,/this\.segmentsZ/)
 assert.match(brush,/this\.nz1/)
})
test('TE3-15: Jolt consume triangular rectangular con stride X y filas Z',()=>{
 const j=src('engine/runtime/physics/jolt.js');assert.match(j,/t\.segmentsZ/);assert.match(j,/t\.nz1/)
})
test('TE3-16: persistencia y Undo/Redo incluyen dimensiones Z y conservan altura Y',()=>{
 const io=src('engine/runtime/geometry/terrain-io.js')
 assert.match(io,/depth: this\.depth/);assert.match(io,/segmentsZ: this\.segmentsZ/)
 assert.match(io,/s\.depth \?\? s\.size/);assert.match(io,/oy: this\.oy/)
 assert.match(code,/t\.depth = d\.depth \?\? d\.size/)
})
test('TE3-17: controles de bordes y viewport usan registro existente y confirman recortes',()=>{
 const vue=src('components/TerrainPanel.vue'),g=src('core/editor/gizmo.js')
 for(const edge of ['nx','px','nz','pz'])assert.ok(vue.includes(`['${edge}'`))
 assert.match(vue,/extendTerrainEdge\(a\.id, side, cells\)/)
 assert.match(vue,/await confirmTerrainCrop\(\)/)
 assert.match(g,/this\._terrainEdgeGroup = new THREE\.Group\(\)/)
 assert.match(g,/commitTerrain\('Cambiar borde del terreno'\)/)
})
test('TE3-18: el ajuste de bordes no llama frameAll ni crea una pieza nueva',()=>{
 const e=src('core/editor/terrain.js'),s=e.slice(e.indexOf('extendTerrainEdge('),e.indexOf('  /** Iguala los bordes'))
 assert.doesNotMatch(s,/frameAll|new Terrain|addPiece|stitch\(/)
})
test('TE3-19: export fusiona terreno rectangular en una malla cuadrada compatible',()=>{
 const r=src('engine/runtime/geometry/terrains.js')
 assert.match(r,/list\[0\]\.depth \?\? list\[0\]\.size/)
 assert.match(r,/src\.segmentsZ \?\? src\.segments/)
 assert.match(r,/src\.depth \?\? src\.size/)
})
test('TE3-20: límite de memoria evita asignaciones superiores al presupuesto',()=>{
 const t=make();assert.equal(t.extendEdge('px',1024),false)
 assert.equal(t.heights.length,81)
})
test('TE3-21: generador procedural utiliza stride rectangular sin escribir fuera del mapa',()=>{
 const t=make();t.extendEdge('pz',4)
 t._buildMesh=()=>{};t.refreshAll=()=>{}
 const g=vm.createContext({Math,Float32Array,Uint8Array,
  terrainGeneratorParams:()=>({shape:'terrain',seed:1,scale:.02,amplitude:3,octaves:3,roughness:.5,island:0,coastRoughness:0,beachWidth:4,cliffStrength:0,seaLevel:0}),
  fbm:(x,z)=>x*.02+z*.03,storedTerrainGeneratorParams:x=>x,lerp:(a,b,k)=>a+(b-a)*k,
  clamp:(v,a,b)=>Math.min(Math.max(v,a),b)})
 const method=Terrain.prototype.generate
 // Inyectar dependencias mínimas al entorno del método, sin cambiar el código probado.
 const fragment=code.slice(code.indexOf('  generate(options = {}) {'),code.indexOf('  flat(height = 0)'))
 const codeMethod=fragment.replace(/\n  }\s*$/,'\n  }')
 const run=vm.runInContext(`(class {${codeMethod}}).prototype.generate`,g)
 run.call(t,{})
 assert.equal(t.heights.length,t.n1*t.nz1)
 assert.ok(Number.isFinite(t.heights[t.heights.length-1]))
 assert.equal(t.heights.length,9*13)
})
