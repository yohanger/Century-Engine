// LF-AUDIO-MIXER-INSPECTOR-S02-G001 — selección efímera, edición de grupo y efectos existentes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const read=path=>readFileSync(new URL(`../src/${path}`,import.meta.url),'utf8')
const mixer=read('components/AudioMixer.vue'), inspector=read('components/AudioMixerInspector.vue')
const general=read('components/Inspector.vue'), dock=read('components/InspectorDock.vue')
const audioSrc=read('core/state/audio.js'), app=read('filmmaker/FilmApp.vue')
function harness(){
 const group=(id)=>({id,name:id,color:'#aabbcc',parent:id==='master'?null:'master',volume:0,mute:false,solo:false,bypass:false,fx:[]})
 const master=group('master'),music=group('music');const events=[]
 const store={project:{audio:{groups:[master,music],snapshots:[],startSnapshot:''}},audioInspector:null,selectedId:'scene-node',selectedIds:['scene-node'],sceneSel:true,terrainSel:false,projSel:{kind:'profile',id:'p'},prefs:{rightTab:'terrain',rightOpen:false},ui:{mode:'desktop'},editor:{setSelection(...args){events.push(['scene-selection',...args])}}}
 const context=vm.createContext({store,markDirty:()=>events.push('dirty'),toast:()=>{},uid:()=>`x${events.length}`})
 const source=audioSrc.replace(/^import .*$/gm,'').replace(/^export /gm,'')
 vm.runInContext(source+'\nglobalThis.aud={selectAudioInspector,audioInspectorTarget,updateAudioGroup,updateAudioFx,removeAudioFx,moveAudioFx,loadAudioSnapshot}',context)
 return {store,events,...context.aud,master,music}
}
test('AMI-01: Audio Mixer ya no monta inspector de 280 px',()=>{
 assert.doesNotMatch(mixer,/<aside class="insp">/)
 assert.match(mixer,/grid-template-columns: 190px minmax\(0,1fr\)/)
})
test('AMI-02: Master conserva fader, S/M/B y medidor en Mixer',()=>{
 for (const span of ['<MixerMeter :gid="g.id"','class="fader"','g.solo','g.mute','g.bypass','class="strip"'])assert.ok(mixer.includes(span),span)
})
test('AMI-03: nombre, color, routing, efectos y presets viven exclusivamente en Inspector',()=>{
 for(const span of ['<ColorInput','setGroupParent(','addAudioFx(','removeAudioFx(','moveAudioFx(','REVERB_PRESETS','FX_TYPES','Añadir efecto','Volumen','Nombre'])assert.ok(inspector.includes(span),span)
 assert.doesNotMatch(mixer,/ColorInput|REVERB_PRESETS|<select class="add"|<div v-if="g.id !== 'master'" class="out"/)
})
test('AMI-04: Inspector general comparte la vista con nodos y escenas',()=>{
 assert.match(general,/import AudioMixerInspector/)
 assert.match(general,/<AudioMixerInspector v-if="audioContext"/)
 assert.match(general,/v-else-if="multi"/)
 assert.match(dock,/<Inspector v-else v-show="tab === 'object'"/)
})
test('AMI-05: grupo Master se selecciona y abre Inspector derecho sin persistir datos de selección',()=>{
 const h=harness();assert.equal(h.selectAudioInspector('master'),true)
 assert.equal(h.store.audioInspector.groupId,'master');assert.equal(h.store.audioInspector.effectId,null)
 assert.equal(h.store.selectedId,null);assert.equal(h.store.sceneSel,false);assert.equal(h.store.prefs.rightTab,'object');assert.equal(h.store.prefs.rightOpen,true)
 assert.equal(h.store.project.audio.groups[0].id,'master');assert.ok(h.events.some(e=>e[0]==='scene-selection'))
})
test('AMI-06: selección inválida no fabrica un grupo ni FX',()=>{
 const h=harness();assert.equal(h.selectAudioInspector('missing'),false);assert.equal(h.store.audioInspector,null)
 assert.equal(h.selectAudioInspector('master','badfx'),false);assert.equal(h.store.project.audio.groups.length,2)
})
test('AMI-07: selección de FX usa identidad del FX original de project.audio',()=>{
 const h=harness(),f={id:'echo-1',type:'echo',on:true,time:0.35};h.master.fx.push(f)
 assert.equal(h.selectAudioInspector('master','echo-1'),true)
 assert.equal(h.audioInspectorTarget().effect,f)
 assert.equal(h.audioInspectorTarget().group,h.master)
})
test('AMI-08: cambiar entre FX y grupo conserva IDs sin duplicar datos',()=>{
 const h=harness();h.master.fx.push({id:'fx',type:'reverb',on:true})
 h.selectAudioInspector('master','fx');h.selectAudioInspector('music');h.selectAudioInspector('master')
 assert.equal(h.audioInspectorTarget().effect,null);assert.equal(h.store.project.audio.groups.length,2);assert.equal(h.master.fx.length,1)
})
test('AMI-09: cambiar color y volumen usa el updater existente con marca dirty',()=>{
 const h=harness();h.updateAudioGroup('music',{color:'#112233',volume:-7})
 assert.equal(h.music.color,'#112233');assert.equal(h.music.volume,-7);assert.ok(h.events.includes('dirty'))
})
test('AMI-10: editar parámetros de efecto modifica solo el FX seleccionado',()=>{
 const h=harness();h.master.fx.push({id:'f1',type:'echo',on:true,mix:0.2},{id:'f2',type:'echo',on:true,mix:0.7})
 h.updateAudioFx('master','f1',{mix:0.35})
 assert.equal(h.master.fx[0].mix,0.35);assert.equal(h.master.fx[1].mix,0.7)
})
test('AMI-11: subir/bajar efecto opera con orden real persistido',()=>{
 const h=harness();h.master.fx.push({id:'a',type:'echo'},{id:'b',type:'reverb'})
 h.moveAudioFx('master','b',-1);assert.deepEqual(Array.from(h.master.fx,f=>f.id),['b','a'])
})
test('AMI-12: eliminar FX seleccionado vuelve al grupo y no deja selección huérfana',()=>{
 const h=harness();h.master.fx.push({id:'x',type:'echo',on:true});h.selectAudioInspector('master','x');h.removeAudioFx('master','x')
 assert.equal(h.master.fx.length,0);assert.equal(h.store.audioInspector.effectId,null)
 assert.equal(h.audioInspectorTarget().effect,null)
})
test('AMI-13: snapshots originales actualizan volumen/efectos sin desincronizar inspector',()=>{
 const h=harness();h.master.fx.push({id:'a',type:'reverb',on:true,mix:0.2});h.selectAudioInspector('master','a')
 h.store.project.audio.snapshots.push({id:'s',groups:{master:{volume:-10,mute:false,fx:{a:{mix:0.65}}}}})
 h.loadAudioSnapshot('s');assert.equal(h.master.volume,-10);assert.equal(h.audioInspectorTarget().effect.mix,0.65)
})
test('AMI-14: seleccionar nodo normal limpia el contexto Audio sin destruir el Mixer',()=>{
 const source=read('core/state/objects.js')
 assert.match(source,/export function selectObject\([^]*?store\.audioInspector = null/)
 assert.match(mixer,/const sel = computed\(\(\) => store\.audioInspector\?\.groupId \|\| 'master'\)/)
})
test('AMI-15: al cambiar proyecto se invalida selección efímera sin afectar audio',()=>{
 const state=read('core/state/state.js')
 assert.match(state,/audioInspector: null/)
 assert.match(state,/watch\(\(\) => store\.project, \(\) => \{ store\.audioInspector = null \}\)/)
 assert.doesNotMatch(state,/project\.audio\.inspector/)
 assert.match(state,/watch\(\(\) => store\.projSel, \(selection\) => \{ if \(selection\) store\.audioInspector = null \}\)/)
})
test('AMI-16: FilmMaker desktop abre Inspector y mobile cambia hoja',()=>{
 assert.match(app,/<AudioMixer v-if="bottom === 'mixer'" @inspect="inspectMixerSelection"/)
 assert.match(app,/<AudioMixer v-if="drawer === 'mixer'" @inspect="inspectMixerSelection"/)
 assert.match(app,/if \(narrow\.value\) drawer\.value = 'insp'/)
 assert.match(app,/right\.value = 'insp'; rightOpen\.value = true/)
})
test('AMI-17: FilmMaker y Editor reutilizan un único AudioMixer sin duplicar propiedades',()=>{
 assert.match(read('components/BottomDock.vue'),/<AudioMixer v-else-if="store\.prefs\.bottomTab === 'mixer'"/)
 assert.match(app,/import Inspector from '\.\.\/components\/Inspector\.vue'/)
 assert.doesNotMatch(mixer,/<aside class="insp">/)
})
test('AMI-18: ningún cambio de arquitectura de audio ni FX en el motor runtime',()=>{
 assert.match(inspector,/updateAudioFx\(group\.id,f\.id/)
 assert.match(mixer,/loadAudioSnapshot\(s\.id\)/)
 assert.match(mixer,/MixerMeter/)
})
