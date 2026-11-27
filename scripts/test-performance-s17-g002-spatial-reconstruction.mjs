// S17-G002 — pruebas de contrato del experimento espacial sin WebGL real.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const configText = read('src/engine/runtime/render/config.js')
const config = await import(`data:text/javascript,${encodeURIComponent(configText)}`)
const paramsText = read('src/core/templates/renderParams.js')
const upText = read('src/engine/runtime/render/upscale.js')
const lookText = read('src/engine/runtime/render/look.js')
const { normalizeRender, RENDER_DEFAULTS, CLASSIC_RENDER, rendererPreset } = config

// Se extrae la clase real: las dobles de Three no crean contexto ni pretenden verificar shaders GPU.
const VERT = upText.match(/const VERT = '([^']+)'/)[1]
const FRAG = upText.match(/const FRAG = \/\* glsl \*\/`([\s\S]*?)`/)[1]
const RESOLVE = upText.match(/const RESOLVE = \/\* glsl \*\/`([\s\S]*?)`/)[1]
const cls = upText.slice(upText.indexOf('export class TemporalUpscaler {')).replace('export class', 'class')
let count = 0
class FakeRT {
  constructor(){ this.texture = {id:++count}; this.w=1; this.h=1; this.disposed=false }
  setSize(w,h){this.w=w;this.h=h}
  dispose(){this.disposed=true}
}
class Vec2 {
  constructor(x=0,y=0){this.x=x;this.y=y}
  set(x,y){this.x=x;this.y=y;return this}
}
class Mat4 {
  constructor(){this.identity=true}
  copy(){return this}
  invert(){return this}
}
class ShaderMaterial {
  constructor(o){this.uniforms=o.uniforms;this.fragmentShader=o.fragmentShader;this.disposed=false}
  dispose(){this.disposed=true}
}
class Quad {
  constructor(material){this.material=material;this.disposed=false}
  render(renderer){renderer.renders.push({target:renderer.getRenderTarget(),shader:this.material.fragmentShader,edge:this.material.uniforms.uSpatialEdge?.value})}
  dispose(){this.disposed=true}
}
const THREE={WebGLRenderTarget:FakeRT, Vector2:Vec2, Matrix4:Mat4, ShaderMaterial, HalfFloatType:1,LinearFilter:1}
const TemporalUpscaler = new Function('THREE','FullScreenQuad','VERT','FRAG','RESOLVE','hdrTarget',`${cls};return TemporalUpscaler`)(THREE,Quad,VERT,FRAG,RESOLVE,()=>new FakeRT())
function fixture(){
  let rt = {id:'canvas'}
  const renderer={renders:[],getRenderTarget:()=>rt,setRenderTarget:v=>{rt=v}}
  const u=new TemporalUpscaler()
  u.setSize(1280,720)
  const o={color:{},depth:{},inW:960,inH:540,vp:new Mat4(),jitter:[0,0],temporal:false}
  return {renderer,u,o}
}

test('G002-01: normalización histórica conserva Catmull y los valores de render',()=>{
  assert.equal(RENDER_DEFAULTS.spatialReconstruction,'catmull')
  assert.equal(CLASSIC_RENDER.spatialReconstruction,'catmull')
  assert.equal(normalizeRender({look:'realista',resScale:.75}).spatialReconstruction,'catmull')
  assert.equal(normalizeRender({look:'realista',resScale:.75,spatialReconstruction:'edge-guard'}).spatialReconstruction,'edge-guard')
  assert.equal(normalizeRender({look:'realista',spatialReconstruction:'inventado'}).spatialReconstruction,'catmull')
  assert.equal(rendererPreset('mobile').spatialReconstruction,'catmull')
})
test('G002-02: TAA y resolución dinámica siguen prohibidos tras normalizar',()=>{
  const r=normalizeRender({look:'realista',taa:true,dynRes:true,resScale:.75,spatialReconstruction:'edge-guard'})
  assert.equal(r.taa,false);assert.equal(r.dynRes,false);assert.equal(r.resScale,.75)
  assert.equal(normalizeRender(null).look,'clasico')
})
test('La escala del 25 % y los filtros directos se guardan en ambos aspectos', () => {
  for (const look of ['realista', 'clasico']) {
    for (const spatialReconstruction of ['linear', 'nearest']) {
      const cfg = normalizeRender({ look, resScale: 0.25, spatialReconstruction })
      assert.equal(cfg.resScale, 0.25)
      assert.equal(cfg.spatialReconstruction, spatialReconstruction)
    }
  }
  assert.equal(normalizeRender({ resScale: 0.1 }).resScale, 0.25)
  assert.equal(normalizeRender({ resScale: 2 }).resScale, 1)
})
test('G002-03: control existente ParamForm, visible solo a escala menor que 1',()=>{
  assert.match(paramsText,/key: 'spatialReconstruction'/)
  assert.match(paramsText,/when: \{ resScale: \(v\) => Number\(v\) < 0\.999, psx: false \}/)
  assert.match(paramsText,/\['catmull', 'Catmull-Rom'\]/)
  assert.match(paramsText,/\['edge-guard', 'Protección de bordes \(experimental\)'\]/)
})
test('G002-04: una sola ruta de reconstrucción en LookPipeline y el mismo F3',()=>{
  assert.match(lookText,/spatialAdaptive: this\.cfg\.spatialReconstruction === 'edge-guard'/)
  assert.match(lookText,/perf\.time\('Reconstrucción'/)
  assert.match(lookText,/st\.spatialReconstruction = this\.cfg\.spatialReconstruction \|\| 'catmull'/)
  assert.match(lookText,/get split\(\).*this\.vp\.playing.*c\.resScale < 0\.999/)
})
test('G002-05: shader espacial experimental solo se ejecuta sin TAA',()=>{
  const branch=FRAG.slice(FRAG.indexOf('if (uUseHist < 0.5)'), FRAG.indexOf('// 3x3 de la imagen interna'))
  assert.match(branch,/if \(uSpatialEdge > 0\.5\)/)
  assert.match(branch,/clamp\(result, low, high\)/)
  assert.match(branch,/float contrast = clamp/)
  assert.equal((branch.match(/texture2D\(tColor,/g)||[]).length,4)
  assert.match(FRAG,/precision highp float/)
})
test('G002-06: Catmull predeterminado es opaco, sin historial ni buffers añadidos',()=>{
  const {renderer,u,o}=fixture(); const tex=u.render(renderer,o)
  assert.equal(u.mat.uniforms.uUseHist.value,0)
  assert.equal(u.mat.uniforms.uSpatialEdge.value,0)
  assert.equal(renderer.renders.length,1)
  assert.equal(renderer.getRenderTarget().id,'canvas')
  assert.strictEqual(tex,u.hist[u.cur].texture)
  u.dispose();assert.ok(u.hist.every(x=>x.disposed));assert.equal(u.out.disposed,true)
})
test('G002-07: opción experimental cambia solo un uniforme, no el número de pasadas',()=>{
  const {renderer,u,o}=fixture();o.spatialAdaptive=true
  const t=u.render(renderer,o)
  assert.equal(u.mat.uniforms.uSpatialEdge.value,1)
  assert.equal(u.mat.uniforms.uUseHist.value,0)
  assert.equal(renderer.renders.length,1)
  assert.strictEqual(t,u.hist[u.cur].texture)
  assert.equal(renderer.getRenderTarget().id,'canvas')
})
test('G002-08: la opción experimental no se activa con temporal aunque la pidan',()=>{
  const {renderer,u,o}=fixture();o.spatialAdaptive=true;o.temporal=true
  u.render(renderer,o)
  assert.equal(u.mat.uniforms.uSpatialEdge.value,0)
  assert.equal(renderer.renders.length,2)
})
test('G002-09: redimensionar invalida historia y conserva opción reversible',()=>{
  const {renderer,u,o}=fixture();o.spatialAdaptive=true;u.render(renderer,o)
  u.setSize(1024,768);assert.equal(u.valid,false)
  assert.ok(u.hist.every(x=>x.w===1024&&x.h===768))
  o.spatialAdaptive=false;u.render(renderer,o)
  assert.equal(u.mat.uniforms.uSpatialEdge.value,0)
})
test('G002-10: protección de bordes no introduce interpolación de temporales ni estado persistente',()=>{
  assert.equal((upText.match(/new THREE\.WebGLRenderTarget/g)||[]).length,1)
  assert.equal((upText.match(/new FullScreenQuad/g)||[]).length,1)
  assert.doesNotMatch(configText,/taa: r\.taa|dynRes: r\.dynRes/)
  assert.doesNotMatch(lookText,/new .*SpatialReconstructionManager/)
})
