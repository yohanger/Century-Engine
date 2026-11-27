// LF-TERRAIN-EXTENTS-S03-G001_CORR-001: datos sin mutación, preview reversible y preferencia de recorte.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
const read = f => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
const terrainSource = read('engine/runtime/geometry/terrain.js')
const geometry = []
class BufferGeometry {
  constructor(){this.attrs={};this.disposed=false;geometry.push(this)}
  setAttribute(name,val){this.attrs[name]=val}
  setIndex(val){this.index=val}
  computeBoundingSphere(){}
  dispose(){this.disposed=true}
}
class BufferAttribute {constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.count=array.length/itemSize}}
class InterleavedBuffer {constructor(array,stride){this.array=array;this.stride=stride}}
class InterleavedBufferAttribute {constructor(data,itemSize,offset,normalized){Object.assign(this,{data,itemSize,offset,normalized})}}
const THREE={BufferGeometry,BufferAttribute,InterleavedBuffer,InterleavedBufferAttribute}
const code=terrainSource.slice(terrainSource.indexOf('export class Terrain {'),terrainSource.indexOf('Object.assign(Terrain.prototype')).replace('export class Terrain {','class Terrain {')
const context=vm.createContext({THREE,Number,Math,Float32Array,Uint8Array,Uint32Array,STRIDE:8})
vm.runInContext(`${code}\nglobalThis.Terrain=Terrain`,context)
const Terrain=context.Terrain
function make(){
  const t=Object.create(Terrain.prototype)
  const original={name:'original',disposed:false,dispose(){this.disposed=true}}
  const pos={xyz:null,set(...xyz){this.xyz=xyz}}
  t.id='t1';t.size=32;t.depth=32;t.segments=16;t.segmentsZ=16;t.ox=3;t.oy=5;t.oz=-7;t.version=13
  t.heights=new Float32Array(17*17);t.splat=new Uint8Array(17*17*8)
  for(let j=0;j<=16;j++)for(let i=0;i<=16;i++){
    const v=j*17+i;t.heights[v]=i*0.1+j*0.33;t.splat[v*8]=200+i;t.splat[v*8+1]=55-i
  }
  const foliage={count:1,data:new Float32Array([1,2,0,1]),hash:{old:1}}
  t.foliage={types:new Map([['trees',foliage]]),group:{position:{set(){}},updateMatrixWorld(){}},clipToTerrain(){}}
  t.mesh={geometry:original,position:pos,updateMatrixWorld(){}}
  t._buildMesh=()=>{t.builds=(t.builds||0)+1}
  return {t,original,pos,foliage}
}
test('TEC-01: previsualizar +X sustituye la malla visible, no los datos del terreno',()=>{
 const {t,original,pos}=make();const h=t.heights.slice(),s=t.splat.slice()
 assert.equal(t.previewEdge('px',3),true)
 assert.notEqual(t.mesh.geometry,original)
 assert.equal(t.mesh.geometry.attrs.position.count,20*17)
 assert.deepEqual(t.heights,h);assert.deepEqual(t.splat,s);assert.equal(t.version,13)
 assert.equal(pos.xyz[0],6);assert.equal(t.ox,3);assert.equal(t.segments,16)
 t.clearEdgePreview();assert.equal(t.mesh.geometry,original);assert.equal(pos.xyz[0],3);assert.equal(original.disposed,false)
})
test('TEC-02: la vista previa usa los pesos originales y mantiene celdas conservadas',()=>{
 const {t}=make();assert.equal(t.previewEdge('nx',2),true)
 const a=t.mesh.geometry.attrs.splatA
 assert.equal(a.data.array[2*8],t.splat[0]);assert.equal(a.data.array[2*8+1],t.splat[1])
 const idx=8*(19)+5
 const originalIdx=8*17+3
 assert.equal(t.mesh.geometry.attrs.position.array[idx*3+1],t.heights[originalIdx])
 t.clearEdgePreview()
})
test('TEC-03: previsualización repetida de la misma celda no reconstruye geometría',()=>{
 const {t}=make();t.previewEdge('pz',2);const before=geometry.length
 assert.equal(t.previewEdge('pz',2),true);assert.equal(geometry.length,before)
 t.clearEdgePreview()
})
test('TEC-04: cambiar a otra celda libera los buffers anteriores',()=>{
 const {t}=make();t.previewEdge('pz',2);const first=t.mesh.geometry
 t.previewEdge('pz',3);assert.equal(first.disposed,true);assert.notEqual(t.mesh.geometry,first)
 t.clearEdgePreview();assert.equal(t._edgePreview,null)
})
test('TEC-05: volver a cero restaura geometría y cámara/relieve no cambian',()=>{
 const {t,original}=make();const first=t.heights.slice()
 t.previewEdge('nx',4);assert.equal(t.previewEdge('nx',0),true)
 assert.equal(t.mesh.geometry,original);assert.deepEqual(t.heights,first);assert.equal(t.size,32)
})
test('TEC-06: límite de memoria inválido no modifica ni libera la vista válida',()=>{
 const {t}=make();t.previewEdge('px',1);const valid=t.mesh.geometry
 assert.equal(t.previewEdge('px',3000),false);assert.equal(t.mesh.geometry,valid)
 t.clearEdgePreview()
})
test('TEC-07: un recorte temporal no toca la vegetación, alturas ni pintura',()=>{
 const {t,foliage}=make();const before=t.heights.slice(),s=t.splat.slice(),items=foliage.data.slice()
 assert.equal(t.previewEdge('nx',-3),true)
 assert.deepEqual(t.heights,before);assert.deepEqual(t.splat,s);assert.deepEqual(foliage.data,items)
 assert.equal(t.segments,16);t.clearEdgePreview()
})
test('TEC-08: al confirmar, solo entonces cambia la geometría persistente',()=>{
 const {t}=make();t.previewEdge('px',3)
 assert.equal(t.extendEdge('px',3),true);assert.equal(t.segments,19);assert.equal(t.size,38)
 assert.equal(t._edgePreview,null);assert.equal(t.builds,1)
})
test('TEC-09: las cuatro direcciones usan la misma ruta de previsualización',()=>{
 for(const dir of ['nx','px','nz','pz']){
  const {t}=make();assert.equal(t.previewEdge(dir,2),true)
  assert.equal(t.mesh.geometry.attrs.position.count,dir.endsWith('x')?19*17:17*19)
  t.clearEdgePreview()
 }
})
test('TEC-10: cerrar Terrain mientras hay vista previa libera recursos',()=>{
 assert.match(terrainSource,/dispose\(\) \{\s*this\.clearEdgePreview\(\)/)
 assert.match(terrainSource,/_buildMesh\(\) \{\s*this\.clearEdgePreview\(\)/)
 assert.match(read('engine/runtime/geometry/terrain-io.js'),/restore\(s\) \{\s*this\.clearEdgePreview\(\)/)
})
test('TEC-11: Escape, blur, pointercancel y dispose restauran el terreno',()=>{
 const g=read('core/editor/gizmo.js')
 for(const x of ["e.key === 'Escape'","win.addEventListener('blur', cancel", "win.addEventListener('pointercancel', cancel",'this._terrainEdgeCleanup = () => {\n      cancel()'])assert.ok(g.includes(x),x)
 assert.match(g,/\.clearEdgePreview\(\)/)
})
test('TEC-12: solo se reconstruye una vez por transición de celda',()=>{
 const g=read('core/editor/gizmo.js')
 assert.match(g,/cells !== d\.cells && t\.previewEdge\(d\.side, cells\)/)
 assert.match(g,/d\.cells && this\.terrain\?\.id === d\.pieceId && this\.extendTerrainEdge/)
})
test('TEC-13: el Inspector y el gizmo comparten una única confirmación especializada',()=>{
 const i=read('components/TerrainPanel.vue'),g=read('core/editor/gizmo.js'),s=read('core/state/terrain.js')
 assert.match(i,/await confirmTerrainCrop\(\)/);assert.match(g,/await confirmTerrainCrop\(\)/)
 assert.match(s,/export async function confirmTerrainCrop\(\)/)
})
test('TEC-14: advertencia reversible persiste en prefs, sin ocultar otras confirmaciones',()=>{
 const prefs=read('core/state/state.js'),modal=read('components/PreferencesModal.vue')
 assert.match(prefs,/terrainCropWarning: true/);assert.match(prefs,/localStorage\.setItem\(PREFS_KEY/)
 assert.match(modal,/terrainCropWarning.*Advertir antes de recortar/)
 const dialogs=read('core/dialogs.js'),ask=read('components/AskWindows.vue')
 assert.match(dialogs,/allowSkip = false/);assert.match(ask,/No volver a mostrar este aviso/)
})
test('TEC-15: omitir advertencia solo tras aceptar con casilla marcada',()=>{
 const f=read('core/state/terrain.js'),ask=read('components/AskWindows.vue')
 assert.match(f,/if \(store\.prefs\.terrainCropWarning === false\) return true/)
 assert.match(f,/if \(answer\.confirmed && answer\.skipFuture\) store\.prefs\.terrainCropWarning = false/)
 assert.match(ask,/skipFuture: ok === true && d\.skipFuture === true/)
})
test('TEC-16: S04 elimina frameAll de Aplicar tamaño y no crea terreno alternativo',()=>{
 assert.doesNotMatch(read('components/TerrainPanel.vue'),/store\.editor\.frameAll\(\)/)
 assert.doesNotMatch(terrainSource,/new Terrain\(.*preview/)
})
