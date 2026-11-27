// S13-G005-G002 · Limpieza visual Terrain + CA-TRANSFORM-S-OBJECTMODE-001.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {spawnSync} from 'node:child_process'
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')
const terrain = read('src/components/TerrainPanel.vue')
const keys = read('src/core/editor/keys.js')
const template = terrain.slice(terrain.indexOf('<template>'),terrain.lastIndexOf('</template>') + '</template>'.length)
const css = terrain.split('<style scoped>')[1].split('</style>')[0]
const ids = ['pieces','water','brush','layers','foliage','generator','size']
const obsolete = [
 'Arrastra los cuatro tiradores naranjas', 'Arrastra las flechas del visor',
 'Activa para crear una región física', 'Solo entre dominios explícitos',
 'Haz clic y arrastra de', 'activa el pincel', 'También puedes arrastrar una textura',
 'Radio y fuerza son los del pincel', 'Island and Bay generate complete',
 'Elevation uses seeded ridges', 'Sea Level defines terrain elevation',
 'Escribe cualquier valor', 'Los perfiles de capa se mezclan según la pintura',
]
function mockKeyboard({edit=null}={}) {
 const handlers={};const metrics={save:0,editing:[],prevented:0}
 const win={addEventListener:(name,fn)=>{(handlers[name]??=[]).push(fn)},removeEventListener(){}}
 const doc={hidden:false,addEventListener(){},removeEventListener(){}}
 const store={locked:false,play:{on:false},modal:null,palette:false,project:{objects:[]},tool:'select',gizmo:'none',space:'world',selectedId:'node-1',selectedIds:['node-1'],roadPaint:{active:false},view:{grid:true},prefs:{}}
 const src=keys.slice(keys.indexOf('  _bindKeys() {'),keys.indexOf('  // =================== watchers ==================='))
 assert.ok(src.includes('_bindKeys() {'))
 const ctx={win,doc,store,saveAll:()=>{metrics.save++},hasTool:()=>false,toast:()=>{},tool:()=>({})}
 const impl=runInNewContext('({'+src+'})',ctx)
 const editor={vp:{isFlying:false},edit,paint:null,_setSnapShiftHeld(){},_numpad:()=>false}
 impl._bindKeys.call(editor)
 const send=(key,options={})=>{
  const e={key,code:options.code||`Key${key.toUpperCase()}`,ctrlKey:!!options.ctrlKey,metaKey:!!options.metaKey,altKey:false,shiftKey:false,target:{tagName:'DIV'},preventDefault:()=>metrics.prevented++,stopPropagation(){}}
  for(const cb of handlers.keydown||[])cb(e)
 }
 return {send,store,metrics,editor}
}
test('CLEAN-01 · se conservan siete secciones y los identificadores aprobados',()=>{
 for(const id of ids)assert.match(template,new RegExp(`data-fold-id="terrain-${id}"`))
 assert.equal((template.match(/class="sect terrain-sect/g)||[]).length,7)
})
test('CLEAN-02 · no persisten textos de tutorial en el Inspector',()=>{
 for(const token of obsolete)assert.ok(!template.includes(token),token)
 assert.doesNotMatch(template,/<p[^>]+class="hint lf-help"/)
})
test('CLEAN-03 · métricas dinámicas de pieza, agua y resolución siguen visibles',()=>{
 for(const metric of ['active?.segments + 1','sim.regions.length','simCells','verts.toLocaleString'])assert.ok(template.includes(metric),metric)
})
test('CLEAN-04 · conserva advertencias de costa heredada, relieve y alto coste',()=>{
 for(const token of ['Older coastline detected','Legacy coastal terrain detected','Más de 512 segmentos','Costa heredada','Resolución alta'])assert.ok(template.includes(token),token)
})
test('CLEAN-05 · Generate muestra advertencia destructiva sin convertirse en un tutorial',()=>{
 assert.match(template,/<p class="hint warn">Generate reemplaza las alturas de la pieza/)
})
test('CLEAN-06 · los controles de hidrología y desplazamiento no dependen de tooltips',()=>{
 assert.match(template,/class="chk"[^>]*>\s*<input type="checkbox" :checked="sim\.displacement/)
 assert.match(template,/class="chk"[^>]*>\s*<input type="checkbox" :checked="hydroOn"/)
 assert.match(template,/class="chk"[^>]*>\s*<input type="checkbox" :checked="runoffOn"/)
 assert.doesNotMatch(template,/class="newslot lf-help"/)
})
test('CLEAN-07 · el scroll se limita a las listas de capas, vegetación y conexiones',()=>{
 assert.match(template,/terrain-scroll-list--long': layers\.length >= 6/)
 assert.match(template,/terrain-scroll-list--long': fol\.length >= 6/)
 assert.match(template,/terrain-scroll-list--long': \(sim\.couplings\?\.length \|\| 0\) >= 4/)
 assert.match(css,/\.terrain-scroll-list--long \{ max-height: 280px; overflow-y: auto;/)
})
test('CLEAN-08 · selección, edición y drag/drop permanecen conectados',()=>{
 for(const token of ['@click="selectPiece(q.id)"','renamePiece(active.id','dropTexture($event, i)','@change="layerChange(true)"','@click="pickFoliage(f.id)"','@drop="dropSlot($event, f.id)"','@click="addLayer"','@click="generate"','@click="applySize"'])assert.ok(template.includes(token),token)
})
test('CLEAN-09 · separaciones mejoradas y adaptación a paneles estrechos',()=>{
 assert.match(css,/\.terrain-sect > \.body \{ padding: 12px 14px 14px;/)
 assert.match(css,/\.row \{[^}]+margin-bottom: 8px; min-height: 28px;/)
 assert.match(css,/@container \(max-width: 290px\)/)
})
test('CLEAN-10 · S en Object Mode no inicializa escala ni HUD modal',()=>{
 assert.doesNotMatch(keys,/case 's':|_uniformScaleDraft|_uniformScaleKey|_endUniformScale|uniformScaleHud|beginUniformScale/)
})
test('CLEAN-11 · S no cambia herramienta ni proyecto en Object Mode',()=>{
 const h=mockKeyboard(),old=JSON.stringify(h.store)
 h.send('s');assert.equal(JSON.stringify(h.store),old);assert.equal(h.metrics.prevented,0)
})
test('CLEAN-12 · S sigue delegándose al módulo Edit Mesh',()=>{
 const edit={modal:null,onKey:e=>{if(e.key==='s'){return true}return false}}
 const h=mockKeyboard({edit});h.send('s');assert.equal(h.metrics.prevented,1)
 assert.match(read('src/core/mesh/session-modal.js'),/Factor de escala inválido/)
})
test('CLEAN-13 · R mantiene gizmo de escala y Ctrl+S guarda',()=>{
 const h=mockKeyboard();h.send('r');assert.equal(h.store.gizmo,'scale');h.send('s',{ctrlKey:true});assert.equal(h.metrics.save,1)
})
test('CLEAN-14 · preserva transformación numérica del Inspector',()=>{
 const src=read('src/components/Inspector.vue')
 assert.match(src,/data-testid="uniform-scale-inspector"/)
 assert.match(src,/beginUniformScale\(\[obj\.value\?\.id\]/)
})
test('CLEAN-15 · no cambia fuentes de física, agua ni Player',()=>{
 assert.doesNotMatch(keys,/new .*Manager|new WebAssembly|create.*Engine/)
 assert.doesNotMatch(template,/<Teleport|<dialog/)
})
test('CLEAN-16 · ningún script del Gate contiene errores sintácticos',()=>{
 for (const f of ['src/core/editor/keys.js','scripts/test-transform-uniform-scale-s04-g001.mjs','scripts/test-editor-top-hud-layout-corr-g001.mjs','scripts/test-inspector-terrain-cleanup-s13-g005-g002-electron.mjs']) {
  const r=spawnSync(process.execPath,['--check',new URL('../'+f,import.meta.url).pathname],{encoding:'utf8'});assert.equal(r.status,0,`${f}: ${r.stderr}`)
 }
})
test('CLEAN-17 · fixture Electron declara recuento verificable',()=>{
 const html=read('scripts/fixtures/editor/inspector-terrain-cleanup-s13-g005-g002.html')
 const runner=read('scripts/test-inspector-terrain-cleanup-s13-g005-g002-electron.mjs')
 const checks=(html.match(/\bcheck\('/g)||[]).length
 assert.ok(checks>=42,checks)
 assert.match(html,new RegExp(`checks\\.length===${checks}`))
 assert.match(runner,new RegExp(`minChecks:${checks}`))
})
