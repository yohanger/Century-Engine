import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { adaptiveTerrainIndex } from '../src/engine/runtime/render/terrain-adaptive.js'
import { terrainBakePlan } from '../src/engine/runtime/render/terrain-bake.js'
const file = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const settings={heightError:0.08,paintError:0.06}
const fixture=(nx,nz=nx) => {
  const heights=new Float32Array((nx+1)*(nz+1)),splat=new Uint8Array(heights.length*8)
  for(let i=0;i<heights.length;i++) splat[i*8]=255
  return {heights,splat}
}
function topology(index,nx,nz){
  const edges=new Map(),seen=new Set(index)
  const width=nx+1
  for(let t=0;t<index.length;t+=3){
    const a=index[t],b=index[t+1],c=index[t+2]
    assert.ok(a!==b&&b!==c&&a!==c)
    const ax=a%width,az=Math.floor(a/width),bx=b%width,bz=Math.floor(b/width),cx=c%width,cz=Math.floor(c/width)
    assert.notEqual((bx-ax)*(cz-az)-(cx-ax)*(bz-az),0,'triángulo degenerado')
    for (const [u,v] of [[a,b],[b,c],[c,a]]){
      const k=[Math.min(u,v),Math.max(u,v)].join(':')
      edges.set(k,(edges.get(k)||0)+1)
    }
  }
  for(const [name,count] of edges)assert.ok(count===1||count===2,`${name}: topología no manifold (${count})`)
  for(let x=0;x<=nx;x++){assert.ok(seen.has(x));assert.ok(seen.has(nz*width+x))}
  for(let z=0;z<=nz;z++){assert.ok(seen.has(z*width));assert.ok(seen.has(z*width+nx))}
  // No T-junctions: todo vértice sobre una arista horizontal/vertical interior
  // debe ser un extremo de esa arista, no estar oculto dentro de ella.
  for(const key of edges.keys()){
    const [a,b]=key.split(':').map(Number),ax=a%width,az=Math.floor(a/width),bx=b%width,bz=Math.floor(b/width)
    if (az===bz&&Math.abs(ax-bx)>1) for(let x=Math.min(ax,bx)+1;x<Math.max(ax,bx);x++)assert.ok(!seen.has(az*width+x),`T-junction horizontal (${x},${az})`)
    if (ax===bx&&Math.abs(az-bz)>1) for(let z=Math.min(az,bz)+1;z<Math.max(az,bz);z++)assert.ok(!seen.has(z*width+ax),`T-junction vertical (${ax},${z})`)
  }
}
test('CORR001-01 · superficie plana reduce triángulos de índice cercano, sin altura inventada',()=>{
 const n=128,f=fixture(n),p=terrainBakePlan(f.heights,f.splat,n,n,settings)
 assert.ok(p.triangles<1024 && p.shape.worst>0.05); assert.ok(p.height<1e-6);assert.ok(p.paint<1e-6)
 topology(p.index,n,n)
})
test('CORR001-02 · relieve localizado refina la zona sin bloquear la pieza completa',()=>{
 const n=128,f=fixture(n);f.heights[60*(n+1)+56]=8
 const p=terrainBakePlan(f.heights,f.splat,n,n,settings)
 assert.ok(p.triangles<1000 && p.triangles>512);assert.ok(p.height<=settings.heightError+1e-6)
 topology(p.index,n,n)
})
test('CORR001-03 · pintura de vértices impide borrar detalles por encima del umbral',()=>{
 const n=64,f=fixture(n),i=31*(n+1)+32
 f.splat[i*8]=0;f.splat[i*8+1]=255
 const p=terrainBakePlan(f.heights,f.splat,n,n,settings)
 assert.ok(p.paint<=settings.paintError+1e-6)
 assert.ok(p.index.includes(i),'el vértice de discontinuidad debe conservarse')
 topology(p.index,n,n)
})
test('CORR001-04 · rectángulo irregular conserva bordes y topología sin costuras',()=>{
 const nx=31,nz=18,f=fixture(nx,nz)
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++)f.heights[z*(nx+1)+x]=Math.sin(x*.3)*Math.cos(z*.2)*.25
 const p=terrainBakePlan(f.heights,f.splat,nx,nz,settings)
 assert.ok(p.triangles>0 && p.triangles<2*nx*nz)
 topology(p.index,nx,nz)
})
test('CORR001-05 · no muta heightmap ni pintura de origen',()=>{
 const n=32,f=fixture(n); f.heights[16*(n+1)+16]=1.4
 const h=f.heights.slice(),s=f.splat.slice()
 adaptiveTerrainIndex(f.heights,f.splat,n,n,.04,.02)
 assert.deepEqual(f.heights,h); assert.deepEqual(f.splat,s)
})
test('CORR001-06 · integración cercana consume índices adaptativos reales',()=>{
 const cluster=file('src/engine/runtime/render/cluster-mesh.js')
 assert.match(cluster,/entry\.bakePlan\?\.index \|\| entry\.sourceIndex\.array/)
 assert.match(cluster,/&& !entry\.bakePlan\?\.index/)
 const lod=file('src/engine/runtime/render/lodmgr.js')
 assert.match(lod,/s\.bakePlan\?\.index/)
 const ui=file('src/components/PerfPanel.vue')
 assert.match(ui,/terrainEffectiveTriangles/)
 assert.match(ui,/terrainBakedTriangles/)
})
test('CORR001-07 · nubes no se ocultan ni sustituyen por geometría inventada',()=>{
 const view=file('src/engine/runtime/render/view-diagnostics.js')
 assert.match(view,/obj === this\.vp\.sky/)
 assert.match(view,/uCloudDiagnostic/)
 assert.doesNotMatch(view,/for \(const o of \[this\.vp\.sky, this\.vp\.overlay/)
 const shader=file('src/engine/runtime/render/skylib.js')
 assert.match(shader,/cloudLayer\(vec3 rd, out float workRatio\)/)
 assert.match(shader,/workRatio = float\(executedSteps\)/)
 assert.match(shader,/uCloudDiagnostic == 1/)
})
test('CORR001-08 · diagnóstico no inventa coste GPU',()=>{
 const view=file('src/engine/runtime/render/view-diagnostics.js')
 assert.match(view,/Métrica ESTÁTICA, NO tiempo GPU/)
 assert.match(view,/Estimación CPU, NO tiempo GPU/)
 assert.match(view,/SPLAT_FS_COLOR/)
 assert.match(view,/uCloudDiagnostic\.value = mode === 'shader'/)
 const panel=file('src/components/PerfPanel.vue')
 // CORR-002 trasladó la escala al viewport; continúa prohibido atribuirle tiempo GPU.
 const hud=file('src/components/ViewportDiagnosticsHud.vue')
 assert.match(hud,/diagnostics-heat/)
 assert.match(panel,/cloudStepsBudget/)
})
