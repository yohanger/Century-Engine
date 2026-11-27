// LF-INSPECTOR-GLOBAL-FOLDING-S13-G002 · Contrato funcional del plegado existente.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const dock = read('src/components/InspectorDock.vue')
const inspector = read('src/components/Inspector.vue')
const styles = read('src/styles.css')
const code = dock.slice(dock.indexOf('// Reutiliza inspFold con identidad semántica'), dock.indexOf('// Las cabeceras que Vue reutiliza también cambian de contexto'))
assert.ok(code.length > 2000, 'Debe evaluarse la misma lógica que InspectorDock.vue')
function harness({ nodeType='primitive', label='Transformación', sectionId='transform', folds={}, kind=null, tab='object' } = {}) {
  const attrs = {}, classes = new Set(['sect'])
  const parent = { children: [], classList: { contains: key => classes.has(key) } }
  const section = { dataset: { ...(sectionId ? {foldId:sectionId} : {}) }, parentElement: parent,
    classList:{contains:k=>classes.has(k),toggle(k,v){if(v)classes.add(k);else classes.delete(k)}} }
  parent.children=[section]
  const header={ parentElement:section, childNodes:[{nodeType:3,textContent:label}],textContent:label,
    closest: selector=>selector==='.insp'? (nodeType? {dataset:{nodeType}}:null) : null,
    setAttribute:(name,value)=>{attrs[name]=value} }
  const store={ prefs:{inspFold:{...folds}}, projSel:kind?{kind,id:'resource-1'}:null, temporalSelection:null,
    audioInspector:null, sceneSel:false }
  const pane={value:tab}
  const root={value:{querySelectorAll:()=>[header]}}
  const api=runInNewContext(code+'\n;({foldContext,foldId,keyOf,legacyKeyOf,applyFolds,toggleFold,onFold,onFoldKey})', {store,tab:pane,root})
  return {store,pane,root,section,header,attrs,api,classes}
}

test('FOLD-01 · identidades semánticas no dependen de traducciones ni nombre del nodo',()=>{
  const h=harness()
  assert.equal(h.api.keyOf(h.header),'fold:node:primitive:transform')
  h.header.textContent='Traslación';h.header.childNodes[0].textContent='Traslación'
  assert.equal(h.api.keyOf(h.header),'fold:node:primitive:transform')
})
test('FOLD-02 · las secciones del nodo declaran ID estable; Prefab comparte ID en ramas excluyentes',()=>{
  const matches=[...inspector.matchAll(/<section\b[^>]*\bclass="sect(?: [^"]*)?"[^>]*>/g)]
  assert.equal(matches.length,40)
  const ids=matches.map(m=>m[0].match(/\bdata-fold-id="([^"]+)"/)?.[1])
  assert.ok(ids.every(Boolean));assert.equal(ids.filter(id=>id==='prefab').length,2)
  assert.equal(new Set(ids).size,39)
  for(const id of ['transform','node-properties','scripts','materials','mesh','camera','light','collision-shape'])assert.ok(ids.includes(id),id)
})
test('FOLD-03 · la migración antigua de nodos es no destructiva y conserva el título histórico',()=>{
  const h=harness({folds:{'primitive:Transformación':true}})
  h.api.applyFolds()
  assert.equal(h.attrs['aria-expanded'],'false')
  assert.equal(h.store.prefs.inspFold['fold:node:primitive:transform'],true)
  assert.equal(h.store.prefs.inspFold['primitive:Transformación'],true)
  h.header.textContent='Traslación';h.header.childNodes[0].textContent='Traslación'
  h.api.applyFolds()
  assert.equal(h.attrs['aria-expanded'],'false')
})
test('FOLD-04 · no migra ni altera preferencias cuando no existe una clave antigua',()=>{
  const h=harness();h.api.applyFolds()
  assert.deepEqual(h.store.prefs.inspFold,{})
  assert.equal(h.attrs['aria-expanded'],'true');assert.equal(h.attrs.role,'button');assert.equal(h.attrs.tabindex,'0')
})
test('FOLD-05 · dos tipos de nodo no comparten estado de plegado',()=>{
  const h=harness();h.api.applyFolds();h.api.toggleFold(h.header)
  assert.equal(h.store.prefs.inspFold['fold:node:primitive:transform'],true)
  h.header.closest=selector=>selector==='.insp'?{dataset:{nodeType:'camera'}}:null
  h.api.applyFolds();assert.equal(h.attrs['aria-expanded'],'true')
  h.header.closest=selector=>selector==='.insp'?{dataset:{nodeType:'primitive'}}:null
  h.api.applyFolds();assert.equal(h.attrs['aria-expanded'],'false')
})
test('FOLD-06 · editor de recursos distingue familias sin incorporar ID mutable',()=>{
  const h=harness({kind:'material',nodeType:null,sectionId:null,label:'Ajustes'})
  assert.equal(h.api.keyOf(h.header),'fold:resource:material:section-1')
  h.store.projSel={kind:'profile',id:'same-id'}
  assert.equal(h.api.keyOf(h.header),'fold:resource:profile:section-1')
})
test('FOLD-07 · las preferencias ambiguas resource:* se asignan a una sola familia',()=>{
  const h=harness({kind:'material',nodeType:null,sectionId:null,label:'Opciones',folds:{'resource:Opciones':true}})
  h.api.applyFolds();assert.equal(h.attrs['aria-expanded'],'false')
  assert.equal(h.store.prefs.inspFold['fold:legacy-owner:resource:Opciones'],'resource:material')
  assert.equal(h.store.prefs.inspFold['resource:Opciones'],true)
  h.store.projSel={kind:'profile',id:'other-resource'}
  h.api.applyFolds();assert.equal(h.attrs['aria-expanded'],'true')
  assert.equal(h.store.prefs.inspFold['fold:resource:profile:section-1'],undefined)
  h.store.projSel={kind:'material',id:'new-resource'}
  h.api.applyFolds();assert.equal(h.attrs['aria-expanded'],'false')
})
test('FOLD-08 · pestañas Malla, Pintura y Señales no comparten estados',()=>{
  const h=harness({nodeType:null,sectionId:null})
  for(const pane of ['mesh','paint','signals']){h.pane.value=pane;assert.equal(h.api.keyOf(h.header),`fold:pane:${pane}:section-1`)}
})
test('FOLD-09 · clic en encabezado e icono pliega sin duplicar gestores',()=>{
  const h=harness();h.api.applyFolds()
  const direct={closest:selector=>selector==='.sect > header'||selector.includes('[role="button"]')?h.header:null}
  h.api.onFold({target:direct});assert.equal(h.attrs['aria-expanded'],'false')
  h.api.onFold({target:direct});assert.equal(h.attrs['aria-expanded'],'true')
})
test('FOLD-10 · botones internos y campos no disparan plegado accidental',()=>{
  const h=harness();h.api.applyFolds()
  const button={closest:selector=>selector==='.sect > header'?h.header:selector.includes('button')?button:null}
  h.api.onFold({target:button});assert.equal(h.attrs['aria-expanded'],'true')
  assert.deepEqual(h.store.prefs.inspFold,{})
})
test('FOLD-11 · Enter/Espacio operan el encabezado, no los controles hijos',()=>{
  const h=harness();h.api.applyFolds()
  h.header.closest=selector=>selector==='.sect > header'?h.header:selector==='.insp'?{dataset:{nodeType:'primitive'}}:null
  let prevented=0
  h.api.onFoldKey({key:'Enter',target:h.header,preventDefault:()=>prevented++})
  assert.equal(h.attrs['aria-expanded'],'false')
  h.api.onFoldKey({key:' ',target:h.header,preventDefault:()=>prevented++})
  assert.equal(h.attrs['aria-expanded'],'true')
  h.api.onFoldKey({key:'Escape',target:h.header,preventDefault:()=>prevented++})
  assert.equal(prevented,2)
})
test('FOLD-12 · la acción solo escribe prefs y no cambia los datos del proyecto',()=>{
  const h=harness();h.store.project={name:'QA',objects:[{id:'x',scale:[1,1,1]}]}
  const original=JSON.stringify(h.store.project)
  h.api.applyFolds();h.api.toggleFold(h.header)
  assert.equal(JSON.stringify(h.store.project),original)
})
test('FOLD-13 · sección con data-testid previo conserva identidad estable como fallback',()=>{
  const h=harness({sectionId:null});h.section.dataset.testid='collision-shape-inspector'
  assert.equal(h.api.foldId(h.header),'collision-shape-inspector')
})
test('FOLD-14 · no introduce un segundo componente, plugin de tooltips ni cambios de Player',()=>{
  assert.match(dock,/store\.prefs\.inspFold/)
  assert.match(dock,/\.sect > header/)
  assert.match(dock,/@click="onFold"/)
  assert.match(dock,/@keydown="onFoldKey"/)
  assert.match(styles,/\.sect\.closed > :not\(header\)/)
  assert.doesNotMatch(code,/localStorage|serviceLocator|document\.querySelector\(/)
})
test('FOLD-15 · los scripts Vue conservan sintaxis y los IDs de claves anteriores',()=>{
  assert.match(dock,/header\.textContent\.trim\(\)\.slice\(0, 40\)/)
  assert.match(dock,/const key = keyOf\(header\)/)
  assert.match(dock,/return `\$\{context\}:\$\{label\}`/)
  assert.match(dock,/const tab = computed/)
})
test('FOLD-16 · fixture Electron exige exactamente sus 23 verificaciones reales',()=>{
  const html=read('scripts/fixtures/editor/inspector-global-folding-s13-g002.html')
  const runner=read('scripts/test-inspector-global-folding-s13-g002-electron.mjs')
  assert.equal((html.match(/\bcheck\('/g)||[]).length,23)
  assert.match(html,/checks\.length===23/)
  assert.match(runner,/minChecks:23/)
})
test('FOLD-17 · el contexto de Audio Mixer no se confunde con recursos generales',()=>{
  const h=harness({nodeType:'scene',kind:null,sectionId:'fx'})
  h.store.audioInspector={groupId:'master'}
  assert.equal(h.api.keyOf(h.header),'fold:resource:audio-mixer:fx')
  h.store.audioInspector=null
  assert.equal(h.api.keyOf(h.header),'fold:node:scene:fx')
})
