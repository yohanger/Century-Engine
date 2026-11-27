import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const get = rel => readFileSync(new URL(rel, import.meta.url), 'utf8')
const timeline = get('../src/filmmaker/NleTimeline.vue')
const filmApp = get('../src/filmmaker/FilmApp.vue')
const css = get('../src/filmmaker/film-ux.css')
const source = (text, name) => {
  const begin = text.indexOf(`function ${name}(`)
  assert.ok(begin >= 0, `${name} debe seguir existiendo`)
  const open = text.indexOf('{',begin)
  let depth=0
  for(let i=open;i<text.length;i++){
    if(text[i]==='{') depth++
    if(text[i]==='}' && --depth===0) return text.slice(begin,i+1)
  }
  throw Error(`Función no cerrada: ${name}`)
}
const load = (text,name,deps) => Function(...Object.keys(deps),source(text,name)+`; return ${name}`)(...Object.values(deps))

const idle = () => ({ playing:false, rec:{state:'idle'}, pass:{state:'idle'}, montage:{on:false} })

test('CORR004-01 · + Pista ya no está recortado por el overflow de NLE',()=>{
  assert.match(timeline,/class="nle"[^>]*data-test="nle"/)
  assert.match(timeline,/\.nle \{[^}]*overflow: hidden/)
  assert.doesNotMatch(timeline,/<details class="nle-add-menu"/)
  assert.match(timeline,/<Teleport to="body">\s*<div v-if="addChooser"[^>]+film-add-picker/)
  assert.match(css,/\.film-add-picker \{ z-index:5000; position:fixed;/)
  assert.match(css,/\.film-add-picker button,.film-add-picker select/)
})

test('CORR004-02 · menú de inserción incluye nodos, cámaras, efectos, audio, texto y pistas reales',()=>{
  for (const id of ['film-add-node-from-menu','nle-add-camera-shot','nle-add-pass','nle-add-text','nle-add-fx','nle-add-audio','nle-add-track']) {
    assert.ok(timeline.includes(`data-test="${id}"`),id)
  }
  assert.match(timeline,/@click="openNodePickerFromMenu"/)
  assert.match(timeline,/@click="addEditorialShot\(\);closeAddMenu\(\)"/)
  assert.match(timeline,/@click="addEffect\(\);closeAddMenu\(\)"/)
  assert.match(timeline,/v-model="addPass"/)
})

test('CORR004-03 · + Pista abre el portal en un Cinematic vacío y cierra el de nodos',()=>{
  const calls=[]
  const deps={film:{value:{id:'cinematic'}},session:idle(),toast:m=>calls.push(m),nodeChooser:{value:true},
    F:{stopMontage:()=>calls.push('stop')},positionAddPicker:()=>calls.push('position'),addChooser:{value:false}}
  const open=load(timeline,'openAddMenu',deps)
  assert.equal(open(),true)
  assert.equal(deps.nodeChooser.value,false)
  assert.equal(deps.addChooser.value,true)
  assert.deepEqual(calls,['position'])
})

test('CORR004-04 · si grabación o reproducción impide edición, muestra motivo en vez de no hacer nada',()=>{
  const notices=[],session=idle()
  const deps={film:{value:{id:'film'}},session,toast:m=>notices.push(m),nodeChooser:{value:false},
    F:{stopMontage(){}},positionAddPicker:()=>{},addChooser:{value:false}}
  const open=load(timeline,'openAddMenu',deps)
  session.playing=true
  assert.equal(open(),false)
  assert.match(notices[0],/Detén la grabación o reproducción/)
  assert.equal(deps.addChooser.value,false)
  session.playing=false;session.pass.state='rec'
  assert.equal(open(),false)
  assert.equal(notices.length,2)
})

test('CORR004-05 · el menú y el selector se posicionan dentro de una ventana reducida',()=>{
  const anchor={value:{getBoundingClientRect:()=>({left:480,right:575,top:405,bottom:431})}}
  const pos=load(timeline,'popupPosition',{window:{innerWidth:600,innerHeight:500}})
  for(const [w,h] of [[300,390],[340,340]]) {
    const style=pos(anchor,w,h)
    assert.equal(style.position,'fixed')
    assert.ok(parseInt(style.top)>=12)
    assert.ok(parseInt(style.left)>=12)
    assert.ok(parseInt(style.width)+parseInt(style.left)<=600)
    assert.ok(parseInt(style.maxHeight)+parseInt(style.top)<=500)
  }
})

test('CORR004-06 · Shift+A abre el menú NLE original, no tools.commands',async()=>{
  let called=0,prevented=false
  const deps={F:{operatorRig:()=>null},session:{film:{id:'film'}},narrow:{value:false},drawer:{value:''},bottom:{value:'assets'},
    nextTick:fn=>Promise.resolve().then(fn),nle:{value:{openAddMenu(){called++}}}}
  const key=load(filmApp,'onKey',deps)
  key({type:'keydown',code:'KeyA',shiftKey:true,ctrlKey:false,metaKey:false,altKey:false,repeat:false,
    target:{tagName:'DIV'},preventDefault(){prevented=true}})
  await Promise.resolve()
  assert.equal(prevented,true)
  assert.equal(deps.bottom.value,'nle')
  assert.equal(called,1)
  assert.doesNotMatch(source(filmApp,'onKey'),/tool\('commands'\)/)
  assert.match(timeline,/defineExpose\(\{[^}]*openAddMenu/)
})

test('CORR004-07 · Shift+A no captura escritura, Ctrl+A o el movimiento del camarógrafo',async()=>{
  let called=0
  const deps={F:{operatorRig:()=>null},session:{film:{id:'film'}},narrow:{value:false},drawer:{value:''},bottom:{value:'nle'},
    nextTick:fn=>Promise.resolve().then(fn),nle:{value:{openAddMenu(){called++}}}}
  const key=load(filmApp,'onKey',deps)
  const event=(overrides={})=>({type:'keydown',code:'KeyA',shiftKey:true,ctrlKey:false,metaKey:false,altKey:false,repeat:false,
    target:{tagName:'DIV'},preventDefault(){throw Error('Atajo robado')},...overrides})
  key(event({target:{tagName:'INPUT'}}))
  key(event({ctrlKey:true}))
  deps.F.operatorRig=()=>({keys:new Set()})
  key(event())
  await Promise.resolve()
  assert.equal(called,0)
})

test('CORR004-08 · un clic fuera cierra ambos portales, no cierra el interior del menú',()=>{
  const deps={nodeChooser:{value:false},nodePicker:{value:null},nodeButton:{value:null},
    addChooser:{value:true},addPicker:{value:{contains:t=>t==='menu'}},addButton:{value:{contains:t=>t==='trigger'}}}
  const outside=load(timeline,'closeNodePickerOutside',deps)
  outside({target:'menu'});assert.equal(deps.addChooser.value,true)
  outside({target:'trigger'});assert.equal(deps.addChooser.value,true)
  outside({target:'outside'});assert.equal(deps.addChooser.value,false)
})

test('CORR004-09 · botón + Nodo nunca es silenciosamente disabled y conserva el selector real',()=>{
  const button=timeline.match(/<button ref="nodeButton"[^>]+>/)?.[0]||''
  assert.ok(button.includes('@click="addSelectedNode"'))
  assert.ok(!button.includes(':disabled='))
  assert.match(source(timeline,'addSelectedNode'),/toast\('Detén la grabación o reproducción para añadir nodos'/)
  assert.match(timeline,/film-node-picker/)
  assert.match(timeline,/availableFilmCameras/)
  assert.match(timeline,/filmNodeAnimationAllowed/)
})

test('CORR004-10 · el + de zoom se identifica y no se confunde con la inserción',()=>{
  assert.match(timeline,/>Zoom \+<\/button>/)
  assert.match(timeline,/title="Zoom: acercar/)
  assert.match(timeline,/>＋ Pista<\/button>/)
  assert.match(timeline,/\+ Nodo…<\/button>/)
})

test('CORR004-11 · no se añaden nuevos modelos, formatos ni sistemas de grabación',()=>{
  assert.match(timeline,/F\.addFilmNode\(nodeId\)/)
  assert.match(timeline,/M\.addLayer\(film\.value, 'text'/)
  assert.match(timeline,/M\.addAudioTrack\(/)
  assert.match(timeline,/F\.createFilmEditorialShot\(/)
  assert.match(filmApp,/createFilmMobileLink/)
})
