import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { terrainIndex, terrainStrides } from '../src/engine/runtime/render/lod.js'
import { normalizeTerrainBake, terrainBakeError, terrainBakePlan } from '../src/engine/runtime/render/terrain-bake.js'
import { PolyMesh, ekey } from '../src/engine/runtime/mesh/polymesh.js'
import { dissolveEdges } from '../src/core/mesh/ops-edit.js'

const source = (relative) => readFileSync(new URL('../' + relative, import.meta.url), 'utf8')
function fixture(nx, nz = nx) {
  const heights = new Float32Array((nx+1)*(nz+1))
  const splat = new Uint8Array(heights.length * 8)
  for (let p=0;p<heights.length;p++) splat[p*8] = 255
  return { nx, nz, heights, splat }
}
const settings = {heightError: 0.01, paintError: 0.01}

test('G003-T01: superficie plana simplifica índices efectivos preservando fuente', () => {
  const f = fixture(64), originalHeights = f.heights.slice(), originalPaint = f.splat.slice()
  const plan = terrainBakePlan(f.heights, f.splat, 64, 64, settings)
  assert.equal(plan.sourceTriangles, 8192)
  assert.ok(plan.triangles < 8192, `triángulos: ${plan.triangles}`)
  assert.ok(plan.height < 1e-6); assert.ok(plan.paint < 1e-6)
  assert.deepEqual(f.heights, originalHeights)
  assert.deepEqual(f.splat, originalPaint)
})
test('G003-T02 / CORR-001: relieve puntual fuerza refinamiento local sin impedir toda la pieza', () => {
  const f=fixture(32); f.heights[(16*33)+16] = 5
  const plan = terrainBakePlan(f.heights, f.splat,32,32,settings)
  assert.equal(plan.stride,1)
  assert.ok(plan.triangles < 2048 && plan.triangles > 0)
  assert.ok(plan.height <= settings.heightError + 1e-6)
})
test('G003-T03: discontinuidad de pintura bloquea simplificación injustificada', () => {
  const f=fixture(32); const i=16*33+15
  f.splat[i*8]=0;f.splat[i*8+1]=255
  const plan=terrainBakePlan(f.heights,f.splat,32,32,settings)
  assert.equal(plan.stride,1)
})
test('G003-T04: terreno rectangular mantiene índices y bordes sin degeneración', () => {
  const nx=32,nz=16,s=4,index=terrainIndex(nx,s,nz),width=nx+1
  assert.ok(index.length < 2*nx*nz*3)
  const seen=new Set(index)
  for(let x=0;x<=nx;x++) {assert.ok(seen.has(x));assert.ok(seen.has(nz*width+x))}
  for(let z=0;z<=nz;z++) {assert.ok(seen.has(z*width));assert.ok(seen.has(z*width+nx))}
  for(let i=0;i<index.length;i+=3) {
    const [a,b,c]=index.slice(i,i+3)
    const ax=a%width,az=Math.floor(a/width),bx=b%width,bz=Math.floor(b/width),cx=c%width,cz=Math.floor(c/width)
    assert.notEqual((bx-ax)*(cz-az)-(cx-ax)*(bz-az),0)
  }
  const f=fixture(nx,nz)
  assert.equal(terrainBakeError(f.heights,f.splat,nx,nz,s).height,0)
})
test('G003-T05 / CORR-001: dimensión no divisible admite malla adaptativa sin topología parcial', () => {
  const nx=31,nz=18
  assert.deepEqual(terrainStrides(nx,64,nz),[1])
  const p=terrainBakePlan(...(()=>{const f=fixture(nx,nz);return [f.heights,f.splat,nx,nz,settings]})())
  assert.equal(p.stride,1);assert.ok(p.triangles < 2*nx*nz);assert.equal(p.height,0)
})
test('G003-T06: validación de entradas descarta configuración dañada',()=>{
  assert.equal(normalizeTerrainBake(null),null)
  const cfg=normalizeTerrainBake({heightError:-100,paintError:200})
  assert.equal(cfg.heightError,0);assert.equal(cfg.paintError,1)
  const f=fixture(8)
  assert.throws(()=>terrainBakeError(f.heights,f.splat,8,8,3),RangeError)
})
test('G003-T07: disolver arista entre dos triángulos crea un solo quad editable',()=>{
  const mesh = new PolyMesh([[0,0,0],[1,0,0],[1,1,0],[0,1,0]],[[0,1,2],[0,2,3]])
  const sel={v:new Set(),e:new Set([ekey(0,2)]),f:new Set(),clear(){this.v.clear();this.e.clear();this.f.clear()}}
  const error=dissolveEdges(mesh,sel,'edge')
  assert.equal(error,undefined)
  assert.equal(mesh.f.length,1)
  assert.equal(mesh.f[0].length,4)
})
test('G003-T08: disolver arista no fusiona caras no coplanares',()=>{
  const mesh = new PolyMesh([[0,0,0],[1,0,0],[1,1,0],[0,1,0.8]],[[0,1,2],[0,2,3]])
  const sel={v:new Set(),e:new Set([ekey(0,2)]),f:new Set(),clear(){this.v.clear();this.e.clear();this.f.clear()}}
  const result=dissolveEdges(mesh,sel,'edge')
  assert.ok(result && /contorno|coplanar/.test(result))
  assert.equal(mesh.f.length,2)
})
test('G003-T09: la visibilidad del cluster conserva el estado de autoría',()=>{
  const file=source('src/engine/runtime/render/cluster-mesh.js')
  assert.match(file,/_authoredVisible\(mesh\)/)
  assert.match(file,/entry\.batch\.visible = entry\.authoredVisible !== false && this\._authoredVisible\(mesh\)/)
  assert.doesNotMatch(file,/_unmount\(entry\) \{[\s\S]*?entry\.mesh\.visible = true/)
})
test('G003-T10: Hornear Mapa no destruye heightmap y se persiste como parámetros',()=>{
  const core=source('src/engine/runtime/geometry/terrain.js')
  const io=source('src/engine/runtime/geometry/terrain-io.js')
  assert.match(core,/bakeOptimized\(/)
  assert.match(core,/clearOptimizedBake\(/)
  assert.match(io,/terrainBake/)
  const panel=source('src/components/ScenePanel.vue')
  assert.match(panel,/Hornear Mapa · geometría/)
  assert.match(panel,/@click="doBakeTerrain"/)
})
test('G003-T11: nubes emiten métricas desde datos, no tiempos GPU simulados',()=>{
  const vp=source('src/engine/runtime/render/viewport.js')
  for(const name of ['cloudStepsBudget','cloudPrimitives','cloudGrid','cloudEmptySkip','cloudSolarTransmission'])assert.ok(vp.includes(name))
  const panel=source('src/components/PerfPanel.vue')
  // CORR-002: etiquetas compactas, datos de nubes conservados.
  assert.match(panel,/Nubes · pasos/)
  assert.match(panel,/Raymarch nubes/)
})
test('G003-T12: no se introduce segundo motor de nubes o de viento',()=>{
  const sky=source('src/engine/runtime/world/cloud-volume.js')
  assert.match(sky,/level.*shear/)
  assert.doesNotMatch(sky,/new CloudField\(/)
})
