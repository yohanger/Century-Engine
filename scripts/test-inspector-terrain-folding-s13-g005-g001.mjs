// LF-INSPECTOR-TERRAIN-FOLDING-S13-G005-G001 · Estructura y compatibilidad del Inspector de Terreno.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {spawnSync} from 'node:child_process'
const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8')
const terrain = read('src/components/TerrainPanel.vue')
const inspector = read('src/components/Inspector.vue')
const dock = read('src/components/InspectorDock.vue')
const styles = read('src/styles.css')
const ids = ['terrain-pieces','terrain-water','terrain-brush','terrain-layers','terrain-foliage','terrain-generator','terrain-size']
const matches=[...terrain.matchAll(/<section\b[^>]*class="sect terrain-sect(?: generator)?"[^>]*data-fold-id="([^"]+)"[^>]*>/g)]
const foldCode=dock.slice(dock.indexOf('// Reutiliza inspFold con identidad semántica'),dock.indexOf('// Las cabeceras que Vue reutiliza también cambian de contexto'))
function folding(folds={}){
 const attrs={}, classes=new Set(['sect','terrain-sect']);const parent={children:[]}
 const section={dataset:{foldId:ids[0]},parentElement:parent,classList:{contains:k=>classes.has(k),toggle(k,v){if(v)classes.add(k);else classes.delete(k)}}}
 parent.children=[section]
 const header={parentElement:section,childNodes:[{nodeType:3,textContent:'Piezas de terreno'}],textContent:'Piezas de terreno',
   closest:selector=>selector==='.insp'?{dataset:{nodeType:'terrain'}}:selector==='.sect > header'?header:null,
   setAttribute:(k,v)=>{attrs[k]=v}}
 const store={prefs:{inspFold:{...folds}},projSel:null,temporalSelection:null,audioInspector:null,sceneSel:false,project:{terrain:{enabled:true}}}
 const root={value:{querySelectorAll:()=>[header]}}
 const api=runInNewContext(foldCode+'\n;({keyOf,applyFolds,toggleFold,onFold,onFoldKey})',{store,root,tab:{value:'object'}})
 return {store,root,api,section,header,classes,attrs}
}

test('TERR-FOLD-01 · siete apartados, IDs explícitos y orden de UI preservado',()=>{
 assert.deepEqual(matches.map(x=>x[1]),ids)
 assert.equal(new Set(matches.map(x=>x[1])).size,7)
})
test('TERR-FOLD-02 · siete encabezados y cuerpos directos, con cierre propio',()=>{
 const parts=terrain.split(/<section\b[^>]*class="sect terrain-sect/).slice(1)
 assert.equal(parts.length,7)
 for (const part of parts){assert.match(part,/^.*data-fold-id="terrain-[^\"]+">\s*<header>[\s\S]*?<\/header>\s*<div class="body">/);assert.match(part,/\n      <\/div>\n    <\/section>/)}
})
test('TERR-FOLD-03 · la selección Terrain usa el único Inspector contextual',()=>{
 assert.match(inspector,/<TerrainPanel v-if="obj\.type === 'terrain'" data-testid="terrain-context-inspector"/)
 assert.match(inspector,/:data-node-type="obj\?\.type \|\| 'scene'"/)
 assert.match(dock,/root\.value\?\.querySelectorAll\('\.sect > header'\)/)
})
test('TERR-FOLD-04 · plegado reutiliza inspFold con contexto node:terrain sin nueva autoridad',()=>{
 const h=folding();assert.equal(h.api.keyOf(h.header),'fold:node:terrain:terrain-pieces')
 h.api.applyFolds();assert.equal(h.attrs['aria-expanded'],'true');assert.equal(h.attrs.role,'button');assert.equal(h.attrs.tabindex,'0')
 h.api.toggleFold(h.header);assert.equal(h.store.prefs.inspFold['fold:node:terrain:terrain-pieces'],true)
 assert.equal(h.attrs['aria-expanded'],'false')
 h.api.toggleFold(h.header);assert.equal(h.attrs['aria-expanded'],'true')
})
test('TERR-FOLD-05 · prefs existentes son no destructivas; no se reescribe proyecto',()=>{
 const h=folding({'fold:node:terrain:terrain-pieces':true,'fold:node:primitive:transform':true})
 const before=JSON.stringify(h.store.project);h.api.applyFolds()
 assert.equal(h.attrs['aria-expanded'],'false');h.api.toggleFold(h.header)
 assert.equal(JSON.stringify(h.store.project),before)
 assert.equal(h.store.prefs.inspFold['fold:node:primitive:transform'],true)
})
test('TERR-FOLD-06 · cambiar entre tipos no contamina los estados',()=>{
 const h=folding({'fold:node:terrain:terrain-pieces':true})
 h.api.applyFolds();assert.equal(h.attrs['aria-expanded'],'false')
 h.header.closest=sel=>sel==='.insp'?{dataset:{nodeType:'primitive'}}:sel==='.sect > header'?h.header:null
 h.api.applyFolds();assert.equal(h.attrs['aria-expanded'],'true')
})
test('TERR-FOLD-07 · Enter y Espacio pliegan; otras teclas no',()=>{
 const h=folding();h.api.applyFolds();let n=0
 for(const key of ['Enter',' '])h.api.onFoldKey({key,target:h.header,preventDefault:()=>n++})
 assert.equal(n,2);assert.equal(h.attrs['aria-expanded'],'true')
 h.api.onFoldKey({key:'Escape',target:h.header,preventDefault:()=>n++});assert.equal(n,2)
})
test('TERR-FOLD-08 · acción de visibilidad del encabezado no pliega y sigue cambiando la vista',()=>{
 const h=folding();h.api.applyFolds()
 const b={closest:q=>q==='.sect > header'?h.header:q.includes('button')?b:null}
 h.api.onFold({target:b})
 assert.equal(h.attrs['aria-expanded'],'true');assert.equal(Object.keys(h.store.prefs.inspFold).length,0)
 const v=terrain.match(/<header>Vegetación[\s\S]*?<\/header>/)?.[0]
 assert.ok(v);assert.match(v,/@click\.stop="store\.view\.foliage = !store\.view\.foliage"/)
 assert.match(v,/aria-label="Mostrar u ocultar vegetación"/)
})
test('TERR-FOLD-09 · accesibilidad proviene del único delegado existente',()=>{
 assert.match(dock,/header\.setAttribute\('role', 'button'\)/)
 assert.match(dock,/header\.setAttribute\('tabindex', '0'\)/)
 assert.match(dock,/header\.setAttribute\('aria-expanded'/)
 assert.match(dock,/@click="onFold" @keydown="onFoldKey"/)
})
test('TERR-FOLD-10 · cierre oculta controles por CSS global reutilizado',()=>{
 assert.match(styles,/\.sect\.closed > :not\(header\) \{ display: none !important; \}/)
 assert.equal((terrain.match(/<div class="body">/g)||[]).length,7)
})
test('TERR-FOLD-11 · avisos críticos de costa y resolución visibles en encabezados',()=>{
 assert.match(terrain,/<header>Terrain Generator <span v-if="[^"]+" class="terrain-alert">Costa heredada<\/span><\/header>/)
 assert.match(terrain,/<header>Tamaño <span v-if="heavy" class="terrain-alert">Resolución alta<\/span><\/header>/)
 assert.match(terrain,/class="hint keep">Older coastline detected/)
 assert.match(terrain,/class="hint keep">Legacy coastal terrain detected/)
 assert.match(terrain,/v-if="heavy" class="hint warn"/)
})
test('TERR-FOLD-12 · no elimina los siete controles ni el estado original',()=>{
 for(const str of ['selectPiece(q.id)','waterSimToggle($event.target.checked)','pickTool(b.id)','addLayer','store.view.foliage','generate','applySize','commitTerrain','commitFoliageEdit']) assert.ok(terrain.includes(str),str)
})
test('TERR-FOLD-13 · CA UX-02: documentación retirada y avisos críticos conservados',()=>{
 assert.doesNotMatch(terrain,/Arrastra los cuatro tiradores naranjas/)
 assert.match(terrain,/Más de 512 segmentos es pesado/)
 assert.match(terrain,/max-height: 150px; overflow: auto/)
 assert.doesNotMatch(terrain,/localStorage|document\.querySelector|<Teleport|<dialog/)
})
test('TERR-FOLD-14 · sección sin terreno conserva alta de Terrain',()=>{
 assert.match(terrain,/<section v-if="!terrainOn\(\)">/)
 assert.match(terrain,/@click="addTerrain"/)
})
test('TERR-FOLD-15 · la tipografía y espaciado usan los estilos de las secciones existentes',()=>{
 assert.match(terrain,/\.terrain-sect > header/)
 assert.match(terrain,/\.terrain-sect > \.body/)
 assert.match(styles,/\.sect > header/)
})
test('TERR-FOLD-16 · fixture Electron comprueba exactamente las verificaciones declaradas',()=>{
 const html=read('scripts/fixtures/editor/inspector-terrain-folding-s13-g005-g001.html')
 const run=read('scripts/test-inspector-terrain-folding-s13-g005-g001-electron.mjs')
 const count=(html.match(/\bcheck\('/g)||[]).length
 assert.ok(count>=24)
 assert.match(html,new RegExp(`checks\\.length===${count}`))
 assert.match(run,new RegExp(`minChecks:${count}`))
})
test('TERR-FOLD-17 · scripts JavaScript de fixture y runner son sintácticamente válidos',()=>{
 for(const path of ['scripts/test-inspector-terrain-folding-s13-g005-g001-electron.mjs']){
  const r=spawnSync(process.execPath,['--check',new URL('../'+path,import.meta.url).pathname],{encoding:'utf8'});assert.equal(r.status,0,r.stderr)
 }
 const html=read('scripts/fixtures/editor/inspector-terrain-folding-s13-g005-g001.html')
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
 assert.equal(scripts.length,2,'La fixture debe contener exactamente el bootstrap clásico y el módulo')
 assert.equal(scripts.filter(m=>/\btype=["']module["']/.test(m[1])).length,1)
 assert.equal(scripts.filter(m=>!/\btype=["']module["']/.test(m[1])).length,1)
 for (const [,attrs,js] of scripts){
  const mode=/\btype=["']module["']/.test(attrs)?'module':'commonjs'
  assert.ok(js.trim(),`Bloque ${mode} vacío`)
  const r=spawnSync(process.execPath,[`--input-type=${mode}`,'--check'],{encoding:'utf8',input:js})
  assert.equal(r.status,0,`Error de sintaxis en <script ${attrs.trim()}>: ${r.stderr}`)
 }
})
test('TERR-FOLD-18 · la regresión detecta paréntesis faltante en bootstrap clásico',()=>{
 const html=read('scripts/fixtures/editor/inspector-terrain-folding-s13-g005-g001.html')
 const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
 assert.ok(js)
 const broken=js.replace("new Error('Promesa rechazada')))","new Error('Promesa rechazada'))")
 assert.notEqual(js,broken,'La mutación debe invalidar el bloque de bootstrap')
 const r=spawnSync(process.execPath,['--input-type=commonjs','--check'],{encoding:'utf8',input:broken})
 assert.notEqual(r.status,0,'La validación debe rechazar exactamente el fallo reportado por el usuario')
 assert.match(r.stderr,/SyntaxError|missing \)/)
})
test('TERR-FOLD-19 · la fixture mantiene las 37 comprobaciones y comunica fallos',()=>{
 const html=read('scripts/fixtures/editor/inspector-terrain-folding-s13-g005-g001.html')
 const runner=read('scripts/test-inspector-terrain-folding-s13-g005-g001-electron.mjs')
 assert.equal((html.match(/\bcheck\('/g)||[]).length,37)
 assert.match(html,/checks\.length===37&&checks\.every\(c=>c\.pass\)/)
 assert.match(runner,/minChecks:37/)
 assert.match(html,/window\.__lfTerrainFoldQA=\{check,finish,progress\}/)
 assert.match(html,/window\.addEventListener\('error'/)
 assert.match(html,/window\.addEventListener\('unhandledrejection'/)
})
