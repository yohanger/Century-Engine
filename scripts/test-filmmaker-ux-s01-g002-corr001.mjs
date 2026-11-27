import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const read = (file) => readFileSync(new URL('../'+file, import.meta.url), 'utf8')
const app=read('src/filmmaker/FilmApp.vue')
const nle=read('src/filmmaker/NleTimeline.vue')
const css=read('src/filmmaker/film-ux.css')
const originalNle=read('src/filmmaker/NleTimeline.vue')
const extract = (source, name) => {
  const hit=source.indexOf('function '+name+'(')
  assert.ok(hit>=0,`Función ${name} presente`)
  let start=source.indexOf('{',hit), level=0
  for(let i=start;i<source.length;i++) {
    if(source[i]==='{')level++
    if(source[i]==='}' && --level===0) return source.slice(hit,i+1)
  }
  throw Error('Función truncada '+name)
}
test('FILM-CORR-01 · el entorno compacto se activa en 1024 y 820, no en 1280',()=>{
  assert.match(app,/screenW\.value < 1220/)
  assert.match(app,/screenW\.value < 820/)
  assert.match(app,/:class="\{ compactDesk \}"/)
})
test('FILM-CORR-02 · abrir un dock cierra el otro en anchuras reducidas',()=>{
  const leftOpen={value:false},rightOpen={value:true}
  const toggle=new Function('leftOpen','rightOpen',extract(app,'toggleDock')+';return toggleDock')(leftOpen,rightOpen)
  toggle('left');assert.equal(leftOpen.value,true);assert.equal(rightOpen.value,false)
  toggle('right');assert.equal(leftOpen.value,false);assert.equal(rightOpen.value,true)
  toggle('right');assert.equal(rightOpen.value,false)
})
test('FILM-CORR-03 · ambos docks y sus splitters dependen de visibilidad real',()=>{
  assert.match(app,/film && !narrow && visibleLeft/)
  assert.match(app,/film && !narrow && visibleRight/)
  assert.match(app,/data-test="toggle-scene"/)
  assert.match(app,/data-test="toggle-inspector"/)
  assert.match(app,/:aria-pressed="visibleLeft"/)
  assert.match(app,/:aria-pressed="visibleRight"/)
  assert.match(app,/ref="workspace"/)
})
test('FILM-CORR-04 · panel inferior no puede dejar monitor sin espacio al redimensionar',()=>{
  assert.match(app,/Math\.max\(150, workH.value - 205\)/)
  assert.match(app,/Math\.min\(bottomH.value, bottomMaxH.value\)/)
  assert.match(app,/:max="bottomMaxH"/)
  assert.match(app,/:style="\{ height: effectiveBottomH \+ 'px' \}"/)
  assert.match(app,/workspaceObserver\?\.disconnect/)
})
test('FILM-CORR-05 · propiedades de clips son contextuales, nunca un panel vacío fijo',()=>{
  assert.match(nle,/v-if="sel && showProperties" class="props"/)
  assert.match(nle,/watch\(sel, \(item\) => \{/)
  assert.match(nle,/showProperties\.value = !!item/)
  assert.match(nle,/data-test="close-nle-props"/)
  assert.match(nle,/@click="closeClipProperties"/)
  assert.match(nle,/function closeClipProperties\(\)/)
  assert.doesNotMatch(nle,/\.props\s*\{\s*width:\s*230px/)
  assert.match(nle,/\.props\s*\{\s*position:\s*absolute/)
})
test('FILM-CORR-06 · desplazamiento horizontal identificado, no cuadrado azul ambiguo',()=>{
  for (const token of ['data-test="time-scroll"', 'Desplazar tiempo ↔', 'aria-label="Desplazar horizontalmente las pistas del timeline"', '@input="moveTimeScroll($event.target.value)"']) assert.ok(nle.includes(token),token)
  assert.match(nle, /overflow-x:\s*hidden/)
  assert.match(nle,/scrollMax > 1/)
})
test('FILM-CORR-07 · el rango desplaza el canvas real y alinea cabeceras verticales',()=>{
  const state={scrollLeft:{value:0},scrollMax:{value:0},scroller:{value:{scrollLeft:17,scrollWidth:1000,clientWidth:250,scrollTop:27}},heads:{value:{scrollTop:0}}}
  const {syncScroll,moveTimeScroll}=new Function('scrollLeft','scrollMax','scroller','heads',extract(nle,'syncScroll')+'\n'+extract(nle,'moveTimeScroll')+';return {syncScroll,moveTimeScroll}')(...Object.values(state))
  syncScroll()
  assert.equal(state.scrollLeft.value,17)
  assert.equal(state.scrollMax.value,750)
  assert.equal(state.heads.value.scrollTop,27)
  moveTimeScroll('118')
  assert.equal(state.scroller.value.scrollLeft,118)
  assert.equal(state.scrollLeft.value,118)
})
test('FILM-CORR-08 · las operaciones de montaje y la estructura de pistas no cambian',()=>{
  for (const name of ['togglePlay','stop','split','remove','startDrag','onDrag','endDrag','addShot','addAudioAtHead']) assert.ok(nle.includes(`function ${name}(`) || nle.includes(`async function ${name}(`),name)
  for (const marker of ['data-test="nle-ruler"', 'data-test="nle-play"', 'data-test="nle-props"', 'class="lane v"', 'class="lane t"', 'class="lane f"', 'data-audio-lane']) assert.ok(nle.includes(marker),marker)
})
test('FILM-CORR-09 · CSS adaptable cubre pantallas de trabajo y móviles',()=>{
  for(const rule of ['@media (max-width: 1220px) and (min-width: 820px)', '@media (max-width: 970px) and (min-width: 820px)', '@media (max-height: 640px) and (min-width: 820px)', '.fm.narrow', '.compact-docks']) assert.ok(css.includes(rule),rule)
  assert.match(css, /\.fm \.work\.compactDesk \.center/)
  assert.match(css, /\.fm \.nle \.time-scroll/)
})
test('FILM-CORR-10 · el formato .nfm, los nodos, cámaras y el render no se alteraron',()=>{
  assert.doesNotMatch(read('src/filmmaker/film.js'), /NFM_VERSION|f\.version/)
  assert.match(read('src/filmmaker/frame.js'), /fitFilmFrame/)
  assert.match(app, /<SceneTree/)
  assert.match(app, /<Inspector/)
  assert.match(app, /new Editor\(host.value\)/)
  assert.match(app, /@click="playMain"/)
  assert.match(app, /@click="stopMain"/)
  assert.match(app, /:style="frameStyle"/)
})
