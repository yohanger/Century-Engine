import { createTimelinePointerDrag } from '../src/core/timeline/pointer-drag.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newTimeline, newTrack, newKey, normalizeTimeline, sortKeys, timelineSelectedKeys, timelineSelectionMoveDelta,
  moveTimelineSelection, duplicateTimelineSelection, deleteTimelineSelection, timelineKeysInRegion } from '../src/core/timeline/model.js'

const ui = readFileSync(new URL('../src/components/TimelinePanel.vue', import.meta.url), 'utf8')
const inspector = readFileSync(new URL('../src/components/TemporalResourceInspector.vue', import.meta.url), 'utf8')
const state = readFileSync(new URL('../src/core/state/state.js', import.meta.url), 'utf8')
const script = ui.split('<script setup>')[1].split('</script>')[0]
const template = ui.slice(ui.indexOf('<template>') + '<template>'.length, ui.lastIndexOf('</template>'))
const style = ui.split('<style scoped>')[1].split('</style>')[0]
const make = () => {
  const tl = newTimeline('S10 multiselección', {duration:10})
  const node = newTrack('node',{name:'Movimiento',prop:'position'})
  node.keys = [newKey('node',1),newKey('node',3),newKey('node',5)]
  const cam = newTrack('camera',{name:'Cámara'})
  cam.keys = [newKey('camera',2),newKey('camera',6)]
  const command = newTrack('commands',{name:'Eventos'})
  command.keys = [newKey('commands',4,{list:[{id:'cmd_1',code:'text',p:{text:'Prueba'},b:{}}]})]
  const bake={id:'bake',name:'Física',kind:'bake',keys:[{id:'illegal',t:1}]}
  tl.tracks=[node,cam,command,bake]
  const ref=(tr,index)=>({tr:tr.id,k:tr.keys[index].id})
  return {tl,node,cam,command,bake,ref}
}
const times = entries => entries.map(x=>x.t)

test('G002-01 · selección múltiple por ID entre pistas, sin duplicados ni pistas bake',()=>{
  const {tl,node,cam,bake,ref}=make()
  const selected=timelineSelectedKeys(tl,[ref(node,0),ref(cam,0),ref(node,0),{tr:'no',k:'no'},{tr:bake.id,k:'illegal'}])
  assert.equal(selected.length,2)
  assert.deepEqual(selected.map(s=>s.tr),[node.id,cam.id])
  assert.deepEqual(selected.map(s=>s.key.t),[1,2])
})

test('G002-02 · movimiento colectivo mantiene offsets y orden sin modificar claves ajenas',()=>{
  const {tl,node,cam,ref}=make()
  const refs=[ref(node,0),ref(cam,0)]
  assert.equal(moveTimelineSelection(tl,refs,1.25),2)
  assert.deepEqual(times(node.keys),[2.25,3,5])
  assert.deepEqual(times(cam.keys),[3.25,6])
  assert.equal(node.keys[0].id,refs[0].k)
  assert.equal(cam.keys[0].id,refs[1].k)
  assert.equal(moveTimelineSelection(tl,refs,0),0)
})

test('G002-03 · límites: ningún grupo puede salir del intervalo de la película',()=>{
  const {tl,node,cam,ref}=make()
  const refs=[ref(node,1),ref(cam,1)]
  assert.equal(moveTimelineSelection(tl,refs,100),2)
  assert.equal(cam.keys.at(-1).t,10)
  assert.equal(node.keys.find(k=>k.id===refs[0].k).t,7)
  assert.equal(moveTimelineSelection(tl,refs,-100),2)
  assert.equal(node.keys.find(k=>k.id===refs[0].k).t,0)
  assert.equal(cam.keys.find(k=>k.id===refs[1].k).t,3)
})

test('G002-04 · Snap contextual al cabezal con tolerancia en píxeles',()=>{
  const {tl,node,ref}=make()
  const delta=timelineSelectionMoveDelta(tl,[ref(node,0)],.93,{snap:.1,playhead:2,zoom:70,tolerancePixels:8})
  assert.equal(delta,1)
})

test('G002-05 · Snap a otras claves sin desplazarlas ni forzar posiciones individuales',()=>{
  const {tl,node,cam,ref}=make()
  const refs=[ref(node,0),ref(cam,0)]
  const delta=timelineSelectionMoveDelta(tl,refs,1.94,{snap:.1,playhead:9.25,zoom:70})
  assert.equal(delta,2,'clave en 1 s se alinea a otra clave no seleccionada de 3 s')
  moveTimelineSelection(tl,refs,delta)
  assert.equal(node.keys.find(k=>k.id===refs[0].k).t,3)
  assert.equal(cam.keys.find(k=>k.id===refs[1].k).t,4)
})

test('G002-06 · Snap desactivado conserva precisión libre y no cuantiza',()=>{
  const {tl,node,ref}=make()
  const delta=timelineSelectionMoveDelta(tl,[ref(node,0)],.13742,{snap:0,playhead:2,zoom:100})
  assert.equal(delta,.13742)
})

test('G002-07 · Snap en rejilla aplica el mismo delta a todas las claves',()=>{
  const {tl,node,cam,ref}=make()
  const refs=[ref(node,0),ref(cam,0)]
  const delta=timelineSelectionMoveDelta(tl,refs,.36,{snap:.25,playhead:9.23,zoom:200,tolerancePixels:4})
  assert.equal(delta,.25)
  moveTimelineSelection(tl,refs,delta)
  assert.equal(cam.keys[0].t-node.keys[0].t,1)
})

test('G002-08 · duplicar varias claves conserva valores, asigna IDs nuevos y no muta origen',()=>{
  const {tl,node,cam,ref}=make()
  const originals=[ref(node,0),ref(cam,0)]
  const clone=duplicateTimelineSelection(tl,originals,1)
  assert.equal(clone.length,2)
  assert.equal(new Set(clone.map(x=>x.k)).size,2)
  assert.equal(node.keys.length,4)
  assert.equal(cam.keys.length,3)
  assert.equal(node.keys.find(k=>k.id===originals[0].k).t,1)
  assert.equal(node.keys.find(k=>k.id===clone[0].k).t,2)
  assert.deepEqual(node.keys.find(k=>k.id===clone[0].k).v,node.keys.find(k=>k.id===originals[0].k).v)
})

test('G002-09 · duplicación de comandos crea IDs independientes también para comandos',()=>{
  const {tl,command,ref}=make()
  const clones=duplicateTimelineSelection(tl,[ref(command,0)],1)
  assert.equal(clones.length,1)
  const orig=command.keys.find(k=>k.t===4)
  const copy=command.keys.find(k=>k.id===clones[0].k)
  assert.equal(copy.t,5)
  assert.notEqual(copy.id,orig.id)
  assert.notEqual(copy.list[0].id,orig.list[0].id)
  assert.deepEqual(copy.list[0].p,orig.list[0].p)
})

test('G002-10 · duplicación en límite elige espacio izquierdo o rechaza sin copias idénticas',()=>{
  const {tl,cam,ref}=make()
  cam.keys[1].t=10
  const original=ref(cam,1)
  const dup=duplicateTimelineSelection(tl,[original],1)
  assert.equal(dup.length,1)
  assert.equal(cam.keys.find(k=>k.id===dup[0].k).t,9)
  const impossible={...tl,tracks:[newTrack('node',{keys:[newKey('node',0),newKey('node',10)]})]}
  assert.equal(duplicateTimelineSelection(impossible,impossible.tracks[0].keys.map(k=>({tr:impossible.tracks[0].id,k:k.id}))).length,0)
})

test('G002-11 · eliminar conjunto afecta únicamente IDs elegidos y no borra pistas',()=>{
  const {tl,node,cam,bake,ref}=make()
  const refs=[ref(node,0),ref(cam,1),{tr:bake.id,k:'illegal'}]
  assert.equal(deleteTimelineSelection(tl,refs),2)
  assert.equal(tl.tracks.length,4)
  assert.deepEqual(times(node.keys),[3,5])
  assert.deepEqual(times(cam.keys),[2])
})

test('G002-12 · selección por región toma claves de pistas y tiempos correctos',()=>{
  const {tl,node,cam,command,bake}=make()
  const refs=timelineKeysInRegion(tl,1.5,4.25,0,2)
  assert.deepEqual(refs.map(r=>r.tr),[node.id,cam.id,command.id])
  assert.equal(refs.length,3)
  assert.equal(timelineKeysInRegion(tl,0,10,3,3).length,0)
})

test('G002-13 · normalización/guardado no incorpora estado de selección ni pierde IDs reales',()=>{
  const {tl,node,cam,ref}=make()
  const selection=[ref(node,0),ref(cam,0)]
  moveTimelineSelection(tl,selection,1)
  tl.tracks=tl.tracks.filter(tr=>tr.kind !== 'bake') // la pista bake ficticia solo verifica protección, no formato Jolt.
  const persisted=normalizeTimeline(tl)
  assert.equal(persisted.tracks.length,3)
  assert.equal(persisted.tracks[0].keys.find(k=>k.id===selection[0].k).t,2)
  assert.equal(persisted.tracks[1].keys.find(k=>k.id===selection[1].k).t,3)
  assert.equal('keyRefs' in persisted,false)
  assert.equal('selectedKeys' in persisted,false)
})

test('G002-14 · ctrl/shift + selección, marquee, Ctrl+D y borrar conectados a Timeline original',()=>{
  for(const expr of ['event?.ctrlKey','event?.shiftKey','marqueeDown(e)','timelineKeysInRegion(tl.value','selectRefs(refs)','timelineSelectionMoveDelta(timeline','moveTimelineSelection(timeline','duplicateTimelineSelection(tl.value','deleteTimelineSelection(tl.value']) assert.ok(script.includes(expr),expr)
  assert.match(template,/@pointerdown="keyDown\(\$event, row\.track, k\)"/)
  assert.match(template,/@pointerdown="laneDown\(\$event, row\.track\)"/)
  assert.match(template,/v-if="marquee" class="timeline-marquee"/)
  assert.match(template,/chosenCount > 1/)
  assert.match(script,/e\.code === 'KeyD'/)
  assert.match(style,/\.timeline-marquee \{/)
})

test('G002-15 · drag usa las claves originales y un solo commit al finalizar',()=>{
  assert.match(script,/function beginKeyDrag\(e,tr,k,refs,wasMulti = false\)/)
  assert.match(script,/const initial = timelineSelectedKeys\(timeline,refs\)/)
  assert.match(script,/const restore = \(\) =>/)
  assert.match(script,/const shift = timelineSelectionMoveDelta/)
  assert.match(script,/finish\(dragging\) \{[\s\S]*?if \(lastShift\) \{[\s\S]*?commit\(initial\.length > 1 \? 'Mover claves' : 'Mover clave'\)/)
  assert.match(script,/timelineDrag\.begin\(e, \{/)
})

test('G002-16 · Inspector contextual utiliza la selección existente sin otro Inspector',()=>{
  assert.match(state,/export function selectTemporal\([^)]*keyRefs = null(?:, timelineMode = null)?\)/)
  assert.match(script,/selectTemporal\('timeline',\s*tl\.value\.id,/)
  assert.match(script,/s\?\.clip \? 'clip' : s\?\.k \? 'key'/)
  assert.match(script,/s\?\.keys,editMode\.value\)/)
  assert.match(inspector,/const multiKeys = computed\(/)
  assert.match(inspector,/part\.value === 'keys'/)
  assert.match(inspector,/data-test="timeline-multi-inspector"/)
  assert.match(inspector,/@change="shiftMultiKeys"/)
  assert.match(inspector,/@click="duplicateMultiKeys"/)
  assert.match(inspector,/@click="deleteMultiKeys"/)
})

test('G002-17 · Shift/Ctrl no modifica datos y Edit Mode no reproduce comandos al mover',()=>{
  assert.match(script,/if \(e\.ctrlKey \|\| e\.metaKey \|\| e\.shiftKey\) \{ pick\(tr,k,e\); return \}/)
  assert.match(script,/store\.locked \|\| store\.play\.on/)
  assert.match(script,/const ph = playback.time/)
  assert.match(script,/playback\.refresh\(tl\.value,selTrack\.value/)
  assert.doesNotMatch(script,/new PlaybackRunner\(/)
})

test('G002-18 · modelo del Player y FilmMaker permanecen fuera de implementación',()=>{
  assert.doesNotMatch(ui,/filmMaker\.passes\s*=|new UnityRuntime\(/)
  assert.match(ui,/const timelines = computed\(\(\) => \(store\.project\?\.timelines \|\| \[\]\)\.filter/)
})

test('G002-19 · compilador Vue valida componentes del Gate si está instalado',async t=>{
  let compiler
  try {compiler=await import('@vue/compiler-sfc')}
  catch(e) {if(e?.code==='ERR_MODULE_NOT_FOUND'){t.skip('Instalar dependencias y compilar localmente');return}throw e}
  for(const [name,source] of [['TimelinePanel.vue',ui],['TemporalResourceInspector.vue',inspector]]){
    const parsed=compiler.parse(source,{filename:name})
    assert.deepEqual(parsed.errors,[],name)
    const compiled=compiler.compileTemplate({source:parsed.descriptor.template.content,filename:name,id:name})
    assert.deepEqual(compiled.errors,[],name)
  }
})

// Los siguientes casos ejecutan los manejadores de eventos sin sustituir el modelo ni usar un navegador simulado.
function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`)
  assert.ok(start >= 0,name)
  const open=source.indexOf('{',start)
  let depth=0
  for(let i=open;i<source.length;i++){
    if(source[i]==='{')depth++
    if(source[i]==='}' && --depth===0)return source.slice(start,i+1)
  }
  throw new Error(`Función sin cierre: ${name}`)
}
function bindFunction(source,name,deps) {
  return Function(...Object.keys(deps),functionSource(source,name)+`; return ${name}`)(...Object.values(deps))
}

test('G002-20 · Ctrl+clic alterna claves de varias pistas y Shift selecciona un intervalo',()=>{
  const {tl,node,cam}=make(),sel={value:null}
  const keyRefs={get value(){return sel.value?.keys?.length ? sel.value.keys : sel.value?.k ? [{tr:sel.value.tr,k:sel.value.k}] : []}}
  const chosenCount={get value(){return keyRefs.value.length}}
  const hasKey=(tr,k)=>keyRefs.value.some(r=>r.tr===tr.id && r.k===k.id)
  const pick=bindFunction(script,'pick',{sel,keyRefs,chosenCount,hasKey})
  pick(node,node.keys[0])
  pick(cam,cam.keys[0],{ctrlKey:true})
  assert.equal(keyRefs.value.length,2)
  pick(node,node.keys[0],{metaKey:true})
  assert.equal(keyRefs.value.length,1)
  pick(node,node.keys[0])
  pick(node,node.keys[2],{shiftKey:true})
  assert.deepEqual(keyRefs.value.map(r=>r.k),node.keys.map(k=>k.id))
})

test('G002-21 · arrastre de grupo reutiliza snapshot real y produce un único commit',()=>{
  const {tl,node,cam,ref}=make(), events=new Map(), calls=[]
  const sel={value:{tr:cam.id,k:cam.keys[0].id,keys:[ref(node,0),ref(cam,0)]}}
  const keyRefs={get value(){return sel.value.keys?.length ? sel.value.keys : [{tr:sel.value.tr,k:sel.value.k}]}}
  const chosenCount={get value(){return keyRefs.value.length}}
  const hasKey=(tr,k)=>keyRefs.value.some(r=>r.tr===tr.id && r.k===k.id)
  const pick=bindFunction(script,'pick',{sel,keyRefs,chosenCount,hasKey})
  const selectRefs=bindFunction(script,'selectRefs',{sel})
  const window={addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)}
  const beginKeyDrag=bindFunction(script,'beginKeyDrag',{timelineDrag:createTimelinePointerDrag(window),guardedTrack:()=>true,playback:{pause(){}},
    tl:{value:tl},zoom:{value:70},snap:{value:0},ph:{value:0},timelineSelectedKeys,timelineSelectionMoveDelta,
    moveTimelineSelection,sortKeys,window,commit:name=>calls.push(name),bump(){},selectRefs,
  })
  const gesture=bindFunction(script,'keyDown',{
    store:{locked:false,play:{on:false}},tl:{value:tl},playing:{value:false},cancelAnimationFrame(){},raf:0,
    chosenCount,hasKey,pick, keyRefs,zoom:{value:70},snap:{value:0},ph:{value:0},
    timelineSelectedKeys,timelineSelectionMoveDelta,moveTimelineSelection,selectRefs,sortKeys,window,
    commit:name=>calls.push(name),bump(){},beginKeyDrag,
  })
  gesture({button:0,buttons:1,pointerId:1,clientX:100,clientY:0,ctrlKey:false,metaKey:false,shiftKey:false,stopPropagation(){}},cam,cam.keys[0])
  assert.ok(events.has('pointermove') && events.has('pointerup'))
  events.get('pointermove')({buttons:1,pointerId:1,clientX:170,clientY:0})
  events.get('pointerup')({button:0,pointerId:1,clientX:170})
  assert.deepEqual([node.keys.find(k=>k.id===ref(node,0).k).t,cam.keys.find(k=>k.id===ref(cam,0).k).t],[2,3])
  assert.deepEqual(calls,['Mover claves'])
  assert.equal(events.size,0)
})

test('G002-22 · Mayús+arrastrar hace selección por región de dos pistas sin arrastrar pistas',()=>{
  const {tl}=make(),events=new Map(),sel={value:null},marquee={value:null}
  const keyRefs={get value(){return sel.value?.keys || []}}
  const selectRefs=bindFunction(script,'selectRefs',{sel})
  const inner={value:{getBoundingClientRect:()=>({left:0,top:0})}}
  const window={addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:key=>events.delete(key)}
  const doMarquee=bindFunction(script,'marqueeDown',{
    tl:{value:tl},inner,root:{value:{focus(){}}},store:{locked:false,play:{on:false}},zoom:{value:70},TIME_ORIGIN_PX:24,marquee,window,
    timelineKeysInRegion,timelineSelectedKeys,keyRefs,selectRefs,
  })
  doMarquee({button:0,clientX:63,clientY:32,shiftKey:true,preventDefault(){},stopPropagation(){} })
  events.get('pointermove')({clientX:310,clientY:73})
  assert.ok(marquee.value?.w>0)
  events.get('pointerup')({clientX:310,clientY:73})
  assert.equal(keyRefs.value.length,3)
  assert.equal(marquee.value,null)
  assert.equal(events.size,0)
})

test('G002-23 · Inspector mueve múltiples claves numéricamente sin registrar doble operación',()=>{
  const {tl,node,cam,ref}=make(),commits=[]
  const input={value:'1.5'},selected=[ref(node,0),ref(cam,0)].map(x=>({...x,t:tl.tracks.find(tr=>tr.id===x.tr).keys.find(k=>k.id===x.k).t}))
  const handler=bindFunction(inspector,'shiftMultiKeys',{
    part:{value:'keys'},store:{locked:false,play:{on:false}},multiKeys:{value:selected},
    resource:{value:tl},moveTimelineSelection,changed:name=>commits.push(name),
  })
  handler({target:input})
  assert.equal(input.value,'')
  assert.deepEqual([node.keys[0].t,cam.keys[0].t],[2.5,3.5])
  assert.deepEqual(commits,['Mover claves'])
})

test('G002-24 · el arrastre cancelado restaura tiempos sin commit',()=>{
  const {tl,node,cam,ref}=make(),events=new Map(),commits=[]
  const sel={value:{tr:node.id,k:node.keys[0].id,keys:[ref(node,0),ref(cam,0)]}}
  const keyRefs={get value(){return sel.value.keys}}
  const chosenCount={get value(){return 2}}
  const hasKey=(tr,k)=>keyRefs.value.some(r=>r.tr===tr.id&&r.k===k.id)
  const pick=bindFunction(script,'pick',{sel,keyRefs,chosenCount,hasKey})
  const window={addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:key=>events.delete(key)}
  const beginKeyDrag=bindFunction(script,'beginKeyDrag',{timelineDrag:createTimelinePointerDrag(window),guardedTrack:()=>true,playback:{pause(){}},
    tl:{value:tl},zoom:{value:70},snap:{value:0},ph:{value:0},timelineSelectedKeys,
    timelineSelectionMoveDelta,moveTimelineSelection,sortKeys,window,selectRefs(){},bump(){},commit:name=>commits.push(name),
  })
  const doDrag=bindFunction(script,'keyDown',{
    store:{locked:false,play:{on:false}},tl:{value:tl},playing:{value:false},cancelAnimationFrame(){},raf:0,
    chosenCount,hasKey,pick,keyRefs,zoom:{value:70},snap:{value:0},ph:{value:0},timelineSelectedKeys,
    timelineSelectionMoveDelta,moveTimelineSelection,sortKeys,window,selectRefs(){},bump(){},commit:name=>commits.push(name),beginKeyDrag,
  })
  doDrag({button:0,buttons:1,pointerId:1,clientX:100,clientY:0,stopPropagation(){}},node,node.keys[0])
  events.get('pointermove')({buttons:1,pointerId:1,clientX:180,clientY:0})
  events.get('pointercancel')({pointerId:1})
  assert.deepEqual([node.keys[0].t,cam.keys[0].t],[1,2])
  assert.equal(commits.length,0)
})


test('G002-25 · arrastrar segmento mueve los dos extremos reales sin variar su longitud',()=>{
  const {tl,node}=make(), events=new Map(),commits=[]
  const sel={value:null}
  const keyRefs={get value(){return sel.value?.keys?.length ? sel.value.keys : sel.value?.k ? [{tr:sel.value.tr,k:sel.value.k}] : []}}
  const chosenCount={get value(){return keyRefs.value.length}}
  const hasKey=(tr,k)=>keyRefs.value.some(r=>r.tr===tr.id&&r.k===k.id)
  const pick=bindFunction(script,'pick',{sel,keyRefs,chosenCount,hasKey})
  const window={addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)}
  const selectRefs=bindFunction(script,'selectRefs',{sel})
  const beginKeyDrag=bindFunction(script,'beginKeyDrag',{timelineDrag:createTimelinePointerDrag(window),guardedTrack:()=>true,playback:{pause(){}},
    tl:{value:tl},zoom:{value:70},snap:{value:0},ph:{value:0},timelineSelectedKeys,timelineSelectionMoveDelta,
    moveTimelineSelection,sortKeys,window,selectRefs,bump(){},commit:name=>commits.push(name),
  })
  const press=bindFunction(script,'pickSegment',{
    chosenCount,hasKey,pick,store:{locked:false,play:{on:false}},playing:{value:false},
    cancelAnimationFrame(){},raf:0,keyRefs,beginKeyDrag,
  })
  press(node,node.keys[0].id,{button:0,buttons:1,pointerId:1,clientX:100,clientY:0,ctrlKey:false,metaKey:false,shiftKey:false})
  events.get('pointermove')({buttons:1,pointerId:1,clientX:170,clientY:0})
  events.get('pointerup')({button:0,pointerId:1,clientX:170})
  assert.deepEqual(times(node.keys),[2,4,5])
  assert.deepEqual(commits,['Mover claves'])
})
