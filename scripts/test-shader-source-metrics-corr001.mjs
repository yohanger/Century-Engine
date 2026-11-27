import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fragmentSourceMetrics } from '../src/engine/runtime/render/shader-source-metrics.js'

test('SM01 · métricas derivadas de la fuente GLSL, no del tipo de material', () => {
  const a=fragmentSourceMetrics('void main(){vec4 a=texture2D(map, uv);vec4 b=texture(colorMap,uv);}')
  assert.equal(a.textureCalls,2)
  assert.equal(a.loopStatements,0)
})
test('SM02 · incluye lectura directa y derivada de textura',()=>{
  const x=fragmentSourceMetrics('for(int i=0;i<4;i++){gl_FragColor=texelFetch(tex,i,0)+textureLod(tex,uv,1.);}')
  assert.equal(x.textureCalls,2)
  assert.equal(x.loopStatements,1)
})
test('SM03 · ausencia de fuente no produce una puntuación inventada',()=>{
  assert.equal(fragmentSourceMetrics(null),null)
  assert.equal(fragmentSourceMetrics('  '),null)
})
test('SM04 · operaciones de descarte y líneas conservan evidencia',()=>{
 const x=fragmentSourceMetrics('void main(){\n if (alpha < 0.1) discard;\n gl_FragColor=vec4(1.);\n}')
 assert.equal(x.discardCalls,1)
 assert.equal(x.sourceLines,4)
})
