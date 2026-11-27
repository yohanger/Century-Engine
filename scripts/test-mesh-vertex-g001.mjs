// LF-MESH-VERTEX-G001: geometría real, selección, persistencia y contratos de autoría.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PolyMesh, ekey } from '../src/engine/runtime/mesh/polymesh.js'
import { make, MESH_KINDS } from '../src/engine/runtime/mesh/generators.js'
import { appendVertex, connectVertices, del } from '../src/core/mesh/ops.js'
import { Sel } from '../src/core/mesh/sel.js'
import { polyBuffers } from '../src/engine/runtime/mesh/buffers.js'
const source = name => readFileSync(new URL('../' + name, import.meta.url),'utf8')
const start = () => { const poly = make('vertex'); const sel = new Sel(); sel.v.add(0); return {poly,sel} }

test('VERT-01: Vértice figura en el mismo catálogo de mallas',()=>assert.equal(MESH_KINDS.vertex.label,'Vértice'))
test('VERT-02: crea exactamente 1 vértice, sin cara ni aristas ficticias',()=>{ const {poly}=start(); assert.deepEqual(poly.v,[[0,0,0]]); assert.deepEqual(poly.f,[]); assert.deepEqual(poly.we,[]) })
test('VERT-03: selecciona el primer punto real en Edit Mesh',()=>{const s=source('src/core/mesh/session.js');assert.match(s,/obj\.kind === 'vertex'.*this\.poly\.v\.length === 1/);assert.match(s,/this\.sel\.v\.add\(0\)/)})
test('VERT-04: append conecta un único origen seleccionado y selecciona el nuevo',()=>{const {poly,sel}=start();assert.equal(appendVertex(poly,sel,'vertex',[3,0,5],0),undefined);assert.deepEqual(poly.v[1],[3,0,5]);assert.deepEqual(poly.we,[[0,1]]);assert.deepEqual([...sel.v],[1])})
test('VERT-05: secuencia forma una cadena sin caras',()=>{const {poly,sel}=start();for(const p of [[1,0,0],[2,0,0],[3,0,1]]) assert.equal(appendVertex(poly,sel,'vertex',p,[...sel.v][0]),undefined);assert.deepEqual(poly.we,[[0,1],[1,2],[2,3]]);assert.equal(poly.f.length,0)})
test('VERT-06: sin origen seleccionado crea punto independiente',()=>{const {poly,sel}=start();assert.equal(appendVertex(poly,sel,'vertex',[0,0,3]),undefined);assert.equal(poly.we.length,0);assert.deepEqual([...sel.v],[1])})
test('VERT-07: dos puntos independientes se conectan explícitamente',()=>{const {poly,sel}=start();appendVertex(poly,sel,'vertex',[2,0,0]);sel.v=new Set([0,1]);assert.equal(connectVertices(poly,sel,'vertex'),undefined);assert.deepEqual(poly.we,[[0,1]])})
test('VERT-08: rechaza conexiones duplicadas',()=>{const {poly,sel}=start();appendVertex(poly,sel,'vertex',[2,0,0],0);sel.v=new Set([0,1]);assert.match(connectVertices(poly,sel,'vertex'),/ya están conectados/);assert.equal(poly.we.length,1)})
test('VERT-09: conexión requiere exactamente 2 vértices',()=>{const {poly,sel}=start();assert.match(connectVertices(poly,sel,'vertex'),/exactamente dos/);assert.equal(poly.we.length,0)})
test('VERT-10: no crea vértices inválidos',()=>{const {poly,sel}=start();assert.match(appendVertex(poly,sel,'vertex',[NaN,0,0],0),/inválida/);assert.match(appendVertex(poly,sel,'vertex',[Infinity,0,0]),/inválida/);assert.equal(poly.v.length,1)})
test('VERT-11: rechaza origen fuera de rango',()=>{const {poly,sel}=start();assert.match(appendVertex(poly,sel,'vertex',[1,0,0],99),/origen/);assert.equal(poly.v.length,1)})
test('VERT-12: rechaza aristas de longitud cero',()=>{const {poly,sel}=start();assert.match(appendVertex(poly,sel,'vertex',[0,0,0],0),/separado/);assert.equal(poly.v.length,1)})
test('VERT-13: agregar punto no disponible en modo caras/aristas',()=>{const {poly,sel}=start();assert.match(appendVertex(poly,sel,'face',[0,0,3]),/Vértices/);assert.equal(poly.v.length,1)})
test('VERT-14: edición conserva aristas sueltas en JSON del proyecto',()=>{const {poly,sel}=start();appendVertex(poly,sel,'vertex',[2,0,0],0);const restored=PolyMesh.fromJSON(poly.toJSON());assert.deepEqual(restored.v,poly.v);assert.deepEqual(restored.we,poly.we);assert.deepEqual(restored.f,[])})
test('VERT-15: buffers para 1 punto no fabrican triángulos de Player',()=>{const b=polyBuffers(make('vertex'));assert.equal(b.positions.length,0);assert.equal(b.indices.length,0)})
test('VERT-16: buffers de una cadena tampoco generan caras ni UV ficticias',()=>{const {poly,sel}=start();appendVertex(poly,sel,'vertex',[1,0,0],0);const b=polyBuffers(poly,{blockout:true});assert.equal(b.positions.length,0);assert.equal(b.indices.length,0);assert.equal(b.uvs.length,0)})
test('VERT-17: borrar un punto reconstruye índices de aristas sin corromper la malla',()=>{const {poly,sel}=start();appendVertex(poly,sel,'vertex',[1,0,0],0);appendVertex(poly,sel,'vertex',[2,0,0],1);sel.v=new Set([1]);assert.equal(del(poly,sel,'vertex','verts'),undefined);assert.equal(poly.v.length,2);assert.equal(poly.we.length,0)})
test('VERT-18: UV del material siguen intactas en mallas mixtas',()=>{const poly=make('cube');poly.ensureUV();const before=structuredClone(poly.uv);const sel=new Sel();assert.equal(appendVertex(poly,sel,'vertex',[10,0,10]),undefined);poly.validateAttributes();assert.deepEqual(poly.uv,before)})
test('VERT-19: nodos se crean desde el catálogo y ubicación de cámara existente',()=>{const s=source('src/core/editor/placement.js');assert.match(s,/spec\.kind === 'vertex'/);assert.match(s,/this\._placement\(spot, t\)/);assert.match(s,/this\.enterEdit\(node\.id\)/)})
test('VERT-20: la herramienta de colocar no crea un gestor adicional',()=>{const s=source('src/core/mesh/session.js');assert.match(s,/toggleVertexDraw\(\)/);assert.match(s,/this\.run\('Colocar vértice'/);assert.match(s,/O\.appendVertex/);assert.match(s,/O\.connectVertices/)})
test('VERT-21: la colocación utiliza proyección del viewport y Snap existente',()=>{const s=source('src/core/mesh/session.js');assert.match(s,/this\._ray\(x, y\)/);assert.match(s,/snapEnabled\(settings, 'translate'\)/);assert.match(s,/this\.visual\.worldToLocal\(point\)/)})
test('VERT-22: no invade navegación, selección con modificadores ni atajos',()=>{const s=source('src/core/mesh/session-input.js');assert.match(s,/!d\.e\.altKey && !d\.e\.shiftKey && !d\.e\.ctrlKey/);assert.match(s,/store\.edit\.vertexDraw && this\.mode === 'vertex'/);assert.match(s,/store\.edit\.vertexDraw = false/);assert.match(s,/if \(this\.vp\.isNavigating\) return/)})
test('VERT-23: el trazado se desactiva al salir del modo edición y cambiar modo',()=>{const s=source('src/core/mesh/session.js');assert.ok(s.match(/store\.edit\.vertexDraw = false/g)?.length>=3)})
test('VERT-24: UI muestra trazado y conecta selección sin crear segunda interfaz',()=>{const s=source('src/components/MeshPanel.vue');assert.match(s,/data-testid="mesh-vertex-draw"/);assert.match(s,/@click="drawVertex"/);assert.match(s,/@click="connectVerts"/)})
test('VERT-25: aristas sueltas participan en selección y operaciones existentes',()=>{const {poly,sel}=start();appendVertex(poly,sel,'vertex',[1,0,0],0);assert.ok(poly.edges().has(ekey(0,1)));assert.equal(poly.f.length,0)})
test('VERT-26: el render/editor aprovecha buffers y overlay originales',()=>{const s=source('src/engine/runtime/nodes/mesh.js');assert.match(s,/geometryOf\(poly/);assert.match(source('src/core/mesh/session.js'),/this\.points = mk\(new THREE\.Points/);assert.match(source('src/core/mesh/session.js'),/this\.lines = mk\(new THREE\.LineSegments/)})
