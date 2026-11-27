// QA de perfil meteorológico, nacimiento VFX real y ensamblado transitorio sin Three/WebGL.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { World } from '../src/engine/runtime/world/world.js'
import { tornadoVisualState, tornadoFunnelRadius } from '../src/engine/runtime/world/tornado-visual.js'
import { newVfxResource, validateVfxResource } from '../src/engine/runtime/vfx/resource.js'
import { VfxSimulation } from '../src/engine/runtime/vfx/simulation.js'

const cfg={on:true,preset:'storm',tornadoEnabled:true,tornadoMode:'script',
  tornadoDevelopmentSeconds:1,tornadoOrganizationSeconds:1,tornadoFormationSeconds:2,
  tornadoWeakeningSeconds:1,tornadoDissipationSeconds:1,tornadoDuration:3}
const world=()=>{const w=new World(17);w.configure({weather:cfg});return w}
const durations={development:1,organization:1,formation:2,weakening:1,dissipation:1}
const view=(t,cloud=900)=>tornadoVisualState(t,cloud,durations)

// Únicamente dobles de la API gráfica para probar el montaje: la simulación y el World son reales.
class Group {
  constructor(){this.children=[];this.position={set:(x,y,z)=>{this.xyz=[x,y,z]}};this.matrixWorld={elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}}
  add(child){this.children.push(child);child.parent=this}
  remove(child){this.children=this.children.filter(x=>x!==child);child.parent=null}
  removeFromParent(){this.parent?.remove(this)}
  updateWorldMatrix(){}
}
class FakeRenderer {
  constructor(sim,{texture}={}){this.simulation=sim;this.texture=texture;this.mesh={matrixAutoUpdate:true,matrix:{copy(){return this},invert(){return this}},parent:null};this.disposed=false}
  sync(){this.drawCount=this.simulation.count}
  dispose(){this.disposed=true;this.mesh.parent?.remove(this.mesh)}
}
const source=readFileSync(new URL('../src/engine/runtime/nodes/vfx.js',import.meta.url),'utf8')
  .replace(/^import .*\n/gm,'')
  .replace(/^export default vfxDef\s*$/gm,'')
  .replace(/^export function createWeatherVfx3D/gm,'function createWeatherVfx3D')
class FakeDataTexture {
  constructor(bytes,width,height,format){this.image={data:bytes,width,height};this.format=format;this.disposeCount=0}
  dispose(){this.disposeCount++}
}
const context={THREE:{Group,DataTexture:FakeDataTexture,RGBAFormat:1023,SRGBColorSpace:'srgb',LinearFilter:1006},registerNode:()=>null,newVfxResource,validateVfxResource,
  VfxSimulation,VfxBillboardRenderer:FakeRenderer,tornadoVisualState,tornadoFunnelRadius}
vm.runInNewContext(source,context)
const makeFx=(w)=>{
  const scene={vp:{scene:new Group(),camera:{},calls:0,requestRender(){this.calls++}}}
  return {scene,fx:context.createWeatherVfx3D(scene,w.tornado)}
}

test('TV-01: World sin tornado no genera perfil visual',()=>{
  assert.equal(view(null).opacity,0)
  const w=new World(2);w.configure({weather:{on:true,preset:'storm'}})
  assert.equal(w.tornado,null)
})
test('TV-02: desarrollo y organización tienen circulación en base nubosa, sin contacto',()=>{
  const w=world();w.startTornado({weatherTransition:0});w.tornadoStep(0.7)
  const a=view(w.tornado);assert.equal(a.phase,'development');assert.ok(a.opacity>0 && a.opacity<0.16)
  assert.ok(a.reach<0.1);assert.equal(a.ground,false)
  w.tornadoStep(0.9);const b=view(w.tornado)
  assert.equal(b.phase,'organization');assert.ok(b.reach>a.reach)
  assert.equal(w.tornado.active,false)
})
test('TV-03: formación desciende en continuidad y no crea viento previo',()=>{
  const w=world();w.startTornado({weatherTransition:0});w.tornadoStep(2.1)
  const a=view(w.tornado);w.tornadoStep(1.5);const b=view(w.tornado)
  assert.equal(a.phase,'formation');assert.ok(b.reach>a.reach);assert.ok(b.opacity>a.opacity)
  assert.ok(b.reach<1);assert.equal(a.ground,false)
})
test('TV-04: perfil vinculado a nubes sin modificar altura física',()=>{
  const w=world();w.startTornado({weatherTransition:0});w.tornadoStep(4.1)
  const physical=w.tornado.height,v=view(w.tornado,w.cur.altitude)
  assert.equal(v.height,900);assert.equal(w.tornado.height,physical)
  assert.ok(tornadoFunnelRadius(v,1)>tornadoFunnelRadius(v,0))
})
test('TV-05: debilitamiento y disipación sin desaparición brusca',()=>{
  const w=world();w.startTornado({weatherTransition:0});w.tornadoStep(7)
  const a=view(w.tornado);w.tornadoStep(0.5);const b=view(w.tornado)
  assert.equal(b.phase,'weakening');assert.ok(b.rope<a.rope)
  w.tornadoStep(0.6);const c=view(w.tornado)
  assert.equal(c.phase,'dissipation');assert.ok(c.opacity>0 && c.opacity<b.opacity)
  w.tornadoStep(1);assert.equal(view(w.tornado).opacity,0)
})
test('TV-06: la condensación nace de la base de la nube, no de un VFX',()=>{
 const sky=readFileSync(new URL('../src/engine/runtime/render/skylib.js',import.meta.url),'utf8')
 assert.match(sky,/bottomY = mix\(topY, uTornadoShape\.x/)
 assert.match(sky,/texture\(uShape, q \* 2\.0/)
 assert.doesNotMatch(source,/createWeatherVfx3D/)
})
test('TV-07: mismo World conserva perfil reproducible sin simulación VFX',()=>{
 const a=world(),b=world();a.startTornado({weatherTransition:0});b.startTornado({weatherTransition:0})
 a.tornadoStep(3.6);b.tornadoStep(3.6)
 assert.deepEqual(view(a.tornado),view(b.tornado))
})
test('TV-08: la extensión genérica de nacimiento no persiste en .vfx',()=>{
  const r=newVfxResource('a','Prueba.vfx'),s=new VfxSimulation(r)
  s.spawnAt=(p,k)=>{p[k]=50;p[k+1]=100;p[k+2]=150}
  for(let i=0;i<40;i++)s.step()
  assert.ok(s.count>0);assert.ok(s.position[0]>49 && s.position[0]<51)
  assert.equal(JSON.stringify(s.resource).includes('tornado'),false)
  assert.equal(Object.hasOwn(r,'spawnAt'),false)
})
test('TV-09: shader distingue la ruta sin mapa y conserva texturas compartidas',()=>{
  const src=readFileSync(new URL('../src/engine/runtime/vfx/render.js',import.meta.url),'utf8')
  assert.match(src,/#ifdef VFX_HAS_MAP/)
  assert.match(src,/material\.needsUpdate = true/)
  assert.doesNotMatch(src,/uHasMap \? texture2D/)
  assert.match(src,/visualOpacity/)
})
test('TV-10: el tornado usa el shader atmosférico, sin gestor ni Assets nuevos',()=>{
 const sky=readFileSync(new URL('../src/engine/runtime/render/skylib.js',import.meta.url),'utf8')
 assert.match(sky,/vec4 cl = cloudLayer\(dir\)/)
 assert.doesNotMatch(sky,/tornadoCloudVolume\(dir\)/)
 assert.doesNotMatch(source,/new VfxSimulation\(resource,\{seed:17\}\)|project\.vfx\.push\(/)
})
test('TV-11: episodios nuevos no dejan pool meteorológico VFX',()=>{
 const src=readFileSync(new URL('../src/engine/runtime/events/play-tornado.js',import.meta.url),'utf8')
 assert.doesNotMatch(src,/_tornadoWeatherVfx|\.simulation\.reset\(\)/)
 assert.match(src,/_tornadoEnded=false/)
})
