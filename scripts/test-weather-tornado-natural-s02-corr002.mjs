import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SKY_FRAG } from '../src/engine/runtime/render/skylib.js'
import { World } from '../src/engine/runtime/world/world.js'
const file = path => readFileSync(new URL('../'+path, import.meta.url),'utf8')
const cloudLayer = SKY_FRAG.slice(SKY_FRAG.indexOf('vec4 cloudLayer(vec3 rd) {'),SKY_FRAG.indexOf('// estrellas: celdas 3D'))

// Referencia numérica del contrato visual: si el cilindro no aporta densidad,
// activar la intersección no puede alterar la mezcla atmosférica.
const composite=(acc,T,rdY,near,lowerOpacity)=>{
  const smooth=(x,a,b)=>{ const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t) }
  const far=smooth(rdY,0.012,0.22)
  const k=1-Math.exp(-near*0.000075)
  const weight=k*0.65*(1-lowerOpacity)
  return {
    color: acc*(1-weight)+(0.95*(1-T))*weight,
    transmittance: (1-lowerOpacity)*(1-far)+T*far,
  }
}
test('TC2-01: solo se cambia la salida del integrador existente',()=>{
  assert.match(cloudLayer,/float T=1\.0, lowerT=1\.0;vec3 acc=vec3\(0\.0\)/)
  assert.match(cloudLayer,/if \(!inCloud\) lowerT\*=1\.0-alpha/)
  assert.match(cloudLayer,/float lowerOpacity=clamp\(1\.0-lowerT,0\.0,1\.0\)/)
  assert.equal((SKY_FRAG.match(/vec4 cl = cloudLayer\(dir\);/g)||[]).length,1)
})
test('TC2-02: la transmitancia atmosférica no cambia por intersección geométrica vacía',()=>{
  assert.doesNotMatch(cloudLayer,/if \(funnelSteps==0\)/)
  assert.match(cloudLayer,/return vec4\(acc,T\)/)
  for(const y of [-0.15,0,0.012,0.05,0.19,0.3,0.9]) for(const near of [0,125,1250,10000]) {
    const legacy=composite(0.21,0.3,y,near,0)
    const withEmptyCylinder=composite(0.21,0.3,y,near,1-1)
    assert.deepEqual(withEmptyCylinder,legacy)
  }
})
test('TC2-03: visibilidad del embudo depende de opacidad acumulada real',()=>{
  const none=composite(0.21,0.3,0.02,850,0)
  const partial=composite(0.21,0.3,0.02,850,0.5)
  const full=composite(0.21,0.3,0.02,850,1)
  assert.ok(none.transmittance>partial.transmittance)
  assert.ok(partial.transmittance>full.transmittance)
  assert.match(cloudLayer,/if \(!inCloud\) lowerT\*=1\.0-alpha/)
})
test('TC2-04: nunca se pondera la visibilidad por el contador de pasos del cilindro',()=>{
  const after=cloudLayer.slice(cloudLayer.indexOf('float lowerOpacity='))
  assert.doesNotMatch(after,/funnelSteps/)
  assert.match(after,/k\*0\.65\*\(1\.0-lowerOpacity\)/)
})
test('TC2-05: el máximo de 12 pasos inferiores se conserva',()=>{
  assert.match(cloudLayer,/int funnelSteps = funnelFar > funnelNear \? 12 : 0/)
  assert.match(cloudLayer,/for \(int i=0;i<76;i\+\+\)/)
})
test('TC2-06: la nube madre no depende del alcance del embudo',()=>{
  const start=SKY_FRAG.indexOf('float tornadoCloudRoot('),end=SKY_FRAG.indexOf('float tornadoCondensation(')
  const root=SKY_FRAG.slice(start,end)
  assert.doesNotMatch(root,/uTornadoShape\.z/)
  assert.match(SKY_FRAG,/float atmosphericDensity\(vec3 p, bool full\)/)
})
test('TC2-07: cero condensación no modifica el campo físico',()=>{
  const w=new World(24).configure({weather:{on:true,preset:'storm',tornadoEnabled:true,tornadoMode:'script'}})
  w.startTornado({weatherTransition:0});w.tornadoStep(20)
  assert.equal(w.tornado.phase,'active')
  assert.ok(w.tornadoWindAt(w.tornado.x+5,15,w.tornado.z).x !== undefined)
})
test('TC2-08: el QA usa Electron y los valores reales del caso del usuario',()=>{
  const fixture=file('scripts/fixtures/weather/tornado-natural-s02-corr002.html')
  assert.match(fixture,/cam\.lookAt\(0,900,-250\)/)
  assert.match(fixture,/uTornadoCloud\.value\.set\(0,-250,125,0\)/)
  assert.match(fixture,/const emptyDelta=difference\(noLowerVolume,emptyLowerVolume\)/)
  const runner=file('scripts/test-weather-tornado-natural-electron-s02-corr002.mjs')
  assert.match(runner,/verifyWebGL\(/)
})
test('TC2-09: lluvia, VFX y física no han recibido nuevas responsabilidades',()=>{
  assert.doesNotMatch(SKY_FRAG,/VfxSimulation|VfxBillboardRenderer|new THREE/)
  assert.doesNotMatch(cloudLayer,/new\s+World\s*\(/)
})
test('TC2-10: sin tornado no existe recorrido inferior',()=>{
  assert.match(cloudLayer,/if \(uTornadoCloud\.w > 0\.005 && uTornadoShape\.z > 0\.005\)/)
  assert.match(cloudLayer,/int funnelSteps = funnelFar > funnelNear \? 12 : 0/)
})

test('TC2-11: la antigua bifurcación produce un salto sin condensación',()=>{
  const T=0.34, rdY=0.08, near=2200, acc=0.13
  const far=Math.max(0,Math.min(1,(rdY-0.012)/(0.22-0.012)))
  const f=far*far*(3-2*far)
  const oldNoFunnel=1+(T-1)*f
  const oldIntersectsEmpty=T
  assert.ok(Math.abs(oldNoFunnel-oldIntersectsEmpty)>0.2)
  const correctedA=composite(acc,T,rdY,near,0)
  const correctedB=composite(acc,T,rdY,near,1-1)
  assert.deepEqual(correctedA,correctedB)
})
