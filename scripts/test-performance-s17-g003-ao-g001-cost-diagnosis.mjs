import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GpuTimer, PerfMonitor, PerfStats } from '../src/engine/runtime/render/perf.js'

function fakeRenderer(ext = false) {
  const queries = []
  const gl = {
    TIME_ELAPSED_EXT: 101, GPU_DISJOINT_EXT: 102, QUERY_RESULT_AVAILABLE: 103, QUERY_RESULT: 104,
    getExtension: name => name === 'EXT_disjoint_timer_query_webgl2' && ext ? {TIME_ELAPSED_EXT:101,GPU_DISJOINT_EXT:102} : null,
    getParameter: () => !!gl.disjoint,
    createQuery() { const q={id:queries.length+1,ms:1};queries.push(q);return q },
    beginQuery(_target,q){assert.equal(gl.active,undefined,'no se pueden anidar consultas GPU');gl.active=q},
    endQuery(){assert.ok(gl.active);gl.active=undefined},
    getQueryParameter(q,field){return field===103 ? true : q.ms*1_000_000},
    deleteQuery(q){q.deleted=true},
  }
  return { gl,queries,renderer:{getContext:()=>gl,info:{autoReset:true,reset(){},render:{calls:3,triangles:10,lines:0,points:0},memory:{geometries:2,textures:1}}} }
}
function aoPass(throwPhase=''){
  const calls=[]
  const pass={gtaoMaterial:{type:'gtao'},pdMaterial:{type:'denoise'},copyMaterial:{type:'copy'},blendMaterial:{type:'blend'},normalMaterial:{type:'normal'},
    _renderOverride(renderer,material){calls.push(material.type);if(throwPhase===material.type)throw new Error(material.type)},
    _renderPass(renderer,material){calls.push(material.type);if(throwPhase===material.type)throw new Error(material.type)},
    render(renderer){this._renderOverride(renderer,this.normalMaterial);this._renderPass(renderer,this.gtaoMaterial);this._renderPass(renderer,this.pdMaterial);this._renderPass(renderer,this.copyMaterial);this._renderPass(renderer,this.blendMaterial)} }
  return {pass,calls}
}

test('AO-01 · profiler desactivado no crea ninguna consulta ni serie CPU',()=>{
  const {renderer,queries}=fakeRenderer(true);const p=new PerfMonitor(renderer,()=>100)
  const {pass,calls}=aoPass();p.wrapAO(pass);p.wrapPass(pass,'AO');pass.render(renderer)
  assert.deepEqual(calls,['normal','gtao','denoise','copy','blend']);assert.equal(queries.length,0)
  assert.deepEqual(p.stats.snapshot().cpu,{})
})
test('AO-02 · profiler mide las cuatro fases sin alterar el material ni la salida',()=>{
  const {renderer}=fakeRenderer();let t=0;const p=new PerfMonitor(renderer,()=>t++)
  const {pass,calls}=aoPass(),before=Object.values(pass).filter(x=>x?.type).slice();p.wrapAO(pass);p.wrapPass(pass,'AO')
  p.enable(true);p.frameStart();pass.render(renderer);p.frameEnd()
  assert.equal(p.stats.snapshot().cpu['AO · G-buffer'].avg,1)
  assert.equal(p.stats.snapshot().cpu['AO · oclusión'].avg,1)
  assert.equal(p.stats.snapshot().cpu['AO · denoise'].avg,1)
  assert.equal(p.stats.snapshot().cpu['AO · composición'].avg,2)
  assert.equal(p.stats.snapshot().cpu.AO.avg,11)
  assert.deepEqual(Object.values(pass).filter(x=>x?.type),before)
  assert.deepEqual(calls,['normal','gtao','denoise','copy','blend'])
})
test('AO-03 · GPU fases exclusivas, AO total agregado sin anidamiento',()=>{
  const {renderer,queries}=fakeRenderer(true);const p=new PerfMonitor(renderer,()=>1)
  const {pass}=aoPass();p.wrapAO(pass);p.wrapPass(pass,'AO');p.enable(true);p.frameStart();pass.render(renderer);p.frameEnd()
  const g=p.stats.snapshot().gpu
  assert.equal(g['AO · G-buffer'].avg,1);assert.equal(g['AO · oclusión'].avg,1)
  assert.equal(g['AO · denoise'].avg,1);assert.equal(g['AO · composición'].avg,2)
  assert.equal(g.AO.avg,6,'AO exterior solo mide tramos no incluidos en las fases')
  assert.equal(g['AO · total'].avg,11)
  const totalPasadas=Object.entries(g).reduce((a,[k,v])=>a+(k==='AO · total'?0:v.avg),0)
  assert.equal(totalPasadas,11,'el total GPU no suma dos veces AO')
  assert.equal(queries.every(q=>q.deleted),true)
})
test('AO-04 · cambiar AO ON/OFF registra cero en la muestra siguiente sin congelar la serie',()=>{
  const s=new PerfStats(3)
  s.gpuFrame({'Escena':5,'AO':10,'AO · total':11})
  s.gpuFrame({'Escena':4})
  assert.equal(s.snapshot().gpu['AO · total'].avg,5.5)
  assert.equal(s.snapshot().gpu['AO'].avg,5)
  s.gpuFrame({'Escena':3})
  assert.equal(s.snapshot().gpu['AO · total'].avg,11/3)
})
test('AO-05 · sin extensión GPU las fases están disponibles solo como tiempos CPU',()=>{
  const {renderer}=fakeRenderer(false);let t=0;const p=new PerfMonitor(renderer,()=>t++),{pass}=aoPass()
  p.wrapPass(pass,'AO');p.wrapAO(pass);p.enable(true);p.frameStart();pass.render(renderer);p.frameEnd()
  assert.equal(p.gpuSupported,false)
  assert.equal(p.stats.snapshot().gpu['AO · total'],undefined)
  assert.ok(p.stats.snapshot().cpu['AO · denoise'].avg>0)
})
test('AO-06 · GpuTimer descarta resultados y consultas tras GPU disjoint',()=>{
  const {gl,queries}=fakeRenderer(true),timer=new GpuTimer(gl)
  timer.begin('AO');timer.end();gl.disjoint=true;timer.endFrame()
  assert.equal(timer.pending.length,0);assert.equal(timer.done.size,0);assert.equal(queries.every(q=>q.deleted),true)
})
test('AO-07 · cerrar Stats cancela las consultas pendientes y vuelve a autoReset',()=>{
  const {renderer,queries}=fakeRenderer(true);const p=new PerfMonitor(renderer,()=>0)
  p.enable(true);p.gpu.begin('AO');p.gpu.end()
  assert.equal(queries.length,1)
  p.enable(false)
  assert.equal(p.gpu.pending.length,0);assert.equal(queries[0].deleted,true);assert.equal(renderer.info.autoReset,true)
})
test('AO-08 · instrumentar GTAO repetidamente no duplica envoltorios',()=>{
  const {renderer}=fakeRenderer();let t=0;const p=new PerfMonitor(renderer,()=>t++),{pass}=aoPass()
  p.wrapAO(pass);const ref=pass._renderPass;p.wrapAO(pass);assert.equal(pass._renderPass,ref)
  p.wrapPass(pass,'AO');p.enable(true);p.frameStart();pass.render(renderer);p.frameEnd()
  assert.equal(p.stats.snapshot().cpu['AO · composición'].avg,2)
})
test('AO-09 · errores de pase cierran sus temporizadores y respetan el error',()=>{
  const {renderer}=fakeRenderer(true);let t=0;const p=new PerfMonitor(renderer,()=>t++),{pass}=aoPass('denoise')
  p.wrapAO(pass);p.wrapPass(pass,'AO');p.enable(true)
  assert.throws(()=>pass.render(renderer),/denoise/)
  assert.equal(p.gpu.stack.length,0)
  p.gpu.dispose()
})
test('AO-10 · sin G-buffer interno se miden solamente las etapas presentes',()=>{
  const {renderer}=fakeRenderer(true);const p=new PerfMonitor(renderer,()=>1),{pass}=aoPass()
  pass.render=function(renderer){this._renderPass(renderer,this.gtaoMaterial);this._renderPass(renderer,this.pdMaterial);this._renderPass(renderer,this.blendMaterial)}
  p.wrapAO(pass);p.wrapPass(pass,'AO');p.enable(true);p.frameStart();pass.render(renderer);p.frameEnd()
  const g=p.stats.snapshot().gpu
  assert.equal(g['AO · G-buffer'],undefined);assert.equal(g['AO · total'].avg,7)
})
test('AO-11 · el renderizador conserva GTAOPass, sus 16+16 muestras y su orden',()=>{
  const src=readFileSync(new URL('../src/engine/runtime/render/look.js',import.meta.url),'utf8')
  assert.match(src,/if \(p === this\.aoPass\) this\.vp\.perf\.wrapAO\(p\)/)
  assert.match(src,/new GTAOPass\(vp\.scene, vp\.camera/)
  assert.match(src,/samples: 16/)
  assert.match(src,/composer\.addPass\(this\.aoPass\)/)
})
test('AO-12 · UI evita sumar AO total dos veces y mantiene monitor compartido',()=>{
  const src=readFileSync(new URL('../src/components/PerfPanel.vue',import.meta.url),'utf8')
  assert.match(src,/name === 'AO · total' \? 0 : v\.avg/)
  assert.match(src,/GPU · pasadas/)
  assert.match(src,/monitor: \{ type: Object, required: true \}/)
})
