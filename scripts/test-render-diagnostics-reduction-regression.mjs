import test from 'node:test'
import assert from 'node:assert/strict'
import { PlaneGeometry } from 'three'
import { serializeLodGeometry } from '../src/engine/runtime/render/lodgeo.js'
import { buildIndexedLods, indexExactVertices } from '../src/engine/runtime/render/lod-indexed.js'
import { fragmentSourceMetrics } from '../src/engine/runtime/render/shader-source-metrics.js'
import { geometryTriangles } from '../src/engine/runtime/render/view-diagnostics-contract.js'
import { diagnosticHudModel } from '../src/engine/runtime/render/diagnostic-hud-model.js'

test('LOD no une dos superficies separadas por menos que una celda del simplificador anterior', async () => {
  const plane = serializeLodGeometry(new PlaneGeometry(2, 2, 32, 32))
  const count = plane.position.length / 3
  const position = new Float32Array(plane.position.length * 2)
  position.set(plane.position); position.set(plane.position, plane.position.length)
  for (let i=count;i<count*2;i++) position[i*3+2] = 0.0001
  const index = new Uint32Array(plane.index.length*2)
  index.set(plane.index); index.set(plane.index.map(i=>i+count),plane.index.length)
  const [lod] = await buildIndexedLods({ position, index, attrs:{} }, [0.16])
  assert.ok(lod && lod.triangles < index.length/3)
  for (let i=0;i<lod.index.length;i+=3) {
    const z=Array.from(lod.index.slice(i,i+3),v=>lod.position[v*3+2])
    assert.equal(z[0],z[1]); assert.equal(z[1],z[2])
    assert.ok(z[0]===0 || z[0]===position[count*3+2])
  }
})
test('indexación exacta conserva discontinuidades de UV de una entrada sin índice', () => {
  const mesh={position:new Float32Array([0,0,0, 0,0,0, 0,0,0]),attrs:{uv:{array:new Float32Array([0,0, 1,0, 0,0]),itemSize:2}}}
  assert.deepEqual([...indexExactVertices(mesh).index],[0,1,0])
})
test('diagnóstico GLSL descarta comentarios, ramas desactivadas y funciones sin usar', () => {
  const source=`#define USE_MAP 1
#define NUM_LIGHTS 0
// texture(unused, uv)
float unused(){return texture(unused,uv).x;}
vec4 base(){return texture(map,uv);}
void main(){
#ifdef USE_MAP
 gl_FragColor=base();
#endif
#if NUM_LIGHTS > 0
 texture(shadow,uv);
#elif defined(USE_NORMALMAP)
 texture(normalMap,uv);
#else
 gl_FragColor+=vec4(0.0);
#endif
}`
  assert.equal(fragmentSourceMetrics(source).textureCalls,1)
  assert.equal(fragmentSourceMetrics('#if invalid(1)\ntexture(a,b);\n#endif'),null)
})
test('drawRange start limita los triángulos y HUD expone los niveles reales simultáneos', () => {
  assert.equal(geometryTriangles({geometry:{index:{count:30},drawRange:{start:27,count:30}}}),1)
  const hud=diagnosticHudModel('lod',{mode:'lod',supported:true,triangles:120,noLod:0,lodHistogram:{0:100,2:20}})
  assert.deepEqual(hud.facts.slice(2).map(x=>[x.label,x.value]),[['LOD 0 · caras','100'],['LOD 2 · caras','20']])
})

test('reiniciar el profiler descarta consultas GPU diferidas del período anterior', async () => {
  const { PerfMonitor } = await import('../src/engine/runtime/render/perf.js')
  const deleted=[]
  const gl={getExtension:()=>({TIME_ELAPSED_EXT:1}),deleteQuery:q=>deleted.push(q)}
  const monitor=new PerfMonitor({getContext:()=>gl,info:{autoReset:true}})
  monitor.stats.gpuSample('Cielo atmosférico',12)
  monitor.gpu.pending.push({q:17,name:'Cielo atmosférico',frame:0})
  monitor._last=123
  monitor.reset()
  assert.deepEqual(deleted,[17])
  assert.equal(monitor.gpu.pending.length,0)
  assert.deepEqual(monitor.stats.snapshot().gpu,{})
  assert.equal(monitor._last,0)
})
