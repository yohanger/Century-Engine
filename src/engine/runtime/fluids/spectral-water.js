/*!
MIT License

Copyright (c) 2026 Humpalumps

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
// Ultra Water's FFT and bathymetric breakers adapted to the engine's PBR pipeline.
// MIT attribution and exact upstream revisions: vendor/SOURCES.json.
import * as THREE from 'three'
import { oceanGrid } from './ocean-grid.js'
import { OceanSim, defaultOceanParams } from './vendor/ultra-water/water/OceanSim.js'
import { WATER_GLSL, SWASH_GLSL } from './vendor/ultra-water/water/OceanSurface.js'
import { bakeShoreMap } from './vendor/ultra-water/water/shoreMap.js'
import { FullscreenQuad, rawPass } from './vendor/ultra-water/engine/fullscreen.js'
const QUERY_SIZE=48
const GLSL=`uniform float lfStrength;\nuniform vec2 lfOrigin;\nuniform float lfLevel;\nuniform float lfCell;\nuniform float lfPolar;\nuniform vec4 lfBounds;\n${WATER_GLSL.replace('#define PI 3.14159265359','#ifndef PI\n#define PI 3.14159265359\n#endif').replace('return d;','return d * lfStrength;')}\n${SWASH_GLSL}
float lfHeight(vec2 p){
  vec4 sh=shoreSample(p);vec3 d=waterAt(p,vec3(0.0));
  if(sh.x>0.0){vec3 film=swash(p,sh.x);return film.x>0.001?sh.x+film.x:-10000.0;}
  return max(d.y,sh.x+0.006);
}`
function withRenderer(renderer,fn){
  const target=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),test=renderer.getScissorTest(),auto=renderer.autoClear
  try{renderer.setScissorTest(false);renderer.autoClear=true;return fn()}
  finally{renderer.setRenderTarget(target);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);renderer.autoClear=auto}
}
function uniforms(sim,shore,body,origin){
  return {uDisp0:{value:null},uDisp1:{value:null},uDisp2:{value:null},uSlope0:{value:null},uSlope1:{value:null},uSlope2:{value:null},uSlope3:{value:null},uLength:{value:new THREE.Vector4(...sim.lengths)},uWaveDamp:{value:new THREE.Vector2(14,0.55)},uImpact:{value:Array.from({length:8},()=>new THREE.Vector4())},uImpactSize:{value:Array(8).fill(0.2)},uShore:{value:shore.texture},uTravel:{value:shore.travel},uSurf:{value:shore.surf},uShoreExtent:{value:shore.extent},uTime:{value:0},uShoreWave:{value:new THREE.Vector4()},uSwellDir:{value:new THREE.Vector2()},lfStrength:{value:1},lfOrigin:{value:new THREE.Vector2(...origin)},lfLevel:{value:body.y},lfCell:{value:0.2},lfPolar:{value:0},lfBounds:{value:new THREE.Vector4()}}
}
function patch(mesh,u,simulated){
  const mat=mesh.material,previous=mat.onBeforeCompile,key=mat.customProgramCacheKey,old=mat.userData.lfSpectral
  if(old)return old
  const state={u,restore(){mat.onBeforeCompile=previous;mat.customProgramCacheKey=key;delete mat.userData.lfSpectral;mat.needsUpdate=true}}
  mat.onBeforeCompile=shader=>{
    previous.call(mat,shader);Object.assign(shader.uniforms,u)
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\n${GLSL}\nvarying vec2 lfXZ;`)
    if(!simulated)shader.vertexShader=shader.vertexShader.replace('float rtD =', 'if(lfPolar>0.5)rtW0.xz=clamp(cameraPosition.xz+position.xz,lfBounds.xy,lfBounds.zw);\nfloat rtD =').replace('rtH * (1.0 - smoothstep(120.0, 400.0, rtD))','0.0')
    shader.vertexShader=shader.vertexShader.replace('rtWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',`rtWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      ${simulated?'':'rtWPos=rtW0;'}lfXZ=rtWPos.xz-lfOrigin;
      ${simulated?'':`vec3 lfD=waterDisplacement(lfXZ,log2(max(lfCell,0.02)*N_TEX/uLength.xyz)+1.0);
      vec2 lfQ=lfXZ+lfD.xz;float lfY=lfHeight(lfQ);
      vec3 lfWorld=vec3(lfQ.x+lfOrigin.x,lfLevel+max(lfY,-10.0),lfQ.y+lfOrigin.y);
      transformed=(inverse(modelMatrix)*vec4(lfWorld,1.0)).xyz;rtWPos=lfWorld;lfXZ=lfQ;`}`)
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\n${GLSL}\nvarying vec2 lfXZ;`)
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n${simulated?'':'if(lfHeight(lfXZ)<-999.0)discard;'}`)
    shader.fragmentShader=shader.fragmentShader.replace('diffuseColor = vec4(rtAlb,',`vec4 lfSh=shoreSample(lfXZ);Shore lfSurf=shoreWaves(lfXZ,lfSh,max(lfCell,0.03));
      float lfJac=texture2D(uDisp1,lfXZ/uLength.y).w;
      float lfFoam=clamp(${simulated?'rtSimFoamV':'lfSurf.foam+lfSurf.residual*0.35'}+max(0.0,0.65-lfJac)*rtFoam,0.0,0.9);
      ${simulated?'':`if(lfSh.x>0.0)lfFoam=max(lfFoam,swash(lfXZ,lfSh.x).y);`}
      rtAlb=mix(rtAlb,vec3(0.94,0.98,1.0),lfFoam);
      diffuseColor = vec4(rtAlb,`)
    shader.fragmentShader=shader.fragmentShader.replace('vec3 rtN = normalize(vec3(-rtGg.x, 1.0, -rtGg.z));',`vec3 lfDamp=cascadeDamp(-shoreSample(lfXZ).x);
      vec2 lfSlope=texture2D(uSlope0,lfXZ/uLength.x).xy*lfDamp.x+texture2D(uSlope1,(lfXZ-rtVFlow*rtTime)/uLength.y).xy*lfDamp.y+texture2D(uSlope2,(lfXZ-rtVFlow*rtTime)/uLength.z).xy*lfDamp.z+texture2D(uSlope3,(lfXZ-rtVFlow*rtTime)/uLength.w).xy*0.35;
      lfSlope=lfSlope*lfStrength+shoreWaves(lfXZ,shoreSample(lfXZ),0.03).slope;
      vec3 rtN=normalize(vec3(-lfSlope.x-rtRpg.x,1.0,-lfSlope.y-rtRpg.y));`)
    if(simulated)shader.fragmentShader=shader.fragmentShader.replace('if (true) { rtN', 'if (rtFaceted > 0.5) { rtN')
  }
  mat.customProgramCacheKey=()=>`${key.call(mat)}-ultra-water-${simulated?'flow':'ocean'}`
  mat.userData.lfSpectral=state;mat.needsUpdate=true;return state
}
export class SpectralWater {
  constructor(graph){this.graph=graph;this.renderer=graph.vp.renderer;this.bindings=new Map();this.elapsed=0;this.accumulator=0;this.generation=0}
  reconcile(water){
    this.water=water
    const g=this.graph,desired=new Map()
    for(const b of water?.bodies||[]){
      const node=g.nodes.get(b.id),item=g._physicalWaterView?.items.get(b.coupledRegion)
      const mesh=item?.mesh || (node?.visible?node?.userData.waterMesh:null)
      if(!mesh)continue
      desired.set(b.id,{body:b,mesh,simulated:!!item})
    }
    for(const [id,b]of this.bindings)if(!desired.has(id)||desired.get(id).mesh!==b.mesh || b.polarGeometry && b.mesh.geometry!==b.polarGeometry){this.release(b);this.bindings.delete(id)}
    if(!desired.size)return
    if(!this.sim){
      const p=defaultOceanParams();p.windSpeed=7;p.swellWindSpeed=5;p.waveScale=0.5;p.swellScale=0.5
      this.sim=withRenderer(this.renderer,()=>new OceanSim(this.renderer,p))
    }
    const terrains=g.terrains.filter(t=>t.enabled!==false),terrainSignature=terrains.map(t=>`${t.id}:${t.version}:${t.ox}:${t.oy}:${t.oz}`).join('|')
    for(const [id,d]of desired){
      const b=d.body,signature=JSON.stringify([terrainSignature,b.x,b.y,b.z,b.p.size,b.p.shape])
      let binding=this.bindings.get(id)
      if(binding?.signature!==signature){if(binding)this.release(binding);binding=this.create(d,signature,terrains);this.bindings.set(id,binding)}
      const u=binding.u,p={...b.p,...g.nodes.get(id)?.userData.timelineVisualFields?.props},a=p.windDir*Math.PI/180
      u.lfLevel.value=b.y;u.lfStrength.value=Math.max(0,p.waveHeight)*0.8
      u.uShoreWave.value.set(Math.max(0,p.waveHeight)*0.7,Math.max(2,p.waveLength),Math.max(0,p.waveSpeed),0.85)
      u.uSwellDir.value.set(Math.cos(a),Math.sin(a))
      u.lfCell.value=Math.max(0.07,Math.min(1.5,g.vp.camera.position.distanceTo(new THREE.Vector3(b.x,b.y,b.z))*0.005))
      binding.body=b;binding.waveSpeed=p.waveSpeed
    }
    const wind=[...desired.values()][0].body.p,params=this.sim.params
    const windSpeed=2+12*(wind.wind??0.5)
    if(params.windSpeed!==windSpeed||params.windDirection!==wind.windDir){params.windSpeed=windSpeed;params.windDirection=wind.windDir;params.swellDirection=wind.windDir-15;this.sim.dirty=true}
    if(water)water.spectralAt=(x,z,body)=>this.sample(x,z,body)
  }
  create(d,signature,terrains){
    const b=d.body,extent=terrains.length?Math.max(32,...terrains.map(t=>Math.max(Math.abs((t.ox||0)-b.x),Math.abs((t.oz||0)-b.z))*2+Math.max(t.size,t.depth||t.size)+16)):Math.min(512,b.p.size||64)
    const origin=[b.x,b.z],shore=bakeShoreMap((x,z)=>{const y=this.graph.groundAt(x+b.x,z+b.z);return Number.isFinite(y)?y-b.y:-60},extent,128)
    const u=uniforms(this.sim,shore,b,origin),binding={...d,signature,shore,u,generation:this.generation++,field:null,pending:false}
    if(!d.simulated && b.shape==='ocean'){
      binding.originalGeometry=d.mesh.geometry;binding.polarGeometry=oceanGrid(b.p.size);d.mesh.geometry=binding.polarGeometry
      u.lfPolar.value=1;u.lfBounds.value.set(b.x-b.p.size/2,b.z-b.p.size/2,b.x+b.p.size/2,b.z+b.p.size/2)
    }
    binding.patch=patch(d.mesh,u,d.simulated)
    if(!d.simulated){
      binding.queryTarget=new THREE.WebGLRenderTarget(QUERY_SIZE,QUERY_SIZE,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter})
      binding.queryMat=rawPass(`precision highp float;precision highp int;uniform vec3 cameraPosition;\n${GLSL}\nuniform vec2 lfQueryCenter;uniform float lfQuerySpan;out vec4 outColor;void main(){vec2 p=(gl_FragCoord.xy/${QUERY_SIZE.toFixed(1)}-0.5)*lfQuerySpan+lfQueryCenter;outColor=vec4(lfHeight(p),0.0,0.0,1.0);}`,{...u,cameraPosition:{value:new THREE.Vector3()},lfQueryCenter:{value:new THREE.Vector2()},lfQuerySpan:{value:48}})
      binding.queryQuad=new FullscreenQuad(binding.queryMat)
    }
    return binding
  }
  update(dt){
    if(!this.sim||!this.bindings.size)return false
    const speed=[...this.bindings.values()][0].waveSpeed
    this.elapsed+=Math.max(0,dt)*speed;this.accumulator+=Math.max(0,dt)
    if(this.accumulator<1/24)return true
    const delta=Math.min(this.accumulator,0.15);this.accumulator=0
    withRenderer(this.renderer,()=>{
      this.sim.params.timeScale=speed;this.sim.update(delta)
      for(const b of this.bindings.values()){
        const u=b.u;u.uTime.value=this.elapsed
        for(let i=0;i<3;i++)u[`uDisp${i}`].value=this.sim.displacement[i]
        for(let i=0;i<4;i++)u[`uSlope${i}`].value=this.sim.slope[i]
        if(!b.queryTarget||b.pending)continue
        const camera=this.graph.vp.camera.position,span=Math.max(24,Math.min(96,b.body.p.size||48)),center=[camera.x-b.body.x,camera.z-b.body.z]
        b.queryMat.uniforms.cameraPosition.value.copy(camera);b.queryMat.uniforms.lfQueryCenter.value.set(...center);b.queryMat.uniforms.lfQuerySpan.value=span
        b.queryQuad.render(this.renderer,b.queryTarget);b.pending=true
        const generation=b.generation,data=new Float32Array(QUERY_SIZE*QUERY_SIZE*4)
        this.renderer.readRenderTargetPixelsAsync(b.queryTarget,0,0,QUERY_SIZE,QUERY_SIZE,data).then(()=>{if(b.generation===generation)b.field={data,center,span};b.pending=false}).catch(error=>{b.pending=false;if(b.generation===generation)console.warn('Consulta de olas:',error.message)})
      }
    })
    return true
  }
  sample(x,z,body){
    const b=this.bindings.get(body.id),field=b?.field
    if(!b||b.simulated)return undefined
    if(!field){const ground=this.graph.groundAt(x,z);return Number.isFinite(ground)&&ground>=body.y?null:{...this.water.legacyAt(x,z,0,body.id),surface:body.y}}
    const fx=(x-body.x-field.center[0])/field.span*QUERY_SIZE+QUERY_SIZE/2-0.5,fz=(z-body.z-field.center[1])/field.span*QUERY_SIZE+QUERY_SIZE/2-0.5
    if(fx<0||fz<0||fx>=QUERY_SIZE-1||fz>=QUERY_SIZE-1)return {...this.water.legacyAt(x,z,0,body.id),surface:body.y}
    const i=Math.floor(fx),j=Math.floor(fz),a=fx-i,c=fz-j,read=(di,dj)=>field.data[((j+dj)*QUERY_SIZE+i+di)*4]
    const h=(read(0,0)*(1-a)+read(1,0)*a)*(1-c)+(read(0,1)*(1-a)+read(1,1)*a)*c
    if(h<-999)return null
    return {...this.water.legacyAt(x,z,0,body.id),surface:body.y+h}
  }
  release(b){b.generation=-1;b.patch.restore();for(const t of [b.shore.texture,b.shore.travel,b.shore.surf])t.dispose();b.queryTarget?.dispose();b.queryMat?.dispose();if(b.polarGeometry){if(b.mesh.geometry===b.polarGeometry)b.mesh.geometry=b.originalGeometry;else b.originalGeometry.dispose();b.polarGeometry.dispose()}}
  dispose(){
    for(const b of this.bindings.values())this.release(b);this.bindings.clear()
    if(this.water)this.water.spectralAt=null
    const s=this.sim;if(!s)return
    for(const t of [s.h0RT,s.ping,s.pong,...s.out.flat()])t.dispose()
    for(const m of [s.initMat,s.evolveMat,s.fftMat,s.assembleMat])m.dispose()
    this.sim=null
  }
}
