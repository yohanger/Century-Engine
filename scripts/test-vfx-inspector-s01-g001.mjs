// LF-VFX-INSPECTOR-S01-G001 — pruebas del contrato y script real con preview aislada.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {newVfxResource,validateVfxResource} from '../src/engine/runtime/vfx/resource.js'
const read=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8')
const editor=read('src/components/VfxEditor.vue'),dock=read('src/components/InspectorDock.vue')
const app=read('src/App.vue'),assets=read('src/components/ProjectPanel.vue')
const selection=read('src/core/state/vfx.js'),state=read('src/core/state/state.js')
const objects=read('src/core/state/objects.js'),preview=read('src/core/editor/vfx-preview.js')
const scene=read('src/engine/runtime/events/play-tornado.js')
const template=editor.split('<template>')[1]?.split('</template>')[0]||''
const script=editor.match(/<script setup>([\s\S]*?)<\/script>/)?.[1].replace(/^import .*$/gm,'')
assert.ok(script,'Script VFX Inspector existe')
function fixture() {
 const fx=newVfxResource('fx_1','Vapor.vfx'),fx2=newVfxResource('fx_2','Humo.vfx')
 const store={project:{id:'demo',vfx:[fx,fx2],activeSceneId:'s1',assets:[{id:'tex',name:'textura.png',kind:'texture'}]},editor:{vp:{}},play:{on:false},locked:false,modal:null,projSel:{kind:'vfx',id:fx.id},prefs:{rightTab:'object'}}
 const watchFns=[],unmountFns=[],patches=[],commits=[],sessions=[]
 class Session {constructor(host,getResource,onState){this.host=host;this.getResource=getResource;this.onState=onState;this.playing=true;this.disposed=false;this.vp={requestRender(){}};this.simulation={count:1,elapsed:0};this.error='';sessions.push(this)}reset(){this.resetCount=(this.resetCount||0)+1}step(){this.playing=false;this.simulation.elapsed+=1/60}dispose(){this.disposed=true}}
 const deps={computed:fn=>({get value(){return fn()}}),ref:value=>({value}),watch:(_getter,fn)=>watchFns.push(fn),onBeforeUnmount:fn=>unmountFns.push(fn),defineProps:()=>({vfxId:fx.id}),store,updateVfx:(id,patch,{record}={})=>{patches.push([id,patch,record]);const old=store.project.vfx.find(x=>x.id===id);if(!old)throw Error('Recurso ausente');const group=Object.keys(patch)[0];Object.assign(old,validateVfxResource({...old,[group]:{...old[group],...patch[group]}}));return true},finishVfxEdit:id=>{commits.push(id)},IMAGE_EXT:['png'],extOf:name=>name.split('.').at(-1),VfxPreviewSession:Session}
 const result=new Function(...Object.keys(deps),`${script}\nreturn { resource, textures, patch, numeric, vector, curve, confirm, previewActive, playing, active, message, startPreview, stopPreview, toggle, reset, step }`)(...Object.values(deps))
 return {fx,fx2,store,patches,commits,sessions,watchFns,unmountFns,...result}
}
test('VI-01 selección VFX de Assets abre Inspector al primer clic',()=>{
 assert.match(assets,/\['profile', 'material', 'gamemanager', 'liquid', 'vfx'\]/)
 assert.match(assets,/store\.projSel = list\.at\(-1\)/)
 assert.match(dock,/store\.projSel\?\.kind === 'vfx'/)
 assert.match(dock,/:vfx-id="store\.projSel\.id"/)
})
test('VI-02 doble clic reutiliza openVfxEditor y no abre ventana',()=>{
 assert.match(assets,/it\.kind === 'vfx'\) openVfxEditor\(it\.id\)/)
 assert.doesNotMatch(app,/<VfxEditor|import VfxEditor/)
 assert.doesNotMatch(editor,/FloatingEditorWindow|data-window-drag-handle/)
 assert.doesNotMatch(selection,/store\.modal\s*=\s*'vfx'/)
})
test('VI-03 no hay estado duplicado vfxEditId, solo la selección actual',()=>{
 assert.doesNotMatch(state,/vfxEditId/)
 assert.match(selection,/store\.projSel = \{ kind: 'vfx', id \}/)
 assert.match(selection,/store\.prefs\.rightTab = 'object'/)
})
test('VI-04 el editor se monta en el dock original, no otro Inspector',()=>{
 assert.match(dock,/import VfxEditor from '\.\/VfxEditor\.vue'/)
 assert.match(dock,/<Inspector v-else v-show="tab === 'object'"/)
})
test('VI-05 modifica un recurso compartido existente, sin crear duplicados',()=>{
 const f=fixture();f.patch('emission','rate',37)
 assert.equal(f.resource.value.emission.rate,37);assert.equal(f.store.project.vfx.length,2)
 assert.equal(f.patches[0][0],f.fx.id)
})
test('VI-06 números y vectores editan mediante updateVfx con record=false',()=>{
 const f=fixture();f.numeric('emission','rate',25);f.vector('birth','box',1,3)
 assert.equal(f.fx.emission.rate,25);assert.equal(f.fx.birth.box[1],3)
 assert.deepEqual(f.patches.map(x=>x[2]),[false,false])
})
test('VI-07 curvas de evolución usan contrato de historial sin estado paralelo',()=>{
 const f=fixture();const points=[{t:0,value:0.4},{t:1,value:1}]
 f.curve('size',points,false);assert.deepEqual(f.fx.evolution.size,points)
 assert.equal(f.patches.at(-1)[2],false)
})
test('VI-08 finalizar gesto y desmontar liberan el Undo pendiente',()=>{
 const f=fixture();f.confirm();f.unmountFns.forEach(fn=>fn());assert.deepEqual(f.commits,['fx_1','fx_1'])
})
test('VI-09 cambiar de nodo limpia selección de recurso sin borrar definición',()=>{
 assert.match(objects,/\['profile', 'material', 'gamemanager', 'vfx'\]/)
 const f=fixture();f.store.projSel=null;f.watchFns.forEach(fn=>fn());assert.equal(f.store.project.vfx.length,2)
})
test('VI-10 preview es opt-in; seleccionar VFX no mueve cámara ni oculta mundo',()=>{
 const f=fixture();assert.equal(f.sessions.length,0);assert.equal(f.previewActive.value,false)
 assert.doesNotMatch(script,/onMounted\([^)]*new VfxPreviewSession/)
})
test('VI-11 iniciar preview consume el viewport existente solo a petición',()=>{
 const f=fixture();f.startPreview();assert.equal(f.sessions.length,1);assert.equal(f.sessions[0].host,f.store.editor)
 assert.equal(f.previewActive.value,true)
})
test('VI-12 pausa/reanudación y avance paso comparten sesión',()=>{
 const f=fixture();f.toggle();assert.equal(f.sessions.length,1);f.toggle();assert.equal(f.playing.value,false)
 f.step();assert.equal(f.sessions.length,1);f.toggle();assert.equal(f.playing.value,true)
})
test('VI-13 cerrar la preview elimina el callback de su sesión y recursos',()=>{
 const f=fixture();f.startPreview();f.stopPreview();assert.equal(f.sessions[0].disposed,true);assert.equal(f.previewActive.value,false)
 assert.match(preview,/this\.offFrame\?\.\(\)/);assert.match(preview,/restoreEditorView\(this\.view\)/)
})
test('VI-14 cambiar de selección, escena o entrar en Play detiene preview',()=>{
 for(const move of [f=>{f.store.projSel={kind:'material',id:'mat'}},f=>{f.store.project.activeSceneId='s2'},f=>{f.store.play.on=true},f=>{f.store.locked=true},f=>{f.store.modal='script'}]){
  const f=fixture();f.startPreview();move(f);f.watchFns.forEach(fn=>fn());assert.equal(f.sessions[0].disposed,true)
 }
})
test('VI-15 cambio de proyecto conserva identidad y elimina preview antigua',()=>{
 const f=fixture();f.startPreview();f.store.project={...f.store.project};f.watchFns.forEach(fn=>fn());assert.equal(f.sessions[0].disposed,true)
})
test('VI-16 textura mediante ResourceDropSlot reutiliza Assets y guarda por ID',()=>{
 assert.match(editor,/<ResourceDropSlot/)
 assert.match(editor,/:accepted-ids="textures\.map\(t => t\.id\)"/)
 assert.match(editor,/@assign="patch\('appearance','textureId',\$event\)"/)
})
test('VI-17 se conservan cinco categorías y los tres editores de curvas',()=>{
 for(const section of ['emission','birth','movement','appearance','evolution'])assert.match(editor,new RegExp(`'${section}'`))
 assert.equal((editor.match(/<VfxCurveEditor/g)||[]).length,3)
 assert.match(editor,/NumberField label="Capacidad"/)
})
test('VI-18 S02 migra tornadoFlow sin exponerlo como propiedad VFX',()=>{
 const meteorological=newVfxResource('legacy','Legacy.vfx');meteorological.movement.space='world';meteorological.movement.tornadoFlow=true
 const normalized=validateVfxResource(meteorological)
 assert.equal(Object.hasOwn(normalized.movement,'tornadoFlow'),false)
 assert.doesNotMatch(template,/Vórtice meteorológico|patch\('movement','tornadoFlow'/)
 assert.match(scene,/tornadoWindAt/)
})
test('VI-19 ausencia de preview no afecta Player ni eventos meteorológicos',()=>{
 assert.doesNotMatch(editor,/new JoltWorld|new World|new WindField|new WebGLRenderer/)
 assert.match(editor,/stopPreview\(\)/)
})
test('VI-20 la vista puede caber en un Inspector estrecho y no necesita otro scroll',()=>{
 assert.match(editor,/\.vfx-editor \{[^}]*min-width:0/)
 assert.match(editor,/\.vfx-row \{[^}]*flex-wrap:wrap/)
 assert.doesNotMatch(editor,/\.vfx-body \{[^}]*overflow-y:auto/)
})
test('VI-21 la vista previa permite cerrarse explícitamente y es accesible',()=>{
 assert.match(template,/aria-label="Cerrar vista previa"/)
 assert.match(template,/aria-label="!previewActive\?'Iniciar vista previa'/)
 assert.match(template,/v-if="previewActive"/)
})
test('VI-22 el recurso no duplica el guardado global; finaliza el gesto al desmontarse',()=>{
 assert.doesNotMatch(template,/@click="confirm\(\); saveAll\(\)"/)
 assert.doesNotMatch(editor,/\bsaveAll\b/)
 const f=fixture();f.numeric('movement','speed',5);f.unmountFns.forEach(fn=>fn())
 assert.deepEqual(f.commits,[f.fx.id]);assert.equal(f.fx.movement.speed,5)
})
test('VI-23 el harness Vue/WebGL real está actualizado para Inspector',()=>{
 const harness=read('scripts/fixtures/vfx/s03/ui.html');assert.match(harness,/data-testid=\\?"vfx-inspector/)
 assert.match(harness,/S\.undo\(\)/);assert.match(harness,/Cerrar vista previa/)
})
