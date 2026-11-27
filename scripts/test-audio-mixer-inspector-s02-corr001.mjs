// LF-AUDIO-MIXER-INSPECTOR-S02-G001_CORR-001 — expansión en línea sin segunda vista.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const read = p => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')
const component = read('components/AudioMixerInspector.vue')
const mixer = read('components/AudioMixer.vue')
const storeSrc = read('core/state/audio.js')
const config = read('engine/runtime/audio/config.js')
const script = component.split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
const template = component.split('<template>')[1].split('</template>')[0]

function harness(){
  const eq={id:'eq',type:'eq3',on:true,low:0,mid:0,high:0,lowFreq:250,highFreq:4000}
  const echo={id:'echo',type:'echo',on:true,time:0.35,feedback:0.4,mix:0.3}
  const rev={id:'rev',type:'reverb',on:true,time:1.6,damping:0.4,mix:0.3}
  const group={id:'master',name:'Master',color:'#5b9bd5',volume:0,parent:null,mute:false,solo:false,bypass:false,fx:[eq,echo,rev]}
  const music={id:'music',name:'Música',color:'#b07fd6',volume:0,parent:'master',mute:false,solo:false,bypass:false,fx:[]}
  const events=[], store={project:{audio:{groups:[group,music],snapshots:[]}},audioInspector:{groupId:'master',effectId:null},selectedId:null,selectedIds:[],sceneSel:false,terrainSel:false,projSel:null,prefs:{rightTab:'object',rightOpen:true},ui:{mode:'desktop'},editor:{setSelection(){}}}
  const watches=[]
  const computed=fn=>({get value(){return fn()}})
  const ref=value=>({value})
  const watch=(fn,cb,options={})=>{
    const w={fn,cb,last:fn()};watches.push(w)
    if (options.immediate)cb(w.last,undefined)
  }
  function flush(){for(const w of watches){const next=w.fn();if(next!==w.last){const prev=w.last;w.last=next;w.cb(next,prev)}}}
  const FX_TYPES={eq3:{label:'Ecualizador (3 bandas)',params:[{k:'low',label:'Graves',unit:'dB',step:0.5}]},echo:{label:'Eco',params:[{k:'time',label:'Retardo',unit:'s',step:0.01}]},reverb:{label:'Reverb',params:[{k:'mix',label:'Mezcla',unit:'%',step:0.01}]}}
  const REVERB_PRESETS={sala:{time:2,damping:0.55,mix:0.6,label:'Sala'}}
  const context=vm.createContext({store,computed,ref,watch,FX_TYPES,REVERB_PRESETS,BASE_IDS:['master','music'],descendants:()=>[],markDirty(){events.push('dirty')},toast(){},uid:()=>`f-${group.fx.length}`})
  const stateFunctions=storeSrc.replace(/^import .*$/gm,'').replace(/^export /gm,'')
  vm.runInContext(stateFunctions+'\nglobalThis.audio={selectAudioInspector,audioInspectorTarget,updateAudioFx,updateAudioGroup,removeAudioFx,moveAudioFx}',context)
  Object.assign(context,context.audio)
  context.addAudioFx=async(groupId,type)=>{const id=`add-${group.fx.length}`;store.project.audio.groups.find(g=>g.id===groupId).fx.push({id,type,on:true,time:0.4});events.push('add');return id}
  context.setGroupParent=async()=>{}
  vm.runInContext(script+'\nglobalThis.panel={expanded,isExpanded,toggleEffect,addEffect,removeEffect,preset,group,target,fmt}',context)
  return {store,master:group,music,eq,echo,rev,events,flush,...context.panel,selectAudioInspector:context.selectAudioInspector,updateAudioFx:context.updateAudioFx,moveAudioFx:context.moveAudioFx}
}
test('AMIC-01: grupo y cadena visibles siempre; no existe vista exclusiva de efecto',()=>{
 assert.match(template,/Cadena de efectos \(\{\{ group\.fx\.length \}\}\)/)
 assert.match(template,/{{ group\.name }}/)
 assert.doesNotMatch(template,/<template v-if="effect">|<template v-else>|class="back"/)
})
test('AMIC-02: cada efecto tiene un control expandible accesible en línea',()=>{
 assert.match(template,/v-for="\(f, index\) in group\.fx"/)
 assert.match(template,/:aria-expanded="isExpanded\(f\.id\)"/)
 assert.match(template,/:aria-controls="'fx-controls-'\+f\.id"/)
 assert.match(template,/v-if="isExpanded\(f\.id\)"/)
})
test('AMIC-03: abrir/cerrar un efecto sin modificar datos persistidos',()=>{
 const h=harness();const original=JSON.stringify(h.store.project.audio)
 assert.equal(h.isExpanded('eq'),false)
 h.toggleEffect('eq');assert.equal(h.isExpanded('eq'),true)
 h.toggleEffect('eq');assert.equal(h.isExpanded('eq'),false)
 assert.equal(JSON.stringify(h.store.project.audio),original)
})
test('AMIC-04: dos efectos pueden permanecer abiertos simultáneamente',()=>{
 const h=harness();h.toggleEffect('eq');h.toggleEffect('echo')
 assert.equal(h.isExpanded('eq'),true);assert.equal(h.isExpanded('echo'),true)
 h.toggleEffect('eq');assert.equal(h.isExpanded('echo'),true)
})
test('AMIC-05: la selección de un efecto desde Mixer abre sus controles sin otra vista',()=>{
 const h=harness();h.selectAudioInspector('master','echo');h.flush()
 assert.equal(h.isExpanded('echo'),true);assert.equal(h.master.name,'Master')
 assert.equal(h.target.value?.group,h.master)
})
test('AMIC-06: cambiar de grupo cierra las expansiones del grupo anterior',()=>{
 const h=harness();h.toggleEffect('eq');h.selectAudioInspector('music');h.flush()
 assert.equal(h.isExpanded('eq'),false);assert.equal(h.group.value.id,'music')
})
test('AMIC-07: efecto seleccionado en grupo nuevo se abre tras limpiar expansiones anteriores',()=>{
 const h=harness();h.music.fx.push({id:'music-fx',type:'echo',on:true})
 h.toggleEffect('eq');h.selectAudioInspector('music','music-fx');h.flush()
 assert.equal(h.isExpanded('eq'),false);assert.equal(h.isExpanded('music-fx'),true)
})
test('AMIC-08: la selección conserva activación independiente de cada efecto',()=>{
 const h=harness();h.updateAudioFx('master','echo',{on:false})
 assert.equal(h.echo.on,false);assert.equal(h.eq.on,true);assert.equal(h.isExpanded('echo'),false)
})
test('AMIC-09: parámetros editables actualizan la identidad real en project.audio',()=>{
 const h=harness();h.updateAudioFx('master','eq',{low:7});h.updateAudioFx('master','echo',{time:0.7})
 assert.equal(h.eq.low,7);assert.equal(h.echo.time,0.7);assert.ok(h.events.includes('dirty'))
 assert.match(template,/updateAudioFx\(group\.id,f\.id,\{\[param\.k\]:\+\$event\.target\.value\}\)/)
})
test('AMIC-10: preset Reverb se aplica al efecto solicitado, no al seleccionado',()=>{
 const h=harness();h.selectAudioInspector('master','echo');h.flush();h.preset('rev','sala')
 assert.equal(h.rev.time,2);assert.equal(h.rev.damping,0.55);assert.equal(h.rev.mix,0.6)
 assert.equal(h.echo.time,0.35)
})
test('AMIC-11: aplicar preset a efecto distinto de Reverb no modifica parámetros',()=>{
 const h=harness();h.preset('echo','sala');assert.equal(h.echo.time,0.35)
})
test('AMIC-12: subir y bajar reordena FX sin perder IDs ni estado desplegado',()=>{
 const h=harness();h.toggleEffect('echo');h.moveAudioFx('master','echo',-1)
 assert.deepEqual(Array.from(h.master.fx,f=>f.id),['echo','eq','rev']);assert.equal(h.isExpanded('echo'),true)
})
test('AMIC-13: eliminar un efecto descarta su expansión y limpia selección de FX',()=>{
 const h=harness();h.toggleEffect('echo');h.selectAudioInspector('master','echo');h.flush();h.removeEffect('echo')
 assert.equal(h.master.fx.some(f=>f.id==='echo'),false);assert.equal(h.isExpanded('echo'),false)
 assert.equal(h.store.audioInspector.effectId,null)
})
test('AMIC-14: añadir efecto abre sus controles sin reemplazar grupo',async()=>{
 const h=harness();await h.addEffect('echo');h.flush()
 const f=h.master.fx.at(-1)
 assert.equal(f.id,'add-3');assert.equal(h.isExpanded(f.id),true)
 assert.equal(h.master.name,'Master')
})
test('AMIC-15: controles FX reúnen toggle, reordenar, eliminar, parámetros y presets',()=>{
 for(const fragment of ['Activar ', 'Subir efecto','Bajar efecto','Eliminar efecto','FX_TYPES[f.type]?.params','REVERB_PRESETS','preset(f.id,key)'])assert.ok(template.includes(fragment),fragment)
})
test('AMIC-16: no se crea otra fuente de efectos ni se altera FilmMaker',()=>{
 assert.match(mixer,/selectAudioInspector\(g\.id, f\?\.id \|\| null\)/)
 assert.match(read('filmmaker/FilmApp.vue'),/import Inspector from '\.\.\/components\/Inspector\.vue'/)
 assert.doesNotMatch(component,/project\.audio\s*=|newFx\(|normalizeAudio\(/)
})

test('AMIC-17: seleccionar de nuevo el mismo efecto desde Mixer vuelve a expandirlo',()=>{
 const h=harness();h.selectAudioInspector('master','echo');h.flush()
 h.toggleEffect('echo');assert.equal(h.isExpanded('echo'),false)
 h.selectAudioInspector('master','echo');h.flush();assert.equal(h.isExpanded('echo'),true)
})
