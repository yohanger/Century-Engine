// LF-LIQUID-RAIN-AUDIO-S08-G001: audio por superficie sin DOM ni hardware acústico.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeRainAudio, normalizeRainProfiles } from '../src/engine/runtime/world/rain-audio-profile.js'
import { normalizeWeather } from '../src/engine/runtime/world/params.js'
import { normalizeMaterial } from '../src/engine/runtime/render/material-resource.js'
import { traceRainSegment } from '../src/engine/runtime/world/rain-impact.js'
import { WeatherAudio } from '../src/engine/runtime/world/sound.js'

const src = (n) => readFileSync(new URL('../' + n, import.meta.url),'utf8')
const pause = () => new Promise((r) => setImmediate(r))
const rainCfg = (props = {}) => normalizeWeather({ on:true, rainImpacts:true,
  rainImpactProfiles:[{ enabled:true, surface:'metal', clip1:'metal-1.wav', clip2:'metal-2.wav', volume:0.8, pitch:0.08, maxRate:5 },
    { enabled:true, surface:'stone', clip1:'stone.wav', maxRate:5 },
    { enabled:true, surface:'water', clip1:'splash.wav', maxRate:5 },
    { enabled:true, surface:'grass', clip1:'leaf.wav', maxRate:5 }], ...props })
function fixture({ weather = rainCfg(), rain=1, allow=true, scene = {} } = {}) {
  let completes=[]; const calls=[]
  const engine = { ctx:{currentTime:0}, play: async (id,options) => {
    const voice = {opts:options, stopped:false, stop() { this.stopped=true }, done: new Promise((r)=>completes.push(r))}
    calls.push({id,options,voice})
    return voice
  }}
  const audio = {engine, resolveClip: (clip)=> allow && clip && !String(clip).includes('missing') ? clip : null}
  const world = {cfg:{weather},weatherOn:true,rainLevel:rain,frame:()=>({wind:{speed:0}})}
  const cam = {matrixWorld:{elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}}
  const sound = new WeatherAudio({world,audio,camera:()=>cam,scene,probe:()=>0.8})
  sound._rainTokens=8
  return {sound,world,engine,calls,end(){ completes.forEach((fn)=>fn());completes=[] }}
}
const hit=(surface='metal',extra={})=>({point:[2,0,1],normal:[0,1,0],surface,...extra})
test('RA-01: perfil ausente conserva impactos desactivados',()=>{
  assert.equal(normalizeWeather({}).rainImpacts,false)
  assert.deepEqual(normalizeWeather({}).rainImpactProfiles,[])
  assert.equal(normalizeRainAudio().enabled,false)
})
test('RA-02: normalización conserva varias referencias de Assets',()=>{
  const a=normalizeRainAudio({enabled:true,clips:['a.wav','b.wav'],volume:10,pitch:3,maxRate:50})
  assert.deepEqual(a.clips,['a.wav','b.wav']);assert.equal(a.volume,2);assert.equal(a.pitch,0.3);assert.equal(a.maxRate,15)
})
test('RA-03: perfiles por superficie se serializan sin perder controles del formulario',()=>{
  const a=rainCfg();const b=normalizeWeather(a)
  assert.deepEqual(a.rainImpactProfiles,b.rainImpactProfiles)
  assert.equal(b.rainImpactProfiles[0].clip1,'metal-1.wav');assert.equal(b.rainImpactProfiles[0].clip2,'metal-2.wav')
})
test('RA-04: actualizar clip2 en perfil normalizado no se pierde por caché de clips',()=>{
  const a=rainCfg();a.rainImpactProfiles[0].clip2='otro.wav'
  assert.equal(normalizeWeather(a).rainImpactProfiles[0].clip2,'otro.wav')
})
test('RA-05: perfiles repetidos o categorías desconocidas se descartan',()=>{
  assert.deepEqual(normalizeRainProfiles([{surface:'stone',enabled:true},{surface:'stone'},{surface:'unknown'}]).map((r)=>r.surface),['stone'])
})
test('RA-06: material .material guarda un perfil sin alterar render físico',()=>{
  const m=normalizeMaterial({mat:{shader:'builtin:realista',rainAudio:{enabled:true,surface:'metal',clips:['tapa.wav']},runoff:{enabled:true}}})
  assert.equal(m.mat.shader,'builtin:realista');assert.equal(m.mat.rainAudio.clips[0],'tapa.wav');assert.equal(m.mat.runoff.enabled,true)
})
test('RA-07: impacto contra malla conserva owner, material y perfil acústico',()=>{
  const r=traceRainSegment([0,3,0],[0,0,0],()=>0,
    ()=>({point:[0,2,0],normal:[0,1,0],ownerId:'roof',materialId:'steel',surface:'metal',rainAudio:{enabled:true,clips:['z.wav']}}))
  assert.equal(r.ownerId,'roof');assert.equal(r.materialId,'steel');assert.equal(r.surface,'metal');assert.equal(r.rainAudio.clips[0],'z.wav')
})
test('RA-08: raycast legado conserva exactamente punto y normal',()=>{
  const r=traceRainSegment([0,2,0],[0,0,0],()=>0,()=>({point:[0,1,0],normal:[0,1,0]}))
  assert.deepEqual(r,{point:[0,1,0],normal:[0,1,0]})
})
test('RA-09: audio desactivado o sin lluvia no reproduce impactos',()=>{
  const a=fixture({weather:rainCfg({rainImpacts:false})});assert.equal(a.sound.impact(hit()),false)
  const b=fixture({rain:0});assert.equal(b.sound.impact(hit()),false)
  assert.equal(a.calls.length+b.calls.length,0)
})
test('RA-10: material metal selecciona clip de zinc con voz 3D y oclusión',async()=>{
  const a=fixture();assert.equal(a.sound.impact(hit()),true);await pause()
  assert.equal(a.calls.length,1)
  assert.match(a.calls[0].id,/metal-[12]/)
  assert.equal(a.calls[0].options.mode,'3d');assert.equal(a.calls[0].options.occlusion,true)
  assert.equal(a.calls[0].options.group,'sfx'); assert.deepEqual(a.calls[0].options.position,[2,0,1])
  a.end();await pause()
})
test('RA-11: perfil local del material tiene prioridad sobre perfil general',async()=>{
  const a=fixture();assert.equal(a.sound.impact(hit('metal',{rainAudio:{enabled:true,clips:['local.wav'],maxRate:12}})),true)
  await pause();assert.equal(a.calls[0].id,'local.wav');a.end()
})
test('RA-12: piedra, vegetación y agua toman sus perfiles específicos',async()=>{
  for (const [type,clip] of [['stone','stone.wav'],['grass','leaf.wav'],['water','splash.wav']]) {
    const a=fixture();assert.equal(a.sound.impact(hit(type)),true);await pause();assert.equal(a.calls[0].id,clip);a.end()
  }
})
test('RA-13: sin clip, referencia perdida o perfil no habilitado => silencio',async()=>{
  const a=fixture({allow:false});assert.equal(a.sound.impact(hit()),false)
  const b=fixture({weather:rainCfg({rainImpactProfiles:[{surface:'metal',enabled:true,clip1:'missing.wav'}]})})
  assert.equal(b.sound.impact(hit()),false)
  const c=fixture({weather:rainCfg({rainImpactProfiles:[{surface:'metal',enabled:false,clip1:'metal.wav'}]})})
  assert.equal(c.sound.impact(hit()),false)
  await pause();assert.equal(a.calls.length+b.calls.length+c.calls.length,0)
})
test('RA-14: material habilitado sin clips no inventa fallback al perfil global',()=>{
  const a=fixture();assert.equal(a.sound.impact(hit('metal',{rainAudio:{enabled:true,clips:[]}})),false)
})
test('RA-15: limita tasa por perfil y presupuesto global',async()=>{
  const a=fixture();assert.equal(a.sound.impact(hit()),true)
  assert.equal(a.sound.impact(hit()),false)
  a.sound._rainClock+=1
  assert.equal(a.sound.impact(hit()),true)
  a.sound._rainClock+=1
  assert.equal(a.sound.impact(hit()),true)
  a.sound._rainClock+=1
  assert.equal(a.sound.impact(hit()),true)
  a.sound._rainClock+=1
  assert.equal(a.sound.impact(hit()),false)
  await pause();assert.equal(a.calls.length,4);a.end()
})
test('RA-16: posición lejana o inválida no provoca voz',()=>{
  const a=fixture();assert.equal(a.sound.impact(hit('metal',{point:[40,0,0]})),false)
  assert.equal(a.sound.impact(hit('metal',{point:[NaN,0,0]})),false)
})
test('RA-17: fin de Play detiene voces, limpia perfiles y bloquea voces tardías',async()=>{
  const a=fixture();assert.equal(a.sound.impact(hit()),true);await pause();a.sound.stop()
  assert.equal(a.calls[0].voice.stopped,true);assert.equal(a.sound.impact(hit()),false);a.end()
})
test('RA-18: deshabilitar WeatherAudio o mutear detiene futuros impactos',()=>{
  const a=fixture();a.sound.mute();assert.equal(a.sound.impact(hit()),false)
  a.sound.mute(false);a.world.weatherOn=false;assert.equal(a.sound.impact(hit()),false)
})
test('RA-19: oclusión funciona incluso con trueno de clips',()=>{
  const a=fixture();a.sound._updateOcclusion(0.3);assert.equal(a.sound.occTarget,0.8)
  a.sound._updateOcclusion(0.3);assert.ok(a.sound.occ>0)
})
test('RA-20: Terrain resuelve capa pintada antes del perfil de sonido',async()=>{
  const t={groundAt:()=>0,paintAt:()=>0,layers:[{surface:'grass',name:'Hierba'}]}
  const a=fixture({scene:{terrains:[t]}});assert.equal(a.sound.impact(hit('')),true);await pause();assert.equal(a.calls[0].id,'leaf.wav');a.end()
})
test('RA-21: agua visible tiene prioridad acústica sobre Terrain',async()=>{
  const t={groundAt:()=>0,paintAt:()=>0,layers:[{surface:'grass',name:'Hierba'}]}
  const a=fixture({scene:{terrains:[t],_activeWaterWorld:{at:()=>({surface:0})}}})
  assert.equal(a.sound.impact(hit('')),true);await pause();assert.equal(a.calls[0].id,'splash.wav');a.end()
})
test('RA-22: no modifica volumen de WaterWorld ni llama a ninguna API de fuentes físicas',()=>{
  const rain=src('src/engine/runtime/world/sound.js')
  assert.doesNotMatch(rain,/\.changeVolume\(|\.rainOnRunoff\(|\.transfer\(/)
  assert.match(src('src/engine/runtime/scene/water.js'),/this\._rainAudioImpact\?\.\(hit\)/)
  assert.match(src('src/engine/runtime/events/play.js'),/this\.ed\._rainAudioImpact = null/)
})
test('RA-23: Scene Audio mantiene motor y oclusión de voces existente',()=>{
  const a=src('src/engine/runtime/world/sound.js')
  assert.match(a,/this\.engine\.play\(clip\.id, \{ mode: '3d'/)
  assert.match(src('src/engine/runtime/audio/scene.js'),/v\.occlusionFilter && v\.isPlaying/)
})
test('RA-24: el Inspector del material usa slots tipados y los sonidos de Assets',()=>{
  const m=src('src/components/MaterialSection.vue')
  assert.match(m,/data-testid="rain-acoustic-profile"/);assert.match(m,/<ResourceDropSlot :kinds="\['audio','file'\]"/)
  assert.match(m,/@click="previewRainClip\(clip\)"/)
})
test('RA-25: autoría de escena soporta hasta cuatro clips por superficie',()=>{
  const p=src('src/engine/runtime/world/params.js')
  assert.match(p,/rainImpactProfiles.*type: 'list'/)
  assert.match(p,/key: 'clip4'.*type: 'audio'/)
})
