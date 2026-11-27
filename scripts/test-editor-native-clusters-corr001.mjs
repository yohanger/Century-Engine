import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { effectiveTriangleSpan, faceColorBuffers } from '../src/engine/runtime/render/face-topology.js'
import { VIEW_MODES, modeCapability } from '../src/engine/runtime/render/view-diagnostics-contract.js'

const src = path => readFileSync(new URL(`../${path}`, import.meta.url),'utf8')
const attribute = (array, count) => ({count,version:0,getX(i){return array[i*3]},getY(i){return array[i*3+1]},getZ(i){return array[i*3+2]}})
const index = a => ({count:a.length,version:0,getX(i){return a[i]}})
const quad = () => ({attributes:{position:attribute([0,0,0,1,0,0,1,1,0,0,1,0],4)},index:index([0,1,2,0,2,3]),drawRange:{start:0,count:Infinity}})

test('NC01 · un solo triángulo no indexado participa en salida real',()=>{
 const g={attributes:{position:attribute([0,0,0,1,0,0,0,1,0],3)},drawRange:{start:0,count:Infinity}}
 assert.equal(effectiveTriangleSpan(g).faces,1)
 assert.deepEqual([...faceColorBuffers(g,'triangles').xyz],[0,0,0,1,0,0,0,1,0])
})
test('NC02 · cara indexada copia los índices efectivos, no vértices de relleno',()=>{
 const g=quad();const r=faceColorBuffers(g,'triangles')
 assert.equal(r.faces,2)
 assert.deepEqual([...r.xyz.slice(9,18)],[0,0,0,1,1,0,0,1,0])
})
test('NC03 · las caras que comparten vértice se diferencian por ID de triángulo',()=>{
 const a=faceColorBuffers(quad(),'triangles');assert.notDeepEqual([...a.colors.slice(0,3)],[...a.colors.slice(9,12)])
 for(let f=0;f<2;f++) for(let v=1;v<3;v++) assert.deepEqual([...a.colors.slice(f*9,f*9+3)],[...a.colors.slice(f*9+v*3,f*9+v*3+3)])
})
test('NC04 · en modo Clusters un mismo identificador produce un solo color por página',()=>{
 const a=faceColorBuffers(quad(),'clusters',9)
 assert.deepEqual([...a.colors.slice(0,3)],[...a.colors.slice(9,12)])
 assert.notDeepEqual([...a.colors.slice(0,3)],[...faceColorBuffers(quad(),'clusters',10).colors.slice(0,3)])
})
test('NC05 · drawRange expone únicamente triángulos seleccionados',()=>{
 const g=quad();g.drawRange={start:3,count:3}
 assert.equal(effectiveTriangleSpan(g).faces,1)
 assert.deepEqual([...faceColorBuffers(g,'triangles').xyz],[0,0,0,1,1,0,0,1,0])
})
test('NC06 · cambios de índices por LOD de Terrain cambian exactamente las caras visibles',()=>{
 const g=quad(), before=[...faceColorBuffers(g,'triangles').xyz]
 g.index=index([0,1,3]);g.drawRange={start:0,count:3}
 const after=[...faceColorBuffers(g,'triangles').xyz]
 assert.equal(after.length,9)
 assert.notDeepEqual(before.slice(0,9),after)
})
test('NC07 · catálogo separa Triangles, Clusters, LOD y Wireframe',()=>{
 for(const key of ['triangles','clusters','lod','wireframe']) assert.ok(VIEW_MODES.some(m=>m.id===key))
 assert.equal(modeCapability('triangles').supported,true)
 assert.equal(modeCapability('clusters',{lodManager:{clusters:{entries:[]}},renderConfig:{clusterGeometry:false}}).supported,true)
})
test('NC08 · participación desde 1 triángulo y lote grande sin techo arbitrario',()=>{
 const s=src('src/engine/runtime/render/cluster-mesh.js')
 assert.match(s,/MIN_TRIANGLES = 1/)
 assert.doesNotMatch(s,/MAX_TRIANGLES = 100000/)
 assert.match(s,/nativeClusterCandidate\(mesh\)/)
 assert.match(s,/MAX_RESIDENT_BYTES/)
})
test('NC09 · Terrain produce clústeres indexados sin requerir multi_draw',()=>{
 const s=src('src/engine/runtime/render/cluster-mesh.js')
 for(const marker of ['_updateTerrain(entry, camera, focal)','partitionTriangles({ index: indices','geo.setIndex(entry.sourceIndex)','geo.setIndex(new BufferAttribute','mesh.castShadow']) assert.ok(s.includes(marker),marker)
})
test('NC10 · Editor mantiene autoridad geométrica en Lit, no al escoger Cluster',()=>{
 const s=src('src/engine/runtime/scene/environment.js')
 assert.match(s,/const eligible = !this\.isPlaying/)
 assert.doesNotMatch(s,/mode === 'lod' \|\| mode === 'clusters'/)
 const v=src('src/engine/runtime/render/viewport.js');assert.match(v,/if \(this\._editorDiagnosticLod\) this\._editorDiagnosticLod\.update\(this\.camera\)/)
})
test('NC11 · la autoridad de Play tampoco está condicionada a activar clusterGeometry',()=>{
 const a=src('src/engine/runtime/render/lodmgr.js'),b=src('src/engine/runtime/render/webgpu-play.js')
 assert.match(a,/this\.clusters = new ClusterMeshes/)
 assert.doesNotMatch(b,/if \(cfg\.clusterGeometry && cfg\.lod\)/)
})
test('NC12 · restauración de índices al salir y preservación de estado en vistas',()=>{
 const a=src('src/engine/runtime/render/cluster-mesh.js'),b=src('src/engine/runtime/render/view-diagnostics.js')
 assert.match(a,/entry\.base\.setIndex\(entry\.sourceIndex\)/)
 assert.match(b,/finally \{/)
 assert.match(b,/scene\.background = background/)
 assert.match(b,/m\.removeFromParent\(\)/)
})
test('NC13 · edición de Terrain invalida páginas y conserva la geometría de autoría',()=>{
 const s=src('src/engine/runtime/render/cluster-mesh.js')
 for(const marker of ['terrainRevision','t.version','page.debugGeometry?.dispose()','geometryRevision','_remove(entry)']) assert.ok(s.includes(marker),marker)
})
test('NC14 · geometría de un clúster coloreado corresponde a índices seleccionados',()=>{
 const s=src('src/engine/runtime/render/view-diagnostics.js')
 for(const marker of ['entry.terrainActive','new THREE.BufferAttribute(page.index, 1)','entry.shared.pages[i]?.[level]?.geo','_topology(geometry, mode, id)']) assert.ok(s.includes(marker),marker)
})
test('NC15 · las herramientas sin salida real no se falsean',()=>{
 assert.equal(modeCapability('shader').supported,true) // fuente GLSL real, no temporalización por píxel
 assert.equal(modeCapability('indirect').supported,true)
 assert.match(src('src/engine/runtime/render/view-diagnostics.js'),/ScreenBounce excluido/)
})

test('NC16 · Terrain se localiza en el registro nativo durante la vista Clusters', () => {
 const s=src('src/engine/runtime/render/view-diagnostics.js')
 assert.match(s,/byMesh\.get\(owner \|\| obj\)/)
 assert.match(s,/entry\.terrainActive/)
})
test('NC17 · mallas directas conservan particiones reales y ruta GPU separada', () => {
 const a=src('src/engine/runtime/render/cluster-mesh.js')
 const b=src('src/engine/runtime/render/view-diagnostics.js')
 assert.match(a,/_updateDirect\(entry\)/)
 assert.match(a,/partitionTriangles\(\{ index, position: pos \}, 768\)/)
 assert.match(b,/entry\.directActive/)
 assert.match(b,/la partición no implica un draw call por página/i)
})
