// LF-CLOUD-EVOLUTION-S01-G001 · QA del algoritmo continuo y sus contratos de integración.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CloudField, MORPH } from '../src/engine/runtime/world/cloudfield.js'
import { CloudVolume } from '../src/engine/runtime/world/cloud-volume.js'
import { World } from '../src/engine/runtime/world/world.js'
import { normalizeWeather, WEATHER_PARAMS } from '../src/engine/runtime/world/params.js'
import { CLOUD_VOLUME_DENSITY } from '../src/engine/runtime/render/sky-cloud-volume.js'

const src = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const forcing = {coverage: .8, density:.9, humidity:.94, storm:.0, rain:0, altitude:1400}
const storm = {...forcing, coverage:1, density:1, humidity:.98, storm:1, rain:42}
const near = (a,b,tol=.012) => assert.ok(Math.abs(a-b) <= tol, `${a} != ${b}`)
const mk = (s=forcing,seed=1984) => {const f=new CloudField({seed,maxCells:56});f.update(s,[0,0],0);f.prepare(0,0);return f}
const map = () => ({N:32,half:3200,cx:0,cz:0,slabBase:700,slabThick:1400})
const source = x=>({x,y:1400,z:0,rx:850,ry:600,rz:850,str:1.2})
const volume = (m,s) => {const v=new CloudVolume(m);v.rebuild(m,[s]);v.advance(0,{coverage:.8,humidity:.98,storm:.3},[0,0]);return v}

test('S01-01 · el campo es nativo para escenas nuevas y la ruta anterior sigue siendo legible',()=>{
  assert.equal(normalizeWeather({on:true}).cloudModel,'cells')
  assert.equal(normalizeWeather({on:true,cloudModel:'classic'}).cloudModel,'classic')
  assert.equal(new World().configure({weather:{on:true}}).cellsOn,true)
  assert.equal(new World().configure({weather:{on:true,cloudModel:'classic'}}).field,null)
})

test('S01-02 · Inspector controla el tiempo, no exige escoger formas ni parámetros de celdas',()=>{
  const s=src('src/components/ScenePanel.vue');assert.match(s,/weatherAdvanced = WEATHER_PARAMS\.filter/)
  assert.match(s,/!\['cloudModel', 'cloudSeed', 'cloudScale', 'cloudSize', '_hCloud'\]\.includes/)
  assert.ok(WEATHER_PARAMS.some(x=>x.key==='cloudSeed')) // normalizador y datos previos mantienen esquema
})

test('S01-03 · las primitivas conservan topología e identidad al reclasificar',()=>{
  const f=mk(storm),c=f.cells.find(x=>x.active&&x.condensate>.3)
  assert.ok(c);const out=[];const n=f.primitives(c,out)
  const original=out.slice(0,n).map(x=>({...x}));assert.equal(n,6)
  c.prevMorph=MORPH.STRATUS;c.morph=MORPH.CUMULONIMBUS;c.blend=0.32
  assert.equal(f.primitives(c,out),n)
  for(let k=0;k<n;k++)for(const key of ['x','y','z','rx','ry','rz','str','type'])near(out[k][key],original[k][key],1e-9)
})

test('S01-04 · estructuras convectivas y estratiformes generan densidades distintas sin otro buffer',()=>{
  const f=mk(storm),c=f.cells.find(x=>x.active&&x.condensate>.5),out=[]
  const make=(cv,sheet,wispy)=>{
    c.convective=cv;c.sheet=sheet;c.wispy=wispy
    const n=f.primitives(c,out), m=map(),sources=out.slice(0,n).map(x=>({x:c.x+x.x,y:1400+x.y,z:c.z+x.z,rx:x.rx,ry:x.ry,rz:x.rz,str:x.str}))
    // Shift sources to the same local domain as the comparison volume.
    for(const p of sources){p.x-=c.x;p.z-=c.z}
    const v=new CloudVolume(m);v.rebuild(m,sources);v.advance(0,{coverage:.9,humidity:.98,storm:cv},[0,0]);return {data:Uint8Array.from(v.data),ends:out.slice(0,n).map(x=>x.y)}
  }
  const a=make(.03,.9,.08),b=make(.94,.08,.01)
  assert.equal(a.data.length,b.data.length)
  assert.ok(a.data.some((x,i)=>x!==b.data[i]),'La estructura no cambia el condensado 3D')
  assert.ok(b.ends.at(-1)>a.ends.at(-1)+c.thick*.35)
})

test('S01-05 · claves y posiciones estables bajo un mismo estado',()=>{
  const a=mk(storm,773),b=mk(storm,773)
  const ca=a.cells.filter(x=>x.active).map(x=>[x.key,x.x,x.z,x.convective,x.sheet])
  const cb=b.cells.filter(x=>x.active).map(x=>[x.key,x.x,x.z,x.convective,x.sheet])
  assert.deepEqual(ca,cb)
})

test('S01-06 · transición gradual conserva posición y cambia estructura de la misma celda',()=>{
  const f=mk(forcing,773),c=f.cells.find(x=>x.active&&x.condensate>.1)
  assert.ok(c);const key=c.key,base=c.thick
  for(let i=0;i<32;i++)f.update(storm,[0,0],.125)
  f.prepare(0,0)
  const after=f.cells.find(x=>x.active&&x.key===key)
  assert.ok(after&&Number.isFinite(after.thick)&&after.thick>0)
  assert.ok(Math.abs(after.thick-base)<f.layer*10, 'Salto de volumen implausible')
})

test('S01-07 · recentrado cercano conserva núcleo, remoto reconstruye condensado inmediatamente',()=>{
  const m=map(),v=volume(m,source(0)),start=v.sample(0,1400,0)
  assert.ok(start>.6);m.cx+=v.spacing;v.rebuild(m,[source(0)]);v.advance(0,{coverage:.8,humidity:.98,storm:.3},[0,0])
  assert.ok(v.sample(0,1400,0)>.5)
  m.cx=20000;v.rebuild(m,[source(20000)]);v.advance(0,{coverage:.8,humidity:.98,storm:.3},[0,0])
  assert.ok(v.sample(20000,1400,0)>.5, 'Destino recién cargado no puede aparecer vacío')
})

test('S01-08 · el mapa GPU conserva RG8 y una textura 3D con dos estados',()=>{
  const m=map(),v=volume(m,source(0))
  assert.equal(v.data.length,v.N*v.N*v.depth*2)
  assert.match(CLOUD_VOLUME_DENSITY,/texture\(uCVolume, vec3\(uv, h\)\)\.rg/)
  assert.doesNotMatch(CLOUD_VOLUME_DENSITY,/uTime \* 0\.0006/)
})

test('S01-09 · guardado meteorológico restaura una transición activa',()=>{
  const env={weather:{on:true,cloudSeed:127,preset:'partly',director:false}}
  const a=new World().configure(env),b=new World().configure(env)
  assert.equal(a.setWeather('storm',1,20),true);a.update(5)
  const weather=a.captureWeatherEvolution()
  b.setWeather('storm',1,0);b.restoreWeatherEvolution(weather)
  near(b.cur.coverage,a.cur.coverage,1e-9);near(b._fade.t,a._fade.t,1e-9)
  a.update(1);b.update(1)
  near(b.cur.coverage,a.cur.coverage,1e-9);near(b._fade.t,a._fade.t,1e-9)
})

test('S01-10 · estados meteorológicos inválidos no contaminan World',()=>{
  const w=new World().configure({weather:{on:true}}),before=w.captureWeatherEvolution()
  assert.throws(()=>w.restoreWeatherEvolution({...before,fade:{from:{},to:{},t:1,dur:3}}))
  assert.deepEqual(w.captureWeatherEvolution(),before)
})

test('S01-11 · guardado Player conecta Weather y condensado',()=>{
  const s=src('src/engine/runtime/events/play-saves.js')
  assert.match(s,/weatherEvolution: w\.captureWeatherEvolution\(\)/)
  assert.match(s,/world\.restoreWeatherEvolution\(w\.weatherEvolution\)/)
  assert.match(s,/forcing: \{ \.\.\.w\.field\.f \}/)
})

test('S01-12 · Edit Mode congela World y cielo, otras previsualizaciones siguen activas',()=>{
  const a=src('src/engine/runtime/scene-graph.js'),b=src('src/engine/runtime/render/viewport.js')
  assert.doesNotMatch(a,/this\.world\.update\(dt, \{ clock: false \}\)/)
  assert.match(a,/field\.maintain\(c\.x, c\.z, 0\)/)
  assert.match(b,/uTime\.value = this\.playing \?/)
  assert.match(b,/this\._wf\?\.clouds\?\.evolution/)
  assert.match(b,/const live = this\.playing \|\| this\.liveFx/)
  assert.match(b,/this\.precip\.update\(live \?/)
})

test('S01-13 · aceleración del Director mantiene mismo reloj para clima y nube',()=>{
  const make=scale=>new World().configure({weather:{on:true,preset:'partly',cloudSeed:11,director:true,directorSeed:72,weatherScale:scale}})
  const fast=make(4),slow=make(1)
  fast.setWeather('storm',1,20);slow.setWeather('storm',1,20)
  fast.update(.25);slow.update(.25)
  near(fast.field.evolution,1);near(slow.field.evolution,.25)
  near(fast._fade.t,1);near(slow._fade.t,.25)
})

test('S01-14 · nube madre y consultas públicas no se duplican',()=>{
  const w=new World().configure({weather:{on:true,preset:'storm',cloudSeed:79,tornadoEnabled:true}})
  assert.ok(w.field);w.update(.5)
  assert.ok(Number.isFinite(w.precipitationAt(0,0)))
  assert.ok(w.startTornado());assert.strictEqual(w.field.tornado,w.tornado)
  assert.equal(typeof w.windAt3D(0,0,0).x,'number')
})
