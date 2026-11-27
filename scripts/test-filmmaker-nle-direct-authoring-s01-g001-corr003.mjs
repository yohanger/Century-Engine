import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const load = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const keys = load('../src/core/editor/keys.js')
const main = load('../src/filmmaker/main.js')
const registry = load('../src/tools-register.js')
const timeline = load('../src/filmmaker/NleTimeline.vue')
const filmCss = load('../src/filmmaker/film-ux.css')
const app = load('../src/filmmaker/FilmApp.vue')
const nodeTracks = load('../src/filmmaker/node-tracks.js')
const session = load('../src/filmmaker/session.js')

function extractFunction(source,name) {
  const index = source.indexOf(`function ${name}(`)
  assert.ok(index >= 0, `No existe ${name}`)
  const start = source.indexOf('{',index)
  let depth = 0, end = -1
  for(let i=start;i<source.length;i++) {
    const c=source[i]
    if(c==='{')depth++
    if(c==='}' && !--depth) {end=i+1;break}
  }
  assert.ok(end > start, `No cierra ${name}`)
  return source.slice(index,end)
}

test('CORR003-01 · FilmMaker no registra commands por diseño; sus atajos no pueden lanzarlo', () => {
  assert.match(main,/registerCaptureFilm\(\)/)
  assert.match(registry,/registerTools\(\{ mesh: meshTools, commands: commandTools \}\)/)
  assert.match(keys,/import \{ hasTool, tool \} from '\.\.\/tools\.js'/)
  assert.match(keys,/case 'a': if \(e\.shiftKey && hasTool\('commands'\)\)/)
  assert.doesNotMatch(keys,/case 'a': if \(e\.shiftKey\) \{ e\.preventDefault\(\); tool\('commands'\)/)
})

test('CORR003-02 · edición de mallas separada y registro de comandos original no modificado', () => {
  assert.match(registry,/export function registerEditorTools\(\)/)
  assert.match(main,/registerCaptureFilm\(\)/)
  assert.match(load('../src/main.js'),/registerEditorTools\(\)/)
})

test('CORR003-03 · + Nodo siempre muestra selector por Teleport sobre los docks recortados', () => {
  assert.match(timeline, /ref="nodeButton"[^>]+data-test="node-add"/)
  assert.match(timeline,/<Teleport to="body">\s*<div v-if="nodeChooser"[^>]+film-node-picker/)
  assert.match(filmCss,/\.film-node-picker \{ z-index:5000;/)
  assert.match(app,/\.dock \{[^}]*overflow: hidden/)
  assert.match(timeline,/@keydown\.esc\.stop\.prevent="closeNodePicker"/)
})

test('CORR003-04 · posicionamiento mantiene el selector dentro del viewport en el borde inferior', () => {
  const fn=Function('nodeButton','nodePickerStyle','window',extractFunction(timeline,'popupPosition')+';'+extractFunction(timeline,'positionNodePicker')+';return positionNodePicker')
  const button={value:{getBoundingClientRect:()=>({left:760,right:860,top:600,bottom:628})}}
  const style={value:{}}
  fn(button,style,{innerWidth:890,innerHeight:690})()
  assert.equal(style.value.position,'fixed')
  assert.ok(parseInt(style.value.left)+parseInt(style.value.width)<=890)
  assert.ok(parseInt(style.value.top)>=12)
  assert.ok(parseInt(style.value.top)+parseInt(style.value.maxHeight)<=690)
})

test('CORR003-05 · selector puede abrirse sin un nodo seleccionado y enfoca búsqueda', async () => {
  const deps={film:{value:{id:'cinematic'}},session:{playing:false,rec:{state:'idle'},pass:{state:'idle'},montage:{on:false}},nodeChooser:{value:false},nodeFilter:{value:'prev'},
    positionNodePicker:()=>{deps.positioned=true},addChooser:{value:false},F:{stopMontage(){}},toast(){},nextTick:callback=>Promise.resolve().then(callback),nodeFilterInput:{value:{focus(){deps.focused=true}}},closeNodePicker:()=>{deps.nodeChooser.value=false}}
  const open=Function(...Object.keys(deps),extractFunction(timeline,'addSelectedNode')+';return addSelectedNode')(...Object.values(deps))
  open();await Promise.resolve()
  assert.equal(deps.nodeChooser.value,true)
  assert.equal(deps.nodeFilter.value,'')
  assert.equal(deps.positioned,true)
  assert.equal(deps.focused,true)
  open();assert.equal(deps.nodeChooser.value,false)
})

test('CORR003-06 · clic fuera cierra el selector y los clics internos lo conservan',()=>{
  const outside={}
  const parent={contains:target=>target==='button'}
  const picker={contains:target=>target==='list'}
  const data={nodeChooser:{value:true},nodePicker:{value:picker},nodeButton:{value:parent},addChooser:{value:false},addPicker:{value:null},addButton:{value:null}}
  const close=Function(...Object.keys(data),extractFunction(timeline,'closeNodePickerOutside')+';return closeNodePickerOutside')(...Object.values(data))
  close({target:'list'});assert.equal(data.nodeChooser.value,true)
  close({target:'button'});assert.equal(data.nodeChooser.value,true)
  close({target:outside});assert.equal(data.nodeChooser.value,false)
})

test('CORR003-07 · lista real usa nodos elegibles y cámaras editoriales, sin crear modelos paralelos',()=>{
  assert.match(timeline,/availableNodes = computed/)
  assert.match(timeline,/filmNodeAnimationAllowed\(o, session\.film\?\.actor\?\.objectId\)/)
  assert.match(timeline,/availableFilmCameras = computed/)
  assert.match(timeline,/F\.addFilmNode\(nodeId\)/)
  assert.match(timeline,/addEditorialShot\(cam\.id\)/)
  assert.match(nodeTracks,/export function filmNodeAnimationAllowed/)
  assert.match(session,/export function addFilmNode\(nodeId\)/)
})

test('CORR003-08 · Inspector y editor de clips original permanecen vinculados',()=>{
  assert.match(app,/:inspector-target="filmClipInspectorTarget"/)
  assert.match(app,/filmInspectorHost/)
  assert.match(timeline,/<Teleport :to="inspectorTarget \|\| 'body'" :disabled="!inspectorTarget">/)
  assert.match(timeline,/data-test="nle-props"/)
})

test('CORR003-09 · sin modificación de grabación móvil, Cinematics ni Player',()=>{
  assert.match(main,/MobileCapabilities/)
  assert.match(app,/createFilmMobileLink/)
  assert.match(app,/await F\.openNativeFilm\(result, projectId, cinematicId\)/)
  assert.match(session,/export async function openNativeFilm\(/)
})


test('CORR003-10 · menú contextual de malla sin herramienta registrada no dispara excepción',()=>{
  const mesh=load('../src/core/editor/meshedit.js')
  assert.match(mesh,/import \{ hasTool, tool \} from '\.\.\/tools\.js'/)
  assert.match(mesh,/if \(!hasTool\('commands'\)\) \{ toast\('Las operaciones de malla pertenecen al editor principal'/)
  assert.match(mesh,/const menuItems = tool\('commands'\)\.items/)
})
