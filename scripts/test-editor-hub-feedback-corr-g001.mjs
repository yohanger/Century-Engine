// QA HF-01..HF-20. Ejecuta el script real de WelcomeScreen, sin montar Vue/DOM.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = f => readFileSync(new URL('../'+f,import.meta.url),'utf8')
const vue=read('src/components/WelcomeScreen.vue')
const state=read('src/core/state/state.js')
const project=read('src/core/state/project.js')
const script=vue.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
const instantiate=new Function('api', `const { ref, computed, onMounted, onBeforeUnmount, db, disk, store, createProject, openFromFolder, openRecent, duplicateProject, removeProject, isProjectOpen, openLfprojDialog, importBundle, toast, pickFile, Icon, TEMPLATES, DEFAULT_TEMPLATE, RENDERERS, DEFAULT_RENDERER, rendererName, askConfirm, window, console } = api;\n${script}\nreturn { refresh, guard, hubNotice, list, loading, sel, busy, retryRefresh, edit, dup, del, openFolder, importFile, create, pickParent, parent, name, nameErr, shown, current };`)
function setup(overrides={}) {
  let seq=0, reads=0
  const toasts=[], logs=[], errors=[]
  const db={listProjects:async()=>[{id:'p1',name:'Uno',createdAt:1,updatedAt:2,scenes:1,objects:0}],getLoc:async()=>null, ...overrides.db}
  const disk={canDisk:()=>false,locName:()=>'',pickDirectory:async()=>null,...overrides.disk}
  const store={toasts,log:logs,locked:true}
  const toast=(msg,kind='info')=>{const t={id:'t'+(++seq),msg,kind};toasts.push(t);if(!store.locked)logs.push(t)}
  let mounted
  const api={ref:v=>({value:v}), computed:fn=>({get value(){return fn()}}),onMounted:fn=>{mounted=fn},onBeforeUnmount:()=>{},
    window:{addEventListener:()=>{},removeEventListener:()=>{}},console:{error:(...args)=>errors.push(args)},
    db,disk,store,toast,askConfirm:async()=>false,createProject:async()=>{},openFromFolder:async()=>true,
    openRecent:async()=>true,duplicateProject:async()=>true,removeProject:async()=>true,isProjectOpen:()=>false,
    openLfprojDialog:async()=>true,importBundle:async()=>true,pickFile:async()=>[],TEMPLATES:[{id:'empty',category:'Inicio',game:{player:'none'}}],DEFAULT_TEMPLATE:'empty',RENDERERS:[{id:'forward',name:'PC'}],DEFAULT_RENDERER:'forward',rendererName:id=>id,Icon:{},
    ...overrides, db, disk}
  // Si la prueba sustituye store o toast, utilizar esos objetos y no los defaults.
  const o=instantiate({...api,mounted:undefined})
  return {...o,db,disk,store,toast,errors,api,mount:()=>mounted?.()}
}
test('HF-01 · la carga inicial actualiza lista y limpia loading',async()=>{
 const h=setup();assert.equal(await h.refresh(),true);assert.equal(h.loading.value,false);assert.equal(h.list.value.length,1);assert.equal(h.sel.value,'p1')
})
test('HF-02 · fallo de biblioteca se muestra sin cargar indefinidamente',async()=>{
 const h=setup({db:{listProjects:async()=>{throw Error('IndexedDB indisponible')}}});assert.equal(await h.refresh(),false)
 assert.equal(h.loading.value,false);assert.equal(h.hubNotice.value.action,'refresh');assert.match(h.hubNotice.value.detail,/IndexedDB/)
})
test('HF-03 · refresh conserva la lista anterior si falla una actualización',async()=>{
 let fail=false;const h=setup({db:{listProjects:async()=>{if(fail)throw Error('No hay acceso');return [{id:'p1',name:'Uno',updatedAt:1}]}}})
 await h.refresh();fail=true;await h.refresh();assert.equal(h.list.value.length,1);assert.equal(h.sel.value,'p1')
})
test('HF-04 · reintentar actualización limpia el error al recuperarse',async()=>{
 let fail=true;const h=setup({db:{listProjects:async()=>{if(fail)throw Error('Cerrado');return []}}})
 await h.refresh();fail=false;await h.retryRefresh();assert.equal(h.hubNotice.value,null);assert.equal(h.loading.value,false)
})
test('HF-05 · retorno false sin toast informa del fallo',async()=>{
 const h=setup();await h.guard(async()=>false,{failure:'Operación fallida'});assert.equal(h.hubNotice.value.title,'Operación fallida');assert.match(h.hubNotice.value.detail,/No se completó/)
})
test('HF-06 · utiliza error específico emitido por la operación y no uno antiguo',async()=>{
 const h=setup();h.toast('Viejo','error');await h.guard(async()=>{h.toast('Proyecto no existe','error');return false},{failure:'Abrir'});assert.equal(h.hubNotice.value.detail,'Proyecto no existe')
})
test('HF-07 · cancelación explícita no fabrica un error',async()=>{
 const h=setup();const r=await h.guard(async()=>false,{cancelOnFalse:true});assert.equal(r,false);assert.equal(h.hubNotice.value,null)
})
test('HF-08 · una excepción se comunica y deja libre el estado busy',async()=>{
 const h=setup();await h.guard(async()=>{throw Error('Permiso denegado')},{failure:'Abrir carpeta'});assert.equal(h.hubNotice.value.title,'Abrir carpeta');assert.equal(h.hubNotice.value.detail,'Permiso denegado');assert.equal(h.busy.value,false);assert.equal(h.errors.length,1)
})
test('HF-09 · evita operaciones solapadas',async()=>{
 const h=setup();h.busy.value=true;let calls=0;await h.guard(async()=>{calls++});assert.equal(calls,0)
})
test('HF-10 · cancelar selector de carpeta no informa un falso fallo',async()=>{
 const h=setup();await h.openFolder();assert.equal(h.hubNotice.value,null)
})
test('HF-11 · carpeta sin project.lfproj muestra razón específica',async()=>{
 const h=setup({disk:{pickDirectory:async()=>({kind:'path',path:'/x'})},openFromFolder:async()=>{throw Error('En esa carpeta no hay un project.lfproj')}})
 await h.openFolder();assert.match(h.hubNotice.value.detail,/no hay un project.lfproj/)
})
test('HF-12 · cancelar el selector de archivo no genera error',async()=>{const h=setup();await h.importFile();assert.equal(h.hubNotice.value,null)})
test('HF-13 · importar .lfproj inválido conserva el mensaje de su capa original',async()=>{
 let h;h=setup({pickFile:async()=>[{name:'roto.lfproj'}],openLfprojDialog:async()=>{h.toast('Formato del proyecto no válido','error');return false}})
 await h.importFile();assert.equal(h.hubNotice.value.detail,'Formato del proyecto no válido')
})
test('HF-14 · una importación JSON con error informa sin modificar la lista',async()=>{
 const h=setup({pickFile:async()=>[{name:'roto.json'}],importBundle:async()=>{throw Error('Archivo JSON corrupto')}})
 await h.refresh();await h.importFile();assert.match(h.hubNotice.value.detail,/JSON corrupto/);assert.equal(h.list.value.length,1)
})
test('HF-15 · proyecto ausente al abrir se comunica en el HUB',async()=>{
 let h;h=setup({openRecent:async()=>{h.toast('El proyecto no existe','error');return false}})
 await h.refresh();await h.edit();assert.equal(h.hubNotice.value.title,'No se pudo abrir el proyecto');assert.equal(h.hubNotice.value.detail,'El proyecto no existe')
})
test('HF-16 · cancelar elección de carpeta al abrir un reciente no crea error',async()=>{
 const h=setup({openRecent:async()=>false});await h.refresh();await h.edit();assert.equal(h.hubNotice.value,null)
})
test('HF-17 · duplicado inexistente devuelve resultado fallido y no se anuncia éxito',async()=>{
 let h;h=setup({duplicateProject:async()=>{h.toast('No se encontró el proyecto que deseas duplicar','error');return false}})
 await h.refresh();await h.dup();assert.equal(h.hubNotice.value.title,'No se pudo duplicar el proyecto');assert.match(h.hubNotice.value.detail,/No se encontró/)
})
test('HF-18 · eliminación bloqueada informa sin tocar datos',async()=>{
 let calls=0;const h=setup({isProjectOpen:()=>true,removeProject:async()=>{calls++;return true}})
 await h.refresh();await h.del();assert.equal(calls,0);assert.match(h.hubNotice.value.detail,/Primero cambia/)
})
test('HF-19 · cancelación de confirmación de borrado no presenta error',async()=>{
 const h=setup();await h.refresh();await h.del();assert.equal(h.hubNotice.value,null)
})
test('HF-20 · validación del nombre explica el rechazo sin crear el proyecto',async()=>{
 let called=0;const h=setup({createProject:async()=>{called++}});h.name.value='';await h.create();assert.equal(called,0);assert.equal(h.hubNotice.value.detail,'Escribe un nombre')
})
test('HF-21 · el aviso no se elimina por temporizador; se descarta por acción',()=>{
 assert.match(vue, /v-if="hubNotice && !creating" class="hub-notice" role="alert"/)
 assert.match(vue, /v-if="creating && hubNotice" class="hub-notice" role="alert"/)
 assert.match(vue, /@click="hubNotice = null"/)
 assert.doesNotMatch(script,/setTimeout\([^)]*hubNotice/)
})
test('HF-22 · banner incluye foco accesible y reintento condicionado',()=>{
 assert.match(vue,/aria-live="assertive"/);assert.match(vue,/aria-label="Descartar aviso"/)
 assert.match(vue,/hubNotice\.action === 'refresh'/);assert.match(vue,/max-width:480px/)
})
test('HF-23 · los avisos del HUB no entran en store.log pero los del Editor sí',()=>{
 const start=state.indexOf('export function toast('),end=state.indexOf('/** Copia profunda',start)
 assert.ok(start>0&&end>start)
 const code=state.slice(start,end).replace('export function toast','function toast')
 const make=new Function('store','uid','setTimeout', code+'\nreturn toast')
 const store={toasts:[],log:[],locked:true},notify=make(store,()=>`t${store.toasts.length+1}`,()=>{})
 notify('Error de HUB','error');assert.equal(store.toasts.length,1);assert.equal(store.log.length,0)
 store.locked=false;notify('Error del Editor','error');assert.equal(store.log.length,1);assert.equal(store.log[0].msg,'Error del Editor')
})
test('HF-24 · los errores técnicos legítimos conservan console.error',()=>{
 assert.match(script,/console\.error\('HUB · operación fallida:'/)
 assert.match(script,/console\.error\('HUB · biblioteca de proyectos:'/)
})
test('HF-25 · la duplicación mantiene sus consumidores e informa ausencia',()=>{
 assert.match(project,/No se encontró el proyecto que deseas duplicar/)
 assert.match(project,/toast\('Proyecto duplicado', 'ok'\)\n  return true/)
})
test('HF-26 · no se incorporan gestores paralelos, ni se altera el almacenamiento',()=>{
 assert.match(vue,/import \* as db/);assert.match(vue,/import \* as disk/)
 assert.doesNotMatch(vue,/new (NotificationService|HubManager|ErrorStore)/)
 assert.doesNotMatch(project,/hubNotice|showHubError/)
})
